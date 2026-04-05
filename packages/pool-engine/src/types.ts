import { Decimal } from "decimal.js";

export interface PoolState {
  dscreenReserve: Decimal;
  tokenReserve: Decimal;
  kConstant: Decimal;
}

export interface BuyResult {
  tokensOut: Decimal;
  fee: Decimal;
  newPool: PoolState;
  priceAfter: Decimal;
  priceImpact: Decimal;
}

export interface SellResult {
  dscreenOut: Decimal;
  fee: Decimal;
  newPool: PoolState;
  priceAfter: Decimal;
  priceImpact: Decimal;
}

export interface RugResult {
  dscreenRecovered: Decimal;
  residualPool: PoolState;
}
