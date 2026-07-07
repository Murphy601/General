# ScalpProfitBot — MetaTrader 5 Expert Advisor

Automatic scalping Expert Advisor (EA) for **MetaEditor / MetaTrader 5**. It scans candlesticks, combines multi-timeframe indicators, places buy/sell trades instantly, takes **small quick profits**, reverses when the market flips, and supports **multiple simultaneous positions**.

> **Important:** No trading system can guarantee 89–100% accuracy. Markets are probabilistic. Always test on a **demo account** first, use proper risk controls, and never trade money you cannot afford to lose.

---

## Features

| Feature | Description |
|--------|-------------|
| **Instant start** | Trades on the first tick after attach (`InpTradeOnEveryTick = true`) |
| **Candlestick scan** | Engulfing, hammer, shooting star, doji, three soldiers/crows |
| **Multi-timeframe** | M1 execution + M1/M5/M15 trend alignment |
| **Indicator confluence** | EMA, RSI, MACD, Stochastic voting system |
| **Small profit cuts** | Configurable TP (default 12 points) + trailing from 4 points |
| **Auto reversal** | Closes losing direction and flips when signal changes |
| **Multi-bet** | Up to 4 simultaneous positions (configurable) |
| **Market filters** | Spread, ATR, daily loss cap, max trades/day |

---

## Installation (MetaEditor)

1. Open **MetaTrader 5** → **File** → **Open Data Folder**
2. Copy files into your MT5 data folder:

```
MQL5/
├── Experts/
│   └── ScalpProfitBot.mq5          ← copy from ScalpProfitBot/Experts/
└── Include/
    └── ScalpProfit/
        ├── CandlePatterns.mqh      ← copy from ScalpProfitBot/Include/ScalpProfit/
        ├── SignalEngine.mqh
        └── TradeManager.mqh
```

3. Open **MetaEditor** (F4 in MT5)
4. Open `ScalpProfitBot.mq5` → **Compile** (F7)
5. Confirm: `0 error(s), 0 warning(s)` in the Toolbox

---

## Attach to Chart

1. In MT5 Navigator → **Expert Advisors** → drag **ScalpProfitBot** onto a chart
2. Enable:
   - ✅ **Allow Algo Trading** (toolbar button)
   - ✅ **Allow live trading** in EA settings
3. Recommended starting symbols: **EURUSD**, **GBPUSD**, **XAUUSD** (low spread brokers)
4. Use **M1 chart** for execution visibility

---

## Recommended Settings

### Conservative (higher filter, fewer trades)
```
InpMinConfluence      = 80
InpMinCandleScore     = 10
InpTakeProfitPoints   = 10
InpMaxPositions       = 2
InpMaxSpreadPoints    = 20
```

### Aggressive scalping (more trades, more risk)
```
InpMinConfluence      = 65
InpMinCandleScore     = 6
InpTakeProfitPoints   = 8
InpMaxPositions       = 4
InpSecondsBetweenTrades = 2
```

### Quick profit + reversal (default)
```
InpTakeProfitPoints   = 12
InpTrailStartPoints   = 4
InpTrailStepPoints    = 2
InpEnableReversal     = true
InpReverseLossPoints  = 6
```

---

## How the Bot Decides Trades

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ Candlestick │────▶│ Confluence Score │────▶│ BUY / SELL /    │
│ Patterns    │     │ (EMA+RSI+MACD+   │     │ SKIP            │
│ M1 + M5     │     │  Stoch + MTF)    │     └────────┬────────┘
└─────────────┘     └──────────────────┘              │
                                                      ▼
                                            ┌─────────────────┐
                                            │ Open / Reverse  │
                                            │ Trail / Cut TP  │
                                            └─────────────────┘
```

- **BUY** when score ≥ `InpMinConfluence` and candle score is bullish enough
- **SELL** when score ≤ `-InpMinConfluence` and candle score is bearish enough
- **Reverse** when an open trade is losing ≥ `InpReverseLossPoints` and the opposite signal is strong
- **Skip** when spread is too wide, ATR too low/high, or daily risk limit hit

---

## Strategy Tester

1. MT5 → **View** → **Strategy Tester**
2. Select **ScalpProfitBot**, symbol **EURUSD**, period **M1**
3. Modeling: **Every tick based on real ticks** (best) or **1 minute OHLC**
4. Enable **visual mode** to watch entries
5. Optimize `InpMinConfluence` and `InpTakeProfitPoints` for your broker's spread

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| EA does nothing | Enable Algo Trading; check spread < `InpMaxSpreadPoints` |
| Compile error "file not found" | Ensure `.mqh` files are in `MQL5/Include/ScalpProfit/` |
| Orders rejected | Increase `InpSlippagePoints`; check broker min lot |
| Too many trades | Raise `InpMinConfluence` to 78–85 |
| Too few trades | Lower `InpMinConfluence` to 65–70; reduce `InpMinAtrPoints` |

---

## Risk Disclaimer

This software is provided for educational purposes. Past backtest results do not guarantee future performance. The authors are not responsible for any financial losses. Use at your own risk.

---

## File Structure

```
ScalpProfitBot/
├── Experts/
│   └── ScalpProfitBot.mq5       # Main EA — attach this to chart
├── Include/
│   └── ScalpProfit/
│       ├── CandlePatterns.mqh   # Candlestick pattern detection
│       ├── SignalEngine.mqh     # Multi-TF signal & confluence engine
│       └── TradeManager.mqh     # Orders, trailing, reversal logic
└── README.md
```
