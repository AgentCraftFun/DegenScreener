import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/degenscreener";

async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();

  const migrationsDir = join(__dirname, "..", "drizzle");
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  await client.query(`
    CREATE TABLE IF NOT EXISTS __migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  for (const file of files) {
    const { rows } = await client.query(
      "SELECT 1 FROM __migrations WHERE name = $1",
      [file],
    );
    if (rows.length > 0) {
      console.log(`skip: ${file}`);
      continue;
    }
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    console.log(`apply: ${file}`);
    // Split on drizzle statement-breakpoints to run each statement separately
    const statements = sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const stmt of statements) {
      await client.query(stmt);
    }
    await client.query("INSERT INTO __migrations (name) VALUES ($1)", [file]);
  }

  // TimescaleDB setup
  console.log("timescaledb: ensuring extension and hypertable");
  await client.query("CREATE EXTENSION IF NOT EXISTS timescaledb;");
  await client.query(
    "SELECT create_hypertable('candles', 'timestamp', if_not_exists => TRUE);",
  );

  await client.end();
  console.log("migrations complete");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
