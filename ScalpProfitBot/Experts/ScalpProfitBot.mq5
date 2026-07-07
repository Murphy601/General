//+------------------------------------------------------------------+
//|                                              ScalpProfitBot.mq5  |
//|     Multi-timeframe scalping EA - instant start, quick profits   |
//|     Candlestick + RSI/MACD/Stochastic confluence engine          |
//+------------------------------------------------------------------+
#property copyright   "ScalpProfitBot"
#property link        "https://github.com"
#property version     "1.00"
#property description "Scalping bot: candlestick scan, multi-TF signals,"
#property description "small-margin profit cuts, auto reversal, multi-bet."

#include <ScalpProfit/SignalEngine.mqh>
#include <ScalpProfit/TradeManager.mqh>

//--- inputs: general
input group "=== General ==="
input ulong             InpMagicNumber        = 880071;          // Magic number
input double            InpLotSize            = 0.01;            // Lot size per trade
input int               InpMaxSpreadPoints    = 25;             // Max spread (points)
input int               InpSlippagePoints     = 20;             // Max slippage (points)

//--- inputs: timeframes
input group "=== Timeframes ==="
input ENUM_TIMEFRAMES   InpTfExecution        = PERIOD_M1;      // Execution timeframe
input ENUM_TIMEFRAMES   InpTfFast             = PERIOD_M1;      // Fast trend TF
input ENUM_TIMEFRAMES   InpTfMid              = PERIOD_M5;      // Mid trend TF
input ENUM_TIMEFRAMES   InpTfSlow             = PERIOD_M15;     // Slow trend TF

//--- inputs: signal quality (higher = fewer but stronger trades)
input group "=== Signal Accuracy Filters ==="
input int               InpMinConfluence      = 72;             // Min confluence score (60-90)
input int               InpMinCandleScore     = 8;              // Min candlestick score
input double            InpMinAtrPoints       = 3.0;            // Min ATR (points)
input double            InpMaxAtrPoints       = 180.0;          // Max ATR (0=off)

//--- inputs: scalping exits
input group "=== Quick Profit Scalping ==="
input double            InpTakeProfitPoints   = 12.0;           // Take profit (points)
input double            InpStopLossPoints     = 25.0;           // Stop loss (points)
input bool              InpUseTrailing        = true;           // Enable trailing stop
input double            InpTrailStartPoints   = 4.0;            // Trail start (points)
input double            InpTrailStepPoints    = 2.0;            // Trail step (points)

//--- inputs: reversal & multi-bet
input group "=== Reversal & Multi-Bet ==="
input bool              InpEnableReversal     = true;           // Reverse when market flips
input double            InpReverseLossPoints  = 6.0;            // Loss before reversal (points)
input int               InpMaxPositions       = 4;              // Max simultaneous positions
input int               InpSecondsBetweenTrades = 3;            // Min seconds between entries
input bool              InpTradeOnEveryTick   = true;           // Instant tick trading (no bar wait)

//--- inputs: risk guard
input group "=== Risk Guard ==="
input double            InpMaxDailyLossMoney  = 0.0;            // Max daily loss (0=off)
input int               InpMaxTradesPerDay    = 200;            // Max trades per day

//--- globals
CSignalEngine           g_signals;
CTradeManager           g_trades;
datetime                g_lastTradeTime = 0;
datetime                g_dayStamp = 0;
double                  g_dayStartEquity = 0.0;
int                     g_tradesToday = 0;
ulong                   g_tickCounter = 0;

//+------------------------------------------------------------------+
int OnInit()
  {
   if(InpLotSize <= 0.0)
     {
      Print("ScalpProfitBot: invalid lot size");
      return INIT_PARAMETERS_INCORRECT;
     }

   if(InpMaxPositions < 1)
     {
      Print("ScalpProfitBot: InpMaxPositions must be >= 1");
      return INIT_PARAMETERS_INCORRECT;
     }

   g_signals.Configure(_Symbol,
                       InpTfExecution,
                       InpTfFast,
                       InpTfMid,
                       InpTfSlow,
                       InpMinConfluence,
                       InpMinCandleScore);

   if(!g_signals.Init())
     {
      Print("ScalpProfitBot: failed to initialize indicators");
      return INIT_FAILED;
     }

   g_trades.Configure(_Symbol,
                      InpMagicNumber,
                      InpSlippagePoints,
                      InpLotSize,
                      InpTakeProfitPoints,
                      InpStopLossPoints,
                      InpUseTrailing,
                      InpTrailStartPoints,
                      InpTrailStepPoints,
                      InpMaxPositions);

   g_dayStamp = StringToTime(TimeToString(TimeCurrent(), TIME_DATE));
   g_dayStartEquity = AccountInfoDouble(ACCOUNT_EQUITY);
   g_tradesToday = 0;
   g_lastTradeTime = 0;

   // 1-second timer for position management even during quiet ticks
   EventSetTimer(1);

   Print("ScalpProfitBot started on ", _Symbol,
         " | instant trading=", (InpTradeOnEveryTick ? "ON" : "OFF"),
         " | confluence>=", InpMinConfluence);

   // Instant first evaluation
   ProcessTradingCycle(true);
   return INIT_SUCCEEDED;
  }

//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
   EventKillTimer();
   Comment("");
  }

//+------------------------------------------------------------------+
void OnTimer()
  {
   g_trades.ManageOpenPositions();
  }

//+------------------------------------------------------------------+
void OnTick()
  {
   g_tickCounter++;
   g_trades.ManageOpenPositions();

   if(!InpTradeOnEveryTick)
     {
      static datetime lastBar = 0;
      const datetime barTime = iTime(_Symbol, InpTfExecution, 0);
      if(barTime == lastBar)
         return;
      lastBar = barTime;
     }

   ProcessTradingCycle(false);
  }

//+------------------------------------------------------------------+
void ResetDailyStatsIfNeeded()
  {
   const datetime today = StringToTime(TimeToString(TimeCurrent(), TIME_DATE));
   if(today != g_dayStamp)
     {
      g_dayStamp = today;
      g_dayStartEquity = AccountInfoDouble(ACCOUNT_EQUITY);
      g_tradesToday = 0;
     }
  }

//+------------------------------------------------------------------+
bool IsDailyRiskBlocked()
  {
   ResetDailyStatsIfNeeded();

   if(g_tradesToday >= InpMaxTradesPerDay)
      return true;

   if(InpMaxDailyLossMoney > 0.0)
     {
      const double equity = AccountInfoDouble(ACCOUNT_EQUITY);
      const double loss = g_dayStartEquity - equity;
      if(loss >= InpMaxDailyLossMoney)
         return true;
     }

   return false;
  }

//+------------------------------------------------------------------+
bool CanOpenAnotherTrade()
  {
   if(IsDailyRiskBlocked())
      return false;

   if(g_lastTradeTime > 0 && (TimeCurrent() - g_lastTradeTime) < InpSecondsBetweenTrades)
      return false;

   return true;
  }

//+------------------------------------------------------------------+
void UpdateChartComment(const SSignalResult &sig)
  {
   const string text = StringFormat(
      "ScalpProfitBot | %s\n"
      "Signal: %s | Score: %d | BuyVotes: %d | SellVotes: %d\n"
      "Open: %d (B:%d S:%d) | Trades today: %d\n"
      "ATR: %.1f pts | Spread: %d | %s",
      _Symbol,
      (sig.direction == SCALP_SIGNAL_BUY ? "BUY" :
       sig.direction == SCALP_SIGNAL_SELL ? "SELL" : "NONE"),
      sig.score,
      sig.buyVotes,
      sig.sellVotes,
      g_trades.TotalPositions(),
      g_trades.BuyCount(),
      g_trades.SellCount(),
      g_tradesToday,
      g_signals.AtrPoints(),
      (int)SymbolInfoInteger(_Symbol, SYMBOL_SPREAD),
      sig.reason
   );
   Comment(text);
  }

//+------------------------------------------------------------------+
void ProcessTradingCycle(const bool forceEvaluate)
  {
   if(!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED))
      return;
   if(!MQLInfoInteger(MQL_TRADE_ALLOWED))
      return;

   if(!g_signals.IsMarketTradable(InpMaxSpreadPoints, InpMinAtrPoints, InpMaxAtrPoints))
     {
      SSignalResult empty;
      empty.direction = SCALP_SIGNAL_NONE;
      empty.reason = "Market filtered (spread/ATR/session)";
      UpdateChartComment(empty);
      return;
     }

   const SSignalResult signal = g_signals.Evaluate(false);
   UpdateChartComment(signal);

   // Auto-reversal: wrong-way position while strong opposite signal
   if(InpEnableReversal && signal.direction != SCALP_SIGNAL_NONE)
     {
      if(g_trades.HasLosingDirection(signal.direction, InpReverseLossPoints))
        {
         if(g_trades.ReverseTo(signal.direction, "ScalpReverse"))
           {
            g_lastTradeTime = TimeCurrent();
            g_tradesToday++;
            Print("Reversed to ", (signal.direction == SCALP_SIGNAL_BUY ? "BUY" : "SELL"),
                  " | ", signal.reason);
            return;
           }
        }
     }

   if(signal.direction == SCALP_SIGNAL_NONE)
      return;

   if(!CanOpenAnotherTrade() && !forceEvaluate)
      return;

   // Add to winning side or open first position
   if(signal.direction == SCALP_SIGNAL_BUY)
     {
      if(g_trades.SellCount() > 0 && InpEnableReversal)
        {
         g_trades.CloseDirection(POSITION_TYPE_SELL);
        }

      if(g_trades.TotalPositions() < InpMaxPositions)
        {
         if(g_trades.OpenBuy("ScalpBuy"))
           {
            g_lastTradeTime = TimeCurrent();
            g_tradesToday++;
            Print("BUY opened | ", signal.reason);
           }
        }
     }
   else if(signal.direction == SCALP_SIGNAL_SELL)
     {
      if(g_trades.BuyCount() > 0 && InpEnableReversal)
        {
         g_trades.CloseDirection(POSITION_TYPE_BUY);
        }

      if(g_trades.TotalPositions() < InpMaxPositions)
        {
         if(g_trades.OpenSell("ScalpSell"))
           {
            g_lastTradeTime = TimeCurrent();
            g_tradesToday++;
            Print("SELL opened | ", signal.reason);
           }
        }
     }
  }
//+------------------------------------------------------------------+
