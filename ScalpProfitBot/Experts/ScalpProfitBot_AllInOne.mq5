//+------------------------------------------------------------------+
//|                              ScalpProfitBot_AllInOne.mq5  v4.0   |
//|  Multi-symbol | unlimited analyzed trades | instant flip entries |
//+------------------------------------------------------------------+
#property copyright   "ScalpProfitBot"
#property version     "4.00"
#property description "v4: multi-market, unlimited trades, precision signals, 60s loss hold"

#include <Trade/Trade.mqh>

#define SCALP_MIN_PROFIT_MONEY    0.01
#define SCALP_LOSS_WAIT_SECONDS   60
#define SCALP_SCAN_MS             200
#define SCALP_BASE_MAGIC          880080
#define SCALP_MAX_POS_PER_SYM     0      // 0 = unlimited (internal cap 30)

//+------------------------------------------------------------------+
enum ENUM_SCALP_SIGNAL { SCALP_NONE = 0, SCALP_BUY = 1, SCALP_SELL = -1 };

struct SCandleMetrics
  {
   double open, high, low, close, body, upperWick, lowerWick, range;
   bool   bullish, bearish;
  };

//+------------------------------------------------------------------+
bool ScalpGetCandle(const string sym, const ENUM_TIMEFRAMES tf, const int sh, SCandleMetrics &m)
  {
   m.open = iOpen(sym, tf, sh); m.high = iHigh(sym, tf, sh);
   m.low = iLow(sym, tf, sh); m.close = iClose(sym, tf, sh);
   if(m.open == 0.0 && m.high == 0.0 && m.low == 0.0 && m.close == 0.0) return false;
   m.body = MathAbs(m.close - m.open); m.range = m.high - m.low;
   m.upperWick = m.high - MathMax(m.open, m.close);
   m.lowerWick = MathMin(m.open, m.close) - m.low;
   m.bullish = (m.close > m.open); m.bearish = (m.close < m.open);
   return (m.range > 0.0);
  }

double ScalpBodyRatio(const SCandleMetrics &m) { return (m.range <= 0.0) ? 0.0 : m.body / m.range; }

bool ScalpBullEngulf(const string sym, const ENUM_TIMEFRAMES tf, const int sh)
  {
   SCandleMetrics c1, c0;
   if(!ScalpGetCandle(sym, tf, sh + 1, c1) || !ScalpGetCandle(sym, tf, sh, c0)) return false;
   return (c1.bearish && c0.bullish && c0.open <= c1.close && c0.close >= c1.open && c0.body > c1.body * 0.75);
  }

bool ScalpBearEngulf(const string sym, const ENUM_TIMEFRAMES tf, const int sh)
  {
   SCandleMetrics c1, c0;
   if(!ScalpGetCandle(sym, tf, sh + 1, c1) || !ScalpGetCandle(sym, tf, sh, c0)) return false;
   return (c1.bullish && c0.bearish && c0.open >= c1.close && c0.close <= c1.open && c0.body > c1.body * 0.75);
  }

bool ScalpHammer(const SCandleMetrics &m)
  {
   if(m.range <= 0.0) return false;
   return (ScalpBodyRatio(m) <= 0.35 && m.lowerWick / m.range >= 0.50 && m.upperWick / m.range <= 0.25);
  }

bool ScalpShootingStar(const SCandleMetrics &m)
  {
   if(m.range <= 0.0) return false;
   return (ScalpBodyRatio(m) <= 0.35 && m.upperWick / m.range >= 0.50 && m.lowerWick / m.range <= 0.25);
  }

bool ScalpPinBarBull(const SCandleMetrics &m)
  {
   if(m.range <= 0.0) return false;
   return (m.lowerWick / m.range >= 0.60 && ScalpBodyRatio(m) <= 0.30);
  }

bool ScalpPinBarBear(const SCandleMetrics &m)
  {
   if(m.range <= 0.0) return false;
   return (m.upperWick / m.range >= 0.60 && ScalpBodyRatio(m) <= 0.30);
  }

int ScalpCandleScore(const string sym, const ENUM_TIMEFRAMES tf, const int sh)
  {
   SCandleMetrics c0;
   if(!ScalpGetCandle(sym, tf, sh, c0)) return 0;
   int sc = 0;
   if(ScalpBullEngulf(sym, tf, sh)) sc += 22;
   if(ScalpBearEngulf(sym, tf, sh)) sc -= 22;
   if(ScalpHammer(c0)) sc += 15;
   if(ScalpShootingStar(c0)) sc -= 15;
   if(ScalpPinBarBull(c0)) sc += 12;
   if(ScalpPinBarBear(c0)) sc -= 12;
   if(c0.bullish && ScalpBodyRatio(c0) > 0.62) sc += 9;
   if(c0.bearish && ScalpBodyRatio(c0) > 0.62) sc -= 9;
   SCandleMetrics c1;
   if(ScalpGetCandle(sym, tf, sh + 1, c1))
     {
      if(c1.bearish && c0.bullish && c0.close > c1.high) sc += 11;
      if(c1.bullish && c0.bearish && c0.close < c1.low) sc -= 11;
     }
   return sc;
  }

//+------------------------------------------------------------------+
struct SMarketProfile
  {
   double wideSlAtr;
   int    minScore;
   int    minVotes;
   string typeName;
  };

SMarketProfile BuildProfile(const string sym)
  {
   SMarketProfile p;
   p.wideSlAtr = 2.50; p.minScore = 24; p.minVotes = 3; p.typeName = "FOREX";
   if(StringFind(sym, "XAU") >= 0 || StringFind(sym, "GOLD") >= 0)
     { p.wideSlAtr = 2.20; p.minScore = 22; p.typeName = "GOLD"; }
   else if(StringFind(sym, "BTC") >= 0 || StringFind(sym, "ETH") >= 0)
     { p.wideSlAtr = 2.80; p.minScore = 23; p.typeName = "CRYPTO"; }
   else if(StringFind(sym, "US30") >= 0 || StringFind(sym, "US100") >= 0 ||
           StringFind(sym, "UT100") >= 0 || StringFind(sym, "NAS") >= 0 ||
           StringFind(sym, "DAX") >= 0 || StringFind(sym, "JPN") >= 0)
     { p.wideSlAtr = 2.00; p.minScore = 22; p.typeName = "INDEX"; }
   return p;
  }

ulong MagicForSymbol(const string sym)
  {
   ulong h = SCALP_BASE_MAGIC;
   for(int i = 0; i < StringLen(sym); i++)
      h = h * 31 + (ulong)StringGetCharacter(sym, i);
   return h;
  }

//+------------------------------------------------------------------+
struct SSignalResult
  {
   ENUM_SCALP_SIGNAL dir;
   int    score, buyVotes, sellVotes, candleM1, candleM5, candleM15, momentum;
   bool   strong;
   string reason;
  };

//+------------------------------------------------------------------+
//| Per-symbol runner — fully isolated analysis & trading             |
//+------------------------------------------------------------------+
class CSymbolRunner
  {
private:
   string          m_sym;
   ulong           m_magic;
   double          m_lot;
   int             m_maxPos;
   SMarketProfile  m_prof;
   CTrade          m_trade;

   int             m_rsi, m_macd, m_stoch, m_atr, m_emaF, m_emaS;
   datetime        m_lastEntry;
   int             m_today, m_winsTaken;
   string          m_lastReason;

   bool GetBuf(const int h, const int buf, const int cnt, double &a[]) const
     { ArraySetAsSeries(a, true); return (CopyBuffer(h, buf, 0, cnt, a) >= cnt); }

   int EmaVoteTF(const ENUM_TIMEFRAMES tf) const
     {
      const int fh = iMA(m_sym, tf, 8, 0, MODE_EMA, PRICE_CLOSE);
      const int sh = iMA(m_sym, tf, 21, 0, MODE_EMA, PRICE_CLOSE);
      if(fh == INVALID_HANDLE || sh == INVALID_HANDLE)
        { if(fh != INVALID_HANDLE) IndicatorRelease(fh); if(sh != INVALID_HANDLE) IndicatorRelease(sh); return 0; }
      double f[], s[]; ArraySetAsSeries(f, true); ArraySetAsSeries(s, true);
      int v = 0;
      if(CopyBuffer(fh, 0, 0, 3, f) >= 3 && CopyBuffer(sh, 0, 0, 3, s) >= 3)
        {
         const double px = iClose(m_sym, tf, 0);
         if(f[0] > s[0] && px > f[0] && f[0] >= f[1]) v = 1;
         else if(f[0] < s[0] && px < f[0] && f[0] <= f[1]) v = -1;
        }
      IndicatorRelease(fh); IndicatorRelease(sh);
      return v;
     }

   int RsiVote() const
     {
      double r[]; if(!GetBuf(m_rsi, 0, 3, r)) return 0;
      if(r[1] < 34.0 && r[0] > r[1]) return 1;
      if(r[1] > 66.0 && r[0] < r[1]) return -1;
      if(r[0] > 54.0 && r[0] > r[1]) return 1;
      if(r[0] < 46.0 && r[0] < r[1]) return -1;
      return 0;
     }

   int MacdVote() const
     {
      double m[], s[];
      if(!GetBuf(m_macd, 0, 3, m) || !GetBuf(m_macd, 1, 3, s)) return 0;
      if(m[0] > s[0] && m[0] > m[1]) return 1;
      if(m[0] < s[0] && m[0] < m[1]) return -1;
      return 0;
     }

   int StochVote() const
     {
      double k[], d[];
      if(!GetBuf(m_stoch, 0, 3, k) || !GetBuf(m_stoch, 1, 3, d)) return 0;
      if(k[1] < 24.0 && k[0] > d[0] && k[0] > k[1]) return 1;
      if(k[1] > 76.0 && k[0] < d[0] && k[0] < k[1]) return -1;
      return 0;
     }

   int EmaExecVote() const
     {
      double f[], s[];
      if(!GetBuf(m_emaF, 0, 2, f) || !GetBuf(m_emaS, 0, 2, s)) return 0;
      const double bid = SymbolInfoDouble(m_sym, SYMBOL_BID);
      if(bid > f[0] && f[0] > s[0]) return 1;
      if(bid < f[0] && f[0] < s[0]) return -1;
      return 0;
     }

   int TickMomentum() const
     {
      const double c0 = iClose(m_sym, PERIOD_M1, 0);
      const double c1 = iClose(m_sym, PERIOD_M1, 1);
      const double c2 = iClose(m_sym, PERIOD_M1, 2);
      if(c0 > c1 && c1 >= c2) return 1;
      if(c0 < c1 && c1 <= c2) return -1;
      return 0;
     }

   double AtrVal() const
     {
      double a[]; if(!GetBuf(m_atr, 0, 1, a)) return 0.0; return a[0];
     }

   double PosPnl(const ulong tk) const
     {
      if(!PositionSelectByTicket(tk)) return 0.0;
      // POSITION_COMMISSION deprecated — profit already includes commission in MT5
      return PositionGetDouble(POSITION_PROFIT) + PositionGetDouble(POSITION_SWAP);
     }

   int PosAge(const ulong tk) const
     {
      if(!PositionSelectByTicket(tk)) return 0;
      return (int)(TimeCurrent() - (datetime)PositionGetInteger(POSITION_TIME));
     }

   int CountPos(const long typeF = -1) const
     {
      int n = 0;
      for(int i = 0; i < PositionsTotal(); i++)
        {
         const ulong tk = PositionGetTicket(i);
         if(!PositionSelectByTicket(tk)) continue;
         if(PositionGetString(POSITION_SYMBOL) != m_sym) continue;
         if((ulong)PositionGetInteger(POSITION_MAGIC) != m_magic) continue;
         if(typeF >= 0 && PositionGetInteger(POSITION_TYPE) != typeF) continue;
         n++;
        }
      return n;
     }

   double NormLot(const double lot) const
     {
      double minL = SymbolInfoDouble(m_sym, SYMBOL_VOLUME_MIN);
      double maxL = SymbolInfoDouble(m_sym, SYMBOL_VOLUME_MAX);
      double step = SymbolInfoDouble(m_sym, SYMBOL_VOLUME_STEP);
      if(step <= 0) step = 0.01;
      return NormalizeDouble(MathMax(minL, MathMin(maxL, MathFloor(lot / step) * step)), 2);
     }

   double NormPx(const double px) const
     {
      const int dg = (int)SymbolInfoInteger(m_sym, SYMBOL_DIGITS);
      return NormalizeDouble(px, dg);
     }

public:
                     CSymbolRunner()
     {
      m_sym = ""; m_magic = 0; m_lot = 0.01; m_maxPos = 30;
      m_rsi = m_macd = m_stoch = m_atr = m_emaF = m_emaS = INVALID_HANDLE;
      m_lastEntry = 0; m_today = 0; m_winsTaken = 0;
      m_lastReason = "";
     }

                    ~CSymbolRunner()
     {
      if(m_rsi != INVALID_HANDLE) IndicatorRelease(m_rsi);
      if(m_macd != INVALID_HANDLE) IndicatorRelease(m_macd);
      if(m_stoch != INVALID_HANDLE) IndicatorRelease(m_stoch);
      if(m_atr != INVALID_HANDLE) IndicatorRelease(m_atr);
      if(m_emaF != INVALID_HANDLE) IndicatorRelease(m_emaF);
      if(m_emaS != INVALID_HANDLE) IndicatorRelease(m_emaS);
     }

   bool              Init(const string sym, const double lot, const int maxPos)
     {
      m_sym = sym;
      m_lot = lot;
      m_maxPos = (maxPos <= 0) ? 30 : maxPos;
      m_magic = MagicForSymbol(sym);
      m_prof = BuildProfile(sym);
      m_trade.SetExpertMagicNumber((long)m_magic);
      m_trade.SetDeviationInPoints(30);
      m_trade.SetTypeFillingBySymbol(m_sym);

      if(!SymbolSelect(m_sym, true)) { Print("Symbol not found: ", m_sym); return false; }
      if(SymbolInfoInteger(m_sym, SYMBOL_TRADE_MODE) == SYMBOL_TRADE_MODE_DISABLED) return false;

      m_rsi  = iRSI(m_sym, PERIOD_M1, 14, PRICE_CLOSE);
      m_macd = iMACD(m_sym, PERIOD_M1, 12, 26, 9, PRICE_CLOSE);
      m_stoch = iStochastic(m_sym, PERIOD_M1, 5, 3, 3, MODE_SMA, STO_LOWHIGH);
      m_atr  = iATR(m_sym, PERIOD_M1, 14);
      m_emaF = iMA(m_sym, PERIOD_M1, 8, 0, MODE_EMA, PRICE_CLOSE);
      m_emaS = iMA(m_sym, PERIOD_M1, 21, 0, MODE_EMA, PRICE_CLOSE);

      return (m_rsi != INVALID_HANDLE && m_macd != INVALID_HANDLE && m_stoch != INVALID_HANDLE &&
              m_atr != INVALID_HANDLE && m_emaF != INVALID_HANDLE && m_emaS != INVALID_HANDLE);
     }

   string            Symbol() const { return m_sym; }
   SMarketProfile    Profile() const { return m_prof; }
   int               TotalPos() const { return CountPos(); }
   int               BuyPos() const { return CountPos(POSITION_TYPE_BUY); }
   int               SellPos() const { return CountPos(POSITION_TYPE_SELL); }
   int               WinsTaken() const { return m_winsTaken; }
   int               TodayEntries() const { return m_today; }
   string            LastReason() const { return m_lastReason; }

   double            FloatPnl() const
     {
      double s = 0.0;
      for(int i = 0; i < PositionsTotal(); i++)
        {
         const ulong tk = PositionGetTicket(i);
         if(!PositionSelectByTicket(tk)) continue;
         if(PositionGetString(POSITION_SYMBOL) != m_sym) continue;
         if((ulong)PositionGetInteger(POSITION_MAGIC) != m_magic) continue;
         s += PosPnl(tk);
        }
      return s;
     }

   int               OldestLoserAge() const
     {
      int mx = 0;
      for(int i = 0; i < PositionsTotal(); i++)
        {
         const ulong tk = PositionGetTicket(i);
         if(!PositionSelectByTicket(tk)) continue;
         if(PositionGetString(POSITION_SYMBOL) != m_sym) continue;
         if((ulong)PositionGetInteger(POSITION_MAGIC) != m_magic) continue;
         if(PosPnl(tk) >= 0.0) continue;
         const int a = PosAge(tk);
         if(a > mx) mx = a;
        }
      return mx;
     }

   //--- Precision analysis per symbol (isolated)
   SSignalResult     Analyze() const
     {
      SSignalResult r;
      r.dir = SCALP_NONE; r.score = 0; r.buyVotes = 0; r.sellVotes = 0;
      r.candleM1 = 0; r.candleM5 = 0; r.candleM15 = 0; r.momentum = 0;
      r.strong = false; r.reason = "Scanning";

      int bv = 0, sv = 0;
      const int vEma  = EmaExecVote();
      const int vM1   = EmaVoteTF(PERIOD_M1);
      const int vM5   = EmaVoteTF(PERIOD_M5);
      const int vM15  = EmaVoteTF(PERIOD_M15);
      const int vRsi  = RsiVote();
      const int vMacd = MacdVote();
      const int vSto  = StochVote();
      const int votes[] = { vEma, vM1, vM5, vM15, vRsi, vMacd, vSto };
      for(int i = 0; i < ArraySize(votes); i++)
        {
         if(votes[i] > 0) bv += votes[i];
         else if(votes[i] < 0) sv += -votes[i];
        }

      const int cM1  = ScalpCandleScore(m_sym, PERIOD_M1, 1);
      const int cM5  = ScalpCandleScore(m_sym, PERIOD_M5, 1);
      const int cM15 = ScalpCandleScore(m_sym, PERIOD_M15, 1);
      const int mom  = TickMomentum();
      const int candle = cM1 + (int)MathRound(cM5 * 0.6) + (int)MathRound(cM15 * 0.3);
      const int netVote = bv - sv;
      const int score = netVote * 10 + candle + mom * 6;

      r.buyVotes = bv; r.sellVotes = sv;
      r.candleM1 = cM1; r.candleM5 = cM5; r.candleM15 = cM15;
      r.momentum = mom; r.score = score;

      // Precision gates: all timeframes must agree on direction
      const bool bullTF = (cM1 >= 4 && cM5 >= 0 && cM15 >= -5);
      const bool bearTF = (cM1 <= -4 && cM5 <= 0 && cM15 <= 5);
      const bool bullInd = (bv >= m_prof.minVotes && bv > sv + 1);
      const bool bearInd = (sv >= m_prof.minVotes && sv > bv + 1);

      const bool buyOk  = (score >= m_prof.minScore && bullInd && bullTF && candle >= 5);
      const bool sellOk = (score <= -m_prof.minScore && bearInd && bearTF && candle <= -5);
      r.strong = (MathAbs(score) >= m_prof.minScore * 2);

      if(buyOk)
        {
         r.dir = SCALP_BUY;
         r.reason = StringFormat("BUY sc=%d bv=%d sv=%d cM1=%d cM5=%d", score, bv, sv, cM1, cM5);
        }
      else if(sellOk)
        {
         r.dir = SCALP_SELL;
         r.reason = StringFormat("SELL sc=%d bv=%d sv=%d cM1=%d cM5=%d", score, bv, sv, cM1, cM5);
        }
      else
         r.reason = StringFormat("Wait sc=%d bv=%d sv=%d cM1=%d cM5=%d cM15=%d", score, bv, sv, cM1, cM5, cM15);

      return r;
     }

   int               ManageProfits()
     {
      int closed = 0;
      for(int i = PositionsTotal() - 1; i >= 0; i--)
        {
         const ulong tk = PositionGetTicket(i);
         if(!PositionSelectByTicket(tk)) continue;
         if(PositionGetString(POSITION_SYMBOL) != m_sym) continue;
         if((ulong)PositionGetInteger(POSITION_MAGIC) != m_magic) continue;

         const double pnl = PosPnl(tk);
         const int age = PosAge(tk);

         if(pnl >= SCALP_MIN_PROFIT_MONEY)
           { if(m_trade.PositionClose(tk)) { closed++; m_winsTaken++; Print(m_sym, " profit $", DoubleToString(pnl, 2)); } continue; }

         if(pnl > 0.0 && age >= 3)
           { if(m_trade.PositionClose(tk)) { closed++; m_winsTaken++; Print(m_sym, " micro $", DoubleToString(pnl, 4)); } continue; }

         // Losers under 60s: HOLD for recovery
        }
      return closed;
     }

   bool              HasLoserReady(const ENUM_SCALP_SIGNAL want) const
     {
      for(int i = 0; i < PositionsTotal(); i++)
        {
         const ulong tk = PositionGetTicket(i);
         if(!PositionSelectByTicket(tk)) continue;
         if(PositionGetString(POSITION_SYMBOL) != m_sym) continue;
         if((ulong)PositionGetInteger(POSITION_MAGIC) != m_magic) continue;
         if(PosPnl(tk) >= 0.0) continue;
         if(PosAge(tk) < SCALP_LOSS_WAIT_SECONDS) continue;
         const long t = PositionGetInteger(POSITION_TYPE);
         if(want == SCALP_BUY  && t == POSITION_TYPE_SELL) return true;
         if(want == SCALP_SELL && t == POSITION_TYPE_BUY)  return true;
        }
      return false;
     }

   void              CloseType(const ENUM_POSITION_TYPE t)
     {
      for(int i = PositionsTotal() - 1; i >= 0; i--)
        {
         const ulong tk = PositionGetTicket(i);
         if(!PositionSelectByTicket(tk)) continue;
         if(PositionGetString(POSITION_SYMBOL) != m_sym) continue;
         if((ulong)PositionGetInteger(POSITION_MAGIC) != m_magic) continue;
         if((ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE) != t) continue;
         m_trade.PositionClose(tk);
        }
     }

   bool              OpenTrade(const ENUM_SCALP_SIGNAL dir, const string tag)
     {
      if(CountPos() >= m_maxPos) return false;
      const double atr = AtrVal();
      if(atr <= 0.0) return false;
      const double slD = atr * m_prof.wideSlAtr;
      const double lot = NormLot(m_lot);

      if(dir == SCALP_BUY)
        {
         const double ask = SymbolInfoDouble(m_sym, SYMBOL_ASK);
         return m_trade.Buy(lot, m_sym, ask, NormPx(ask - slD), 0.0, tag);
        }
      if(dir == SCALP_SELL)
        {
         const double bid = SymbolInfoDouble(m_sym, SYMBOL_BID);
         return m_trade.Sell(lot, m_sym, bid, NormPx(bid + slD), 0.0, tag);
        }
      return false;
     }

   bool              ReverseLosers(const ENUM_SCALP_SIGNAL dir)
     {
      if(!HasLoserReady(dir)) return false;
      if(dir == SCALP_BUY)  { CloseType(POSITION_TYPE_SELL); return OpenTrade(SCALP_BUY, "Rev60"); }
      if(dir == SCALP_SELL) { CloseType(POSITION_TYPE_BUY);  return OpenTrade(SCALP_SELL, "Rev60"); }
      return false;
     }

   void              Run(const bool force)
     {
      ManageProfits();
      const SSignalResult sig = Analyze();
      m_lastReason = sig.reason;

      if(sig.dir == SCALP_NONE) return;

      // After 60s: reverse losers that went wrong
      if(HasLoserReady(sig.dir))
        {
         if(ReverseLosers(sig.dir))
           { m_lastEntry = TimeCurrent(); m_today++; return; }
        }

      // INSTANT: market moving with signal — open matching trades immediately
      // e.g. signal SELL + market selling → stack more sells (unlimited)
      // e.g. signal BUY while we have sells in loss (<60s) → still open BUYs
      const int cooldown = sig.strong ? 0 : 1;
      if(!force && m_lastEntry > 0 && (TimeCurrent() - m_lastEntry) < cooldown) return;

      if(OpenTrade(sig.dir, (sig.dir == SCALP_BUY ? "Buy" : "Sell")))
        {
         m_lastEntry = TimeCurrent();
         m_today++;
         Print(m_sym, " ", sig.reason);
        }
     }
  };

//+------------------------------------------------------------------+
//| MAIN — supports multiple symbols independently                    |
//+------------------------------------------------------------------+
input double InpLotSize     = 0.01;                    // Lot per trade
input int    InpMaxPosPerSym = 0;                      // Max per symbol (0=unlimited up to 30)
input string InpExtraSymbols = "";                     // Extra symbols: EURUSD,XAUUSD,GBPUSD

CSymbolRunner g_runners[];
int           g_count = 0;

bool AddRunner(const string sym, const double lot, const int maxPos)
  {
   if(StringLen(sym) < 3) return false;
   for(int i = 0; i < g_count; i++)
      if(g_runners[i].Symbol() == sym) return true;

   ArrayResize(g_runners, g_count + 1);
   if(!g_runners[g_count].Init(sym, lot, maxPos))
     {
      Print("Failed init: ", sym);
      return false;
     }
   g_count++;
   Print("Loaded market: ", sym, " [", BuildProfile(sym).typeName, "] magic=", MagicForSymbol(sym));
   return true;
  }

void ParseSymbols()
  {
   g_count = 0;
   ArrayResize(g_runners, 0);

   AddRunner(_Symbol, InpLotSize, InpMaxPosPerSym);

   if(StringLen(InpExtraSymbols) > 0)
     {
      string parts[];
      const int n = StringSplit(InpExtraSymbols, ',', parts);
      for(int i = 0; i < n; i++)
        {
         StringTrimLeft(parts[i]);
         StringTrimRight(parts[i]);
         if(parts[i] != _Symbol)
            AddRunner(parts[i], InpLotSize, InpMaxPosPerSym);
        }
     }
  }

int OnInit()
  {
   if(InpLotSize <= 0.0) return INIT_PARAMETERS_INCORRECT;
   ParseSymbols();
   if(g_count == 0) return INIT_FAILED;
   EventSetMillisecondTimer(SCALP_SCAN_MS);
   Print("ScalpProfitBot v4 | markets=", g_count, " | unlimited=", (InpMaxPosPerSym <= 0 ? "YES" : "NO"));
   for(int i = 0; i < g_count; i++) g_runners[i].Run(true);
   return INIT_SUCCEEDED;
  }

void OnDeinit(const int reason) { EventKillTimer(); Comment(""); }

void OnTimer()
  {
   string panel = "ScalpProfitBot v4 | Markets: " + IntegerToString(g_count) + "\n";
   for(int i = 0; i < g_count; i++)
     {
      g_runners[i].Run(false);
      const SSignalResult s = g_runners[i].Analyze();
      panel += StringFormat(
         "%s [%s] %s | sc:%d | open:%d (B%d/S%d) | float:$%.2f | wins:%d | lossAge:%ds\n  %s\n",
         g_runners[i].Symbol(), g_runners[i].Profile().typeName,
         (s.dir == SCALP_BUY ? "BUY" : s.dir == SCALP_SELL ? "SELL" : "WAIT"),
         s.score, g_runners[i].TotalPos(), g_runners[i].BuyPos(), g_runners[i].SellPos(),
         g_runners[i].FloatPnl(), g_runners[i].WinsTaken(), g_runners[i].OldestLoserAge(),
         g_runners[i].LastReason());
     }
   Comment(panel);
  }

void OnTick()
  {
   for(int i = 0; i < g_count; i++)
      g_runners[i].Run(false);
  }
//+------------------------------------------------------------------+
