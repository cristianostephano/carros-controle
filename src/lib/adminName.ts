"use server";

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = "adminName";

/** Não é autenticação — só serve para saber quem fez cada ação administrativa. */
export async function getAdminName(): Promise<string> {
  const store = await cookies();
  return store.get(COOKIE_NAME)?.value || "Gestão";
}

export async function setAdminName(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  await prisma.adminUser.upsert({ where: { name }, create: { name }, update: {} });
  const store = await cookies();
  store.set(COOKIE_NAME, name, { maxAge: 60 * 60 * 24 * 365 });
}
