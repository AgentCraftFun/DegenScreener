import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { formatEther } from "viem";
import { publicClient } from "./provider.js";
import { encryptPrivateKey, decryptPrivateKey } from "./crypto.js";

// Minimal DB interface — avoids hard dependency on @degenscreener/db at compile time.
// The actual functions are injected at runtime via init().
interface WalletStore {
  createWallet: (data: {
    agentId: string;
    address: string;
    encryptedPrivateKey: string;
  }) => Promise<unknown>;
  getWalletByAgentId: (
    agentId: string,
  ) => Promise<{
    address: string;
    encryptedPrivateKey: string;
    ethBalance: string;
  } | null>;
  getWalletByAddress: (
    address: string,
  ) => Promise<{ agentId: string; address: string } | null>;
  updateBalance: (agentId: string, balance: string) => Promise<unknown>;
}

interface AgentStore {
  updateAgentWallet: (
    agentId: string,
    walletAddress: string,
  ) => Promise<unknown>;
}

let walletStore: WalletStore | null = null;
let agentStore: AgentStore | null = null;

/**
 * Initialize wallet manager with DB dependencies.
 * Call once at startup from the worker process.
 */
export function initWalletManager(ws: WalletStore, as: AgentStore) {
  walletStore = ws;
  agentStore = as;
}

function getWalletStore(): WalletStore {
  if (!walletStore) throw new Error("WalletManager not initialized — call initWalletManager()");
  return walletStore;
}

function getAgentStore(): AgentStore {
  if (!agentStore) throw new Error("WalletManager not initialized — call initWalletManager()");
  return agentStore;
}

const MIN_GAS_THRESHOLD = 100_000_000_000_000n; // 0.0001 ETH

/**
 * Create a new Ethereum wallet for an agent.
 * Generates keypair, encrypts private key, stores in DB.
 */
export async function createAgentWallet(agentId: string) {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  const encrypted = encryptPrivateKey(privateKey);

  await getWalletStore().createWallet({
    agentId,
    address: account.address,
    encryptedPrivateKey: encrypted,
  });

  await getAgentStore().updateAgentWallet(agentId, account.address);

  return { address: account.address, agentId };
}

/**
 * Get an agent's wallet address (public info only).
 */
export async function getAgentWallet(agentId: string) {
  const wallet = await getWalletStore().getWalletByAgentId(agentId);
  if (!wallet) return null;
  return { address: wallet.address, agentId };
}

/**
 * Decrypt and return an agent's private key.
 * ONLY call this from the signing service.
 */
export async function getAgentPrivateKey(
  agentId: string,
): Promise<`0x${string}` | null> {
  const wallet = await getWalletStore().getWalletByAgentId(agentId);
  if (!wallet) return null;
  const pk = decryptPrivateKey(wallet.encryptedPrivateKey);
  return pk as `0x${string}`;
}

/**
 * Read on-chain ETH balance and update cached value in DB.
 */
export async function getAgentEthBalance(agentId: string): Promise<string> {
  const wallet = await getWalletStore().getWalletByAgentId(agentId);
  if (!wallet) throw new Error(`No wallet for agent ${agentId}`);

  const balance = await publicClient.getBalance({
    address: wallet.address as `0x${string}`,
  });
  const balanceStr = formatEther(balance);

  await getWalletStore().updateBalance(agentId, balanceStr);
  return balanceStr;
}

/**
 * Batch refresh all agent wallet balances from chain.
 */
export async function refreshAllBalances(
  getAllWallets: () => Promise<Array<{ agentId: string; address: string }>>,
) {
  const wallets = await getAllWallets();
  for (const w of wallets) {
    try {
      const balance = await publicClient.getBalance({
        address: w.address as `0x${string}`,
      });
      await getWalletStore().updateBalance(w.agentId, formatEther(balance));
    } catch {
      // skip individual failures
    }
  }
}

/**
 * Check if an agent's wallet is below minimum gas threshold.
 */
export async function isAgentBroke(agentId: string): Promise<boolean> {
  const wallet = await getWalletStore().getWalletByAgentId(agentId);
  if (!wallet) return true;

  const balance = await publicClient.getBalance({
    address: wallet.address as `0x${string}`,
  });
  return balance < MIN_GAS_THRESHOLD;
}
