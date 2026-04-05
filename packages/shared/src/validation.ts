import { z } from "zod";
import {
  AgentType,
  Personality,
  TradeType,
} from "./types/enums.js";

const decimalString = z
  .string()
  .regex(/^\d+(\.\d+)?$/, "must be a positive decimal string");

export const CreateAgentRequestSchema = z.object({
  name: z.string().min(1).max(64),
  handle: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[a-zA-Z0-9_]+$/),
  type: z.nativeEnum(AgentType),
  personality: z.nativeEnum(Personality),
  riskProfile: z.record(z.unknown()),
  initialFunding: decimalString,
});
export type CreateAgentRequestInput = z.infer<typeof CreateAgentRequestSchema>;

export const UpdateAgentConfigRequestSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  riskProfile: z.record(z.unknown()).optional(),
  personality: z.nativeEnum(Personality).optional(),
});
export type UpdateAgentConfigRequestInput = z.infer<
  typeof UpdateAgentConfigRequestSchema
>;

export const DepositRequestSchema = z.object({
  amount: decimalString,
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
});
export type DepositRequestInput = z.infer<typeof DepositRequestSchema>;

export const WithdrawRequestSchema = z.object({
  amount: decimalString,
});
export type WithdrawRequestInput = z.infer<typeof WithdrawRequestSchema>;

export const TradeDecisionSchema = z.object({
  agentId: z.string().uuid(),
  tokenId: z.string().uuid(),
  type: z.nativeEnum(TradeType),
  amount: decimalString,
});
export type TradeDecisionInput = z.infer<typeof TradeDecisionSchema>;
