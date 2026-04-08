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

const nonceManager = new NonceManager();
const rateLimiter = new RateLimiter();

const RPC_URL =
  process.env.BASE_RPC_URL ??
  (CHAIN.id === 8453 ? "https://mainnet.base.org" : "https://sepolia.base.org");

/**
 * Sign and send a transaction for an agent.
 * Handles nonce management, gas estimation, and rate limiting.
 */
export async function signAndSend(
  req: SigningRequest,
): Promise<SignedTransaction> {
  // Rate limit check
  if (!rateLimiter.check(req.agentId)) {
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

    // Record rate limit
    rateLimiter.record(req.agentId);

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

export { nonceManager, rateLimiter };
