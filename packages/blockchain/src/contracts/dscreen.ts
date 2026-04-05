import { parseAbi } from "viem";
import abi from "../abi/DScreen.json" with { type: "json" };
import { publicClient, getWalletClient } from "../provider.js";

const CONTRACT_ADDRESS = (process.env.DSCREEN_CONTRACT_ADDRESS ??
  "0x0000000000000000000000000000000000000000") as `0x${string}`;

const DSCREEN_ABI = abi as readonly unknown[];

export async function getBalance(address: string): Promise<bigint> {
  return (await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: DSCREEN_ABI,
    functionName: "balanceOf",
    args: [address as `0x${string}`],
  })) as bigint;
}

export async function sendTokens(
  to: string,
  amountWei: bigint,
): Promise<`0x${string}`> {
  const client = getWalletClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return client.writeContract({
    address: CONTRACT_ADDRESS,
    abi: DSCREEN_ABI,
    functionName: "transfer",
    args: [to as `0x${string}`, amountWei],
  } as any);
}

export async function watchTransfersTo(
  toAddress: string,
  onTransfer: (e: {
    from: string;
    to: string;
    value: bigint;
    txHash: string;
    blockNumber: bigint;
  }) => void,
) {
  const eventAbi = parseAbi([
    "event Transfer(address indexed from, address indexed to, uint256 value)",
  ]);
  return publicClient.watchEvent({
    address: CONTRACT_ADDRESS,
    event: eventAbi[0],
    args: { to: toAddress as `0x${string}` },
    onLogs: (logs) => {
      for (const log of logs) {
        onTransfer({
          from: log.args.from as string,
          to: log.args.to as string,
          value: log.args.value as bigint,
          txHash: log.transactionHash ?? "0x",
          blockNumber: log.blockNumber ?? 0n,
        });
      }
    },
  });
}

export const DSCREEN_ADDRESS = CONTRACT_ADDRESS;
