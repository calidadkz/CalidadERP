
import { Currency, CurrencyLot, StockMovement, Product, OrderStatus, PlannedPayment, ActualPayment, MovementStatus } from '../types';
import { EXCHANGE_RATES_TO_USD, KZT_RATES } from '../constants';
import { MoneyMath } from './MoneyMath';
import { ApiService } from './api';

export class FinanceService {
  /**
   * Списывает валюту по методу FIFO.
   */
  static consumeCurrencyFIFO(
    amount: number,
    currency: Currency,
    accountId: string,
    allStacks: CurrencyLot[]
  ): { 
    effectiveRate: number; 
    totalKZT: number; 
    updatedStacks: CurrencyLot[]; 
    consumedSegments: { amount: number, rate: number, date: string }[] 
  } {
    if (currency === Currency.KZT) {
      return { 
        effectiveRate: 1, 
        totalKZT: amount, 
        updatedStacks: allStacks, 
        consumedSegments: [{ amount, rate: 1, date: new Date().toISOString() }] 
      };
    }

    const relevantStacks = allStacks
      .filter(s => s.currency === currency && (s.id && (s.id.includes(accountId) || !s.id.includes('-ACC-'))))
      .sort((a, b) => {
          const dateComp = a.date.localeCompare(b.date);
          if (dateComp !== 0) return dateComp;
          return a.id.localeCompare(b.id);
      });
    
    const otherStacks = allStacks.filter(s => !relevantStacks.find(as => as.id === s.id));
    
    let remainingToConsume = amount;
    let totalKZT = 0;
    const consumedSegments: { amount: number, rate: number, date: string }[] = [];
    const processingStacks = relevantStacks.map(s => ({ ...s }));

    for (const lot of processingStacks) {
      if (remainingToConsume <= 0.0001) break;
      
      if (lot.amountRemaining > 0) {
        const take = Math.min(lot.amountRemaining, remainingToConsume);
        const cost = MoneyMath.multiply(take, lot.rate);
        
        totalKZT = MoneyMath.add(totalKZT, cost);
        consumedSegments.push({ amount: take, rate: lot.rate, date: lot.date });
        
        lot.amountRemaining = MoneyMath.subtract(lot.amountRemaining, take);
        remainingToConsume = MoneyMath.subtract(remainingToConsume, take);
      }
    }

    if (remainingToConsume > 0.0001) {
      const marketRate = KZT_RATES[currency] || 1;
      totalKZT = MoneyMath.add(totalKZT, MoneyMath.multiply(remainingToConsume, marketRate));
      consumedSegments.push({ amount: remainingToConsume, rate: marketRate, date: new Date().toISOString() });
    }

    const effectiveRate = amount > 0 ? totalKZT / amount : 0;

    return {
      effectiveRate,
      totalKZT,
      updatedStacks: [...otherStacks, ...processingStacks],
      consumedSegments
    };
  }

  static getCrossRate(from: Currency, to: Currency): number {
    if (from === to) return 1;
    const rateToUSD = EXCHANGE_RATES_TO_USD[from];
    const rateTargetToUSD = EXCHANGE_RATES_TO_USD[to];
    return rateToUSD / rateTargetToUSD;
  }
}
