import Decimal from 'decimal.js';

export type PriceDirection = 'up' | 'down' | 'flat';

export interface PriceChange {
  direction: PriceDirection;
  diff: string;
  percent: string;
  displayPrice: string;
}

export function calcPriceChange(prev: string | null, curr: string): PriceChange {
  const displayPrice = '$' + new Decimal(curr).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  if (prev === null) {
    return { direction: 'flat', diff: '0.00', percent: '0.00%', displayPrice };
  }

  const prevDec = new Decimal(prev);
  const currDec = new Decimal(curr);
  const diff = currDec.minus(prevDec);
  const percent = prevDec.isZero() ? new Decimal(0) : diff.div(prevDec).times(100);

  let direction: PriceDirection = 'flat';
  if (diff.gt(0)) direction = 'up';
  else if (diff.lt(0)) direction = 'down';

  const sign = diff.gte(0) ? '+' : '';
  return {
    direction,
    diff: sign + diff.toFixed(2),
    percent: sign + percent.toFixed(2) + '%',
    displayPrice,
  };
}
