#!/usr/bin/env node
// End-to-end smoke test: auth, deposit, deploy agent, run simulation, verify flow.
import { ethers } from "ethers";
import { SiweMessage } from "siwe";

const BASE = process.env.API_BASE ?? "http://localhost:3003";

function assert(cond, msg) {
  if (!cond) throw new Error("ASSERT: " + msg);
}

async function request(method, path, opts = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "content-type": "application/json",
      ...(opts.cookie ? { cookie: opts.cookie } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, body: json, headers: res.headers };
}

async function main() {
  console.log(">>> SMOKE TEST START");

  // 1-4. Auth
  const wallet = ethers.Wallet.createRandom();
  console.log("wallet:", wallet.address);
  const { body: nonceRes } = await request("POST", "/api/auth/nonce");
  const msg = new SiweMessage({
    domain: "localhost:3003",
    address: wallet.address,
    uri: BASE,
    version: "1",
    chainId: 8453,
    nonce: nonceRes.nonce,
  });
  const message = msg.prepareMessage();
  const signature = await wallet.signMessage(message);
  const verify = await request("POST", "/api/auth/verify", {
    body: { message, signature },
  });
  assert(verify.status === 200, "verify ok");
  const cookie = verify.headers.get("set-cookie").split(";")[0];
  console.log("✓ auth ok");

  // 5. Deposit
  const dep = await request("POST", "/api/user/deposit", {
    cookie,
    body: { amount: "200", txHash: "0x" + "1".repeat(64) },
  });
  assert(dep.status === 200, "deposit ok");
  console.log("✓ deposit ok");

  // 5b. Verify balance
  const prof = await request("GET", "/api/user/profile", { cookie });
  assert(Number(prof.body.user.internalBalance) === 190, "balance 190 after 5% fee");
  console.log("✓ balance correct:", prof.body.user.internalBalance);

  // 6. Deploy Degen
  const deploy = await request("POST", "/api/agents", {
    cookie,
    body: {
      name: "SmokeDegen",
      handle: "smoke_" + Math.random().toString(16).slice(2, 8),
      type: "DEGEN",
      personality: "HYPE_BEAST",
      initialFunding: "50",
      riskProfile: { profile: "FULL_DEGEN", maxPositions: 5 },
    },
  });
  assert(deploy.status === 201, "deploy ok: " + JSON.stringify(deploy.body));
  const agentId = deploy.body.agent.id;
  console.log("✓ agent deployed:", agentId);

  // 7-8. Wait for simulation (run ourselves via worker CLI)
  console.log("  waiting for simulation... run worker --fast-forward 50 in another terminal if no sim running");
  await new Promise((r) => setTimeout(r, 1000));

  // Query agent
  const agentRes = await request("GET", `/api/agents/${agentId}`);
  assert(agentRes.status === 200, "agent fetched");
  console.log("✓ agent data fetched");

  // 9. Query tokens
  const tokensRes = await request("GET", "/api/tokens?filter=all&limit=10");
  assert(tokensRes.status === 200, "tokens ok");
  assert(tokensRes.body.tokens.length > 0, "tokens exist");
  console.log("✓ tokens:", tokensRes.body.tokens.length);

  // 10. Chart data
  const tokenId = tokensRes.body.tokens[0].id;
  const chart = await request("GET", `/api/tokens/${tokenId}/chart?timeframe=1m`);
  assert(chart.status === 200, "chart ok");
  console.log("✓ chart candles:", chart.body.candles.length);

  // 11. Tweets
  const tweets = await request("GET", "/api/tweets?limit=5");
  assert(tweets.status === 200, "tweets ok");
  console.log("✓ tweets:", tweets.body.tweets.length);

  // 12. Leaderboard
  const lb = await request("GET", "/api/leaderboard/degens?timeframe=all");
  assert(lb.status === 200, "leaderboard ok");
  assert(lb.body.leaderboard.length > 0, "leaderboard populated");
  console.log("✓ leaderboard:", lb.body.leaderboard.length, "agents");

  // 13. Withdraw from agent
  const wd = await request("POST", `/api/agents/${agentId}/withdraw`, {
    cookie,
    body: { amount: "25" },
  });
  assert(wd.status === 200, "agent withdraw ok: " + JSON.stringify(wd.body));
  console.log("✓ agent withdraw ok");

  // 14. Balance check
  const prof2 = await request("GET", "/api/user/profile", { cookie });
  assert(Number(prof2.body.user.internalBalance) === 165, "balance 165 (190-50+25)");
  console.log("✓ balance after withdraw:", prof2.body.user.internalBalance);

  // 15. Platform stats
  const stats = await request("GET", "/api/platform/stats");
  assert(stats.status === 200, "stats ok");
  console.log("✓ platform stats:", JSON.stringify(stats.body));

  console.log("\n>>> SMOKE TEST PASSED");
}

main().catch((e) => {
  console.error("SMOKE TEST FAILED:", e.message);
  process.exit(1);
});
