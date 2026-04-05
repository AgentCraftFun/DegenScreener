import { Decimal } from "decimal.js";
import type { PoolState, BuyResult, SellResult } from "./types.js";
import { getPrice } from "./cpmm.js";

const DEFAULT_FEE = new Decimal("0.05");

function assertPositive(amount: Decimal, name: string) {
  if (amount.lte(0)) {
    throw new Error(`${name} must be > 0`);
  }
}

export function executeBuy(
  pool: PoolState,
  dscreenIn: Decimal | string | number,
  feeRate: Decimal | string | number = DEFAULT_FEE,
): BuyResult {
  const amountIn = new Decimal(dscreenIn);
  const fr = new Decimal(feeRate);
  assertPositive(amountIn, "dscreenIn");
  if (fr.lt(0) || fr.gte(1)) throw new Error("feeRate out of range");

  const priceBefore = getPrice(pool);
  const fee = amountIn.mul(fr);
  const netIn = amountIn.sub(fee);

  const xNew = pool.dscreenReserve.add(netIn);
  const yNew = pool.kConstant.div(xNew);
  const tokensOut = pool.tokenReserve.sub(yNew);

  if (tokensOut.lte(0) || yNew.lte(0)) {
    throw new Error("trade exceeds pool capacity");
  }

  const newPool: PoolState = {
    dscreenReserve: xNew,
    tokenReserve: yNew,
    kConstant: pool.kConstant,
  };
  const priceAfter = getPrice(newPool);
  // Price impact = slippage: effective_price vs mid_price
  // effective = netIn / tokensOut
  const effectivePrice = netIn.div(tokensOut);
  const priceImpact = priceBefore.gt(0)
    ? effectivePrice.sub(priceBefore).div(priceBefore).abs()
    : new Decimal(0);

  return { tokensOut, fee, newPool, priceAfter, priceImpact };
}

export function executeSell(
  pool: PoolState,
  tokensIn: Decimal | string | number,
  feeRate: Decimal | string | number = DEFAULT_FEE,
): SellResult {
  const amountIn = new Decimal(tokensIn);
  const fr = new Decimal(feeRate);
  assertPositive(amountIn, "tokensIn");
  if (fr.lt(0) || fr.gte(1)) throw new Error("feeRate out of range");

  const priceBefore = getPrice(pool);

  const yNew = pool.tokenReserve.add(amountIn);
  const xNew = pool.kConstant.div(yNew);
  const grossOut = pool.dscreenReserve.sub(xNew);

  if (grossOut.lte(0) || xNew.lte(0)) {
    throw new Error("trade exceeds pool capacity");
  }

  const fee = grossOut.mul(fr);
  const dscreenOut = grossOut.sub(fee);

  const newPool: PoolState = {
    dscreenReserve: xNew,
    tokenReserve: yNew,
    kConstant: pool.kConstant,
  };
  const priceAfter = getPrice(newPool);
  // Slippage: effective_price vs mid_price
  const effectivePrice = dscreenOut.div(amountIn);
  const priceImpact = priceBefore.gt(0)
    ? effectivePrice.sub(priceBefore).div(priceBefore).abs()
    : new Decimal(0);

  return { dscreenOut, fee, newPool, priceAfter, priceImpact };
}
