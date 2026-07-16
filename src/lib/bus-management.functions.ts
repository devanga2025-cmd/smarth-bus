import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const busPayload = z.object({
  bus_number: z.string().trim().min(1).max(50),
  registration_number: z.string().trim().min(1).max(100),
  bus_name: z.string().trim().min(1).max(120),
  bus_type: z.string().trim().max(80).nullable().optional(),
  capacity: z.number().int().min(1).max(300).default(40),
  status: z.enum(["available", "assigned", "maintenance", "offline"]).default("available"),
  is_active: z.boolean().default(true),
});

export const adminCreateBus = createServerFn({ method: "POST" })
  .inputValidator((raw) => busPayload.parse(raw))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from("buses").insert({
      ...data,
      bus_type: data.bus_type || null,
    });

    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminListBuses = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("buses")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data;
});

export const adminUpdateBus = createServerFn({ method: "POST" })
  .inputValidator((raw) =>
    busPayload
      .extend({
        id: z.string().uuid(),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const { id, ...updates } = data;
    const { error } = await supabaseAdmin
      .from("buses")
      .update({
        ...updates,
        bus_type: updates.bus_type || null,
      })
      .eq("id", id);

    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteBus = createServerFn({ method: "POST" })
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from("buses").delete().eq("id", data.id);

    if (error) throw new Error(error.message);
    return { ok: true };
  });
