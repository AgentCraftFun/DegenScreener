import { parseAbiItem, type Log, formatEther } from "viem";
import { publicClient } from "./provider.js";

// ---------------------------------------------------------------------------
// ABI event definitions
// ---------------------------------------------------------------------------

const TOKEN_CREATED_EVENT = parseAbiItem(
  "event TokenCreated(address indexed token, address indexed creator, string name, string symbol, uint256 totalSupply, uint256 timestamp)",
);

const TRADE_EVENT = parseAbiItem(
  "event Trade(address indexed token, address indexed trader, bool isBuy, uint256 ethAmount, uint256 tokenAmount, uint256 price)",
);

const TOKEN_GRADUATED_EVENT = parseAbiItem(
  "event TokenGraduated(address indexed token, uint256 ethLiquidity, uint256 tokenLiquidity, address uniswapPair)",
);

const CURVE_INITIALIZED_EVENT = parseAbiItem(
  "event CurveInitialized(address indexed token, address indexed creator, uint256 virtualEth, uint256 virtualToken)",
);

// Uniswap V2 Pair Swap event
const UNISWAP_SWAP_EVENT = parseAbiItem(
  "event Swap(address indexed sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, address indexed to)",
);

// ---------------------------------------------------------------------------
// Parsed event types
// ---------------------------------------------------------------------------

export interface TokenCreatedEvent {
  type: "TokenCreated";
  token: string;
  creator: string;
  name: string;
  symbol: string;
  totalSupply: bigint;
  timestamp: bigint;
  blockNumber: bigint;
  txHash: string;
}

export interface TradeEvent {
  type: "Trade";
  token: string;
  trader: string;
  isBuy: boolean;
  ethAmount: bigint;
  tokenAmount: bigint;
  price: bigint;
  blockNumber: bigint;
  txHash: string;
}

export interface TokenGraduatedEvent {
  type: "TokenGraduated";
  token: string;
  ethLiquidity: bigint;
  tokenLiquidity: bigint;
  uniswapPair: string;
  blockNumber: bigint;
  txHash: string;
}

export interface CurveInitializedEvent {
  type: "CurveInitialized";
  token: string;
  creator: string;
  virtualEth: bigint;
  virtualToken: bigint;
  blockNumber: bigint;
  txHash: string;
}

export interface UniswapSwapEvent {
  type: "UniswapSwap";
  pair: string;
  sender: string;
  amount0In: bigint;
  amount1In: bigint;
  amount0Out: bigint;
  amount1Out: bigint;
  to: string;
  blockNumber: bigint;
  txHash: string;
}

export type IndexedEvent =
  | TokenCreatedEvent
  | TradeEvent
  | TokenGraduatedEvent
  | CurveInitializedEvent
  | UniswapSwapEvent;

// ---------------------------------------------------------------------------
// Event handler callback
// ---------------------------------------------------------------------------

export interface EventHandlers {
  onTokenCreated?: (event: TokenCreatedEvent) => Promise<void>;
  onTrade?: (event: TradeEvent) => Promise<void>;
  onTokenGraduated?: (event: TokenGraduatedEvent) => Promise<void>;
  onCurveInitialized?: (event: CurveInitializedEvent) => Promise<void>;
  onUniswapSwap?: (event: UniswapSwapEvent) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Historical indexer — scan past blocks
// ---------------------------------------------------------------------------

const DEFAULT_BLOCK_RANGE = 2000n;

/**
 * Scan historical blocks for Factory events (TokenCreated).
 */
export async function indexFactoryEvents(
  factoryAddress: `0x${string}`,
  fromBlock: bigint,
  toBlock?: bigint,
  handlers?: EventHandlers,
): Promise<TokenCreatedEvent[]> {
  const endBlock = toBlock ?? (await publicClient.getBlockNumber());
  const events: TokenCreatedEvent[] = [];

  for (let start = fromBlock; start <= endBlock; start += DEFAULT_BLOCK_RANGE) {
    const end =
      start + DEFAULT_BLOCK_RANGE - 1n > endBlock
        ? endBlock
        : start + DEFAULT_BLOCK_RANGE - 1n;

    const logs = await publicClient.getLogs({
      address: factoryAddress,
      event: TOKEN_CREATED_EVENT,
      fromBlock: start,
      toBlock: end,
    });

    for (const log of logs) {
      const parsed: TokenCreatedEvent = {
        type: "TokenCreated",
        token: log.args.token!,
        creator: log.args.creator!,
        name: log.args.name!,
        symbol: log.args.symbol!,
        totalSupply: log.args.totalSupply!,
        timestamp: log.args.timestamp!,
        blockNumber: log.blockNumber!,
        txHash: log.transactionHash!,
      };
      events.push(parsed);
      if (handlers?.onTokenCreated) await handlers.onTokenCreated(parsed);
    }
  }

  return events;
}

/**
 * Scan historical blocks for BondingCurve events (Trade, Graduated, Initialized).
 */
export async function indexBondingCurveEvents(
  bondingCurveAddress: `0x${string}`,
  fromBlock: bigint,
  toBlock?: bigint,
  handlers?: EventHandlers,
): Promise<IndexedEvent[]> {
  const endBlock = toBlock ?? (await publicClient.getBlockNumber());
  const events: IndexedEvent[] = [];

  for (let start = fromBlock; start <= endBlock; start += DEFAULT_BLOCK_RANGE) {
    const end =
      start + DEFAULT_BLOCK_RANGE - 1n > endBlock
        ? endBlock
        : start + DEFAULT_BLOCK_RANGE - 1n;

    // Fetch all three event types in parallel
    const [tradeLogs, gradLogs, initLogs] = await Promise.all([
      publicClient.getLogs({
        address: bondingCurveAddress,
        event: TRADE_EVENT,
        fromBlock: start,
        toBlock: end,
      }),
      publicClient.getLogs({
        address: bondingCurveAddress,
        event: TOKEN_GRADUATED_EVENT,
        fromBlock: start,
        toBlock: end,
      }),
      publicClient.getLogs({
        address: bondingCurveAddress,
        event: CURVE_INITIALIZED_EVENT,
        fromBlock: start,
        toBlock: end,
      }),
    ]);

    for (const log of tradeLogs) {
      const parsed: TradeEvent = {
        type: "Trade",
        token: log.args.token!,
        trader: log.args.trader!,
        isBuy: log.args.isBuy!,
        ethAmount: log.args.ethAmount!,
        tokenAmount: log.args.tokenAmount!,
        price: log.args.price!,
        blockNumber: log.blockNumber!,
        txHash: log.transactionHash!,
      };
      events.push(parsed);
      if (handlers?.onTrade) await handlers.onTrade(parsed);
    }

    for (const log of gradLogs) {
      const parsed: TokenGraduatedEvent = {
        type: "TokenGraduated",
        token: log.args.token!,
        ethLiquidity: log.args.ethLiquidity!,
        tokenLiquidity: log.args.tokenLiquidity!,
        uniswapPair: log.args.uniswapPair!,
        blockNumber: log.blockNumber!,
        txHash: log.transactionHash!,
      };
      events.push(parsed);
      if (handlers?.onTokenGraduated) await handlers.onTokenGraduated(parsed);
    }

    for (const log of initLogs) {
      const parsed: CurveInitializedEvent = {
        type: "CurveInitialized",
        token: log.args.token!,
        creator: log.args.creator!,
        virtualEth: log.args.virtualEth!,
        virtualToken: log.args.virtualToken!,
        blockNumber: log.blockNumber!,
        txHash: log.transactionHash!,
      };
      events.push(parsed);
      if (handlers?.onCurveInitialized) await handlers.onCurveInitialized(parsed);
    }
  }

  return events;
}

// ---------------------------------------------------------------------------
// Live watchers — subscribe to real-time events
// ---------------------------------------------------------------------------

type UnwatchFn = () => void;

/**
 * Watch Factory for new token creations in real-time.
 */
export function watchTokenCreations(
  factoryAddress: `0x${string}`,
  handler: (event: TokenCreatedEvent) => void,
): UnwatchFn {
  return publicClient.watchEvent({
    address: factoryAddress,
    event: TOKEN_CREATED_EVENT,
    onLogs: (logs) => {
      for (const log of logs) {
        handler({
          type: "TokenCreated",
          token: log.args.token!,
          creator: log.args.creator!,
          name: log.args.name!,
          symbol: log.args.symbol!,
          totalSupply: log.args.totalSupply!,
          timestamp: log.args.timestamp!,
          blockNumber: log.blockNumber!,
          txHash: log.transactionHash!,
        });
      }
    },
  });
}

/**
 * Watch BondingCurve for trades in real-time.
 */
export function watchTrades(
  bondingCurveAddress: `0x${string}`,
  handler: (event: TradeEvent) => void,
): UnwatchFn {
  return publicClient.watchEvent({
    address: bondingCurveAddress,
    event: TRADE_EVENT,
    onLogs: (logs) => {
      for (const log of logs) {
        handler({
          type: "Trade",
          token: log.args.token!,
          trader: log.args.trader!,
          isBuy: log.args.isBuy!,
          ethAmount: log.args.ethAmount!,
          tokenAmount: log.args.tokenAmount!,
          price: log.args.price!,
          blockNumber: log.blockNumber!,
          txHash: log.transactionHash!,
        });
      }
    },
  });
}

/**
 * Watch BondingCurve for graduation events in real-time.
 */
export function watchGraduations(
  bondingCurveAddress: `0x${string}`,
  handler: (event: TokenGraduatedEvent) => void,
): UnwatchFn {
  return publicClient.watchEvent({
    address: bondingCurveAddress,
    event: TOKEN_GRADUATED_EVENT,
    onLogs: (logs) => {
      for (const log of logs) {
        handler({
          type: "TokenGraduated",
          token: log.args.token!,
          ethLiquidity: log.args.ethLiquidity!,
          tokenLiquidity: log.args.tokenLiquidity!,
          uniswapPair: log.args.uniswapPair!,
          blockNumber: log.blockNumber!,
          txHash: log.transactionHash!,
        });
      }
    },
  });
}

/**
 * Watch a Uniswap V2 pair for swaps in real-time.
 */
export function watchUniswapSwaps(
  pairAddress: `0x${string}`,
  handler: (event: UniswapSwapEvent) => void,
): UnwatchFn {
  return publicClient.watchEvent({
    address: pairAddress,
    event: UNISWAP_SWAP_EVENT,
    onLogs: (logs) => {
      for (const log of logs) {
        handler({
          type: "UniswapSwap",
          pair: pairAddress,
          sender: log.args.sender!,
          amount0In: log.args.amount0In!,
          amount1In: log.args.amount1In!,
          amount0Out: log.args.amount0Out!,
          amount1Out: log.args.amount1Out!,
          to: log.args.to!,
          blockNumber: log.blockNumber!,
          txHash: log.transactionHash!,
        });
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Composite watcher — start all watchers at once
// ---------------------------------------------------------------------------

export interface IndexerConfig {
  factoryAddress: `0x${string}`;
  bondingCurveAddress: `0x${string}`;
  uniswapPairs?: `0x${string}`[];
}

/**
 * Start all event watchers and return a stop function.
 */
export function startEventIndexer(
  config: IndexerConfig,
  handlers: EventHandlers,
): { stop: () => void } {
  const unwatchers: UnwatchFn[] = [];

  if (handlers.onTokenCreated) {
    unwatchers.push(
      watchTokenCreations(config.factoryAddress, (e) => {
        handlers.onTokenCreated!(e).catch(() => {});
      }),
    );
  }

  if (handlers.onTrade) {
    unwatchers.push(
      watchTrades(config.bondingCurveAddress, (e) => {
        handlers.onTrade!(e).catch(() => {});
      }),
    );
  }

  if (handlers.onTokenGraduated) {
    unwatchers.push(
      watchGraduations(config.bondingCurveAddress, (e) => {
        handlers.onTokenGraduated!(e).catch(() => {});
      }),
    );
  }

  if (handlers.onUniswapSwap && config.uniswapPairs) {
    for (const pair of config.uniswapPairs) {
      unwatchers.push(
        watchUniswapSwaps(pair, (e) => {
          handlers.onUniswapSwap!(e).catch(() => {});
        }),
      );
    }
  }

  return {
    stop: () => {
      for (const unwatch of unwatchers) {
        unwatch();
      }
    },
  };
}
