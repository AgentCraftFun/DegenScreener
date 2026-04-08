import { db, pool } from "./client.js";
import { users, agents, simulationState } from "./schema.js";
import {
  AgentType,
  Personality,
  RiskProfile,
  PositionSizing,
  TakeProfitStrategy,
  LaunchStyle,
  LaunchFrequency,
} from "@degenscreener/shared";
import { sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// V2 Seed Agents — ETH-denominated, no rug probability
// ---------------------------------------------------------------------------

interface DevAgentDef {
  name: string;
  handle: string;
  style: LaunchStyle;
  freq: LaunchFrequency;
  personality: Personality;
}

interface DegenAgentDef {
  name: string;
  handle: string;
  profile: RiskProfile;
  personality: Personality;
  sizing: PositionSizing;
  takeProfit: TakeProfitStrategy;
}

const DEVS: DevAgentDef[] = [
  { name: "TokenFactory", handle: "TokenFactory", style: LaunchStyle.MILD, freq: LaunchFrequency.MEDIUM, personality: Personality.ANALYTICAL },
  { name: "DegenerateDev", handle: "DegDev", style: LaunchStyle.DEGEN, freq: LaunchFrequency.FAST, personality: Personality.HYPE_BEAST },
  { name: "FairLaunchKing", handle: "FairLaunchKing", style: LaunchStyle.MILD, freq: LaunchFrequency.SLOW, personality: Personality.ANALYTICAL },
  { name: "MemeChef", handle: "MemeChef", style: LaunchStyle.SPICY, freq: LaunchFrequency.MEDIUM, personality: Personality.TROLL },
  { name: "TrendSpotter", handle: "TrendSpotter", style: LaunchStyle.SPICY, freq: LaunchFrequency.FAST, personality: Personality.HYPE_BEAST },
  { name: "SolidDev", handle: "SolidDev", style: LaunchStyle.MILD, freq: LaunchFrequency.SLOW, personality: Personality.ANALYTICAL },
  { name: "ViralMinter", handle: "ViralMinter", style: LaunchStyle.DEGEN, freq: LaunchFrequency.FAST, personality: Personality.TROLL },
];

const DEGENS: DegenAgentDef[] = [
  { name: "SafeHands", handle: "SafeHands", profile: RiskProfile.CONSERVATIVE, personality: Personality.ANALYTICAL, sizing: PositionSizing.SMALL, takeProfit: TakeProfitStrategy.SCALE_OUT },
  { name: "CautiousCarl", handle: "CautiousCarl", profile: RiskProfile.CONSERVATIVE, personality: Personality.DOOMER, sizing: PositionSizing.SMALL, takeProfit: TakeProfitStrategy.SELL_INITIALS },
  { name: "RiskManager", handle: "RiskManager", profile: RiskProfile.CONSERVATIVE, personality: Personality.ANALYTICAL, sizing: PositionSizing.SMALL, takeProfit: TakeProfitStrategy.SCALE_OUT },
  { name: "SmartMoney", handle: "SmartMoney", profile: RiskProfile.MODERATE, personality: Personality.ANALYTICAL, sizing: PositionSizing.MEDIUM, takeProfit: TakeProfitStrategy.SCALE_OUT },
  { name: "TrendFollower", handle: "TrendFollower", profile: RiskProfile.MODERATE, personality: Personality.HYPE_BEAST, sizing: PositionSizing.MEDIUM, takeProfit: TakeProfitStrategy.SCALE_OUT },
  { name: "BalancedBet", handle: "BalancedBet", profile: RiskProfile.MODERATE, personality: Personality.ANALYTICAL, sizing: PositionSizing.MEDIUM, takeProfit: TakeProfitStrategy.SELL_INITIALS },
  { name: "SteadyEddie", handle: "SteadyEddie", profile: RiskProfile.MODERATE, personality: Personality.TROLL, sizing: PositionSizing.MEDIUM, takeProfit: TakeProfitStrategy.DIAMOND_HANDS },
  { name: "AlphaHunter", handle: "AlphaHunter", profile: RiskProfile.AGGRESSIVE, personality: Personality.HYPE_BEAST, sizing: PositionSizing.LARGE, takeProfit: TakeProfitStrategy.SCALE_OUT },
  { name: "MomentumKing", handle: "MomentumKing", profile: RiskProfile.AGGRESSIVE, personality: Personality.HYPE_BEAST, sizing: PositionSizing.LARGE, takeProfit: TakeProfitStrategy.DIAMOND_HANDS },
  { name: "SwingTrader", handle: "SwingTrader", profile: RiskProfile.AGGRESSIVE, personality: Personality.ANALYTICAL, sizing: PositionSizing.LARGE, takeProfit: TakeProfitStrategy.SCALE_OUT },
  { name: "DegenDave", handle: "DegenDave", profile: RiskProfile.AGGRESSIVE, personality: Personality.TROLL, sizing: PositionSizing.LARGE, takeProfit: TakeProfitStrategy.SELL_INITIALS },
  { name: "APEorDIE", handle: "APEorDIE", profile: RiskProfile.FULL_DEGEN, personality: Personality.HYPE_BEAST, sizing: PositionSizing.YOLO, takeProfit: TakeProfitStrategy.DIAMOND_HANDS },
  { name: "YOLOswaggins", handle: "YOLOswaggins", profile: RiskProfile.FULL_DEGEN, personality: Personality.TROLL, sizing: PositionSizing.YOLO, takeProfit: TakeProfitStrategy.DIAMOND_HANDS },
];

async function main() {
  console.log("seeding V2 platform ecosystem...");

  // Ensure platform treasury user exists
  const platformWallet = "0xplatformtreasury";
  const [existing] = await db
    .select()
    .from(users)
    .where(sql`wallet_address = ${platformWallet}`);
  let platformUser = existing;
  if (!platformUser) {
    const [created] = await db
      .insert(users)
      .values({
        walletAddress: platformWallet,
        internalBalance: "0",
        totalDeposited: "0",
      })
      .returning();
    platformUser = created!;
  }

  // Skip agents whose handle already exists
  const existingAgents = await db
    .select({ handle: agents.handle })
    .from(agents)
    .where(sql`owner_id = ${platformUser.id}`);
  const existingHandles = new Set(existingAgents.map((a) => a.handle));

  // Deploy Dev Agents (V2: no rug probability, wallets created by worker on first eval)
  let devCount = 0;
  let devIdx = 0;
  for (const d of DEVS) {
    if (existingHandles.has(d.handle)) { devIdx++; continue; }
    await db.insert(agents).values({
      ownerId: platformUser.id,
      name: d.name,
      handle: d.handle,
      type: AgentType.DEV,
      balance: "0", // V2: no internal balance, agents use real ETH
      ethBalance: "0", // Wallet funded externally with testnet ETH
      riskProfile: {
        launchStyle: d.style,
        launchFrequency: d.freq,
        // V2: no rugProbability — graduation replaces rugging
      },
      personality: d.personality,
      nextEvalTick: (devIdx++ % 5) + 1,
    });
    devCount++;
  }

  // Deploy Degen Agents
  let degenCount = 0;
  let degIdx = 0;
  for (const d of DEGENS) {
    if (existingHandles.has(d.handle)) { degIdx++; continue; }
    await db.insert(agents).values({
      ownerId: platformUser.id,
      name: d.name,
      handle: d.handle,
      type: AgentType.DEGEN,
      balance: "0",
      ethBalance: "0",
      riskProfile: {
        profile: d.profile,
        positionSizing: d.sizing,
        takeProfit: d.takeProfit,
        stopLossPct: d.profile === RiskProfile.CONSERVATIVE ? 15 :
                     d.profile === RiskProfile.MODERATE ? 25 :
                     d.profile === RiskProfile.AGGRESSIVE ? 40 : 60,
        takeProfitPct: d.profile === RiskProfile.CONSERVATIVE ? 50 :
                       d.profile === RiskProfile.MODERATE ? 100 :
                       d.profile === RiskProfile.AGGRESSIVE ? 200 : 500,
        maxPositions: d.profile === RiskProfile.CONSERVATIVE ? 3 :
                      d.profile === RiskProfile.MODERATE ? 5 :
                      d.profile === RiskProfile.AGGRESSIVE ? 8 : 12,
      },
      personality: d.personality,
      nextEvalTick: (degIdx++ % 5) + 1,
    });
    degenCount++;
  }

  // Ensure simulation_state
  const [sim] = await db.select().from(simulationState);
  if (!sim) {
    await db.insert(simulationState).values({ id: 1, currentTick: 0n });
  }

  console.log(`seeded ${devCount} devs + ${degenCount} degens (${DEVS.length - devCount + DEGENS.length - degenCount} already existed)`);
  console.log("NOTE: Agent wallets are auto-created by the worker on first evaluation.");
  console.log("NOTE: Fund agent wallets with testnet ETH to activate trading.");
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
