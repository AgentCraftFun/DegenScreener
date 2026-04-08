import {
  createWalletClient,
  http,
  type TransactionRequest,
  type SendTransactionParameters,
  formatEther,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { publicClient, CHAIN } from "./provider.js";

// ---------------------------------------------------------------------------
// Async Mutex — simple promise-based lock per wallet
// ---------------------------------------------------------------------------

class AsyncMutex {
  private queue: Array<() => void> = [];
  private locked = false;

  async acquire(): Promise<void> {
    if (!this.locked) {
      this.locked = true;
      return;
    }
    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    const next = this.queue.shift();
    if (next) {
      next();
    } else {
      this.locked = false;
    }
  }
}

// ---------------------------------------------------------------------------
// NonceManager — per-wallet nonce tracking
// ---------------------------------------------------------------------------

export class NonceManager {
  private nonces = new Map<string, number>();
  private mutexes = new Map<string, AsyncMutex>();

  private getMutex(address: string): AsyncMutex {
    const key = address.toLowerCase();
    let mutex = this.mutexes.get(key);
    if (!mutex) {
      mutex = new AsyncMutex();
      this.mutexes.set(key, mutex);
    }
    return mutex;
  }

  /**
   * Get the next nonce for an address, ensuring sequential access.
   * On first call for an address, fetches from chain.
   * Returns the nonce AND holds the mutex — caller MUST call release().
   */
  async acquire(address: string): Promise<{ nonce: number; release: () => void }> {
    const key = address.toLowerCase();
    const mutex = this.getMutex(key);
    await mutex.acquire();

    let nonce = this.nonces.get(key);
    if (nonce === undefined) {
      // First time — sync from chain
      nonce = await publicClient.getTransactionCount({
        address: address as `0x${string}`,
      });
    }

    this.nonces.set(key, nonce + 1);
    return {
      nonce,
      release: () => mutex.release(),
    };
  }

  /**
   * Reset nonce for an address (e.g. after a nonce-too-low error).
   * Next acquire() will re-fetch from chain.
   */
  reset(address: string): void {
    const key = address.toLowerCase();
    this.nonces.delete(key);
  }

  /**
   * Reset all tracked nonces.
   */
  resetAll(): void {
    this.nonces.clear();
  }
}

// ---------------------------------------------------------------------------
// Rate Limiter — sliding window per agent
// ---------------------------------------------------------------------------

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const MAX_SIGS_PER_WINDOW = 5;

class RateLimiter {
  private windows = new Map<string, number[]>();

  check(agentId: string): boolean {
    const now = Date.now();
    const timestamps = this.windows.get(agentId) ?? [];
    // Remove expired entries
    const valid = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
    this.windows.set(agentId, valid);
    return valid.length < MAX_SIGS_PER_WINDOW;
  }

  record(agentId: string): void {
    const now = Date.now();
    const timestamps = this.windows.get(agentId) ?? [];
    timestamps.push(now);
    this.windows.set(agentId, timestamps);
  }
}

// ---------------------------------------------------------------------------
// Gas Estimator
// ---------------------------------------------------------------------------

const GAS_BUFFER_PERCENT = 20n; // 20% buffer

export async function estimateGasWithBuffer(
  tx: TransactionRequest,
): Promise<bigint> {
  const estimate = await publicClient.estimateGas(tx as any);
  return estimate + (estimate * GAS_BUFFER_PERCENT) / 100n;
}

// ---------------------------------------------------------------------------
// Signing Service
// ---------------------------------------------------------------------------

export interface SignedTransaction {
  hash: `0x${string}`;
  from: `0x${string}`;
  nonce: number;
  gasLimit: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
}

export interface SigningRequest {
  agentId: string;
  privateKey: `0x${string}`;
  to: `0x${string}`;
  value?: bigint;
  data?: `0x${string}`;
}

// ---------------------------------------------------------------------------
// Daily Gas Cap — per agent, resets at midnight UTC
// ---------------------------------------------------------------------------

const DAILY_GAS_CAP_ETH = 0.05; // max 0.05 ETH gas spend per agent per day

class DailyGasTracker {
  private spending = new Map<string, { date: string; totalWei: bigint }>();

  private todayKey(): string {
    return new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
  }

  getSpent(agentId: string): bigint {
    const entry = this.spending.get(agentId);
    if (!entry || entry.date !== this.todayKey()) return 0n;
    return entry.totalWei;
  }

  check(agentId: string, estimatedGasWei: bigint): boolean {
    const spent = this.getSpent(agentId);
    const capWei = BigInt(Math.floor(DAILY_GAS_CAP_ETH * 1e18));
    return spent + estimatedGasWei <= capWei;
  }

  record(agentId: string, gasWei: bigint): void {
    const today = this.todayKey();
    const entry = this.spending.get(agentId);
    if (!entry || entry.date !== today) {
      this.spending.set(agentId, { date: today, totalWei: gasWei });
    } else {
      entry.totalWei += gasWei;
    }
  }
}

// ---------------------------------------------------------------------------
// Audit Logger — logs every signing request (never logs private keys)
// ---------------------------------------------------------------------------

interface AuditEntry {
  timestamp: string;
  agentId: string;
  to: string;
  value: string;
  action: "SUBMITTED" | "FAILED" | "RATE_LIMITED" | "GAS_CAP_EXCEEDED";
  txHash?: string;
  nonce?: number;
  gasLimit?: string;
  estimatedGasCost?: string;
  error?: string;
}

function auditLog(entry: AuditEntry): void {
  // Structured JSON log — never includes private keys
  console.log(`[audit:signing] ${JSON.stringify(entry)}`);
}

const nonceManager = new NonceManager();
const rateLimiter = new RateLimiter();
const dailyGasTracker = new DailyGasTracker();

const RPC_URL =
  process.env.BASE_RPC_URL ??
  (CHAIN.id === 8453 ? "https://mainnet.base.org" : "https://sepolia.base.org");

/**
 * Sign and send a transaction for an agent.
 * Handles nonce management, gas estimation, rate limiting, daily gas cap, and audit logging.
 */
export async function signAndSend(
  req: SigningRequest,
): Promise<SignedTransaction> {
  const auditBase = {
    timestamp: new Date().toISOString(),
    agentId: req.agentId,
    to: req.to,
    value: (req.value ?? 0n).toString(),
  };

  // Rate limit check
  if (!rateLimiter.check(req.agentId)) {
    auditLog({ ...auditBase, action: "RATE_LIMITED" });
    throw new Error(
      `Rate limit exceeded for agent ${req.agentId}: max ${MAX_SIGS_PER_WINDOW} transactions per minute`,
    );
  }

  const account = privateKeyToAccount(req.privateKey);
  const walletClient = createWalletClient({
    account,
    chain: CHAIN,
    transport: http(RPC_URL),
  });

  // Acquire nonce with mutex
  const { nonce, release } = await nonceManager.acquire(account.address);

  try {
    // Estimate gas with buffer
    const txForEstimate = {
      account: account.address,
      to: req.to,
      value: req.value ?? 0n,
      data: req.data,
    };

    const gasLimit = await estimateGasWithBuffer(txForEstimate as any);

    // Get current gas prices
    const feeData = await publicClient.estimateFeesPerGas();
    const maxFeePerGas = feeData.maxFeePerGas ?? 1_000_000_000n;
    const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas ?? 100_000_000n;

    // Daily gas cap check
    const estimatedGasCost = gasLimit * maxFeePerGas;
    if (!dailyGasTracker.check(req.agentId, estimatedGasCost)) {
      auditLog({
        ...auditBase,
        action: "GAS_CAP_EXCEEDED",
        estimatedGasCost: formatEther(estimatedGasCost),
      });
      throw new Error(
        `Daily gas cap exceeded for agent ${req.agentId}: max ${DAILY_GAS_CAP_ETH} ETH/day`,
      );
    }

    // Send transaction
    const hash = await walletClient.sendTransaction({
      to: req.to,
      value: req.value ?? 0n,
      data: req.data,
      nonce,
      gas: gasLimit,
      maxFeePerGas,
      maxPriorityFeePerGas,
    } as any);

    // Record rate limit and gas spend
    rateLimiter.record(req.agentId);
    dailyGasTracker.record(req.agentId, estimatedGasCost);

    auditLog({
      ...auditBase,
      action: "SUBMITTED",
      txHash: hash,
      nonce,
      gasLimit: gasLimit.toString(),
      estimatedGasCost: formatEther(estimatedGasCost),
    });

    return {
      hash,
      from: account.address,
      nonce,
      gasLimit,
      maxFeePerGas,
      maxPriorityFeePerGas,
    };
  } catch (error) {
    // If nonce error, reset for this address so next attempt re-fetches
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("nonce") && msg.includes("too low")) {
      nonceManager.reset(account.address);
    }

    // Audit log the failure (sanitize error to avoid leaking sensitive data)
    const safeError = msg.replace(/0x[a-fA-F0-9]{64}/g, "0x[REDACTED]");
    auditLog({
      ...auditBase,
      action: "FAILED",
      error: safeError.slice(0, 200),
    });

    throw error;
  } finally {
    release();
  }
}

/**
 * Get the estimated cost of a transaction in ETH.
 */
export async function estimateTxCost(
  tx: TransactionRequest,
): Promise<{ gasLimit: bigint; maxFeePerGas: bigint; estimatedCostEth: string }> {
  const gasLimit = await estimateGasWithBuffer(tx as any);
  const feeData = await publicClient.estimateFeesPerGas();
  const maxFeePerGas = feeData.maxFeePerGas ?? 1_000_000_000n;
  const estimatedCost = gasLimit * maxFeePerGas;
  return {
    gasLimit,
    maxFeePerGas,
    estimatedCostEth: formatEther(estimatedCost),
  };
}

/**
 * Reset nonce tracking for a specific wallet (e.g. after manual intervention).
 */
export function resetNonce(address: string): void {
  nonceManager.reset(address);
}

/**
 * Reset all nonce tracking.
 */
export function resetAllNonces(): void {
  nonceManager.resetAll();
}

export { nonceManager, rateLimiter, dailyGasTracker };
