import { simulationQueries } from "@degenscreener/db";
import { DEFAULT_TICK_INTERVAL_MS } from "@degenscreener/shared";
import { runTick, type TickStats } from "./tick.js";
import type { Redis } from "ioredis";

export interface LoopOptions {
  tickIntervalMs: number;
  fastForwardTicks?: number;
  useAi?: boolean;
  redis?: Redis;
  onTick?: (stats: TickStats) => void;
}

export async function runLoop(opts: LoopOptions): Promise<{
  finalTick: bigint;
  totalStats: TickStats;
}> {
  const state = await simulationQueries.ensureSimulationState();
  let tick = BigInt(state.currentTick as unknown as bigint | string | number);

  const totals: TickStats = {
    trades: 0,
    launches: 0,
    rugs: 0,
    tweets: 0,
    broke: 0,
    txSubmitted: 0,
    txConfirmed: 0,
  };

  const fastForward = opts.fastForwardTicks ?? 0;
  const runForever = fastForward === 0;
  const target = fastForward > 0 ? tick + BigInt(fastForward) : -1n;

  // Fast-forward uses simulation mode (no on-chain txs — V1 server-side execution)
  const simulationMode = fastForward > 0;
  if (simulationMode) {
    console.log(`[loop] Fast-forward mode: ${fastForward} ticks (simulation only, no on-chain txs)`);
  }

  let stop = false;
  const shutdown = () => {
    stop = true;
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  while (!stop) {
    if (!runForever && tick >= target) break;
    tick += 1n;
    const tickNum = Number(tick);
    try {
      const stats = await runTick(tickNum, {
        useAi: opts.useAi ?? false,
        redis: opts.redis,
        simulationMode,
      });
      totals.trades += stats.trades;
      totals.launches += stats.launches;
      totals.rugs += stats.rugs;
      totals.tweets += stats.tweets;
      totals.broke += stats.broke;
      totals.txSubmitted += stats.txSubmitted;
      totals.txConfirmed += stats.txConfirmed;
      opts.onTick?.(stats);
    } catch (e) {
      console.error(`[loop] tick ${tick} error:`, e);
    }
    await simulationQueries.updateSimulationState(tick);

    if (runForever) {
      await sleep(opts.tickIntervalMs);
    }
  }

  return { finalTick: tick, totalStats: totals };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export { DEFAULT_TICK_INTERVAL_MS };
