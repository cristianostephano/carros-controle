import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "session";
const secretKey = process.env.SESSION_SECRET;
if (!secretKey) {
  throw new Error("SESSION_SECRET não configurado no .env");
}
const encodedKey = new TextEncoder().encode(secretKey);

export async function createSession() {
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const session = await new SignJWT({ admin: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(encodedKey);

  const store = await cookies();
  store.set(COOKIE_NAME, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

export async function deleteSession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/** Verifica a sessão a partir do cookie. Não lança erro — retorna null se inválida/ausente. */
export async function verifySessionCookie(token: string | undefined) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, encodedKey, { algorithms: ["HS256"] });
    return payload.admin === true ? payload : null;
  } catch {
    return null;
  }
}

export async function getSession() {
  const store = await cookies();
  return verifySessionCookie(store.get(COOKIE_NAME)?.value);
}
