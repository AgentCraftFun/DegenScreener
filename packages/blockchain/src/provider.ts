import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base, baseSepolia } from "viem/chains";

export const CHAIN =
  process.env.CHAIN_ENV === "mainnet" ? base : baseSepolia;

const RPC_URL =
  process.env.BASE_RPC_URL ??
  (CHAIN.id === base.id
    ? "https://mainnet.base.org"
    : "https://sepolia.base.org");

export const publicClient = createPublicClient({
  chain: CHAIN,
  transport: http(RPC_URL),
});

export function getWalletClient(): ReturnType<typeof createWalletClient> {
  const pk = process.env.PLATFORM_PRIVATE_KEY;
  if (!pk) throw new Error("PLATFORM_PRIVATE_KEY not set");
  const account = privateKeyToAccount(pk as `0x${string}`);
  return createWalletClient({
    account,
    chain: CHAIN,
    transport: http(RPC_URL),
  });
}
