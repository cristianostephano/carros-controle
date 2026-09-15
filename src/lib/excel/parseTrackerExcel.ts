import ExcelJS from "exceljs";
import { combineBrDateAndTime, durationSecondsFromCell, timeOfDayFromCell } from "@/lib/dates";

export type ParsedTripRow = {
  rowNumber: number;
  rawRowJson: string;

  veiculoRaw: string;
  apelidoRaw: string;
  motoristasRaw: string | null;
  dataInicioRaw: string;
  horaInicioRaw: string;
  odometroInicioRaw: string | null;
  dataFimRaw: string;
  horaFimRaw: string;
  odometroFimRaw: string | null;
  enderecoInicioRaw: string | null;
  latInicioRaw: string | null;
  lonInicioRaw: string | null;
  enderecoFimRaw: string | null;
  latFimRaw: string | null;
  lonFimRaw: string | null;
  kmRaw: string | null;
  tempoRaw: string | null;
  litrosRaw: string | null;
  custoRaw: string | null;
  velocidadeMaxRaw: string | null;

  startDateTime: Date;
  endDateTime: Date;
  odometroInicio: number | null;
  odometroFim: number | null;
  km: number | null;
  durationSeconds: number | null;
  litros: number | null;
  custo: number | null;
  velocidadeMax: number | null;
  originLat: number | null;
  originLon: number | null;
  destLat: number | null;
  destLon: number | null;
};

export type ImportWarning = {
  code: string;
  message: string;
  rowNumbers?: number[];
};

export type ParseResult = {
  rows: ParsedTripRow[];
  sheetName: string;
};

const REQUIRED_HEADERS = [
  "veiculo",
  "apelido",
  "datainicio",
  "horainicio",
  "datafim",
  "horafim",
] as const;

function normalizeHeader(h: string): string {
  return h
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function cellString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "object" && "text" in (value as Record<string, unknown>)) {
    return String((value as { text: unknown }).text).trim();
  }
  const s = String(value).trim();
  return s === "" ? null : s;
}

function cellNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const normalized = value.trim().replace(/\./g, "").replace(",", ".");
    const n = Number(normalized);
    if (!Number.isNaN(n)) return n;
    const n2 = Number(value.trim());
    return Number.isNaN(n2) ? null : n2;
  }
  return null;
}

/**
 * Latitude/longitude vêm como texto já no formato "-23.554607" (ponto decimal
 * padrão, não separador de milhar brasileiro) — não usar cellNumber() aqui.
 */
function cellDecimal(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = Number(value.trim());
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

/**
 * Só faz a leitura/parse da planilha inteira, linha a linha — não sabe nada sobre
 * período nem calcula avisos. Isso é proposital: o rastreador do usuário só permite
 * exportar o histórico completo (todos os veículos, desde o início), então cada
 * importação é sempre re-processada e filtrada por período em runImport().
 */
export async function parseTrackerExcelRows(buffer: Buffer): Promise<ParseResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new Error("A planilha não tem nenhuma aba com dados.");
  }

  const headerRow = sheet.getRow(1);
  const colByKey = new Map<string, number>();
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const raw = cellString(cell.value);
    if (raw) colByKey.set(normalizeHeader(raw), colNumber);
  });

  const missing = REQUIRED_HEADERS.filter((k) => !colByKey.has(k));
  if (missing.length > 0) {
    throw new Error(
      `A planilha não tem o formato esperado do relatório do rastreador. Faltam as colunas: ${missing.join(", ")}.`
    );
  }

  const col = (key: string) => colByKey.get(key);
  const rows: ParsedTripRow[] = [];

  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    if (row.cellCount === 0 || !cellString(row.getCell(col("veiculo")!).value)) continue;

    const get = (key: string) => (col(key) ? row.getCell(col(key)!).value : null);

    const veiculoRaw = cellString(get("veiculo")) ?? "";
    const apelidoRaw = cellString(get("apelido")) ?? "";
    const motoristasRaw = cellString(get("motoristas"));
    const dataInicioRaw = cellString(get("datainicio")) ?? "";
    const dataFimRaw = cellString(get("datafim")) ?? "";
    const horaInicioCell = get("horainicio");
    const horaFimCell = get("horafim");
    const horaInicioTime = timeOfDayFromCell(horaInicioCell);
    const horaFimTime = timeOfDayFromCell(horaFimCell);
    const horaInicioRaw = `${String(horaInicioTime.h).padStart(2, "0")}:${String(horaInicioTime.m).padStart(2, "0")}:${String(horaInicioTime.s).padStart(2, "0")}`;
    const horaFimRaw = `${String(horaFimTime.h).padStart(2, "0")}:${String(horaFimTime.m).padStart(2, "0")}:${String(horaFimTime.s).padStart(2, "0")}`;

    const odometroInicioRaw = cellString(get("odometroinicio"));
    const odometroFimRaw = cellString(get("odometrofim"));
    const kmRaw = cellString(get("km"));
    const tempoCell = get("tempo");
    const tempoRaw = cellString(tempoCell);
    const litrosRaw = cellString(get("litros"));
    const custoRaw = cellString(get("custo"));
    const velocidadeMaxRaw = cellString(get("velocidademax"));
    const enderecoInicioRaw = cellString(get("enderecoinicio"));
    const latInicioRaw = cellString(get("latitudeinicio"));
    const lonInicioRaw = cellString(get("longitudeinicio"));
    const enderecoFimRaw = cellString(get("enderecofim"));
    const latFimRaw = cellString(get("latitudefim"));
    const lonFimRaw = cellString(get("longitudefim"));

    let startDateTime: Date;
    let endDateTime: Date;
    try {
      startDateTime = combineBrDateAndTime(dataInicioRaw, horaInicioTime);
      endDateTime = combineBrDateAndTime(dataFimRaw, horaFimTime);
    } catch {
      continue;
    }

    const odometroInicio = cellNumber(get("odometroinicio"));
    const odometroFim = cellNumber(get("odometrofim"));
    const km = cellNumber(get("km"));

    rows.push({
      rowNumber: r,
      rawRowJson: JSON.stringify(
        Object.fromEntries(
          [...colByKey.entries()].map(([, colNum]) => [
            String(headerRow.getCell(colNum).value),
            row.getCell(colNum).value instanceof Date
              ? (row.getCell(colNum).value as Date).toISOString()
              : row.getCell(colNum).value,
          ])
        )
      ),
      veiculoRaw,
      apelidoRaw,
      motoristasRaw,
      dataInicioRaw,
      horaInicioRaw,
      odometroInicioRaw,
      dataFimRaw,
      horaFimRaw,
      odometroFimRaw,
      enderecoInicioRaw,
      latInicioRaw,
      lonInicioRaw,
      enderecoFimRaw,
      latFimRaw,
      lonFimRaw,
      kmRaw,
      tempoRaw,
      litrosRaw,
      custoRaw,
      velocidadeMaxRaw,
      startDateTime,
      endDateTime,
      odometroInicio,
      odometroFim,
      km,
      durationSeconds: durationSecondsFromCell(tempoCell),
      litros: cellNumber(get("litros")),
      custo: cellNumber(get("custo")),
      velocidadeMax: cellNumber(get("velocidademax")),
      originLat: cellDecimal(latInicioRaw),
      originLon: cellDecimal(lonInicioRaw),
      destLat: cellDecimal(latFimRaw),
      destLon: cellDecimal(lonFimRaw),
    });
  }

  return { rows, sheetName: sheet.name };
}

/**
 * Avisos de qualidade de dado calculados sobre um conjunto de linhas — chamar
 * SEMPRE com o subconjunto já filtrado pelo período (e já sem as que são
 * reimportações de viagens já existentes), senão os avisos de "placa com mais
 * de um vendedor" e "lacuna de odômetro" disparam por causa de troca normal de
 * vendedor/carro ao longo do histórico, não por erro real dentro do período.
 */
export function computeImportWarnings(rows: ParsedTripRow[]): ImportWarning[] {
  const warnings: ImportWarning[] = [];

  const rowsMissingFields = rows
    .filter((r) => !r.enderecoInicioRaw || !r.enderecoFimRaw || r.km == null)
    .map((r) => r.rowNumber);
  if (rowsMissingFields.length > 0) {
    warnings.push({
      code: "CAMPOS_FALTANDO",
      message: `${rowsMissingFields.length} trajeto(s) sem origem, destino ou quilometragem.`,
      rowNumbers: rowsMissingFields,
    });
  }

  const rowsBadOdometer = rows
    .filter((r) => r.odometroInicio != null && r.odometroFim != null && r.odometroFim < r.odometroInicio)
    .map((r) => r.rowNumber);
  if (rowsBadOdometer.length > 0) {
    warnings.push({
      code: "ODOMETRO_INVALIDO",
      message: `${rowsBadOdometer.length} trajeto(s) com odômetro final menor que o inicial.`,
      rowNumbers: rowsBadOdometer,
    });
  }

  // Placa associada a mais de um apelido dentro do próprio período
  const plateToNicknames = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!plateToNicknames.has(row.veiculoRaw)) plateToNicknames.set(row.veiculoRaw, new Set());
    plateToNicknames.get(row.veiculoRaw)!.add(row.apelidoRaw || "(sem vendedor identificado)");
  }
  const conflictingPlates = [...plateToNicknames.entries()].filter(([, names]) => names.size > 1);
  if (conflictingPlates.length > 0) {
    warnings.push({
      code: "PLACA_APELIDO_DIVERGENTE",
      message: `Placa(s) associada(s) a mais de um vendedor dentro deste período: ${conflictingPlates
        .map(([plate, names]) => `${plate} (${[...names].join(", ")})`)
        .join("; ")}.`,
    });
  }

  // Lacunas de odômetro entre trajetos consecutivos do mesmo veículo
  const byVehicle = new Map<string, ParsedTripRow[]>();
  for (const row of rows) {
    if (!byVehicle.has(row.veiculoRaw)) byVehicle.set(row.veiculoRaw, []);
    byVehicle.get(row.veiculoRaw)!.push(row);
  }
  const gapRows: number[] = [];
  const TOLERANCE_KM = 0.5;
  for (const vehicleRows of byVehicle.values()) {
    const sorted = [...vehicleRows].sort((a, b) => a.startDateTime.getTime() - b.startDateTime.getTime());
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      if (prev.odometroFim != null && curr.odometroInicio != null) {
        if (Math.abs(curr.odometroInicio - prev.odometroFim) > TOLERANCE_KM) {
          gapRows.push(curr.rowNumber);
        }
      }
    }
  }
  if (gapRows.length > 0) {
    warnings.push({
      code: "LACUNA_ODOMETRO",
      message: `${gapRows.length} trajeto(s) com lacuna de odômetro em relação ao trajeto anterior do mesmo veículo.`,
      rowNumbers: gapRows,
    });
  }

  const zeroFuelCount = rows.filter((r) => (r.litros ?? 0) === 0).length;
  if (zeroFuelCount > 0) {
    warnings.push({
      code: "LITROS_CUSTO_ZERADOS",
      message: `${zeroFuelCount} trajeto(s) com litros e/ou custo zerados (apenas informativo).`,
    });
  }

  return warnings;
}
