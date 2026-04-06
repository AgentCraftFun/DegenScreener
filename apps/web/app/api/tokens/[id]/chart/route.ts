import { NextResponse } from "next/server";
import { and, eq, gte, lte, asc, sql } from "drizzle-orm";
import { db, schema } from "@degenscreener/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TF_MINUTES: Record<string, number> = {
  "1m": 1,
  "5m": 5,
  "15m": 15,
  "1h": 60,
  "4h": 240,
  "1d": 1440,
};

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const url = new URL(req.url);
  const tf = url.searchParams.get("timeframe") ?? "1m";
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const fromDate = from ? new Date(Number(from)) : new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const toDate = to ? new Date(Number(to)) : new Date();

  if (!TF_MINUTES[tf])
    return NextResponse.json({ error: "invalid timeframe" }, { status: 400 });

  const bucketMin = TF_MINUTES[tf];

  if (tf === "1m") {
    const rows = await db
      .select()
      .from(schema.candles)
      .where(
        and(
          eq(schema.candles.tokenId, params.id),
          eq(schema.candles.timeframe, "1m"),
          gte(schema.candles.timestamp, fromDate),
          lte(schema.candles.timestamp, toDate),
        ),
      )
      .orderBy(asc(schema.candles.timestamp))
      .limit(2000);
    return NextResponse.json({
      candles: rows.map((r) => ({
        timestamp: r.timestamp,
        open: r.open,
        high: r.high,
        low: r.low,
        close: r.close,
        volume: r.volume,
      })),
    });
  }

  // Aggregate 1m candles up to higher timeframes via time_bucket
  const bucketSec = bucketMin * 60;
  const result = await db.execute<{
    bucket: Date;
    open: string;
    high: string;
    low: string;
    close: string;
    volume: string;
  }>(
    sql`SELECT time_bucket(${`${bucketSec} seconds`}::interval, timestamp) AS bucket,
          (array_agg(open ORDER BY timestamp ASC))[1] AS open,
          MAX(high) AS high,
          MIN(low) AS low,
          (array_agg(close ORDER BY timestamp DESC))[1] AS close,
          SUM(volume) AS volume
        FROM candles
        WHERE token_id = ${params.id}
          AND timeframe = '1m'
          AND timestamp >= ${fromDate}
          AND timestamp <= ${toDate}
        GROUP BY bucket
        ORDER BY bucket ASC
        LIMIT 2000`,
  );
  return NextResponse.json({
    candles: (result.rows ?? []).map((r) => ({
      timestamp: r.bucket,
      open: r.open,
      high: r.high,
      low: r.low,
      close: r.close,
      volume: r.volume,
    })),
  });
}
