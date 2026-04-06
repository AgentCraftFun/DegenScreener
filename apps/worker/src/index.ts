import { Redis } from "ioredis";
import { pool as dbPool, simulationQueries, runMigrations } from "@degenscreener/db";
import { runLoop } from "./loop.js";
import { seedRng } from "./util/rng.js";
import { circuitBreaker } from "./agents/scheduler.js";
import { initEventPublisher } from "./events.js";

interface CliArgs {
  fastForward: number;
  seed?: number;
  useAi: boolean;
  tickIntervalMs: number;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    fastForward: 0,
    useAi: process.env.USE_AI === "true",
    tickIntervalMs: Number(process.env.TICK_INTERVAL_MS ?? 15000),
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--fast-forward") {
      args.fastForward = Number(argv[++i]);
    } else if (a === "--seed") {
      args.seed = Number(argv[++i]);
    } else if (a === "--use-ai") {
      args.useAi = true;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.seed !== undefined) seedRng(args.seed);
  if (args.fastForward > 0) circuitBreaker.enabled = false;

  const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
  const redis = new Redis(REDIS_URL, { lazyConnect: true });
  try {
    await redis.connect();
    initEventPublisher(redis);
  } catch (e) {
    console.warn("[worker] redis connect failed, continuing without pubsub:", e);
  }

  // Auto-run migrations on startup
  console.log("[worker] running database migrations...");
  try {
    await runMigrations();
    console.log("[worker] migrations complete");
  } catch (e) {
    console.error("[worker] migration error:", e);
    // Continue anyway — tables may already exist
  }

  console.log(
    `[worker] starting — fastForward=${args.fastForward}, seed=${args.seed ?? "none"}, useAi=${args.useAi}, tickIntervalMs=${args.tickIntervalMs}`,
  );

  const start = Date.now();
  const result = await runLoop({
    tickIntervalMs: args.tickIntervalMs,
    fastForwardTicks: args.fastForward,
    useAi: args.useAi,
    redis: redis.status === "ready" ? redis : undefined,
  });
  const dur = Date.now() - start;

  console.log(
    `[worker] done in ${dur}ms — finalTick=${result.finalTick}, totals=${JSON.stringify(result.totalStats)}`,
  );

  // Balance summary
  const state = await simulationQueries.getSimulationState();
  console.log(`[worker] sim tick in db: ${state?.currentTick}`);

  await redis.quit().catch(() => {});
  await dbPool.end();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
