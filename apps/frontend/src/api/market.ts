import type { Kline } from '@market-os/shared-types';

const BASE = import.meta.env['VITE_API_BASE_URL'] ?? '/api';

export interface KlinesResponse {
  symbol: string;
  interval: string;
  data: Kline[];
}

export async function fetchKlines(limit = 100, interval = '1m'): Promise<Kline[]> {
  const res = await fetch(`${BASE}/market/klines?limit=${limit}&interval=${interval}`);
  if (!res.ok) throw new Error(`fetchKlines failed: ${res.status}`);
  const json = (await res.json()) as KlinesResponse;
  return json.data;
}
