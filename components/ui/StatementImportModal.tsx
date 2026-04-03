import React, { useState, useRef, useEffect, useMemo } from 'react';
import { X, Upload, CheckCircle2, UserPlus, ArrowRight, Loader2, Info, AlertCircle, Save, PlusCircle, Trash2, Link, Tag, Search } from 'lucide-react';
import { useStore } from '@/features/system/context/GlobalStore';
import { StatementParser, ParsedStatementRow, ParseResult } from '@/services/StatementParser';
import { Currency, ActualPayment, Counterparty, CounterpartyAccount, CounterpartyType, CashFlowItem, PlannedPayment, PaymentAllocation } from '@/types'; 
import { ApiService } from '@/services/api';
import { CounterpartyCreateModal } from '@/features/counterparties/components/CounterpartyCreateModal';

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
}

export const StatementImportModal: React.FC<StatementImportModalProps> = ({ onClose }) => {
    const { state, actions } = useStore();
    const { counterparties, bankAccounts, cashFlowItems, plannedPayments } = state; 

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

            let matchedCp = row.counterpartyBinIin 
                ? counterparties.find(c => c.binIin === row.counterpartyBinIin)
                : counterparties.find(c => c.name.toLowerCase().includes(row.counterpartyName.toLowerCase()));
            
            let matchedPp = matchedCp ? plannedPayments.find(p => 
                !p.isPaid && 
                p.counterpartyId === matchedCp?.id && 
                Math.abs(p.amountDue - p.amountPaid - amount) < 0.01
            ) : null;

            return {
                row: { ...row },
                matchedId: matchedCp?.id || null,
                matchedType: matchedCp?.type || null,
                cashFlowItemId: matchedPp?.cashFlowItemId || suggestCashFlowItem(row.purpose, direction),
                plannedPaymentId: matchedPp?.id || null,
                isNew: false,
                status: matchedCp ? 'matched' : 'unmatched' as any
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

    const handleImport = async () => {
        if (!selectedBankAccountId || !parsedData) return;
        setIsProcessing(true);
        setError(null);
        try {
            for (const match of matches) {
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

    const totals = useMemo(() => {
        return matches.reduce((acc, m) => {
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
                                            
                                            return (
                                                <tr key={idx} className="bg-white shadow-sm hover:shadow-md transition-all group">
                                                    <td className="px-4 py-4 rounded-l-2xl border-y border-l border-slate-100">
                                                        <div className="text-[11px] font-black text-slate-700">{match.row.date}</div>
                                                        <div className="text-[9px] font-bold text-slate-400 uppercase mt-1">#{match.row.documentNumber}</div>
                                                    </td>
                                                    
                                                    <td className="px-4 py-4 border-y border-slate-100">
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

                                                    <td className="px-4 py-4 border-y border-slate-100">
                                                        <div className="flex flex-col gap-1">
                                                            <label className="text-[8px] font-black text-slate-400 uppercase ml-1">Статья ДДС</label>
                                                            <select 
                                                                className={`w-full text-[10px] font-bold rounded-xl p-2 border outline-none transition-all ${match.cashFlowItemId ? 'bg-indigo-50 border-indigo-100 text-indigo-700' : 'bg-amber-50 border-amber-100 text-amber-700'}`}
                                                                value={match.cashFlowItemId || ''}
                                                                onChange={e => updateMatch(idx, 'cashFlowItemId', e.target.value)}
                                                            >
                                                                <option value="">-- Выберите статью --</option>
                                                                {cashFlowItems.filter(i => i.type === direction).map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                                                            </select>
                                                        </div>
                                                    </td>

                                                    <td className="px-4 py-4 border-y border-slate-100">
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

                                                    <td className="px-4 py-4 border-y border-slate-100 text-right">
                                                        <div className={`text-sm font-black font-mono ${match.row.income > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                            {match.row.income > 0 ? '+' : '-'}{ realAmount.toLocaleString() }
                                                        </div>
                                                        <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">{selectedCurrency}</div>
                                                    </td>

                                                    <td className="px-4 py-4 rounded-r-2xl border-y border-r border-slate-100 max-w-xs">
                                                        <div className="text-[9px] font-medium text-slate-500 line-clamp-2 leading-relaxed italic" title={match.row.purpose}>"{match.row.purpose}"</div>
                                                    </td>
                                                </tr>
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
                                        disabled={isProcessing || !selectedBankAccountId || matches.some(m => (m.status === 'unmatched' || !m.cashFlowItemId))} 
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
