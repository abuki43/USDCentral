import { z } from "zod";

export const bridgeEstimateSchema = z.object({
  destinationChain: z.string().min(1),
  recipientAddress: z.string().min(1),
  amount: z.string().min(1),
});

export const bridgeWithdrawSchema = z.object({
  destinationChain: z.string().min(1),
  recipientAddress: z.string().min(1),
  amount: z.string().min(1),
});
