// Server-only helpers for driver PIN auth. Never import from client-reachable code.
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const PEPPER = () => {
  const v = process.env.DRIVER_PIN_PEPPER;
  if (!v) throw new Error("DRIVER_PIN_PEPPER is not set");
  return v;
};

const SESSION_SECRET = () => {
  const v = process.env.DRIVER_SESSION_SECRET;
  if (!v) throw new Error("DRIVER_SESSION_SECRET is not set");
  return v;
};

const WEAK_PINS = new Set([
  "0000",
  "1111",
  "2222",
  "3333",
  "4444",
  "5555",
  "6666",
  "7777",
  "8888",
  "9999",
  "1234",
  "4321",
  "1212",
  "2121",
  "1122",
  "2211",
  "0123",
  "9876",
]);

export function validatePinFormat(pin: string): string | null {
  if (!/^[0-9]{4}$/.test(pin)) return "PIN must be exactly 4 digits";
  if (WEAK_PINS.has(pin)) return "This PIN is too easy to guess. Choose another.";
  return null;
}

// scrypt with peppered PIN → base64(salt).base64(hash)
export function hashPin(pin: string): string {
  const salt = randomBytes(16);
  const key = scryptSync(pin + PEPPER(), salt, 32, { N: 16384, r: 8, p: 1 });
  return `${salt.toString("base64")}.${key.toString("base64")}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  try {
    const [saltB64, keyB64] = stored.split(".");
    if (!saltB64 || !keyB64) return false;
    const salt = Buffer.from(saltB64, "base64");
    const expected = Buffer.from(keyB64, "base64");
    const actual = scryptSync(pin + PEPPER(), salt, expected.length, { N: 16384, r: 8, p: 1 });
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function newSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string) {
  return createHash("sha256")
    .update(token + SESSION_SECRET())
    .digest("hex");
}

export function normalizeLoginName(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "");
}

export function suggestLoginName(fullName: string) {
  return fullName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
}
