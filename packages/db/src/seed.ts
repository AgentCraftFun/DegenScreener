import { db, pool } from "./client.js";
import {
  users,
  agents,
  tokens,
  liquidityPools,
  trades,
  tweets,
  candles,
  simulationState,
  agentHoldings,
  transactions,
  notifications,
  agentCostTracking,
} from "./schema.js";
import {
  AgentType,
  Personality,
  RiskProfile,
  PositionSizing,
  TakeProfitStrategy,
  LaunchStyle,
  LaunchFrequency,
} from "@degenscreener/shared";

async function main() {
  console.log("clearing tables...");
  // Clear in FK-safe order
  await db.delete(agentCostTracking);
  await db.delete(notifications);
  await db.delete(transactions);
  await db.delete(candles);
  await db.delete(tweets);
  await db.delete(agentHoldings);
  await db.delete(trades);
  await db.delete(liquidityPools);
  await db.delete(tokens);
  await db.delete(agents);
  await db.delete(users);
  await db.delete(simulationState);

  console.log("inserting users...");
  const userRows = await db
    .insert(users)
    .values([
      {
        walletAddress: "0xTestUser1",
        internalBalance: "1000",
        totalDeposited: "1000",
      },
      {
        walletAddress: "0xTestUser2",
        internalBalance: "1000",
        totalDeposited: "1000",
      },
      {
        walletAddress: "0xTestUser3",
        internalBalance: "1000",
        totalDeposited: "1000",
      },
    ])
    .returning();
  const [u1, u2, u3] = userRows;

  console.log("inserting agents...");
  const devRiskA = {
    launchStyle: LaunchStyle.SPICY,
    launchFrequency: LaunchFrequency.MEDIUM,
    rugProbability: 0.1,
    initialLiquidity: "100",
  };
  const devRiskB = {
    launchStyle: LaunchStyle.DEGEN,
    launchFrequency: LaunchFrequency.FAST,
    rugProbability: 0.3,
    initialLiquidity: "100",
  };
  const mkDegen = (profile: RiskProfile) => ({
    profile,
    positionSizing: PositionSizing.MEDIUM,
    takeProfit: TakeProfitStrategy.SCALE_OUT,
    stopLossPct: 20,
    takeProfitPct: 50,
    maxPositions: 5,
  });

  const agentRows = await db
    .insert(agents)
    .values([
      {
        ownerId: u1!.id,
        name: "DevKing",
        handle: "devking",
        type: AgentType.DEV,
        balance: "500",
        riskProfile: devRiskA,
        personality: Personality.HYPE_BEAST,
      },
      {
        ownerId: u2!.id,
        name: "RugLord",
        handle: "ruglord",
        type: AgentType.DEV,
        balance: "500",
        riskProfile: devRiskB,
        personality: Personality.TROLL,
      },
      {
        ownerId: u1!.id,
        name: "SafeTrader",
        handle: "safetrader",
        type: AgentType.DEGEN,
        balance: "200",
        riskProfile: mkDegen(RiskProfile.CONSERVATIVE),
        personality: Personality.ANALYTICAL,
      },
      {
        ownerId: u2!.id,
        name: "MidDegen",
        handle: "middegen",
        type: AgentType.DEGEN,
        balance: "200",
        riskProfile: mkDegen(RiskProfile.AGGRESSIVE),
        personality: Personality.HYPE_BEAST,
      },
      {
        ownerId: u3!.id,
        name: "FullDegen",
        handle: "fulldegen",
        type: AgentType.DEGEN,
        balance: "200",
        riskProfile: mkDegen(RiskProfile.FULL_DEGEN),
        personality: Personality.DOOMER,
      },
    ])
    .returning();
  const [devA, devB, degen1, degen2, degen3] = agentRows;

  console.log("inserting tokens...");
  const tokenRows = await db
    .insert(tokens)
    .values([
      {
        ticker: "$PEPEKING",
        name: "Pepe King",
        creatorAgentId: devA!.id,
        totalSupply: "1000000000",
      },
      {
        ticker: "$MOONRAT",
        name: "Moon Rat",
        creatorAgentId: devA!.id,
        totalSupply: "1000000000",
      },
      {
        ticker: "$RUGLIFE",
        name: "Rug Life",
        creatorAgentId: devB!.id,
        totalSupply: "1000000000",
      },
    ])
    .returning();
  const [tkA, tkB, tkC] = tokenRows;

  console.log("inserting pools...");
  const k = "100000000000"; // 100 * 1_000_000_000
  await db.insert(liquidityPools).values(
    tokenRows.map((t) => ({
      tokenId: t.id,
      dscreenReserve: "100",
      tokenReserve: "1000000000",
      kConstant: k,
      totalVolume: "0",
    })),
  );

  console.log("inserting trades...");
  const tokenList = [tkA!, tkB!, tkC!];
  const traderList = [degen1!, degen2!, degen3!];
  const tradeValues = [] as (typeof trades.$inferInsert)[];
  for (let i = 0; i < 20; i++) {
    const tok = tokenList[i % 3]!;
    const agent = traderList[i % 3]!;
    const isBuy = i % 2 === 0;
    tradeValues.push({
      agentId: agent.id,
      tokenId: tok.id,
      type: isBuy ? "BUY" : "SELL",
      dscreenAmount: isBuy ? "1" : "0.5",
      tokenAmount: isBuy ? "9000" : "4500",
      priceAtTrade: "0.0000001",
      feeAmount: isBuy ? "0.05" : "0.025",
    });
  }
  await db.insert(trades).values(tradeValues);

  console.log("inserting tweets...");
  const tweetValues = [] as (typeof tweets.$inferInsert)[];
  for (let i = 0; i < 10; i++) {
    const agent = [devA!, devB!, degen1!, degen2!, degen3!][i % 5]!;
    const tok = tokenList[i % 3]!;
    tweetValues.push({
      agentId: agent.id,
      content: `GM degens, ${tok.ticker} to the moon #${i}`,
      tokenId: tok.id,
      sentimentScore: (Math.random() * 2 - 1).toFixed(2),
    });
  }
  await db.insert(tweets).values(tweetValues);

  console.log("inserting candles...");
  const now = new Date();
  const candleValues = [] as (typeof candles.$inferInsert)[];
  for (const tk of tokenList) {
    for (let m = 60; m > 0; m--) {
      const ts = new Date(now.getTime() - m * 60_000);
      candleValues.push({
        tokenId: tk.id,
        timeframe: "1m",
        timestamp: ts,
        open: "0.0000001",
        high: "0.00000012",
        low: "0.00000009",
        close: "0.0000001",
        volume: "0.5",
      });
    }
  }
  await db.insert(candles).values(candleValues);

  console.log("inserting simulation_state...");
  await db
    .insert(simulationState)
    .values({ id: 1, currentTick: 0n });

  console.log("seed complete.");
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
