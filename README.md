# Gestão de Frota

Sistema para controlar o uso pessoal x profissional dos carros da empresa e calcular o reembolso de combustível por quinzena.

## Como rodar no seu computador

1. Abra uma janela de terminal (PowerShell) dentro desta pasta (`carros-controle`).
2. Na primeira vez, instale as dependências:
   ```
   npm install
   ```
3. Rode o sistema:
   ```
   npm run dev
   ```
4. Abra `http://localhost:3000` no navegador.

Para parar, volte no terminal e aperte `Ctrl+C`.

Os dados ficam guardados num único arquivo, `dev.db`, dentro desta mesma pasta. Fazer backup é simplesmente copiar esse arquivo para outro lugar (com o sistema parado).

## Fluxo de uso normal (a cada quinzena)

1. Menu **Períodos** → **Novo período** → **Gerar quinzenas do mês** (cria automaticamente a quinzena de 01 a 15 e a de 16 até o último dia útil).
2. Entre no período → **Importar planilha** → selecione o arquivo (ou arquivos) exportado do rastreador. Pode reenviar sempre o histórico completo — o sistema filtra sozinho o que é dessa quinzena e ignora o que já foi importado antes.
3. Confira a prévia e clique em **Confirmar importação**.
4. No painel do período, use **Revisar por vendedor** para conferir as viagens de cada um, aprovar ou ajustar a classificação (individual ou em lote).
5. Na página de cada vendedor, copie o **link individual** e mande a mensagem pronta pelo WhatsApp — o vendedor responde pelo celular sem precisar de senha.
6. Quando tudo estiver revisado, vá em **Fechar período** para travar os valores e depois **Exportar Excel** para mandar ao financeiro.

## Cadastros que valem para todos os períodos

- **Veículos e tarifas**: associe cada placa a um modelo (Renault Kwid, Fiat Mobi, ou outro que você cadastrar) e defina a tarifa em R$/km de cada modelo. Alterar a tarifa não muda quinzenas já fechadas.
- **Feriados**: os feriados nacionais já vêm carregados sozinhos. Cadastre aqui feriados municipais ou dias que fogem da regra (ex: um sábado que virou dia útil).

## Se algo der errado

- **A tela não abre**: confirme que o terminal ainda está rodando `npm run dev` e que não apareceu nenhum erro nele.
- **Perdi alguma coisa**: se você tem uma cópia de backup do arquivo `dev.db`, pode substituir o atual por ela (com o sistema parado) para voltar a um estado anterior.
- **Preciso reclassificar viagens depois de mudar um feriado**: dentro do período, use o botão **Reclassificar viagens**.

## O que ainda não existe (fora do escopo da primeira versão)

- Login/senha para os vendedores (o link individual longo é a única proteção, como combinado).
- Envio automático de WhatsApp (o sistema só copia a mensagem pronta).
- Integração direta com o rastreador (a importação é sempre por arquivo Excel).
