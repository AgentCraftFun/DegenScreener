import { Decimal } from "decimal.js";
import type { PoolState, RugResult } from "./types.js";

export function removeLiquidity(pool: PoolState): RugResult {
  const dscreenRecovered = pool.dscreenReserve;
  const residualPool: PoolState = {
    dscreenReserve: new Decimal(0),
    tokenReserve: pool.tokenReserve,
    kConstant: new Decimal(0),
  };
  return { dscreenRecovered, residualPool };
}
