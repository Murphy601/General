//+------------------------------------------------------------------+
//|                                    ScalpProfitBot_AllInOne.mq5   |
//|  ONE FILE - copy entire code into MetaEditor, compile, attach     |
//|  Multi-TF scalping | candles | RSI/MACD/Stoch | reversal        |
//+------------------------------------------------------------------+
#property copyright   "ScalpProfitBot"
#property version     "1.10"
#property description "All-in-one scalping bot - no extra files needed"

#include <Trade/Trade.mqh>

//+------------------------------------------------------------------+
//| SECTION 1: CANDLESTICK PATTERNS                                  |
//+------------------------------------------------------------------+
struct SCandleMetrics
  {
   double open, high, low, close, body, upperWick, lowerWick, range;
   bool   bullish, bearish;
  };

bool ScalpGetCandleMetrics(const string symbol, const ENUM_TIMEFRAMES tf,
                           const int shift, SCandleMetrics &m)
  {
   m.open  = iOpen(symbol, tf, shift);
   m.high  = iHigh(symbol, tf, shift);
   m.low   = iLow(symbol, tf, shift);
   m.close = iClose(symbol, tf, shift);
   if(m.open == 0.0 && m.high == 0.0 && m.low == 0.0 && m.close == 0.0)
      return false;
   m.body      = MathAbs(m.close - m.open);
   m.range     = m.high - m.low;
   m.upperWick = m.high - MathMax(m.open, m.close);
   m.lowerWick = MathMin(m.open, m.close) - m.low;
   m.bullish   = (m.close > m.open);
   m.bearish   = (m.close < m.open);
   return (m.range > 0.0);
  }

double ScalpBodyRatio(const SCandleMetrics &m)
  {
   return (m.range <= 0.0) ? 0.0 : m.body / m.range;
  }

bool ScalpIsDoji(const SCandleMetrics &m, const double maxBodyRatio = 0.12)
  {
   return (ScalpBodyRatio(m) <= maxBodyRatio);
  }

bool ScalpIsBullishEngulfing(const string symbol, const ENUM_TIMEFRAMES tf, const int shift)
  {
   SCandleMetrics c1, c0;
   if(!ScalpGetCandleMetrics(symbol, tf, shift + 1, c1)) return false;
   if(!ScalpGetCandleMetrics(symbol, tf, shift, c0)) return false;
   if(!c1.bearish || !c0.bullish) return false;
   return (c0.open <= c1.close && c0.close >= c1.open && c0.body > c1.body * 0.85);
  }

bool ScalpIsBearishEngulfing(const string symbol, const ENUM_TIMEFRAMES tf, const int shift)
  {
   SCandleMetrics c1, c0;
   if(!ScalpGetCandleMetrics(symbol, tf, shift + 1, c1)) return false;
   if(!ScalpGetCandleMetrics(symbol, tf, shift, c0)) return false;
   if(!c1.bullish || !c0.bearish) return false;
   return (c0.open >= c1.close && c0.close <= c1.open && c0.body > c1.body * 0.85);
  }

bool ScalpIsHammer(const SCandleMetrics &m, const bool bullishContext = true)
  {
   if(m.range <= 0.0) return false;
   const double bodyRatio  = ScalpBodyRatio(m);
   const double lowerRatio = m.lowerWick / m.range;
   const double upperRatio = m.upperWick / m.range;
   if(bodyRatio > 0.35 || lowerRatio < 0.55 || upperRatio > 0.20) return false;
   return bullishContext ? true : (m.close >= m.open);
  }

bool ScalpIsShootingStar(const SCandleMetrics &m)
  {
   if(m.range <= 0.0) return false;
   const double bodyRatio  = ScalpBodyRatio(m);
   const double upperRatio = m.upperWick / m.range;
   const double lowerRatio = m.lowerWick / m.range;
   if(bodyRatio > 0.35 || upperRatio < 0.55 || lowerRatio > 0.20) return false;
   return true;
  }

bool ScalpIsThreeWhiteSoldiers(const string symbol, const ENUM_TIMEFRAMES tf, const int shift)
  {
   SCandleMetrics c2, c1, c0;
   if(!ScalpGetCandleMetrics(symbol, tf, shift + 2, c2)) return false;
   if(!ScalpGetCandleMetrics(symbol, tf, shift + 1, c1)) return false;
   if(!ScalpGetCandleMetrics(symbol, tf, shift, c0)) return false;
   if(!c2.bullish || !c1.bullish || !c0.bullish) return false;
   if(!(c1.close > c2.close && c0.close > c1.close)) return false;
   if(!(c1.open >= c2.open && c1.open <= c2.close)) return false;
   if(!(c0.open >= c1.open && c0.open <= c1.close)) return false;
   return true;
  }

bool ScalpIsThreeBlackCrows(const string symbol, const ENUM_TIMEFRAMES tf, const int shift)
  {
   SCandleMetrics c2, c1, c0;
   if(!ScalpGetCandleMetrics(symbol, tf, shift + 2, c2)) return false;
   if(!ScalpGetCandleMetrics(symbol, tf, shift + 1, c1)) return false;
   if(!ScalpGetCandleMetrics(symbol, tf, shift, c0)) return false;
   if(!c2.bearish || !c1.bearish || !c0.bearish) return false;
   if(!(c1.close < c2.close && c0.close < c1.close)) return false;
   if(!(c1.open <= c2.open && c1.open >= c2.close)) return false;
   if(!(c0.open <= c1.open && c0.open >= c1.close)) return false;
   return true;
  }

int ScalpCandlePatternScore(const string symbol, const ENUM_TIMEFRAMES tf, const int shift)
  {
   int score = 0;
   SCandleMetrics c0;
   if(!ScalpGetCandleMetrics(symbol, tf, shift, c0)) return 0;
   if(ScalpIsBullishEngulfing(symbol, tf, shift)) score += 18;
   if(ScalpIsBearishEngulfing(symbol, tf, shift)) score -= 18;
   if(ScalpIsHammer(c0, true)) score += 12;
   if(ScalpIsShootingStar(c0)) score -= 12;
   if(ScalpIsThreeWhiteSoldiers(symbol, tf, shift)) score += 15;
   if(ScalpIsThreeBlackCrows(symbol, tf, shift)) score -= 15;
   if(ScalpIsDoji(c0))
     {
      SCandleMetrics c1;
      if(ScalpGetCandleMetrics(symbol, tf, shift + 1, c1))
        {
         if(c1.bearish && c0.close >= c1.close) score += 6;
         if(c1.bullish && c0.close <= c1.close) score -= 6;
        }
     }
   if(c0.bullish && ScalpBodyRatio(c0) > 0.65) score += 5;
   if(c0.bearish && ScalpBodyRatio(c0) > 0.65) score -= 5;
   return score;
  }

//+------------------------------------------------------------------+
//| SECTION 2: SIGNAL ENGINE                                         |
//+------------------------------------------------------------------+
enum ENUM_SCALP_SIGNAL
  {
   SCALP_SIGNAL_NONE = 0,
   SCALP_SIGNAL_BUY  = 1,
   SCALP_SIGNAL_SELL = -1
  };

struct SSignalResult
  {
   ENUM_SCALP_SIGNAL direction;
   int               score, buyVotes, sellVotes;
   string            reason;
  };

class CSignalEngine
  {
private:
   string          m_symbol;
   ENUM_TIMEFRAMES m_tfExec, m_tfFast, m_tfMid, m_tfSlow;
   int             m_emaFastExec, m_emaSlowExec, m_rsiHandle, m_macdHandle, m_stochHandle, m_atrHandle;
   int             m_minConfluence, m_minCandleScore;

   bool ResetHandle(int &handle)
     {
      if(handle != INVALID_HANDLE) { IndicatorRelease(handle); handle = INVALID_HANDLE; }
      return true;
     }

   bool EmaTrend(const ENUM_TIMEFRAMES tf, const int fastPeriod, const int slowPeriod, int &vote) const
     {
      const int fastHandle = iMA(m_symbol, tf, fastPeriod, 0, MODE_EMA, PRICE_CLOSE);
      const int slowHandle = iMA(m_symbol, tf, slowPeriod, 0, MODE_EMA, PRICE_CLOSE);
      if(fastHandle == INVALID_HANDLE || slowHandle == INVALID_HANDLE)
        {
         if(fastHandle != INVALID_HANDLE) IndicatorRelease(fastHandle);
         if(slowHandle != INVALID_HANDLE) IndicatorRelease(slowHandle);
         return false;
        }
      double fastBuf[], slowBuf[];
      ArraySetAsSeries(fastBuf, true);
      ArraySetAsSeries(slowBuf, true);
      if(CopyBuffer(fastHandle, 0, 0, 3, fastBuf) < 3 || CopyBuffer(slowHandle, 0, 0, 3, slowBuf) < 3)
        {
         IndicatorRelease(fastHandle);
         IndicatorRelease(slowHandle);
         return false;
        }
      const double price = iClose(m_symbol, tf, 0);
      if(fastBuf[0] > slowBuf[0] && price > fastBuf[0] && fastBuf[0] > fastBuf[1]) vote += 1;
      else if(fastBuf[0] < slowBuf[0] && price < fastBuf[0] && fastBuf[0] < fastBuf[1]) vote -= 1;
      IndicatorRelease(fastHandle);
      IndicatorRelease(slowHandle);
      return true;
     }

   bool RsiVote(int &vote) const
     {
      double rsi[];
      ArraySetAsSeries(rsi, true);
      if(CopyBuffer(m_rsiHandle, 0, 0, 3, rsi) < 3) return false;
      if(rsi[1] < 32.0 && rsi[0] > rsi[1] && rsi[0] < 55.0) vote += 1;
      else if(rsi[1] > 68.0 && rsi[0] < rsi[1] && rsi[0] > 45.0) vote -= 1;
      else if(rsi[0] > 52.0 && rsi[0] > rsi[1]) vote += 1;
      else if(rsi[0] < 48.0 && rsi[0] < rsi[1]) vote -= 1;
      return true;
     }

   bool MacdVote(int &vote) const
     {
      double main[], signal[];
      ArraySetAsSeries(main, true);
      ArraySetAsSeries(signal, true);
      if(CopyBuffer(m_macdHandle, 0, 0, 3, main) < 3) return false;
      if(CopyBuffer(m_macdHandle, 1, 0, 3, signal) < 3) return false;
      if(main[0] > signal[0] && main[0] > main[1]) vote += 1;
      else if(main[0] < signal[0] && main[0] < main[1]) vote -= 1;
      return true;
     }

   bool StochVote(int &vote) const
     {
      double k[], d[];
      ArraySetAsSeries(k, true);
      ArraySetAsSeries(d, true);
      if(CopyBuffer(m_stochHandle, 0, 0, 3, k) < 3) return false;
      if(CopyBuffer(m_stochHandle, 1, 0, 3, d) < 3) return false;
      if(k[1] < 22.0 && k[0] > d[0] && k[0] > k[1]) vote += 1;
      else if(k[1] > 78.0 && k[0] < d[0] && k[0] < k[1]) vote -= 1;
      return true;
     }

   bool ExecEmaVote(int &vote) const
     {
      double fast[], slow[];
      ArraySetAsSeries(fast, true);
      ArraySetAsSeries(slow, true);
      if(CopyBuffer(m_emaFastExec, 0, 0, 2, fast) < 2) return false;
      if(CopyBuffer(m_emaSlowExec, 0, 0, 2, slow) < 2) return false;
      const double price = SymbolInfoDouble(m_symbol, SYMBOL_BID);
      if(price > fast[0] && fast[0] > slow[0]) vote += 1;
      else if(price < fast[0] && fast[0] < slow[0]) vote -= 1;
      return true;
     }

public:
   CSignalEngine(void)
     {
      m_symbol = _Symbol;
      m_tfExec = PERIOD_M1; m_tfFast = PERIOD_M1; m_tfMid = PERIOD_M5; m_tfSlow = PERIOD_M15;
      m_emaFastExec = m_emaSlowExec = m_rsiHandle = m_macdHandle = m_stochHandle = m_atrHandle = INVALID_HANDLE;
      m_minConfluence = 72; m_minCandleScore = 8;
     }

   ~CSignalEngine(void)
     {
      ResetHandle(m_emaFastExec); ResetHandle(m_emaSlowExec);
      ResetHandle(m_rsiHandle); ResetHandle(m_macdHandle);
      ResetHandle(m_stochHandle); ResetHandle(m_atrHandle);
     }

   void Configure(const string symbol, const ENUM_TIMEFRAMES tfExec,
                  const ENUM_TIMEFRAMES tfFast, const ENUM_TIMEFRAMES tfMid,
                  const ENUM_TIMEFRAMES tfSlow, const int minConfluence, const int minCandleScore)
     {
      m_symbol = symbol; m_tfExec = tfExec; m_tfFast = tfFast;
      m_tfMid = tfMid; m_tfSlow = tfSlow;
      m_minConfluence = minConfluence; m_minCandleScore = minCandleScore;
     }

   bool Init(void)
     {
      ResetHandle(m_emaFastExec); ResetHandle(m_emaSlowExec);
      ResetHandle(m_rsiHandle); ResetHandle(m_macdHandle);
      ResetHandle(m_stochHandle); ResetHandle(m_atrHandle);
      m_emaFastExec = iMA(m_symbol, m_tfExec, 8, 0, MODE_EMA, PRICE_CLOSE);
      m_emaSlowExec = iMA(m_symbol, m_tfExec, 21, 0, MODE_EMA, PRICE_CLOSE);
      m_rsiHandle   = iRSI(m_symbol, m_tfExec, 14, PRICE_CLOSE);
      m_macdHandle  = iMACD(m_symbol, m_tfExec, 12, 26, 9, PRICE_CLOSE);
      m_stochHandle = iStochastic(m_symbol, m_tfExec, 5, 3, 3, MODE_SMA, STO_LOWHIGH);
      m_atrHandle   = iATR(m_symbol, m_tfExec, 14);
      return (m_emaFastExec != INVALID_HANDLE && m_emaSlowExec != INVALID_HANDLE &&
              m_rsiHandle != INVALID_HANDLE && m_macdHandle != INVALID_HANDLE &&
              m_stochHandle != INVALID_HANDLE && m_atrHandle != INVALID_HANDLE);
     }

   bool IsMarketTradable(const int maxSpreadPoints, const double minAtrPoints, const double maxAtrPoints) const
     {
      if(SymbolInfoInteger(m_symbol, SYMBOL_SPREAD) > maxSpreadPoints) return false;
      double atr[];
      ArraySetAsSeries(atr, true);
      if(CopyBuffer(m_atrHandle, 0, 0, 1, atr) < 1) return false;
      const double atrPoints = atr[0] / _Point;
      if(atrPoints < minAtrPoints) return false;
      if(maxAtrPoints > 0.0 && atrPoints > maxAtrPoints) return false;
      if(SymbolInfoInteger(m_symbol, SYMBOL_TRADE_MODE) == SYMBOL_TRADE_MODE_DISABLED) return false;
      return true;
     }

   double AtrPoints(void) const
     {
      double atr[];
      ArraySetAsSeries(atr, true);
      if(CopyBuffer(m_atrHandle, 0, 0, 1, atr) < 1) return 0.0;
      return atr[0] / _Point;
     }

   SSignalResult Evaluate(const bool allowWeakSignal = false) const
     {
      SSignalResult result;
      result.direction = SCALP_SIGNAL_NONE;
      result.score = 0; result.buyVotes = 0; result.sellVotes = 0;
      result.reason = "No signal";

      int vote = 0;
      ExecEmaVote(vote);
      EmaTrend(m_tfFast, 8, 21, vote);
      EmaTrend(m_tfMid, 8, 21, vote);
      EmaTrend(m_tfSlow, 21, 50, vote);
      RsiVote(vote); MacdVote(vote); StochVote(vote);

      const int candleExec = ScalpCandlePatternScore(m_symbol, m_tfExec, 1);
      const int candleMid  = ScalpCandlePatternScore(m_symbol, m_tfMid, 1);
      const int candleScore = candleExec + (int)MathRound(candleMid * 0.6);
      const int score = vote * 12 + candleScore;

      if(vote > 0) result.buyVotes = vote;
      if(vote < 0) result.sellVotes = -vote;
      result.score = score;

      const int threshold = allowWeakSignal ? (m_minConfluence - 12) : m_minConfluence;
      if(score >= threshold && candleScore >= m_minCandleScore)
        {
         result.direction = SCALP_SIGNAL_BUY;
         result.reason = StringFormat("BUY confluence=%d candle=%d votes=%d", score, candleScore, vote);
        }
      else if(score <= -threshold && candleScore <= -m_minCandleScore)
        {
         result.direction = SCALP_SIGNAL_SELL;
         result.reason = StringFormat("SELL confluence=%d candle=%d votes=%d", score, candleScore, vote);
        }
      return result;
     }
  };

//+------------------------------------------------------------------+
//| SECTION 3: TRADE MANAGER                                         |
//+------------------------------------------------------------------+
class CTradeManager
  {
private:
   CTrade   m_trade;
   string   m_symbol;
   ulong    m_magic;
   int      m_deviation, m_maxPositions, m_digits;
   double   m_lot, m_tpPoints, m_slPoints, m_point;
   bool     m_useTrailing;
   double   m_trailStartPoints, m_trailStepPoints;

   double NormalizePrice(const double price) const { return NormalizeDouble(price, m_digits); }

   double NormalizeLot(const double lot) const
     {
      double minLot  = SymbolInfoDouble(m_symbol, SYMBOL_VOLUME_MIN);
      double maxLot  = SymbolInfoDouble(m_symbol, SYMBOL_VOLUME_MAX);
      double stepLot = SymbolInfoDouble(m_symbol, SYMBOL_VOLUME_STEP);
      if(stepLot <= 0.0) stepLot = 0.01;
      return NormalizeDouble(MathMax(minLot, MathMin(maxLot, MathFloor(lot / stepLot) * stepLot)), 2);
     }

   int CountPositions(const long typeFilter = -1) const
     {
      int count = 0;
      for(int i = 0; i < PositionsTotal(); i++)
        {
         const ulong ticket = PositionGetTicket(i);
         if(ticket == 0 || !PositionSelectByTicket(ticket)) continue;
         if(PositionGetString(POSITION_SYMBOL) != m_symbol) continue;
         if((ulong)PositionGetInteger(POSITION_MAGIC) != m_magic) continue;
         if(typeFilter >= 0 && PositionGetInteger(POSITION_TYPE) != typeFilter) continue;
         count++;
        }
      return count;
     }

public:
   CTradeManager(void)
     {
      m_symbol = _Symbol; m_magic = 880071; m_deviation = 20;
      m_lot = 0.01; m_tpPoints = 12.0; m_slPoints = 25.0;
      m_useTrailing = true; m_trailStartPoints = 4.0; m_trailStepPoints = 2.0;
      m_maxPositions = 4; m_point = _Point; m_digits = _Digits;
     }

   void Configure(const string symbol, const ulong magic, const int deviation,
                  const double lot, const double tpPoints, const double slPoints,
                  const bool useTrailing, const double trailStartPoints,
                  const double trailStepPoints, const int maxPositions)
     {
      m_symbol = symbol; m_magic = magic; m_deviation = deviation;
      m_lot = lot; m_tpPoints = tpPoints; m_slPoints = slPoints;
      m_useTrailing = useTrailing; m_trailStartPoints = trailStartPoints;
      m_trailStepPoints = trailStepPoints; m_maxPositions = maxPositions;
      m_point = SymbolInfoDouble(symbol, SYMBOL_POINT);
      m_digits = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);
      m_trade.SetExpertMagicNumber((long)m_magic);
      m_trade.SetDeviationInPoints(m_deviation);
      m_trade.SetTypeFillingBySymbol(m_symbol);
     }

   int TotalPositions(void) const { return CountPositions(-1); }
   int BuyCount(void) const { return CountPositions(POSITION_TYPE_BUY); }
   int SellCount(void) const { return CountPositions(POSITION_TYPE_SELL); }

   bool CloseDirection(const ENUM_POSITION_TYPE type)
     {
      bool ok = true;
      for(int i = PositionsTotal() - 1; i >= 0; i--)
        {
         const ulong ticket = PositionGetTicket(i);
         if(ticket == 0 || !PositionSelectByTicket(ticket)) continue;
         if(PositionGetString(POSITION_SYMBOL) != m_symbol) continue;
         if((ulong)PositionGetInteger(POSITION_MAGIC) != m_magic) continue;
         if((ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE) != type) continue;
         ok &= m_trade.PositionClose(ticket);
        }
      return ok;
     }

   bool OpenBuy(const string comment)
     {
      if(CountPositions(-1) >= m_maxPositions) return false;
      const double ask = SymbolInfoDouble(m_symbol, SYMBOL_ASK);
      const double sl = (m_slPoints > 0.0) ? NormalizePrice(ask - m_slPoints * m_point) : 0.0;
      const double tp = (m_tpPoints > 0.0) ? NormalizePrice(ask + m_tpPoints * m_point) : 0.0;
      return m_trade.Buy(NormalizeLot(m_lot), m_symbol, ask, sl, tp, comment);
     }

   bool OpenSell(const string comment)
     {
      if(CountPositions(-1) >= m_maxPositions) return false;
      const double bid = SymbolInfoDouble(m_symbol, SYMBOL_BID);
      const double sl = (m_slPoints > 0.0) ? NormalizePrice(bid + m_slPoints * m_point) : 0.0;
      const double tp = (m_tpPoints > 0.0) ? NormalizePrice(bid - m_tpPoints * m_point) : 0.0;
      return m_trade.Sell(NormalizeLot(m_lot), m_symbol, bid, sl, tp, comment);
     }

   bool ReverseTo(const ENUM_SCALP_SIGNAL newDirection, const string comment)
     {
      if(newDirection == SCALP_SIGNAL_BUY)  { CloseDirection(POSITION_TYPE_SELL); return OpenBuy(comment); }
      if(newDirection == SCALP_SIGNAL_SELL) { CloseDirection(POSITION_TYPE_BUY);  return OpenSell(comment); }
      return false;
     }

   void ManageOpenPositions(void)
     {
      for(int i = 0; i < PositionsTotal(); i++)
        {
         const ulong ticket = PositionGetTicket(i);
         if(ticket == 0 || !PositionSelectByTicket(ticket)) continue;
         if(PositionGetString(POSITION_SYMBOL) != m_symbol) continue;
         if((ulong)PositionGetInteger(POSITION_MAGIC) != m_magic) continue;

         const ENUM_POSITION_TYPE type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
         const double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
         double sl = PositionGetDouble(POSITION_SL);
         double tp = PositionGetDouble(POSITION_TP);
         const double bid = SymbolInfoDouble(m_symbol, SYMBOL_BID);
         const double ask = SymbolInfoDouble(m_symbol, SYMBOL_ASK);

         if(type == POSITION_TYPE_BUY)
           {
            const double profitPoints = (bid - openPrice) / m_point;
            if(m_useTrailing && profitPoints >= m_trailStartPoints)
              {
               const double newSL = NormalizePrice(bid - m_trailStepPoints * m_point);
               if(sl == 0.0 || newSL > sl + m_point * 0.1)
                  m_trade.PositionModify(ticket, newSL, tp);
              }
            if(m_tpPoints > 0.0 && profitPoints >= m_tpPoints * 0.75)
              {
               const double tightTP = NormalizePrice(openPrice + m_tpPoints * 0.85 * m_point);
               if(tp == 0.0 || tightTP < tp) m_trade.PositionModify(ticket, sl, tightTP);
              }
           }
         else if(type == POSITION_TYPE_SELL)
           {
            const double profitPoints = (openPrice - ask) / m_point;
            if(m_useTrailing && profitPoints >= m_trailStartPoints)
              {
               const double newSL = NormalizePrice(ask + m_trailStepPoints * m_point);
               if(sl == 0.0 || newSL < sl - m_point * 0.1)
                  m_trade.PositionModify(ticket, newSL, tp);
              }
            if(m_tpPoints > 0.0 && profitPoints >= m_tpPoints * 0.75)
              {
               const double tightTP = NormalizePrice(openPrice - m_tpPoints * 0.85 * m_point);
               if(tp == 0.0 || tightTP > tp) m_trade.PositionModify(ticket, sl, tightTP);
              }
           }
        }
     }

   bool HasLosingDirection(const ENUM_SCALP_SIGNAL desired, const double reverseLossPoints) const
     {
      for(int i = 0; i < PositionsTotal(); i++)
        {
         const ulong ticket = PositionGetTicket(i);
         if(ticket == 0 || !PositionSelectByTicket(ticket)) continue;
         if(PositionGetString(POSITION_SYMBOL) != m_symbol) continue;
         if((ulong)PositionGetInteger(POSITION_MAGIC) != m_magic) continue;

         const ENUM_POSITION_TYPE type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
         const double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
         const double bid = SymbolInfoDouble(m_symbol, SYMBOL_BID);
         const double ask = SymbolInfoDouble(m_symbol, SYMBOL_ASK);

         if(desired == SCALP_SIGNAL_BUY && type == POSITION_TYPE_SELL)
            if((ask - openPrice) / m_point >= reverseLossPoints) return true;
         if(desired == SCALP_SIGNAL_SELL && type == POSITION_TYPE_BUY)
            if((openPrice - bid) / m_point >= reverseLossPoints) return true;
        }
      return false;
     }
  };

//+------------------------------------------------------------------+
//| SECTION 4: MAIN EXPERT ADVISOR                                   |
//+------------------------------------------------------------------+
input group "=== General ==="
input ulong           InpMagicNumber          = 880071;
input double          InpLotSize              = 0.01;
input int             InpMaxSpreadPoints      = 25;
input int             InpSlippagePoints       = 20;

input group "=== Timeframes ==="
input ENUM_TIMEFRAMES InpTfExecution          = PERIOD_M1;
input ENUM_TIMEFRAMES InpTfFast               = PERIOD_M1;
input ENUM_TIMEFRAMES InpTfMid                = PERIOD_M5;
input ENUM_TIMEFRAMES InpTfSlow               = PERIOD_M15;

input group "=== Signal Accuracy Filters ==="
input int             InpMinConfluence        = 72;
input int             InpMinCandleScore       = 8;
input double          InpMinAtrPoints         = 3.0;
input double          InpMaxAtrPoints         = 180.0;

input group "=== Quick Profit Scalping ==="
input double          InpTakeProfitPoints     = 12.0;
input double          InpStopLossPoints       = 25.0;
input bool            InpUseTrailing          = true;
input double          InpTrailStartPoints     = 4.0;
input double          InpTrailStepPoints      = 2.0;

input group "=== Reversal & Multi-Bet ==="
input bool            InpEnableReversal       = true;
input double          InpReverseLossPoints    = 6.0;
input int             InpMaxPositions         = 4;
input int             InpSecondsBetweenTrades = 3;
input bool            InpTradeOnEveryTick     = true;

input group "=== Risk Guard ==="
input double          InpMaxDailyLossMoney    = 0.0;
input int             InpMaxTradesPerDay      = 200;

CSignalEngine g_signals;
CTradeManager g_trades;
datetime      g_lastTradeTime = 0;
datetime      g_dayStamp = 0;
double        g_dayStartEquity = 0.0;
int           g_tradesToday = 0;

int OnInit()
  {
   if(InpLotSize <= 0.0) return INIT_PARAMETERS_INCORRECT;
   if(InpMaxPositions < 1) return INIT_PARAMETERS_INCORRECT;

   g_signals.Configure(_Symbol, InpTfExecution, InpTfFast, InpTfMid, InpTfSlow,
                       InpMinConfluence, InpMinCandleScore);
   if(!g_signals.Init()) return INIT_FAILED;

   g_trades.Configure(_Symbol, InpMagicNumber, InpSlippagePoints, InpLotSize,
                      InpTakeProfitPoints, InpStopLossPoints, InpUseTrailing,
                      InpTrailStartPoints, InpTrailStepPoints, InpMaxPositions);

   g_dayStamp = StringToTime(TimeToString(TimeCurrent(), TIME_DATE));
   g_dayStartEquity = AccountInfoDouble(ACCOUNT_EQUITY);
   g_tradesToday = 0;
   g_lastTradeTime = 0;

   EventSetTimer(1);
   Print("ScalpProfitBot All-In-One started on ", _Symbol);
   ProcessTradingCycle(true);
   return INIT_SUCCEEDED;
  }

void OnDeinit(const int reason) { EventKillTimer(); Comment(""); }

void OnTimer() { g_trades.ManageOpenPositions(); }

void OnTick()
  {
   g_trades.ManageOpenPositions();
   if(!InpTradeOnEveryTick)
     {
      static datetime lastBar = 0;
      const datetime barTime = iTime(_Symbol, InpTfExecution, 0);
      if(barTime == lastBar) return;
      lastBar = barTime;
     }
   ProcessTradingCycle(false);
  }

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

bool IsDailyRiskBlocked()
  {
   ResetDailyStatsIfNeeded();
   if(g_tradesToday >= InpMaxTradesPerDay) return true;
   if(InpMaxDailyLossMoney > 0.0)
     {
      const double loss = g_dayStartEquity - AccountInfoDouble(ACCOUNT_EQUITY);
      if(loss >= InpMaxDailyLossMoney) return true;
     }
   return false;
  }

bool CanOpenAnotherTrade()
  {
   if(IsDailyRiskBlocked()) return false;
   if(g_lastTradeTime > 0 && (TimeCurrent() - g_lastTradeTime) < InpSecondsBetweenTrades) return false;
   return true;
  }

void UpdateChartComment(const SSignalResult &sig)
  {
   Comment(StringFormat(
      "ScalpProfitBot | %s\nSignal: %s | Score: %d | Buy: %d | Sell: %d\n"
      "Open: %d (B:%d S:%d) | Trades today: %d\nATR: %.1f | Spread: %d | %s",
      _Symbol,
      (sig.direction == SCALP_SIGNAL_BUY ? "BUY" : sig.direction == SCALP_SIGNAL_SELL ? "SELL" : "NONE"),
      sig.score, sig.buyVotes, sig.sellVotes,
      g_trades.TotalPositions(), g_trades.BuyCount(), g_trades.SellCount(), g_tradesToday,
      g_signals.AtrPoints(), (int)SymbolInfoInteger(_Symbol, SYMBOL_SPREAD), sig.reason));
  }

void ProcessTradingCycle(const bool forceEvaluate)
  {
   if(!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED)) return;
   if(!MQLInfoInteger(MQL_TRADE_ALLOWED)) return;

   if(!g_signals.IsMarketTradable(InpMaxSpreadPoints, InpMinAtrPoints, InpMaxAtrPoints))
     {
      SSignalResult empty;
      empty.direction = SCALP_SIGNAL_NONE;
      empty.reason = "Market filtered (spread/ATR)";
      UpdateChartComment(empty);
      return;
     }

   const SSignalResult signal = g_signals.Evaluate(false);
   UpdateChartComment(signal);

   if(InpEnableReversal && signal.direction != SCALP_SIGNAL_NONE)
     {
      if(g_trades.HasLosingDirection(signal.direction, InpReverseLossPoints))
        {
         if(g_trades.ReverseTo(signal.direction, "ScalpReverse"))
           {
            g_lastTradeTime = TimeCurrent();
            g_tradesToday++;
            return;
           }
        }
     }

   if(signal.direction == SCALP_SIGNAL_NONE) return;
   if(!CanOpenAnotherTrade() && !forceEvaluate) return;

   if(signal.direction == SCALP_SIGNAL_BUY)
     {
      if(g_trades.SellCount() > 0 && InpEnableReversal) g_trades.CloseDirection(POSITION_TYPE_SELL);
      if(g_trades.TotalPositions() < InpMaxPositions && g_trades.OpenBuy("ScalpBuy"))
        { g_lastTradeTime = TimeCurrent(); g_tradesToday++; }
     }
   else if(signal.direction == SCALP_SIGNAL_SELL)
     {
      if(g_trades.BuyCount() > 0 && InpEnableReversal) g_trades.CloseDirection(POSITION_TYPE_BUY);
      if(g_trades.TotalPositions() < InpMaxPositions && g_trades.OpenSell("ScalpSell"))
        { g_lastTradeTime = TimeCurrent(); g_tradesToday++; }
     }
  }
//+------------------------------------------------------------------+
