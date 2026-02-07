import { z } from "zod";

export const resolveRecipientQuerySchema = z.object({
  uid: z.string().min(1),
});

export const resolveRecipientEmailQuerySchema = z.object({
  email: z.string().email(),
});

export const sendTransferSchema = z.object({
  recipientUid: z.string().min(1),
  amount: z.string().min(1),
});
