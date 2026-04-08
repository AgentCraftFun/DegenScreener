import { Decimal } from "decimal.js";

Decimal.set({ precision: 50, rounding: Decimal.ROUND_DOWN });

/**
 * V2 bonding curve price estimation functions.
 * These mirror the on-chain BondingCurve.sol math for client-side previews.
 *
 * The bonding curve uses a virtual AMM: x*y = k where
 *   x = virtualEth + realEthReserve
 *   y = virtualToken + realTokenReserve (tokens still in curve)
 *   k = x * y (set at initialization)
 *
 * Fees: 4% total (3% creator + 1% platform) = 400 bps
 */

const DEFAULT_FEE_BPS = 400; // 4% total

export interface CurveParams {
  virtualEth: string;
  virtualToken: string;
  realEthReserve: string;
  realTokenReserve: string;
}

/**
 * Estimate tokens received for a given ETH input (buy).
 */
export function estimateTokensForEth(
  params: CurveParams,
  ethIn: string,
  feeBps: number = DEFAULT_FEE_BPS,
): { tokensOut: string; fee: string; priceImpact: string; effectivePrice: string } {
  const vEth = new Decimal(params.virtualEth);
  const vToken = new Decimal(params.virtualToken);
  const rEth = new Decimal(params.realEthReserve);
  const rToken = new Decimal(params.realTokenReserve);
  const input = new Decimal(ethIn);

  if (input.lte(0)) return { tokensOut: "0", fee: "0", priceImpact: "0", effectivePrice: "0" };

  // Fee deducted upfront
  const fee = input.mul(feeBps).div(10000);
  const netIn = input.sub(fee);

  // Current total reserves
  const x = vEth.add(rEth);
  const y = vToken.add(rToken);
  const k = x.mul(y);

  // Price before
  const priceBefore = y.gt(0) ? x.div(y) : new Decimal(0);

  // After adding netIn to ETH side
  const xNew = x.add(netIn);
  const yNew = k.div(xNew);
  const tokensOut = y.sub(yNew);

  if (tokensOut.lte(0)) return { tokensOut: "0", fee: fee.toFixed(18), priceImpact: "100", effectivePrice: "0" };

  // Effective price = netIn / tokensOut (ETH per token)
  const effectivePrice = netIn.div(tokensOut);

  // Price impact
  const priceImpact = priceBefore.gt(0)
    ? effectivePrice.sub(priceBefore).div(priceBefore).mul(100).abs()
    : new Decimal(0);

  return {
    tokensOut: tokensOut.toFixed(18),
    fee: fee.toFixed(18),
    priceImpact: priceImpact.toFixed(2),
    effectivePrice: effectivePrice.toFixed(18),
  };
}

/**
 * Estimate ETH received for a given token input (sell).
 */
export function estimateEthForTokens(
  params: CurveParams,
  tokensIn: string,
  feeBps: number = DEFAULT_FEE_BPS,
): { ethOut: string; fee: string; priceImpact: string; effectivePrice: string } {
  const vEth = new Decimal(params.virtualEth);
  const vToken = new Decimal(params.virtualToken);
  const rEth = new Decimal(params.realEthReserve);
  const rToken = new Decimal(params.realTokenReserve);
  const input = new Decimal(tokensIn);

  if (input.lte(0)) return { ethOut: "0", fee: "0", priceImpact: "0", effectivePrice: "0" };

  const x = vEth.add(rEth);
  const y = vToken.add(rToken);
  const k = x.mul(y);

  const priceBefore = y.gt(0) ? x.div(y) : new Decimal(0);

  // Add tokens, compute ETH out
  const yNew = y.add(input);
  const xNew = k.div(yNew);
  const grossOut = x.sub(xNew);

  if (grossOut.lte(0)) return { ethOut: "0", fee: "0", priceImpact: "100", effectivePrice: "0" };

  // Fee on output
  const fee = grossOut.mul(feeBps).div(10000);
  const ethOut = grossOut.sub(fee);

  const effectivePrice = ethOut.div(input);
  const priceImpact = priceBefore.gt(0)
    ? priceBefore.sub(effectivePrice).div(priceBefore).mul(100).abs()
    : new Decimal(0);

  return {
    ethOut: ethOut.toFixed(18),
    fee: fee.toFixed(18),
    priceImpact: priceImpact.toFixed(2),
    effectivePrice: effectivePrice.toFixed(18),
  };
}

/**
 * Estimate slippage (price impact) for a given trade size.
 */
export function estimateSlippage(
  params: CurveParams,
  ethAmount: string,
  isBuy: boolean,
  feeBps: number = DEFAULT_FEE_BPS,
): string {
  if (isBuy) {
    return estimateTokensForEth(params, ethAmount, feeBps).priceImpact;
  }
  return estimateEthForTokens(params, ethAmount, feeBps).priceImpact;
}

/**
 * Estimate graduation progress as a percentage.
 */
export function estimateGraduationProgress(
  realEthReserve: string,
  graduationThreshold: string,
): { pct: string; remaining: string } {
  const reserve = new Decimal(realEthReserve);
  const threshold = new Decimal(graduationThreshold);
  if (threshold.lte(0)) return { pct: "0", remaining: threshold.toFixed(18) };

  const pct = reserve.div(threshold).mul(100);
  const remaining = Decimal.max(threshold.sub(reserve), new Decimal(0));

  return {
    pct: Decimal.min(pct, new Decimal(100)).toFixed(2),
    remaining: remaining.toFixed(18),
  };
}

/**
 * Get the current spot price from curve params (ETH per token).
 */
export function getCurveSpotPrice(params: CurveParams): string {
  const x = new Decimal(params.virtualEth).add(new Decimal(params.realEthReserve));
  const y = new Decimal(params.virtualToken).add(new Decimal(params.realTokenReserve));
  if (y.lte(0)) return "0";
  return x.div(y).toFixed(18);
}
