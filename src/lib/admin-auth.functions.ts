import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";
import { z } from "zod";

const ADMIN_SESSION_COOKIE = "sb_admin_session";
const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 8;
const FALLBACK_ADMIN_EMAIL = "admin@example.com";
const FALLBACK_ADMIN_PASSWORD = "admin123";
const FALLBACK_ADMIN_SESSION_SECRET = "devanga2025-cmd-smarth-bus-admin-session";

function getAdminEmail() {
  const value = process.env.ADMIN_EMAIL || FALLBACK_ADMIN_EMAIL;
  return value.trim().toLowerCase();
}

function getAdminPassword() {
  const value = process.env.ADMIN_PASSWORD || FALLBACK_ADMIN_PASSWORD;
  return value;
}

function getAdminSessionSecret() {
  const value = process.env.ADMIN_SESSION_SECRET || FALLBACK_ADMIN_SESSION_SECRET;
  return value;
}

function timingSafeStringEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function signSession(email: string, expiresAt: number) {
  return createHash("sha256")
    .update(`${email}.${expiresAt}.${getAdminSessionSecret()}`)
    .digest("base64url");
}

function createSessionToken(email: string) {
  const expiresAt = Date.now() + ADMIN_SESSION_TTL_SECONDS * 1000;
  const encodedEmail = Buffer.from(email).toString("base64url");
  const nonce = randomBytes(16).toString("base64url");
  const signature = signSession(email, expiresAt);
  return `${encodedEmail}.${expiresAt}.${nonce}.${signature}`;
}

function verifySessionToken(token: string | undefined) {
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 4) return null;

  const [encodedEmail, expiresAtRaw, , signature] = parts;
  const email = Buffer.from(encodedEmail, "base64url").toString("utf8");
  const expiresAt = Number(expiresAtRaw);
  if (!email || !Number.isFinite(expiresAt) || expiresAt < Date.now()) return null;

  const expected = signSession(email, expiresAt);
  if (!timingSafeStringEqual(signature, expected)) return null;

  return { email };
}

function setAdminSessionCookie(token: string) {
  setCookie(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_SESSION_TTL_SECONDS,
  });
}

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((raw) =>
    z
      .object({
        email: z.string().trim().email(),
        password: z.string().min(1),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();
    const validEmail = timingSafeStringEqual(email, getAdminEmail());
    const validPassword = timingSafeStringEqual(data.password, getAdminPassword());

    if (!validEmail || !validPassword) {
      throw new Error("Invalid administrator email or password");
    }

    const token = createSessionToken(email);
    setAdminSessionCookie(token);

    return { email };
  });

export const adminMe = createServerFn({ method: "GET" }).handler(async () => {
  const session = verifySessionToken(getCookie(ADMIN_SESSION_COOKIE));
  if (!session) return null;
  return session;
});

export const adminLogout = createServerFn({ method: "POST" }).handler(async () => {
  deleteCookie(ADMIN_SESSION_COOKIE, { path: "/" });
  return { ok: true };
});
