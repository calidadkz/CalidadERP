import { useState } from 'react';
import { PlannedPayment, ActualPayment, InternalTransaction, BankAccount, CurrencyLot, PaymentAllocation, Currency } from '@/types';
import { ApiService } from '@/services/api';
import { TableNames, KZT_RATES } from '@/constants';
import { FinanceService } from '@/services/DomainLogic';
import { MoneyMath } from '@/services/MoneyMath';

export const useFinanceState = (addLog: (a: any, b: any, c: any, d: any) => void) => {
    const [plannedPayments, setPlannedPayments] = useState<PlannedPayment[]>([]);
    const [actualPayments, setActualPayments] = useState<ActualPayment[]>([]);
    const [internalTransactions, setInternalTransactions] = useState<InternalTransaction[]>([]);
    const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
    const [currencyStacks, setCurrencyStacks] = useState<CurrencyLot[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);

    const syncAndSortStacks = (stacks: CurrencyLot[]) => {
        return [...stacks]
            .filter(s => Number(s.amountRemaining) > 0.0001)
            .sort((a, b) => {
                const dateCompare = a.date.localeCompare(b.date);
                if (dateCompare !== 0) return dateCompare;
                return a.id.localeCompare(b.id);
            });
    };

    const addPlannedPayment = async (p: PlannedPayment) => {
        const dataToSave = { ...p };
        if (dataToSave.cashFlowItemId === '') dataToSave.cashFlowItemId = undefined;
        
        const saved = await ApiService.create<PlannedPayment>(TableNames.PLANNED_PAYMENTS, dataToSave);
        setPlannedPayments(prev => [...prev, saved]);
        addLog('Create', 'План платежа', saved.id, `Плановая сумма: ${saved.amountDue} ${saved.currency}`);
    };

    const executePayment = async (p: ActualPayment) => {
        if (isProcessing) return;
        setIsProcessing(true);
        
        try {
            const account = bankAccounts.find(a => a.id === p.bankAccountId);
            if (!account) {
                throw new Error(`Счет с ID ${p.bankAccountId} не найден`);
            }

            const amountNum = Number(p.amount) || 0;

            if (p.direction === 'Outgoing' && amountNum > account.balance) {
                throw new Error(`Недостаточно средств на счету ${account.bank}. Требуется: ${amountNum}, Доступно: ${account.balance}`);
            }

            let effectiveRate = 1;
            let totalCostKZTValue = p.currency === Currency.KZT ? amountNum : 0;
            let currentAllStacks = [...currencyStacks];

            if (p.direction === 'Outgoing' && p.currency !== Currency.KZT) {
                const consumption = FinanceService.consumeCurrencyFIFO(amountNum, p.currency, account.id, currentAllStacks);
                effectiveRate = consumption.effectiveRate;
                totalCostKZTValue = consumption.totalKZT;
                
                for (const updatedLot of consumption.updatedStacks) {
                    const originalLot = currentAllStacks.find(old => old.id === updatedLot.id);
                    if (originalLot && Math.abs(Number(originalLot.amountRemaining) - Number(updatedLot.amountRemaining)) > 0.0001) {
                        const cleanUuid = updatedLot.id.split('-ACC-')[0];
                        await ApiService.update(TableNames.CURRENCY_LOTS, cleanUuid, { 
                            amountRemaining: Number(updatedLot.amountRemaining) 
                        });
                    }
                }
                currentAllStacks = consumption.updatedStacks;
            } else if (p.direction === 'Incoming' && p.currency !== Currency.KZT) {
                effectiveRate = Number(p.exchangeRate) || Number(KZT_RATES[p.currency]) || 1;
                totalCostKZTValue = MoneyMath.multiply(amountNum, effectiveRate);
                
                const now = new Date();
                const fullTimestamp = p.date.includes('T') ? p.date : `${p.date}T${now.toISOString().split('T')[1]}`;

                const newLotData: Partial<CurrencyLot> = {
                    date: fullTimestamp,
                    currency: p.currency,
                    amountOriginal: amountNum,
                    amountRemaining: amountNum,
                    costInKZT: totalCostKZTValue,
                    rate: effectiveRate
                };
                
                const savedLot = await ApiService.create<CurrencyLot>(TableNames.CURRENCY_LOTS, newLotData);
                currentAllStacks = [...currentAllStacks, savedLot];
            }

            const { allocations: incomingAllocations, ...dbPayload } = p;
            
            // Strip fields that don't exist in the DB schema to prevent errors
            delete (dbPayload as any).fromAccount;
            delete (dbPayload as any).documentNumber;
            delete (dbPayload as any).knp;
            delete (dbPayload as any).purpose;
            delete (dbPayload as any).counterpartyBinIin;
            delete (dbPayload as any).counterpartyIik;
            delete (dbPayload as any).counterpartyBik;
            
            const paymentPayload: any = {
                ...dbPayload,
                amount: amountNum,
                bankAccountId: account.id,
                exchangeRate: effectiveRate,
                totalCostKZT: totalCostKZTValue
            };

            const savedActual = await ApiService.create<ActualPayment>(TableNames.ACTUAL_PAYMENTS, paymentPayload);
            const actualBusinessId = savedActual.id; 

            const finalAllocations: PaymentAllocation[] = [];
            if (incomingAllocations && incomingAllocations.length > 0) {
                const allocationsToSave = incomingAllocations.map(al => ({
                    actualPaymentId: actualBusinessId,
                    plannedPaymentId: al.plannedPaymentId,
                    amountCovered: Number(al.amountCovered)
                }));
                await ApiService.createMany(TableNames.PAYMENT_ALLOCATIONS, allocationsToSave);
                finalAllocations.push(...incomingAllocations.map(al => ({ ...al, actualPaymentId: actualBusinessId })));

                const updatedPlans = [...plannedPayments];
                for (const al of incomingAllocations) {
                    const planIdx = updatedPlans.findIndex(pp => pp.id === al.plannedPaymentId);
                    if (planIdx > -1) {
                        const plan = updatedPlans[planIdx];
                        const newPaidAmount = MoneyMath.add(Number(plan.amountPaid) || 0, Number(al.amountCovered));
                        const isPaid = newPaidAmount >= (Number(plan.amountDue) - 0.01);
                        
                        const updateData: any = { amountPaid: newPaidAmount, isPaid };
                        await ApiService.update(TableNames.PLANNED_PAYMENTS, plan.id, updateData);
                        updatedPlans[planIdx] = { ...plan, ...updateData };
                    }
                }
                setPlannedPayments(updatedPlans);
            }

            const balanceChange = p.direction === 'Outgoing' ? -amountNum : amountNum;
            const newBalance = MoneyMath.add(Number(account.balance), balanceChange);
            await ApiService.update(TableNames.BANK_ACCOUNTS, account.id, { balance: newBalance });

            setActualPayments(prev => [{ 
                ...savedActual, 
                allocations: finalAllocations, 
                counterpartyName: p.counterpartyName, 
                fromAccount: p.fromAccount || `${account.bank} ${account.number}`,
                documentNumber: p.documentNumber,
                knp: p.knp,
                purpose: p.purpose,
                counterpartyBinIin: p.counterpartyBinIin,
                counterpartyIik: p.counterpartyIik,
                counterpartyBik: p.counterpartyBik
            }, ...prev]);
            setBankAccounts(prev => prev.map(a => a.id === account.id ? { ...a, balance: newBalance } : a));
            setCurrencyStacks(syncAndSortStacks(currentAllStacks));

            addLog('Post', 'Платеж', actualBusinessId, `${p.direction === 'Outgoing' ? 'Расход' : 'Приход'}: ${amountNum} ${p.currency}`);

        } catch (err: any) {
            console.error("[FINANCE CRITICAL ERROR]", err);
            throw err;
        } finally {
            setIsProcessing(false);
        }
    };

    const allocatePayment = async (paymentId: string, newAllocations: PaymentAllocation[]) => {
        if (isProcessing) return;
        setIsProcessing(true);
        try {
            await ApiService.createMany(TableNames.PAYMENT_ALLOCATIONS, newAllocations.map(al => ({
                actualPaymentId: paymentId,
                plannedPaymentId: al.plannedPaymentId,
                amountCovered: Number(al.amountCovered)
            })));
            
            setActualPayments(prev => prev.map(p => p.id === paymentId ? { ...p, allocations: [...(p.allocations || []), ...newAllocations] } : p));
            
            const updatedPlans = [...plannedPayments];
            for (const al of newAllocations) {
                const planIdx = updatedPlans.findIndex(p => p.id === al.plannedPaymentId);
                if (planIdx > -1) {
                    const pp = updatedPlans[planIdx];
                    const newPaidAmount = MoneyMath.add(Number(pp.amountPaid) || 0, Number(al.amountCovered));
                    const isPaid = newPaidAmount >= (Number(pp.amountDue) - 0.01);
                    
                    const updateData: any = { amountPaid: newPaidAmount, isPaid };
                    await ApiService.update(TableNames.PLANNED_PAYMENTS, pp.id, updateData);
                    updatedPlans[planIdx] = { ...pp, ...updateData };
                }
            }
            setPlannedPayments(updatedPlans);
            addLog('Post', 'Разноска', paymentId, `Привязано ${newAllocations.length} транша(ов)`);
        } finally { 
            setIsProcessing(false); 
        }
    };

    const deletePlannedPayment = async (id: string) => {
        await ApiService.delete(TableNames.PLANNED_PAYMENTS, id);
        setPlannedPayments(prev => prev.filter(p => p.id !== id));
        addLog('Delete', 'План платежа', id, 'Удаление');
    };

    const addBankAccount = async (account: BankAccount, initialRate: number = 1) => {
        if (isProcessing) return;
        setIsProcessing(true);
        try {
            const saved = await ApiService.create<BankAccount>(TableNames.BANK_ACCOUNTS, account);
            setBankAccounts(prev => [...prev, saved]);
            if (saved.currency !== Currency.KZT && Number(saved.balance) > 0) {
                const initialLot: Partial<CurrencyLot> = {
                    date: new Date().toISOString(),
                    currency: saved.currency,
                    amountOriginal: Number(saved.balance),
                    amountRemaining: Number(saved.balance),
                    costInKZT: MoneyMath.multiply(Number(saved.balance), initialRate),
                    rate: initialRate
                };
                const savedLot = await ApiService.create<CurrencyLot>(TableNames.CURRENCY_LOTS, initialLot);
                setCurrencyStacks(syncAndSortStacks([...currencyStacks, savedLot]));
            }
            addLog('Create', 'Счет', saved.id, `Открыт счет: ${saved.name}`);
        } catch (err: any) {
            console.error("[ADD_BANK_ACCOUNT ERROR]", err);
            throw err;
        } finally {
            setIsProcessing(false);
        }
    };

    const addInternalTransaction = async (tx: InternalTransaction) => {
        if (isProcessing) return;
        setIsProcessing(true);
        try {
            const fromAcc = bankAccounts.find(a => a.id === tx.fromAccountId);
            const toAcc = bankAccounts.find(a => a.id === tx.toAccountId);
            if (!fromAcc || !toAcc) return;

            if ((Number(tx.amountSent) + Number(tx.fee)) > fromAcc.balance) {
                throw new Error("Недостаточно средств на счете для перевода");
            }

            let currentStacks = [...currencyStacks];

            if (fromAcc.currency !== Currency.KZT) {
                const mainCons = FinanceService.consumeCurrencyFIFO(Number(tx.amountSent), fromAcc.currency, fromAcc.id, currentStacks);
                currentStacks = mainCons.updatedStacks;
                const feeCons = FinanceService.consumeCurrencyFIFO(Number(tx.fee), fromAcc.currency, fromAcc.id, currentStacks);
                currentStacks = feeCons.updatedStacks;
                
                for (const updatedLot of currentStacks) {
                    const originalLot = currencyStacks.find(old => old.id === updatedLot.id);
                    if (originalLot && Math.abs(Number(originalLot.amountRemaining) - Number(updatedLot.amountRemaining)) > 0.0001) {
                        await ApiService.update(TableNames.CURRENCY_LOTS, updatedLot.id.split('-ACC-')[0], { amountRemaining: Number(updatedLot.amountRemaining) });
                    }
                }
            }

            if (toAcc.currency !== Currency.KZT) {
                const rate = tx.type === 'Exchange' 
                    ? (Number(tx.amountSent) / Number(tx.amountReceived)) * (Number(KZT_RATES[fromAcc.currency]) || 1)
                    : (Number(KZT_RATES[fromAcc.currency]) || 1);

                const lotPayload = {
                    date: new Date().toISOString(),
                    currency: toAcc.currency,
                    amountOriginal: Number(tx.amountReceived),
                    amountRemaining: Number(tx.amountReceived),
                    costInKZT: MoneyMath.multiply(Number(tx.amountReceived), rate),
                    rate: rate
                };
                const savedLot = await ApiService.create<CurrencyLot>(TableNames.CURRENCY_LOTS, lotPayload);
                currentStacks = [...currentStacks, savedLot];
            }

            const updatedFromBal = MoneyMath.subtract(Number(fromAcc.balance), MoneyMath.add(Number(tx.amountSent), Number(tx.fee)));
            const updatedToBal = MoneyMath.add(Number(toAcc.balance), Number(tx.amountReceived));

            setBankAccounts(prev => prev.map(a => a.id === fromAcc.id ? { ...a, balance: updatedFromBal } : a.id === toAcc.id ? { ...a, balance: updatedToBal } : a));
            
            const savedTx = await ApiService.create<InternalTransaction>(TableNames.INTERNAL_TRANSACTIONS, tx);
            setInternalTransactions(prev => [savedTx, ...prev]);

            await ApiService.update(TableNames.BANK_ACCOUNTS, fromAcc.id, { balance: updatedFromBal });
            await ApiService.update(TableNames.BANK_ACCOUNTS, toAcc.id, { balance: updatedToBal });
            setCurrencyStacks(syncAndSortStacks(currentStacks));

            addLog('Transaction', 'Внутренняя операция', savedTx.id, `${tx.type}: ${tx.amountSent} ${fromAcc.currency}`);
        } finally { 
            setIsProcessing(false); 
        }
    };

    return {
        plannedPayments, setPlannedPayments,
        actualPayments, setActualPayments,
        internalTransactions, setInternalTransactions,
        bankAccounts, setBankAccounts,
        currencyStacks, setCurrencyStacks,
        addPlannedPayment, executePayment, addInternalTransaction,
        allocatePayment, deletePlannedPayment, addBankAccount,
        isProcessing 
    };
};
