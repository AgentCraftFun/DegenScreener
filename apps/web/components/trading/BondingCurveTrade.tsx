"use client";
import { useState, useEffect } from "react";
import {
  useAccount,
  useBalance,
  useConnect,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
} from "wagmi";
import { injected } from "wagmi/connectors";
import { parseEther, formatEther, parseAbi } from "viem";

const BONDING_CURVE_ABI = parseAbi([
  "function buy(address token) external payable",
  "function sell(address token, uint256 amount) external",
  "function getPrice(address token) external view returns (uint256)",
]);

const ERC20_ABI = parseAbi([
  "function balanceOf(address account) external view returns (uint256)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
]);

interface Props {
  tokenAddress: `0x${string}`;
  bondingCurveAddress: `0x${string}`;
  phase: string;
  uniswapPairAddress?: string;
}

export function BondingCurveTrade({
  tokenAddress,
  bondingCurveAddress,
  phase,
  uniswapPairAddress,
}: Props) {
  const [tab, setTab] = useState<"buy" | "sell">("buy");
  const [buyAmount, setBuyAmount] = useState("");
  const [sellAmount, setSellAmount] = useState("");
  const [txState, setTxState] = useState<"idle" | "pending" | "confirming" | "success" | "error">("idle");

  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { data: ethBalance } = useBalance({ address });

  // Token balance for sell
  const { data: tokenBalanceRaw } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
  const tokenBalance = tokenBalanceRaw ? formatEther(tokenBalanceRaw as bigint) : "0";

  // Allowance check for sell
  const { data: allowanceRaw } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address ? [address, bondingCurveAddress] : undefined,
    query: { enabled: !!address },
  });

  // Buy tx
  const { writeContract: writeBuy, data: buyHash, error: buyError } = useWriteContract();
  const { isLoading: buyConfirming, isSuccess: buySuccess } = useWaitForTransactionReceipt({
    hash: buyHash,
  });

  // Approve tx
  const { writeContract: writeApprove, data: approveHash, error: approveError } = useWriteContract();
  const { isSuccess: approveSuccess } = useWaitForTransactionReceipt({
    hash: approveHash,
  });

  // Sell tx
  const { writeContract: writeSell, data: sellHash, error: sellError } = useWriteContract();
  const { isLoading: sellConfirming, isSuccess: sellSuccess } = useWaitForTransactionReceipt({
    hash: sellHash,
  });

  // Reset state on success
  useEffect(() => {
    if (buySuccess) {
      setTxState("success");
      setBuyAmount("");
      setTimeout(() => setTxState("idle"), 3000);
    }
  }, [buySuccess]);

  useEffect(() => {
    if (sellSuccess) {
      setTxState("success");
      setSellAmount("");
      setTimeout(() => setTxState("idle"), 3000);
    }
  }, [sellSuccess]);

  useEffect(() => {
    if (buyError || sellError || approveError) {
      setTxState("error");
      setTimeout(() => setTxState("idle"), 5000);
    }
  }, [buyError, sellError, approveError]);

  function handleBuy() {
    if (!buyAmount || !isConnected) return;
    setTxState("pending");
    writeBuy({
      address: bondingCurveAddress,
      abi: BONDING_CURVE_ABI,
      functionName: "buy",
      args: [tokenAddress],
      value: parseEther(buyAmount),
    });
  }

  function handleSell() {
    if (!sellAmount || !isConnected) return;
    const amount = parseEther(sellAmount);
    const allowance = (allowanceRaw as bigint) ?? 0n;

    if (allowance < amount) {
      // Need approval first
      setTxState("pending");
      writeApprove({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [bondingCurveAddress, amount],
      });
      return;
    }

    setTxState("pending");
    writeSell({
      address: bondingCurveAddress,
      abi: BONDING_CURVE_ABI,
      functionName: "sell",
      args: [tokenAddress, amount],
    });
  }

  // After approve success, auto-submit sell
  useEffect(() => {
    if (approveSuccess && sellAmount) {
      setTxState("pending");
      writeSell({
        address: bondingCurveAddress,
        abi: BONDING_CURVE_ABI,
        functionName: "sell",
        args: [tokenAddress, parseEther(sellAmount)],
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approveSuccess]);

  if (phase === "GRADUATED") {
    return (
      <div className="p-4 border-t border-border-primary">
        <div className="text-[10px] uppercase tracking-wider text-text-muted mb-3">Trade</div>
        <div className="text-center py-4">
          <div className="text-accent-green text-sm mb-2">Token Graduated</div>
          <p className="text-text-muted text-[11px] mb-3">Now trading on Uniswap</p>
          <a
            href={`https://app.uniswap.org/swap?chain=base_sepolia&outputCurrency=${tokenAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block py-2 px-4 rounded text-[12px] font-semibold bg-accent-green/10 text-accent-green hover:bg-accent-green/20 transition-colors border border-accent-green/20 hover:shadow-glow-green"
          >
            Trade on Uniswap
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-border-primary">
      {/* Buy/Sell tabs */}
      <div className="flex border-b border-border-primary">
        <button
          onClick={() => setTab("buy")}
          className={`flex-1 py-2 text-[12px] font-semibold transition-colors ${
            tab === "buy"
              ? "text-accent-green bg-accent-green/5 border-b-2 border-accent-green"
              : "text-text-muted hover:text-text-secondary"
          }`}
        >
          Buy
        </button>
        <button
          onClick={() => setTab("sell")}
          className={`flex-1 py-2 text-[12px] font-semibold transition-colors ${
            tab === "sell"
              ? "text-accent-red bg-accent-red/5 border-b-2 border-accent-red"
              : "text-text-muted hover:text-text-secondary"
          }`}
        >
          Sell
        </button>
      </div>

      <div className="p-4">
        {tab === "buy" ? (
          <div className="space-y-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-text-muted block mb-1">
                Amount (ETH)
              </label>
              <input
                type="text"
                value={buyAmount}
                onChange={(e) => setBuyAmount(e.target.value)}
                placeholder="0.01"
                className="w-full px-3 py-2 rounded text-[13px] font-mono bg-bg-primary border border-border-primary text-text-primary placeholder:text-text-muted focus:border-accent-green/50 focus:outline-none focus:shadow-glow transition-all"
              />
              {ethBalance && (
                <div className="text-[10px] text-text-muted mt-1">
                  Balance: {parseFloat(formatEther(ethBalance.value)).toFixed(4)} ETH
                </div>
              )}
            </div>

            <div className="text-[10px] text-text-muted">
              4% fee (3% to creator, 1% to platform)
            </div>

            {!isConnected ? (
              <button
                onClick={() => connect({ connector: injected() })}
                className="w-full py-2.5 rounded text-[12px] font-semibold bg-accent-green/10 text-accent-green hover:bg-accent-green/20 transition-colors border border-accent-green/20 hover:shadow-glow-green"
              >
                Connect Wallet
              </button>
            ) : (
              <button
                onClick={handleBuy}
                disabled={txState !== "idle" || !buyAmount}
                className="w-full py-2.5 rounded text-[12px] font-semibold bg-accent-green/15 text-accent-green hover:bg-accent-green/25 transition-all border border-accent-green/30 hover:shadow-glow-green disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {txState === "pending" || buyConfirming ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    {buyConfirming ? "Confirming..." : "Pending..."}
                  </span>
                ) : txState === "success" ? (
                  "Confirmed!"
                ) : txState === "error" ? (
                  "Failed — Try Again"
                ) : (
                  `Buy with ${buyAmount || "0"} ETH`
                )}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] uppercase tracking-wider text-text-muted">
                  Amount (Tokens)
                </label>
                <button
                  onClick={() => setSellAmount(tokenBalance)}
                  className="text-[10px] text-accent-green hover:text-accent-green/80 transition-colors"
                >
                  Max
                </button>
              </div>
              <input
                type="text"
                value={sellAmount}
                onChange={(e) => setSellAmount(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 rounded text-[13px] font-mono bg-bg-primary border border-border-primary text-text-primary placeholder:text-text-muted focus:border-accent-red/50 focus:outline-none focus:shadow-glow transition-all"
              />
              <div className="text-[10px] text-text-muted mt-1">
                Balance: {parseFloat(tokenBalance).toFixed(4)} tokens
              </div>
            </div>

            <div className="text-[10px] text-text-muted">
              4% fee (3% to creator, 1% to platform)
            </div>

            {!isConnected ? (
              <button
                onClick={() => connect({ connector: injected() })}
                className="w-full py-2.5 rounded text-[12px] font-semibold bg-accent-red/10 text-accent-red hover:bg-accent-red/20 transition-colors border border-accent-red/20 hover:shadow-glow-red"
              >
                Connect Wallet
              </button>
            ) : (
              <button
                onClick={handleSell}
                disabled={txState !== "idle" || !sellAmount}
                className="w-full py-2.5 rounded text-[12px] font-semibold bg-accent-red/15 text-accent-red hover:bg-accent-red/25 transition-all border border-accent-red/30 hover:shadow-glow-red disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {txState === "pending" || sellConfirming ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    {sellConfirming ? "Confirming..." : "Pending..."}
                  </span>
                ) : txState === "success" ? (
                  "Confirmed!"
                ) : txState === "error" ? (
                  "Failed — Try Again"
                ) : (
                  "Sell Tokens"
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
