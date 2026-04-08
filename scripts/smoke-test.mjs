#!/usr/bin/env node
// V2 End-to-end smoke test: health, auth, deploy agent, trades, tweets,
// candles, websockets, notifications, leaderboard, graduation.
import { ethers } from "ethers";
import { SiweMessage } from "siwe";

const BASE = process.env.API_BASE ?? "http://localhost:3003";
let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    failed++;
    console.error("  ✗ FAIL:", msg);
  } else {
    passed++;
    console.log("  ✓", msg);
  }
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
  console.log(">>> V2 SMOKE TEST START\n");

  // -----------------------------------------------------------------------
  // 1. Health check
  // -----------------------------------------------------------------------
  console.log("[1] Health Check");
  const health = await request("GET", "/api/health");
  assert(health.status === 200, "health endpoint returns 200");
  assert(health.body.status === "healthy", "status is healthy");
  assert(health.body.checks?.database === "ok", "database check ok");
  assert(typeof health.body.stats?.agents === "number", "stats.agents present");
  assert(typeof health.body.stats?.tokens === "number", "stats.tokens present");

  // -----------------------------------------------------------------------
  // 2. Auth flow (SIWE)
  // -----------------------------------------------------------------------
  console.log("\n[2] Authentication");
  const wallet = ethers.Wallet.createRandom();
  const { body: nonceRes } = await request("POST", "/api/auth/nonce");
  assert(nonceRes.nonce, "nonce received");

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
  assert(verify.status === 200, "SIWE verify ok");
  const setCookie = verify.headers.get("set-cookie");
  assert(setCookie, "session cookie set");
  const cookie = setCookie.split(";")[0];

  // -----------------------------------------------------------------------
  // 3. User profile
  // -----------------------------------------------------------------------
  console.log("\n[3] User Profile");
  const prof = await request("GET", "/api/user/profile", { cookie });
  assert(prof.status === 200, "profile fetched");
  assert(prof.body.user?.walletAddress?.toLowerCase() === wallet.address.toLowerCase(), "wallet matches");

  // -----------------------------------------------------------------------
  // 4. Deposit
  // -----------------------------------------------------------------------
  console.log("\n[4] Deposit");
  const dep = await request("POST", "/api/user/deposit", {
    cookie,
    body: { amount: "200", txHash: "0x" + "a".repeat(64) },
  });
  assert(dep.status === 200, "deposit accepted");

  const prof2 = await request("GET", "/api/user/profile", { cookie });
  assert(Number(prof2.body.user?.internalBalance) > 0, "balance updated after deposit");

  // -----------------------------------------------------------------------
  // 5. Deploy Agent (V2: no initialFunding required)
  // -----------------------------------------------------------------------
  console.log("\n[5] Agent Deployment (V2)");
  const handle = "smoke_" + Math.random().toString(16).slice(2, 8);
  const deploy = await request("POST", "/api/agents", {
    cookie,
    body: {
      name: "SmokeTestAgent",
      handle,
      type: "DEGEN",
      personality: "HYPE_BEAST",
      riskProfile: { profile: "MODERATE", maxPositions: 5 },
    },
  });
  assert(deploy.status === 201, "agent created (201)");
  const agentId = deploy.body.agent?.id;
  assert(agentId, "agent ID returned");
  assert(deploy.body.agent?.status === "ACTIVE", "agent status is ACTIVE");
  assert(deploy.body.agent?.ethBalance !== undefined, "ethBalance field present");

  // V2: Deploy a DEV agent too
  const devHandle = "smokedev_" + Math.random().toString(16).slice(2, 8);
  const deployDev = await request("POST", "/api/agents", {
    cookie,
    body: {
      name: "SmokeDevAgent",
      handle: devHandle,
      type: "DEV",
      personality: "ANALYTICAL",
      riskProfile: { launchStyle: "MILD", launchFrequency: "SLOW" },
    },
  });
  assert(deployDev.status === 201, "DEV agent created");

  // -----------------------------------------------------------------------
  // 6. Agent Detail
  // -----------------------------------------------------------------------
  console.log("\n[6] Agent Detail");
  if (agentId) {
    const agentRes = await request("GET", `/api/agents/${agentId}`);
    assert(agentRes.status === 200, "agent detail fetched");
    assert(agentRes.body.agent?.name === "SmokeTestAgent", "agent name correct");
    assert(Array.isArray(agentRes.body.trades), "trades array present");
    assert(Array.isArray(agentRes.body.tweets), "tweets array present");
    assert(Array.isArray(agentRes.body.holdings), "holdings array present");
  }

  // -----------------------------------------------------------------------
  // 7. Agent Config Update (owner only)
  // -----------------------------------------------------------------------
  console.log("\n[7] Agent Config Update");
  if (agentId) {
    const cfgUpdate = await request("PATCH", `/api/agents/${agentId}/config`, {
      cookie,
      body: { name: "UpdatedSmoke", personality: "DOOMER" },
    });
    assert(cfgUpdate.status === 200, "config update accepted");

    const agentRes2 = await request("GET", `/api/agents/${agentId}`);
    assert(agentRes2.body.agent?.name === "UpdatedSmoke", "name updated");
    assert(agentRes2.body.agent?.personality === "DOOMER", "personality updated");
  }

  // -----------------------------------------------------------------------
  // 8. Token List
  // -----------------------------------------------------------------------
  console.log("\n[8] Token List");
  const tokensRes = await request("GET", "/api/tokens?filter=all&limit=10");
  assert(tokensRes.status === 200, "tokens endpoint ok");
  assert(Array.isArray(tokensRes.body.tokens), "tokens is array");

  // -----------------------------------------------------------------------
  // 9. Chart data (if tokens exist)
  // -----------------------------------------------------------------------
  console.log("\n[9] Chart Data");
  if (tokensRes.body.tokens?.length > 0) {
    const tokenId = tokensRes.body.tokens[0].id;
    const chart = await request("GET", `/api/tokens/${tokenId}/chart?timeframe=1m`);
    assert(chart.status === 200, "chart endpoint ok");
    assert(Array.isArray(chart.body.candles), "candles is array");
    console.log(`  candles: ${chart.body.candles.length}`);
  } else {
    console.log("  (skipped — no tokens yet)");
  }

  // -----------------------------------------------------------------------
  // 10. Tweets
  // -----------------------------------------------------------------------
  console.log("\n[10] Tweets");
  const tweets = await request("GET", "/api/tweets?limit=10");
  assert(tweets.status === 200, "tweets endpoint ok");
  assert(Array.isArray(tweets.body.tweets), "tweets is array");

  // -----------------------------------------------------------------------
  // 11. Leaderboards
  // -----------------------------------------------------------------------
  console.log("\n[11] Leaderboards");
  const degenLb = await request("GET", "/api/leaderboard/degens?timeframe=all");
  assert(degenLb.status === 200, "degen leaderboard ok");
  assert(Array.isArray(degenLb.body.leaderboard), "degen leaderboard is array");

  const devLb = await request("GET", "/api/leaderboard/devs");
  assert(devLb.status === 200, "dev leaderboard ok");
  assert(Array.isArray(devLb.body.leaderboard), "dev leaderboard is array");
  // V2: dev leaderboard should have graduations, not rugCount
  if (devLb.body.leaderboard.length > 0) {
    const first = devLb.body.leaderboard[0];
    assert(first.graduations !== undefined || first.rugCount === undefined, "V2: graduations field present or rugCount absent");
  }

  // -----------------------------------------------------------------------
  // 12. Platform Stats
  // -----------------------------------------------------------------------
  console.log("\n[12] Platform Stats");
  const stats = await request("GET", "/api/platform/stats");
  assert(stats.status === 200, "stats endpoint ok");
  assert(stats.body.totalVolume !== undefined, "totalVolume present");
  assert(stats.body.totalAgents !== undefined, "totalAgents present");
  assert(stats.body.totalTokensLaunched !== undefined, "totalTokensLaunched present");
  assert(stats.body.totalTokensGraduated !== undefined, "V2: totalTokensGraduated present");

  // -----------------------------------------------------------------------
  // 13. Notifications
  // -----------------------------------------------------------------------
  console.log("\n[13] Notifications");
  const notifs = await request("GET", "/api/user/notifications", { cookie });
  assert(notifs.status === 200, "notifications endpoint ok");
  assert(Array.isArray(notifs.body.notifications), "notifications is array");

  // -----------------------------------------------------------------------
  // 14. Rate Limiting
  // -----------------------------------------------------------------------
  console.log("\n[14] Rate Limiting");
  // Fire rapid auth requests — should eventually get 429
  let got429 = false;
  for (let i = 0; i < 15; i++) {
    const r = await request("POST", "/api/auth/nonce");
    if (r.status === 429) {
      got429 = true;
      break;
    }
  }
  assert(got429, "rate limiting active (429 returned after rapid requests)");

  // -----------------------------------------------------------------------
  // Summary
  // -----------------------------------------------------------------------
  console.log(`\n>>> V2 SMOKE TEST COMPLETE: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("SMOKE TEST CRASHED:", e.message);
  process.exit(1);
});
