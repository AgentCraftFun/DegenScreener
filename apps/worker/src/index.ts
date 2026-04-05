import { simulationQueries, pool } from "@degenscreener/db";
import { DEFAULT_TICK_INTERVAL_MS } from "@degenscreener/shared";
import { Redis } from "ioredis";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
const TICK_MS = Number(process.env.TICK_INTERVAL_MS ?? 5000);

async function main() {
  const redis = new Redis(REDIS_URL);
  console.log(
    `[worker] starting — redis=${REDIS_URL}, interval=${TICK_MS}ms (default ${DEFAULT_TICK_INTERVAL_MS}ms)`,
  );

  const state = await simulationQueries.ensureSimulationState();
  let tick = BigInt(state.currentTick as unknown as string | number | bigint);

  const interval = setInterval(async () => {
    try {
      tick += 1n;
      await simulationQueries.updateSimulationState(tick);
      console.log(`[worker] Tick ${tick}`);
      await redis.publish("global", JSON.stringify({ type: "tick", tick: tick.toString() }));
    } catch (e) {
      console.error("[worker] tick error:", e);
    }
  }, TICK_MS);

  const shutdown = async (sig: string) => {
    console.log(`[worker] ${sig} received, shutting down`);
    clearInterval(interval);
    await redis.quit();
    await pool.end();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
