//+------------------------------------------------------------------+
//|                                          EMA_RSI_RiskBot_v3.mq5  |
//|     EMA + RSI + ATR risk management (v3: fixed payoff & exits)   |
//|                                                                  |
//|  v3 changes vs v2.20:                                            |
//|   - Real reward:risk (ATR 1:2 by default) so trailing/BE matter  |
//|   - Working break-even + ATR trailing (no longer inert)          |
//|   - Higher-timeframe trend filter ON by default                  |
//|   - ATR-based adaptive stops ON by default                       |
//|   - Less overtrading (cooldown + lower daily cap, optional flip) |
//|   - Margin-aware lot sizing + verbose skip/entry logging         |
//|   - Init sanity warnings (timeframe / inert management)          |
//+------------------------------------------------------------------+
#property strict
#property version   "3.00"

#include <Trade/Trade.mqh>
CTrade trade;

// -------------------- Inputs --------------------
input group "Signal Settings"
input ENUM_TIMEFRAMES SignalTF = PERIOD_CURRENT; // follows chart; M15/H1 recommended
input int FastEMA = 5;
input int SlowEMA = 12;
input int EMASignalLookbackBars = 1; // bars to look back for a fresh crossover
input int RSIPeriod = 14;
input double RSIThreshold = 50.0; // buy if RSI > 50, sell if RSI < 50

input group "Entry Mode"
input bool UseStateEntry = false;          // false = wait for a fresh crossover (more selective)
input bool TradeImmediatelyOnStart = false;// true = open on the first allowed tick after attach
input bool ImmediateRequireRSI = true;     // require RSI agreement for the immediate start trade

input group "Trend Filter (Higher Timeframe)"
input bool UseTrendFilter = true;          // only trade in the higher-timeframe trend direction
input ENUM_TIMEFRAMES TrendTF = PERIOD_H4;
input int TrendEMAPeriod = 200;

input group "Volatility Stops (ATR)"
input bool UseFixedPipTargets = false;     // false = ATR-based adaptive stops (recommended)
input double StopLossPips = 15.0;          // used only if UseFixedPipTargets = true
input double TakeProfitPips = 30.0;        // 1:2 vs StopLossPips when fixed
input bool UseTakeProfit = true;           // false = no hard TP, let the trailing stop exit
input int ATRPeriod = 14;
input double SL_ATR_Mult = 1.5;
input double TP_ATR_Mult = 3.0;            // 3.0 / 1.5 = 1:2 reward:risk
input double MinSLPips = 15.0;             // ATR stop floor
input double MinTPPips = 30.0;             // ATR target floor (keeps ~1:2)

input group "Risk Settings"
input bool UseRiskBasedLots = true;
input double RiskPerTradePct = 0.50;       // % of balance risked per trade
input double FixedLots = 0.01;

input group "Execution Safety"
input int MaxSpreadPoints = 25;            // raise for Gold/indices (e.g. 60-120)
input int SlippagePoints = 10;
input int CooldownBars = 1;                // min bars between entries (reduces churn)
input bool OnePositionPerSymbol = true;
input bool AllowFlip = false;              // false = opposite signal only closes (no reopen)
input long MagicNumber = 20260622;
input bool VerboseLog = true;              // log why a trade was / wasn't taken (Experts tab)

input group "Account Protection"
input double MaxDailyLossPct = 3.0;
input int MaxTradesPerDay = 10;

input group "Trade Management"
input bool UseBreakEven = true;
input double BreakEvenRR = 1.0;            // move SL to BE at +1R
input int BreakEvenOffsetPoints = 5;       // lock a tiny profit at BE
input bool UseTrailingStop = true;
input double TrailStartRR = 1.5;           // start trailing at +1.5R
input double TrailATRMult = 1.5;           // ATR trail distance

input group "Session Filter (Server Time)"
input bool UseSessionFilter = true;
input int SessionStartHour = 8;   // inclusive
input int SessionEndHour = 21;    // exclusive

// -------------------- Globals --------------------
int gFastHandle = INVALID_HANDLE;
int gSlowHandle = INVALID_HANDLE;
int gRsiHandle  = INVALID_HANDLE;
int gAtrHandle  = INVALID_HANDLE;
int gTrendHandle = INVALID_HANDLE;

ENUM_TIMEFRAMES gSignalTF = PERIOD_CURRENT;

datetime gLastSignalBarTime = 0;
datetime gLastTradeBarTime = 0;
bool gHadOpenPosition = false;

// One-shot immediate entry flag (armed in OnInit when TradeImmediatelyOnStart is on).
bool gImmediateEntryPending = false;

datetime gTodayStart = 0;
double gDayStartEquity = 0.0;
int gTradesToday = 0;

// Throttle skip-reason logging to at most once per signal bar.
datetime gLastLogBar = 0;

void LogSkipOncePerBar(string reason)
{
   if(!VerboseLog) return;

   datetime bar = iTime(_Symbol, gSignalTF, 0);
   if(bar == gLastLogBar) return;

   gLastLogBar = bar;
   Print(_Symbol, ": no trade -> ", reason);
}

//+------------------------------------------------------------------+
//| Utility                                                          |
//+------------------------------------------------------------------+
double PipSize()
{
   return (_Digits == 3 || _Digits == 5) ? (10.0 * _Point) : _Point;
}

double PipsToPrice(double pips)
{
   return pips * PipSize();
}

double MinStopDistancePrice()
{
   return (double)SymbolInfoInteger(_Symbol, SYMBOL_TRADE_STOPS_LEVEL) * _Point;
}

int VolumePrecisionFromStep(double step)
{
   int prec = 0;
   while(step < 1.0 && prec < 8)
   {
      step *= 10.0;
      prec++;
   }
   return prec;
}

double NormalizeVolume(double lots)
{
   double vMin  = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   double vMax  = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX);
   double vStep = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);

   if(vStep <= 0.0) vStep = 0.01;

   lots = MathMax(vMin, MathMin(vMax, lots));
   lots = MathFloor(lots / vStep) * vStep;

   return NormalizeDouble(lots, VolumePrecisionFromStep(vStep));
}

double NormalizePrice(double price)
{
   double tickSize = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE);
   if(tickSize <= 0.0)
      return NormalizeDouble(price, _Digits);

   double rounded = MathRound(price / tickSize) * tickSize;
   return NormalizeDouble(rounded, _Digits);
}

datetime StartOfDay(datetime t)
{
   MqlDateTime dt;
   TimeToStruct(t, dt);
   dt.hour = 0;
   dt.min = 0;
   dt.sec = 0;
   return StructToTime(dt);
}

int CountTodayEntriesFromHistory()
{
   if(!HistorySelect(gTodayStart, TimeCurrent()))
      return 0;

   int count = 0;
   int total = HistoryDealsTotal();

   for(int i = 0; i < total; i++)
   {
      ulong deal = HistoryDealGetTicket(i);
      if(deal == 0) continue;

      string sym = HistoryDealGetString(deal, DEAL_SYMBOL);
      if(sym != _Symbol) continue;

      long mg = (long)HistoryDealGetInteger(deal, DEAL_MAGIC);
      if(mg != MagicNumber) continue;

      long entry = (long)HistoryDealGetInteger(deal, DEAL_ENTRY);
      if(entry == DEAL_ENTRY_IN)
         count++;
   }

   return count;
}

void UpdateDailyState()
{
   datetime today = StartOfDay(TimeCurrent());

   if(today != gTodayStart)
   {
      gTodayStart = today;
      gDayStartEquity = AccountInfoDouble(ACCOUNT_EQUITY);
      gTradesToday = CountTodayEntriesFromHistory();
   }
}

bool DailyLossLimitHit()
{
   if(MaxDailyLossPct <= 0.0) return false;
   if(gDayStartEquity <= 0.0) return false;

   double eq = AccountInfoDouble(ACCOUNT_EQUITY);
   double ddPct = ((gDayStartEquity - eq) / gDayStartEquity) * 100.0;
   return (ddPct >= MaxDailyLossPct);
}

bool InTradingSession()
{
   if(!UseSessionFilter) return true;
   if(SessionStartHour == SessionEndHour) return true;

   MqlDateTime dt;
   TimeToStruct(TimeCurrent(), dt);
   int h = dt.hour;

   if(SessionStartHour < SessionEndHour)
      return (h >= SessionStartHour && h < SessionEndHour);

   // Overnight session, e.g. 22 -> 6
   return (h >= SessionStartHour || h < SessionEndHour);
}

bool SpreadIsOK()
{
   if(MaxSpreadPoints <= 0) return true;

   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   if(ask <= 0.0 || bid <= 0.0) return false;

   double spreadPoints = (ask - bid) / _Point;
   return (spreadPoints <= MaxSpreadPoints);
}

bool IsNewSignalBar()
{
   datetime t = iTime(_Symbol, gSignalTF, 0);
   if(t <= 0) return false;

   if(t != gLastSignalBarTime)
   {
      gLastSignalBarTime = t;
      return true;
   }
   return false;
}

bool CooldownPassed()
{
   if(CooldownBars <= 0) return true;
   if(gLastTradeBarTime == 0) return true;

   int barsSince = iBarShift(_Symbol, gSignalTF, gLastTradeBarTime, false);
   if(barsSince < 0) return true;

   return (barsSince >= CooldownBars);
}

bool HasOpenPositionForEA()
{
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0) continue;
      if(!PositionSelectByTicket(ticket)) continue;

      string sym = PositionGetString(POSITION_SYMBOL);
      long mg = PositionGetInteger(POSITION_MAGIC);

      if(sym == _Symbol && mg == MagicNumber)
         return true;
   }
   return false;
}

bool HasBullishCrossover(const double &fastSeries[], const double &slowSeries[], int lookbackBars)
{
   int size = MathMin(ArraySize(fastSeries), ArraySize(slowSeries));
   if(size < 3) return false;

   int maxShift = MathMin(lookbackBars, size - 2);
   for(int shift = 1; shift <= maxShift; shift++)
   {
      bool crossUp = (fastSeries[shift] > slowSeries[shift] && fastSeries[shift + 1] <= slowSeries[shift + 1]);
      if(crossUp)
         return true;
   }
   return false;
}

bool HasBearishCrossover(const double &fastSeries[], const double &slowSeries[], int lookbackBars)
{
   int size = MathMin(ArraySize(fastSeries), ArraySize(slowSeries));
   if(size < 3) return false;

   int maxShift = MathMin(lookbackBars, size - 2);
   for(int shift = 1; shift <= maxShift; shift++)
   {
      bool crossDown = (fastSeries[shift] < slowSeries[shift] && fastSeries[shift + 1] >= slowSeries[shift + 1]);
      if(crossDown)
         return true;
   }
   return false;
}

bool GetOpenPositionForEA(ENUM_POSITION_TYPE &typeOut)
{
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0) continue;
      if(!PositionSelectByTicket(ticket)) continue;

      string sym = PositionGetString(POSITION_SYMBOL);
      long mg = PositionGetInteger(POSITION_MAGIC);
      if(sym == _Symbol && mg == MagicNumber)
      {
         typeOut = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
         return true;
      }
   }
   return false;
}

double CalculateLotsFromStopDistance(double stopDistPrice)
{
   if(!UseRiskBasedLots)
      return NormalizeVolume(FixedLots);

   if(stopDistPrice <= 0.0)
      return NormalizeVolume(FixedLots);

   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   double riskMoney = balance * (RiskPerTradePct / 100.0);

   double tickSize = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE);
   if(tickSize <= 0.0)
      return NormalizeVolume(FixedLots);

   double tickValue = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_VALUE_LOSS);
   if(tickValue <= 0.0)
      tickValue = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_VALUE);
   if(tickValue <= 0.0)
      return NormalizeVolume(FixedLots);

   double moneyPerLot = (stopDistPrice / tickSize) * tickValue;
   if(moneyPerLot <= 0.0)
      return NormalizeVolume(FixedLots);

   double lots = riskMoney / moneyPerLot;
   return NormalizeVolume(lots);
}

void BuildStops(bool isBuy, double entry, double atrValue, double &sl, double &tp, double &slDistanceOut)
{
   double slDist = 0.0;
   double tpDist = 0.0;
   double minStop = MinStopDistancePrice();

   if(UseFixedPipTargets)
   {
      slDist = MathMax(PipsToPrice(StopLossPips), minStop);
      tpDist = MathMax(PipsToPrice(TakeProfitPips), minStop);
   }
   else
   {
      double minSL = MathMax(PipsToPrice(MinSLPips), minStop);
      double minTP = MathMax(PipsToPrice(MinTPPips), minStop);
      slDist = MathMax(atrValue * SL_ATR_Mult, minSL);
      tpDist = MathMax(atrValue * TP_ATR_Mult, minTP);
   }

   slDistanceOut = slDist;

   if(isBuy)
   {
      sl = NormalizePrice(entry - slDist);
      tp = UseTakeProfit ? NormalizePrice(entry + tpDist) : 0.0;
   }
   else
   {
      sl = NormalizePrice(entry + slDist);
      tp = UseTakeProfit ? NormalizePrice(entry - tpDist) : 0.0;
   }
}

void RegisterNewTrade()
{
   gLastTradeBarTime = iTime(_Symbol, gSignalTF, 0);
   gTradesToday++;
}

// Cap requested lots so the required margin fits available free margin.
// Avoids silent "not enough money" rejections (common on Gold/indices).
double AdjustLotsForMargin(bool isBuy, double lots)
{
   double price = isBuy ? SymbolInfoDouble(_Symbol, SYMBOL_ASK)
                        : SymbolInfoDouble(_Symbol, SYMBOL_BID);
   if(price <= 0.0) return lots;

   ENUM_ORDER_TYPE ot = isBuy ? ORDER_TYPE_BUY : ORDER_TYPE_SELL;

   double marginOneLot = 0.0;
   if(!OrderCalcMargin(ot, _Symbol, 1.0, price, marginOneLot) || marginOneLot <= 0.0)
      return lots;

   double freeMargin = AccountInfoDouble(ACCOUNT_MARGIN_FREE);
   double usable = freeMargin * 0.95;
   double maxLots = usable / marginOneLot;

   if(lots > maxLots)
   {
      double capped = NormalizeVolume(maxLots);
      if(VerboseLog)
         Print(_Symbol, ": lots reduced for margin ", lots, " -> ", capped,
               " (freeMargin=", freeMargin, ", marginPerLot=", marginOneLot, ")");
      return capped;
   }
   return lots;
}

void OpenBuy(double atrValue)
{
   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   if(ask <= 0.0) return;

   double sl = 0.0, tp = 0.0, slDist = 0.0;
   BuildStops(true, ask, atrValue, sl, tp, slDist);

   double lots = CalculateLotsFromStopDistance(slDist);
   lots = AdjustLotsForMargin(true, lots);
   if(lots <= 0.0)
   {
      if(VerboseLog) Print(_Symbol, ": BUY skipped, lots <= 0 (margin / stop distance)");
      return;
   }

   trade.SetExpertMagicNumber(MagicNumber);
   trade.SetDeviationInPoints(SlippagePoints);

   bool ok = trade.Buy(lots, _Symbol, 0.0, sl, tp, "EMA_RSI_v3_BUY");
   if(ok)
   {
      RegisterNewTrade();
      if(VerboseLog) Print(_Symbol, ": BUY ", lots, " lots SL=", sl, " TP=", tp);
   }
   else
      Print(_Symbol, ": Buy failed. Retcode=", trade.ResultRetcode(), " ", trade.ResultRetcodeDescription(), " Error=", _LastError);
}

void OpenSell(double atrValue)
{
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   if(bid <= 0.0) return;

   double sl = 0.0, tp = 0.0, slDist = 0.0;
   BuildStops(false, bid, atrValue, sl, tp, slDist);

   double lots = CalculateLotsFromStopDistance(slDist);
   lots = AdjustLotsForMargin(false, lots);
   if(lots <= 0.0)
   {
      if(VerboseLog) Print(_Symbol, ": SELL skipped, lots <= 0 (margin / stop distance)");
      return;
   }

   trade.SetExpertMagicNumber(MagicNumber);
   trade.SetDeviationInPoints(SlippagePoints);

   bool ok = trade.Sell(lots, _Symbol, 0.0, sl, tp, "EMA_RSI_v3_SELL");
   if(ok)
   {
      RegisterNewTrade();
      if(VerboseLog) Print(_Symbol, ": SELL ", lots, " lots SL=", sl, " TP=", tp);
   }
   else
      Print(_Symbol, ": Sell failed. Retcode=", trade.ResultRetcode(), " ", trade.ResultRetcodeDescription(), " Error=", _LastError);
}

void ManageOpenPositions()
{
   double atrBuf[];
   ArraySetAsSeries(atrBuf, true);
   if(CopyBuffer(gAtrHandle, 0, 0, 2, atrBuf) < 1)
      return;

   double atrNow = atrBuf[0];
   if(atrNow <= 0.0)
      return;

   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double minStop = MinStopDistancePrice();

   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0) continue;
      if(!PositionSelectByTicket(ticket)) continue;

      string sym = PositionGetString(POSITION_SYMBOL);
      long mg = PositionGetInteger(POSITION_MAGIC);
      if(sym != _Symbol || mg != MagicNumber) continue;

      ENUM_POSITION_TYPE type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
      double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
      double sl = PositionGetDouble(POSITION_SL);
      double tp = PositionGetDouble(POSITION_TP);

      if(sl <= 0.0) continue; // required to compute initial R

      double initialRisk = MathAbs(openPrice - sl);
      if(initialRisk <= 0.0) continue;

      double profitDist = 0.0;
      if(type == POSITION_TYPE_BUY)  profitDist = bid - openPrice;
      if(type == POSITION_TYPE_SELL) profitDist = openPrice - ask;

      double newSL = sl;
      bool modify = false;

      // Break-even
      if(UseBreakEven && profitDist >= initialRisk * BreakEvenRR)
      {
         if(type == POSITION_TYPE_BUY)
         {
            double beSL = NormalizePrice(openPrice + BreakEvenOffsetPoints * _Point);
            if(beSL > newSL)
            {
               newSL = beSL;
               modify = true;
            }
         }
         else if(type == POSITION_TYPE_SELL)
         {
            double beSL = NormalizePrice(openPrice - BreakEvenOffsetPoints * _Point);
            if(beSL < newSL)
            {
               newSL = beSL;
               modify = true;
            }
         }
      }

      // ATR trailing
      if(UseTrailingStop && profitDist >= initialRisk * TrailStartRR)
      {
         double trailDist = atrNow * TrailATRMult;

         if(type == POSITION_TYPE_BUY)
         {
            double trailSL = NormalizePrice(bid - trailDist);
            if(trailSL > newSL)
            {
               newSL = trailSL;
               modify = true;
            }
         }
         else if(type == POSITION_TYPE_SELL)
         {
            double trailSL = NormalizePrice(ask + trailDist);
            if(trailSL < newSL)
            {
               newSL = trailSL;
               modify = true;
            }
         }
      }

      if(!modify) continue;

      // Respect minimum stop distance from current price
      if(type == POSITION_TYPE_BUY)
      {
         double maxAllowedSL = NormalizePrice(bid - minStop);
         if(newSL > maxAllowedSL) newSL = maxAllowedSL;
         if(newSL <= sl) continue; // never worsen/duplicate
      }
      else if(type == POSITION_TYPE_SELL)
      {
         double minAllowedSL = NormalizePrice(ask + minStop);
         if(newSL < minAllowedSL) newSL = minAllowedSL;
         if(newSL >= sl) continue; // never worsen/duplicate
      }

      if(!trade.PositionModify(sym, newSL, tp))
      {
         Print("PositionModify failed. Symbol=", sym, " Retcode=", trade.ResultRetcode(),
               " ", trade.ResultRetcodeDescription(), " Error=", _LastError);
      }
   }
}

//+------------------------------------------------------------------+
//| Init-time sanity warnings (do not block trading)                 |
//+------------------------------------------------------------------+
void WarnOnConfig()
{
   if(!VerboseLog) return;

   if(PeriodSeconds(gSignalTF) < PeriodSeconds(PERIOD_M15))
      Print("WARNING: timeframe is below M15. Spread is a large fraction of small targets here; M15/H1 is recommended.");

   double rr = UseFixedPipTargets ? (StopLossPips > 0.0 ? TakeProfitPips / StopLossPips : 0.0)
                                   : (SL_ATR_Mult  > 0.0 ? TP_ATR_Mult  / SL_ATR_Mult   : 0.0);

   if(UseTakeProfit && rr > 0.0)
   {
      if(rr <= 1.05)
         Print("WARNING: reward:risk is ~1:1 (rr=", DoubleToString(rr, 2), "). Consider TP >= 2x SL for positive expectancy.");
      if(TrailStartRR >= rr)
         Print("WARNING: TrailStartRR (", DoubleToString(TrailStartRR, 2), ") >= TP reward (", DoubleToString(rr, 2),
               "R). Trailing will rarely trigger because TP closes the trade first.");
      if(BreakEvenRR >= rr)
         Print("WARNING: BreakEvenRR (", DoubleToString(BreakEvenRR, 2), ") >= TP reward (", DoubleToString(rr, 2),
               "R). Break-even fires at/after the TP and adds little value.");
   }
}

//+------------------------------------------------------------------+
//| Expert initialization                                            |
//+------------------------------------------------------------------+
int OnInit()
{
   if(FastEMA <= 0 || SlowEMA <= 0 || RSIPeriod <= 0 || ATRPeriod <= 0 || TrendEMAPeriod <= 0)
      return INIT_PARAMETERS_INCORRECT;
   if(FastEMA >= SlowEMA)
      return INIT_PARAMETERS_INCORRECT;
   if(EMASignalLookbackBars < 1)
      return INIT_PARAMETERS_INCORRECT;
   if(RSIThreshold <= 0.0 || RSIThreshold >= 100.0)
      return INIT_PARAMETERS_INCORRECT;
   if(UseFixedPipTargets && (StopLossPips <= 0.0 || (UseTakeProfit && TakeProfitPips <= 0.0)))
      return INIT_PARAMETERS_INCORRECT;
   if(!UseFixedPipTargets && (SL_ATR_Mult <= 0.0 || (UseTakeProfit && TP_ATR_Mult <= 0.0)))
      return INIT_PARAMETERS_INCORRECT;

   gSignalTF = (SignalTF == PERIOD_CURRENT) ? (ENUM_TIMEFRAMES)_Period : SignalTF;

   gFastHandle = iMA(_Symbol, gSignalTF, FastEMA, 0, MODE_EMA, PRICE_CLOSE);
   gSlowHandle = iMA(_Symbol, gSignalTF, SlowEMA, 0, MODE_EMA, PRICE_CLOSE);
   gRsiHandle  = iRSI(_Symbol, gSignalTF, RSIPeriod, PRICE_CLOSE);
   gAtrHandle  = iATR(_Symbol, gSignalTF, ATRPeriod);
   gTrendHandle = iMA(_Symbol, TrendTF, TrendEMAPeriod, 0, MODE_EMA, PRICE_CLOSE);

   if(gFastHandle == INVALID_HANDLE || gSlowHandle == INVALID_HANDLE ||
      gRsiHandle == INVALID_HANDLE  || gAtrHandle == INVALID_HANDLE ||
      gTrendHandle == INVALID_HANDLE)
   {
      Print("Failed to create indicator handles.");
      return INIT_FAILED;
   }

   gImmediateEntryPending = TradeImmediatelyOnStart;

   if(VerboseLog)
   {
      Print(_Symbol, " specs -> digits=", _Digits,
            " point=", _Point,
            " pip=", PipSize(),
            " stopsLevel(pts)=", SymbolInfoInteger(_Symbol, SYMBOL_TRADE_STOPS_LEVEL),
            " volMin=", SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN),
            " volMax=", SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX),
            " volStep=", SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP));
   }
   WarnOnConfig();

   UpdateDailyState();
   return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
//| Expert deinitialization                                          |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   if(gFastHandle != INVALID_HANDLE)  IndicatorRelease(gFastHandle);
   if(gSlowHandle != INVALID_HANDLE)  IndicatorRelease(gSlowHandle);
   if(gRsiHandle != INVALID_HANDLE)   IndicatorRelease(gRsiHandle);
   if(gAtrHandle != INVALID_HANDLE)   IndicatorRelease(gAtrHandle);
   if(gTrendHandle != INVALID_HANDLE) IndicatorRelease(gTrendHandle);
}

//+------------------------------------------------------------------+
//| Expert tick                                                      |
//+------------------------------------------------------------------+
void OnTick()
{
   UpdateDailyState();
   ManageOpenPositions(); // always manage open trades first

   if(!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED))
      return;

   bool hasOpenPositionNow = HasOpenPositionForEA();
   if(gHadOpenPosition && !hasOpenPositionNow)
   {
      gLastTradeBarTime = 0;
      gLastSignalBarTime = 0;
   }
   gHadOpenPosition = hasOpenPositionNow;

   if(DailyLossLimitHit())
   {
      Comment("EA paused: daily loss limit hit.");
      return;
   }
   Comment("");

   if(!InTradingSession())
   {
      LogSkipOncePerBar("outside trading session window");
      return;
   }
   if(!SpreadIsOK())
   {
      double curSpread = (SymbolInfoDouble(_Symbol, SYMBOL_ASK) - SymbolInfoDouble(_Symbol, SYMBOL_BID)) / _Point;
      LogSkipOncePerBar(StringFormat("spread too high: %.0f pts > MaxSpreadPoints=%d (raise it for Gold/indices)",
                                     curSpread, MaxSpreadPoints));
      return;
   }

   double fast[], slow[], rsi[], atr[];
   ArraySetAsSeries(fast, true);
   ArraySetAsSeries(slow, true);
   ArraySetAsSeries(rsi, true);
   ArraySetAsSeries(atr, true);

   int signalBars = MathMax(3, EMASignalLookbackBars + 2);

   int c1 = CopyBuffer(gFastHandle, 0, 0, signalBars, fast);
   int c2 = CopyBuffer(gSlowHandle, 0, 0, signalBars, slow);
   int c3 = CopyBuffer(gRsiHandle,  0, 0, signalBars, rsi);
   int c4 = CopyBuffer(gAtrHandle,  0, 0, 3, atr);

   if(c1 < signalBars || c2 < signalBars || c3 < signalBars || c4 < 3) return;
   if(atr[1] <= 0.0) return;

   bool rsiBull = (rsi[1] > RSIThreshold);
   bool rsiBear = (rsi[1] < RSIThreshold);

   bool trendBull = true;
   bool trendBear = true;

   if(UseTrendFilter)
   {
      double trend[];
      ArraySetAsSeries(trend, true);
      if(CopyBuffer(gTrendHandle, 0, 0, 3, trend) < 3) return;

      double trendClose = iClose(_Symbol, TrendTF, 1);
      if(trendClose <= 0.0) return;

      trendBull = (trendClose > trend[1]);
      trendBear = (trendClose < trend[1]);
   }

   bool emaBull = (fast[1] > slow[1]);
   bool emaBear = (fast[1] < slow[1]);

   // ----------------------------------------------------------------
   // One-shot immediate start entry (only if TradeImmediatelyOnStart).
   // ----------------------------------------------------------------
   if(gImmediateEntryPending && !hasOpenPositionNow)
   {
      bool immBuy  = emaBull && (!ImmediateRequireRSI || rsiBull) && trendBull;
      bool immSell = emaBear && (!ImmediateRequireRSI || rsiBear) && trendBear;

      if((immBuy || immSell) && CooldownPassed() && gTradesToday < MaxTradesPerDay)
      {
         if(immBuy) OpenBuy(atr[1]);
         else       OpenSell(atr[1]);

         gImmediateEntryPending = false;
         gHadOpenPosition = HasOpenPositionForEA();
         return;
      }
   }

   if(!IsNewSignalBar()) return;

   // Entry direction:
   //  - UseStateEntry = false -> require a fresh EMA crossover (selective, default).
   //  - UseStateEntry = true  -> use current EMA alignment (more trades).
   bool bullishSetup = UseStateEntry ? emaBull : HasBullishCrossover(fast, slow, EMASignalLookbackBars);
   bool bearishSetup = UseStateEntry ? emaBear : HasBearishCrossover(fast, slow, EMASignalLookbackBars);

   bool buySignal = bullishSetup && rsiBull && trendBull;
   bool sellSignal = bearishSetup && rsiBear && trendBear;

   // Opposite-signal handling for an open position.
   if(hasOpenPositionNow && OnePositionPerSymbol)
   {
      ENUM_POSITION_TYPE openType = POSITION_TYPE_BUY;
      if(GetOpenPositionForEA(openType))
      {
         bool opposite = (openType == POSITION_TYPE_BUY && sellSignal) ||
                         (openType == POSITION_TYPE_SELL && buySignal);

         if(opposite)
         {
            if(trade.PositionClose(_Symbol))
            {
               if(VerboseLog) Print(_Symbol, ": closed on opposite signal", (AllowFlip ? " (flipping)" : ""));
               gHadOpenPosition = false;

               if(AllowFlip)
               {
                  if(openType == POSITION_TYPE_BUY) OpenSell(atr[1]);
                  else                              OpenBuy(atr[1]);
                  gHadOpenPosition = HasOpenPositionForEA();
               }
            }
            else
            {
               Print(_Symbol, ": failed to close on opposite signal. Retcode=", trade.ResultRetcode(),
                     " ", trade.ResultRetcodeDescription(), " Error=", _LastError);
            }
         }
      }
      return;
   }

   if(!CooldownPassed()) return;
   if(gTradesToday >= MaxTradesPerDay)
   {
      LogSkipOncePerBar("max trades per day reached");
      return;
   }

   if(buySignal) OpenBuy(atr[1]);
   else if(sellSignal) OpenSell(atr[1]);
}
