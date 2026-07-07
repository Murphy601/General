//+------------------------------------------------------------------+
//|                                                TradeManager.mqh  |
//|           Order execution, reversal, multi-position scalping     |
//+------------------------------------------------------------------+
#property copyright "ScalpProfitBot"
#property strict

#ifndef SCALP_TRADE_MANAGER_MQH
#define SCALP_TRADE_MANAGER_MQH

#include <Trade/Trade.mqh>
#include <ScalpProfit/SignalEngine.mqh>

//+------------------------------------------------------------------+
class CTradeManager
  {
private:
   CTrade            m_trade;
   string            m_symbol;
   ulong             m_magic;
   int               m_deviation;
   double            m_lot;
   double            m_tpPoints;
   double            m_slPoints;
   bool              m_useTrailing;
   double            m_trailStartPoints;
   double            m_trailStepPoints;
   int               m_maxPositions;
   double            m_point;
   int               m_digits;

   double            NormalizePrice(const double price) const
     {
      return NormalizeDouble(price, m_digits);
     }

   double            NormalizeLot(const double lot) const
     {
      double minLot  = SymbolInfoDouble(m_symbol, SYMBOL_VOLUME_MIN);
      double maxLot  = SymbolInfoDouble(m_symbol, SYMBOL_VOLUME_MAX);
      double stepLot = SymbolInfoDouble(m_symbol, SYMBOL_VOLUME_STEP);

      if(stepLot <= 0.0)
         stepLot = 0.01;

      double normalized = MathFloor(lot / stepLot) * stepLot;
      normalized = MathMax(minLot, MathMin(maxLot, normalized));
      return NormalizeDouble(normalized, 2);
     }

   bool              SelectByMagic(const long typeFilter = -1) const
     {
      const int total = PositionsTotal();
      for(int i = total - 1; i >= 0; i--)
        {
         const ulong ticket = PositionGetTicket(i);
         if(ticket == 0)
            continue;
         if(!PositionSelectByTicket(ticket))
            continue;
         if(PositionGetString(POSITION_SYMBOL) != m_symbol)
            continue;
         if((ulong)PositionGetInteger(POSITION_MAGIC) != m_magic)
            continue;
         if(typeFilter >= 0 && PositionGetInteger(POSITION_TYPE) != typeFilter)
            continue;
         return true;
        }
      return false;
     }

   int               CountPositions(const long typeFilter = -1) const
     {
      int count = 0;
      const int total = PositionsTotal();
      for(int i = 0; i < total; i++)
        {
         const ulong ticket = PositionGetTicket(i);
         if(ticket == 0)
            continue;
         if(!PositionSelectByTicket(ticket))
            continue;
         if(PositionGetString(POSITION_SYMBOL) != m_symbol)
            continue;
         if((ulong)PositionGetInteger(POSITION_MAGIC) != m_magic)
            continue;
         if(typeFilter >= 0 && PositionGetInteger(POSITION_TYPE) != typeFilter)
            continue;
         count++;
        }
      return count;
     }

public:
                     CTradeManager(void)
     {
      m_symbol  = _Symbol;
      m_magic   = 880071;
      m_deviation = 20;
      m_lot = 0.01;
      m_tpPoints = 12.0;
      m_slPoints = 25.0;
      m_useTrailing = true;
      m_trailStartPoints = 4.0;
      m_trailStepPoints = 2.0;
      m_maxPositions = 4;
      m_point = _Point;
      m_digits = _Digits;
     }

   void              Configure(const string symbol,
                               const ulong magic,
                               const int deviation,
                               const double lot,
                               const double tpPoints,
                               const double slPoints,
                               const bool useTrailing,
                               const double trailStartPoints,
                               const double trailStepPoints,
                               const int maxPositions)
     {
      m_symbol = symbol;
      m_magic = magic;
      m_deviation = deviation;
      m_lot = lot;
      m_tpPoints = tpPoints;
      m_slPoints = slPoints;
      m_useTrailing = useTrailing;
      m_trailStartPoints = trailStartPoints;
      m_trailStepPoints = trailStepPoints;
      m_maxPositions = maxPositions;
      m_point = SymbolInfoDouble(symbol, SYMBOL_POINT);
      m_digits = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);

      m_trade.SetExpertMagicNumber((long)m_magic);
      m_trade.SetDeviationInPoints(m_deviation);
      m_trade.SetTypeFillingBySymbol(m_symbol);
     }

   int               TotalPositions(void) const
     {
      return CountPositions(-1);
     }

   int               BuyCount(void) const
     {
      return CountPositions(POSITION_TYPE_BUY);
     }

   int               SellCount(void) const
     {
      return CountPositions(POSITION_TYPE_SELL);
     }

   bool              CloseAll(void)
     {
      bool ok = true;
      const int total = PositionsTotal();
      for(int i = total - 1; i >= 0; i--)
        {
         const ulong ticket = PositionGetTicket(i);
         if(ticket == 0)
            continue;
         if(!PositionSelectByTicket(ticket))
            continue;
         if(PositionGetString(POSITION_SYMBOL) != m_symbol)
            continue;
         if((ulong)PositionGetInteger(POSITION_MAGIC) != m_magic)
            continue;
         ok &= m_trade.PositionClose(ticket);
        }
      return ok;
     }

   bool              CloseDirection(const ENUM_POSITION_TYPE type)
     {
      bool ok = true;
      const int total = PositionsTotal();
      for(int i = total - 1; i >= 0; i--)
        {
         const ulong ticket = PositionGetTicket(i);
         if(ticket == 0)
            continue;
         if(!PositionSelectByTicket(ticket))
            continue;
         if(PositionGetString(POSITION_SYMBOL) != m_symbol)
            continue;
         if((ulong)PositionGetInteger(POSITION_MAGIC) != m_magic)
            continue;
         if((ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE) != type)
            continue;
         ok &= m_trade.PositionClose(ticket);
        }
      return ok;
     }

   bool              OpenBuy(const string comment)
     {
      if(CountPositions(-1) >= m_maxPositions)
         return false;

      const double ask = SymbolInfoDouble(m_symbol, SYMBOL_ASK);
      const double sl = (m_slPoints > 0.0) ? NormalizePrice(ask - m_slPoints * m_point) : 0.0;
      const double tp = (m_tpPoints > 0.0) ? NormalizePrice(ask + m_tpPoints * m_point) : 0.0;
      const double lot = NormalizeLot(m_lot);

      return m_trade.Buy(lot, m_symbol, ask, sl, tp, comment);
     }

   bool              OpenSell(const string comment)
     {
      if(CountPositions(-1) >= m_maxPositions)
         return false;

      const double bid = SymbolInfoDouble(m_symbol, SYMBOL_BID);
      const double sl = (m_slPoints > 0.0) ? NormalizePrice(bid + m_slPoints * m_point) : 0.0;
      const double tp = (m_tpPoints > 0.0) ? NormalizePrice(bid - m_tpPoints * m_point) : 0.0;
      const double lot = NormalizeLot(m_lot);

      return m_trade.Sell(lot, m_symbol, bid, sl, tp, comment);
     }

   bool              ReverseTo(const ENUM_SCALP_SIGNAL newDirection, const string comment)
     {
      if(newDirection == SCALP_SIGNAL_BUY)
        {
         CloseDirection(POSITION_TYPE_SELL);
         return OpenBuy(comment);
        }
      if(newDirection == SCALP_SIGNAL_SELL)
        {
         CloseDirection(POSITION_TYPE_BUY);
         return OpenSell(comment);
        }
      return false;
     }

   void              ManageOpenPositions(void)
     {
      const int total = PositionsTotal();
      for(int i = 0; i < total; i++)
        {
         const ulong ticket = PositionGetTicket(i);
         if(ticket == 0)
            continue;
         if(!PositionSelectByTicket(ticket))
            continue;
         if(PositionGetString(POSITION_SYMBOL) != m_symbol)
            continue;
         if((ulong)PositionGetInteger(POSITION_MAGIC) != m_magic)
            continue;

         const ENUM_POSITION_TYPE type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
         const double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
         const double sl = PositionGetDouble(POSITION_SL);
         const double tp = PositionGetDouble(POSITION_TP);

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
               if(tp == 0.0 || tightTP < tp)
                  m_trade.PositionModify(ticket, sl, tightTP);
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
               if(tp == 0.0 || tightTP > tp)
                  m_trade.PositionModify(ticket, sl, tightTP);
              }
           }
        }
     }

   bool              HasLosingDirection(const ENUM_SCALP_SIGNAL desired,
                                        const double reverseLossPoints) const
     {
      const int total = PositionsTotal();
      for(int i = 0; i < total; i++)
        {
         const ulong ticket = PositionGetTicket(i);
         if(ticket == 0)
            continue;
         if(!PositionSelectByTicket(ticket))
            continue;
         if(PositionGetString(POSITION_SYMBOL) != m_symbol)
            continue;
         if((ulong)PositionGetInteger(POSITION_MAGIC) != m_magic)
            continue;

         const ENUM_POSITION_TYPE type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
         const double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
         const double bid = SymbolInfoDouble(m_symbol, SYMBOL_BID);
         const double ask = SymbolInfoDouble(m_symbol, SYMBOL_ASK);

         if(desired == SCALP_SIGNAL_BUY && type == POSITION_TYPE_SELL)
           {
            const double lossPoints = (ask - openPrice) / m_point;
            if(lossPoints >= reverseLossPoints)
               return true;
           }
         if(desired == SCALP_SIGNAL_SELL && type == POSITION_TYPE_BUY)
           {
            const double lossPoints = (openPrice - bid) / m_point;
            if(lossPoints >= reverseLossPoints)
               return true;
           }
        }
      return false;
     }
  };

#endif // SCALP_TRADE_MANAGER_MQH
