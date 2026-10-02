"use server";

import { timingSafeEqual, createHash } from "crypto";
import { redirect } from "next/navigation";
import { createSession, deleteSession } from "@/lib/session";

function passwordsMatch(input: string, expected: string): boolean {
  const a = createHash("sha256").update(input).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export type LoginState = { error?: string } | undefined;

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const password = String(formData.get("password") ?? "");
  const expected = process.env.ADMIN_PASSWORD;

  if (!expected) {
    return { error: "ADMIN_PASSWORD não configurado no servidor." };
  }
  if (!password || !passwordsMatch(password, expected)) {
    return { error: "Senha incorreta." };
  }

  await createSession();
  redirect("/periodos");
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
