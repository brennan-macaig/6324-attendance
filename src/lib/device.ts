import { randomBytes } from "node:crypto";

export const DEVICE_COOKIE = "frc_device";
export const DEVICE_COOKIE_MAX_AGE = 60 * 60 * 24 * 400; // ~13 months (browser max)

export function newDeviceId(): string {
  return randomBytes(16).toString("base64url");
}

export function isValidDeviceId(v: string | undefined | null): v is string {
  return !!v && /^[A-Za-z0-9_-]{16,64}$/.test(v);
}

export const cookieBase = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};
