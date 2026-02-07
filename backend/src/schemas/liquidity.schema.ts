import { z } from "zod";

export const quoteSchema = z.object({
  amount: z.string().min(1),
  rangePreset: z.enum(["narrow", "balanced", "wide"]),
});

export const createPositionSchema = quoteSchema;

export const uidQuerySchema = z.object({
  uid: z.string().min(1),
});
