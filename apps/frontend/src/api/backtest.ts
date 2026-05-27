import type { BacktestResult } from '@market-os/shared-types';

const BASE = import.meta.env['VITE_API_BASE_URL'] ?? '/api';

export async function fetchBacktest(interval = '1m', limit = 300, smaPeriod = 20, emaPeriod = 20, strategy = 'ma_cross'): Promise<BacktestResult> {
  const res = await fetch(`${BASE}/backtest?interval=${interval}&limit=${limit}&smaPeriod=${smaPeriod}&emaPeriod=${emaPeriod}&strategy=${strategy}`);
  if (!res.ok) throw new Error(`fetchBacktest failed: ${res.status}`);
  return res.json() as Promise<BacktestResult>;
}
