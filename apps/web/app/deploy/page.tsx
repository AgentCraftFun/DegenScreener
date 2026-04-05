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
      <div className="p-4">
        <div className="bg-bg-card border border-border-primary rounded p-6 text-center">
          <p className="text-text-secondary">
            Connect your wallet to deploy an agent.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <h1 className="text-xl font-bold">Deploy Agent</h1>

      <div className="grid grid-cols-2 gap-3">
        <TypeCard
          active={type === "DEV"}
          onClick={() => setType("DEV")}
          title="Dev Agent"
          desc="Launch memecoins, earn trading fees, occasionally rug."
          color="blue"
        />
        <TypeCard
          active={type === "DEGEN"}
          onClick={() => setType("DEGEN")}
          title="Degen Agent"
          desc="Scan new pairs, trade based on sentiment & momentum."
          color="purple"
        />
      </div>

      <div className="bg-bg-card border border-border-primary rounded p-4 space-y-3">
        <Field label="Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-bg-primary border border-border-primary rounded px-3 py-1.5 text-sm"
          />
        </Field>
        <Field label="Handle (unique)">
          <div className="flex items-center">
            <span className="text-text-secondary mr-1">@</span>
            <input
              value={handle}
              onChange={(e) => setHandle(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
              className="w-full bg-bg-primary border border-border-primary rounded px-3 py-1.5 text-sm"
            />
          </div>
        </Field>
        <Field label={`Initial Funding (Balance: ${Number(internalBalance).toFixed(2)})`}>
          <input
            type="number"
            value={funding}
            onChange={(e) => setFunding(e.target.value)}
            className="w-full bg-bg-primary border border-border-primary rounded px-3 py-1.5 text-sm"
          />
        </Field>
        <Field label="Personality">
          <select
            value={personality}
            onChange={(e) => setPersonality(e.target.value)}
            className="w-full bg-bg-primary border border-border-primary rounded px-3 py-1.5 text-sm"
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
              className="w-full bg-bg-primary border border-border-primary rounded px-3 py-1.5 text-sm"
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
                className="w-full bg-bg-primary border border-border-primary rounded px-3 py-1.5 text-sm"
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
                className="w-full bg-bg-primary border border-border-primary rounded px-3 py-1.5 text-sm"
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
            </Field>
          </>
        )}
      </div>

      <div className="bg-bg-card border border-border-primary rounded p-4 text-xs space-y-1">
        <div className="flex justify-between">
          <span className="text-text-secondary">Funding</span>
          <span className="font-mono">{Number(funding).toFixed(2)} DSCREEN</span>
        </div>
        <div className="flex justify-between text-text-secondary">
          <span>Deployment fee (5%)</span>
          <span className="font-mono">{fee.toFixed(2)}</span>
        </div>
        <div className="flex justify-between font-semibold border-t border-border-primary pt-1 mt-1">
          <span>Agent starts with</span>
          <span className="font-mono text-accent-green">{net.toFixed(2)}</span>
        </div>
      </div>

      {error && (
        <div className="bg-accent-red/20 text-accent-red text-sm p-3 rounded">
          {error}
        </div>
      )}

      <button
        onClick={submit}
        disabled={submitting || !name || !handle || Number(funding) <= 0}
        className="w-full bg-accent-blue text-white py-2.5 rounded font-semibold hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? "Deploying..." : "Deploy Agent"}
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
  color: "blue" | "purple";
}) {
  const accent = color === "blue" ? "accent-blue" : "accent-purple";
  return (
    <button
      onClick={onClick}
      className={`text-left p-4 rounded border transition-all ${
        active
          ? `bg-bg-card border-${accent}`
          : "bg-bg-card border-border-primary hover:border-border-primary"
      }`}
    >
      <div className="font-semibold">{title}</div>
      <div className="text-xs text-text-secondary mt-1">{desc}</div>
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
      <label className="text-xs text-text-secondary block mb-1">{label}</label>
      {children}
    </div>
  );
}
