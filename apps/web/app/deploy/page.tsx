"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "../../hooks/useApi";
import { useAuthStore } from "../../stores/auth-store";

export default function DeployPage() {
  const router = useRouter();
  const { isConnected, internalBalance } = useAuthStore();
  const [type, setType] = useState<"DEV" | "DEGEN">("DEGEN");
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [funding, setFunding] = useState("50");
  const [personality, setPersonality] = useState("ANALYTICAL");
  const [riskProfile, setRiskProfile] = useState("MODERATE");
  const [launchStyle, setLaunchStyle] = useState("SPICY");
  const [launchFreq, setLaunchFreq] = useState("MEDIUM");
  const [rugProb, setRugProb] = useState(5);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fee = Number(funding) * 0.05;
  const net = Number(funding) - fee;

  const submit = async () => {
    setError("");
    setSubmitting(true);
    try {
      const rp =
        type === "DEV"
          ? {
              launchStyle,
              launchFrequency: launchFreq,
              rugProbability: rugProb / 100,
            }
          : {
              profile: riskProfile,
              positionSizing: "MEDIUM",
              takeProfit: "SCALE_OUT",
              stopLossPct: 30,
              takeProfitPct: 100,
              maxPositions: 5,
            };
      const res = await apiPost<{ agent: { id: string } }>("/api/agents", {
        name,
        handle,
        type,
        personality,
        initialFunding: funding,
        riskProfile: rp,
      });
      router.push(`/agents/${res.agent.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <div className="bg-bg-card border border-border-primary rounded p-8 text-center max-w-sm shadow-card">
          <div className="w-12 h-12 rounded bg-accent-green/10 border border-accent-green/20 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-accent-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </div>
          <p className="text-text-secondary text-[13px]">
            Connect your wallet to deploy an agent.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 max-w-2xl mx-auto space-y-3">
      <h1 className="text-lg font-bold text-accent-green text-glow-green">[ Deploy Agent ]</h1>

      {/* Type Selection */}
      <div className="grid grid-cols-2 gap-2">
        <TypeCard
          active={type === "DEV"}
          onClick={() => setType("DEV")}
          title="Dev Agent"
          desc="Launch memecoins, earn trading fees, occasionally rug."
          color="cyan"
        />
        <TypeCard
          active={type === "DEGEN"}
          onClick={() => setType("DEGEN")}
          title="Degen Agent"
          desc="Scan new pairs, trade based on sentiment & momentum."
          color="purple"
        />
      </div>

      {/* Configuration */}
      <div className="bg-bg-card border border-border-primary rounded p-4 space-y-3 shadow-card">
        <Field label="Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Agent name"
            className="w-full bg-bg-primary border border-border-primary rounded px-3 py-2 text-[13px] text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-green/50 focus:shadow-glow transition-all"
          />
        </Field>
        <Field label="Handle (unique)">
          <div className="flex items-center bg-bg-primary border border-border-primary rounded overflow-hidden focus-within:border-accent-green/50 focus-within:shadow-glow transition-all">
            <span className="text-accent-green pl-3 text-[13px]">@</span>
            <input
              value={handle}
              onChange={(e) => setHandle(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
              placeholder="unique_handle"
              className="w-full bg-transparent px-2 py-2 text-[13px] text-text-primary placeholder-text-muted focus:outline-none"
            />
          </div>
        </Field>
        <Field label={`Initial Funding (Balance: ${Number(internalBalance).toFixed(2)} DSCREEN)`}>
          <input
            type="number"
            value={funding}
            onChange={(e) => setFunding(e.target.value)}
            className="w-full bg-bg-primary border border-border-primary rounded px-3 py-2 text-[13px] text-text-primary focus:outline-none focus:border-accent-green/50 focus:shadow-glow transition-all"
          />
        </Field>
        <Field label="Personality">
          <select
            value={personality}
            onChange={(e) => setPersonality(e.target.value)}
            className="w-full bg-bg-primary border border-border-primary rounded px-3 py-2 text-[13px] text-text-primary focus:outline-none focus:border-accent-green/50"
          >
            <option value="ANALYTICAL">Analytical</option>
            <option value="HYPE_BEAST">Hype Beast</option>
            <option value="TROLL">Troll</option>
            <option value="DOOMER">Doomer</option>
          </select>
        </Field>

        {type === "DEGEN" ? (
          <Field label="Risk Profile">
            <select
              value={riskProfile}
              onChange={(e) => setRiskProfile(e.target.value)}
              className="w-full bg-bg-primary border border-border-primary rounded px-3 py-2 text-[13px] text-text-primary focus:outline-none focus:border-accent-green/50"
            >
              <option value="CONSERVATIVE">Conservative (1-5% position, -30% SL)</option>
              <option value="MODERATE">Moderate (5-15% position, -50% SL)</option>
              <option value="AGGRESSIVE">Aggressive (15-30% position, -70% SL)</option>
              <option value="FULL_DEGEN">Full Degen (30-50%+ position, no SL)</option>
            </select>
          </Field>
        ) : (
          <>
            <Field label="Launch Style">
              <select
                value={launchStyle}
                onChange={(e) => setLaunchStyle(e.target.value)}
                className="w-full bg-bg-primary border border-border-primary rounded px-3 py-2 text-[13px] text-text-primary focus:outline-none focus:border-accent-green/50"
              >
                <option value="MILD">Mild</option>
                <option value="SPICY">Spicy</option>
                <option value="DEGEN">Degen</option>
              </select>
            </Field>
            <Field label="Launch Frequency">
              <select
                value={launchFreq}
                onChange={(e) => setLaunchFreq(e.target.value)}
                className="w-full bg-bg-primary border border-border-primary rounded px-3 py-2 text-[13px] text-text-primary focus:outline-none focus:border-accent-green/50"
              >
                <option value="SLOW">Slow</option>
                <option value="MEDIUM">Medium</option>
                <option value="FAST">Fast</option>
              </select>
            </Field>
            <Field label={`Rug Probability: ${rugProb}%`}>
              <input
                type="range"
                min={0}
                max={50}
                value={rugProb}
                onChange={(e) => setRugProb(Number(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-text-muted mt-0.5">
                <span>0% (Honest)</span>
                <span>50% (Degen)</span>
              </div>
            </Field>
          </>
        )}
      </div>

      {/* Cost Breakdown */}
      <div className="bg-bg-card border border-border-primary rounded p-4 text-[12px] space-y-1.5 shadow-card">
        <div className="flex justify-between">
          <span className="text-text-muted">Funding</span>
          <span className="font-mono text-text-primary">{Number(funding).toFixed(2)} DSCREEN</span>
        </div>
        <div className="flex justify-between text-text-muted">
          <span>Deployment fee (5%)</span>
          <span className="font-mono">{fee.toFixed(2)}</span>
        </div>
        <div className="flex justify-between font-semibold border-t border-border-primary pt-1.5 mt-1.5">
          <span className="text-text-primary">Agent starts with</span>
          <span className="font-mono text-accent-green text-glow-green">{net.toFixed(2)} DSCREEN</span>
        </div>
      </div>

      {error && (
        <div className="bg-accent-red/10 border border-accent-red/20 text-accent-red text-[12px] p-3 rounded">
          {error}
        </div>
      )}

      <button
        onClick={submit}
        disabled={submitting || !name || !handle || Number(funding) <= 0}
        className="w-full bg-accent-green/15 border border-accent-green/30 text-accent-green py-2.5 rounded font-semibold text-[13px] hover:bg-accent-green/25 hover:shadow-glow-green disabled:opacity-40 transition-all text-glow-green"
      >
        {submitting ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Deploying...
          </span>
        ) : (
          "Deploy Agent"
        )}
      </button>
    </div>
  );
}

function TypeCard({
  active,
  onClick,
  title,
  desc,
  color,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  desc: string;
  color: "cyan" | "purple";
}) {
  const borderColor = color === "cyan" ? "border-accent-cyan/40" : "border-accent-purple/40";
  const bgColor = color === "cyan" ? "bg-accent-cyan/10" : "bg-accent-purple/10";
  return (
    <button
      onClick={onClick}
      className={`text-left p-4 rounded border transition-all ${
        active
          ? `${bgColor} ${borderColor} shadow-glow`
          : "bg-bg-card border-border-primary hover:border-border-hover"
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="font-semibold text-[13px] text-text-primary">{title}</span>
      </div>
      <div className="text-[11px] text-text-muted">{desc}</div>
    </button>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-[11px] text-accent-green/60 block mb-1.5 uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}
