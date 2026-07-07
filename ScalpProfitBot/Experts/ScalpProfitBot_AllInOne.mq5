//+------------------------------------------------------------------+
//|                         ScalpProfitBot_AllInOne.mq5              |
//|                         FINAL v5.0 — ONE FILE ONLY                 |
//+------------------------------------------------------------------+
//| Paste into MetaEditor → Compile F7 → Attach to M1 chart          |
//|                                                                   |
//| FEATURES:                                                         |
//|  • Multi-market (chart symbol + extra symbols, each isolated)    |
//|  • Unlimited trades per market (up to 30 safety cap)             |
//|  • M1+M5+M15 candlestick + RSI/MACD/Stoch/EMA analysis           |
//|  • Instant profit close at $0.01+                                |
//|  • Hold losing trades 60 seconds before reverse                   |
//|  • Stack trades instantly when market confirms signal direction   |
//|  • Auto-adapts FOREX / GOLD / INDEX / CRYPTO                    |
//+------------------------------------------------------------------+
#property copyright   "ScalpProfitBot"
#property version     "5.00"
#property description "ScalpProfitBot v5 — multi-market scalper, one file"

#include <Trade/Trade.mqh>

//===== CORE SETTINGS (built-in, no manual tuning) ==================
#define SPB_MIN_PROFIT_USD      0.01     // close win when profit >= this
#define SPB_LOSS_HOLD_SEC       60       // hold loser before reverse
#define SPB_SCAN_INTERVAL_MS    200      // scan speed (milliseconds)
#define SPB_BASE_MAGIC          880090
#define SPB_MAX_TRADES_PER_SYM  30       // safety cap when unlimited

//===== ENUMS & STRUCTS ===============================================
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

struct SSignalInfo
  {
   ENUM_SPB_SIGNAL dir;
   int    score, buyVotes, sellVotes;
   int    cM1, cM5, cM15, momentum;
   bool   strong;
   string text;
  };

//===== CANDLESTICK ENGINE ============================================
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

//===== MARKET PROFILE ================================================
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

//===== PER-SYMBOL BOT (fully isolated) ===============================
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

   int Momentum() const
     {
      double c0 = iClose(m_sym, PERIOD_M1, 0);
      double c1 = iClose(m_sym, PERIOD_M1, 1);
      double c2 = iClose(m_sym, PERIOD_M1, 2);
      if(c0 > c1 && c1 >= c2) return 1;
      if(c0 < c1 && c1 <= c2) return -1;
      return 0;
     }

   double ATR() const
     { double a[]; return Buf(m_atr, 0, 1, a) ? a[0] : 0; }

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
      m_sym = ""; m_magic = 0; m_lot = 0.01; m_cap = SPB_MAX_TRADES_PER_SYM;
      m_rsi = m_macd = m_stoch = m_atr = m_emaF = m_emaS = INVALID_HANDLE;
      m_lastOpen = 0; m_entries = 0; m_winsClosed = 0;
      m_lastSig.dir = SPB_NONE; m_lastSig.text = "";
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

   string Sym()      const { return m_sym; }
   string Label()    const { return m_prof.label; }
   int    OpenN()    const { return Count(); }
   int    BuyN()     const { return Count(POSITION_TYPE_BUY); }
   int    SellN()    const { return Count(POSITION_TYPE_SELL); }
   int    Wins()     const { return m_winsClosed; }
   int    Entries()  const { return m_entries; }
   SSignalInfo LastSignal() const { return m_lastSig; }

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

   int OldestLossAge() const
     {
      int mx = 0;
      for(int i = 0; i < PositionsTotal(); i++)
        {
         ulong tk = PositionGetTicket(i);
         if(!PositionSelectByTicket(tk)) continue;
         if(PositionGetString(POSITION_SYMBOL) != m_sym) continue;
         if((ulong)PositionGetInteger(POSITION_MAGIC) != m_magic) continue;
         if(PnL(tk) >= 0) continue;
         int a = AgeSec(tk);
         if(a > mx) mx = a;
        }
      return mx;
     }

   //--- Analyze this symbol only (no cross-market confusion)
   SSignalInfo Analyze() const
     {
      SSignalInfo r;
      r.dir = SPB_NONE; r.strong = false; r.text = "Scanning";

      int bv = 0, sv = 0;
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

      int cM1  = SPB_CandleScore(m_sym, PERIOD_M1,  1);
      int cM5  = SPB_CandleScore(m_sym, PERIOD_M5,  1);
      int cM15 = SPB_CandleScore(m_sym, PERIOD_M15, 1);
      int mom  = Momentum();
      int candle = cM1 + (int)MathRound(cM5 * 0.6) + (int)MathRound(cM15 * 0.3);
      int score = (bv - sv) * 10 + candle + mom * 6;

      r.buyVotes = bv; r.sellVotes = sv;
      r.cM1 = cM1; r.cM5 = cM5; r.cM15 = cM15;
      r.momentum = mom; r.score = score;

      bool bullTF  = (cM1 >= 4 && cM5 >= 0 && cM15 >= -5);
      bool bearTF  = (cM1 <= -4 && cM5 <= 0 && cM15 <= 5);
      bool bullInd = (bv >= m_prof.minVotes && bv > sv + 1);
      bool bearInd = (sv >= m_prof.minVotes && sv > bv + 1);
      bool buyOk   = (score >= m_prof.minScore && bullInd && bullTF && candle >= 5);
      bool sellOk  = (score <= -m_prof.minScore && bearInd && bearTF && candle <= -5);
      r.strong = (MathAbs(score) >= m_prof.minScore * 2);

      if(buyOk)
        { r.dir = SPB_BUY;  r.text = StringFormat("BUY sc=%d bv=%d cM1=%d cM5=%d", score, bv, cM1, cM5); }
      else if(sellOk)
        { r.dir = SPB_SELL; r.text = StringFormat("SELL sc=%d sv=%d cM1=%d cM5=%d", score, sv, cM1, cM5); }
      else
        r.text = StringFormat("WAIT sc=%d bv=%d sv=%d cM1=%d", score, bv, sv, cM1);

      return r;
     }

   //--- Profit manager: grab wins instantly, hold losers 60s
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

         // loser < 60s → hold (do nothing)
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
        {
         double ask = SymbolInfoDouble(m_sym, SYMBOL_ASK);
         return m_trade.Buy(lot, m_sym, ask, NormPx(ask - sl), 0, tag);
        }
      if(dir == SPB_SELL)
        {
         double bid = SymbolInfoDouble(m_sym, SYMBOL_BID);
         return m_trade.Sell(lot, m_sym, bid, NormPx(bid + sl), 0, tag);
        }
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
      m_lastSig = Analyze();

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
         Print(m_sym, " ", m_lastSig.text);
        }
     }
  };

//===== MAIN EA =======================================================
input double InpLotSize       = 0.01;              // Lot size per trade
input int    InpMaxPerSymbol  = 0;                 // Max trades/symbol (0=unlimited)
input string InpExtraSymbols  = "";                // More markets: XAUUSD,GBPUSD

CSymbolBot g_bots[];
int        g_nBots = 0;

bool SPB_AddBot(const string sym)
  {
   if(StringLen(sym) < 3) return false;
   for(int i = 0; i < g_nBots; i++)
      if(g_bots[i].Sym() == sym) return true;

   ArrayResize(g_bots, g_nBots + 1);
   if(!g_bots[g_nBots].Setup(sym, InpLotSize, InpMaxPerSymbol))
     { Print("Init failed: ", sym); return false; }

   Print("Market loaded: ", sym, " [", SPB_Profile(sym).label, "] magic=", SPB_Magic(sym));
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
         if(list[i] != _Symbol && StringLen(list[i]) > 2)
            SPB_AddBot(list[i]);
        }
     }
  }

int OnInit()
  {
   if(InpLotSize <= 0) return INIT_PARAMETERS_INCORRECT;
   SPB_LoadMarkets();
   if(g_nBots == 0) return INIT_FAILED;

   EventSetMillisecondTimer(SPB_SCAN_INTERVAL_MS);
   Print("ScalpProfitBot v5 started | markets=", g_nBots,
         " | profit>=$", SPB_MIN_PROFIT_USD,
         " | loss hold=", SPB_LOSS_HOLD_SEC, "s");

   for(int i = 0; i < g_nBots; i++) g_bots[i].Tick(true);
   return INIT_SUCCEEDED;
  }

void OnDeinit(const int reason) { EventKillTimer(); Comment(""); }

void OnTimer()
  {
   string hud = "=== ScalpProfitBot v5 ===\n";
   for(int i = 0; i < g_nBots; i++)
     {
      g_bots[i].Tick(false);
      SSignalInfo s = g_bots[i].LastSignal();
      string sig = (s.dir == SPB_BUY) ? "BUY" : (s.dir == SPB_SELL) ? "SELL" : "WAIT";
      hud += StringFormat(
         "%s [%s] %s sc:%d | open:%d B%d/S%d | float:$%.2f | wins:%d | loss:%ds\n  %s\n",
         g_bots[i].Sym(), g_bots[i].Label(), sig, s.score,
         g_bots[i].OpenN(), g_bots[i].BuyN(), g_bots[i].SellN(),
         g_bots[i].FloatPnL(), g_bots[i].Wins(), g_bots[i].OldestLossAge(),
         s.text);
     }
   Comment(hud);
  }

void OnTick()
  {
   for(int i = 0; i < g_nBots; i++)
      g_bots[i].Tick(false);
  }
//+------------------------------------------------------------------+
