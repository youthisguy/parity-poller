import express from "express";
import dotenv from "dotenv";
import { fetchSpotTicker, fetchPerpTicker } from "./bitget";

dotenv.config();

const app = express();
app.use(express.json());

const NEXT_URL = process.env.NEXT_URL ?? "http://localhost:3000";
const PORT = process.env.PORT ?? 3001;
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS ?? "5000");

// ── Symbol table  
const SYMBOLS: [string, string, string, "USDT-FUTURES" | "SUSDT-FUTURES"][] = [
    // [rTokenSpot, onTokenSpot, perpSymbol, productType]
    ["RTSLAUSDT",  "TSLAONUSDT",  "TSLAUSDT",  "USDT-FUTURES"],
    ["RAAPLUSDT",  "AAPLONUSDT",  "AAPLUSDT",  "USDT-FUTURES"],
    ["RGOOGLUSDT", "GOOGALONUSDT","GOOGLUSDT",  "USDT-FUTURES"],
    ["RMSFTUSDT",  "MSFTONUSDT",  "MSFTUSDT",  "USDT-FUTURES"],
    ["RAMZNUSDT",  "AMZNONUSDT",  "AMZNUSDT",  "USDT-FUTURES"],
  ];

// ── State  
let lastPollAt: number | null = null;
let lastPollInserted = 0;
let pollErrors = 0;
let flaggedSymbols: string[] = [];

// ── Health / status endpoints  
app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/status", (_req, res) => {
  res.json({
    lastPollAt,
    lastPollInserted,
    pollErrors,
    flaggedSymbols,
    nextUrl: NEXT_URL,
    pollIntervalMs: POLL_INTERVAL_MS,
  });
});

// ── Poll loop  
async function poll() {
    const ticks = [];
  
    for (const [rTokenSymbol, onTokenSymbol, perpSymbol, productType] of SYMBOLS) {
      const ts = Date.now();
      try {
        const [rtoken, ontoken, perp] = await Promise.all([
          fetchSpotTicker(rTokenSymbol),
          fetchSpotTicker(onTokenSymbol),
          fetchPerpTicker(perpSymbol, productType),
        ]);
  
        if (!perp) continue;
  
        ticks.push({
          symbol: perpSymbol,
          asset_class: "stock",
          ts,
          rtoken_price:  rtoken  ? parseFloat(rtoken.lastPr)      : null,
          ontoken_price: ontoken ? parseFloat(ontoken.lastPr)     : null,
          perp_mark:     perp.markPrice   ? parseFloat(perp.markPrice)   : null,
          perp_index:    perp.indexPrice  ? parseFloat(perp.indexPrice)  : null,
          funding_rate:  perp.fundingRate ? parseFloat(perp.fundingRate) : null,
        });
      } catch (err) {
        console.error(`[poll] error on ${perpSymbol}:`, err);
      }
    }

  if (ticks.length === 0) return;

  try {
    const res = await fetch(`${NEXT_URL}/api/ticks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ticks),
    });
    const data = await res.json();
    lastPollAt = Date.now();
    lastPollInserted = data.inserted ?? 0;
    console.log(`[${new Date().toISOString()}] inserted ${lastPollInserted} ticks`);
  } catch (err) {
    console.error("[poll] failed to POST ticks:", err);
    pollErrors++;
  }
}

// ── Engine loop  
async function runEngine() {
  const flagged: string[] = [];

  for (const [, perpSymbol] of SYMBOLS) {
    try {
      const res = await fetch(
        `${NEXT_URL}/api/mcp/check_divergence?symbol=${perpSymbol}`
      );
      const data = await res.json();

      if (data.flagged) {
        flagged.push(perpSymbol);
        console.log(
          `[engine] ⚡ FLAGGED ${perpSymbol}` +
          ` z_mark=${data.spreads?.mark_vs_index?.z?.toFixed(2)}`
        );
      }
    } catch {
 
    }
  }

  flaggedSymbols = flagged;
}

// ── Main loop  
async function main() {
  console.log(`[poller] starting — interval ${POLL_INTERVAL_MS}ms → ${NEXT_URL}`);

  // start Express first so /health is reachable immediately
  app.listen(PORT, () => {
    console.log(`[poller] status server on http://localhost:${PORT}`);
  });

  while (true) {
    await poll();
    await runEngine();
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

main();