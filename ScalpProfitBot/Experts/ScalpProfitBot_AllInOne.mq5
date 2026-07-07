//+------------------------------------------------------------------+
//|                              ScalpProfitBot_AllInOne.mq5  v3.0   |
//|  Instant micro-profit grab | 60s loss patience | multi-bet scan  |
//+------------------------------------------------------------------+
#property copyright   "ScalpProfitBot"
#property version     "3.00"
#property description "v3: take profit at $0.01+, hold losses 60s, then reverse"

#include <Trade/Trade.mqh>

//--- built-in constants (no manual tuning needed)
#define SCALP_MIN_PROFIT_MONEY    0.01    // close as soon as profit >= this ($)
#define SCALP_LOSS_WAIT_SECONDS   60      // hold losing trade this long before cut/reverse
#define SCALP_ENTRY_COOLDOWN_SEC  1       // seconds between new entries
#define SCALP_SCAN_MS             250     // scan interval (milliseconds)

//+------------------------------------------------------------------+
struct SCandleMetrics
  {
   double open, high, low, close, body, upperWick, lowerWick, range;
   bool   bullish, bearish;
  };

bool ScalpGetCandle(const string symbol, const ENUM_TIMEFRAMES tf, const int shift, SCandleMetrics &m)
  {
   m.open  = iOpen(symbol, tf, shift);
   m.high  = iHigh(symbol, tf, shift);
   m.low   = iLow(symbol, tf, shift);
   m.close = iClose(symbol, tf, shift);
   if(m.open == 0.0 && m.high == 0.0 && m.low == 0.0 && m.close == 0.0) return false;
   m.body      = MathAbs(m.close - m.open);
   m.range     = m.high - m.low;
   m.upperWick = m.high - MathMax(m.open, m.close);
   m.lowerWick = MathMin(m.open, m.close) - m.low;
   m.bullish   = (m.close > m.open);
   m.bearish   = (m.close < m.open);
   return (m.range > 0.0);
  }

double ScalpBodyRatio(const SCandleMetrics &m) { return (m.range <= 0.0) ? 0.0 : m.body / m.range; }

bool ScalpIsBullishEngulfing(const string s, const ENUM_TIMEFRAMES tf, const int sh)
  {
   SCandleMetrics c1, c0;
   if(!ScalpGetCandle(s, tf, sh + 1, c1) || !ScalpGetCandle(s, tf, sh, c0)) return false;
   return (c1.bearish && c0.bullish && c0.open <= c1.close && c0.close >= c1.open && c0.body > c1.body * 0.8);
  }

bool ScalpIsBearishEngulfing(const string s, const ENUM_TIMEFRAMES tf, const int sh)
  {
   SCandleMetrics c1, c0;
   if(!ScalpGetCandle(s, tf, sh + 1, c1) || !ScalpGetCandle(s, tf, sh, c0)) return false;
   return (c1.bullish && c0.bearish && c0.open >= c1.close && c0.close <= c1.open && c0.body > c1.body * 0.8);
  }

bool ScalpIsHammer(const SCandleMetrics &m)
  {
   if(m.range <= 0.0) return false;
   return (ScalpBodyRatio(m) <= 0.35 && m.lowerWick / m.range >= 0.55 && m.upperWick / m.range <= 0.20);
  }

bool ScalpIsShootingStar(const SCandleMetrics &m)
  {
   if(m.range <= 0.0) return false;
   return (ScalpBodyRatio(m) <= 0.35 && m.upperWick / m.range >= 0.55 && m.lowerWick / m.range <= 0.20);
  }

int ScalpCandleScore(const string s, const ENUM_TIMEFRAMES tf, const int sh)
  {
   SCandleMetrics c0;
   if(!ScalpGetCandle(s, tf, sh, c0)) return 0;
   int score = 0;
   if(ScalpIsBullishEngulfing(s, tf, sh)) score += 20;
   if(ScalpIsBearishEngulfing(s, tf, sh)) score -= 20;
   if(ScalpIsHammer(c0)) score += 14;
   if(ScalpIsShootingStar(c0)) score -= 14;
   if(c0.bullish && ScalpBodyRatio(c0) > 0.60) score += 8;
   if(c0.bearish && ScalpBodyRatio(c0) > 0.60) score -= 8;
   SCandleMetrics c1;
   if(ScalpGetCandle(s, tf, sh + 1, c1))
     {
      if(c1.bearish && c0.bullish && c0.close > c1.high) score += 10;
      if(c1.bullish && c0.bearish && c0.close < c1.low) score -= 10;
     }
   return score;
  }

//+------------------------------------------------------------------+
struct SMarketProfile
  {
   double wideSlAtr;
   int    minScore;
   int    minVotes;
   string typeName;
  };

SMarketProfile BuildMarketProfile(const string symbol)
  {
   SMarketProfile p;
   p.wideSlAtr = 2.50;
   p.minScore  = 22;
   p.minVotes  = 3;
   p.typeName  = "FOREX";

   if(StringFind(symbol, "XAU") >= 0 || StringFind(symbol, "GOLD") >= 0)
     { p.wideSlAtr = 2.20; p.minScore = 20; p.minVotes = 3; p.typeName = "GOLD"; }
   else if(StringFind(symbol, "BTC") >= 0 || StringFind(symbol, "ETH") >= 0)
     { p.wideSlAtr = 2.80; p.minScore = 21; p.typeName = "CRYPTO"; }
   else if(StringFind(symbol, "US30") >= 0 || StringFind(symbol, "US100") >= 0 ||
           StringFind(symbol, "UT100") >= 0 || StringFind(symbol, "NAS") >= 0)
     { p.wideSlAtr = 2.00; p.minScore = 20; p.minVotes = 3; p.typeName = "INDEX"; }
   return p;
  }

//+------------------------------------------------------------------+
enum ENUM_SCALP_SIGNAL { SCALP_NONE = 0, SCALP_BUY = 1, SCALP_SELL = -1 };

struct SSignalResult
  {
   ENUM_SCALP_SIGNAL dir;
   int    score, votes, candleScore, momentum;
   string reason;
  };

class CSignalEngine
  {
private:
   string          m_sym;
   ENUM_TIMEFRAMES m_tf1, m_tf2, m_tf3;
   int             m_rsi, m_macd, m_stoch, m_atr, m_emaF, m_emaS;
   SMarketProfile  m_prof;
   double          m_lastBid;
   datetime        m_lastTickTime;
   int             m_tickDir;

   bool GetBuf(const int h, const int buf, const int cnt, double &arr[]) const
     { ArraySetAsSeries(arr, true); return (CopyBuffer(h, buf, 0, cnt, arr) >= cnt); }

   int EmaVoteTF(const ENUM_TIMEFRAMES tf) const
     {
      const int fh = iMA(m_sym, tf, 8, 0, MODE_EMA, PRICE_CLOSE);
      const int sh = iMA(m_sym, tf, 21, 0, MODE_EMA, PRICE_CLOSE);
      if(fh == INVALID_HANDLE || sh == INVALID_HANDLE)
        { if(fh != INVALID_HANDLE) IndicatorRelease(fh); if(sh != INVALID_HANDLE) IndicatorRelease(sh); return 0; }
      double f[], s[];
      ArraySetAsSeries(f, true); ArraySetAsSeries(s, true);
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
      double r[];
      if(!GetBuf(m_rsi, 0, 3, r)) return 0;
      if(r[1] < 35.0 && r[0] > r[1]) return 1;
      if(r[1] > 65.0 && r[0] < r[1]) return -1;
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
      if(k[1] < 25.0 && k[0] > d[0] && k[0] > k[1]) return 1;
      if(k[1] > 75.0 && k[0] < d[0] && k[0] < k[1]) return -1;
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

   int TickMomentum()
     {
      const double bid = SymbolInfoDouble(m_sym, SYMBOL_BID);
      const datetime now = TimeCurrent();
      if(m_lastBid > 0.0 && now == m_lastTickTime)
        { if(bid > m_lastBid) m_tickDir++; else if(bid < m_lastBid) m_tickDir--; }
      else m_tickDir = 0;
      m_lastBid = bid; m_lastTickTime = now;
      if(m_tickDir > 2) return 1;
      if(m_tickDir < -2) return -1;
      return 0;
     }

public:
   CSignalEngine() : m_rsi(INVALID_HANDLE), m_macd(INVALID_HANDLE), m_stoch(INVALID_HANDLE),
                     m_atr(INVALID_HANDLE), m_emaF(INVALID_HANDLE), m_emaS(INVALID_HANDLE),
                     m_lastBid(0), m_lastTickTime(0), m_tickDir(0)
     { m_sym = _Symbol; m_tf1 = PERIOD_M1; m_tf2 = PERIOD_M5; m_tf3 = PERIOD_M15; m_prof = BuildMarketProfile(m_sym); }

   ~CSignalEngine()
     {
      if(m_rsi != INVALID_HANDLE) IndicatorRelease(m_rsi);
      if(m_macd != INVALID_HANDLE) IndicatorRelease(m_macd);
      if(m_stoch != INVALID_HANDLE) IndicatorRelease(m_stoch);
      if(m_atr != INVALID_HANDLE) IndicatorRelease(m_atr);
      if(m_emaF != INVALID_HANDLE) IndicatorRelease(m_emaF);
      if(m_emaS != INVALID_HANDLE) IndicatorRelease(m_emaS);
     }

   bool Init()
     {
      m_prof = BuildMarketProfile(m_sym);
      m_rsi  = iRSI(m_sym, m_tf1, 14, PRICE_CLOSE);
      m_macd = iMACD(m_sym, m_tf1, 12, 26, 9, PRICE_CLOSE);
      m_stoch = iStochastic(m_sym, m_tf1, 5, 3, 3, MODE_SMA, STO_LOWHIGH);
      m_atr  = iATR(m_sym, m_tf1, 14);
      m_emaF = iMA(m_sym, m_tf1, 8, 0, MODE_EMA, PRICE_CLOSE);
      m_emaS = iMA(m_sym, m_tf1, 21, 0, MODE_EMA, PRICE_CLOSE);
      return (m_rsi != INVALID_HANDLE && m_macd != INVALID_HANDLE && m_stoch != INVALID_HANDLE &&
              m_atr != INVALID_HANDLE && m_emaF != INVALID_HANDLE && m_emaS != INVALID_HANDLE);
     }

   SMarketProfile Profile() const { return m_prof; }

   double AtrPoints() const
     {
      double a[]; ArraySetAsSeries(a, true);
      if(m_atr == INVALID_HANDLE || CopyBuffer(m_atr, 0, 0, 1, a) < 1) return 0.0;
      const double pt = SymbolInfoDouble(m_sym, SYMBOL_POINT);
      return (pt > 0.0) ? a[0] / pt : 0.0;
     }

   double AtrValue() const
     {
      double a[]; ArraySetAsSeries(a, true);
      if(m_atr == INVALID_HANDLE || CopyBuffer(m_atr, 0, 0, 1, a) < 1) return 0.0;
      return a[0];
     }

   bool CanTrade() const
     { return (SymbolInfoInteger(m_sym, SYMBOL_TRADE_MODE) != SYMBOL_TRADE_MODE_DISABLED); }

   SSignalResult Analyze()
     {
      SSignalResult r;
      r.dir = SCALP_NONE; r.score = 0; r.votes = 0; r.candleScore = 0; r.momentum = 0;
      r.reason = "Scanning...";

      int vote = EmaExecVote() + EmaVoteTF(m_tf1) + EmaVoteTF(m_tf2) + EmaVoteTF(m_tf3)
               + RsiVote() + MacdVote() + StochVote();
      const int mom = TickMomentum();
      vote += mom;

      const int c1 = ScalpCandleScore(m_sym, m_tf1, 1);
      const int c2 = ScalpCandleScore(m_sym, m_tf2, 1);
      const int candle = c1 + (int)MathRound(c2 * 0.5);
      const int score = vote * 10 + candle + mom * 5;

      r.votes = vote; r.candleScore = candle; r.momentum = mom; r.score = score;

      const int buyVotes  = (vote > 0) ? vote : 0;
      const int sellVotes = (vote < 0) ? -vote : 0;
      const bool m1m5Buy  = (c1 >= 5 && c2 >= 0);
      const bool m1m5Sell = (c1 <= -5 && c2 <= 0);

      const bool buyOk  = (score >= m_prof.minScore && buyVotes >= m_prof.minVotes && candle >= 5 && m1m5Buy);
      const bool sellOk = (score <= -m_prof.minScore && sellVotes >= m_prof.minVotes && candle <= -5 && m1m5Sell);

      if(buyOk && score > 0)
        { r.dir = SCALP_BUY; r.reason = StringFormat("BUY score=%d votes=%d candle=%d", score, vote, candle); }
      else if(sellOk && score < 0)
        { r.dir = SCALP_SELL; r.reason = StringFormat("SELL score=%d votes=%d candle=%d", score, vote, candle); }
      else
        r.reason = StringFormat("Wait score=%d votes=%d candle=%d", score, vote, candle);
      return r;
     }
  };

//+------------------------------------------------------------------+
class CTradeManager
  {
private:
   CTrade          m_trade;
   string          m_sym;
   ulong           m_magic;
   double          m_lot;
   int             m_digits;
   SMarketProfile  m_prof;
   int             m_atrHandle;

   double NormPx(const double px) const { return NormalizeDouble(px, m_digits); }

   double NormLot(const double lot) const
     {
      double minL = SymbolInfoDouble(m_sym, SYMBOL_VOLUME_MIN);
      double maxL = SymbolInfoDouble(m_sym, SYMBOL_VOLUME_MAX);
      double step = SymbolInfoDouble(m_sym, SYMBOL_VOLUME_STEP);
      if(step <= 0) step = 0.01;
      return NormalizeDouble(MathMax(minL, MathMin(maxL, MathFloor(lot / step) * step)), 2);
     }

   double Atr() const
     {
      double a[]; ArraySetAsSeries(a, true);
      if(m_atrHandle == INVALID_HANDLE || CopyBuffer(m_atrHandle, 0, 0, 1, a) < 1) return 0.0;
      return a[0];
     }

   double PosProfitMoney(const ulong ticket) const
     {
      if(!PositionSelectByTicket(ticket)) return 0.0;
      return PositionGetDouble(POSITION_PROFIT) + PositionGetDouble(POSITION_SWAP) + PositionGetDouble(POSITION_COMMISSION);
     }

   int PosAgeSeconds(const ulong ticket) const
     {
      if(!PositionSelectByTicket(ticket)) return 0;
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

public:
   CTradeManager() : m_magic(880073), m_lot(0.01), m_atrHandle(INVALID_HANDLE)
     { m_sym = _Symbol; m_digits = _Digits; m_prof = BuildMarketProfile(m_sym); }

   ~CTradeManager() { if(m_atrHandle != INVALID_HANDLE) IndicatorRelease(m_atrHandle); }

   void Setup(const string sym, const double lot, const SMarketProfile &prof)
     {
      m_sym = sym; m_lot = lot; m_prof = prof;
      m_digits = (int)SymbolInfoInteger(sym, SYMBOL_DIGITS);
      m_trade.SetExpertMagicNumber((long)m_magic);
      m_trade.SetDeviationInPoints(30);
      m_trade.SetTypeFillingBySymbol(m_sym);
      if(m_atrHandle != INVALID_HANDLE) IndicatorRelease(m_atrHandle);
      m_atrHandle = iATR(m_sym, PERIOD_M1, 14);
     }

   int Total() const { return CountPos(); }
   int Buys()  const { return CountPos(POSITION_TYPE_BUY); }
   int Sells() const { return CountPos(POSITION_TYPE_SELL); }

   bool CloseTicket(const ulong ticket, const string why)
     {
      if(m_trade.PositionClose(ticket))
        { Print("Closed #", ticket, " | ", why); return true; }
      return false;
     }

   void CloseType(const ENUM_POSITION_TYPE t)
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

   // CORE v3: instant profit grab + 60s loss patience
   int ManageProfitsAndLosses()
     {
      int closedWins = 0;
      for(int i = PositionsTotal() - 1; i >= 0; i--)
        {
         const ulong tk = PositionGetTicket(i);
         if(!PositionSelectByTicket(tk)) continue;
         if(PositionGetString(POSITION_SYMBOL) != m_sym) continue;
         if((ulong)PositionGetInteger(POSITION_MAGIC) != m_magic) continue;

         const double pnl = PosProfitMoney(tk);
         const int age    = PosAgeSeconds(tk);

         // PRIORITY 1: any profit >= $0.01 -> take immediately
         if(pnl >= SCALP_MIN_PROFIT_MONEY)
           {
            if(CloseTicket(tk, StringFormat("Instant profit $%.2f", pnl)))
               closedWins++;
            continue;
           }

         // PRIORITY 2: tiny green (0 < pnl < 0.01) after 5s -> take it (don't let it flip red)
         if(pnl > 0.0 && age >= 5)
           {
            if(CloseTicket(tk, StringFormat("Micro profit $%.4f", pnl)))
               closedWins++;
            continue;
           }

         // PRIORITY 3: losing trade younger than 60s -> HOLD (wait for recovery)
         if(pnl < 0.0 && age < SCALP_LOSS_WAIT_SECONDS)
            continue;

         // PRIORITY 4: losing 60s+ -> eligible for reversal (handled in RunBot)
        }
      return closedWins;
     }

   bool HasLoserReadyForExit(const ENUM_SCALP_SIGNAL wantDir) const
     {
      for(int i = 0; i < PositionsTotal(); i++)
        {
         const ulong tk = PositionGetTicket(i);
         if(!PositionSelectByTicket(tk)) continue;
         if(PositionGetString(POSITION_SYMBOL) != m_sym) continue;
         if((ulong)PositionGetInteger(POSITION_MAGIC) != m_magic) continue;

         const double pnl = PosProfitMoney(tk);
         const int age    = PosAgeSeconds(tk);
         if(pnl >= 0.0) continue;
         if(age < SCALP_LOSS_WAIT_SECONDS) continue;

         const long type = PositionGetInteger(POSITION_TYPE);
         if(wantDir == SCALP_BUY  && type == POSITION_TYPE_SELL) return true;
         if(wantDir == SCALP_SELL && type == POSITION_TYPE_BUY)  return true;
        }
      return false;
     }

   bool Open(const ENUM_SCALP_SIGNAL dir, const string tag)
     {
      const double atr = Atr();
      if(atr <= 0.0) return false;

      // Wide emergency SL only — real exits managed by profit/loss logic above
      const double slDist = atr * m_prof.wideSlAtr;

      if(dir == SCALP_BUY)
        {
         const double ask = SymbolInfoDouble(m_sym, SYMBOL_ASK);
         return m_trade.Buy(NormLot(m_lot), m_sym, ask, NormPx(ask - slDist), 0.0, tag);
        }
      if(dir == SCALP_SELL)
        {
         const double bid = SymbolInfoDouble(m_sym, SYMBOL_BID);
         return m_trade.Sell(NormLot(m_lot), m_sym, bid, NormPx(bid + slDist), 0.0, tag);
        }
      return false;
     }

   bool ReverseLoser(const ENUM_SCALP_SIGNAL dir, const string tag)
     {
      if(!HasLoserReadyForExit(dir)) return false;
      if(dir == SCALP_BUY)  { CloseType(POSITION_TYPE_SELL); return Open(SCALP_BUY, tag); }
      if(dir == SCALP_SELL) { CloseType(POSITION_TYPE_BUY);  return Open(SCALP_SELL, tag); }
      return false;
     }

   double TotalFloatingPnL() const
     {
      double sum = 0.0;
      for(int i = 0; i < PositionsTotal(); i++)
        {
         const ulong tk = PositionGetTicket(i);
         if(!PositionSelectByTicket(tk)) continue;
         if(PositionGetString(POSITION_SYMBOL) != m_sym) continue;
         if((ulong)PositionGetInteger(POSITION_MAGIC) != m_magic) continue;
         sum += PosProfitMoney(tk);
        }
      return sum;
     }

   int OldestLoserAge() const
     {
      int maxAge = 0;
      for(int i = 0; i < PositionsTotal(); i++)
        {
         const ulong tk = PositionGetTicket(i);
         if(!PositionSelectByTicket(tk)) continue;
         if(PositionGetString(POSITION_SYMBOL) != m_sym) continue;
         if((ulong)PositionGetInteger(POSITION_MAGIC) != m_magic) continue;
         const double pnl = PosProfitMoney(tk);
         if(pnl >= 0.0) continue;
         const int age = PosAgeSeconds(tk);
         if(age > maxAge) maxAge = age;
        }
      return maxAge;
     }
  };

//+------------------------------------------------------------------+
input double InpLotSize = 0.01;
input int    InpMaxPos  = 5;

CSignalEngine g_sig;
CTradeManager g_trd;
datetime      g_lastEntry = 0;
int           g_today = 0;
int           g_winsTaken = 0;

int OnInit()
  {
   if(InpLotSize <= 0.0) return INIT_PARAMETERS_INCORRECT;
   if(!g_sig.Init()) return INIT_FAILED;
   g_trd.Setup(_Symbol, InpLotSize, g_sig.Profile());
   g_lastEntry = 0; g_today = 0; g_winsTaken = 0;
   EventSetMillisecondTimer(SCALP_SCAN_MS);
   Print("ScalpProfitBot v3 | ", _Symbol, " | profit>=$", SCALP_MIN_PROFIT_MONEY,
         " instant | loss wait ", SCALP_LOSS_WAIT_SECONDS, "s");
   RunBot(true);
   return INIT_SUCCEEDED;
  }

void OnDeinit(const int reason) { EventKillTimer(); Comment(""); }
void OnTimer() { RunBot(false); }
void OnTick()  { RunBot(false); }

void RunBot(const bool force)
  {
   if(!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED)) return;
   if(!MQLInfoInteger(MQL_TRADE_ALLOWED)) return;
   if(!g_sig.CanTrade()) return;

   // Step 1: scan every tick — grab profits instantly, hold young losers
   const int winsClosed = g_trd.ManageProfitsAndLosses();
   g_winsTaken += winsClosed;

   const SSignalResult sig = g_sig.Analyze();
   const SMarketProfile prof = g_sig.Profile();

   Comment(StringFormat(
      "ScalpProfitBot v3 | %s [%s]\n"
      "Signal: %s | Score: %d | Votes: %d | Candle: %d\n"
      "Open: %d (B:%d S:%d) | Float: $%.2f | Wins grabbed: %d | Today entries: %d\n"
      "Loss wait: %ds (oldest loser: %ds) | ATR: %.1f | Spread: %d\n%s",
      _Symbol, prof.typeName,
      (sig.dir == SCALP_BUY ? "BUY" : sig.dir == SCALP_SELL ? "SELL" : "NONE"),
      sig.score, sig.votes, sig.candleScore,
      g_trd.Total(), g_trd.Buys(), g_trd.Sells(),
      g_trd.TotalFloatingPnL(), g_winsTaken, g_today,
      SCALP_LOSS_WAIT_SECONDS, g_trd.OldestLoserAge(),
      g_sig.AtrPoints(), (int)SymbolInfoInteger(_Symbol, SYMBOL_SPREAD),
      sig.reason));

   if(sig.dir == SCALP_NONE) return;

   // Step 2: after 60s, reverse confirmed losers only
   if(g_trd.HasLoserReadyForExit(sig.dir))
     {
      if(g_trd.ReverseLoser(sig.dir, "Rev60s"))
        { g_lastEntry = TimeCurrent(); g_today++; return; }
     }

   // Step 3: place more bets in signal direction (losers under 60s are left alone)
   if(g_trd.Total() >= InpMaxPos) return;
   if(!force && g_lastEntry > 0 && (TimeCurrent() - g_lastEntry) < SCALP_ENTRY_COOLDOWN_SEC) return;

   if(g_trd.Open(sig.dir, (sig.dir == SCALP_BUY ? "Buy" : "Sell")))
     {
      g_lastEntry = TimeCurrent();
      g_today++;
      Print(sig.reason);
     }
  }
//+------------------------------------------------------------------+
