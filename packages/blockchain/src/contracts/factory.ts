import { encodeFunctionData, type Abi } from "viem";
import factoryAbi from "../abi/DegenScreenerFactory.json" with { type: "json" };
import { publicClient } from "../provider.js";

const ABI = factoryAbi as Abi;

function getAddress(): `0x${string}` {
  const addr = process.env.FACTORY_ADDRESS;
  if (!addr) throw new Error("FACTORY_ADDRESS not set");
  return addr as `0x${string}`;
}

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

export async function getAllTokensLength(): Promise<bigint> {
  return (await publicClient.readContract({
    address: getAddress(),
    abi: ABI,
    functionName: "allTokensLength",
  })) as bigint;
}

export async function getTokenAtIndex(index: bigint): Promise<string> {
  return (await publicClient.readContract({
    address: getAddress(),
    abi: ABI,
    functionName: "allTokens",
    args: [index],
  })) as string;
}

export async function getDeployFee(): Promise<bigint> {
  return (await publicClient.readContract({
    address: getAddress(),
    abi: ABI,
    functionName: "deployFee",
  })) as bigint;
}

export async function getTokenCreator(
  tokenAddress: `0x${string}`,
): Promise<string> {
  return (await publicClient.readContract({
    address: getAddress(),
    abi: ABI,
    functionName: "tokenCreator",
    args: [tokenAddress],
  })) as string;
}

// ---------------------------------------------------------------------------
// TX builders — return encoded calldata for signing service
// ---------------------------------------------------------------------------

/**
 * Build calldata for createToken(name, symbol).
 * Returns { to, data, value } ready for signAndSend.
 */
export function buildCreateTokenTx(
  name: string,
  symbol: string,
  deployFee: bigint,
): { to: `0x${string}`; data: `0x${string}`; value: bigint } {
  const data = encodeFunctionData({
    abi: ABI,
    functionName: "createToken",
    args: [name, symbol],
  });
  return { to: getAddress(), data, value: deployFee };
}
