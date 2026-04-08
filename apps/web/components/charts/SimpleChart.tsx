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

interface Props {
  candles: Candle[];
  graduatedAt?: string; // ISO timestamp of graduation
}

export function SimpleChart({ candles, graduatedAt }: Props) {
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

    // Background — near black
    ctx.fillStyle = "#050505";
    ctx.fillRect(0, 0, w, h);

    // Grid pattern
    ctx.strokeStyle = "rgba(0, 255, 65, 0.04)";
    ctx.lineWidth = 0.5 * dpr;
    const gridSize = 40 * dpr;
    for (let x = 0; x < w; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    const padding = 50 * dpr;
    const rightPad = 70 * dpr;
    const chartH = h * 0.72 - padding;
    const volH = h * 0.22;
    const volTop = h * 0.72;

    const highs = candles.map((c) => Number(c.high));
    const lows = candles.map((c) => Number(c.low));
    const max = Math.max(...highs);
    const min = Math.min(...lows);
    const range = max - min || 1;
    const maxVol = Math.max(...candles.map((c) => Number(c.volume)), 0.001);

    const cw = (w - padding - rightPad) / candles.length;
    const bw = Math.max(cw * 0.65, 2 * dpr);

    // Grid lines — horizontal
    ctx.strokeStyle = "rgba(0, 255, 65, 0.06)";
    ctx.lineWidth = 0.5 * dpr;
    for (let i = 0; i <= 5; i++) {
      const y = padding + (chartH / 5) * i;
      ctx.beginPath();
      ctx.setLineDash([4 * dpr, 4 * dpr]);
      ctx.moveTo(padding, y);
      ctx.lineTo(w - rightPad, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Price axis labels
    ctx.fillStyle = "#5a8a5a";
    ctx.font = `${10 * dpr}px 'Share Tech Mono', monospace`;
    ctx.textAlign = "right";
    for (let i = 0; i <= 5; i++) {
      const price = max - (range / 5) * i;
      const y = padding + (chartH / 5) * i;
      const label = price < 0.01 ? price.toExponential(2) : price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 });
      ctx.fillText(label, w - 4 * dpr, y + 4 * dpr);
    }

    // Current price line
    const lastCandle = candles[candles.length - 1]!;
    const lastClose = Number(lastCandle.close);
    const lastOpen = Number(lastCandle.open);
    const isLastUp = lastClose >= lastOpen;
    const priceLineY = padding + ((max - lastClose) / range) * chartH;

    ctx.strokeStyle = isLastUp ? "rgba(0, 255, 65, 0.4)" : "rgba(255, 59, 59, 0.4)";
    ctx.lineWidth = 1 * dpr;
    ctx.setLineDash([3 * dpr, 3 * dpr]);
    ctx.beginPath();
    ctx.moveTo(padding, priceLineY);
    ctx.lineTo(w - rightPad, priceLineY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Price label box
    const priceLabel = lastClose < 0.01 ? lastClose.toExponential(2) : lastClose.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 });
    const labelColor = isLastUp ? "#00FF41" : "#ff3b3b";
    const labelBg = isLastUp ? "rgba(0, 255, 65, 0.15)" : "rgba(255, 59, 59, 0.15)";
    ctx.fillStyle = labelBg;
    const labelW = ctx.measureText(priceLabel).width + 12 * dpr;
    ctx.fillRect(w - rightPad + 2 * dpr, priceLineY - 8 * dpr, labelW, 16 * dpr);
    ctx.fillStyle = labelColor;
    ctx.textAlign = "left";
    ctx.font = `bold ${10 * dpr}px 'Share Tech Mono', monospace`;
    ctx.fillText(priceLabel, w - rightPad + 8 * dpr, priceLineY + 4 * dpr);

    // Candles
    candles.forEach((c, i) => {
      const open = Number(c.open);
      const close = Number(c.close);
      const high = Number(c.high);
      const low = Number(c.low);
      const x = padding + i * cw + cw / 2;
      const up = close >= open;
      const color = up ? "#00FF41" : "#ff3b3b";

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

      // Candle glow for recent candles (last 5)
      if (i >= candles.length - 5 && up) {
        ctx.shadowColor = "rgba(0, 255, 65, 0.3)";
        ctx.shadowBlur = 6 * dpr;
        ctx.fillRect(x - bw / 2, bodyY, bw, bodyH);
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
      }

      // Volume bar
      const vol = Number(c.volume);
      const volBarH = (vol / maxVol) * volH;
      ctx.fillStyle = up ? "rgba(0, 255, 65, 0.12)" : "rgba(255, 59, 59, 0.12)";
      ctx.fillRect(x - bw / 2, volTop + volH - volBarH, bw, volBarH);
    });

    // Volume label
    ctx.fillStyle = "#2a4a2a";
    ctx.font = `${9 * dpr}px 'Share Tech Mono', monospace`;
    ctx.textAlign = "left";
    ctx.fillText("Volume", padding + 4 * dpr, volTop + 12 * dpr);

    // Graduation marker
    if (graduatedAt) {
      const gradTime = new Date(graduatedAt).getTime();
      const candleTimes = candles.map((c) => new Date(c.timestamp).getTime());
      // Find the candle index closest to graduation
      let gradIdx = -1;
      for (let i = 0; i < candleTimes.length; i++) {
        if (candleTimes[i]! >= gradTime) {
          gradIdx = i;
          break;
        }
      }
      if (gradIdx >= 0) {
        const gx = padding + gradIdx * cw + cw / 2;
        // Vertical line
        ctx.strokeStyle = "rgba(0, 255, 65, 0.6)";
        ctx.lineWidth = 2 * dpr;
        ctx.setLineDash([6 * dpr, 4 * dpr]);
        ctx.beginPath();
        ctx.moveTo(gx, padding);
        ctx.lineTo(gx, volTop + volH);
        ctx.stroke();
        ctx.setLineDash([]);

        // Label
        ctx.fillStyle = "rgba(0, 255, 65, 0.9)";
        ctx.font = `bold ${10 * dpr}px 'Share Tech Mono', monospace`;
        ctx.textAlign = "center";
        ctx.shadowColor = "rgba(0, 255, 65, 0.5)";
        ctx.shadowBlur = 8 * dpr;
        ctx.fillText("\uD83C\uDF93 Graduated", gx, padding - 6 * dpr);
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
      }
    }

  }, [candles, graduatedAt]);

  return (
    <canvas
      ref={ref}
      className="w-full h-full block"
      style={{ width: "100%", height: "100%" }}
    />
  );
}
