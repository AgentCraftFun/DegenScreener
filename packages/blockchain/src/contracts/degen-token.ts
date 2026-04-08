import { encodeFunctionData, type Abi } from "viem";
import degenTokenAbi from "../abi/DegenToken.json" with { type: "json" };
import { publicClient } from "../provider.js";

const ABI = degenTokenAbi as Abi;

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

export async function getTokenBalance(
  tokenAddress: `0x${string}`,
  account: `0x${string}`,
): Promise<bigint> {
  return (await publicClient.readContract({
    address: tokenAddress,
    abi: ABI,
    functionName: "balanceOf",
    args: [account],
  })) as bigint;
}

export async function getTokenAllowance(
  tokenAddress: `0x${string}`,
  owner: `0x${string}`,
  spender: `0x${string}`,
): Promise<bigint> {
  return (await publicClient.readContract({
    address: tokenAddress,
    abi: ABI,
    functionName: "allowance",
    args: [owner, spender],
  })) as bigint;
}

export async function getTokenTotalSupply(
  tokenAddress: `0x${string}`,
): Promise<bigint> {
  return (await publicClient.readContract({
    address: tokenAddress,
    abi: ABI,
    functionName: "totalSupply",
  })) as bigint;
}

export async function getTokenName(
  tokenAddress: `0x${string}`,
): Promise<string> {
  return (await publicClient.readContract({
    address: tokenAddress,
    abi: ABI,
    functionName: "name",
  })) as string;
}

export async function getTokenSymbol(
  tokenAddress: `0x${string}`,
): Promise<string> {
  return (await publicClient.readContract({
    address: tokenAddress,
    abi: ABI,
    functionName: "symbol",
  })) as string;
}

export async function isTokenTaxExempt(
  tokenAddress: `0x${string}`,
  account: `0x${string}`,
): Promise<boolean> {
  return (await publicClient.readContract({
    address: tokenAddress,
    abi: ABI,
    functionName: "taxExempt",
    args: [account],
  })) as boolean;
}

// ---------------------------------------------------------------------------
// TX builders
// ---------------------------------------------------------------------------

/**
 * Build calldata for approve(spender, amount).
 */
export function buildApproveTx(
  tokenAddress: `0x${string}`,
  spender: `0x${string}`,
  amount: bigint,
): { to: `0x${string}`; data: `0x${string}`; value: bigint } {
  const data = encodeFunctionData({
    abi: ABI,
    functionName: "approve",
    args: [spender, amount],
  });
  return { to: tokenAddress, data, value: 0n };
}

/**
 * Build calldata for transfer(to, amount).
 */
export function buildTransferTx(
  tokenAddress: `0x${string}`,
  to: `0x${string}`,
  amount: bigint,
): { to: `0x${string}`; data: `0x${string}`; value: bigint } {
  const data = encodeFunctionData({
    abi: ABI,
    functionName: "transfer",
    args: [to, amount],
  });
  return { to: tokenAddress, data, value: 0n };
}
