import { WebSocketServer } from "ws";
import { Redis } from "ioredis";

const PORT = Number(process.env.WS_PORT ?? 3001);
const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

const wss = new WebSocketServer({ port: PORT });
console.log(`[ws-server] listening on :${PORT}`);

const sub = new Redis(REDIS_URL);
sub.subscribe("global", (err) => {
  if (err) console.error("[ws-server] redis subscribe error:", err);
  else console.log("[ws-server] subscribed to 'global'");
});

sub.on("message", (channel, message) => {
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) {
      client.send(JSON.stringify({ channel, message }));
    }
  }
});

wss.on("connection", (ws) => {
  console.log("[ws-server] client connected");
  ws.on("message", (raw) => {
    ws.send(raw.toString());
  });
  ws.on("close", () => console.log("[ws-server] client disconnected"));
});

const shutdown = async (sig: string) => {
  console.log(`[ws-server] ${sig} received, shutting down`);
  wss.close();
  await sub.quit();
  process.exit(0);
};
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
