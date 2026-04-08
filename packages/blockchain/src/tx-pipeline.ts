import { publicClient } from "./provider.js";
import { signAndSend, resetNonce, type SigningRequest } from "./signing-service.js";
import { formatEther } from "viem";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TxSubmission {
  id: string; // pending_transactions.id from DB
  agentId: string;
  privateKey: `0x${string}`;
  to: `0x${string}`;
  value?: bigint;
  data?: `0x${string}`;
  type: string; // e.g. "BUY", "SELL", "GRADUATION"
}

export interface TxResult {
  id: string;
  status: "CONFIRMED" | "FAILED" | "REVERTED";
  txHash?: `0x${string}`;
  blockNumber?: bigint;
  gasUsed?: bigint;
  gasCostEth?: string;
  errorMessage?: string;
}

/**
 * Callback for pipeline consumers to persist TX state changes.
 */
export interface TxPipelineCallbacks {
  onSubmitted: (id: string, txHash: string) => Promise<void>;
  onConfirmed: (id: string, result: TxResult) => Promise<void>;
  onFailed: (id: string, error: string) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const MAX_RETRIES = 3;
const CONFIRMATION_POLL_MS = 2_000;
const CONFIRMATION_TIMEOUT_MS = 120_000; // 2 minutes
const RETRY_BASE_DELAY_MS = 2_000;

// ---------------------------------------------------------------------------
// Submit a single transaction
// ---------------------------------------------------------------------------

/**
 * Submit a transaction: sign, send, and return the hash.
 * Does NOT wait for confirmation.
 */
export async function submitTransaction(
  tx: TxSubmission,
  callbacks: TxPipelineCallbacks,
): Promise<`0x${string}` | null> {
  const req: SigningRequest = {
    agentId: tx.agentId,
    privateKey: tx.privateKey,
    to: tx.to,
    value: tx.value,
    data: tx.data,
  };

  let lastError = "";

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await signAndSend(req);
      await callbacks.onSubmitted(tx.id, result.hash);
      return result.hash;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);

      // Non-retryable errors
      if (lastError.includes("Rate limit exceeded")) {
        break;
      }
      if (lastError.includes("insufficient funds")) {
        break;
      }
      if (lastError.includes("execution reverted")) {
        break;
      }

      // Nonce error — reset and retry immediately
      if (lastError.includes("nonce") && lastError.includes("too low")) {
        resetNonce(tx.to); // will re-fetch on next attempt
        continue;
      }

      // Exponential backoff for transient errors
      if (attempt < MAX_RETRIES) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        await sleep(delay);
      }
    }
  }

  await callbacks.onFailed(tx.id, lastError);
  return null;
}

// ---------------------------------------------------------------------------
// Confirm a submitted transaction
// ---------------------------------------------------------------------------

/**
 * Wait for a transaction to be confirmed on-chain.
 * Returns the receipt details or a failure.
 */
export async function waitForConfirmation(
  id: string,
  txHash: `0x${string}`,
  callbacks: TxPipelineCallbacks,
): Promise<TxResult> {
  const startTime = Date.now();

  while (Date.now() - startTime < CONFIRMATION_TIMEOUT_MS) {
    try {
      const receipt = await publicClient.getTransactionReceipt({
        hash: txHash,
      });

      if (receipt) {
        const gasUsed = receipt.gasUsed;
        const effectiveGasPrice = receipt.effectiveGasPrice;
        const gasCost = gasUsed * effectiveGasPrice;

        const result: TxResult = {
          id,
          status: receipt.status === "success" ? "CONFIRMED" : "REVERTED",
          txHash,
          blockNumber: receipt.blockNumber,
          gasUsed,
          gasCostEth: formatEther(gasCost),
          errorMessage:
            receipt.status !== "success" ? "Transaction reverted" : undefined,
        };

        await callbacks.onConfirmed(id, result);
        return result;
      }
    } catch {
      // Receipt not available yet — keep polling
    }

    await sleep(CONFIRMATION_POLL_MS);
  }

  // Timeout
  const result: TxResult = {
    id,
    status: "FAILED",
    txHash,
    errorMessage: `Confirmation timeout after ${CONFIRMATION_TIMEOUT_MS}ms`,
  };
  await callbacks.onFailed(id, result.errorMessage!);
  return result;
}

// ---------------------------------------------------------------------------
// Full pipeline: submit + confirm
// ---------------------------------------------------------------------------

/**
 * Submit a transaction and wait for confirmation.
 * Handles retries for submission, polls for receipt.
 */
export async function submitAndConfirm(
  tx: TxSubmission,
  callbacks: TxPipelineCallbacks,
): Promise<TxResult> {
  const txHash = await submitTransaction(tx, callbacks);

  if (!txHash) {
    return {
      id: tx.id,
      status: "FAILED",
      errorMessage: "Submission failed after retries",
    };
  }

  return waitForConfirmation(tx.id, txHash, callbacks);
}

// ---------------------------------------------------------------------------
// Batch confirmation tracker
// ---------------------------------------------------------------------------

/**
 * Check confirmation status for a batch of submitted transactions.
 * Useful for periodic sweeps of SUBMITTED transactions.
 */
export async function checkPendingConfirmations(
  pendingTxs: Array<{ id: string; txHash: string }>,
  callbacks: TxPipelineCallbacks,
): Promise<TxResult[]> {
  const results: TxResult[] = [];

  for (const ptx of pendingTxs) {
    try {
      const receipt = await publicClient.getTransactionReceipt({
        hash: ptx.txHash as `0x${string}`,
      });

      if (receipt) {
        const gasUsed = receipt.gasUsed;
        const effectiveGasPrice = receipt.effectiveGasPrice;
        const gasCost = gasUsed * effectiveGasPrice;

        const result: TxResult = {
          id: ptx.id,
          status: receipt.status === "success" ? "CONFIRMED" : "REVERTED",
          txHash: ptx.txHash as `0x${string}`,
          blockNumber: receipt.blockNumber,
          gasUsed,
          gasCostEth: formatEther(gasCost),
          errorMessage:
            receipt.status !== "success" ? "Transaction reverted" : undefined,
        };

        await callbacks.onConfirmed(ptx.id, result);
        results.push(result);
      }
      // If no receipt yet, skip — still pending
    } catch {
      // Skip individual failures
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
