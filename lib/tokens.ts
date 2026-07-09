import { randomBytes } from "node:crypto";

export function generateToken(): string {
  return randomBytes(24).toString("base64url");
}
