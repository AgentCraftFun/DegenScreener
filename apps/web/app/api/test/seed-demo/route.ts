import { NextResponse } from "next/server";
import { db, schema, runMigrations } from "@degenscreener/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const {
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
} = schema;

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}
function randInt(min: number, max: number) {
  return Math.floor(rand(min, max));
}
function pick<T>(arr: T[]): T {
  return arr[randInt(0, arr.length)]!;
}

export async function POST() {
  try {
    // Run migrations first to ensure all tables exist
    await runMigrations();

    // Clear all tables
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

    // Users
    const userRows = await db
      .insert(users)
      .values([
        { walletAddress: "0xPlatformTreasury", internalBalance: "50000", totalDeposited: "50000" },
        { walletAddress: "0xDev1Owner", internalBalance: "5000", totalDeposited: "5000" },
        { walletAddress: "0xDev2Owner", internalBalance: "3000", totalDeposited: "3000" },
        { walletAddress: "0xDegen1Owner", internalBalance: "2000", totalDeposited: "2000" },
        { walletAddress: "0xDegen2Owner", internalBalance: "1500", totalDeposited: "1500" },
      ])
      .returning();

    const [uPlatform, uDev1, uDev2, uDegen1, uDegen2] = userRows;

    // 5 DEV Agents
    const devDefs = [
      { name: "TokenFactory", handle: "tokenfactory", style: "MILD", rug: 0.02, freq: "MEDIUM", bal: "450", personality: "ANALYTICAL", owner: uDev1!, pnl: "1250", vol: "18500", fees: "920", launched: 8, rugs: 0 },
      { name: "MemeChef", handle: "memechef", style: "SPICY", rug: 0.08, freq: "FAST", bal: "320", personality: "HYPE_BEAST", owner: uDev1!, pnl: "890", vol: "12400", fees: "620", launched: 12, rugs: 1 },
      { name: "FairLaunchKing", handle: "fairlaunchking", style: "MILD", rug: 0.0, freq: "SLOW", bal: "580", personality: "ANALYTICAL", owner: uDev2!, pnl: "2100", vol: "25000", fees: "1250", launched: 5, rugs: 0 },
      { name: "RugLordXx", handle: "ruglordxx", style: "DEGEN", rug: 0.25, freq: "FAST", bal: "180", personality: "TROLL", owner: uDev2!, pnl: "-340", vol: "8900", fees: "445", launched: 15, rugs: 4 },
      { name: "SolidDev", handle: "soliddev", style: "MILD", rug: 0.01, freq: "MEDIUM", bal: "420", personality: "ANALYTICAL", owner: uPlatform!, pnl: "1780", vol: "21000", fees: "1050", launched: 7, rugs: 0 },
    ];

    const devAgentRows = await db
      .insert(agents)
      .values(
        devDefs.map((d, i) => ({
          ownerId: d.owner.id,
          name: d.name,
          handle: d.handle,
          type: "DEV" as const,
          balance: d.bal,
          riskProfile: {
            launchStyle: d.style,
            launchFrequency: d.freq,
            rugProbability: d.rug,
            initialLiquidity: "30",
          },
          personality: d.personality,
          totalPnl: d.pnl,
          totalVolume: d.vol,
          totalFeesEarned: d.fees,
          tokensLaunched: d.launched,
          rugCount: d.rugs,
          nextEvalTick: i + 1,
        })),
      )
      .returning();

    // 10 DEGEN Agents
    const degenDefs = [
      { name: "AlphaHunter", handle: "alphahunter", profile: "AGGRESSIVE", personality: "ANALYTICAL", bal: "280", owner: uDegen1!, pnl: "3200", vol: "42000" },
      { name: "SmartMoney", handle: "smartmoney", profile: "MODERATE", personality: "ANALYTICAL", bal: "350", owner: uDegen1!, pnl: "1800", vol: "28000" },
      { name: "MomentumKing", handle: "momentumking", profile: "AGGRESSIVE", personality: "HYPE_BEAST", bal: "190", owner: uDegen1!, pnl: "2400", vol: "35000" },
      { name: "SafeHands", handle: "safehands", profile: "CONSERVATIVE", personality: "ANALYTICAL", bal: "420", owner: uDegen2!, pnl: "650", vol: "15000" },
      { name: "DegenDave", handle: "degendave", profile: "FULL_DEGEN", personality: "TROLL", bal: "80", owner: uDegen2!, pnl: "-1200", vol: "55000" },
      { name: "TrendFollower", handle: "trendfollower", profile: "MODERATE", personality: "HYPE_BEAST", bal: "310", owner: uPlatform!, pnl: "1100", vol: "22000" },
      { name: "SwingTrader", handle: "swingtrader", profile: "AGGRESSIVE", personality: "ANALYTICAL", bal: "260", owner: uPlatform!, pnl: "1950", vol: "31000" },
      { name: "APEorDIE", handle: "apeordie", profile: "FULL_DEGEN", personality: "HYPE_BEAST", bal: "45", owner: uPlatform!, pnl: "-2800", vol: "68000" },
      { name: "CautiousCarl", handle: "cautiouscarl", profile: "CONSERVATIVE", personality: "DOOMER", bal: "500", owner: uDegen1!, pnl: "320", vol: "8500" },
      { name: "YOLOswaggins", handle: "yoloswaggins", profile: "FULL_DEGEN", personality: "TROLL", bal: "120", owner: uDegen2!, pnl: "4500", vol: "82000" },
    ];

    const degenAgentRows = await db
      .insert(agents)
      .values(
        degenDefs.map((d, i) => ({
          ownerId: d.owner.id,
          name: d.name,
          handle: d.handle,
          type: "DEGEN" as const,
          balance: d.bal,
          riskProfile: {
            profile: d.profile,
            positionSizing: "MEDIUM",
            takeProfit: "SCALE_OUT",
            stopLossPct: 30,
            takeProfitPct: 100,
            maxPositions: 5,
          },
          personality: d.personality,
          totalPnl: d.pnl,
          totalVolume: d.vol,
          nextEvalTick: i + 1,
        })),
      )
      .returning();

    const allAgents = [...devAgentRows, ...degenAgentRows];

    // 15 Tokens
    const tokenDefs = [
      { ticker: "$PEPE2", name: "Pepe 2.0", creator: devAgentRows[0]!, supply: "1000000000", status: "ACTIVE" as const },
      { ticker: "$MOONDOG", name: "Moon Dog", creator: devAgentRows[0]!, supply: "500000000", status: "ACTIVE" as const },
      { ticker: "$WOJAK", name: "Wojak Finance", creator: devAgentRows[1]!, supply: "2000000000", status: "ACTIVE" as const },
      { ticker: "$COOK", name: "MemeChef Token", creator: devAgentRows[1]!, supply: "800000000", status: "ACTIVE" as const },
      { ticker: "$DIAMOND", name: "Diamond Hands", creator: devAgentRows[2]!, supply: "100000000", status: "ACTIVE" as const },
      { ticker: "$FAIR", name: "Fair Protocol", creator: devAgentRows[2]!, supply: "500000000", status: "ACTIVE" as const },
      { ticker: "$RUGLIFE", name: "Rug Life", creator: devAgentRows[3]!, supply: "5000000000", status: "RUGGED" as const },
      { ticker: "$SCAM100", name: "Scam 100x", creator: devAgentRows[3]!, supply: "10000000000", status: "RUGGED" as const },
      { ticker: "$SOLID", name: "Solid Token", creator: devAgentRows[4]!, supply: "250000000", status: "ACTIVE" as const },
      { ticker: "$BUILDER", name: "Builder DAO", creator: devAgentRows[4]!, supply: "300000000", status: "ACTIVE" as const },
      { ticker: "$CHAD", name: "Chad Coin", creator: devAgentRows[0]!, supply: "420690000", status: "ACTIVE" as const },
      { ticker: "$FROG", name: "Frog Nation", creator: devAgentRows[1]!, supply: "1000000000", status: "ACTIVE" as const },
      { ticker: "$APE", name: "Ape Together", creator: devAgentRows[2]!, supply: "888000000", status: "ACTIVE" as const },
      { ticker: "$SEND", name: "Send It", creator: devAgentRows[3]!, supply: "2000000000", status: "RUGGED" as const },
      { ticker: "$GEM", name: "Hidden Gem", creator: devAgentRows[4]!, supply: "150000000", status: "ACTIVE" as const },
    ];

    const tokenRows = await db
      .insert(tokens)
      .values(
        tokenDefs.map((t) => ({
          ticker: t.ticker,
          name: t.name,
          creatorAgentId: t.creator.id,
          totalSupply: t.supply,
          status: t.status,
        })),
      )
      .returning();

    // Liquidity Pools
    const poolDefs = tokenRows.map((t, i) => {
      const isRugged = tokenDefs[i]!.status === "RUGGED";
      const dscreenReserve = isRugged ? "0.01" : String(rand(20, 500).toFixed(2));
      const tokenReserve = isRugged ? t.totalSupply : String(rand(100000, 500000000).toFixed(0));
      const k = String((Number(dscreenReserve) * Number(tokenReserve)).toFixed(6));
      const volume = isRugged ? String(rand(500, 5000).toFixed(2)) : String(rand(2000, 80000).toFixed(2));
      return { tokenId: t.id, dscreenReserve, tokenReserve, kConstant: k, totalVolume: volume };
    });
    await db.insert(liquidityPools).values(poolDefs);

    // 200 Trades
    const now = Date.now();
    const tradeValues: (typeof trades.$inferInsert)[] = [];
    const activeTokens = tokenRows.filter((_, i) => tokenDefs[i]!.status === "ACTIVE");

    for (let i = 0; i < 200; i++) {
      const agent = pick(allAgents);
      const token = pick(activeTokens);
      const isBuy = Math.random() > 0.4;
      const amount = rand(0.5, 50).toFixed(4);
      const price = rand(0.00000001, 0.005).toFixed(10);
      const tokenAmt = (Number(amount) / Number(price)).toFixed(2);
      const fee = (Number(amount) * 0.05).toFixed(4);
      const createdAt = new Date(now - randInt(60_000, 86400_000 * 3));

      tradeValues.push({
        agentId: agent.id,
        tokenId: token.id,
        type: isBuy ? "BUY" : "SELL",
        dscreenAmount: amount,
        tokenAmount: tokenAmt,
        priceAtTrade: price,
        feeAmount: fee,
        createdAt,
      });
    }
    await db.insert(trades).values(tradeValues);

    // Agent Holdings
    const holdingsMap = new Map<string, { agentId: string; tokenId: string; qty: number; price: number }>();
    for (const t of tradeValues) {
      if (t.type !== "BUY") continue;
      const key = `${t.agentId}-${t.tokenId}`;
      const existing = holdingsMap.get(key);
      if (existing) {
        existing.qty += Number(t.tokenAmount);
      } else {
        holdingsMap.set(key, { agentId: t.agentId, tokenId: t.tokenId, qty: Number(t.tokenAmount), price: Number(t.priceAtTrade!) });
      }
    }
    const holdingValues = Array.from(holdingsMap.values()).map((h) => ({
      agentId: h.agentId,
      tokenId: h.tokenId,
      quantity: h.qty.toFixed(2),
      avgEntryPrice: h.price.toFixed(10),
    }));
    if (holdingValues.length > 0) {
      await db.insert(agentHoldings).values(holdingValues);
    }

    // 50 Tweets
    const tweetTemplates = [
      (t: string) => `$${t} looking absolutely bullish right now. Loading up more bags`,
      (t: string) => `Just aped into $${t}. Chart looks immaculate. NFA but DYOR.`,
      (t: string) => `GM degens. $${t} is the play today. Don't miss this one.`,
      (t: string) => `$${t} breakout incoming. Support holding strong at current levels.`,
      (t: string) => `Took profits on $${t}. +150% in 2 hours. Thank me later.`,
      (t: string) => `$${t} dev is cooking something. Rumors of a major partnership.`,
      (t: string) => `New token launch: $${t}! Fair launch, no presale. LFG!`,
      (t: string) => `$${t} just hit ATH. Still early imo. Market cap is nothing.`,
      (t: string) => `Warning: $${t} looks suspicious. Dev wallet moving tokens.`,
      (t: string) => `$${t} community growing fast. Holders increasing rapidly.`,
      (t: string) => `Sold my $${t} position. Taking risk off the table.`,
      (t: string) => `$${t} dip is a gift. Accumulating here. This will pump hard.`,
      (t: string) => `Just launched $${t}! Liquidity locked, contract renounced. SAFU.`,
      (t: string) => `$${t} is printing money. Best trade I've made this week.`,
      (t: string) => `$${t} volume picking up massively. Something is brewing.`,
    ];

    const tweetValues: (typeof tweets.$inferInsert)[] = [];
    for (let i = 0; i < 50; i++) {
      const agent = pick(allAgents);
      const token = pick(activeTokens);
      const tokenIdx = tokenRows.indexOf(token);
      const ticker = tokenDefs[tokenIdx]?.ticker.replace("$", "") ?? "UNKNOWN";
      const template = pick(tweetTemplates);
      const sentiment = rand(-0.8, 0.9).toFixed(2);
      const createdAt = new Date(now - randInt(60_000, 86400_000 * 2));

      tweetValues.push({
        agentId: agent.id,
        content: template(ticker),
        tokenId: token.id,
        sentimentScore: sentiment,
        likes: randInt(0, 500),
        retweets: randInt(0, 150),
        createdAt,
      });
    }
    await db.insert(tweets).values(tweetValues);

    // Candles for all active tokens
    const candleValues: (typeof candles.$inferInsert)[] = [];

    for (const token of activeTokens) {
      const basePrice = rand(0.00001, 0.01);
      const volatility = rand(0.02, 0.15);

      // 1m candles (last 120 mins)
      let price = basePrice;
      for (let m = 120; m > 0; m--) {
        const ts = new Date(now - m * 60_000);
        const change = price * volatility * (Math.random() - 0.45);
        const open = price;
        price = Math.max(price + change, basePrice * 0.1);
        const close = price;
        const high = Math.max(open, close) * (1 + Math.random() * volatility * 0.5);
        const low = Math.min(open, close) * (1 - Math.random() * volatility * 0.5);
        candleValues.push({
          tokenId: token.id, timeframe: "1m", timestamp: ts,
          open: open.toFixed(10), high: high.toFixed(10), low: low.toFixed(10), close: close.toFixed(10),
          volume: rand(0.1, 20).toFixed(4),
        });
      }

      // 5m candles (last 100 intervals)
      price = basePrice;
      for (let m = 100; m > 0; m--) {
        const ts = new Date(now - m * 5 * 60_000);
        const change = price * volatility * (Math.random() - 0.45);
        const open = price;
        price = Math.max(price + change, basePrice * 0.1);
        const close = price;
        const high = Math.max(open, close) * (1 + Math.random() * volatility);
        const low = Math.min(open, close) * (1 - Math.random() * volatility);
        candleValues.push({
          tokenId: token.id, timeframe: "5m", timestamp: ts,
          open: open.toFixed(10), high: high.toFixed(10), low: low.toFixed(10), close: close.toFixed(10),
          volume: rand(1, 100).toFixed(4),
        });
      }

      // 15m candles (last 96 intervals)
      price = basePrice;
      for (let m = 96; m > 0; m--) {
        const ts = new Date(now - m * 15 * 60_000);
        const change = price * volatility * (Math.random() - 0.45);
        const open = price;
        price = Math.max(price + change, basePrice * 0.1);
        const close = price;
        const high = Math.max(open, close) * (1 + Math.random() * volatility * 1.2);
        const low = Math.min(open, close) * (1 - Math.random() * volatility * 1.2);
        candleValues.push({
          tokenId: token.id, timeframe: "15m", timestamp: ts,
          open: open.toFixed(10), high: high.toFixed(10), low: low.toFixed(10), close: close.toFixed(10),
          volume: rand(5, 200).toFixed(4),
        });
      }

      // 1h candles (last 72 hours)
      price = basePrice;
      for (let h = 72; h > 0; h--) {
        const ts = new Date(now - h * 3600_000);
        const change = price * volatility * (Math.random() - 0.45);
        const open = price;
        price = Math.max(price + change, basePrice * 0.1);
        const close = price;
        const high = Math.max(open, close) * (1 + Math.random() * volatility * 1.5);
        const low = Math.min(open, close) * (1 - Math.random() * volatility * 1.5);
        candleValues.push({
          tokenId: token.id, timeframe: "1h", timestamp: ts,
          open: open.toFixed(10), high: high.toFixed(10), low: low.toFixed(10), close: close.toFixed(10),
          volume: rand(20, 500).toFixed(4),
        });
      }
    }

    // Batch insert candles
    const BATCH = 500;
    for (let i = 0; i < candleValues.length; i += BATCH) {
      await db.insert(candles).values(candleValues.slice(i, i + BATCH));
    }

    // Simulation state
    await db.insert(simulationState).values({ id: 1, currentTick: 100n });

    return NextResponse.json({
      success: true,
      seeded: {
        users: userRows.length,
        devAgents: devAgentRows.length,
        degenAgents: degenAgentRows.length,
        tokens: tokenRows.length,
        pools: poolDefs.length,
        trades: tradeValues.length,
        holdings: holdingValues.length,
        tweets: tweetValues.length,
        candles: candleValues.length,
      },
    });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 },
    );
  }
}
