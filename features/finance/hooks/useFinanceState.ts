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
        const dataToSave = { ...p } as any;
        if (dataToSave.cashFlowItemId === '') dataToSave.cashFlowItemId = undefined;
        // cashFlowCategory — только фронт, колонки в БД нет
        delete dataToSave.cashFlowCategory;
        const saved = await ApiService.create<PlannedPayment>(TableNames.PLANNED_PAYMENTS, dataToSave);
        setPlannedPayments(prev => [...prev, saved]);
        addLog('Create', 'План платежа', saved.id, `Плановая сумма: ${saved.amountDue} ${saved.currency}`);
    };

    const executePayment = async (p: ActualPayment) => {
        if (isProcessing) return;
        setIsProcessing(true);
        try {
            const account = bankAccounts.find(a => a.id === p.bankAccountId);
            if (!account) throw new Error(`Счет с ID ${p.bankAccountId} не найден`);

            const amountNum = Number(p.amount) || 0;
            if (p.direction === 'Outgoing' && amountNum > account.balance) {
                throw new Error(`Недостаточно средств на счету ${account.bank}. Требуется: ${amountNum}, Доступно: ${account.balance}`);
            }

            let effectiveRate = 1;
            let totalCostKztValue = p.currency === Currency.Kzt ? amountNum : 0;
            let currentAllStacks = [...currencyStacks];

            // FIFO расход валюты
            if (p.direction === 'Outgoing' && p.currency !== Currency.Kzt) {
                const consumption = FinanceService.consumeCurrencyFIFO(amountNum, p.currency, account.id, currentAllStacks);
                effectiveRate = consumption.effectiveRate;
                totalCostKztValue = consumption.totalKzt;
                const updatePromises = consumption.updatedStacks
                    .filter(updatedLot => {
                        const originalLot = currentAllStacks.find(old => old.id === updatedLot.id);
                        return originalLot && Math.abs(Number(originalLot.amountRemaining) - Number(updatedLot.amountRemaining)) > 0.0001;
                    })
                    .map(updatedLot => ApiService.update(TableNames.CURRENCY_LOTS, updatedLot.id.split('-ACC-')[0], { amountRemaining: Number(updatedLot.amountRemaining) }));
                if (updatePromises.length > 0) await Promise.all(updatePromises);
                currentAllStacks = consumption.updatedStacks;
            } else if (p.direction === 'Incoming' && p.currency !== Currency.Kzt) {
                effectiveRate = Number(p.exchangeRate) || Number(KZT_RATES[p.currency]) || 1;
                totalCostKztValue = MoneyMath.multiply(amountNum, effectiveRate);
                const now = new Date();
                const fullTimestamp = p.date.includes('T') ? p.date : `${p.date}T${now.toISOString().split('T')[1]}`;
                const newLotData: Partial<CurrencyLot> = {
                    date: fullTimestamp, currency: p.currency, amountOriginal: amountNum, amountRemaining: amountNum, costInKzt: totalCostKztValue, rate: effectiveRate
                };
                const savedLot = await ApiService.create<CurrencyLot>(TableNames.CURRENCY_LOTS, newLotData);
                currentAllStacks = [...currentAllStacks, savedLot];
            }

            const { allocations: incomingAllocations, ...dbPayload } = p;
            const keysToRemove = ['fromAccount', 'documentNumber', 'knp', 'purpose', 'counterpartyBinIin', 'counterpartyIik', 'counterpartyBik'];
            const cleanedPayload = { ...dbPayload };
            keysToRemove.forEach(k => delete (cleanedPayload as any)[k]);
            
            const paymentPayload: any = { ...cleanedPayload, amount: amountNum, bankAccountId: account.id, exchangeRate: effectiveRate, totalCostKzt: totalCostKztValue };
            const savedActual = await ApiService.create<ActualPayment>(TableNames.ACTUAL_PAYMENTS, paymentPayload);

            const finalAllocations: PaymentAllocation[] = [];
            if (incomingAllocations && incomingAllocations.length > 0) {
                const allocationsToSave = incomingAllocations.map(al => ({
                    actualPaymentId: savedActual.id,
                    plannedPaymentId: al.plannedPaymentId || null,
                    cashFlowItemId: al.cashFlowItemId,
                    amountCovered: Number(al.amountCovered),
                    targetBankAccountId: al.targetBankAccountId || null
                }));
                await ApiService.createMany(TableNames.PAYMENT_ALLOCATIONS, allocationsToSave);
                finalAllocations.push(...incomingAllocations.map(al => ({ ...al, actualPaymentId: savedActual.id })));

                // Обновляем планы
                const updatedPlans = [...plannedPayments];
                for (const al of incomingAllocations) {
                    if (!al.plannedPaymentId) continue;
                    const planIdx = updatedPlans.findIndex(pp => pp.id === al.plannedPaymentId);
                    if (planIdx > -1) {
                        const plan = updatedPlans[planIdx];
                        const newPaidAmount = MoneyMath.add(Number(plan.amountPaid) || 0, Number(al.amountCovered));
                        const isPaid = newPaidAmount >= (Number(plan.amountDue) - 0.01);
                        await ApiService.update(TableNames.PLANNED_PAYMENTS, plan.id, { amountPaid: newPaidAmount, isPaid });
                        updatedPlans[planIdx] = { ...plan, amountPaid: newPaidAmount, isPaid };
                    }
                }
                setPlannedPayments(updatedPlans);
            }

            const balanceChange = p.direction === 'Outgoing' ? -amountNum : amountNum;
            const newBalance = MoneyMath.add(Number(account.balance), balanceChange);
            await ApiService.update(TableNames.BANK_ACCOUNTS, account.id, { balance: newBalance });

            setActualPayments(prev => [{ 
                ...savedActual, allocations: finalAllocations, counterpartyName: p.counterpartyName, 
                fromAccount: p.fromAccount || `${account.bank} ${account.number}`,
                documentNumber: p.documentNumber, knp: p.knp, purpose: p.purpose,
                counterpartyBinIin: p.counterpartyBinIin, counterpartyIik: p.counterpartyIik, counterpartyBik: p.counterpartyBik
            }, ...prev]);
            setBankAccounts(prev => prev.map(a => a.id === account.id ? { ...a, balance: newBalance } : a));
            setCurrencyStacks(syncAndSortStacks(currentAllStacks));
            addLog('Post', 'Платеж', savedActual.id, `${p.direction === 'Outgoing' ? 'Расход' : 'Приход'}: ${amountNum} ${p.currency}`);
        } catch (err: any) {
            console.error("[FINANCE CRITICAL ERROR]", err);
            throw err;
        } finally { setIsProcessing(false); }
    };

    const allocatePayment = async (paymentId: string, newAllocations: PaymentAllocation[]) => {
        if (isProcessing) return;
        setIsProcessing(true);
        try {
            const allocationsToSave = newAllocations.map(al => ({
                actualPaymentId: paymentId,
                plannedPaymentId: al.plannedPaymentId || null,
                cashFlowItemId: al.cashFlowItemId,
                amountCovered: Number(al.amountCovered),
                targetBankAccountId: al.targetBankAccountId || null
                // existingInternalTxId — только фронт, в БД не пишем
            }));

            await ApiService.createMany(TableNames.PAYMENT_ALLOCATIONS, allocationsToSave);
            setActualPayments(prev => prev.map(p => p.id === paymentId ? { ...p, allocations: [...(p.allocations || []), ...newAllocations] } : p));

            const ap = actualPayments.find(p => p.id === paymentId);
            let pairedTxId: string | undefined;
            let hasInternalTransfer = false;

            for (const al of newAllocations) {
                // --- Логика внутренних переводов ---
                if (al.targetBankAccountId && ap) {
                    hasInternalTransfer = true;

                    if (al.existingInternalTxId) {
                        // Вторая сторона: привязываем к уже существующей InternalTransaction
                        const txUpdate: Partial<InternalTransaction> = { isFullyReconciled: true };
                        if (ap.direction === 'Outgoing') txUpdate.actualPaymentOutId = ap.id;
                        else txUpdate.actualPaymentInId = ap.id;

                        await ApiService.update(TableNames.INTERNAL_TRANSACTIONS, al.existingInternalTxId, txUpdate);
                        pairedTxId = al.existingInternalTxId;
                        setInternalTransactions(prev => prev.map(tx =>
                            tx.id === al.existingInternalTxId ? { ...tx, ...txUpdate } : tx
                        ));
                    } else {
                        // Первая сторона: создаём новую InternalTransaction
                        const targetAcc = bankAccounts.find(a => a.id === al.targetBankAccountId);
                        const txData: InternalTransaction = {
                            id: ApiService.generateId('INT'),
                            date: ap.date,
                            type: (ap.currency === targetAcc?.currency ? 'Transfer' : 'Exchange') as any,
                            fromAccountId: ap.direction === 'Outgoing' ? ap.bankAccountId : al.targetBankAccountId!,
                            toAccountId:   ap.direction === 'Outgoing' ? al.targetBankAccountId! : ap.bankAccountId,
                            amountSent:     Number(al.amountCovered),
                            amountReceived: Number(al.amountCovered),
                            fee: 0,
                            rate: 1,
                            isFullyReconciled: false,
                            ...(ap.direction === 'Outgoing'
                                ? { actualPaymentOutId: ap.id }
                                : { actualPaymentInId: ap.id })
                        };
                        // Балансы НЕ меняем — их изменит обработка обеих выписок
                        const savedTx = await ApiService.create<InternalTransaction>(TableNames.INTERNAL_TRANSACTIONS, txData);
                        pairedTxId = savedTx.id;
                        setInternalTransactions(prev => [savedTx, ...prev]);
                    }
                }

                // --- Обновляем PlannedPayment ---
                if (al.plannedPaymentId) {
                    const planIdx = plannedPayments.findIndex(p => p.id === al.plannedPaymentId);
                    if (planIdx > -1) {
                        const pp = plannedPayments[planIdx];
                        const newPaidAmount = MoneyMath.add(Number(pp.amountPaid) || 0, Number(al.amountCovered));
                        const isPaid = newPaidAmount >= (Number(pp.amountDue) - 0.01);
                        await ApiService.update(TableNames.PLANNED_PAYMENTS, pp.id, { amountPaid: newPaidAmount, isPaid });
                        setPlannedPayments(prev => prev.map(p => p.id === pp.id ? { ...p, amountPaid: newPaidAmount, isPaid } : p));
                    }
                }
            }

            // Помечаем actual_payment как внутренний перевод
            if (hasInternalTransfer && pairedTxId) {
                await ApiService.update(TableNames.ACTUAL_PAYMENTS, paymentId, {
                    isInternalTransfer: true,
                    pairedInternalTxId: pairedTxId
                });
                setActualPayments(prev => prev.map(p =>
                    p.id === paymentId ? { ...p, isInternalTransfer: true, pairedInternalTxId: pairedTxId } : p
                ));
            }

            addLog('Post', 'Разноска', paymentId, `Привязано ${newAllocations.length} транша(ов)`);
        } finally { setIsProcessing(false); }
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
            if (saved.currency !== Currency.Kzt && Number(saved.balance) > 0) {
                const initialLot: Partial<CurrencyLot> = {
                    date: new Date().toISOString(), currency: saved.currency, amountOriginal: Number(saved.balance), amountRemaining: Number(saved.balance), costInKzt: MoneyMath.multiply(Number(saved.balance), initialRate), rate: initialRate
                };
                const savedLot = await ApiService.create<CurrencyLot>(TableNames.CURRENCY_LOTS, initialLot);
                setCurrencyStacks(syncAndSortStacks([...currencyStacks, savedLot]));
            }
            addLog('Create', 'Счет', saved.id, `Открыт счет: ${saved.name}`);
        } catch (err: any) {
            console.error("[ADD_BANK_ACCOUNT ERROR]", err);
            throw err;
        } finally { setIsProcessing(false); }
    };

    const addInternalTransaction = async (tx: InternalTransaction) => {
        if (isProcessing) return;
        setIsProcessing(true);
        try {
            const fromAcc = bankAccounts.find(a => a.id === tx.fromAccountId);
            const toAcc = bankAccounts.find(a => a.id === tx.toAccountId);
            if (!fromAcc || !toAcc) return;

            const totalSent = MoneyMath.add(Number(tx.amountSent), Number(tx.fee));
            if (totalSent > fromAcc.balance) throw new Error("Недостаточно средств на счете для перевода");

            let currentStacks = [...currencyStacks];
            if (fromAcc.currency !== Currency.Kzt) {
                const mainCons = FinanceService.consumeCurrencyFIFO(Number(tx.amountSent), fromAcc.currency, fromAcc.id, currentStacks);
                currentStacks = mainCons.updatedStacks;
                const feeCons = FinanceService.consumeCurrencyFIFO(Number(tx.fee), fromAcc.currency, fromAcc.id, currentStacks);
                currentStacks = feeCons.updatedStacks;
                const lotUpdates = currentStacks
                    .filter(updatedLot => {
                        const originalLot = currencyStacks.find(old => old.id === updatedLot.id);
                        return originalLot && Math.abs(Number(originalLot.amountRemaining) - Number(updatedLot.amountRemaining)) > 0.0001;
                    })
                    .map(updatedLot => ApiService.update(TableNames.CURRENCY_LOTS, updatedLot.id.split('-ACC-')[0], { amountRemaining: Number(updatedLot.amountRemaining) }));
                if (lotUpdates.length > 0) await Promise.all(lotUpdates);
            }

            if (toAcc.currency !== Currency.Kzt) {
                const rate = tx.type === 'Exchange' 
                    ? (Number(tx.amountSent) / Number(tx.amountReceived)) * (Number(KZT_RATES[fromAcc.currency]) || 1)
                    : (Number(KZT_RATES[fromAcc.currency]) || 1);
                const lotPayload = {
                    date: new Date().toISOString(), currency: toAcc.currency, amountOriginal: Number(tx.amountReceived), amountRemaining: Number(tx.amountReceived), costInKzt: MoneyMath.multiply(Number(tx.amountReceived), rate), rate: rate
                };
                const savedLot = await ApiService.create<CurrencyLot>(TableNames.CURRENCY_LOTS, lotPayload);
                currentStacks = [...currentStacks, savedLot];
            }

            const updatedFromBal = MoneyMath.subtract(Number(fromAcc.balance), totalSent);
            const updatedToBal = MoneyMath.add(Number(toAcc.balance), Number(tx.amountReceived));
            const [savedTx] = await Promise.all([
                ApiService.create<InternalTransaction>(TableNames.INTERNAL_TRANSACTIONS, tx),
                ApiService.update(TableNames.BANK_ACCOUNTS, fromAcc.id, { balance: updatedFromBal }),
                ApiService.update(TableNames.BANK_ACCOUNTS, toAcc.id, { balance: updatedToBal })
            ]);

            setBankAccounts(prev => prev.map(a => a.id === fromAcc.id ? { ...a, balance: updatedFromBal } : a.id === toAcc.id ? { ...a, balance: updatedToBal } : a));
            setInternalTransactions(prev => [savedTx, ...prev]);
            setCurrencyStacks(syncAndSortStacks(currentStacks));
            addLog('Transaction', 'Внутренняя операция', savedTx.id, `${tx.type}: ${tx.amountSent} ${fromAcc.currency}`);
        } catch (err: any) {
            console.error("[INTERNAL TRANSACTION ERROR]", err);
            throw err;
        } finally { setIsProcessing(false); }
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
