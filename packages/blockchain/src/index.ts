export { publicClient, getWalletClient, CHAIN } from "./provider.js";
export {
  getBalance,
  sendTokens,
  watchTransfersTo,
  DSCREEN_ADDRESS,
} from "./contracts/dscreen.js";
export {
  encryptPrivateKey,
  decryptPrivateKey,
  generateEncryptionKey,
} from "./crypto.js";
export {
  initWalletManager,
  createAgentWallet,
  getAgentWallet,
  getAgentPrivateKey,
  getAgentEthBalance,
  refreshAllBalances,
  isAgentBroke,
} from "./wallet-manager.js";
export {
  NonceManager,
  signAndSend,
  estimateGasWithBuffer,
  estimateTxCost,
  resetNonce,
  resetAllNonces,
  type SignedTransaction,
  type SigningRequest,
} from "./signing-service.js";
export {
  submitTransaction,
  waitForConfirmation,
  submitAndConfirm,
  checkPendingConfirmations,
  type TxSubmission,
  type TxResult,
  type TxPipelineCallbacks,
} from "./tx-pipeline.js";
export {
  indexFactoryEvents,
  indexBondingCurveEvents,
  watchTokenCreations,
  watchTrades,
  watchGraduations,
  watchUniswapSwaps,
  startEventIndexer,
  type TokenCreatedEvent,
  type TradeEvent,
  type TokenGraduatedEvent,
  type CurveInitializedEvent,
  type UniswapSwapEvent,
  type IndexedEvent,
  type EventHandlers,
  type IndexerConfig,
} from "./event-indexer.js";

// V2 contract helpers
export {
  getAllTokensLength,
  getTokenAtIndex,
  getDeployFee,
  getTokenCreator,
  buildCreateTokenTx,
} from "./contracts/factory.js";
export {
  getCurveState,
  getPrice,
  getGraduationThreshold,
  buildBuyTx,
  buildSellTx,
  type CurveState,
} from "./contracts/bonding-curve.js";
export {
  getTokenBalance,
  getTokenAllowance,
  getTokenTotalSupply,
  getTokenName,
  getTokenSymbol,
  isTokenTaxExempt,
  buildApproveTx,
  buildTransferTx,
} from "./contracts/degen-token.js";
