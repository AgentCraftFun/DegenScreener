"use client";
import { useEffect, useRef } from "react";

interface Candle {
  timestamp: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

// Minimal canvas candlestick chart (avoids heavy dependencies).
export function SimpleChart({ candles }: { candles: Candle[] }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || candles.length === 0) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth * dpr;
    const h = canvas.clientHeight * dpr;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#0d1117";
    ctx.fillRect(0, 0, w, h);

    const padding = 40 * dpr;
    const chartH = h * 0.7 - padding;
    const volH = h * 0.25;
    const volTop = h * 0.7;

    const highs = candles.map((c) => Number(c.high));
    const lows = candles.map((c) => Number(c.low));
    const max = Math.max(...highs);
    const min = Math.min(...lows);
    const range = max - min || 1;
    const maxVol = Math.max(...candles.map((c) => Number(c.volume)), 0.001);

    const cw = (w - padding * 2) / candles.length;
    const bw = cw * 0.7;

    // Grid lines
    ctx.strokeStyle = "#1e2937";
    ctx.lineWidth = 1 * dpr;
    for (let i = 0; i <= 4; i++) {
      const y = padding + (chartH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(w - padding, y);
      ctx.stroke();
    }

    // Axis labels
    ctx.fillStyle = "#8b949e";
    ctx.font = `${10 * dpr}px monospace`;
    for (let i = 0; i <= 4; i++) {
      const price = max - (range / 4) * i;
      const y = padding + (chartH / 4) * i;
      const label = price < 0.01 ? price.toExponential(2) : price.toFixed(4);
      ctx.fillText(label, 2, y + 4 * dpr);
    }

    // Candles
    candles.forEach((c, i) => {
      const open = Number(c.open);
      const close = Number(c.close);
      const high = Number(c.high);
      const low = Number(c.low);
      const x = padding + i * cw + cw / 2;
      const up = close >= open;
      const color = up ? "#22c55e" : "#ef4444";

      const yHigh = padding + ((max - high) / range) * chartH;
      const yLow = padding + ((max - low) / range) * chartH;
      const yOpen = padding + ((max - open) / range) * chartH;
      const yClose = padding + ((max - close) / range) * chartH;

      // Wick
      ctx.strokeStyle = color;
      ctx.lineWidth = 1 * dpr;
      ctx.beginPath();
      ctx.moveTo(x, yHigh);
      ctx.lineTo(x, yLow);
      ctx.stroke();

      // Body
      ctx.fillStyle = color;
      const bodyY = Math.min(yOpen, yClose);
      const bodyH = Math.max(1 * dpr, Math.abs(yClose - yOpen));
      ctx.fillRect(x - bw / 2, bodyY, bw, bodyH);

      // Volume bar
      const vol = Number(c.volume);
      const volBarH = (vol / maxVol) * volH;
      ctx.fillStyle = up ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)";
      ctx.fillRect(x - bw / 2, volTop + volH - volBarH, bw, volBarH);
    });
  }, [candles]);

  return (
    <canvas
      ref={ref}
      className="w-full h-full block"
      style={{ width: "100%", height: "100%" }}
    />
  );
}
