//+------------------------------------------------------------------+
//|                                                SignalEngine.mqh  |
//|              Multi-timeframe confluence & prediction engine      |
//+------------------------------------------------------------------+
#property copyright "ScalpProfitBot"
#property strict

#ifndef SCALP_SIGNAL_ENGINE_MQH
#define SCALP_SIGNAL_ENGINE_MQH

#include <ScalpProfit/CandlePatterns.mqh>

//+------------------------------------------------------------------+
enum ENUM_SCALP_SIGNAL
  {
   SCALP_SIGNAL_NONE = 0,
   SCALP_SIGNAL_BUY  = 1,
   SCALP_SIGNAL_SELL = -1
  };

//+------------------------------------------------------------------+
struct SSignalResult
  {
   ENUM_SCALP_SIGNAL direction;
   int               score;
   int               buyVotes;
   int               sellVotes;
   string            reason;
  };

//+------------------------------------------------------------------+
class CSignalEngine
  {
private:
   string            m_symbol;
   ENUM_TIMEFRAMES   m_tfExec;
   ENUM_TIMEFRAMES   m_tfFast;
   ENUM_TIMEFRAMES   m_tfMid;
   ENUM_TIMEFRAMES   m_tfSlow;

   int               m_emaFastExec;
   int               m_emaSlowExec;
   int               m_emaFastMid;
   int               m_emaSlowMid;
   int               m_emaFastSlow;
   int               m_emaSlowSlow;
   int               m_rsiHandle;
   int               m_macdHandle;
   int               m_stochHandle;
   int               m_atrHandle;

   int               m_minConfluence;
   int               m_minCandleScore;

   bool              ResetHandle(int &handle)
     {
      if(handle != INVALID_HANDLE)
        {
         IndicatorRelease(handle);
         handle = INVALID_HANDLE;
        }
      return true;
     }

   bool EmaTrend(const ENUM_TIMEFRAMES tf, const int fastPeriod, const int slowPeriod,
                 int &vote) const
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

      if(CopyBuffer(fastHandle, 0, 0, 3, fastBuf) < 3 ||
         CopyBuffer(slowHandle, 0, 0, 3, slowBuf) < 3)
        {
         IndicatorRelease(fastHandle);
         IndicatorRelease(slowHandle);
         return false;
        }

      const double price = iClose(m_symbol, tf, 0);
      if(fastBuf[0] > slowBuf[0] && price > fastBuf[0] && fastBuf[0] > fastBuf[1])
         vote += 1;
      else if(fastBuf[0] < slowBuf[0] && price < fastBuf[0] && fastBuf[0] < fastBuf[1])
         vote -= 1;

      IndicatorRelease(fastHandle);
      IndicatorRelease(slowHandle);
      return true;
     }

   bool RsiVote(int &vote) const
     {
      double rsi[];
      ArraySetAsSeries(rsi, true);
      if(CopyBuffer(m_rsiHandle, 0, 0, 3, rsi) < 3)
         return false;

      if(rsi[1] < 32.0 && rsi[0] > rsi[1] && rsi[0] < 55.0)
         vote += 1;
      else if(rsi[1] > 68.0 && rsi[0] < rsi[1] && rsi[0] > 45.0)
         vote -= 1;
      else if(rsi[0] > 52.0 && rsi[0] > rsi[1])
         vote += 1;
      else if(rsi[0] < 48.0 && rsi[0] < rsi[1])
         vote -= 1;

      return true;
     }

   bool MacdVote(int &vote) const
     {
      double main[], signal[];
      ArraySetAsSeries(main, true);
      ArraySetAsSeries(signal, true);
      if(CopyBuffer(m_macdHandle, 0, 0, 3, main) < 3)
         return false;
      if(CopyBuffer(m_macdHandle, 1, 0, 3, signal) < 3)
         return false;

      if(main[0] > signal[0] && main[0] > main[1])
         vote += 1;
      else if(main[0] < signal[0] && main[0] < main[1])
         vote -= 1;

      return true;
     }

   bool StochVote(int &vote) const
     {
      double k[], d[];
      ArraySetAsSeries(k, true);
      ArraySetAsSeries(d, true);
      if(CopyBuffer(m_stochHandle, 0, 0, 3, k) < 3)
         return false;
      if(CopyBuffer(m_stochHandle, 1, 0, 3, d) < 3)
         return false;

      if(k[1] < 22.0 && k[0] > d[0] && k[0] > k[1])
         vote += 1;
      else if(k[1] > 78.0 && k[0] < d[0] && k[0] < k[1])
         vote -= 1;

      return true;
     }

   bool ExecEmaVote(int &vote) const
     {
      double fast[], slow[];
      ArraySetAsSeries(fast, true);
      ArraySetAsSeries(slow, true);
      if(CopyBuffer(m_emaFastExec, 0, 0, 2, fast) < 2)
         return false;
      if(CopyBuffer(m_emaSlowExec, 0, 0, 2, slow) < 2)
         return false;

      const double price = SymbolInfoDouble(m_symbol, SYMBOL_BID);
      if(price > fast[0] && fast[0] > slow[0])
         vote += 1;
      else if(price < fast[0] && fast[0] < slow[0])
         vote -= 1;

      return true;
     }

public:
                     CSignalEngine(void)
     {
      m_symbol = _Symbol;
      m_tfExec = PERIOD_M1;
      m_tfFast = PERIOD_M1;
      m_tfMid  = PERIOD_M5;
      m_tfSlow = PERIOD_M15;

      m_emaFastExec = INVALID_HANDLE;
      m_emaSlowExec = INVALID_HANDLE;
      m_emaFastMid  = INVALID_HANDLE;
      m_emaSlowMid  = INVALID_HANDLE;
      m_emaFastSlow = INVALID_HANDLE;
      m_emaSlowSlow = INVALID_HANDLE;
      m_rsiHandle   = INVALID_HANDLE;
      m_macdHandle  = INVALID_HANDLE;
      m_stochHandle = INVALID_HANDLE;
      m_atrHandle   = INVALID_HANDLE;

      m_minConfluence  = 72;
      m_minCandleScore = 8;
     }

                    ~CSignalEngine(void)
     {
      if(m_emaFastExec != INVALID_HANDLE) IndicatorRelease(m_emaFastExec);
      if(m_emaSlowExec != INVALID_HANDLE) IndicatorRelease(m_emaSlowExec);
      if(m_emaFastMid  != INVALID_HANDLE) IndicatorRelease(m_emaFastMid);
      if(m_emaSlowMid  != INVALID_HANDLE) IndicatorRelease(m_emaSlowMid);
      if(m_emaFastSlow != INVALID_HANDLE) IndicatorRelease(m_emaFastSlow);
      if(m_emaSlowSlow != INVALID_HANDLE) IndicatorRelease(m_emaSlowSlow);
      if(m_rsiHandle   != INVALID_HANDLE) IndicatorRelease(m_rsiHandle);
      if(m_macdHandle  != INVALID_HANDLE) IndicatorRelease(m_macdHandle);
      if(m_stochHandle != INVALID_HANDLE) IndicatorRelease(m_stochHandle);
      if(m_atrHandle   != INVALID_HANDLE) IndicatorRelease(m_atrHandle);
     }

   void              Configure(const string symbol,
                               const ENUM_TIMEFRAMES tfExec,
                               const ENUM_TIMEFRAMES tfFast,
                               const ENUM_TIMEFRAMES tfMid,
                               const ENUM_TIMEFRAMES tfSlow,
                               const int minConfluence,
                               const int minCandleScore)
     {
      m_symbol         = symbol;
      m_tfExec         = tfExec;
      m_tfFast         = tfFast;
      m_tfMid          = tfMid;
      m_tfSlow         = tfSlow;
      m_minConfluence  = minConfluence;
      m_minCandleScore = minCandleScore;
     }

   bool              Init(void)
     {
      ResetHandle(m_emaFastExec);
      ResetHandle(m_emaSlowExec);
      ResetHandle(m_rsiHandle);
      ResetHandle(m_macdHandle);
      ResetHandle(m_stochHandle);
      ResetHandle(m_atrHandle);

      m_emaFastExec = iMA(m_symbol, m_tfExec, 8, 0, MODE_EMA, PRICE_CLOSE);
      m_emaSlowExec = iMA(m_symbol, m_tfExec, 21, 0, MODE_EMA, PRICE_CLOSE);
      m_rsiHandle   = iRSI(m_symbol, m_tfExec, 14, PRICE_CLOSE);
      m_macdHandle  = iMACD(m_symbol, m_tfExec, 12, 26, 9, PRICE_CLOSE);
      m_stochHandle = iStochastic(m_symbol, m_tfExec, 5, 3, 3, MODE_SMA, STO_LOWHIGH);
      m_atrHandle   = iATR(m_symbol, m_tfExec, 14);

      return (m_emaFastExec != INVALID_HANDLE &&
              m_emaSlowExec != INVALID_HANDLE &&
              m_rsiHandle   != INVALID_HANDLE &&
              m_macdHandle  != INVALID_HANDLE &&
              m_stochHandle != INVALID_HANDLE &&
              m_atrHandle   != INVALID_HANDLE);
     }

   bool              IsMarketTradable(const int maxSpreadPoints,
                                      const double minAtrPoints,
                                      const double maxAtrPoints) const
     {
      const long spread = SymbolInfoInteger(m_symbol, SYMBOL_SPREAD);
      if(spread > maxSpreadPoints)
         return false;

      double atr[];
      ArraySetAsSeries(atr, true);
      if(CopyBuffer(m_atrHandle, 0, 0, 1, atr) < 1)
         return false;

      const double atrPoints = atr[0] / _Point;
      if(atrPoints < minAtrPoints)
         return false;
      if(maxAtrPoints > 0.0 && atrPoints > maxAtrPoints)
         return false;

      const long tradeMode = SymbolInfoInteger(m_symbol, SYMBOL_TRADE_MODE);
      if(tradeMode == SYMBOL_TRADE_MODE_DISABLED)
         return false;

      return true;
     }

   double            AtrPoints(void) const
     {
      double atr[];
      ArraySetAsSeries(atr, true);
      if(CopyBuffer(m_atrHandle, 0, 0, 1, atr) < 1)
         return 0.0;
      return atr[0] / _Point;
     }

   SSignalResult     Evaluate(const bool allowWeakSignal = false) const
     {
      SSignalResult result;
      result.direction = SCALP_SIGNAL_NONE;
      result.score     = 0;
      result.buyVotes  = 0;
      result.sellVotes = 0;
      result.reason    = "No signal";

      int vote = 0;
      ExecEmaVote(vote);
      EmaTrend(m_tfFast, 8, 21, vote);
      EmaTrend(m_tfMid, 8, 21, vote);
      EmaTrend(m_tfSlow, 21, 50, vote);
      RsiVote(vote);
      MacdVote(vote);
      StochVote(vote);

      const int candleExec = ScalpCandlePatternScore(m_symbol, m_tfExec, 1);
      const int candleMid  = ScalpCandlePatternScore(m_symbol, m_tfMid, 1);
      const int candleScore = candleExec + (int)MathRound(candleMid * 0.6);

      int score = vote * 12 + candleScore;
      if(vote > 0)
         result.buyVotes = vote;
      if(vote < 0)
         result.sellVotes = -vote;

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

   ENUM_SCALP_SIGNAL Opposite(const ENUM_SCALP_SIGNAL sig) const
     {
      if(sig == SCALP_SIGNAL_BUY)
         return SCALP_SIGNAL_SELL;
      if(sig == SCALP_SIGNAL_SELL)
         return SCALP_SIGNAL_BUY;
      return SCALP_SIGNAL_NONE;
     }
  };

#endif // SCALP_SIGNAL_ENGINE_MQH
