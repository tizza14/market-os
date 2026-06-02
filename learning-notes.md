# Market OS Learning Notes

## Current Learning Goal

Use this project to learn basic quantitative trading from market data upward.

## Current Progress

- The project is suitable as a market data and research platform, not as a live trading system yet.
- The recommended learning path is:
  1. Market data
  2. K-line / candlestick aggregation
  3. Indicators
  4. Strategy signals
  5. Backtesting
  6. Performance analysis
  7. Paper trading
  8. Risk control
  9. Live trading API
- We started from step 3: indicators and simple strategy concepts.
- The current concept is SMA, simple moving average.

## What Is a Quantitative Rule?

A quantitative rule turns a subjective idea into something that can be calculated, repeated, and backtested.

Subjective version:

```text
The trend feels weak, so sell a little.
```

Quantitative version:

```text
If close < SMA3:
sell 100% of the add-on position.

If close is below SMA3 for 2 consecutive days:
reduce the core position by 30%.

If close < SMA6:
reduce core risk by 50% or clear the remaining position.
```

A usable quantitative rule needs four parts:

| Part | Question | Example |
|---|---|---|
| Indicator | Which number is used? | SMA3, SMA6, return %, drawdown % |
| Condition | When does it trigger? | price < SMA3 |
| Action | What should happen? | buy, add, hold, reduce, sell |
| Size | How much should happen? | 10%, 30%, 50%, 100% |

Working definition:

```text
Quantitative rule = use numbers to define when to do what, and how much to do.
```

## SMA Explanation So Far

SMA means the average of the most recent N closing prices.

Example prices:

```text
100, 102, 101, 105, 107
```

SMA3:

```text
price: 100   102   101   105     107
SMA3:  -     -     101   102.67  104.33
```

Interpretation:

- If the current price is above SMA, the price is stronger than the recent average.
- If the current price is below SMA, the price is weaker than the recent average.

Core idea:

```text
Quant trading = turn feeling into rules that can be calculated and tested.
```

## Position Sizing Exercise: GOOG

This exercise uses a real fractional-share position to practice cost basis, target return, and exit planning.

Position: GOOG / Alphabet Class C

| Date | Shares | Fill Price | Cost |
|---|---:|---:|---:|
| 3/6 | 0.33783 | 296.00 | 100.08 |
| 5/18 | 0.25529 | 391.71 | 100.08 |
| 5/20 | 0.25994 | 384.70 | 100.08 |
| 5/25 | 0.26367 | 379.26 | 100.08 |

Combined position:

- Total shares: 1.11673
- Total cost: 400.32 USD
- Average cost: 358.48 USD per share
- Target price: 400.00 USD per share

If all shares are sold at 400:

```text
sale value = 1.11673 * 400 = 446.69
profit = 446.69 - 400.32 = 46.37
return = 46.37 / 400.32 = 11.58%
```

If only 1 share is sold at 400:

- Cash recovered: 400.00 USD
- Estimated profit on that 1 share: 400.00 - 358.48 = 41.52 USD
- Remaining shares: 0.11673
- Remaining value at 400: 46.69 USD

Rule-based plan:

- 400: target price; sell 1 share to recover most of the original capital.
- 380: short-term defense line for the remaining 0.11673 shares after target is reached.
- 360: approximate break-even defense area, close to the average cost.

Main lesson:

```text
A target price is not the full plan.
A quantified plan also needs position size, average cost, expected return, defense line, and exit rules.
```

## SMA Pullback Add-On Rules

The next concept is trend-based add-on buying.

Do not add only because price is below SMA3. For a trend strategy, the cleaner condition is:

```text
Price pulls back near SMA3,
does not stay weak,
then stands back above SMA3.
```

Example prices:

```text
100, 102, 104, 106, 108, 107, 106, 108, 110
```

SMA3 around the pullback:

```text
day 5: (104 + 106 + 108) / 3 = 106
day 6: (106 + 108 + 107) / 3 = 107
day 7: (108 + 107 + 106) / 3 = 107
day 8: (107 + 106 + 108) / 3 = 107
day 9: (106 + 108 + 110) / 3 = 108
```

Interpretation:

- Day 7 price 106 is below SMA3 107, so do not add yet.
- Day 8 price 108 stands back above SMA3 107, so a small add-on can be considered.
- If price falls below SMA3 again after the add-on, sell the add-on position first.

Rule:

```text
Add-on buying should buy confirmed strength, not only a cheaper price.
```

## Core Position vs Add-On Position

Separate the original position from the add-on position.

```text
Core position = original position with better cost basis.
Add-on position = tactical position used to follow short-term strength.
```

Example:

```text
Core position: 1 share at 100
Add-on position: 0.3 share at 108
```

If price later drops to 106 and SMA3 is 108:

```text
add-on cost = 108 * 0.3 = 32.40
add-on sale value = 106 * 0.3 = 31.80
add-on profit/loss = 31.80 - 32.40 = -0.60
```

Important correction:

```text
position value is not profit.
profit = sale value - cost.
```

Layered exit idea:

- If price falls below SMA3, sell the add-on position first.
- If weakness continues, reduce the core position by 30%.
- If price falls below SMA6, clear the remaining core position.

Working rule:

```text
SMA3 manages tactical add-ons.
SMA6 manages whether the core position should continue.
```

## SMA3 / SMA6 Exercise Result

Prices:

```text
100, 102, 104, 106, 108, 107, 106, 108, 110, 106
```

Final day calculations:

```text
SMA3 = (108 + 110 + 106) / 3 = 108
SMA6 = (108 + 107 + 106 + 108 + 110 + 106) / 6 = 107.5
```

Final price:

```text
price = 106
price < SMA3 108
price < SMA6 107.5
```

Interpretation:

- Price below SMA3 means the tactical add-on position failed.
- Price below SMA6 means the core position is also no longer protected by the medium-term rule.
- Falling below SMA6 is not an add-on signal. It is a reduce-or-exit signal.

Correct layered action:

| Position | Purpose | Rule |
|---|---|---|
| Add-on position | Capture short-term extension | Sell when price falls below SMA3 |
| First 30% of core | Defensive reduction | Sell when weakness continues or price confirms below SMA6 |
| Remaining core | Hold for longer trend | Clear or heavily reduce when price stays below SMA6 |

Rule correction:

```text
Do not add 30% below SMA6.
Below SMA6 means reduce risk, not increase risk.
```

## SMA3 / SMA6 Signal Table

Use SMA3 and SMA6 together to convert price behavior into rules.

| State | Condition | Interpretation | Action |
|---|---|---|---|
| Strong | price > SMA3 and price > SMA6 | Short-term and medium-term are both strong | Hold; small add-on can be considered |
| Short weak, medium strong | price < SMA3 and price > SMA6 | Short-term pullback, core trend still okay | Sell add-on position; keep core |
| Weak | price < SMA3 and price < SMA6 | Short-term and medium-term are both weak | Sell add-on; reduce core risk |
| Repair | price > SMA3 but price < SMA6 | Short-term bounce, medium-term not confirmed | Observe; do not rush to add |
| Strong again | price > SMA3 and price > SMA6 after weakness | Price recovered both lines | Small add-on can be considered |

Practice result:

```text
prices = 100, 102, 104, 106, 108, 107, 106, 108, 110, 106, 109
SMA3 = (110 + 106 + 109) / 3 = 108.33
SMA6 = (107 + 106 + 108 + 110 + 106 + 109) / 6 = 107.67
price = 109
```

Interpretation:

```text
price 109 > SMA3 108.33
price 109 > SMA6 107.67
state = strong again
```

Action:

- Add only the tactical add-on position, not the full planned amount.
- If price falls below SMA3 again, sell the add-on position first.
- If price later falls below SMA6, reduce core risk.

## Next Lesson

## Position Percentage Rules

The signal table needs exact position percentages so it can be tested later.

Starting assumption:

```text
core position = 100%
maximum add-on position = 30%
```

Rule table:

| State | Condition | Position rule |
|---|---|---|
| Strong | price > SMA3 and price > SMA6 | Hold 100% core; optional 10% to 30% add-on |
| Strong again | price recovers above SMA3 and SMA6 after weakness | Add 10% to 20%, not the full 30% immediately |
| Short weak | price < SMA3 and price > SMA6 | Sell 100% of add-on; keep core |
| Weak | price < SMA3 and price < SMA6 | Sell 100% of add-on; reduce core by 30% |
| Continued weak | close < SMA6 for 2 consecutive days | Reduce another 50% of remaining core or clear position |

Example exercise:

```text
Core position: 1 share at 100
Day 11 price: 109
SMA3: 108.33
SMA6: 107.67
Action: add 20%

Questions:
1. Add-on shares = ?
2. Total shares after add-on = ?
3. If day 12 price falls to 107, below SMA3 but above SMA6, how much should be sold?
4. If day 13 price falls to 105 and below SMA6, how much core should be reduced?
```

After that, connect this idea to this project's K-line data and eventually implement a small SMA function.
