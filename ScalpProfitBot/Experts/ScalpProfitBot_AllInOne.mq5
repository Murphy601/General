//+------------------------------------------------------------------+
//|                              ScalpProfitBot_AllInOne.mq5                     |
//|                    ScalpProfitBot v6.1 — ONE FILE ONLY             |
//+------------------------------------------------------------------+
//| HOW TO USE:                                                       |
//|  1. MetaEditor → File → New → Expert Advisor → name: ScalpProfit |
//|  2. DELETE all template code, paste THIS ENTIRE file               |
//|  3. Compile F7 — must show "0 errors, 0 warnings"                 |
//|  4. Attach to M1 chart, enable AutoTrading                        |
//+------------------------------------------------------------------+
#property copyright   "ScalpProfitBot"
#property version     "6.10"
#property description "ScalpProfitBot v6.1 — balanced entries + block reasons"

#include <Trade/Trade.mqh>

#define SPB_MIN_PROFIT_USD       0.01
#define SPB_LOSS_HOLD_SEC        60
#define SPB_SCAN_INTERVAL_MS     200
#define SPB_BASE_MAGIC           880090
#define SPB_MAX_TRADES_PER_SYM   30
#define SPB_HOUR_BARS            60
#define SPB_MAX_ENTRIES_PER_MIN  3
#define SPB_MAX_FLOAT_LOSS_USD   15.0
#define SPB_MAX_CONSEC_LOSSES    4
#define SPB_PAUSE_AFTER_LOSS_SEC 120

enum ENUM_SPB_SIGNAL { SPB_NONE = 0, SPB_BUY = 1, SPB_SELL = -1 };

struct SCandleBar
  {
   double o, h, l, c, body, uw, lw, rng;
   bool   bull, bear;
  };

struct SMarketProfile
  {
   double slAtrMult;
   int    minScore, minVotes;
   string label;
  };

struct SHourContext
  {
   int    bias, bullBars, bearBars, avgCandleScore, buySignals, sellSignals, h1Trend;
   double netChange;
   string text;
  };

struct SSignalInfo
  {
   ENUM_SPB_SIGNAL dir;
   int    score, buyVotes, sellVotes, cM1, cM5, cM15, momentum, hourBias;
   bool   hourAligned, strong;
   string text;
  };

bool SPB_ReadCandle(const string sym, const ENUM_TIMEFRAMES tf, const int sh, SCandleBar &b)
  {
   b.o = iOpen(sym, tf, sh);  b.h = iHigh(sym, tf, sh);
   b.l = iLow(sym, tf, sh);   b.c = iClose(sym, tf, sh);
   if(b.o == 0 && b.h == 0 && b.l == 0 && b.c == 0) return false;
   b.body = MathAbs(b.c - b.o);
   b.rng  = b.h - b.l;
   b.uw   = b.h - MathMax(b.o, b.c);
   b.lw   = MathMin(b.o, b.c) - b.l;
   b.bull = (b.c > b.o);
   b.bear = (b.c < b.o);
   return (b.rng > 0);
  }

double SPB_BodyPct(const SCandleBar &b) { return (b.rng <= 0) ? 0 : b.body / b.rng; }

int SPB_CandleScore(const string sym, const ENUM_TIMEFRAMES tf, const int sh)
  {
   SCandleBar c0, c1;
   if(!SPB_ReadCandle(sym, tf, sh, c0)) return 0;
   int s = 0;
   if(SPB_ReadCandle(sym, tf, sh + 1, c1))
     {
      if(c1.bear && c0.bull && c0.o <= c1.c && c0.c >= c1.o && c0.body > c1.body * 0.75) s += 22;
      if(c1.bull && c0.bear && c0.o >= c1.c && c0.c <= c1.o && c0.body > c1.body * 0.75) s -= 22;
      if(c1.bear && c0.bull && c0.c > c1.h) s += 11;
      if(c1.bull && c0.bear && c0.c < c1.l) s -= 11;
     }
   if(SPB_BodyPct(c0) <= 0.35)
     {
      if(c0.lw / c0.rng >= 0.50 && c0.uw / c0.rng <= 0.25) s += 15;
      if(c0.uw / c0.rng >= 0.50 && c0.lw / c0.rng <= 0.25) s -= 15;
     }
   if(c0.lw / c0.rng >= 0.60 && SPB_BodyPct(c0) <= 0.30) s += 12;
   if(c0.uw / c0.rng >= 0.60 && SPB_BodyPct(c0) <= 0.30) s -= 12;
   if(c0.bull && SPB_BodyPct(c0) > 0.62) s += 9;
   if(c0.bear && SPB_BodyPct(c0) > 0.62) s -= 9;
   return s;
  }

SMarketProfile SPB_Profile(const string sym)
  {
   SMarketProfile p;
   p.slAtrMult = 2.5; p.minScore = 24; p.minVotes = 3; p.label = "FOREX";
   if(StringFind(sym, "XAU") >= 0 || StringFind(sym, "GOLD") >= 0)
     { p.slAtrMult = 2.2; p.minScore = 22; p.label = "GOLD"; }
   else if(StringFind(sym, "BTC") >= 0 || StringFind(sym, "ETH") >= 0)
     { p.slAtrMult = 2.8; p.minScore = 23; p.label = "CRYPTO"; }
   else if(StringFind(sym, "US30") >= 0 || StringFind(sym, "UT100") >= 0 ||
           StringFind(sym, "US100") >= 0 || StringFind(sym, "NAS") >= 0 ||
           StringFind(sym, "DAX") >= 0  || StringFind(sym, "JPN") >= 0)
     { p.slAtrMult = 2.0; p.minScore = 22; p.label = "INDEX"; }
   return p;
  }

ulong SPB_Magic(const string sym)
  {
   ulong h = SPB_BASE_MAGIC;
   for(int i = 0; i < StringLen(sym); i++)
      h = h * 31 + (ulong)StringGetCharacter(sym, i);
   return h;
  }

class CSymbolBot
  {
private:
   string         m_sym;
   ulong          m_magic;
   double         m_lot;
   int            m_cap;
   SMarketProfile m_prof;
   CTrade         m_trade;
   int            m_rsi, m_macd, m_stoch, m_atr, m_emaF, m_emaS;
   datetime       m_lastOpen, m_pauseUntil, m_entryTimes[10];
   int            m_entryTimeN, m_entries, m_winsClosed, m_consecLosses;
   SSignalInfo    m_lastSig;
   SHourContext   m_hour;

   bool Buf(const int h, const int b, const int n, double &a[]) const
     { ArraySetAsSeries(a, true); return CopyBuffer(h, b, 0, n, a) >= n; }

   int VoteEMA(const ENUM_TIMEFRAMES tf) const
     {
      int fh = iMA(m_sym, tf, 8, 0, MODE_EMA, PRICE_CLOSE);
      int sh = iMA(m_sym, tf, 21, 0, MODE_EMA, PRICE_CLOSE);
      if(fh == INVALID_HANDLE || sh == INVALID_HANDLE)
        { if(fh != INVALID_HANDLE) IndicatorRelease(fh); if(sh != INVALID_HANDLE) IndicatorRelease(sh); return 0; }
      double f[], s[]; ArraySetAsSeries(f, true); ArraySetAsSeries(s, true);
      int v = 0;
      if(CopyBuffer(fh, 0, 0, 3, f) >= 3 && CopyBuffer(sh, 0, 0, 3, s) >= 3)
        {
         double px = iClose(m_sym, tf, 0);
         if(f[0] > s[0] && px > f[0] && f[0] >= f[1]) v = 1;
         else if(f[0] < s[0] && px < f[0] && f[0] <= f[1]) v = -1;
        }
      IndicatorRelease(fh); IndicatorRelease(sh);
      return v;
     }

   int VoteEMAAtBar(const ENUM_TIMEFRAMES tf, const int bar) const
     {
      int fh = iMA(m_sym, tf, 8, 0, MODE_EMA, PRICE_CLOSE);
      int sh = iMA(m_sym, tf, 21, 0, MODE_EMA, PRICE_CLOSE);
      if(fh == INVALID_HANDLE || sh == INVALID_HANDLE)
        { if(fh != INVALID_HANDLE) IndicatorRelease(fh); if(sh != INVALID_HANDLE) IndicatorRelease(sh); return 0; }
      double f[], s[]; ArraySetAsSeries(f, true); ArraySetAsSeries(s, true);
      int v = 0;
      if(CopyBuffer(fh, 0, bar, 2, f) >= 2 && CopyBuffer(sh, 0, bar, 2, s) >= 2)
        {
         double px = iClose(m_sym, tf, bar);
         if(f[0] > s[0] && px > f[0]) v = 1;
         else if(f[0] < s[0] && px < f[0]) v = -1;
        }
      IndicatorRelease(fh); IndicatorRelease(sh);
      return v;
     }

   int VoteRSI() const
     {
      double r[]; if(!Buf(m_rsi, 0, 3, r)) return 0;
      if(r[1] < 34 && r[0] > r[1]) return 1;
      if(r[1] > 66 && r[0] < r[1]) return -1;
      if(r[0] > 54 && r[0] > r[1]) return 1;
      if(r[0] < 46 && r[0] < r[1]) return -1;
      return 0;
     }

   int VoteMACD() const
     {
      double m[], s[];
      if(!Buf(m_macd, 0, 3, m) || !Buf(m_macd, 1, 3, s)) return 0;
      if(m[0] > s[0] && m[0] > m[1]) return 1;
      if(m[0] < s[0] && m[0] < m[1]) return -1;
      return 0;
     }

   int VoteStoch() const
     {
      double k[], d[];
      if(!Buf(m_stoch, 0, 3, k) || !Buf(m_stoch, 1, 3, d)) return 0;
      if(k[1] < 24 && k[0] > d[0] && k[0] > k[1]) return 1;
      if(k[1] > 76 && k[0] < d[0] && k[0] < k[1]) return -1;
      return 0;
     }

   int VoteEMAExec() const
     {
      double f[], s[];
      if(!Buf(m_emaF, 0, 2, f) || !Buf(m_emaS, 0, 2, s)) return 0;
      double bid = SymbolInfoDouble(m_sym, SYMBOL_BID);
      if(bid > f[0] && f[0] > s[0]) return 1;
      if(bid < f[0] && f[0] < s[0]) return -1;
      return 0;
     }

   int H1Trend() const
     {
      int fh = iMA(m_sym, PERIOD_H1, 8, 0, MODE_EMA, PRICE_CLOSE);
      int sh = iMA(m_sym, PERIOD_H1, 21, 0, MODE_EMA, PRICE_CLOSE);
      if(fh == INVALID_HANDLE || sh == INVALID_HANDLE)
        { if(fh != INVALID_HANDLE) IndicatorRelease(fh); if(sh != INVALID_HANDLE) IndicatorRelease(sh); return 0; }
      double f[], s[]; ArraySetAsSeries(f, true); ArraySetAsSeries(s, true);
      int v = 0;
      if(CopyBuffer(fh, 0, 0, 3, f) >= 3 && CopyBuffer(sh, 0, 0, 3, s) >= 3)
        {
         double px = iClose(m_sym, PERIOD_H1, 0);
         if(f[0] > s[0] && px > f[0] && f[0] >= f[1]) v = 1;
         else if(f[0] < s[0] && px < f[0] && f[0] <= f[1]) v = -1;
        }
      IndicatorRelease(fh); IndicatorRelease(sh);
      return v;
     }

   int Momentum() const
     {
      double c0 = iClose(m_sym, PERIOD_M1, 0);
      double c1 = iClose(m_sym, PERIOD_M1, 1);
      double c2 = iClose(m_sym, PERIOD_M1, 2);
      if(c0 > c1 && c1 >= c2) return 1;
      if(c0 < c1 && c1 <= c2) return -1;
      return 0;
     }

   double ATR() const { double a[]; return Buf(m_atr, 0, 1, a) ? a[0] : 0; }

   double PnL(const ulong tk) const
     {
      if(!PositionSelectByTicket(tk)) return 0;
      return PositionGetDouble(POSITION_PROFIT) + PositionGetDouble(POSITION_SWAP);
     }

   int AgeSec(const ulong tk) const
     {
      if(!PositionSelectByTicket(tk)) return 0;
      return (int)(TimeCurrent() - (datetime)PositionGetInteger(POSITION_TIME));
     }

   int Count(const long side = -1) const
     {
      int n = 0;
      for(int i = 0; i < PositionsTotal(); i++)
        {
         ulong tk = PositionGetTicket(i);
         if(!PositionSelectByTicket(tk)) continue;
         if(PositionGetString(POSITION_SYMBOL) != m_sym) continue;
         if((ulong)PositionGetInteger(POSITION_MAGIC) != m_magic) continue;
         if(side >= 0 && PositionGetInteger(POSITION_TYPE) != side) continue;
         n++;
        }
      return n;
     }

   bool HasLosingSide(const ENUM_POSITION_TYPE side) const
     {
      for(int i = 0; i < PositionsTotal(); i++)
        {
         ulong tk = PositionGetTicket(i);
         if(!PositionSelectByTicket(tk)) continue;
         if(PositionGetString(POSITION_SYMBOL) != m_sym) continue;
         if((ulong)PositionGetInteger(POSITION_MAGIC) != m_magic) continue;
         if((ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE) != side) continue;
         if(PnL(tk) < 0) return true;
        }
      return false;
     }

   double NormLot(double lot) const
     {
      double mn = SymbolInfoDouble(m_sym, SYMBOL_VOLUME_MIN);
      double mx = SymbolInfoDouble(m_sym, SYMBOL_VOLUME_MAX);
      double st = SymbolInfoDouble(m_sym, SYMBOL_VOLUME_STEP);
      if(st <= 0) st = 0.01;
      return NormalizeDouble(MathMax(mn, MathMin(mx, MathFloor(lot / st) * st)), 2);
     }

   double NormPx(double px) const
     { return NormalizeDouble(px, (int)SymbolInfoInteger(m_sym, SYMBOL_DIGITS)); }

   void RecordEntryTime()
     {
      datetime now = TimeCurrent();
      if(m_entryTimeN < 10) m_entryTimes[m_entryTimeN++] = now;
      else { for(int i = 0; i < 9; i++) m_entryTimes[i] = m_entryTimes[i + 1]; m_entryTimes[9] = now; }
     }

   int EntriesLastMinute() const
     {
      datetime cutoff = TimeCurrent() - 60;
      int n = 0;
      for(int i = 0; i < m_entryTimeN; i++) if(m_entryTimes[i] >= cutoff) n++;
      return n;
     }

   int RequiredScore(const ENUM_SPB_SIGNAL dir) const
     {
      int base = m_prof.minScore;
      int openN = (dir == SPB_BUY) ? Count(POSITION_TYPE_BUY) : Count(POSITION_TYPE_SELL);
      if(openN >= 1) base += 12;
      if(openN >= 3) base += 10;
      if(HasLosingSide(dir == SPB_BUY ? POSITION_TYPE_BUY : POSITION_TYPE_SELL)) base += 999;
      return base;
     }

   bool HourAllows(const ENUM_SPB_SIGNAL dir) const
     {
      if(dir == SPB_BUY)  return (m_hour.bias >= 6 && (m_hour.h1Trend >= 0 || m_hour.bias >= 18));
      if(dir == SPB_SELL) return (m_hour.bias <= -6 && (m_hour.h1Trend <= 0 || m_hour.bias <= -18));
      return false;
     }

   bool CanEnter(const SSignalInfo &sig) const
     {
      if(TimeCurrent() < m_pauseUntil) return false;
      if(FloatPnL() <= -SPB_MAX_FLOAT_LOSS_USD) return false;
      if(EntriesLastMinute() >= SPB_MAX_ENTRIES_PER_MIN) return false;
      if(!sig.hourAligned || !HourAllows(sig.dir)) return false;
      int req = RequiredScore(sig.dir);
      if(sig.dir == SPB_BUY  && sig.score < req) return false;
      if(sig.dir == SPB_SELL && sig.score > -req) return false;
      return true;
     }

public:
   CSymbolBot()
     {
      m_sym = ""; m_magic = 0; m_lot = 0.01; m_cap = SPB_MAX_TRADES_PER_SYM;
      m_rsi = m_macd = m_stoch = m_atr = m_emaF = m_emaS = INVALID_HANDLE;
      m_lastOpen = 0; m_pauseUntil = 0; m_entryTimeN = 0;
      m_entries = 0; m_winsClosed = 0; m_consecLosses = 0;
      m_lastSig.dir = SPB_NONE; m_lastSig.text = "";
      m_hour.bias = 0; m_hour.text = "";
     }

   ~CSymbolBot()
     {
      if(m_rsi  != INVALID_HANDLE) IndicatorRelease(m_rsi);
      if(m_macd != INVALID_HANDLE) IndicatorRelease(m_macd);
      if(m_stoch!= INVALID_HANDLE) IndicatorRelease(m_stoch);
      if(m_atr  != INVALID_HANDLE) IndicatorRelease(m_atr);
      if(m_emaF != INVALID_HANDLE) IndicatorRelease(m_emaF);
      if(m_emaS != INVALID_HANDLE) IndicatorRelease(m_emaS);
     }

   bool Setup(const string sym, double lot, int maxPos)
     {
      m_sym = sym; m_lot = lot;
      m_cap = (maxPos <= 0) ? SPB_MAX_TRADES_PER_SYM : maxPos;
      m_magic = SPB_Magic(sym);
      m_prof  = SPB_Profile(sym);
      m_trade.SetExpertMagicNumber((long)m_magic);
      m_trade.SetDeviationInPoints(30);
      m_trade.SetTypeFillingBySymbol(m_sym);
      if(!SymbolSelect(m_sym, true)) { Print("Symbol missing: ", m_sym); return false; }
      if(SymbolInfoInteger(m_sym, SYMBOL_TRADE_MODE) == SYMBOL_TRADE_MODE_DISABLED) return false;
      m_rsi   = iRSI(m_sym, PERIOD_M1, 14, PRICE_CLOSE);
      m_macd  = iMACD(m_sym, PERIOD_M1, 12, 26, 9, PRICE_CLOSE);
      m_stoch = iStochastic(m_sym, PERIOD_M1, 5, 3, 3, MODE_SMA, STO_LOWHIGH);
      m_atr   = iATR(m_sym, PERIOD_M1, 14);
      m_emaF  = iMA(m_sym, PERIOD_M1, 8, 0, MODE_EMA, PRICE_CLOSE);
      m_emaS  = iMA(m_sym, PERIOD_M1, 21, 0, MODE_EMA, PRICE_CLOSE);
      return m_rsi != INVALID_HANDLE && m_macd != INVALID_HANDLE &&
             m_stoch != INVALID_HANDLE && m_atr != INVALID_HANDLE &&
             m_emaF != INVALID_HANDLE && m_emaS != INVALID_HANDLE;
     }

   string Sym()   const { return m_sym; }
   string Label() const { return m_prof.label; }
   int OpenN()    const { return Count(); }
   int BuyN()     const { return Count(POSITION_TYPE_BUY); }
   int SellN()    const { return Count(POSITION_TYPE_SELL); }
   int Wins()     const { return m_winsClosed; }
   SSignalInfo LastSignal() const { return m_lastSig; }
   SHourContext HourCtx()   const { return m_hour; }

   double FloatPnL() const
     {
      double t = 0;
      for(int i = 0; i < PositionsTotal(); i++)
        {
         ulong tk = PositionGetTicket(i);
         if(!PositionSelectByTicket(tk)) continue;
         if(PositionGetString(POSITION_SYMBOL) != m_sym) continue;
         if((ulong)PositionGetInteger(POSITION_MAGIC) != m_magic) continue;
         t += PnL(tk);
        }
      return t;
     }

   SHourContext AnalyzeHour() const
     {
      SHourContext h;
      h.bias = 0; h.bullBars = 0; h.bearBars = 0; h.netChange = 0;
      h.avgCandleScore = 0; h.buySignals = 0; h.sellSignals = 0;
      h.h1Trend = H1Trend(); h.text = "";
      double cStart = iClose(m_sym, PERIOD_M1, SPB_HOUR_BARS);
      double cEnd   = iClose(m_sym, PERIOD_M1, 1);
      if(cStart > 0) h.netChange = cEnd - cStart;
      int candleSum = 0, emaBull = 0, emaBear = 0;
      for(int bar = 1; bar <= SPB_HOUR_BARS; bar++)
        {
         SCandleBar b;
         if(!SPB_ReadCandle(m_sym, PERIOD_M1, bar, b)) continue;
         if(b.bull) h.bullBars++; else if(b.bear) h.bearBars++;
         int cs = SPB_CandleScore(m_sym, PERIOD_M1, bar);
         candleSum += cs;
         if(cs >= 8)  h.buySignals++;
         if(cs <= -8) h.sellSignals++;
         int ev = VoteEMAAtBar(PERIOD_M1, bar);
         if(ev > 0) emaBull++; else if(ev < 0) emaBear++;
        }
      int totalBars = h.bullBars + h.bearBars;
      int bullPct = (totalBars > 0) ? (h.bullBars * 100 / totalBars) : 50;
      h.avgCandleScore = candleSum / SPB_HOUR_BARS;
      int priceBias = 0;
      if(h.netChange > 0) priceBias = 1; else if(h.netChange < 0) priceBias = -1;
      int candleBias = 0;
      if(h.buySignals > h.sellSignals + 5) candleBias = 1;
      else if(h.sellSignals > h.buySignals + 5) candleBias = -1;
      int emaHistBias = 0;
      if(emaBull > emaBear + 8) emaHistBias = 1;
      else if(emaBear > emaBull + 8) emaHistBias = -1;
      int raw = priceBias * 25 + candleBias * 25 + emaHistBias * 20;
      raw += (bullPct - 50);
      raw += h.avgCandleScore / 3;
      raw += h.h1Trend * 15;
      if(raw > 100)  raw = 100;
      if(raw < -100) raw = -100;
      h.bias = raw;
      string trend = (h.bias >= 15) ? "BULL" : (h.bias <= -15) ? "BEAR" : "FLAT";
      h.text = StringFormat("1H %s bias:%d bull:%d%% chg:%.1f buySig:%d sellSig:%d",
                            trend, h.bias, bullPct, h.netChange, h.buySignals, h.sellSignals);
      return h;
     }

   SSignalInfo Analyze() const
     {
      SSignalInfo r;
      r.dir = SPB_NONE; r.strong = false; r.hourAligned = false;
      r.text = "Scanning"; r.hourBias = m_hour.bias;
      int bv = 0, sv = 0;
      int votes[7];
      votes[0] = VoteEMAExec();
      votes[1] = VoteEMA(PERIOD_M1);
      votes[2] = VoteEMA(PERIOD_M5);
      votes[3] = VoteEMA(PERIOD_M15);
      votes[4] = VoteRSI();
      votes[5] = VoteMACD();
      votes[6] = VoteStoch();
      for(int i = 0; i < 7; i++) { if(votes[i] > 0) bv += votes[i]; else if(votes[i] < 0) sv += -votes[i]; }
      int cM1  = SPB_CandleScore(m_sym, PERIOD_M1,  1);
      int cM5  = SPB_CandleScore(m_sym, PERIOD_M5,  1);
      int cM15 = SPB_CandleScore(m_sym, PERIOD_M15, 1);
      int mom  = Momentum();
      int candle = cM1 + (int)MathRound(cM5 * 0.6) + (int)MathRound(cM15 * 0.3);
      int score = (bv - sv) * 10 + candle + mom * 6;
      score += (int)MathRound(m_hour.bias * 0.30);
      r.buyVotes = bv; r.sellVotes = sv;
      r.cM1 = cM1; r.cM5 = cM5; r.cM15 = cM15;
      r.momentum = mom; r.score = score;
      bool bullTF  = (cM1 >= 4 && cM5 >= -2 && cM15 >= -6);
      bool bearTF  = (cM1 <= -4 && cM5 <= 2 && cM15 <= 6);
      bool bullInd = (bv >= m_prof.minVotes && bv > sv);
      bool bearInd = (sv >= m_prof.minVotes && sv > bv);
      // strong 1H bias can substitute for 1 missing indicator vote
      if(!bullInd && m_hour.bias >= 18 && bv >= 2 && bv > sv) bullInd = true;
      if(!bearInd && m_hour.bias <= -18 && sv >= 2 && sv > bv) bearInd = true;
      bool hourBull = (m_hour.bias >= 6);
      bool hourBear = (m_hour.bias <= -6);
      bool h1OkBuy  = (m_hour.h1Trend >= 0 || m_hour.bias >= 18);
      bool h1OkSell = (m_hour.h1Trend <= 0 || m_hour.bias <= -18);
      bool buyOk  = (score >= m_prof.minScore && bullInd && bullTF && candle >= 4 && hourBull && h1OkBuy);
      bool sellOk = (score <= -m_prof.minScore && bearInd && bearTF && candle <= -4 && hourBear && h1OkSell);
      r.strong = (MathAbs(score) >= m_prof.minScore * 2 && MathAbs(m_hour.bias) >= 18);
      r.hourAligned = (buyOk || sellOk);
      if(buyOk) r.dir = SPB_BUY;
      else if(sellOk) r.dir = SPB_SELL;
      if(r.dir == SPB_BUY)
        r.text = StringFormat("BUY sc=%d bv=%d 1H=%d %s", score, bv, m_hour.bias, m_hour.text);
      else if(r.dir == SPB_SELL)
        r.text = StringFormat("SELL sc=%d sv=%d 1H=%d %s", score, sv, m_hour.bias, m_hour.text);
      else
        {
         string why = "";
         if(score > -m_prof.minScore && score < m_prof.minScore) why += "score;";
         else if(score <= -m_prof.minScore) { if(!bearInd) why += StringFormat("sv:%d/%d;", sv, m_prof.minVotes);
            if(!bearTF) why += StringFormat("bearTF(cM1:%d);", cM1);
            if(candle > -4) why += StringFormat("candle:%d;", candle);
            if(!hourBear) why += "1Hweak;";
            if(!h1OkSell) why += "H1opp;"; }
         else { if(!bullInd) why += StringFormat("bv:%d/%d;", bv, m_prof.minVotes);
            if(!bullTF) why += StringFormat("bullTF(cM1:%d);", cM1);
            if(candle < 4) why += StringFormat("candle:%d;", candle);
            if(!hourBull) why += "1Hweak;";
            if(!h1OkBuy) why += "H1opp;"; }
         if(why == "") why = "mixed;";
         r.text = StringFormat("WAIT sc=%d 1H=%d bv=%d sv=%d | block:%s | %s",
                               score, m_hour.bias, bv, sv, why, m_hour.text);
        }
      return r;
     }

   void ManagePnL()
     {
      for(int i = PositionsTotal() - 1; i >= 0; i--)
        {
         ulong tk = PositionGetTicket(i);
         if(!PositionSelectByTicket(tk)) continue;
         if(PositionGetString(POSITION_SYMBOL) != m_sym) continue;
         if((ulong)PositionGetInteger(POSITION_MAGIC) != m_magic) continue;
         double p = PnL(tk);
         int age = AgeSec(tk);
         if(p >= SPB_MIN_PROFIT_USD)
           { if(m_trade.PositionClose(tk)) { m_winsClosed++; m_consecLosses = 0; } continue; }
         if(p > 0 && age >= 3)
           { if(m_trade.PositionClose(tk)) { m_winsClosed++; m_consecLosses = 0; } continue; }
        }
     }

   bool LoserReadyToReverse(ENUM_SPB_SIGNAL want) const
     {
      for(int i = 0; i < PositionsTotal(); i++)
        {
         ulong tk = PositionGetTicket(i);
         if(!PositionSelectByTicket(tk)) continue;
         if(PositionGetString(POSITION_SYMBOL) != m_sym) continue;
         if((ulong)PositionGetInteger(POSITION_MAGIC) != m_magic) continue;
         if(PnL(tk) >= 0 || AgeSec(tk) < SPB_LOSS_HOLD_SEC) continue;
         long side = PositionGetInteger(POSITION_TYPE);
         if(want == SPB_BUY  && side == POSITION_TYPE_SELL) return true;
         if(want == SPB_SELL && side == POSITION_TYPE_BUY)  return true;
        }
      return false;
     }

   void CloseSide(ENUM_POSITION_TYPE side)
     {
      for(int i = PositionsTotal() - 1; i >= 0; i--)
        {
         ulong tk = PositionGetTicket(i);
         if(!PositionSelectByTicket(tk)) continue;
         if(PositionGetString(POSITION_SYMBOL) != m_sym) continue;
         if((ulong)PositionGetInteger(POSITION_MAGIC) != m_magic) continue;
         if((ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE) != side) continue;
         double p = PnL(tk);
         if(m_trade.PositionClose(tk))
           {
            if(p < 0) { m_consecLosses++; if(m_consecLosses >= SPB_MAX_CONSEC_LOSSES) m_pauseUntil = TimeCurrent() + SPB_PAUSE_AFTER_LOSS_SEC; }
            else m_consecLosses = 0;
           }
        }
     }

   bool Open(ENUM_SPB_SIGNAL dir, string tag)
     {
      if(Count() >= m_cap) return false;
      double atr = ATR();
      if(atr <= 0) return false;
      double sl = atr * m_prof.slAtrMult;
      double lot = NormLot(m_lot);
      if(dir == SPB_BUY)
        { double ask = SymbolInfoDouble(m_sym, SYMBOL_ASK); return m_trade.Buy(lot, m_sym, ask, NormPx(ask - sl), 0, tag); }
      if(dir == SPB_SELL)
        { double bid = SymbolInfoDouble(m_sym, SYMBOL_BID); return m_trade.Sell(lot, m_sym, bid, NormPx(bid + sl), 0, tag); }
      return false;
     }

   bool Reverse(ENUM_SPB_SIGNAL dir)
     {
      if(!LoserReadyToReverse(dir) || !HourAllows(dir)) return false;
      if(dir == SPB_BUY)  { CloseSide(POSITION_TYPE_SELL); return Open(SPB_BUY,  "Rev60"); }
      if(dir == SPB_SELL) { CloseSide(POSITION_TYPE_BUY);  return Open(SPB_SELL, "Rev60"); }
      return false;
     }

   void Tick(bool forceNow)
     {
      ManagePnL();
      m_hour = AnalyzeHour();
      m_lastSig = Analyze();
      if(FloatPnL() <= -SPB_MAX_FLOAT_LOSS_USD)
        { if(TimeCurrent() >= m_pauseUntil) m_pauseUntil = TimeCurrent() + SPB_PAUSE_AFTER_LOSS_SEC; return; }
      if(m_lastSig.dir == SPB_NONE) return;
      if(LoserReadyToReverse(m_lastSig.dir))
        { if(Reverse(m_lastSig.dir)) { m_lastOpen = TimeCurrent(); m_entries++; RecordEntryTime(); return; } }
      if(!CanEnter(m_lastSig)) return;
      int cd = m_lastSig.strong ? 2 : 4;
      if(!forceNow && m_lastOpen > 0 && (TimeCurrent() - m_lastOpen) < cd) return;
      if(Open(m_lastSig.dir, m_lastSig.dir == SPB_BUY ? "Buy" : "Sell"))
        { m_lastOpen = TimeCurrent(); m_entries++; RecordEntryTime(); Print(m_sym, " ", m_lastSig.text); }
     }
  };

//===== INPUTS ========================================================
input double InpLotSize       = 0.01;
input int    InpMaxPerSymbol  = 0;
input string InpExtraSymbols  = "";

//===== GLOBALS =======================================================
CSymbolBot g_bots[];
int        g_nBots = 0;

bool SPB_AddBot(const string sym)
  {
   if(StringLen(sym) < 3) return false;
   for(int i = 0; i < g_nBots; i++) if(g_bots[i].Sym() == sym) return true;
   ArrayResize(g_bots, g_nBots + 1);
   if(!g_bots[g_nBots].Setup(sym, InpLotSize, InpMaxPerSymbol))
     { Print("Init failed: ", sym); return false; }
   Print("Market loaded: ", sym, " [", SPB_Profile(sym).label, "]");
   g_nBots++;
   return true;
  }

void SPB_LoadMarkets()
  {
   g_nBots = 0;
   ArrayResize(g_bots, 0);
   SPB_AddBot(_Symbol);
   if(StringLen(InpExtraSymbols) > 0)
     {
      string list[];
      int n = StringSplit(InpExtraSymbols, ',', list);
      for(int i = 0; i < n; i++)
        {
         StringTrimLeft(list[i]);
         StringTrimRight(list[i]);
         if(list[i] != _Symbol && StringLen(list[i]) > 2) SPB_AddBot(list[i]);
        }
     }
  }

//===== REQUIRED EA EVENT HANDLERS ====================================
int OnInit()
  {
   if(InpLotSize <= 0) return INIT_PARAMETERS_INCORRECT;
   SPB_LoadMarkets();
   if(g_nBots == 0) return INIT_FAILED;
   EventSetMillisecondTimer(SPB_SCAN_INTERVAL_MS);
   Print("ScalpProfit v6.1 started | markets=", g_nBots);
   for(int i = 0; i < g_nBots; i++) g_bots[i].Tick(true);
   return INIT_SUCCEEDED;
  }

void OnDeinit(const int reason)
  {
   EventKillTimer();
   Comment("");
  }

void OnTimer()
  {
   string hud = "=== ScalpProfit v6.1 ===\n";
   for(int i = 0; i < g_nBots; i++)
     {
      g_bots[i].Tick(false);
      SSignalInfo s = g_bots[i].LastSignal();
      SHourContext h = g_bots[i].HourCtx();
      string sig = (s.dir == SPB_BUY) ? "BUY" : (s.dir == SPB_SELL) ? "SELL" : "WAIT";
      hud += StringFormat("%s [%s] %s sc:%d 1H:%d | open:%d | float:$%.2f | wins:%d\n  %s\n",
                          g_bots[i].Sym(), g_bots[i].Label(), sig, s.score, h.bias,
                          g_bots[i].OpenN(), g_bots[i].FloatPnL(), g_bots[i].Wins(), s.text);
     }
   Comment(hud);
  }

void OnTick()
  {
   for(int i = 0; i < g_nBots; i++)
      g_bots[i].Tick(false);
  }
//+------------------------------------------------------------------+
