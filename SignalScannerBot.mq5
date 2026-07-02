//+------------------------------------------------------------------+
//|                                             SignalScannerBot.mq5  |
//|   Observes the current symbol for a fixed time, analyzes many     |
//|   technical signals with self-calibrating (adaptive) weights,     |
//|   then prints a BUY / SELL / NEUTRAL suggestion + confidence %.    |
//|                                                                    |
//|   SUGGESTION ONLY - this bot does NOT place any trades.            |
//|   A confidence % is the model's conviction (how strongly the       |
//|   signals agree), NOT a guaranteed probability of profit. No tool  |
//|   can reliably predict markets. Not financial advice.             |
//+------------------------------------------------------------------+
#property strict
#property version   "1.00"
#property description "Watches a symbol for N seconds, analyzes multi-signal + adaptive weights, outputs a BUY/SELL suggestion with a confidence %. Suggestion only - never trades."

// -------------------- Inputs --------------------
input group "Observation"
input int    ObservationSeconds = 60;   // how long to 'watch' the market before deciding
input bool   ShowCountdown      = true;  // live countdown while analyzing

input group "Indicators"
input int    FastEMA        = 8;
input int    SlowEMA        = 21;
input int    RSIPeriod      = 14;
input int    MACDFast       = 12;
input int    MACDSlow       = 26;
input int    MACDSignalP    = 9;
input int    StochK         = 14;
input int    StochD         = 3;
input int    StochSlow      = 3;
input int    BBPeriod       = 20;
input double BBDeviation    = 2.0;
input int    ATRPeriod      = 14;
input int    MomentumBars   = 10;                 // rate-of-change lookback (bars)
input ENUM_TIMEFRAMES HigherTF = PERIOD_H1;       // higher-timeframe trend context
input int    HigherTFEMA    = 50;

input group "Adaptive Learning"
input bool   UseAdaptiveWeights = true;  // weight each signal by its recent hit-rate (per symbol/TF)
input int    LearningBars       = 600;   // history bars used to calibrate each signal's edge

input group "Output"
input bool   ShowPanel        = true;
input bool   AlertOnResult    = true;
input double MaxConfidencePct  = 95.0;    // hard cap on displayed confidence (honesty guard)
input double NeutralBandPct    = 55.0;    // below this dominance -> NEUTRAL / low conviction

// -------------------- Signal registry --------------------
#define SIG_COUNT 9
// 0 EMA state, 1 EMA slope, 2 RSI, 3 MACD, 4 Stochastic,
// 5 Bollinger, 6 Momentum(ROC), 7 Higher-TF trend, 8 Live tick drift
string  gSigName[SIG_COUNT];
double  gSigWeight[SIG_COUNT];   // adaptive weight (edge), 0..1
double  gSigHitRate[SIG_COUNT];  // measured hit-rate, 0..1
int     gSigDir[SIG_COUNT];      // live direction: -1 sell, 0 flat, +1 buy
double  gSigStr[SIG_COUNT];      // live strength 0..1

// -------------------- Indicator handles --------------------
int hEmaF=INVALID_HANDLE, hEmaS=INVALID_HANDLE, hRsi=INVALID_HANDLE;
int hMacd=INVALID_HANDLE, hStoch=INVALID_HANDLE, hBands=INVALID_HANDLE;
int hAtr=INVALID_HANDLE, hHtfEma=INVALID_HANDLE;

// -------------------- Data buffers (series indexed) --------------------
double emaF[], emaS[], rsi[], macdMain[], macdSig[], stochMain[], stochSig[];
double bbUp[], bbMid[], bbLow[], atr[], cl[], hi[], lo[];

// -------------------- Observation state --------------------
datetime gStart      = 0;
bool     gDone       = false;
double   gFirstBid   = 0.0;
double   gLastBid    = 0.0;
int      gUpTicks    = 0;
int      gDownTicks  = 0;
int      gTicks      = 0;
double   gPrevBid    = 0.0;

string   PANEL = "SSB_"; // chart-object prefix

//+------------------------------------------------------------------+
double Clamp(double v, double lo_, double hi_){ return (v<lo_?lo_:(v>hi_?hi_:v)); }
int    Sgn(double v){ return (v>0?1:(v<0?-1:0)); }

//+------------------------------------------------------------------+
int OnInit()
{
   gSigName[0]="EMA state";      gSigName[1]="EMA slope";
   gSigName[2]="RSI";            gSigName[3]="MACD";
   gSigName[4]="Stochastic";     gSigName[5]="Bollinger";
   gSigName[6]="Momentum(ROC)";  gSigName[7]="HTF trend";
   gSigName[8]="Live tick drift";

   hEmaF  = iMA(_Symbol, PERIOD_CURRENT, FastEMA, 0, MODE_EMA, PRICE_CLOSE);
   hEmaS  = iMA(_Symbol, PERIOD_CURRENT, SlowEMA, 0, MODE_EMA, PRICE_CLOSE);
   hRsi   = iRSI(_Symbol, PERIOD_CURRENT, RSIPeriod, PRICE_CLOSE);
   hMacd  = iMACD(_Symbol, PERIOD_CURRENT, MACDFast, MACDSlow, MACDSignalP, PRICE_CLOSE);
   hStoch = iStochastic(_Symbol, PERIOD_CURRENT, StochK, StochD, StochSlow, MODE_SMA, STO_LOWHIGH);
   hBands = iBands(_Symbol, PERIOD_CURRENT, BBPeriod, 0, BBDeviation, PRICE_CLOSE);
   hAtr   = iATR(_Symbol, PERIOD_CURRENT, ATRPeriod);
   hHtfEma= iMA(_Symbol, HigherTF, HigherTFEMA, 0, MODE_EMA, PRICE_CLOSE);

   if(hEmaF==INVALID_HANDLE || hEmaS==INVALID_HANDLE || hRsi==INVALID_HANDLE ||
      hMacd==INVALID_HANDLE || hStoch==INVALID_HANDLE || hBands==INVALID_HANDLE ||
      hAtr==INVALID_HANDLE  || hHtfEma==INVALID_HANDLE)
   {
      Print("SignalScannerBot: failed to create indicator handles.");
      return INIT_FAILED;
   }

   ArraySetAsSeries(emaF,true);      ArraySetAsSeries(emaS,true);
   ArraySetAsSeries(rsi,true);       ArraySetAsSeries(macdMain,true);
   ArraySetAsSeries(macdSig,true);   ArraySetAsSeries(stochMain,true);
   ArraySetAsSeries(stochSig,true);  ArraySetAsSeries(bbUp,true);
   ArraySetAsSeries(bbMid,true);     ArraySetAsSeries(bbLow,true);
   ArraySetAsSeries(atr,true);       ArraySetAsSeries(cl,true);
   ArraySetAsSeries(hi,true);        ArraySetAsSeries(lo,true);

   gStart     = TimeCurrent();
   gDone      = false;
   gFirstBid  = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   gLastBid   = gFirstBid;
   gPrevBid   = gFirstBid;
   gUpTicks   = 0; gDownTicks = 0; gTicks = 0;

   EventSetTimer(1);
   UpdateCountdown((int)ObservationSeconds);
   PrintFormat("SignalScannerBot started on %s %s - observing for %d seconds...",
               _Symbol, EnumToString((ENUM_TIMEFRAMES)_Period), ObservationSeconds);
   return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
   if(hEmaF!=INVALID_HANDLE)  IndicatorRelease(hEmaF);
   if(hEmaS!=INVALID_HANDLE)  IndicatorRelease(hEmaS);
   if(hRsi!=INVALID_HANDLE)   IndicatorRelease(hRsi);
   if(hMacd!=INVALID_HANDLE)  IndicatorRelease(hMacd);
   if(hStoch!=INVALID_HANDLE) IndicatorRelease(hStoch);
   if(hBands!=INVALID_HANDLE) IndicatorRelease(hBands);
   if(hAtr!=INVALID_HANDLE)   IndicatorRelease(hAtr);
   if(hHtfEma!=INVALID_HANDLE) IndicatorRelease(hHtfEma);
   ObjectsDeleteAll(0, PANEL);
   Comment("");
}

//+------------------------------------------------------------------+
//| Collect live tick statistics during the observation window       |
//+------------------------------------------------------------------+
void OnTick()
{
   if(gDone) return;
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   if(bid<=0.0) return;
   gTicks++;
   if(bid>gPrevBid) gUpTicks++;
   else if(bid<gPrevBid) gDownTicks++;
   gPrevBid = bid;
   gLastBid = bid;
}

//+------------------------------------------------------------------+
void OnTimer()
{
   if(gDone) return;
   int elapsed = (int)(TimeCurrent()-gStart);
   int remain  = (int)ObservationSeconds - elapsed;
   if(remain>0)
   {
      if(ShowCountdown) UpdateCountdown(remain);
      return;
   }
   gDone = true;
   Finalize();
}

//+------------------------------------------------------------------+
//| Load indicator / price data into series buffers                  |
//+------------------------------------------------------------------+
bool LoadData(int need)
{
   if(CopyBuffer(hEmaF,0,0,need,emaF)      < need) return false;
   if(CopyBuffer(hEmaS,0,0,need,emaS)      < need) return false;
   if(CopyBuffer(hRsi,0,0,need,rsi)        < need) return false;
   if(CopyBuffer(hMacd,0,0,need,macdMain)  < need) return false;
   if(CopyBuffer(hMacd,1,0,need,macdSig)   < need) return false;
   if(CopyBuffer(hStoch,0,0,need,stochMain)< need) return false;
   if(CopyBuffer(hStoch,1,0,need,stochSig) < need) return false;
   if(CopyBuffer(hBands,0,0,need,bbMid)    < need) return false;
   if(CopyBuffer(hBands,1,0,need,bbUp)     < need) return false;
   if(CopyBuffer(hBands,2,0,need,bbLow)    < need) return false;
   if(CopyBuffer(hAtr,0,0,need,atr)        < need) return false;
   if(CopyClose(_Symbol,PERIOD_CURRENT,0,need,cl) < need) return false;
   if(CopyHigh(_Symbol,PERIOD_CURRENT,0,need,hi)  < need) return false;
   if(CopyLow(_Symbol,PERIOD_CURRENT,0,need,lo)   < need) return false;
   return true;
}

//+------------------------------------------------------------------+
//| Per-signal direction & strength at bar 'shift' (>=1 = closed).   |
//| dir in {-1,0,+1}; str in [0,1]. Uses global series buffers.      |
//+------------------------------------------------------------------+
void SignalAt(int which, int s, int &dir, double &str)
{
   dir = 0; str = 0.0;
   double a = (s<ArraySize(atr) && atr[s]>0.0) ? atr[s] : _Point;
   if(a<=0.0) a=_Point;

   switch(which)
   {
      case 0: // EMA state (fast vs slow)
      {
         double d = emaF[s]-emaS[s];
         dir = Sgn(d);
         str = Clamp(MathAbs(d)/a, 0.0, 1.0);
         break;
      }
      case 1: // EMA slope (fast EMA rising/falling)
      {
         double d = emaF[s]-emaF[s+1];
         dir = Sgn(d);
         str = Clamp(MathAbs(d)/(a*0.5), 0.0, 1.0);
         break;
      }
      case 2: // RSI vs 50
      {
         double d = rsi[s]-50.0;
         dir = Sgn(d);
         str = Clamp(MathAbs(d)/25.0, 0.0, 1.0);
         break;
      }
      case 3: // MACD main vs signal
      {
         double d = macdMain[s]-macdSig[s];
         dir = Sgn(d);
         str = Clamp(MathAbs(d)/a, 0.0, 1.0);
         break;
      }
      case 4: // Stochastic main vs signal (+ zone confirmation)
      {
         double d = stochMain[s]-stochSig[s];
         dir = Sgn(d);
         double zone = 0.0;
         if(stochMain[s]<20.0) zone = 1.0;   // oversold -> favors up
         else if(stochMain[s]>80.0) zone = 1.0;
         str = Clamp(MathAbs(d)/15.0 + zone*0.25, 0.0, 1.0);
         break;
      }
      case 5: // Bollinger position relative to middle band
      {
         double band = bbUp[s]-bbMid[s];
         if(band<=0.0){ dir=0; str=0; break; }
         double pos = (cl[s]-bbMid[s])/band; // ~ -1..+1 inside bands
         dir = Sgn(pos);
         str = Clamp(MathAbs(pos), 0.0, 1.0);
         break;
      }
      case 6: // Momentum / rate of change
      {
         int p = s+MomentumBars;
         if(p>=ArraySize(cl) || cl[p]<=0.0){ dir=0; str=0; break; }
         double roc = (cl[s]-cl[p])/cl[p];
         dir = Sgn(roc);
         str = Clamp(MathAbs(roc)*200.0, 0.0, 1.0);
         break;
      }
      default: dir=0; str=0;
   }
}

//+------------------------------------------------------------------+
//| Measure a signal's recent hit-rate on this symbol/TF (learning)  |
//+------------------------------------------------------------------+
double MeasureHitRate(int which, int bars)
{
   int hits=0, total=0, dir; double str;
   int maxS = MathMin(bars, ArraySize(cl)-MomentumBars-2);
   for(int s=2; s<=maxS; s++)
   {
      SignalAt(which, s, dir, str);
      if(dir==0) continue;
      int actual = Sgn(cl[s-1]-cl[s]); // next-bar move after bar s
      if(actual==0) continue;
      total++;
      if(dir==actual) hits++;
   }
   if(total<20) return 0.5; // not enough evidence -> no edge
   return (double)hits/(double)total;
}

//+------------------------------------------------------------------+
//| Higher-timeframe trend direction (live)                          |
//+------------------------------------------------------------------+
void HtfTrend(int &dir, double &str)
{
   dir=0; str=0.0;
   double he[]; ArraySetAsSeries(he,true);
   if(CopyBuffer(hHtfEma,0,0,3,he)<3) return;
   double c1 = iClose(_Symbol, HigherTF, 1);
   if(c1<=0.0) return;
   double d = c1-he[1];
   dir = Sgn(d);
   double ref = he[1]>0.0 ? he[1] : c1;
   str = Clamp(MathAbs(d)/(ref*0.003), 0.0, 1.0); // ~0.3% band -> full strength
}

//+------------------------------------------------------------------+
//| Live tick-drift signal from the observation window               |
//+------------------------------------------------------------------+
void TickDrift(int &dir, double &str)
{
   dir=0; str=0.0;
   if(gTicks<3){ return; } // market quiet / closed -> no live signal
   double move = gLastBid-gFirstBid;
   dir = Sgn(move);
   int netImb = gUpTicks-gDownTicks;
   double imbFrac = (gTicks>0) ? (double)MathAbs(netImb)/(double)gTicks : 0.0;
   double a = (ArraySize(atr)>1 && atr[1]>0.0) ? atr[1] : _Point;
   double moveFrac = Clamp(MathAbs(move)/a, 0.0, 1.0);
   str = Clamp(0.5*imbFrac + 0.5*moveFrac, 0.0, 1.0);
}

//+------------------------------------------------------------------+
//| Run the full analysis and present the suggestion                 |
//+------------------------------------------------------------------+
void Finalize()
{
   int need = MathMax(LearningBars + MomentumBars + 5, 60);
   if(!LoadData(need))
   {
      // fall back to a smaller window if history is short
      need = MathMax(MomentumBars + 30, 40);
      if(!LoadData(need))
      {
         string msg = "SignalScannerBot: not enough data to analyze yet.";
         Print(msg);
         if(ShowPanel) DrawPanel("NO DATA", 0.0, clrGray);
         Comment(msg);
         return;
      }
   }

   // 1) calibrate weights for the 7 bar-based signals
   for(int k=0;k<7;k++)
   {
      gSigHitRate[k] = MeasureHitRate(k, LearningBars);
      double edge = (gSigHitRate[k]-0.5)*2.0;      // -1..+1
      gSigWeight[k] = UseAdaptiveWeights ? Clamp(0.10 + 0.90*MathMax(0.0,edge), 0.10, 1.0)
                                         : 1.0;
   }
   // HTF trend & tick drift use fixed baseline weights (not bar-learnable here)
   gSigHitRate[7]=0.5; gSigWeight[7]=UseAdaptiveWeights?0.60:1.0;
   gSigHitRate[8]=0.5; gSigWeight[8]=UseAdaptiveWeights?0.50:1.0;

   // 2) evaluate live direction/strength for every signal (bar shift 1 = last closed)
   for(int k=0;k<7;k++)
      SignalAt(k, 1, gSigDir[k], gSigStr[k]);
   HtfTrend(gSigDir[7], gSigStr[7]);
   TickDrift(gSigDir[8], gSigStr[8]);

   // 3) aggregate weighted evidence
   double bullMass=0.0, bearMass=0.0;
   for(int k=0;k<SIG_COUNT;k++)
   {
      double c = gSigWeight[k]*gSigStr[k];
      if(gSigDir[k]>0) bullMass += c;
      else if(gSigDir[k]<0) bearMass += c;
   }
   double total = bullMass+bearMass;

   string verdict; double conf; color col;
   if(total<=0.0)
   {
      verdict="NEUTRAL"; conf=50.0; col=clrGray;
   }
   else
   {
      double dominance = MathMax(bullMass,bearMass)/total*100.0;
      conf = MathMin(MaxConfidencePct, dominance);
      if(dominance < NeutralBandPct){ verdict="NEUTRAL"; col=clrGoldenrod; }
      else if(bullMass>bearMass){ verdict="BUY"; col=clrLimeGreen; }
      else { verdict="SELL"; col=clrTomato; }
   }

   // 4) present
   PrintResult(verdict, conf, bullMass, bearMass);
   if(ShowPanel) DrawPanel(verdict, conf, col);
   if(AlertOnResult)
      Alert(StringFormat("SignalScanner %s %s: %s (%.0f%%)",
            _Symbol, EnumToString((ENUM_TIMEFRAMES)_Period), verdict, conf));
}

//+------------------------------------------------------------------+
void PrintResult(string verdict, double conf, double bull, double bear)
{
   Print("=====================================================");
   PrintFormat("  SignalScannerBot result for %s %s",
               _Symbol, EnumToString((ENUM_TIMEFRAMES)_Period));
   PrintFormat("  Observed %d live ticks over %ds (up=%d down=%d)",
               gTicks, ObservationSeconds, gUpTicks, gDownTicks);
   Print("  ---------------------------------------------------");
   Print("  signal            dir     strength  hit-rate  weight");
   for(int k=0;k<SIG_COUNT;k++)
   {
      string ds = (gSigDir[k]>0?"BUY ":(gSigDir[k]<0?"SELL":"----"));
      PrintFormat("  %-16s  %-4s    %6.2f    %6.1f%%   %5.2f",
                  gSigName[k], ds, gSigStr[k], gSigHitRate[k]*100.0, gSigWeight[k]);
   }
   Print("  ---------------------------------------------------");
   PrintFormat("  bullish mass=%.3f  bearish mass=%.3f", bull, bear);
   PrintFormat("  >>> SUGGESTION: %s   confidence=%.0f%%", verdict, conf);
   Print("  (suggestion only - not a trade order, not financial advice)");
   Print("=====================================================");
}

//+------------------------------------------------------------------+
void UpdateCountdown(int remain)
{
   string txt = StringFormat("SignalScannerBot: analyzing %s (%s)...  %ds left",
                             _Symbol, EnumToString((ENUM_TIMEFRAMES)_Period), remain);
   Comment(txt);
   if(ShowPanel) DrawPanel(StringFormat("ANALYZING  %ds", remain), 0.0, clrSteelBlue);
}

//+------------------------------------------------------------------+
//| Simple on-chart panel                                            |
//+------------------------------------------------------------------+
void MakeLabel(string name,int x,int y,string text,color clr,int fontsize,string font="Arial")
{
   string obj = PANEL+name;
   if(ObjectFind(0,obj)<0)
      ObjectCreate(0,obj,OBJ_LABEL,0,0,0);
   ObjectSetInteger(0,obj,OBJPROP_CORNER,CORNER_LEFT_UPPER);
   ObjectSetInteger(0,obj,OBJPROP_XDISTANCE,x);
   ObjectSetInteger(0,obj,OBJPROP_YDISTANCE,y);
   ObjectSetInteger(0,obj,OBJPROP_COLOR,clr);
   ObjectSetInteger(0,obj,OBJPROP_FONTSIZE,fontsize);
   ObjectSetString(0,obj,OBJPROP_FONT,font);
   ObjectSetString(0,obj,OBJPROP_TEXT,text);
   ObjectSetInteger(0,obj,OBJPROP_SELECTABLE,false);
   ObjectSetInteger(0,obj,OBJPROP_HIDDEN,true);
}

void DrawPanel(string verdict, double conf, color col)
{
   string bg = PANEL+"bg";
   if(ObjectFind(0,bg)<0)
      ObjectCreate(0,bg,OBJ_RECTANGLE_LABEL,0,0,0);
   ObjectSetInteger(0,bg,OBJPROP_CORNER,CORNER_LEFT_UPPER);
   ObjectSetInteger(0,bg,OBJPROP_XDISTANCE,10);
   ObjectSetInteger(0,bg,OBJPROP_YDISTANCE,20);
   ObjectSetInteger(0,bg,OBJPROP_XSIZE,300);
   ObjectSetInteger(0,bg,OBJPROP_YSIZE,120);
   ObjectSetInteger(0,bg,OBJPROP_BGCOLOR,C'20,20,25');
   ObjectSetInteger(0,bg,OBJPROP_BORDER_TYPE,BORDER_FLAT);
   ObjectSetInteger(0,bg,OBJPROP_COLOR,clrDimGray);
   ObjectSetInteger(0,bg,OBJPROP_SELECTABLE,false);
   ObjectSetInteger(0,bg,OBJPROP_HIDDEN,true);

   MakeLabel("title", 22, 28, "Signal Scanner", clrWhite, 11);
   MakeLabel("sym",   22, 50, StringFormat("%s  %s", _Symbol,
             EnumToString((ENUM_TIMEFRAMES)_Period)), clrSilver, 9);
   if(conf>0.0)
   {
      MakeLabel("verdict", 22, 72, verdict, col, 20, "Arial Black");
      MakeLabel("conf",   150, 78, StringFormat("%.0f%%", conf), col, 16, "Arial Black");
      MakeLabel("note",    22,112, "suggestion only - not advice", clrGray, 8);
   }
   else
   {
      MakeLabel("verdict", 22, 74, verdict, col, 14, "Arial Black");
      MakeLabel("conf",   150, 78, "", col, 16);
      MakeLabel("note",    22,112, "watching live signals...", clrGray, 8);
   }
   ChartRedraw(0);
}
//+------------------------------------------------------------------+
