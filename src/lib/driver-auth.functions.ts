import { createServerFn } from "@tanstack/react-start";
import { getCookie, setCookie, deleteCookie, getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

const SESSION_COOKIE = "sb_driver_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

function isSecureRequest() {
  const proto = getRequestHeader("x-forwarded-proto");
  return proto === "https";
}

function isMissingDriverAuthColumn(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return (
    message.includes("'name' column") ||
    message.includes("'phone' column") ||
    message.includes("'licence_number' column") ||
    message.includes("'licence_expiry' column") ||
    message.includes("'address' column") ||
    message.includes("'status' column") ||
    message.includes("'is_active' column") ||
    message.includes("'login_name' column") ||
    message.includes("'pin_hash' column") ||
    message.includes("'failed_login_attempts' column") ||
    message.includes("'locked_until' column") ||
    message.includes("drivers.name does not exist") ||
    message.includes("drivers.phone does not exist") ||
    message.includes("drivers.licence_number does not exist") ||
    message.includes("drivers.licence_expiry does not exist") ||
    message.includes("drivers.address does not exist") ||
    message.includes("drivers.status does not exist") ||
    message.includes("drivers.is_active does not exist") ||
    message.includes("drivers.login_name does not exist") ||
    message.includes("drivers.pin_hash does not exist") ||
    message.includes("drivers.failed_login_attempts does not exist") ||
    message.includes("drivers.locked_until does not exist") ||
    message.includes("Could not find the 'name' column") ||
    message.includes("Could not find the 'phone' column") ||
    message.includes("Could not find the 'licence_number' column") ||
    message.includes("Could not find the 'licence_expiry' column") ||
    message.includes("Could not find the 'address' column") ||
    message.includes("Could not find the 'status' column") ||
    message.includes("Could not find the 'is_active' column") ||
    message.includes("Could not find the 'login_name' column") ||
    message.includes("Could not find the 'pin_hash' column") ||
    message.includes("Could not find the 'failed_login_attempts' column") ||
    message.includes("Could not find the 'locked_until' column")
  );
}

function missingDriverSchemaMessage() {
  return "Drivers table schema is incomplete. Run supabase/migrations/20260716164000_driver_auth_schema.sql in the Supabase SQL Editor.";
}

function driverDetailsPayload(data: {
  name: string;
  phone: string;
  licence_number: string;
  licence_expiry?: string | null;
  address?: string | null;
  status: "available" | "assigned" | "on_trip" | "offline";
  is_active: boolean;
}) {
  return {
    name: data.name,
    phone: data.phone,
    licence_number: data.licence_number,
    licence_expiry: data.licence_expiry || null,
    address: data.address || null,
    status: data.status,
    is_active: data.is_active,
  };
}

// -------- Admin: create driver --------
export const adminCreateDriver = createServerFn({ method: "POST" })
  .inputValidator((raw) =>
    z
      .object({
        name: z.string().trim().min(2).max(80),
        login_name: z
          .string()
          .trim()
          .min(3)
          .max(40)
          .regex(/^[a-z0-9._-]+$/, "Lowercase letters, digits, . _ - only"),
        phone: z.string().trim().min(4).max(30),
        licence_number: z.string().trim().min(3).max(40),
        licence_expiry: z.string().nullable().optional(),
        address: z.string().max(300).nullable().optional(),
        status: z.enum(["available", "assigned", "on_trip", "offline"]).default("available"),
        is_active: z.boolean().default(true),
        pin: z.string(),
        pin_confirm: z.string(),
      })
      .refine((d) => d.pin === d.pin_confirm, {
        message: "PINs do not match",
        path: ["pin_confirm"],
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const { validatePinFormat, hashPin } = await import("./driver-auth.server");
    const err = validatePinFormat(data.pin);
    if (err) throw new Error(err);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const login_name = data.login_name.toLowerCase();

    const existing = await supabaseAdmin
      .from("drivers")
      .select("id")
      .ilike("login_name", login_name)
      .maybeSingle();
    if (existing.error && !isMissingDriverAuthColumn(existing.error)) {
      throw new Error(existing.error.message);
    }
    if (existing.data) throw new Error("Login name already exists");

    const pin_hash = hashPin(data.pin);
    const payload = driverDetailsPayload(data);
    const result = await supabaseAdmin
      .from("drivers")
      .insert({
        ...payload,
        login_name,
        pin_hash,
      } as never)
      .select("id, login_name")
      .single();

    if (result.error && isMissingDriverAuthColumn(result.error)) {
      const fallback = await supabaseAdmin
        .from("drivers")
        .insert(payload as never)
        .select("id, name")
        .single();
      if (fallback.error && isMissingDriverAuthColumn(fallback.error)) {
        throw new Error(missingDriverSchemaMessage());
      }
      if (fallback.error) throw new Error(fallback.error.message);
      const row = fallback.data as { id: string; name: string };
      return { id: row.id, login_name: login_name };
    }

    if (result.error) throw new Error(result.error.message);
    const row = result.data;
    return {
      id: (row as { id: string }).id,
      login_name: (row as { login_name: string }).login_name,
    };
  });

export const adminListDrivers = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("drivers")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data;
});

// -------- Admin: update driver (no PIN change here) --------
export const adminUpdateDriver = createServerFn({ method: "POST" })
  .inputValidator((raw) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().trim().min(2).max(80),
        login_name: z
          .string()
          .trim()
          .min(3)
          .max(40)
          .regex(/^[a-z0-9._-]+$/),
        phone: z.string().trim().min(4).max(30),
        licence_number: z.string().trim().min(3).max(40),
        licence_expiry: z.string().nullable().optional(),
        address: z.string().max(300).nullable().optional(),
        status: z.enum(["available", "assigned", "on_trip", "offline"]),
        is_active: z.boolean(),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const login_name = data.login_name.toLowerCase();
    const clash = await supabaseAdmin
      .from("drivers")
      .select("id")
      .ilike("login_name", login_name)
      .neq("id", data.id)
      .maybeSingle();
    if (clash.error && !isMissingDriverAuthColumn(clash.error)) {
      throw new Error(clash.error.message);
    }
    if (clash.data) throw new Error("Login name already used by another driver");
    const payload = driverDetailsPayload(data);
    const result = await supabaseAdmin
      .from("drivers")
      .update({
        ...payload,
        login_name,
      } as never)
      .eq("id", data.id);

    if (result.error && isMissingDriverAuthColumn(result.error)) {
      const fallback = await supabaseAdmin
        .from("drivers")
        .update(payload as never)
        .eq("id", data.id);
      if (fallback.error && isMissingDriverAuthColumn(fallback.error)) {
        throw new Error(missingDriverSchemaMessage());
      }
      if (fallback.error) throw new Error(fallback.error.message);
      return { ok: true };
    }

    if (result.error) throw new Error(result.error.message);
    return { ok: true };
  });

// -------- Admin: delete driver --------
export const adminDeleteDriver = createServerFn({ method: "POST" })
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("drivers").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -------- Admin: reset PIN --------
export const adminResetDriverPin = createServerFn({ method: "POST" })
  .inputValidator((raw) =>
    z
      .object({
        id: z.string().uuid(),
        pin: z.string(),
        pin_confirm: z.string(),
      })
      .refine((d) => d.pin === d.pin_confirm, {
        message: "PINs do not match",
        path: ["pin_confirm"],
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const { validatePinFormat, hashPin } = await import("./driver-auth.server");
    const err = validatePinFormat(data.pin);
    if (err) throw new Error(err);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const pin_hash = hashPin(data.pin);
    const { error } = await supabaseAdmin
      .from("drivers")
      .update({ pin_hash, failed_login_attempts: 0, locked_until: null } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    // Revoke all active sessions for this driver
    await supabaseAdmin
      .from("driver_sessions")
      .update({ revoked_at: new Date().toISOString() } as never)
      .eq("driver_id", data.id)
      .is("revoked_at", null);
    return { ok: true };
  });

// -------- Driver: login --------
export const driverLogin = createServerFn({ method: "POST" })
  .inputValidator((raw) =>
    z
      .object({
        login_name: z.string().trim().min(1).max(60),
        pin: z.string().regex(/^\d{4}$/, "PIN must be 4 digits"),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const { verifyPin, newSessionToken, hashSessionToken } = await import("./driver-auth.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const login_name = data.login_name.toLowerCase().trim();
    const ua = getRequestHeader("user-agent") ?? null;
    const ip =
      getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ??
      getRequestHeader("cf-connecting-ip") ??
      null;

    const logAttempt = async (driver_id: string | null, success: boolean) => {
      await supabaseAdmin.from("driver_login_attempts").insert({
        driver_id,
        attempted_login_name: login_name,
        success,
        ip_address: ip,
        user_agent: ua,
      } as never);
    };

    const driverResult = await supabaseAdmin
      .from("drivers")
      .select("id, name, login_name, pin_hash, is_active, failed_login_attempts, locked_until")
      .ilike("login_name", login_name)
      .maybeSingle();

    if (driverResult.error && isMissingDriverAuthColumn(driverResult.error)) {
      throw new Error(
        "Driver login is not enabled yet. Please run the driver auth schema migration in Supabase SQL Editor.",
      );
    }
    if (driverResult.error) throw new Error(driverResult.error.message);

    const driver = driverResult.data;

    if (!driver) {
      await logAttempt(null, false);
      throw new Error("Invalid login name or PIN");
    }
    const d = driver as {
      id: string;
      name: string;
      login_name: string;
      pin_hash: string | null;
      is_active: boolean;
      failed_login_attempts: number;
      locked_until: string | null;
    };
    if (!d.is_active) {
      await logAttempt(d.id, false);
      throw new Error("This driver account is deactivated. Contact your administrator.");
    }
    if (d.locked_until && new Date(d.locked_until) > new Date()) {
      await logAttempt(d.id, false);
      const mins = Math.max(
        1,
        Math.ceil((new Date(d.locked_until).getTime() - Date.now()) / 60000),
      );
      throw new Error(`Account locked. Try again in ${mins} minute${mins > 1 ? "s" : ""}.`);
    }
    if (!d.pin_hash) {
      await logAttempt(d.id, false);
      throw new Error("No PIN set for this driver. Ask your administrator to set one.");
    }

    const ok = verifyPin(data.pin, d.pin_hash);
    if (!ok) {
      const attempts = d.failed_login_attempts + 1;
      const patch: Record<string, unknown> = { failed_login_attempts: attempts };
      if (attempts >= MAX_ATTEMPTS) {
        patch.locked_until = new Date(Date.now() + LOCK_MINUTES * 60 * 1000).toISOString();
        patch.failed_login_attempts = 0;
      }
      await supabaseAdmin
        .from("drivers")
        .update(patch as never)
        .eq("id", d.id);
      await logAttempt(d.id, false);
      if (patch.locked_until)
        throw new Error(`Too many attempts. Locked for ${LOCK_MINUTES} minutes.`);
      throw new Error(
        `Invalid PIN. ${MAX_ATTEMPTS - attempts} attempt${MAX_ATTEMPTS - attempts !== 1 ? "s" : ""} left.`,
      );
    }

    // Success – clear counters, create session
    await supabaseAdmin
      .from("drivers")
      .update({ failed_login_attempts: 0, locked_until: null } as never)
      .eq("id", d.id);

    const token = newSessionToken();
    const token_hash = hashSessionToken(token);
    const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
    await supabaseAdmin.from("driver_sessions").insert({
      driver_id: d.id,
      token_hash,
      user_agent: ua,
      ip_address: ip,
      expires_at: expiresAt.toISOString(),
    } as never);

    setCookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: isSecureRequest(),
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    });
    await logAttempt(d.id, true);

    return { id: d.id, name: d.name, login_name: d.login_name };
  });

// -------- Driver: current session --------
export const driverMe = createServerFn({ method: "GET" }).handler(async () => {
  const { hashSessionToken } = await import("./driver-auth.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const token = getCookie(SESSION_COOKIE);
  if (!token) return null;
  const token_hash = hashSessionToken(token);
  const result = await supabaseAdmin
    .from("driver_sessions")
    .select("driver_id, expires_at, revoked_at, drivers(id, name, login_name, is_active)")
    .eq("token_hash", token_hash)
    .maybeSingle();
  if (result.error && isMissingDriverAuthColumn(result.error)) {
    const fallback = await supabaseAdmin
      .from("driver_sessions")
      .select("driver_id, expires_at, revoked_at, drivers(id, name, is_active)")
      .eq("token_hash", token_hash)
      .maybeSingle();

    if (fallback.error) return null;
    if (!fallback.data) return null;

    const row = fallback.data as unknown as {
      driver_id: string;
      expires_at: string;
      revoked_at: string | null;
      drivers: { id: string; name: string; is_active: boolean } | null;
    };

    if (row.revoked_at) return null;
    if (new Date(row.expires_at) < new Date()) return null;
    if (!row.drivers?.is_active) return null;
    await supabaseAdmin
      .from("driver_sessions")
      .update({ last_active_at: new Date().toISOString() } as never)
      .eq("token_hash", token_hash);
    return { id: row.drivers.id, name: row.drivers.name, login_name: row.drivers.name };
  }
  if (result.error) return null;

  const data = result.data;
  if (!data) return null;
  const row = data as unknown as {
    driver_id: string;
    expires_at: string;
    revoked_at: string | null;
    drivers: { id: string; name: string; login_name: string; is_active: boolean } | null;
  };
  if (row.revoked_at) return null;
  if (new Date(row.expires_at) < new Date()) return null;
  if (!row.drivers?.is_active) return null;
  await supabaseAdmin
    .from("driver_sessions")
    .update({ last_active_at: new Date().toISOString() } as never)
    .eq("token_hash", token_hash);
  return { id: row.drivers.id, name: row.drivers.name, login_name: row.drivers.login_name };
});

// -------- Driver: logout --------
export const driverLogout = createServerFn({ method: "POST" }).handler(async () => {
  const { hashSessionToken } = await import("./driver-auth.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const token = getCookie(SESSION_COOKIE);
  if (token) {
    const token_hash = hashSessionToken(token);
    await supabaseAdmin
      .from("driver_sessions")
      .update({ revoked_at: new Date().toISOString() } as never)
      .eq("token_hash", token_hash);
  }
  deleteCookie(SESSION_COOKIE, { path: "/" });
  return { ok: true };
});
