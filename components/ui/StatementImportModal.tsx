import React, { useState, useRef, useEffect, useMemo } from 'react';
import { X, Upload, CheckCircle2, UserPlus, ArrowRight, Loader2, Info, AlertCircle, Save, PlusCircle, Trash2, Link, Tag, Search, Star } from 'lucide-react';
import { useStore } from '@/features/system/context/GlobalStore';
import { StatementParser, ParsedStatementRow, ParseResult } from '@/services/StatementParser';
import { Currency, ActualPayment, Counterparty, CounterpartyAccount, CounterpartyType, CashFlowItem, PlannedPayment, PaymentAllocation } from '@/types';
import { ApiService } from '@/services/api';
import { TableNames } from '@/constants';
import { CounterpartyCreateModal } from '@/features/counterparties/components/CounterpartyCreateModal';
import { CashFlowSelector } from '@/components/ui/CashFlowSelector';

interface StatementImportModalProps {
    onClose: () => void;
}

interface MatchResult {
    row: ParsedStatementRow;
    matchedId: string | null;
    matchedType: CounterpartyType | null;
    cashFlowItemId: string | null;
    plannedPaymentId: string | null;
    isNew: boolean;
    status: 'matched' | 'unmatched' | 'new';
    pendingData?: any;
    // Обнаруженный дубль (уже существующий фактический платёж с той же датой/суммой/направлением)
    duplicatePayment: ActualPayment | null;
    // Решение пользователя: объединить с существующим или создать новую запись
    mergeDecision: 'merge' | 'create';
}

export const StatementImportModal: React.FC<StatementImportModalProps> = ({ onClose }) => {
    const { state, actions } = useStore();
    const { counterparties, bankAccounts, cashFlowItems, plannedPayments, actualPayments } = state;
    const [savingPriorityFor, setSavingPriorityFor] = useState<number | null>(null);

    const [parsedData, setParsedData] = useState<{ rows: ParsedStatementRow[] } | null>(null);
    const [parsedDataMeta, setParsedDataMeta] = useState<{ accountNumber?: string, currency?: string } | null>(null);
    const [matches, setMatches] = useState<MatchResult[]>([]);
    const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>('');
    const [selectedCurrency, setSelectedCurrency] = useState<Currency>(Currency.Kzt); 
    const [selectedFormat, setSelectedFormat] = useState<'kaspi' | 'halyk' | null>(null);

    const [error, setError] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [step, setStep] = useState<'upload' | 'review'>('upload');

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [currentMatchIndex, setCurrentMatchIndex] = useState<number | null>(null);
    const [formData, setFormData] = useState<any>({
        name: '',
        type: CounterpartyType.CLIENT,
        binIin: '',
        legalAddress: '',
        accounts: [] as any[]
    });

    const fileInputRef = useRef<HTMLInputElement>(null);

    const suggestCashFlowItem = (purpose: string, direction: 'Income' | 'Expense'): string | null => {
        const p = purpose.toLowerCase();
        const items = cashFlowItems.filter(i => i.type === direction);
        
        if (p.includes('аренд')) return items.find(i => i.name.toLowerCase().includes('аренд'))?.id || null;
        if (p.includes('зарплат') || p.includes('аванс')) return items.find(i => i.name.toLowerCase().includes('зарплат'))?.id || null;
        if (p.includes('процессинг') || p.includes('комисси')) return items.find(i => i.name.toLowerCase().includes('комисси'))?.id || null;
        if (p.includes('продаж')) return items.find(i => i.name.toLowerCase().includes('товар'))?.id || null;
        if (p.includes('постав')) return items.find(i => i.name.toLowerCase().includes('товар'))?.id || null;
        if (p.includes('перевод собственных')) return items.find(i => i.name.toLowerCase().includes('перевод'))?.id || null;
        
        return items[0]?.id || null;
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile || !selectedFormat) return;
        setError(null);
        setIsProcessing(true);
        try {
            const result = selectedFormat === 'kaspi' 
                ? await StatementParser.parseKaspi(selectedFile)
                : await StatementParser.parseHalyk(selectedFile);
            
            if (result.error || result.rows.length === 0) {
                setError(result.error || "Не удалось распознать данные в файле.");
            } else {
                setParsedDataMeta({ 
                    accountNumber: result.accountNumber, 
                    currency: result.currency 
                });

                let matchedAccountId = '';
                let matchedCurr = Currency.Kzt;

                if (result.accountNumber && result.accountNumber.length > 0) {
                    const parsedAccountNumber = result.accountNumber; 
                    const matchedAccount = bankAccounts.find(account => {
                        if (!account.number) return false;
                        const systemAccountNumber = account.number.replace(/\s/g, '').toUpperCase();
                        return systemAccountNumber === parsedAccountNumber;
                    });

                    if (matchedAccount) {
                        matchedAccountId = matchedAccount.id;
                        matchedCurr = matchedAccount.currency;
                    }
                } else if (result.currency) {
                    const validCurrency = Object.values(Currency).find(c => c === result.currency);
                    if (validCurrency) matchedCurr = validCurrency as Currency;
                }

                setSelectedBankAccountId(matchedAccountId);
                setSelectedCurrency(matchedCurr);
                processParsedResult(result);
            }
        } catch (err) {
            setError(`Ошибка при обработке файла: ${(err as Error).message}`);
        } finally {
            setIsProcessing(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const processParsedResult = (result: ParseResult) => {
        setParsedData({ rows: result.rows });
        const initialMatches: MatchResult[] = result.rows.map(row => {
            const direction = row.income > 0 ? 'Income' : 'Expense';
            const amount = row.income > 0 ? row.income : row.expense;
            const rowDirection = row.income > 0 ? 'Incoming' : 'Outgoing';

            let matchedCp = row.counterpartyBinIin
                ? counterparties.find(c => c.binIin === row.counterpartyBinIin)
                : counterparties.find(c => c.name.toLowerCase().includes(row.counterpartyName.toLowerCase()));

            let matchedPp = matchedCp ? plannedPayments.find(p =>
                !p.isPaid &&
                p.counterpartyId === matchedCp?.id &&
                Math.abs(p.amountDue - p.amountPaid - amount) < 0.01
            ) : null;

            // Приоритетная статья контрагента — важнее suggestCashFlowItem
            const priorityIds = matchedCp?.cashFlowItemIds?.filter(Boolean) || [];
            const prioritySuggestion = priorityIds.length > 0 ? priorityIds[0] : null;

            // --- Поиск дубля среди существующих фактических платежей ---
            // Дата из выписки: "DD.MM.YYYY" или "DD.MM.YYYY HH:mm:ss" → YYYY-MM-DD
            const normalizedDate = row.date.split(' ')[0].split('.').reverse().join('-');
            const duplicatePayment = actualPayments.find(ap => {
                const apDate = ap.date?.split('T')[0]; // YYYY-MM-DD
                if (apDate !== normalizedDate) return false;
                if (Math.abs(Number(ap.amount) - amount) > 0.01) return false;
                if (ap.direction !== rowDirection) return false;
                return true;
            }) || null;

            return {
                row: { ...row },
                matchedId: matchedCp?.id || (duplicatePayment?.counterpartyId ?? null),
                matchedType: matchedCp?.type || null,
                cashFlowItemId: matchedPp?.cashFlowItemId || prioritySuggestion || suggestCashFlowItem(row.purpose, direction),
                plannedPaymentId: matchedPp?.id || null,
                isNew: false,
                status: (matchedCp ? 'matched' : 'unmatched') as 'matched' | 'unmatched' | 'new',
                duplicatePayment,
                mergeDecision: (duplicatePayment ? 'merge' : 'create') as 'merge' | 'create',
            };
        });
        setMatches(initialMatches);
        setStep('review');
    };

    const updateMatch = (index: number, key: keyof MatchResult, value: any) => {
        const newMatches = [...matches];
        const current = { ...newMatches[index], [key]: value };

        if (key === 'plannedPaymentId' && value) {
            const pp = plannedPayments.find(p => p.id === value);
            if (pp) current.cashFlowItemId = pp.cashFlowItemId;
        }

        newMatches[index] = current;
        setMatches(newMatches);
    };

    const toggleMergeDecision = (index: number) => {
        setMatches(prev => prev.map((m, i) =>
            i === index ? { ...m, mergeDecision: m.mergeDecision === 'merge' ? 'create' : 'merge' } : m
        ));
    };

    const openCreateForm = (index: number, initialType: CounterpartyType) => {
        const match = matches[index];
        setCurrentMatchIndex(index);
        setFormData({
            name: match.row.counterpartyName,
            type: initialType,
            binIin: match.row.counterpartyBinIin || '',
            legalAddress: '',
            accounts: [{
                id: ApiService.generateUUID(),
                bankName: match.row.counterpartyBankName, 
                iik: match.row.counterpartyIik || '',
                bik: match.row.counterpartyBik || '',
                currency: selectedCurrency,
                isDefault: true
            }]
        });
        setIsCreateModalOpen(true);
    };

    const handleSaveNewCounterpartyFromComponent = async (counterparty: Counterparty, account?: CounterpartyAccount) => {
        if (!counterparty.name || currentMatchIndex === null) return;
        
        setIsProcessing(true);
        try {
            const created = await actions.addCounterparty(counterparty, account);
            
            const newMatches = [...matches];
            const sourceMatch = newMatches[currentMatchIndex];
            
            newMatches.forEach((m, idx) => {
                const sameBin = counterparty.binIin && m.row.counterpartyBinIin === counterparty.binIin;
                const sameName = m.row.counterpartyName.toLowerCase() === sourceMatch.row.counterpartyName.toLowerCase();
                
                if (m.status === 'unmatched' && (sameBin || sameName)) {
                    newMatches[idx] = {
                        ...m,
                        status: 'matched',
                        matchedId: created.id,
                        matchedType: created.type,
                        isNew: false
                    };
                }
            });

            setMatches(newMatches);
            setIsCreateModalOpen(false);
        } catch (e) {
            setError("Ошибка при создании контрагента: " + (e as Error).message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSavePriority = async (idx: number) => {
        const match = matches[idx];
        if (!match.matchedId || !match.cashFlowItemId) return;
        const cp = counterparties.find(c => c.id === match.matchedId);
        if (!cp) return;

        const existing = cp.cashFlowItemIds || [];
        if (existing.includes(match.cashFlowItemId)) return; // уже есть

        const updated = [match.cashFlowItemId, ...existing];
        setSavingPriorityFor(idx);
        try {
            await actions.patchCounterpartyCashFlowItems(match.matchedId, updated);
        } finally {
            setSavingPriorityFor(null);
        }
    };

    const handleImport = async () => {
        if (!selectedBankAccountId || !parsedData) return;
        setIsProcessing(true);
        setError(null);
        try {
            for (const match of matches) {
                // ── СРАЩИВАНИЕ: обогащаем существующий платёж, новый не создаём ──
                if (match.mergeDecision === 'merge' && match.duplicatePayment) {
                    const dup = match.duplicatePayment;
                    const row = match.row;
                    const patch: Record<string, any> = {};

                    // Дополняем только пустые поля — не затираем уже заполненные
                    if (!dup.counterpartyBinIin && row.counterpartyBinIin) patch.counterpartyBinIin = row.counterpartyBinIin;
                    if (!dup.counterpartyIik && row.counterpartyIik) patch.counterpartyIik = row.counterpartyIik;
                    if (!dup.counterpartyBik && row.counterpartyBik) patch.counterpartyBik = row.counterpartyBik;
                    if (!dup.counterpartyBankName && row.counterpartyBankName) patch.counterpartyBankName = row.counterpartyBankName;
                    if (!dup.documentNumber && row.documentNumber) patch.documentNumber = row.documentNumber;
                    if (!(dup as any).knp && row.knp) patch.knp = row.knp;
                    if (!(dup as any).purpose && row.purpose) patch.purpose = row.purpose;
                    // Обновляем имя контрагента если было "физлицо" или пустое
                    const genericNames = ['физлицо', 'физ.лицо', 'физическое лицо', ''];
                    if (row.counterpartyName && genericNames.includes((dup.counterpartyName || '').toLowerCase().trim())) {
                        patch.counterpartyName = row.counterpartyName;
                    }
                    // Если контрагент теперь может быть привязан по БИН
                    if (!dup.counterpartyId && match.matchedId) patch.counterpartyId = match.matchedId;

                    if (Object.keys(patch).length > 0) {
                        await ApiService.update(TableNames.ACTUAL_PAYMENTS, dup.id, patch);
                    }
                    continue; // дубль обработан — дальше не создаём
                }

                // ── СОЗДАНИЕ: стандартный путь ──
                let counterpartyId = match.matchedId;
                if (!counterpartyId) continue;

                const amount = match.row.income > 0 ? match.row.income : match.row.expense;
                const direction = match.row.income > 0 ? 'Incoming' : 'Outgoing';

                const allocations: PaymentAllocation[] = [{
                    id: ApiService.generateId('AL'),
                    actualPaymentId: '',
                    plannedPaymentId: match.plannedPaymentId || undefined,
                    cashFlowItemId: match.cashFlowItemId || '',
                    amountCovered: amount,
                    description: match.row.purpose
                }];

                await actions.executePayment({
                    id: ApiService.generateId('TX'),
                    date: match.row.date.split(' ')[0].split('.').reverse().join('-'),
                    direction,
                    counterpartyId,
                    counterpartyName: match.row.counterpartyName,
                    amount,
                    currency: selectedCurrency,
                    bankAccountId: selectedBankAccountId,
                    fromAccount: match.row.counterpartyIik || 'Из выписки',
                    exchangeRate: 1,
                    allocations,
                    documentNumber: match.row.documentNumber,
                    knp: match.row.knp,
                    purpose: match.row.purpose,
                    counterpartyBinIin: match.row.counterpartyBinIin,
                    counterpartyIik: match.row.counterpartyIik,
                    counterpartyBik: match.row.counterpartyBik,
                    counterpartyBankName: match.row.counterpartyBankName
                });
            }
            onClose();
        } catch (e) {
            setError("Ошибка при импорте: " + (e as Error).message);
        } finally {
            setIsProcessing(false);
        }
    };

    const matchedAccount = useMemo(() => {
        return bankAccounts.find(a => a.id === selectedBankAccountId);
    }, [bankAccounts, selectedBankAccountId]);

    const duplicateCount = useMemo(() => matches.filter(m => m.duplicatePayment !== null).length, [matches]);

    // Суммы только по создаваемым записям (merge-строки не создают новых платежей)
    const totals = useMemo(() => {
        return matches.reduce((acc, m) => {
            if (m.mergeDecision === 'merge') return acc;
            acc.income += (m.row.income || 0);
            acc.expense += (m.row.expense || 0);
            return acc;
        }, { income: 0, expense: 0 });
    }, [matches]);

    const netMovement = totals.income - totals.expense;

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[150] p-4">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6 bg-slate-800 text-white flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-500 rounded-2xl shadow-lg shadow-blue-500/20"><Upload size={24}/></div>
                        <div>
                            <h3 className="text-xl font-black uppercase tracking-tighter">Импорт банковской выписки</h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                {selectedFormat ? `Формат: ${selectedFormat === 'kaspi' ? 'Kaspi Pay' : 'Halyk Bank'}` : 'Выберите банк'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors"><X size={24}/></button>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col">
                    {error && (
                        <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-xs font-bold animate-in slide-in-from-top-2">
                            <AlertCircle size={18}/>
                            <div className="flex-1 whitespace-pre-wrap">{error}</div>
                            <button onClick={() => setError(null)} className="p-1 hover:bg-red-100 rounded-lg"><X size={14}/></button>
                        </div>
                    )}

                    {step === 'upload' ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-12">
                            <h4 className="font-black text-slate-800 uppercase tracking-widest mb-12 text-lg">Выберите банк для загрузки выписки</h4>
                            <div className="flex gap-8">
                                <button onClick={() => { setSelectedFormat('kaspi'); fileInputRef.current?.click(); }} className="w-72 h-56 flex flex-col items-center justify-center gap-4 bg-white border-4 border-slate-100 rounded-[3rem] hover:border-blue-400 hover:shadow-2xl transition-all group relative overflow-hidden">
                                    <div className="p-5 bg-slate-50 rounded-3xl group-hover:bg-blue-50 transition-colors">
                                        <img src="https://upload.wikimedia.org/wikipedia/commons/e/ea/Kaspi.kz_Logo.svg" alt="Kaspi" className="h-12"/>
                                    </div>
                                    <span className="text-base font-black text-slate-700 uppercase tracking-widest">Kaspi Pay</span>
                                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">Excel / CSV</span>
                                </button>
                                <button onClick={() => { setSelectedFormat('halyk'); fileInputRef.current?.click(); }} className="w-72 h-56 flex flex-col items-center justify-center gap-4 bg-white border-4 border-slate-100 rounded-[3rem] hover:border-green-400 hover:shadow-2xl transition-all group relative overflow-hidden">
                                    <div className="p-5 bg-slate-50 rounded-3xl group-hover:bg-green-50 transition-colors">
                                        <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Halyk_Bank_logo.svg/1200px-Halyk_Bank_logo.svg.png" alt="Halyk" className="h-12"/>
                                    </div>
                                    <span className="text-base font-black text-slate-700 uppercase tracking-widest">Halyk Bank</span>
                                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">Excel / CSV</span>
                                </button>
                            </div>
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".xlsx,.xls,.csv" className="hidden" />
                            {isProcessing && <div className="mt-8 flex items-center gap-3 text-blue-600 font-black uppercase text-xs tracking-widest"><Loader2 className="animate-spin" size={24}/> Обработка данных...</div>}
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col overflow-hidden">
                            <div className="mx-8 mt-6 mb-4 p-5 bg-white border-2 border-slate-100 rounded-[2rem] flex items-center justify-between shadow-sm animate-in slide-in-from-top-4 duration-500">
                                <div className="flex gap-10">
                                    <div className="flex flex-col gap-1.5">
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Номер счета в выписке</span>
                                        <span className="text-xs font-mono font-bold text-slate-700 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                                            {parsedDataMeta?.accountNumber || 'Не найден'}
                                        </span>
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Валюта в выписке</span>
                                        <span className="text-xs font-bold text-slate-700">
                                            {parsedDataMeta?.currency || 'Не найдена'}
                                        </span>
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Соответствие в ERP</span>
                                        {selectedBankAccountId ? (
                                            <div className="flex items-center gap-2 text-xs font-black text-emerald-600 uppercase">
                                                <CheckCircle2 size={16} />
                                                <span>{matchedAccount?.bank} • {matchedAccount?.name}</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 text-xs font-black text-red-500 uppercase animate-pulse">
                                                <AlertCircle size={16} />
                                                <span>Счет не сопоставлен автоматически</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                
                                <div className="w-72 flex flex-col gap-1.5">
                                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Выбрать счет ERP вручную</label>
                                    <select 
                                        className={`w-full bg-white border rounded-xl px-4 py-2.5 text-xs font-bold outline-none transition-all focus:ring-4 focus:ring-blue-500/5 ${!selectedBankAccountId ? 'border-red-200 ring-4 ring-red-500/5' : 'border-slate-200'}`}
                                        value={selectedBankAccountId} 
                                        onChange={e => {
                                            const acc = bankAccounts.find(a => a.id === e.target.value);
                                            setSelectedBankAccountId(e.target.value);
                                            if (acc) setSelectedCurrency(acc.currency);
                                        }}
                                    >
                                        <option value="">-- Выберите счет --</option>
                                        {bankAccounts.map(account => (
                                            <option key={account.id} value={account.id}>
                                                {account.bank} • {account.name} ({account.currency})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="px-8 py-3 bg-slate-50 border-y border-slate-200 flex items-center justify-between shrink-0">
                                <div className="flex items-center gap-4">
                                    <div className="text-xs font-black text-slate-500 uppercase tracking-widest">Транзакций в файле:</div>
                                    <div className="px-4 py-1 bg-blue-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest">{matches.length}</div>
                                    {duplicateCount > 0 && (
                                        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-100 border border-amber-300 rounded-full text-[10px] font-black text-amber-700 uppercase tracking-widest">
                                            <AlertCircle size={11}/>
                                            {duplicateCount} возможных дублей — по умолчанию «Объединить»
                                        </div>
                                    )}
                                </div>
                                {!selectedBankAccountId && (
                                    <div className="px-4 py-2 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest animate-bounce">
                                        Выберите счет для продолжения
                                    </div>
                                )}
                            </div>
                            
                            <div className="flex-1 overflow-auto custom-scrollbar bg-slate-50/30">
                                <table className="w-full border-separate border-spacing-y-2 px-8">
                                    <thead className="sticky top-0 bg-white/80 backdrop-blur-md z-10">
                                        <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                            <th className="px-4 py-4 text-left">Дата / Операция</th>
                                            <th className="px-4 py-4 text-left w-64">Контрагент</th>
                                            <th className="px-4 py-4 text-left w-64">Статья ДДС</th>
                                            <th className="px-4 py-4 text-left w-64">План (IPP)</th>
                                            <th className="px-4 py-4 text-right">Сумма</th>
                                            <th className="px-4 py-4 text-left">Назначение</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {matches.map((match, idx) => {
                                            const direction = match.row.income > 0 ? 'Income' : 'Expense';
                                            const realAmount = match.row.income > 0 ? match.row.income : match.row.expense;
                                            const hasDuplicate = match.duplicatePayment !== null;
                                            const isMerging = hasDuplicate && match.mergeDecision === 'merge';

                                            return (
                                                <React.Fragment key={idx}>
                                                <tr className={`shadow-sm hover:shadow-md transition-all group ${isMerging ? 'bg-amber-50/40' : hasDuplicate ? 'bg-red-50/30' : 'bg-white'}`}>
                                                    <td className={`px-4 py-4 rounded-l-2xl border-y border-l ${hasDuplicate ? 'border-amber-200' : 'border-slate-100'}`}>
                                                        <div className="text-[11px] font-black text-slate-700">{match.row.date}</div>
                                                        <div className="text-[9px] font-bold text-slate-400 uppercase mt-1">#{match.row.documentNumber}</div>
                                                        {hasDuplicate && (
                                                            <div className={`mt-1.5 flex items-center gap-1 text-[8px] font-black px-1.5 py-0.5 rounded w-fit uppercase ${isMerging ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>
                                                                <AlertCircle size={8}/>
                                                                {isMerging ? 'Объединить' : 'Создать новую'}
                                                            </div>
                                                        )}
                                                    </td>
                                                    
                                                    <td className={`px-4 py-4 border-y ${hasDuplicate ? 'border-amber-200' : 'border-slate-100'} ${isMerging ? 'opacity-50 pointer-events-none' : ''}`}>
                                                        {match.status === 'matched' ? (
                                                            <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-2 rounded-xl border border-emerald-100 group/item">
                                                                <CheckCircle2 size={14}/>
                                                                <span className="text-[10px] font-black truncate">{counterparties.find(c => c.id === match.matchedId)?.name}</span>
                                                                <button onClick={() => updateMatch(idx, 'status', 'unmatched')} className="ml-auto opacity-0 group-hover/item:opacity-100 transition-opacity"><X size={12}/></button>
                                                            </div>
                                                        ) : match.status === 'new' ? (
                                                            <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-2 rounded-xl border border-blue-100">
                                                                <UserPlus size={14}/>
                                                                <span className="text-[10px] font-black italic truncate">{match.pendingData?.name}</span>
                                                                <button onClick={() => updateMatch(idx, 'status', 'unmatched')} className="ml-auto"><X size={12}/></button>
                                                            </div>
                                                        ) : (
                                                            <div className="flex flex-col gap-1.5">
                                                                <div className="text-[10px] font-bold text-slate-800 leading-tight mb-1">{match.row.counterpartyName}</div>
                                                                <button onClick={() => openCreateForm(idx, CounterpartyType.CLIENT)} className="w-full py-2 bg-blue-600 text-white rounded-lg text-[9px] font-black uppercase flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors">
                                                                    <UserPlus size={14}/>
                                                                    <span>Создать контрагента</span>
                                                                </button>
                                                                <select className="w-full bg-slate-100 text-[9px] font-bold rounded-lg p-1.5 border-transparent outline-none focus:bg-white focus:border-slate-200" onChange={e => {
                                                                    const cp = counterparties.find(c => c.id === e.target.value);
                                                                    if (cp) updateMatch(idx, 'matchedId', cp.id), updateMatch(idx, 'status', 'matched');
                                                                }} value=""><option value="">Или выбрать из базы...</option>{counterparties.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                                                            </div>
                                                        )}
                                                    </td>

                                                    <td className={`px-4 py-4 border-y ${hasDuplicate ? 'border-amber-200' : 'border-slate-100'} ${isMerging ? 'opacity-40 pointer-events-none' : ''}`}>
                                                        {(() => {
                                                            const cp = match.matchedId ? counterparties.find(c => c.id === match.matchedId) : null;
                                                            const cpPriorityIds = cp?.cashFlowItemIds || [];
                                                            const isAlreadyPriority = !!match.cashFlowItemId && cpPriorityIds.includes(match.cashFlowItemId);
                                                            const canSavePriority = !!match.matchedId && !!match.cashFlowItemId && !isAlreadyPriority;
                                                            const isSaving = savingPriorityFor === idx;
                                                            return (
                                                                <div className="flex flex-col gap-1">
                                                                    <div className="flex items-center justify-between ml-1">
                                                                        <label className="text-[8px] font-black text-slate-400 uppercase">Статья ДДС</label>
                                                                        {match.matchedId && match.cashFlowItemId && (
                                                                            <button
                                                                                onClick={() => handleSavePriority(idx)}
                                                                                disabled={isAlreadyPriority || isSaving}
                                                                                title={isAlreadyPriority ? 'Уже в приоритетах' : 'Запомнить как приоритетную для контрагента'}
                                                                                className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase transition-all ${
                                                                                    isAlreadyPriority
                                                                                        ? 'text-amber-500 bg-amber-50 cursor-default'
                                                                                        : 'text-slate-400 hover:text-amber-500 hover:bg-amber-50'
                                                                                }`}
                                                                            >
                                                                                {isSaving ? <Loader2 size={10} className="animate-spin"/> : <Star size={10} fill={isAlreadyPriority ? 'currentColor' : 'none'}/>}
                                                                                {isAlreadyPriority ? 'Приоритет' : 'Запомнить'}
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                    <CashFlowSelector
                                                                        value={match.cashFlowItemId || ''}
                                                                        onChange={id => updateMatch(idx, 'cashFlowItemId', id)}
                                                                        direction={direction === 'Income' ? 'Incoming' : 'Outgoing'}
                                                                        dropdownMinWidth={220}
                                                                        placeholder="— Статья ДДС —"
                                                                        priorityItemIds={cpPriorityIds}
                                                                    />
                                                                </div>
                                                            );
                                                        })()}
                                                    </td>

                                                    <td className={`px-4 py-4 border-y ${hasDuplicate ? 'border-amber-200' : 'border-slate-100'} ${isMerging ? 'opacity-40 pointer-events-none' : ''}`}>
                                                        <div className="flex flex-col gap-1">
                                                            <label className="text-[8px] font-black text-slate-400 uppercase ml-1">Привязка к плану (IPP)</label>
                                                            <select
                                                                className={`w-full text-[10px] font-bold rounded-xl p-2 border outline-none transition-all ${match.plannedPaymentId ? 'bg-blue-600 text-white border-transparent' : 'bg-slate-50 border-slate-200 text-slate-600'}`}
                                                                value={match.plannedPaymentId || ''}
                                                                onChange={e => updateMatch(idx, 'plannedPaymentId', e.target.value)}
                                                                disabled={!match.matchedId && !match.isNew}
                                                            >
                                                                <option value="">-- Прямой платеж --</option>
                                                                {plannedPayments.filter(p => !p.isPaid && (p.counterpartyId === match.matchedId)).map(p => (
                                                                    <option key={p.id} value={p.id}>{p.sourceDocId} ({p.amountDue - p.amountPaid} {p.currency})</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    </td>

                                                    <td className={`px-4 py-4 border-y ${hasDuplicate ? 'border-amber-200' : 'border-slate-100'} text-right`}>
                                                        <div className={`text-sm font-black font-mono ${match.row.income > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                            {match.row.income > 0 ? '+' : '-'}{realAmount.toLocaleString()}
                                                        </div>
                                                        <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">{selectedCurrency}</div>
                                                    </td>

                                                    <td className={`px-4 py-4 rounded-r-2xl border-y border-r ${hasDuplicate ? 'border-amber-200' : 'border-slate-100'} max-w-xs`}>
                                                        <div className="text-[9px] font-medium text-slate-500 line-clamp-2 leading-relaxed italic" title={match.row.purpose}>"{match.row.purpose}"</div>
                                                    </td>
                                                </tr>

                                                {/* ── Sub-row: панель сращивания ── */}
                                                {hasDuplicate && (() => {
                                                    const dup = match.duplicatePayment!;
                                                    const dupAlloc = (dup.allocations || []).reduce((s: number, a: any) => s + Number(a.amountCovered), 0);
                                                    const dupUnalloc = Math.max(0, Number(dup.amount) - dupAlloc);
                                                    const dupCp = counterparties.find(c => c.id === dup.counterpartyId);
                                                    return (
                                                        <tr>
                                                            <td colSpan={6} className={`px-6 pb-3 border-x border-b rounded-b-2xl ${isMerging ? 'border-amber-200 bg-amber-50/60' : 'border-red-100 bg-red-50/30'}`}>
                                                                <div className="flex items-center gap-4 flex-wrap">
                                                                    {/* Статус дубля */}
                                                                    <div className={`flex items-center gap-1.5 text-[9px] font-black uppercase px-2 py-1 rounded-lg ${isMerging ? 'text-amber-700 bg-amber-100' : 'text-red-600 bg-red-100'}`}>
                                                                        <AlertCircle size={10}/>
                                                                        Найден в системе
                                                                    </div>
                                                                    {/* Детали существующего платежа */}
                                                                    <div className="flex items-center gap-3 text-[10px] text-slate-600">
                                                                        <span className="font-bold text-slate-800">
                                                                            {dupCp?.name || dup.counterpartyName || '—'}
                                                                        </span>
                                                                        <span className="text-slate-400">{dup.date}</span>
                                                                        <span className="font-mono font-black">
                                                                            {Number(dup.amount).toLocaleString('ru-RU')} {dup.currency}
                                                                        </span>
                                                                        {dup.counterpartyBinIin && (
                                                                            <span className="text-[8px] font-mono text-slate-400">БИН {dup.counterpartyBinIin}</span>
                                                                        )}
                                                                        <span className={`text-[8px] font-black px-2 py-0.5 rounded ${dupUnalloc < 0.01 ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-600'}`}>
                                                                            {dupUnalloc < 0.01 ? '✓ Разнесён' : `Нераз. ${dupUnalloc.toLocaleString('ru-RU')}`}
                                                                        </span>
                                                                    </div>
                                                                    {/* Что будет обогащено */}
                                                                    {isMerging && (() => {
                                                                        const enrichFields: string[] = [];
                                                                        if (!dup.counterpartyBinIin && match.row.counterpartyBinIin) enrichFields.push('БИН');
                                                                        if (!dup.counterpartyIik && match.row.counterpartyIik) enrichFields.push('ИИК');
                                                                        if (!(dup as any).documentNumber && match.row.documentNumber) enrichFields.push('№ документа');
                                                                        if (!(dup as any).knp && match.row.knp) enrichFields.push('КНП');
                                                                        const genericNames = ['физлицо', 'физ.лицо', 'физическое лицо', ''];
                                                                        if (match.row.counterpartyName && genericNames.includes((dup.counterpartyName || '').toLowerCase().trim())) enrichFields.push('Имя');
                                                                        return enrichFields.length > 0 ? (
                                                                            <div className="flex items-center gap-1 text-[8px] text-amber-600">
                                                                                <span className="font-bold">Добавит:</span>
                                                                                {enrichFields.map(f => (
                                                                                    <span key={f} className="bg-amber-100 px-1.5 py-0.5 rounded font-black">{f}</span>
                                                                                ))}
                                                                            </div>
                                                                        ) : (
                                                                            <span className="text-[8px] text-slate-400 italic">данные уже заполнены</span>
                                                                        );
                                                                    })()}
                                                                    {/* Toggle merge/create */}
                                                                    <div className="ml-auto flex rounded-xl overflow-hidden border border-slate-200 text-[9px] font-black uppercase shrink-0">
                                                                        <button
                                                                            onClick={() => match.mergeDecision !== 'merge' && toggleMergeDecision(idx)}
                                                                            className={`px-3 py-2 transition-all ${isMerging ? 'bg-amber-500 text-white' : 'bg-white text-slate-500 hover:bg-amber-50 hover:text-amber-600'}`}
                                                                        >
                                                                            Объединить
                                                                        </button>
                                                                        <button
                                                                            onClick={() => match.mergeDecision !== 'create' && toggleMergeDecision(idx)}
                                                                            className={`px-3 py-2 border-l border-slate-200 transition-all ${!isMerging ? 'bg-red-500 text-white' : 'bg-white text-slate-500 hover:bg-red-50 hover:text-red-500'}`}
                                                                        >
                                                                            Создать отдельно
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })()}
                                                </React.Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            <div className="p-8 bg-white border-t border-slate-200 flex justify-between items-center shrink-0">
                                <button onClick={() => setStep('upload')} className="px-6 py-3 text-xs font-black uppercase text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-2"><ArrowRight className="rotate-180" size={16}/> Назад</button>
                                <div className="flex gap-12">
                                    <div className="flex gap-10">
                                        <div className="flex flex-col text-right justify-center">
                                            <div className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Поступления</div>
                                            <div className="text-lg font-black text-slate-800">
                                                +{totals.income.toLocaleString()} <span className="text-xs opacity-40">{selectedCurrency}</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col text-right justify-center">
                                            <div className="text-[9px] font-black text-red-600 uppercase tracking-widest">Списания</div>
                                            <div className="text-lg font-black text-slate-800">
                                                -{totals.expense.toLocaleString()} <span className="text-xs opacity-40">{selectedCurrency}</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col text-right justify-center border-l border-slate-100 pl-10">
                                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Движение (Net)</div>
                                            <div className={`text-lg font-black ${netMovement >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                {netMovement >= 0 ? '+' : ''}{netMovement.toLocaleString()} <span className="text-xs opacity-40">{selectedCurrency}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={handleImport} 
                                        disabled={isProcessing || !selectedBankAccountId || matches.some(m => m.mergeDecision === 'create' && (m.status === 'unmatched' || !m.cashFlowItemId))}
                                        className="px-16 py-4 bg-blue-600 text-white rounded-[1.5rem] font-black uppercase text-sm shadow-xl shadow-blue-500/20 hover:bg-blue-700 disabled:opacity-30 transition-all active:scale-95 flex items-center gap-3"
                                    >
                                        {isProcessing ? <Loader2 className="animate-spin" size={20}/> : <CheckCircle2 size={20}/>}
                                        {isProcessing ? 'Проведение...' : 'Завершить импорт'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {isCreateModalOpen && (
                <CounterpartyCreateModal
                    onClose={() => setIsCreateModalOpen(false)}
                    onSubmit={async (counterparty, accounts) => {
                        await handleSaveNewCounterpartyFromComponent(counterparty, accounts[0]);
                    }}
                    autoFillData={{
                        name: formData.name, 
                        binIin: formData.binIin,
                        bankName: formData.accounts[0]?.bankName,
                        bik: formData.accounts[0]?.bik,
                        iik: formData.accounts[0]?.iik
                    }}
                    initialType={formData.type}
                />
            )}
        </div>
    );
};
