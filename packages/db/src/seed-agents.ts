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

interface DevAgentDef {
  name: string;
  handle: string;
  style: LaunchStyle;
  rug: number;
  freq: LaunchFrequency;
  balance: string;
}

interface DegenAgentDef {
  name: string;
  handle: string;
  profile: RiskProfile;
  personality: Personality;
  balance: string;
}

const DEVS: DevAgentDef[] = [
  { name: "TokenFactory", handle: "TokenFactory", style: LaunchStyle.MILD, rug: 0.03, freq: LaunchFrequency.MEDIUM, balance: "400" },
  { name: "DegenerateDev", handle: "DegDev", style: LaunchStyle.DEGEN, rug: 0.15, freq: LaunchFrequency.FAST, balance: "300" },
  { name: "FairLaunchKing", handle: "FairLaunchKing", style: LaunchStyle.MILD, rug: 0.0, freq: LaunchFrequency.SLOW, balance: "500" },
  { name: "MemeChef", handle: "MemeChef", style: LaunchStyle.SPICY, rug: 0.08, freq: LaunchFrequency.MEDIUM, balance: "350" },
  { name: "RugLordXx", handle: "RugLordXx", style: LaunchStyle.DEGEN, rug: 0.25, freq: LaunchFrequency.FAST, balance: "250" },
  { name: "SolidDev", handle: "SolidDev", style: LaunchStyle.MILD, rug: 0.02, freq: LaunchFrequency.SLOW, balance: "450" },
  { name: "YOLOLauncher", handle: "YOLOLauncher", style: LaunchStyle.SPICY, rug: 0.10, freq: LaunchFrequency.FAST, balance: "200" },
];

const DEGENS: DegenAgentDef[] = [
  { name: "SafeHands", handle: "SafeHands", profile: RiskProfile.CONSERVATIVE, personality: Personality.ANALYTICAL, balance: "200" },
  { name: "CautiousCarl", handle: "CautiousCarl", profile: RiskProfile.CONSERVATIVE, personality: Personality.DOOMER, balance: "180" },
  { name: "RiskManager", handle: "RiskManager", profile: RiskProfile.CONSERVATIVE, personality: Personality.ANALYTICAL, balance: "250" },
  { name: "SmartMoney", handle: "SmartMoney", profile: RiskProfile.MODERATE, personality: Personality.ANALYTICAL, balance: "300" },
  { name: "TrendFollower", handle: "TrendFollower", profile: RiskProfile.MODERATE, personality: Personality.HYPE_BEAST, balance: "250" },
  { name: "BalancedBet", handle: "BalancedBet", profile: RiskProfile.MODERATE, personality: Personality.ANALYTICAL, balance: "220" },
  { name: "SteadyEddie", handle: "SteadyEddie", profile: RiskProfile.MODERATE, personality: Personality.TROLL, balance: "200" },
  { name: "AlphaHunter", handle: "AlphaHunter", profile: RiskProfile.AGGRESSIVE, personality: Personality.HYPE_BEAST, balance: "180" },
  { name: "MomentumKing", handle: "MomentumKing", profile: RiskProfile.AGGRESSIVE, personality: Personality.HYPE_BEAST, balance: "150" },
  { name: "SwingTrader", handle: "SwingTrader", profile: RiskProfile.AGGRESSIVE, personality: Personality.ANALYTICAL, balance: "200" },
  { name: "DegenDave", handle: "DegenDave", profile: RiskProfile.AGGRESSIVE, personality: Personality.TROLL, balance: "150" },
  { name: "APEorDIE", handle: "APEorDIE", profile: RiskProfile.FULL_DEGEN, personality: Personality.HYPE_BEAST, balance: "120" },
  { name: "YOLOswaggins", handle: "YOLOswaggins", profile: RiskProfile.FULL_DEGEN, personality: Personality.TROLL, balance: "100" },
];

async function main() {
  console.log("seeding platform ecosystem...");

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
        internalBalance: "10000",
        totalDeposited: "10000",
      })
      .returning();
    platformUser = created!;
  }

  // Skip agents with a name that's already in our seed list
  const existingAgents = await db
    .select({ name: agents.name, handle: agents.handle })
    .from(agents)
    .where(sql`owner_id = ${platformUser.id}`);
  const existingHandles = new Set(existingAgents.map((a) => a.handle));

  // Deploy Dev Agents
  let devIdx = 0;
  for (const d of DEVS) {
    if (existingHandles.has(d.handle)) { devIdx++; continue; }
    await db.insert(agents).values({
      ownerId: platformUser.id,
      name: d.name,
      handle: d.handle,
      type: AgentType.DEV,
      balance: d.balance,
      riskProfile: {
        launchStyle: d.style,
        launchFrequency: d.freq,
        rugProbability: d.rug,
        initialLiquidity: "30",
      },
      personality: Personality.HYPE_BEAST,
      nextEvalTick: (devIdx++ % 5) + 1,
    });
  }

  // Deploy Degens
  let degIdx = 0;
  for (const d of DEGENS) {
    if (existingHandles.has(d.handle)) { degIdx++; continue; }
    await db.insert(agents).values({
      ownerId: platformUser.id,
      name: d.name,
      handle: d.handle,
      type: AgentType.DEGEN,
      balance: d.balance,
      riskProfile: {
        profile: d.profile,
        positionSizing: PositionSizing.MEDIUM,
        takeProfit: TakeProfitStrategy.SCALE_OUT,
        stopLossPct: 30,
        takeProfitPct: 100,
        maxPositions: 5,
      },
      personality: d.personality,
      nextEvalTick: (degIdx++ % 5) + 1,
    });
  }

  // Ensure simulation_state
  const [sim] = await db.select().from(simulationState);
  if (!sim) {
    await db.insert(simulationState).values({ id: 1, currentTick: 0n });
  }

  console.log(`seeded ${DEVS.length} devs + ${DEGENS.length} degens`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
