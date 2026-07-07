//+------------------------------------------------------------------+
//|                              ScalpProfit.mq5                     |
//|              ScalpProfitBot v7.0 — ACCURACY + READABILITY          |
//+------------------------------------------------------------------+
//| Paste ALL of this file into MetaEditor → Compile F7 → M1 chart   |
//|                                                                   |
//| v7 FOCUS:                                                         |
//|  • 1-hour signal memory per market (60 M1 bars) for accuracy     |
//|  • Live + historical blended into one readable signal score      |
//|  • Clear HUD: direction, strength %, votes, 1H trend, action     |
//|  • NO trade blocks (no pause, no rate limit, no stack blocks)    |
//|  • Instant $0.01 profit close | 60s loss hold then reverse       |
//+------------------------------------------------------------------+
#property copyright   "ScalpProfitBot"
#property version     "7.00"
#property description "ScalpProfit v7 — enhanced signals, no entry blocks"

#include <Trade/Trade.mqh>

#define SPB_MIN_PROFIT_USD     0.01
#define SPB_LOSS_HOLD_SEC      60
#define SPB_SCAN_MS            200
#define SPB_BASE_MAGIC         880090
#define SPB_MAX_TRADES         30
#define SPB_HOUR_BARS          60

enum ENUM_SPB_SIGNAL { SPB_NONE = 0, SPB_BUY = 1, SPB_SELL = -1 };

struct SCandleBar
  {
   double o, h, l, c, body, uw, lw, rng;
   bool   bull, bear;
  };

struct SMarketProfile
  {
   double slAtrMult;
   int    minScore;
   string label;
  };

struct SHourMemory
  {
   int    bias;
   int    bullPct, buySig, sellSig, avgCandle;
   double netChange;
   int    h1Trend;
   string trendLabel;
   string summary;
  };

struct SSignalInfo
  {
   ENUM_SPB_SIGNAL dir;
   int    liveScore, hourScore, finalScore, strength;
   int    buyVotes, sellVotes, cM1, cM5, cM15, momentum;
   bool   hourAligned, strong;
   string strengthLabel;
   string action;
   string text;
  };

//===== CANDLE PATTERNS ===============================================
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
   p.slAtrMult = 2.5; p.minScore = 18; p.label = "FOREX";
   if(StringFind(sym, "XAU") >= 0 || StringFind(sym, "GOLD") >= 0)
     { p.slAtrMult = 2.2; p.minScore = 16; p.label = "GOLD"; }
   else if(StringFind(sym, "BTC") >= 0 || StringFind(sym, "ETH") >= 0)
     { p.slAtrMult = 2.8; p.minScore = 17; p.label = "CRYPTO"; }
   else if(StringFind(sym, "US30") >= 0 || StringFind(sym, "UT100") >= 0 ||
           StringFind(sym, "US100") >= 0 || StringFind(sym, "NAS") >= 0 ||
           StringFind(sym, "DAX") >= 0  || StringFind(sym, "JPN") >= 0)
     { p.slAtrMult = 2.0; p.minScore = 16; p.label = "INDEX"; }
   return p;
  }

ulong SPB_Magic(const string sym)
  {
   ulong h = SPB_BASE_MAGIC;
   for(int i = 0; i < StringLen(sym); i++)
      h = h * 31 + (ulong)StringGetCharacter(sym, i);
   return h;
  }

int SPB_StrengthPct(const int finalScore, const int minScore)
  {
   if(minScore <= 0) return 0;
   int pct = (int)MathRound((double)MathAbs(finalScore) / (double)(minScore * 2) * 100.0);
   if(pct > 100) pct = 100;
   return pct;
  }

string SPB_StrengthLabel(const int pct)
  {
   if(pct >= 75) return "STRONG";
   if(pct >= 45) return "MEDIUM";
   if(pct >= 20) return "WEAK";
   return "FLAT";
  }

//===== PER-SYMBOL BOT ================================================
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
   datetime       m_lastOpen;
   int            m_entries, m_winsClosed;
   SSignalInfo    m_lastSig;
   SHourMemory    m_hour;

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

public:
   CSymbolBot()
     {
      m_sym = ""; m_magic = 0; m_lot = 0.01; m_cap = SPB_MAX_TRADES;
      m_rsi = m_macd = m_stoch = m_atr = m_emaF = m_emaS = INVALID_HANDLE;
      m_lastOpen = 0; m_entries = 0; m_winsClosed = 0;
      m_lastSig.dir = SPB_NONE;
      m_hour.bias = 0;
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
      m_cap = (maxPos <= 0) ? SPB_MAX_TRADES : maxPos;
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
   int Wins()     const { return m_winsClosed; }
   SSignalInfo LastSignal() const { return m_lastSig; }
   SHourMemory HourMem()    const { return m_hour; }

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

   //--- Read past 1 hour of signals on this chart (60 M1 bars)
   SHourMemory ReadHourMemory() const
     {
      SHourMemory h;
      h.bias = 0; h.bullPct = 50; h.buySig = 0; h.sellSig = 0;
      h.avgCandle = 0; h.netChange = 0; h.h1Trend = H1Trend();
      h.trendLabel = "FLAT"; h.summary = "";

      double cStart = iClose(m_sym, PERIOD_M1, SPB_HOUR_BARS);
      double cEnd   = iClose(m_sym, PERIOD_M1, 1);
      if(cStart > 0) h.netChange = cEnd - cStart;

      int bullBars = 0, bearBars = 0, candleSum = 0, emaBull = 0, emaBear = 0;
      for(int bar = 1; bar <= SPB_HOUR_BARS; bar++)
        {
         SCandleBar b;
         if(!SPB_ReadCandle(m_sym, PERIOD_M1, bar, b)) continue;
         if(b.bull) bullBars++; else if(b.bear) bearBars++;
         int cs = SPB_CandleScore(m_sym, PERIOD_M1, bar);
         candleSum += cs;
         if(cs >= 6)  h.buySig++;
         if(cs <= -6) h.sellSig++;
         int ev = VoteEMAAtBar(PERIOD_M1, bar);
         if(ev > 0) emaBull++; else if(ev < 0) emaBear++;
        }

      int total = bullBars + bearBars;
      h.bullPct = (total > 0) ? (bullBars * 100 / total) : 50;
      h.avgCandle = candleSum / SPB_HOUR_BARS;

      int priceDir = (h.netChange > 0) ? 1 : (h.netChange < 0) ? -1 : 0;
      int sigDir   = (h.buySig > h.sellSig + 3) ? 1 : (h.sellSig > h.buySig + 3) ? -1 : 0;
      int emaDir   = (emaBull > emaBear + 6) ? 1 : (emaBear > emaBull + 6) ? -1 : 0;

      int raw = priceDir * 28 + sigDir * 24 + emaDir * 18;
      raw += (h.bullPct - 50);
      raw += h.avgCandle / 4;
      raw += h.h1Trend * 12;
      if(raw > 100)  raw = 100;
      if(raw < -100) raw = -100;
      h.bias = raw;

      if(h.bias >= 12)       h.trendLabel = "BULLISH";
      else if(h.bias <= -12) h.trendLabel = "BEARISH";
      else                   h.trendLabel = "NEUTRAL";

      h.summary = StringFormat("1H %s bias:%d | bull:%d%% | chg:%.1f | buySig:%d sellSig:%d | H1:%s",
                               h.trendLabel, h.bias, h.bullPct, h.netChange, h.buySig, h.sellSig,
                               (h.h1Trend > 0) ? "UP" : (h.h1Trend < 0) ? "DOWN" : "FLAT");
      return h;
     }

   //--- Live chart signals right now
   int ReadLiveScore(int &bv, int &sv, int &cM1, int &cM5, int &cM15, int &mom) const
     {
      bv = 0; sv = 0;
      int votes[7];
      votes[0] = VoteEMAExec();
      votes[1] = VoteEMA(PERIOD_M1);
      votes[2] = VoteEMA(PERIOD_M5);
      votes[3] = VoteEMA(PERIOD_M15);
      votes[4] = VoteRSI();
      votes[5] = VoteMACD();
      votes[6] = VoteStoch();
      for(int i = 0; i < 7; i++)
        { if(votes[i] > 0) bv += votes[i]; else if(votes[i] < 0) sv += -votes[i]; }

      cM1  = SPB_CandleScore(m_sym, PERIOD_M1,  1);
      cM5  = SPB_CandleScore(m_sym, PERIOD_M5,  1);
      cM15 = SPB_CandleScore(m_sym, PERIOD_M15, 1);
      mom  = Momentum();
      int candle = cM1 + (int)MathRound(cM5 * 0.55) + (int)MathRound(cM15 * 0.25);
      return (bv - sv) * 9 + candle + mom * 5;
     }

   //--- Blend live + 1H memory into one accurate readable signal
   SSignalInfo BuildSignal() const
     {
      SSignalInfo r;
      r.dir = SPB_NONE; r.strong = false; r.hourAligned = false;
      r.strength = 0; r.strengthLabel = "FLAT";
      r.action = "SCAN"; r.text = "";

      int bv, sv, cM1, cM5, cM15, mom;
      r.liveScore = ReadLiveScore(bv, sv, cM1, cM5, cM15, mom);
      r.hourScore = m_hour.bias;
      r.buyVotes = bv; r.sellVotes = sv;
      r.cM1 = cM1; r.cM5 = cM5; r.cM15 = cM15; r.momentum = mom;

      // 60% live chart + 40% past hour memory
      r.finalScore = (int)MathRound(r.liveScore * 0.60 + r.hourScore * 0.40);

      // Accuracy boost when live and 1H agree (same sign, both meaningful)
      if(r.liveScore > 8 && r.hourScore > 8)
        { r.finalScore += 8; r.hourAligned = true; }
      else if(r.liveScore < -8 && r.hourScore < -8)
        { r.finalScore -= 8; r.hourAligned = true; }

      r.strength = SPB_StrengthPct(r.finalScore, m_prof.minScore);
      r.strengthLabel = SPB_StrengthLabel(r.strength);

      bool buySignal  = (r.finalScore >= m_prof.minScore && bv >= sv);
      bool sellSignal = (r.finalScore <= -m_prof.minScore && sv >= bv);

      if(buySignal)       r.dir = SPB_BUY;
      else if(sellSignal) r.dir = SPB_SELL;

      r.strong = (r.strength >= 75);

      if(r.dir == SPB_BUY)
        {
         r.action = r.strong ? "OPEN BUY (stack OK)" : "OPEN BUY";
         r.text = StringFormat("BUY %s %d%% | live:%d 1H:%d final:%d | B:%d S:%d | M1:%d M5:%d",
                               r.strengthLabel, r.strength, r.liveScore, r.hourScore, r.finalScore,
                               bv, sv, cM1, cM5);
        }
      else if(r.dir == SPB_SELL)
        {
         r.action = r.strong ? "OPEN SELL (stack OK)" : "OPEN SELL";
         r.text = StringFormat("SELL %s %d%% | live:%d 1H:%d final:%d | B:%d S:%d | M1:%d M5:%d",
                               r.strengthLabel, r.strength, r.liveScore, r.hourScore, r.finalScore,
                               bv, sv, cM1, cM5);
        }
      else
        {
         r.action = "WATCH";
         string lean = (r.finalScore > 5) ? "lean BUY" : (r.finalScore < -5) ? "lean SELL" : "no edge";
         r.text = StringFormat("WATCH %s | live:%d 1H:%d final:%d | B:%d S:%d | %s",
                               lean, r.liveScore, r.hourScore, r.finalScore, bv, sv, m_hour.summary);
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
           { if(m_trade.PositionClose(tk)) { m_winsClosed++; Print(m_sym, " WIN $", DoubleToString(p, 2)); } continue; }
         if(p > 0 && age >= 3)
           { if(m_trade.PositionClose(tk)) { m_winsClosed++; Print(m_sym, " micro $", DoubleToString(p, 4)); } continue; }
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
         m_trade.PositionClose(tk);
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
      if(!LoserReadyToReverse(dir)) return false;
      if(dir == SPB_BUY)  { CloseSide(POSITION_TYPE_SELL); return Open(SPB_BUY,  "Rev60"); }
      if(dir == SPB_SELL) { CloseSide(POSITION_TYPE_BUY);  return Open(SPB_SELL, "Rev60"); }
      return false;
     }

   void Tick(bool forceNow)
     {
      ManagePnL();
      m_hour = ReadHourMemory();
      m_lastSig = BuildSignal();

      if(m_lastSig.dir == SPB_NONE) return;

      if(LoserReadyToReverse(m_lastSig.dir))
        {
         if(Reverse(m_lastSig.dir)) { m_lastOpen = TimeCurrent(); m_entries++; return; }
        }

      int cd = m_lastSig.strong ? 0 : 1;
      if(!forceNow && m_lastOpen > 0 && (TimeCurrent() - m_lastOpen) < cd) return;

      if(Open(m_lastSig.dir, m_lastSig.dir == SPB_BUY ? "Buy" : "Sell"))
        {
         m_lastOpen = TimeCurrent();
         m_entries++;
         Print(m_sym, " ", m_lastSig.text, " | ", m_hour.summary);
        }
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

//===== EA EVENT HANDLERS =============================================
int OnInit()
  {
   if(InpLotSize <= 0) return INIT_PARAMETERS_INCORRECT;
   SPB_LoadMarkets();
   if(g_nBots == 0) return INIT_FAILED;
   EventSetMillisecondTimer(SPB_SCAN_MS);
   Print("ScalpProfit v7 started | markets=", g_nBots, " | 1H memory=", SPB_HOUR_BARS, " bars");
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
   string hud = "=== ScalpProfit v7 (signal accuracy) ===\n";
   for(int i = 0; i < g_nBots; i++)
     {
      g_bots[i].Tick(false);
      SSignalInfo s = g_bots[i].LastSignal();
      SHourMemory h = g_bots[i].HourMem();
      string sig = (s.dir == SPB_BUY) ? "BUY" : (s.dir == SPB_SELL) ? "SELL" : "WATCH";
      string align = s.hourAligned ? "ALIGNED" : "mixed";
      hud += StringFormat(
         "%s [%s] %s %s %d%% | %s | open:%d float:$%.2f wins:%d\n"
         "  Live:%d 1H:%d Final:%d | B:%d S:%d | M1:%d M5:%d M15:%d\n"
         "  %s\n  Action: %s\n",
         g_bots[i].Sym(), g_bots[i].Label(), sig, s.strengthLabel, s.strength, align,
         g_bots[i].OpenN(), g_bots[i].FloatPnL(), g_bots[i].Wins(),
         s.liveScore, s.hourScore, s.finalScore, s.buyVotes, s.sellVotes,
         s.cM1, s.cM5, s.cM15, h.summary, s.action);
     }
   Comment(hud);
  }

void OnTick()
  {
   for(int i = 0; i < g_nBots; i++)
      g_bots[i].Tick(false);
  }
//+------------------------------------------------------------------+
