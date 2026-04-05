import { userQueries, agentQueries, pool } from "./index.js";
import { AgentType, Personality } from "@degenscreener/shared";

async function main() {
  const u = await userQueries.createUser(
    "0xTEST" + Math.random().toString(16).slice(2, 10),
  );
  console.log("created user:", u.id, u.walletAddress);
  const got = await userQueries.getUserByWallet(u.walletAddress);
  if (!got || got.id !== u.id) throw new Error("user lookup failed");

  const a = await agentQueries.createAgent({
    ownerId: u.id,
    name: "TestBot",
    handle: "testbot_" + Math.random().toString(16).slice(2, 8),
    type: AgentType.DEGEN,
    riskProfile: { profile: "MODERATE" },
    personality: Personality.ANALYTICAL,
    balance: "100",
  });
  console.log("created agent:", a.id, a.handle);
  const got2 = await agentQueries.getAgentById(a.id);
  if (!got2 || got2.id !== a.id) throw new Error("agent lookup failed");

  console.log("OK");
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
