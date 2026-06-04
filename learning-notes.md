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

## Position Percentage Exercise Result

Starting position:

```text
core position = 1 share
add-on size = 20% of the original core position
```

Result:

```text
add-on shares = 1 * 20% = 0.2 shares
total shares after add-on = 1.2 shares
```

Layered exit:

| Day | State | Action | Shares sold | Shares remaining |
|---|---|---|---:|---:|
| Day 12: price below SMA3 but above SMA6 | Short weak, medium strong | Sell all add-on shares | 0.2 | 1.0 |
| Day 13: price below SMA6 | Weak | Reduce 30% of the original core | 0.3 | 0.7 |
| Day 14: price remains below SMA6 | Continued weak | Reduce 50% of the remaining core | 0.35 | 0.35 |

Important distinction:

```text
30% of the original core position is different from
50% of the remaining core position.
```

## Why SMA3 and SMA6?

SMA3 and SMA6 are learning examples, not proven optimal parameters.

- SMA3 reacts quickly to short-term price changes.
- SMA6 reacts more slowly and helps separate a short pullback from continued weakness.
- Small periods are easier to calculate by hand while learning.

Real strategies should test multiple nearby parameter combinations and avoid choosing one pair only because it performed best historically.

## Moving Average Buffer Zone

A strategy that buys whenever price is above an SMA and sells whenever price is below it can trade too often when price moves around the SMA. This is called whipsaw.

One way to reduce whipsaw is to add a percentage buffer.

Example:

```text
SMA3 = 100
buffer = 1%
strong threshold = 100 * 1.01 = 101
weak threshold = 100 * 0.99 = 99
```

Rules:

```text
close > 101: strong signal
close < 99: weak signal
99 <= close <= 101: no action
```

## Signal vs Position State

A signal describes whether an action should happen today. A position describes how much is held after that action.

```text
signal = today's action
position = current holdings after the action
```

When price is inside the buffer zone, `no action` means keeping the previous position. It does not mean changing the position to zero.

Practice:

```text
SMA3 = 200
buffer = 2%
strong threshold = 204
weak threshold = 196
initial position = 0%
prices = 205, 202, 197, 195, 198, 206
```

Result:

| Day | Close | Signal | Position after close |
|---|---:|---|---:|
| 1 | 205 | Strong; buy | 100% |
| 2 | 202 | No action | 100% |
| 3 | 197 | No action | 100% |
| 4 | 195 | Weak; sell | 0% |
| 5 | 198 | No action | 0% |
| 6 | 206 | Strong; buy | 100% |

## Next Lesson

## Calculating an SMA Series

An SMA value uses the most recent `N` closing prices. Values before enough data exists should be `null`, not zero.

Example:

```text
closes = [10, 12, 11, 15, 17, 16]
period = 3
SMA3 = [null, null, 11, 12.67, 14.33, 16]
```

The calculation window moves one day at a time:

```text
[10, 12, 11]
    [12, 11, 15]
        [11, 15, 17]
            [15, 17, 16]
```

Practice result:

```text
closes = [20, 22, 21, 24, 28, 27]
SMA3 = [null, null, 21, 22.3, 24.3, 26.3]
```

Keep the original precision during calculations and round only for display.

## Turning SMA State into Actions

Rules with an initial position of 0%:

| Price state | Current position | Action | New position |
|---|---:|---|---:|
| close > SMA | 0% | Buy | 100% |
| close > SMA | 100% | Hold | 100% |
| close < SMA | 100% | Sell | 0% |
| close < SMA | 0% | Observe | 0% |
| close = SMA | Any | Keep current position | Unchanged |
| SMA is null | Any | Do not trade | Unchanged |

Important correction:

```text
A strong signal can appear on multiple consecutive days.
Buy only when there is no current position; otherwise hold.
```

## Moving Average Crossovers

Being above an SMA is a continuing state. Moving from below the SMA to above it is a crossover event.

```text
upward crossover:
yesterday close <= yesterday SMA
today close > today SMA

downward crossover:
yesterday close >= yesterday SMA
today close < today SMA
```

Practice:

```text
closes = [19, 21, 22, 20, 18, 23]
SMA =    [20, 20, 21, 21, 20, 21]
```

Result:

| Day | State | Typical action |
|---|---|---|
| 1 | Below SMA | Observe |
| 2 | Upward crossover | Buy |
| 3 | Remains above SMA | Hold |
| 4 | Downward crossover | Sell |
| 5 | Remains below SMA | Observe |
| 6 | Upward crossover | Buy |

## Why Trend-Following Sells After a Price Drop

A moving-average strategy is a trend-following strategy. It does not try to predict or sell at the exact highest price.

```text
Price remains above SMA: the trend may still continue, so hold.
Price falls below SMA: the trend may have ended, so sell.
```

This means the strategy usually sells after price has already fallen from its peak. It accepts small losses and gives up part of an unrealized profit in exchange for the chance to capture a larger trend.

Different methods use different logic:

| Method | Main logic |
|---|---|
| Trend following | Buy after strength is confirmed; sell after weakness appears |
| Value investing | Buy when price is below estimated value |
| Mean reversion | Buy after an unusually large decline; sell near the average |
| Subjective trading | Decide using news, experience, and judgment |

## Avoid Mixing Strategies During a Trade

A common mistake is changing strategy after entering a position:

```text
Buy because price broke above the SMA.
Hold after the SMA fails because the stock now looks cheap.
Continue holding because it has become a long-term investment.
```

Before buying, define:

```text
Why am I buying?
What condition invalidates that reason?
How much will I sell when it is invalidated?
What is the maximum acceptable loss?
How long do I expect to hold?
```

Core rule:

```text
The reason to buy, the reason to hold, and the rule to sell
must belong to the same strategy.
```

## What Quantitative Trading Teaches Investors

Quantitative trading is useful even without automated trading. It teaches investors to:

- Evaluate risk together with return.
- Define holding, adding, reducing, and selling rules before buying.
- Distinguish a lower price from genuine value.
- Judge a strategy using many trades instead of one outcome.
- Include fees, taxes, slippage, and drawdowns.
- Reduce emotional changes to the trading plan.

The central process is:

```text
Form a hypothesis -> define rules -> test with data
-> evaluate risk and costs -> execute with small size -> review
```

Historical results do not guarantee future performance, and a precise rule does not automatically make a profitable strategy.

## Next Lesson

## Trade Profit, Loss, and Costs

Investors need to understand what transaction costs mean. A quantitative system must calculate them accurately for every trade.

Basic formulas:

```text
buy amount = shares * buy price
sell amount = shares * sell price
gross profit = sell amount - buy amount

total buy cost = buy amount + buy fee
net sell amount = sell amount - sell fee - transaction tax
net profit = net sell amount - total buy cost
net return = net profit / total buy cost * 100%
```

Practice:

```text
Buy: 20 shares at 50
Sell: 20 shares at 55
Buy fee: 3
Sell fee: 3
Transaction tax: 5
```

Result:

| Item | Calculation | Amount |
|---|---|---:|
| Buy amount | 20 * 50 | 1,000 |
| Total buy cost | 1,000 + 3 | 1,003 |
| Sell amount | 20 * 55 | 1,100 |
| Net sell amount | 1,100 - 3 - 5 | 1,092 |
| Gross profit | 1,100 - 1,000 | 100 |
| Total transaction costs | 3 + 3 + 5 | 11 |
| Net profit | 1,092 - 1,003 | 89 |
| Net return | 89 / 1,003 * 100% | 8.87% |

Important correction:

```text
Net sell amount is not profit.
Profit must subtract the original buy cost.
```

Transaction costs can turn a strategy with positive gross profit into a losing strategy, especially when it trades frequently.

## Next Lesson

## Cumulative Profit and Account Balance

Basic formulas:

```text
new balance = previous balance + current trade net profit
cumulative profit = current balance - initial capital
cumulative return = cumulative profit / initial capital * 100%
```

Practice:

```text
initial capital = 20,000
trade profits = +1,000, -500, +2,000
```

Result:

| Stage | Trade profit | Account balance |
|---|---:|---:|
| Initial | - | 20,000 |
| Trade 1 | +1,000 | 21,000 |
| Trade 2 | -500 | 20,500 |
| Trade 3 | +2,000 | 22,500 |

```text
cumulative profit = 22,500 - 20,000 = 2,500
cumulative return = 2,500 / 20,000 * 100% = 12.5%
```

## Compounded Returns

When each trade uses the current account balance, percentage returns compound through multiplication rather than addition.

```text
new balance = previous balance * (1 + return)
```

Practice:

```text
initial capital = 20,000
trade 1 return = +20%
trade 2 return = -25%
```

Result:

```text
20,000 * 1.20 = 24,000
24,000 * 0.75 = 18,000

compounded return = 1.20 * 0.75 - 1 = -10%
```

Adding the percentages gives `-5%`, but the actual result is `-10%` because each percentage uses a different account balance.

## Required Return After a Loss

After a loss, the required return to recover is calculated from the smaller remaining balance.

| Loss | Remaining capital from 100 | Return required to recover |
|---:|---:|---:|
| -10% | 90 | +11.1% |
| -20% | 80 | +25% |
| -25% | 75 | +33.3% |
| -50% | 50 | +100% |

Example:

```text
100 loses 50% -> 50 remains
required profit = 100 - 50 = 50
required return = 50 / 50 * 100% = 100%
```

Larger losses cause the recovery requirement to increase rapidly.

## Maximum Drawdown

Maximum drawdown measures the largest decline from a previous account high to a later low.

```text
drawdown = (later low - previous peak) / previous peak * 100%
```

Practice:

```text
account balances = 100, 130, 120, 104, 125
previous peak = 130
later low = 104
maximum drawdown = (104 - 130) / 130 * 100% = -20%
```

Maximum drawdown is measured from the previous peak, not necessarily from the initial capital.

## Selecting Strategies by Risk Limit

Do not select a strategy only because it has the highest return. First remove strategies that exceed the acceptable risk limit.

Example:

```text
maximum acceptable drawdown = 20%

Strategy C: final return +25%, maximum drawdown -15%
Strategy D: final return +40%, maximum drawdown -60%
```

Strategy C meets the requirement because its `15%` maximum drawdown does not exceed the `20%` risk limit. Strategy D does not meet the requirement despite its higher return.

```text
First remove strategies whose risk cannot be tolerated.
Then compare the returns of the remaining strategies.
```

## Next Lesson

## Win Rate and Expected Value

Win rate only describes how frequently trades win. Expected value also considers how much winning and losing trades make or lose.

```text
win rate = winning trades / total trades
loss rate = losing trades / total trades

expected value =
win rate * average win - loss rate * average loss
```

Practice:

```text
total trades = 20
winning trades = 12
losing trades = 8
average win = 300
average loss = 200
```

Result:

```text
win rate = 12 / 20 = 60%
loss rate = 8 / 20 = 40%
expected value = 60% * 300 - 40% * 200 = +100 per trade
```

## Reward-to-Risk Ratio

```text
reward-to-risk ratio = average win / average loss
```

Example:

```text
average win = 500
average loss = 250
reward-to-risk ratio = 500 / 250 = 2
```

A strategy can have a low win rate and still be profitable when its average win is sufficiently larger than its average loss.

## Break-Even Win Rate

The break-even win rate is the minimum win rate required for expected value to equal zero.

```text
break-even win rate =
average loss / (average win + average loss)
```

Example:

```text
average win = 300
average loss = 200
break-even win rate = 200 / (300 + 200) = 40%
```

## Transaction Costs and Expected Value

Transaction costs reduce winning trades and increase losing trades.

```text
net average win = original average win - transaction cost
net average loss = original average loss + transaction cost
```

Practice:

```text
original average win = 400
original average loss = 150
transaction cost per completed trade = 50
```

Result:

```text
net average win = 400 - 50 = 350
net average loss = 150 + 50 = 200

break-even win rate before costs =
150 / (400 + 150) = 27.27%

break-even win rate after costs =
200 / (350 + 200) = 36.36%
```

With an actual win rate of `40%`:

```text
expected value = 40% * 350 - 60% * 200 = +20 per trade
```

The strategy remains positive expectancy, but its advantage is small and could disappear if slippage or other costs are underestimated.

## Expected Value Is a Long-Run Average

Positive expected value does not mean every trade will make money.

Practice:

```text
trade results = [-100, +300, -100, -100, +300]
total profit = +300
average profit per trade = +300 / 5 = +60
win rate = 2 / 5 = 40%
```

A strategy can be profitable despite winning less than half of its trades when winning trades are larger than losing trades.

## Pending Exercise: Consecutive Losses

Even a positive-expectancy strategy can experience consecutive losses.

```text
probability of consecutive independent losses =
loss rate multiplied by itself for each loss
```

Pending question, intentionally unanswered:

```text
strategy loss rate = 50%
What is the simplified probability of three consecutive losses?
```

## Next Lesson

Continue from the pending consecutive-loss exercise, then connect losing streaks to position sizing and drawdown.
