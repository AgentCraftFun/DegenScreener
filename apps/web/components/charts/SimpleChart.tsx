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

    // Background
    ctx.fillStyle = "#0b0e11";
    ctx.fillRect(0, 0, w, h);

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

    // Grid lines
    ctx.strokeStyle = "#1b2332";
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
    ctx.fillStyle = "#6b7a8d";
    ctx.font = `${10 * dpr}px monospace`;
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

    ctx.strokeStyle = isLastUp ? "rgba(0, 194, 120, 0.4)" : "rgba(246, 70, 93, 0.4)";
    ctx.lineWidth = 1 * dpr;
    ctx.setLineDash([3 * dpr, 3 * dpr]);
    ctx.beginPath();
    ctx.moveTo(padding, priceLineY);
    ctx.lineTo(w - rightPad, priceLineY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Price label box
    const priceLabel = lastClose < 0.01 ? lastClose.toExponential(2) : lastClose.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 });
    const labelColor = isLastUp ? "#00c278" : "#f6465d";
    const labelBg = isLastUp ? "rgba(0, 194, 120, 0.2)" : "rgba(246, 70, 93, 0.2)";
    ctx.fillStyle = labelBg;
    const labelW = ctx.measureText(priceLabel).width + 12 * dpr;
    ctx.fillRect(w - rightPad + 2 * dpr, priceLineY - 8 * dpr, labelW, 16 * dpr);
    ctx.fillStyle = labelColor;
    ctx.textAlign = "left";
    ctx.font = `bold ${10 * dpr}px monospace`;
    ctx.fillText(priceLabel, w - rightPad + 8 * dpr, priceLineY + 4 * dpr);

    // Candles
    candles.forEach((c, i) => {
      const open = Number(c.open);
      const close = Number(c.close);
      const high = Number(c.high);
      const low = Number(c.low);
      const x = padding + i * cw + cw / 2;
      const up = close >= open;
      const color = up ? "#00c278" : "#f6465d";

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
      ctx.fillStyle = up ? "rgba(0, 194, 120, 0.15)" : "rgba(246, 70, 93, 0.15)";
      ctx.fillRect(x - bw / 2, volTop + volH - volBarH, bw, volBarH);
    });

    // Volume label
    ctx.fillStyle = "#4a5568";
    ctx.font = `${9 * dpr}px monospace`;
    ctx.textAlign = "left";
    ctx.fillText("Volume", padding + 4 * dpr, volTop + 12 * dpr);

  }, [candles]);

  return (
    <canvas
      ref={ref}
      className="w-full h-full block"
      style={{ width: "100%", height: "100%" }}
    />
  );
}
