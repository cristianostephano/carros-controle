import { customAlphabet } from "nanoid";

// Sem caracteres ambíguos (0/O, 1/l/I), só pra facilitar se alguém precisar digitar/conferir.
const alphabet = "23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ";
const generate = customAlphabet(alphabet, 40);

export function generateAccessToken(): string {
  return generate();
}
