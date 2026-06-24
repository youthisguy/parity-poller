# parity-poller

Express.js polling service for [Parity](https://github.com/youthisguy/parity) — the Bitget tri-venue divergence monitor.

This service runs independently of the Next.js app. It polls Bitget's US Stocks API periodically, writes ticks to the Parity backend, and runs the divergence engine loop to detect and log statistical dislocations.

---

## What it does

- Polls Bitget spot (rToken) and perpetual futures (mark + index) prices for 5 US stock symbols every 5 seconds
- POSTs tick data to the Parity Next.js API (`/api/ticks`)
- Calls the MCP divergence check endpoint after each poll cycle
- Opens new divergence events when z-score exceeds threshold
- Closes events when spread reverts or times out after 60 minutes
- Exposes `/health` and `/status` endpoints for uptime monitoring

---

## Symbols tracked

| rToken | Perp | Stock |
|--------|------|-------|
| RTSLAUSDT | TSLAUSDT | Tesla |
| RAAPLUSDT | AAPLUSDT | Apple |
| RGOOGLUSDT | GOOGLUSDT | Alphabet |
| RMSFTUSDT | MSFTUSDT | Microsoft |
| RAMZNUSDT | AMZNUSDT | Amazon |

All perps use `productType=USDT-FUTURES`.

---

## Setup

```bash
git clone https://github.com/youthisguy/parity-poller
cd parity-poller
npm install
```

Create a `.env` file:

```properties
NEXT_URL=https://your-parity-app.up.railway.app
PORT=3001
POLL_INTERVAL_MS=5000
```

Run in development:

```bash
npm run dev
```

Build and run in production:

```bash
npm run build
npm start
```

---

## API endpoints

### `GET /health`
Returns `{ ok: true }` — used by uptime monitors to keep the service alive.

### `GET /status`
Returns current poller state:
```json
{
  "lastPollAt": 1782284059584,
  "lastPollInserted": 5,
  "pollErrors": 0,
  "flaggedSymbols": ["TSLAUSDT"],
  "nextUrl": "https://parity-monitor.up.railway.app",
  "pollIntervalMs": 5000
}
```

---

## Architecture

```
parity-poller (Render)
    │
    ├── polls Bitget API every 5s
    │     ├── GET /api/v2/spot/market/tickers   (rToken spot price)
    │     └── GET /api/v2/mix/market/ticker     (perp mark + index + funding)
    │
    ├── POST /api/ticks → Parity Next.js app
    │
    └── GET  /api/mcp/check_divergence → Parity engine
          ├── flagged → POST /api/events  (open new divergence)
          ├── holding → no-op
          └── reverted → PATCH /api/events (close + calculate P&L)
```

---

## Key discovery

During development, Bitget's stock perpetuals were found under `productType=USDT-FUTURES`, not `SUSDT-FUTURES` as suggested in some documentation. rToken spot symbols use an `R` prefix (`RTSLAUSDT`) rather than an `x` suffix. Both were confirmed by querying the contracts and symbols endpoints directly.

---

## Related

- **Parity (Next.js app):** https://github.com/youthisguy/parity
- **Live dashboard:** https://parity-monitor.up.railway.app/dashboard
- **MCP check endpoint:** https://parity-monitor.up.railway.app/api/mcp/check_divergence?symbol=TSLAUSDT