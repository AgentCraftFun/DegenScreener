"use client";
import { useReadContract } from "wagmi";
import { parseAbi, formatEther } from "viem";

const BONDING_CURVE_ABI = parseAbi([
  "function curves(address token) external view returns (uint256 virtualEth, uint256 virtualToken, uint256 realEthReserve, uint256 realTokenReserve, bool graduated, address creator, uint256 k)",
  "function graduationThreshold() external view returns (uint256)",
]);

interface Props {
  tokenAddress: `0x${string}`;
  bondingCurveAddress: `0x${string}`;
  phase: string;
}

export function GraduationProgress({ tokenAddress, bondingCurveAddress, phase }: Props) {
  const { data: curveData } = useReadContract({
    address: bondingCurveAddress,
    abi: BONDING_CURVE_ABI,
    functionName: "curves",
    args: [tokenAddress],
    query: { refetchInterval: 15_000 },
  });

  const { data: thresholdRaw } = useReadContract({
    address: bondingCurveAddress,
    abi: BONDING_CURVE_ABI,
    functionName: "graduationThreshold",
    query: { refetchInterval: 60_000 },
  });

  if (phase === "GRADUATED") {
    return (
      <div className="p-4 border-t border-border-primary">
        <div className="flex items-center gap-2">
          <span className="text-lg">&#127891;</span>
          <span className="text-accent-green text-[12px] font-semibold text-glow-green">
            Graduated — Now Trading on Uniswap
          </span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-accent-green/20 overflow-hidden">
          <div className="h-full bg-accent-green rounded-full shadow-[0_0_8px_rgba(0,255,65,0.6)]" style={{ width: "100%" }} />
        </div>
      </div>
    );
  }

  const curve = curveData as [bigint, bigint, bigint, bigint, boolean, string, bigint] | undefined;
  const threshold = thresholdRaw as bigint | undefined;

  if (!curve || !threshold || threshold === 0n) {
    return (
      <div className="p-4 border-t border-border-primary">
        <div className="text-[10px] uppercase tracking-wider text-text-muted mb-2">
          Graduation Progress
        </div>
        <div className="h-2 rounded-full bg-bg-primary border border-border-primary overflow-hidden">
          <div className="h-full bg-accent-green/30 rounded-full" style={{ width: "0%" }} />
        </div>
        <div className="text-[10px] text-text-muted mt-1">Loading...</div>
      </div>
    );
  }

  const realEthReserve = curve[2];
  const graduated = curve[4];

  if (graduated) {
    return (
      <div className="p-4 border-t border-border-primary">
        <div className="flex items-center gap-2">
          <span className="text-lg">&#127891;</span>
          <span className="text-accent-green text-[12px] font-semibold text-glow-green">
            Graduated — Now Trading on Uniswap
          </span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-accent-green/20 overflow-hidden">
          <div className="h-full bg-accent-green rounded-full shadow-[0_0_8px_rgba(0,255,65,0.6)]" style={{ width: "100%" }} />
        </div>
      </div>
    );
  }

  const currentEth = parseFloat(formatEther(realEthReserve));
  const thresholdEth = parseFloat(formatEther(threshold));
  const pct = thresholdEth > 0 ? Math.min((currentEth / thresholdEth) * 100, 100) : 0;

  return (
    <div className="p-4 border-t border-border-primary">
      <div className="text-[10px] uppercase tracking-wider text-text-muted mb-2">
        Graduation Progress
      </div>
      <div className="h-2 rounded-full bg-bg-primary border border-border-primary overflow-hidden">
        <div
          className="h-full bg-accent-green rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(0,255,65,0.4)]"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <div className="text-[11px] font-mono text-text-primary">
          {currentEth.toFixed(4)} / {thresholdEth.toFixed(1)} ETH
        </div>
        <div className="text-[11px] font-mono text-accent-green">
          {pct.toFixed(1)}%
        </div>
      </div>
    </div>
  );
}
