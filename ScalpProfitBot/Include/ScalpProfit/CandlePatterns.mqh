//+------------------------------------------------------------------+
//|                                              CandlePatterns.mqh  |
//|                        ScalpProfitBot - Candlestick Analysis     |
//+------------------------------------------------------------------+
#property copyright "ScalpProfitBot"
#property strict

#ifndef SCALP_CANDLE_PATTERNS_MQH
#define SCALP_CANDLE_PATTERNS_MQH

//+------------------------------------------------------------------+
//| Candle metrics for symbol/timeframe/shift                        |
//+------------------------------------------------------------------+
struct SCandleMetrics
  {
   double            open;
   double            high;
   double            low;
   double            close;
   double            body;
   double            upperWick;
   double            lowerWick;
   double            range;
   bool              bullish;
   bool              bearish;
  };

//+------------------------------------------------------------------+
bool ScalpGetCandleMetrics(const string symbol, const ENUM_TIMEFRAMES tf,
                           const int shift, SCandleMetrics &m)
  {
   m.open  = iOpen(symbol, tf, shift);
   m.high  = iHigh(symbol, tf, shift);
   m.low   = iLow(symbol, tf, shift);
   m.close = iClose(symbol, tf, shift);

   if(m.open == 0.0 && m.high == 0.0 && m.low == 0.0 && m.close == 0.0)
      return false;

   m.body       = MathAbs(m.close - m.open);
   m.range      = m.high - m.low;
   m.upperWick  = m.high - MathMax(m.open, m.close);
   m.lowerWick  = MathMin(m.open, m.close) - m.low;
   m.bullish    = (m.close > m.open);
   m.bearish    = (m.close < m.open);
   return (m.range > 0.0);
  }

//+------------------------------------------------------------------+
double ScalpBodyRatio(const SCandleMetrics &m)
  {
   if(m.range <= 0.0)
      return 0.0;
   return m.body / m.range;
  }

//+------------------------------------------------------------------+
bool ScalpIsDoji(const SCandleMetrics &m, const double maxBodyRatio = 0.12)
  {
   return (ScalpBodyRatio(m) <= maxBodyRatio);
  }

//+------------------------------------------------------------------+
bool ScalpIsBullishEngulfing(const string symbol, const ENUM_TIMEFRAMES tf, const int shift)
  {
   SCandleMetrics c1, c0;
   if(!ScalpGetCandleMetrics(symbol, tf, shift + 1, c1))
      return false;
   if(!ScalpGetCandleMetrics(symbol, tf, shift, c0))
      return false;

   if(!c1.bearish || !c0.bullish)
      return false;

   return (c0.open <= c1.close && c0.close >= c1.open && c0.body > c1.body * 0.85);
  }

//+------------------------------------------------------------------+
bool ScalpIsBearishEngulfing(const string symbol, const ENUM_TIMEFRAMES tf, const int shift)
  {
   SCandleMetrics c1, c0;
   if(!ScalpGetCandleMetrics(symbol, tf, shift + 1, c1))
      return false;
   if(!ScalpGetCandleMetrics(symbol, tf, shift, c0))
      return false;

   if(!c1.bullish || !c0.bearish)
      return false;

   return (c0.open >= c1.close && c0.close <= c1.open && c0.body > c1.body * 0.85);
  }

//+------------------------------------------------------------------+
bool ScalpIsHammer(const SCandleMetrics &m, const bool bullishContext = true)
  {
   if(m.range <= 0.0)
      return false;

   const double bodyRatio  = ScalpBodyRatio(m);
   const double lowerRatio = m.lowerWick / m.range;
   const double upperRatio = m.upperWick / m.range;

   if(bodyRatio > 0.35)
      return false;
   if(lowerRatio < 0.55)
      return false;
   if(upperRatio > 0.20)
      return false;

   return bullishContext ? true : (m.close >= m.open);
  }

//+------------------------------------------------------------------+
bool ScalpIsShootingStar(const SCandleMetrics &m)
  {
   if(m.range <= 0.0)
      return false;

   const double bodyRatio  = ScalpBodyRatio(m);
   const double upperRatio = m.upperWick / m.range;
   const double lowerRatio = m.lowerWick / m.range;

   if(bodyRatio > 0.35)
      return false;
   if(upperRatio < 0.55)
      return false;
   if(lowerRatio > 0.20)
      return false;

   return true;
  }

//+------------------------------------------------------------------+
bool ScalpIsThreeWhiteSoldiers(const string symbol, const ENUM_TIMEFRAMES tf, const int shift)
  {
   SCandleMetrics c2, c1, c0;
   if(!ScalpGetCandleMetrics(symbol, tf, shift + 2, c2))
      return false;
   if(!ScalpGetCandleMetrics(symbol, tf, shift + 1, c1))
      return false;
   if(!ScalpGetCandleMetrics(symbol, tf, shift, c0))
      return false;

   if(!c2.bullish || !c1.bullish || !c0.bullish)
      return false;
   if(!(c1.close > c2.close && c0.close > c1.close))
      return false;
   if(!(c1.open >= c2.open && c1.open <= c2.close))
      return false;
   if(!(c0.open >= c1.open && c0.open <= c1.close))
      return false;

   return true;
  }

//+------------------------------------------------------------------+
bool ScalpIsThreeBlackCrows(const string symbol, const ENUM_TIMEFRAMES tf, const int shift)
  {
   SCandleMetrics c2, c1, c0;
   if(!ScalpGetCandleMetrics(symbol, tf, shift + 2, c2))
      return false;
   if(!ScalpGetCandleMetrics(symbol, tf, shift + 1, c1))
      return false;
   if(!ScalpGetCandleMetrics(symbol, tf, shift, c0))
      return false;

   if(!c2.bearish || !c1.bearish || !c0.bearish)
      return false;
   if(!(c1.close < c2.close && c0.close < c1.close))
      return false;
   if(!(c1.open <= c2.open && c1.open >= c2.close))
      return false;
   if(!(c0.open <= c1.open && c0.open >= c1.close))
      return false;

   return true;
  }

//+------------------------------------------------------------------+
int ScalpCandlePatternScore(const string symbol, const ENUM_TIMEFRAMES tf, const int shift)
  {
   int score = 0;
   SCandleMetrics c0;
   if(!ScalpGetCandleMetrics(symbol, tf, shift, c0))
      return 0;

   if(ScalpIsBullishEngulfing(symbol, tf, shift))
      score += 18;
   if(ScalpIsBearishEngulfing(symbol, tf, shift))
      score -= 18;

   if(ScalpIsHammer(c0, true))
      score += 12;
   if(ScalpIsShootingStar(c0))
      score -= 12;

   if(ScalpIsThreeWhiteSoldiers(symbol, tf, shift))
      score += 15;
   if(ScalpIsThreeBlackCrows(symbol, tf, shift))
      score -= 15;

   if(ScalpIsDoji(c0))
     {
      SCandleMetrics c1;
      if(ScalpGetCandleMetrics(symbol, tf, shift + 1, c1))
        {
         if(c1.bearish && c0.close >= c1.close)
            score += 6;
         if(c1.bullish && c0.close <= c1.close)
            score -= 6;
        }
     }

   if(c0.bullish && ScalpBodyRatio(c0) > 0.65)
      score += 5;
   if(c0.bearish && ScalpBodyRatio(c0) > 0.65)
      score -= 5;

   return score;
  }

#endif // SCALP_CANDLE_PATTERNS_MQH
