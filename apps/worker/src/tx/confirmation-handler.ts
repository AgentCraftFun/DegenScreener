import {
  publicClient,
  checkPendingConfirmations,
  type TxResult,
  type TxPipelineCallbacks,
} from "@degenscreener/blockchain";
import {
  agentQueries,
  pendingTxQueries,
  tokenQueries,
  notificationQueries,
  schema,
  db,
} from "@degenscreener/db";
import { eq } from "drizzle-orm";
import { publishNotification } from "../events.js";
import { generateTweet, type TweetTrigger } from "../ai/tweet-generator.js";
import { Personality } from "@degenscreener/shared";

// ---------------------------------------------------------------------------
// Pipeline callbacks — wired into the tx-pipeline from Batch 2
// ---------------------------------------------------------------------------

export const txPipelineCallbacks: TxPipelineCallbacks = {
  onSubmitted: async (id: string, txHash: string) => {
    await pendingTxQueries.updateTxStatus(id, {
      status: "SUBMITTED",
      txHash,
      submittedAt: new Date(),
    });
  },

  onConfirmed: async (id: string, result: TxResult) => {
    await pendingTxQueries.updateTxStatus(id, {
      status: result.status === "CONFIRMED" ? "CONFIRMED" : "FAILED",
      confirmedAt: new Date(),
      blockNumber: result.blockNumber ?? null,
      gasUsed: result.gasUsed?.toString() ?? null,
      gasCostEth: result.gasCostEth ?? null,
      errorMessage: result.errorMessage ?? null,
    });

    // Fetch the full pending tx record to get type and agentId
    const ptx = await pendingTxQueries.getTxByHash(result.txHash ?? "");
    if (!ptx) return;

    if (result.status === "CONFIRMED") {
      await processConfirmedTransaction(ptx);
    } else {
      await processFailedTransaction(ptx, result.errorMessage ?? "Transaction reverted");
    }
  },

  onFailed: async (id: string, error: string) => {
    await pendingTxQueries.updateTxStatus(id, {
      status: "FAILED",
      errorMessage: error,
    });
    // Look up the pending tx to get agentId
    const allSubmitted = await pendingTxQueries.getUnconfirmedTxs();
    const ptx = allSubmitted.find((t) => t.id === id);
    // Also try direct DB lookup
    const [row] = await db
      .select()
      .from(schema.pendingTransactions)
      .where(eq(schema.pendingTransactions.id, id));
    if (row) {
      await processFailedTransaction(row, error);
    }
  },
};

// ---------------------------------------------------------------------------
// Process confirmed transaction
// ---------------------------------------------------------------------------

interface PendingTxRow {
  id: string;
  agentId: string;
  type: string;
  txHash: string | null;
  txData: unknown;
}

async function processConfirmedTransaction(ptx: PendingTxRow) {
  // Set agent back to IDLE (with 1-tick cooldown)
  const cooldownMs = 15_000; // ~1 tick
  const cooldownUntil = new Date(Date.now() + cooldownMs);
  await agentQueries.setAgentCooldown(ptx.agentId, cooldownUntil);

  // Get agent for personality context
  const agent = await agentQueries.getAgentById(ptx.agentId);
  if (!agent) return;

  const txData = ptx.txData as Record<string, string>;

  switch (ptx.type) {
    case "CREATE_TOKEN":
      await handleCreateTokenConfirmed(agent, txData);
      break;
    case "BUY":
      await handleBuyConfirmed(agent, txData);
      break;
    case "SELL":
      await handleSellConfirmed(agent, txData);
      break;
    // APPROVE doesn't need special handling
  }

  // Refresh agent ETH balance from chain
  if (agent.walletAddress) {
    try {
      const { getAgentEthBalance } = await import("@degenscreener/blockchain");
      await getAgentEthBalance(ptx.agentId);
    } catch { /* non-critical */ }
  }
}

// ---------------------------------------------------------------------------
// Type-specific confirmed handlers
// ---------------------------------------------------------------------------

async function handleCreateTokenConfirmed(
  agent: { id: string; personality: string; tokensLaunched: number },
  txData: Record<string, string>,
) {
  // Update agent stats
  await db
    .update(schema.agents)
    .set({ tokensLaunched: agent.tokensLaunched + 1 })
    .where(eq(schema.agents.id, agent.id));

  // Generate launch tweet
  await generateTweet(agent.id, {
    personality: agent.personality as Personality,
    trigger: "LAUNCH" as TweetTrigger,
    ticker: txData.symbol,
  });
}

async function handleBuyConfirmed(
  agent: { id: string; personality: string; ownerId: string; name: string; totalVolume: string },
  txData: Record<string, string>,
) {
  // Look up token by address for tweet context
  let ticker: string | undefined;
  if (txData.tokenAddress) {
    const [token] = await db
      .select()
      .from(schema.tokens)
      .where(eq(schema.tokens.contractAddress, txData.tokenAddress));
    ticker = token?.ticker;
  }

  // FIRST_TRADE notification (if total volume was 0 before this trade)
  if (Number(agent.totalVolume) === 0 && ticker) {
    try {
      await notificationQueries.createNotification({
        userId: agent.ownerId,
        type: "FIRST_TRADE",
        title: "First Trade!",
        message: `${agent.name} just made its first trade! Bought $${ticker} on the bonding curve.`,
      });
    } catch { /* non-critical */ }
  }

  // 30% chance of buy tweet
  if (Math.random() < 0.3) {
    await generateTweet(agent.id, {
      personality: agent.personality as Personality,
      trigger: "BUY" as TweetTrigger,
      ticker,
    });
  }
}

async function handleSellConfirmed(
  agent: { id: string; personality: string },
  txData: Record<string, string>,
) {
  let ticker: string | undefined;
  if (txData.tokenAddress) {
    const [token] = await db
      .select()
      .from(schema.tokens)
      .where(eq(schema.tokens.contractAddress, txData.tokenAddress));
    ticker = token?.ticker;
  }

  // 30% chance of sell tweet
  if (Math.random() < 0.3) {
    await generateTweet(agent.id, {
      personality: agent.personality as Personality,
      trigger: "SELL" as TweetTrigger,
      ticker,
    });
  }
}

// ---------------------------------------------------------------------------
// Process failed transaction
// ---------------------------------------------------------------------------

async function processFailedTransaction(
  ptx: PendingTxRow,
  error: string,
) {
  // Set agent back to IDLE
  await agentQueries.setAgentIdle(ptx.agentId);

  console.warn(
    `[tx-handler] TX failed for agent ${ptx.agentId}: ${ptx.type} — ${error}`,
  );

  // Send TX_FAILED notification to owner
  const agent = await agentQueries.getAgentById(ptx.agentId);
  if (agent) {
    try {
      const notif = await notificationQueries.createNotification({
        userId: agent.ownerId,
        type: "TX_FAILED",
        title: "Transaction Failed",
        message: `A ${ptx.type} transaction for ${agent.name} failed: ${error.slice(0, 100)}. No funds lost.`,
      });
      const [owner] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, agent.ownerId));
      if (owner) {
        await publishNotification(owner.walletAddress, {
          notificationId: notif.id,
          type: "TX_FAILED",
          title: notif.title,
          message: notif.message,
        });
      }
    } catch { /* non-critical */ }
  }
}

// ---------------------------------------------------------------------------
// Sweep: check all SUBMITTED transactions for confirmations
// ---------------------------------------------------------------------------

export async function sweepPendingTransactions() {
  const unconfirmed = await pendingTxQueries.getUnconfirmedTxs();
  if (unconfirmed.length === 0) return;

  const toCheck = unconfirmed
    .filter((tx) => tx.txHash)
    .map((tx) => ({ id: tx.id, txHash: tx.txHash! }));

  if (toCheck.length > 0) {
    await checkPendingConfirmations(toCheck, txPipelineCallbacks);
  }
}
