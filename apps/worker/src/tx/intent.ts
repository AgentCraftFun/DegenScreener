import {
  publicClient,
  getAgentPrivateKey,
  signAndSend,
  buildCreateTokenTx,
  buildBuyTx,
  buildSellTx,
  buildApproveTx,
  getDeployFee,
  getTokenAllowance,
  estimateTxCost,
  type SigningRequest,
} from "@degenscreener/blockchain";
import {
  db,
  schema,
  agentQueries,
  pendingTxQueries,
} from "@degenscreener/db";
import { eq } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TradeIntent {
  agentId: string;
  type: "CREATE_TOKEN" | "BUY" | "SELL" | "APPROVE";
  tokenAddress?: `0x${string}`;
  ethAmount?: bigint;
  tokenAmount?: bigint;
  params?: {
    name?: string;
    symbol?: string;
    spender?: `0x${string}`;
  };
}

export interface IntentResult {
  success: boolean;
  pendingTxId?: string;
  txHash?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Safety checks
// ---------------------------------------------------------------------------

const MIN_ETH_FOR_GAS = 500_000_000_000_000n; // 0.0005 ETH

/** Maximum single trade size: 50% of agent's ETH balance */
const MAX_TRADE_SIZE_PCT = 50n; // percent

function checkMaxTradeSize(
  ethAmount: bigint,
  balance: bigint,
): { safe: boolean; reason?: string } {
  const maxAllowed = (balance * MAX_TRADE_SIZE_PCT) / 100n;
  if (ethAmount > maxAllowed) {
    const pct = balance > 0n ? Number((ethAmount * 10000n) / balance) / 100 : 100;
    return {
      safe: false,
      reason: `Trade size (${pct.toFixed(1)}% of balance) exceeds max ${MAX_TRADE_SIZE_PCT}% per trade`,
    };
  }
  return { safe: true };
}

/** Gas cost can't exceed 10% of trade value */
async function checkGasSafety(
  txValue: bigint,
  txRequest: { to: `0x${string}`; data: `0x${string}`; value: bigint },
): Promise<{ safe: boolean; reason?: string }> {
  try {
    const cost = await estimateTxCost(txRequest as any);
    const gasCostWei = BigInt(Math.ceil(parseFloat(cost.estimatedCostEth) * 1e18));
    if (txValue > 0n && gasCostWei > txValue / 10n) {
      return { safe: false, reason: `Gas cost (${cost.estimatedCostEth} ETH) exceeds 10% of trade value` };
    }
    return { safe: true };
  } catch {
    // If we can't estimate gas, let the tx through and let it fail naturally
    return { safe: true };
  }
}

// ---------------------------------------------------------------------------
// Execute intent
// ---------------------------------------------------------------------------

export async function executeIntent(intent: TradeIntent): Promise<IntentResult> {
  // 1. Verify agent is IDLE
  const ready = await agentQueries.isAgentReady(intent.agentId);
  if (!ready) {
    return { success: false, error: "Agent not ready (TX_PENDING or COOLDOWN)" };
  }

  // 2. Get agent private key
  const privateKey = await getAgentPrivateKey(intent.agentId);
  if (!privateKey) {
    return { success: false, error: "No wallet found for agent" };
  }

  // Get agent wallet address for balance check
  const [agent] = await db
    .select()
    .from(schema.agents)
    .where(eq(schema.agents.id, intent.agentId));
  if (!agent?.walletAddress) {
    return { success: false, error: "Agent has no wallet address" };
  }
  const walletAddress = agent.walletAddress as `0x${string}`;

  // 3. Check on-chain ETH balance
  const balance = await publicClient.getBalance({ address: walletAddress });
  if (balance < MIN_ETH_FOR_GAS) {
    return { success: false, error: `Insufficient ETH for gas: ${balance} wei` };
  }

  // 4. Build transaction based on intent type
  try {
    switch (intent.type) {
      case "CREATE_TOKEN":
        return await executeCreateToken(intent, privateKey, walletAddress, balance);
      case "BUY":
        return await executeBuy(intent, privateKey, walletAddress, balance);
      case "SELL":
        return await executeSell(intent, privateKey, walletAddress, balance);
      case "APPROVE":
        return await executeApprove(intent, privateKey, walletAddress);
      default:
        return { success: false, error: `Unknown intent type: ${intent.type}` };
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, error: msg };
  }
}

// ---------------------------------------------------------------------------
// CREATE_TOKEN intent
// ---------------------------------------------------------------------------

async function executeCreateToken(
  intent: TradeIntent,
  privateKey: `0x${string}`,
  walletAddress: `0x${string}`,
  balance: bigint,
): Promise<IntentResult> {
  const { name, symbol } = intent.params ?? {};
  if (!name || !symbol) {
    return { success: false, error: "CREATE_TOKEN requires name and symbol" };
  }

  const deployFee = await getDeployFee();

  // Max trade size check: deploy fee can't exceed 50% of balance
  const sizeCheck = checkMaxTradeSize(deployFee, balance);
  if (!sizeCheck.safe) {
    return { success: false, error: sizeCheck.reason };
  }

  if (balance < deployFee + MIN_ETH_FOR_GAS) {
    return { success: false, error: `Insufficient ETH: need ${deployFee} + gas` };
  }

  const tx = buildCreateTokenTx(name, symbol, deployFee);

  const gasSafety = await checkGasSafety(deployFee, tx);
  if (!gasSafety.safe) {
    return { success: false, error: gasSafety.reason };
  }

  return await submitAndTrack(intent, privateKey, tx, { name, symbol, deployFee: deployFee.toString() });
}

// ---------------------------------------------------------------------------
// BUY intent
// ---------------------------------------------------------------------------

async function executeBuy(
  intent: TradeIntent,
  privateKey: `0x${string}`,
  walletAddress: `0x${string}`,
  balance: bigint,
): Promise<IntentResult> {
  if (!intent.tokenAddress || !intent.ethAmount) {
    return { success: false, error: "BUY requires tokenAddress and ethAmount" };
  }

  // Max trade size check: no single trade > 50% of balance
  const sizeCheck = checkMaxTradeSize(intent.ethAmount, balance);
  if (!sizeCheck.safe) {
    return { success: false, error: sizeCheck.reason };
  }

  if (balance < intent.ethAmount + MIN_ETH_FOR_GAS) {
    return { success: false, error: `Insufficient ETH for buy + gas` };
  }

  const tx = buildBuyTx(intent.tokenAddress, intent.ethAmount);

  const gasSafety = await checkGasSafety(intent.ethAmount, tx);
  if (!gasSafety.safe) {
    return { success: false, error: gasSafety.reason };
  }

  return await submitAndTrack(intent, privateKey, tx, {
    tokenAddress: intent.tokenAddress,
    ethAmount: intent.ethAmount.toString(),
  });
}

// ---------------------------------------------------------------------------
// SELL intent (two-step: approve if needed, then sell)
// ---------------------------------------------------------------------------

async function executeSell(
  intent: TradeIntent,
  privateKey: `0x${string}`,
  walletAddress: `0x${string}`,
  balance: bigint,
): Promise<IntentResult> {
  if (!intent.tokenAddress || !intent.tokenAmount) {
    return { success: false, error: "SELL requires tokenAddress and tokenAmount" };
  }

  const bondingCurveAddress = process.env.BONDING_CURVE_ADDRESS as `0x${string}`;
  if (!bondingCurveAddress) {
    return { success: false, error: "BONDING_CURVE_ADDRESS not set" };
  }

  // Check allowance
  const allowance = await getTokenAllowance(intent.tokenAddress, walletAddress, bondingCurveAddress);

  if (allowance < intent.tokenAmount) {
    // Need to approve first
    const approveTx = buildApproveTx(
      intent.tokenAddress,
      bondingCurveAddress,
      intent.tokenAmount,
    );

    const approveReq: SigningRequest = {
      agentId: intent.agentId,
      privateKey,
      to: approveTx.to,
      data: approveTx.data,
      value: approveTx.value,
    };

    const approveResult = await signAndSend(approveReq);

    // Wait for approval confirmation (simple polling)
    let confirmed = false;
    for (let i = 0; i < 30; i++) {
      try {
        const receipt = await publicClient.getTransactionReceipt({ hash: approveResult.hash });
        if (receipt && receipt.status === "success") {
          confirmed = true;
          break;
        }
      } catch { /* not mined yet */ }
      await new Promise((r) => setTimeout(r, 2000));
    }

    if (!confirmed) {
      return { success: false, error: "Approve transaction did not confirm in time" };
    }
  }

  // Now submit the sell
  const sellTx = buildSellTx(intent.tokenAddress, intent.tokenAmount);

  return await submitAndTrack(intent, privateKey, sellTx, {
    tokenAddress: intent.tokenAddress,
    tokenAmount: intent.tokenAmount.toString(),
  });
}

// ---------------------------------------------------------------------------
// APPROVE intent
// ---------------------------------------------------------------------------

async function executeApprove(
  intent: TradeIntent,
  privateKey: `0x${string}`,
  walletAddress: `0x${string}`,
): Promise<IntentResult> {
  if (!intent.tokenAddress || !intent.tokenAmount || !intent.params?.spender) {
    return { success: false, error: "APPROVE requires tokenAddress, tokenAmount, and params.spender" };
  }

  const tx = buildApproveTx(intent.tokenAddress, intent.params.spender, intent.tokenAmount);
  return await submitAndTrack(intent, privateKey, tx, {
    tokenAddress: intent.tokenAddress,
    spender: intent.params.spender,
    amount: intent.tokenAmount.toString(),
  });
}

// ---------------------------------------------------------------------------
// Submit transaction and track in DB
// ---------------------------------------------------------------------------

async function submitAndTrack(
  intent: TradeIntent,
  privateKey: `0x${string}`,
  tx: { to: `0x${string}`; data: `0x${string}`; value: bigint },
  metadata: Record<string, string>,
): Promise<IntentResult> {
  // Create pending tx record
  const pendingTx = await pendingTxQueries.createPendingTx({
    agentId: intent.agentId,
    type: intent.type,
    txData: { ...metadata, to: tx.to, data: tx.data, value: tx.value.toString() },
    status: "QUEUED",
  });

  // Set agent to TX_PENDING
  await agentQueries.setAgentTxPending(intent.agentId, pendingTx.id);

  try {
    // Sign and send
    const req: SigningRequest = {
      agentId: intent.agentId,
      privateKey,
      to: tx.to,
      data: tx.data,
      value: tx.value,
    };

    const result = await signAndSend(req);

    // Update pending tx with hash
    await pendingTxQueries.updateTxStatus(pendingTx.id, {
      status: "SUBMITTED",
      txHash: result.hash,
      submittedAt: new Date(),
    });

    return {
      success: true,
      pendingTxId: pendingTx.id,
      txHash: result.hash,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    // Mark as failed
    await pendingTxQueries.updateTxStatus(pendingTx.id, {
      status: "FAILED",
      errorMessage: msg,
    });
    // Set agent back to IDLE
    await agentQueries.setAgentIdle(intent.agentId);
    return { success: false, pendingTxId: pendingTx.id, error: msg };
  }
}
