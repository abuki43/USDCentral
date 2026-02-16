import { z } from "zod";

const usdcAmountSchema = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,6})?$/, "Amount must be a positive number with up to 6 decimals.")
  .refine((value) => {
    const [whole = "0", fraction = ""] = value.split(".");
    return !/^0+$/.test(whole) || !/^0*$/.test(fraction);
  }, "Amount must be greater than 0.");

export const quoteSchema = z.object({
  amount: usdcAmountSchema,
});

export const depositSchema = quoteSchema;

export const withdrawSchema = z.object({
  amount: usdcAmountSchema,
});
