import { useState } from 'react';
import { PlannedPayment, ActualPayment, InternalTransaction, BankAccount, CurrencyLot, PaymentAllocation, Currency, MoneyMovement } from '@/types';
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
    const [moneyMovements, setMoneyMovements] = useState<MoneyMovement[]>([]);
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
            let consumedLots: import('@/types').ConsumedLotEntry[] = [];

            if (p.direction === 'Outgoing' && p.currency !== Currency.Kzt) {
                const consumption = FinanceService.consumeCurrencyFIFO(amountNum, p.currency, account.id, currentAllStacks);
                effectiveRate = consumption.effectiveRate;
                totalCostKztValue = consumption.totalKzt;

                // Вычисляем точный список лотов и потреблённые суммы
                consumedLots = consumption.updatedStacks
                    .filter(updatedLot => {
                        const originalLot = currentAllStacks.find(old => old.id === updatedLot.id);
                        return originalLot && Math.abs(Number(originalLot.amountRemaining) - Number(updatedLot.amountRemaining)) > 0.0001;
                    })
                    .map(updatedLot => {
                        const originalLot = currentAllStacks.find(old => old.id === updatedLot.id)!;
                        return {
                            lotId: updatedLot.id.split('-ACC-')[0],
                            amount: MoneyMath.subtract(Number(originalLot.amountRemaining), Number(updatedLot.amountRemaining)),
                            op: 'consume' as const,
                        };
                    });

                const updatePromises = consumedLots.map(cl =>
                    ApiService.update(TableNames.CURRENCY_LOTS, cl.lotId, {
                        amountRemaining: Number(consumption.updatedStacks.find(s => s.id.split('-ACC-')[0] === cl.lotId)?.amountRemaining ?? 0)
                    })
                );
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
                // Запоминаем созданный лот для возможного отката
                consumedLots = [{ lotId: savedLot.id, amount: amountNum, op: 'create' }];
                currentAllStacks = [...currentAllStacks, savedLot];
            }

            const { allocations: incomingAllocations, ...dbPayload } = p;
            const keysToRemove = ['fromAccount', 'documentNumber', 'knp', 'purpose', 'counterpartyBinIin', 'counterpartyIik', 'counterpartyBik'];
            const cleanedPayload = { ...dbPayload };
            keysToRemove.forEach(k => delete (cleanedPayload as any)[k]);

            const paymentPayload: any = {
                ...cleanedPayload,
                amount: amountNum,
                bankAccountId: account.id,
                exchangeRate: effectiveRate,
                totalCostKzt: totalCostKztValue,
                consumedLots: consumedLots.length > 0 ? consumedLots : [],
            };
            const savedActual = await ApiService.create<ActualPayment>(TableNames.ACTUAL_PAYMENTS, paymentPayload);

            const finalAllocations: PaymentAllocation[] = [];
            if (incomingAllocations && incomingAllocations.length > 0) {
                const allocationsToSave = incomingAllocations.map(al => ({
                    id: al.id || ApiService.generateId('PA'),
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

            // Записываем в реестр движений денег
            try {
                const firstAlloc = finalAllocations[0];
                const movData: Partial<MoneyMovement> = {
                    id: ApiService.generateId('MM'),
                    date: p.date,
                    bankAccountId: account.id,
                    direction: p.direction === 'Incoming' ? 'In' : 'Out',
                    amount: amountNum,
                    currency: p.currency,
                    amountKzt: totalCostKztValue,
                    exchangeRate: effectiveRate,
                    actualPaymentId: savedActual.id,
                    cashFlowItemId: firstAlloc?.cashFlowItemId || undefined,
                    batchId: firstAlloc?.batchId || undefined,
                    counterpartyId: p.counterpartyId,
                    counterpartyName: p.counterpartyName,
                    type: 'Payment',
                };
                const savedMov = await ApiService.create<MoneyMovement>(TableNames.MONEY_MOVEMENTS, movData);
                setMoneyMovements(prev => [savedMov, ...prev]);
            } catch (movErr) {
                console.warn('[MONEY_MOVEMENT] Не удалось записать движение:', movErr);
            }

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
                id: al.id || ApiService.generateId('PA'),
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

    const deleteActualPayment = async (id: string) => {
        if (isProcessing) return;
        setIsProcessing(true);
        try {
            const payment = actualPayments.find(p => p.id === id);
            if (!payment) throw new Error('Платёж не найден');

            // Внутренние переводы — блокируем (требуют ручной обработки обеих сторон)
            if (payment.isInternalTransfer) {
                throw new Error('Нельзя удалить платёж, помеченный как внутренний перевод. Сначала удалите внутреннюю транзакцию.');
            }

            const account = bankAccounts.find(a => a.id === payment.bankAccountId);
            if (!account) throw new Error('Счёт не найден');

            const amountNum = Number(payment.amount) || 0;

            // 1. Откатить аллокации — восстановить amountPaid у PlannedPayment
            const allocs = payment.allocations || [];
            const updatedPlans = [...plannedPayments];
            for (const al of allocs) {
                if (!al.plannedPaymentId) continue;
                const planIdx = updatedPlans.findIndex(pp => pp.id === al.plannedPaymentId);
                if (planIdx > -1) {
                    const pp = updatedPlans[planIdx];
                    const newPaidAmount = Math.max(0, MoneyMath.subtract(Number(pp.amountPaid) || 0, Number(al.amountCovered)));
                    const isPaid = newPaidAmount >= (Number(pp.amountDue) - 0.01);
                    await ApiService.update(TableNames.PLANNED_PAYMENTS, pp.id, { amountPaid: newPaidAmount, isPaid });
                    updatedPlans[planIdx] = { ...pp, amountPaid: newPaidAmount, isPaid };
                }
            }

            // 2. Удалить записи аллокаций
            await ApiService.deleteByField(TableNames.PAYMENT_ALLOCATIONS, 'actualPaymentId', id);

            // 3. Откатить баланс счёта
            const balanceChange = payment.direction === 'Outgoing' ? amountNum : -amountNum;
            const newBalance = MoneyMath.add(Number(account.balance), balanceChange);
            await ApiService.update(TableNames.BANK_ACCOUNTS, account.id, { balance: newBalance });

            // 4. Откатить валютные лоты через сохранённый consumedLots
            let updatedStacks = [...currencyStacks];
            if (payment.currency !== Currency.Kzt && payment.consumedLots?.length) {
                for (const cl of payment.consumedLots) {
                    if (cl.op === 'create') {
                        // Incoming: удаляем созданный лот (если нетронутый) или уменьшаем amountRemaining
                        const lot = updatedStacks.find(s => s.id === cl.lotId || s.id.startsWith(cl.lotId + '-ACC-'));
                        const remainingNow = lot ? Number(lot.amountRemaining) : null;
                        if (remainingNow !== null && Math.abs(remainingNow - cl.amount) < 0.01) {
                            // Лот нетронутый — можно удалить
                            await ApiService.delete(TableNames.CURRENCY_LOTS, cl.lotId);
                            updatedStacks = updatedStacks.filter(s => s.id !== lot!.id);
                        } else if (remainingNow !== null) {
                            // Лот частично потрачен — уменьшаем на ещё оставшееся
                            const newRemaining = Math.max(0, MoneyMath.subtract(remainingNow, cl.amount));
                            await ApiService.update(TableNames.CURRENCY_LOTS, cl.lotId, { amountRemaining: newRemaining });
                            updatedStacks = updatedStacks.map(s => s.id === lot!.id ? { ...s, amountRemaining: newRemaining } : s);
                        }
                    } else {
                        // Outgoing: восстанавливаем amountRemaining в лоте
                        const lot = updatedStacks.find(s => s.id === cl.lotId || s.id.startsWith(cl.lotId + '-ACC-'));
                        if (lot) {
                            const newRemaining = Math.min(
                                MoneyMath.add(Number(lot.amountRemaining), cl.amount),
                                Number(lot.amountOriginal)
                            );
                            await ApiService.update(TableNames.CURRENCY_LOTS, cl.lotId, { amountRemaining: newRemaining });
                            updatedStacks = updatedStacks.map(s => s.id === lot.id ? { ...s, amountRemaining: newRemaining } : s);
                        } else {
                            // Лот был полностью потрачен и вышел из активного стека — достаём из БД
                            try {
                                const dbLot = await ApiService.fetchOne<CurrencyLot>(TableNames.CURRENCY_LOTS, cl.lotId);
                                if (dbLot) {
                                    const newRemaining = Math.min(
                                        MoneyMath.add(Number(dbLot.amountRemaining), cl.amount),
                                        Number(dbLot.amountOriginal)
                                    );
                                    await ApiService.update(TableNames.CURRENCY_LOTS, cl.lotId, { amountRemaining: newRemaining });
                                    updatedStacks = [...updatedStacks, { ...dbLot, amountRemaining: newRemaining }];
                                }
                            } catch (e) {
                                console.warn('[DELETE_PAYMENT] Не удалось восстановить лот:', cl.lotId, e);
                            }
                        }
                    }
                }
            } else if (payment.direction === 'Incoming' && payment.currency !== Currency.Kzt) {
                // Fallback для старых платежей без consumedLots: эвристический поиск
                const matchingLot = updatedStacks.find(
                    lot => lot.currency === payment.currency
                        && Math.abs(Number(lot.amountOriginal) - amountNum) < 0.01
                        && Math.abs(Number(lot.amountRemaining) - Number(lot.amountOriginal)) < 0.01
                );
                if (matchingLot) {
                    await ApiService.delete(TableNames.CURRENCY_LOTS, matchingLot.id.split('-ACC-')[0]);
                    updatedStacks = updatedStacks.filter(s => s.id !== matchingLot.id);
                }
            }

            // 5. Удалить сам платёж
            await ApiService.delete(TableNames.ACTUAL_PAYMENTS, id);

            // 6. Записать компенсирующее движение в реестр
            try {
                const reversalData: Partial<MoneyMovement> = {
                    id: ApiService.generateId('MR'),
                    date: new Date().toISOString().split('T')[0],
                    bankAccountId: payment.bankAccountId,
                    direction: payment.direction === 'Incoming' ? 'Out' : 'In',
                    amount: amountNum,
                    currency: payment.currency,
                    amountKzt: Number(payment.totalCostKzt) || amountNum,
                    exchangeRate: Number(payment.exchangeRate) || 1,
                    actualPaymentId: payment.id,
                    counterpartyId: payment.counterpartyId,
                    counterpartyName: payment.counterpartyName,
                    type: 'Reversal',
                    note: `Компенсация удалённого платежа от ${payment.date}`,
                };
                const savedReversal = await ApiService.create<MoneyMovement>(TableNames.MONEY_MOVEMENTS, reversalData);
                setMoneyMovements(prev => [savedReversal, ...prev]);
            } catch (movErr) {
                console.warn('[MONEY_MOVEMENT] Не удалось записать компенсацию:', movErr);
            }

            // 7. Обновить state
            setPlannedPayments(updatedPlans);
            setActualPayments(prev => prev.filter(p => p.id !== id));
            setBankAccounts(prev => prev.map(a => a.id === account.id ? { ...a, balance: newBalance } : a));
            setCurrencyStacks(syncAndSortStacks(updatedStacks));

            addLog('Delete', 'Платеж', id, `Удалён: ${payment.direction === 'Outgoing' ? 'Расход' : 'Приход'} ${amountNum} ${payment.currency}, баланс счёта скорректирован`);
        } catch (err: any) {
            console.error('[DELETE_ACTUAL_PAYMENT]', err);
            throw err;
        } finally {
            setIsProcessing(false);
        }
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
        moneyMovements, setMoneyMovements,
        addPlannedPayment, executePayment, addInternalTransaction,
        allocatePayment, deletePlannedPayment, deleteActualPayment, addBankAccount,
        isProcessing
    };
};
