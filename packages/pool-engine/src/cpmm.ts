import { Decimal } from "decimal.js";
import type { PoolState } from "./types.js";

// Configure Decimal for high precision arithmetic
Decimal.set({ precision: 50, rounding: Decimal.ROUND_DOWN });

export function createPool(
  dscreenLiquidity: Decimal | string | number,
  tokenSupply: Decimal | string | number,
): PoolState {
  const x = new Decimal(dscreenLiquidity);
  const y = new Decimal(tokenSupply);
  if (x.lte(0) || y.lte(0)) {
    throw new Error("pool reserves must be positive");
  }
  return {
    dscreenReserve: x,
    tokenReserve: y,
    kConstant: x.mul(y),
  };
}

export function getPrice(pool: PoolState): Decimal {
  if (pool.tokenReserve.lte(0)) return new Decimal(0);
  return pool.dscreenReserve.div(pool.tokenReserve);
}

export function getMarketCap(
  pool: PoolState,
  totalSupply: Decimal | string | number,
): Decimal {
  return getPrice(pool).mul(new Decimal(totalSupply));
}
