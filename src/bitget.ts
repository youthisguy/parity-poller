const BASE_SPOT = "https://api.bitget.com/api/v2/spot";
const BASE_MIX = "https://api.bitget.com/api/v2/mix";
const FETCH_TIMEOUT_MS = 8000;

export interface BitgetSpotTicker {
  symbol: string;
  lastPr: string;
  bidPr: string;
  askPr: string;
  ts: string;
}

export type ProductType = "USDT-FUTURES" | "SUSDT-FUTURES";

export interface BitgetPerpTicker {
  symbol: string;
  markPrice: string;
  indexPrice: string;
  fundingRate: string;
  ts: string;
}
async function fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      return await fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }
  
  export async function fetchSpotTicker(symbol: string) {
    try {
      const res = await fetchWithTimeout(`${BASE_SPOT}/market/tickers?symbol=${symbol}`);
      if (!res.ok) return null;
      const json = await res.json();
      return json?.data?.[0] ?? null;
    } catch { return null; }
  }
  
  export async function fetchPerpTicker(symbol: string, productType: ProductType) {
    try {
      const res = await fetchWithTimeout(
        `${BASE_MIX}/market/ticker?symbol=${symbol}&productType=${productType}`
      );
      if (!res.ok) return null;
      const json = await res.json();
      const d = json?.data;
      return Array.isArray(d) ? d[0] ?? null : d ?? null;
    } catch { return null; }
  }
  