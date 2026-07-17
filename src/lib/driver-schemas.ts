import { z } from "zod";

export const createDriverSchema = z.object({
  name: z.string().trim().min(2, "Driver name must contain at least 2 characters").max(80),
  login_name: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "Login name must contain at least 3 characters")
    .max(40)
    .regex(/^[a-z0-9._-]+$/, "Login name can use lowercase letters, digits, . _ - only"),
  phone: z
    .string()
    .trim()
    .min(10, "Phone number must contain at least 10 digits")
    .max(30),
  licence_number: z
    .string()
    .trim()
    .min(3, "Licence number must contain at least 3 characters")
    .max(40),
  licence_expiry: z.string().nullable().optional(),
  address: z.string().max(300).nullable().optional(),
  status: z.enum(["available", "assigned", "on_trip", "offline"]).default("available"),
  is_active: z.boolean().default(true),
  pin: z.string().trim().regex(/^\d{4}$/, "PIN must be exactly 4 digits"),
});

export const createDriverWithConfirmationSchema = createDriverSchema
  .extend({
    pin_confirm: z.string().trim(),
  })
  .refine((data) => data.pin === data.pin_confirm, {
    message: "PINs do not match",
    path: ["pin_confirm"],
  });

export const updateDriverSchema = createDriverSchema
  .omit({ pin: true })
  .extend({
    id: z.string().uuid(),
    status: z.enum(["available", "assigned", "on_trip", "offline"]),
    is_active: z.boolean(),
  });
