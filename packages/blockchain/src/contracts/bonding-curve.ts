import { encodeFunctionData, type Abi } from "viem";
import bondingCurveAbi from "../abi/BondingCurve.json" with { type: "json" };
import { publicClient } from "../provider.js";

const ABI = bondingCurveAbi as Abi;

function getAddress(): `0x${string}` {
  const addr = process.env.BONDING_CURVE_ADDRESS;
  if (!addr) throw new Error("BONDING_CURVE_ADDRESS not set");
  return addr as `0x${string}`;
}

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

export interface CurveState {
  virtualEth: bigint;
  virtualToken: bigint;
  realEthReserve: bigint;
  realTokenReserve: bigint;
  graduated: boolean;
  creator: string;
  k: bigint;
}

export async function getCurveState(
  tokenAddress: `0x${string}`,
): Promise<CurveState> {
  const result = (await publicClient.readContract({
    address: getAddress(),
    abi: ABI,
    functionName: "curves",
    args: [tokenAddress],
  })) as [bigint, bigint, bigint, bigint, boolean, `0x${string}`, bigint];

  return {
    virtualEth: result[0],
    virtualToken: result[1],
    realEthReserve: result[2],
    realTokenReserve: result[3],
    graduated: result[4],
    creator: result[5],
    k: result[6],
  };
}

export async function getPrice(tokenAddress: `0x${string}`): Promise<bigint> {
  return (await publicClient.readContract({
    address: getAddress(),
    abi: ABI,
    functionName: "getPrice",
    args: [tokenAddress],
  })) as bigint;
}

export async function getGraduationThreshold(): Promise<bigint> {
  return (await publicClient.readContract({
    address: getAddress(),
    abi: ABI,
    functionName: "graduationThreshold",
  })) as bigint;
}

// ---------------------------------------------------------------------------
// TX builders
// ---------------------------------------------------------------------------

/**
 * Build calldata for buy(token) — value is the ETH to spend.
 */
export function buildBuyTx(
  tokenAddress: `0x${string}`,
  ethAmount: bigint,
): { to: `0x${string}`; data: `0x${string}`; value: bigint } {
  const data = encodeFunctionData({
    abi: ABI,
    functionName: "buy",
    args: [tokenAddress],
  });
  return { to: getAddress(), data, value: ethAmount };
}

/**
 * Build calldata for sell(token, tokenAmount).
 */
export function buildSellTx(
  tokenAddress: `0x${string}`,
  tokenAmount: bigint,
): { to: `0x${string}`; data: `0x${string}`; value: bigint } {
  const data = encodeFunctionData({
    abi: ABI,
    functionName: "sell",
    args: [tokenAddress, tokenAmount],
  });
  return { to: getAddress(), data, value: 0n };
}
