import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, CheckCircle2, UserPlus, ArrowRight, Loader2, Info, AlertCircle, Save, PlusCircle, Trash2 } from 'lucide-react';
import { useStore } from '@/features/system/context/GlobalStore';
import { StatementParser, ParsedStatementRow } from '@/services/StatementParser';
import { Currency, ActualPayment, Counterparty, CounterpartyAccount, CounterpartyType, CashFlowCategory } from '@/types'; 
import { ApiService } from '@/services/api';

interface StatementImportModalProps {
    onClose: () => void;
}

interface MatchResult {
    row: ParsedStatementRow;
    matchedId: string | null;
    matchedType: CounterpartyType | null;
    isNew: boolean;
    status: 'matched' | 'unmatched' | 'new';
    pendingData?: any; 
}

export const StatementImportModal: React.FC<StatementImportModalProps> = ({ onClose }) => {
    const { state, actions } = useStore();
    const { counterparties, bankAccounts } = state;

    const [parsedData, setParsedData] = useState<{ rows: ParsedStatementRow[] } | null>(null);
    const [matches, setMatches] = useState<MatchResult[]>([]);
    const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>('');
    const [selectedCurrency, setSelectedCurrency] = useState<Currency>(Currency.KZT); 
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

    useEffect(() => {
        if (bankAccounts.length > 0 && !selectedBankAccountId) {
            setSelectedBankAccountId(bankAccounts[0].id);
            setSelectedCurrency(bankAccounts[0].currency);
        }
    }, [bankAccounts, selectedBankAccountId]);

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
                processParsedResult(result);
            }
        } catch (err) {
            setError(`Ошибка при обработке файла: ${(err as Error).message}`);
        } finally {
            setIsProcessing(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const processParsedResult = (result: { rows: ParsedStatementRow[] }) => {
        setParsedData({ rows: result.rows });
        const initialMatches: MatchResult[] = result.rows.map(row => {
            let matched = row.counterpartyBinIin 
                ? counterparties.find(c => c.binIin === row.counterpartyBinIin)
                : counterparties.find(c => c.name.toLowerCase() === row.counterpartyName.toLowerCase());
            return {
                row,
                matchedId: matched?.id || null,
                matchedType: matched?.type || null,
                isNew: false,
                status: matched ? 'matched' : 'unmatched'
            };
        });
        setMatches(initialMatches);
        setStep('review');
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
                name: 'Основной',
                bankName: 'Из выписки',
                iik: match.row.counterpartyIik || '',
                bik: match.row.counterpartyBik || '',
                currency: selectedCurrency,
                isDefault: true
            }]
        });
        setIsCreateModalOpen(true);
    };

    const handleSaveNewCounterparty = () => {
        if (!formData.name || currentMatchIndex === null) return;
        
        const newMatches = [...matches];
        const sourceMatch = newMatches[currentMatchIndex];
        const newPendingData = { ...formData };
        
        newMatches.forEach((m, idx) => {
            const sameBin = formData.binIin && m.row.counterpartyBinIin === formData.binIin;
            const sameName = m.row.counterpartyName.toLowerCase() === sourceMatch.row.counterpartyName.toLowerCase();
            
            if (m.status === 'unmatched' && (sameBin || sameName)) {
                newMatches[idx] = {
                    ...m,
                    status: 'new',
                    isNew: true,
                    matchedType: formData.type,
                    pendingData: newPendingData
                };
            }
        });

        newMatches[currentMatchIndex] = {
            ...newMatches[currentMatchIndex],
            status: 'new',
            isNew: true,
            matchedType: formData.type,
            pendingData: newPendingData
        };

        setMatches(newMatches);
        setIsCreateModalOpen(false);
    };

    const handleImport = async () => {
        if (!selectedBankAccountId || !parsedData) return;
        setIsProcessing(true);
        setError(null);
        try {
            const createdCache = new Map<string, string>();

            for (const match of matches) {
                let counterpartyId = match.matchedId;

                if (match.isNew && match.pendingData) {
                    const cacheKey = match.pendingData.binIin || match.pendingData.name.toLowerCase();
                    
                    if (createdCache.has(cacheKey)) {
                        counterpartyId = createdCache.get(cacheKey)!;
                    } else {
                        const cp = await actions.addCounterparty(
                            { 
                                id: ApiService.generateUUID(),
                                name: match.pendingData.name,
                                type: match.pendingData.type,
                                binIin: match.pendingData.binIin,
                                legalAddress: match.pendingData.legalAddress
                            } as Counterparty,
                            match.pendingData.accounts[0]
                        );
                        counterpartyId = cp.id;
                        createdCache.set(cacheKey, cp.id);
                    }
                }

                if (!counterpartyId) continue;
                
                const amount = match.row.income > 0 ? match.row.income : match.row.expense;
                const direction = match.row.income > 0 ? 'Incoming' : 'Outgoing';

                await actions.executePayment({
                    id: ApiService.generateId(),
                    date: match.row.date.split(' ')[0].split('.').reverse().join('-'), 
                    direction,
                    counterpartyId,
                    counterpartyName: match.row.counterpartyName, 
                    amount,
                    currency: selectedCurrency,
                    bankAccountId: selectedBankAccountId,
                    fromAccount: match.row.counterpartyIik || '',
                    exchangeRate: 1,
                    documentNumber: match.row.documentNumber,
                    knp: match.row.knp,
                    purpose: match.row.purpose,
                    counterpartyBinIin: match.row.counterpartyBinIin,
                    counterpartyIik: match.row.counterpartyIik,
                    counterpartyBik: match.row.counterpartyBik
                });
            }
            onClose();
        } catch (e) {
            setError("Ошибка при импорте: " + (e as Error).message);
        } finally {
            setIsProcessing(false);
        }
    };

    const getCounterpartyTypeTranslation = (type: CounterpartyType) => {
        const translations: any = { 
            [CounterpartyType.CLIENT]: 'Клиент', 
            [CounterpartyType.SUPPLIER]: 'Поставщик', 
            [CounterpartyType.EMPLOYEE]: 'Сотрудник', 
            [CounterpartyType.OUR_COMPANY]: 'Наша компания', 
            [CounterpartyType.MANUFACTURER]: 'Производитель' 
        };
        return translations[type] || 'Контрагент';
    };

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[150] p-4">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
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
                            <div className="mb-8 p-8 bg-slate-50 rounded-[3rem] border border-slate-200 w-full max-w-2xl">
                                <h4 className="font-black text-slate-800 uppercase tracking-tight mb-6 text-center text-sm">Настройки зачисления</h4>
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Счет в ERP</label>
                                        <select className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold shadow-sm outline-none focus:ring-2 focus:ring-blue-100" value={selectedBankAccountId} onChange={e => {
                                            const account = bankAccounts.find(acc => acc.id === e.target.value);
                                            setSelectedBankAccountId(e.target.value);
                                            if (account) setSelectedCurrency(account.currency);
                                        }}>
                                            {bankAccounts.map(account => (
                                                <option key={account.id} value={account.id}>
                                                    {account.bank} • {account.name} • {account.number} ({account.currency})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Валюта</label>
                                        <select className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold shadow-sm outline-none focus:ring-2 focus:ring-blue-100" value={selectedCurrency} onChange={e => setSelectedCurrency(e.target.value as Currency)}>
                                            {Object.values(Currency).map(curr => <option key={curr} value={curr}>{curr}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-8">
                                <button onClick={() => { setSelectedFormat('kaspi'); fileInputRef.current?.click(); }} className="w-64 h-48 flex flex-col items-center justify-center gap-4 bg-white border-2 border-slate-100 rounded-[3rem] hover:border-blue-400 hover:shadow-xl transition-all group">
                                    <div className="p-4 bg-slate-50 rounded-2xl group-hover:bg-blue-50 transition-colors">
                                        <img src="https://upload.wikimedia.org/wikipedia/commons/e/ea/Kaspi.kz_Logo.svg" alt="Kaspi" className="h-10"/>
                                    </div>
                                    <span className="text-sm font-black text-slate-700 uppercase tracking-widest">Kaspi Pay</span>
                                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Excel / CSV</span>
                                </button>
                                <button onClick={() => { setSelectedFormat('halyk'); fileInputRef.current?.click(); }} className="w-64 h-48 flex flex-col items-center justify-center gap-4 bg-white border-2 border-slate-100 rounded-[3rem] hover:border-green-400 hover:shadow-xl transition-all group">
                                    <div className="p-4 bg-slate-50 rounded-2xl group-hover:bg-green-50 transition-colors">
                                        <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Halyk_Bank_logo.svg/1200px-Halyk_Bank_logo.svg.png" alt="Halyk" className="h-10"/>
                                    </div>
                                    <span className="text-sm font-black text-slate-700 uppercase tracking-widest">Halyk Bank</span>
                                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Excel / CSV</span>
                                </button>
                            </div>
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".xlsx,.xls,.csv" className="hidden" />
                            {isProcessing && <Loader2 className="animate-spin text-blue-500 mt-8" size={32}/>}
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col overflow-hidden">
                            <div className="px-8 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
                                <div className="flex items-center gap-4">
                                    <div className="text-xs font-black text-slate-500 uppercase tracking-widest">Обзор импорта:</div>
                                    <div className="px-4 py-1.5 bg-blue-100 text-blue-700 rounded-full text-[10px] font-black uppercase tracking-widest">Строк: {parsedData?.rows.length}</div>
                                </div>
                                <div className="flex items-center gap-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    <Info size={16} className="text-blue-500"/> Одно создание контрагента применится ко всем идентичным строкам
                                </div>
                            </div>
                            <div className="flex-1 overflow-auto p-8 pt-4">
                                <table className="w-full border-separate border-spacing-y-2">
                                    <thead>
                                        <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            <th className="px-6 py-2 text-left">Дата / №</th>
                                            <th className="px-6 py-2 text-left">Из выписки</th>
                                            <th className="px-6 py-2 text-left">ERP Сопоставление</th>
                                            <th className="px-6 py-2 text-right">Сумма</th>
                                            <th className="px-6 py-2 text-left">Назначение</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {matches.map((match, idx) => (
                                            <tr key={idx} className="bg-white group shadow-sm hover:shadow-md transition-all rounded-2xl">
                                                <td className="px-6 py-4 rounded-l-2xl border-y border-l border-slate-50">
                                                    <div className="text-xs font-black text-slate-700">{match.row.date}</div>
                                                    <div className="text-[9px] font-bold text-slate-400">#{match.row.documentNumber}</div>
                                                </td>
                                                <td className="px-6 py-4 border-y border-slate-50">
                                                    <div className="text-xs font-black text-slate-800 leading-tight">{match.row.counterpartyName}</div>
                                                    <div className="text-[9px] text-slate-400 font-mono mt-0.5">{match.row.counterpartyBinIin || 'БИН не указан'}</div>
                                                </td>
                                                <td className="px-6 py-4 border-y border-slate-50 min-w-[280px]">
                                                    {match.status === 'matched' ? (
                                                        <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-2 rounded-xl border border-emerald-100">
                                                            <CheckCircle2 size={16}/>
                                                            <span className="text-[10px] font-black truncate">{counterparties.find(c => c.id === match.matchedId)?.name}</span>
                                                            <button onClick={() => { const nm = [...matches]; nm[idx].status = 'unmatched'; nm[idx].matchedId = null; setMatches(nm); }} className="ml-auto opacity-40 hover:opacity-100 transition-opacity"><X size={14}/></button>
                                                        </div>
                                                    ) : match.status === 'new' ? (
                                                        <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-2 rounded-xl border border-blue-100">
                                                            <UserPlus size={16}/>
                                                            <span className="text-[10px] font-black italic truncate">Создать: {match.pendingData?.name} ({getCounterpartyTypeTranslation(match.pendingData?.type)})</span>
                                                            <button onClick={() => { 
                                                                const nm = [...matches];
                                                                const cpName = match.pendingData.name;
                                                                nm.forEach((m, i) => { if (m.status === 'new' && m.pendingData?.name === cpName) { nm[i].status = 'unmatched'; nm[i].pendingData = undefined; } });
                                                                setMatches(nm);
                                                            }} className="ml-auto opacity-40 hover:opacity-100 transition-opacity"><X size={14}/></button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-wrap gap-1">
                                                            <button onClick={() => openCreateForm(idx, CounterpartyType.CLIENT)} className="px-2 py-1.5 bg-blue-600 text-white rounded-lg text-[8px] font-black uppercase hover:bg-blue-700">+ Клиент</button>
                                                            <button onClick={() => openCreateForm(idx, CounterpartyType.SUPPLIER)} className="px-2 py-1.5 bg-slate-800 text-white rounded-lg text-[8px] font-black uppercase hover:bg-slate-900">+ Пост.</button>
                                                            <button onClick={() => openCreateForm(idx, CounterpartyType.OUR_COMPANY)} className="px-2 py-1.5 bg-indigo-600 text-white rounded-lg text-[8px] font-black uppercase hover:bg-indigo-700">+ Компан.</button>
                                                            <button onClick={() => openCreateForm(idx, CounterpartyType.EMPLOYEE)} className="px-2 py-1.5 bg-orange-600 text-white rounded-lg text-[8px] font-black uppercase hover:bg-orange-700">+ Сотр.</button>
                                                            <select className="flex-1 bg-slate-100 text-[9px] font-bold rounded-lg px-2 border-transparent outline-none focus:bg-white focus:border-slate-200" onChange={e => {
                                                                const cp = counterparties.find(c => c.id === e.target.value);
                                                                if (cp) { const nm = [...matches]; nm[idx] = { ...nm[idx], matchedId: cp.id, matchedType: cp.type, status: 'matched' }; setMatches(nm); }
                                                            }} value=""><option value="">Сопоставить...</option>{counterparties.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 border-y border-slate-50 text-right">
                                                    <div className={`text-sm font-black font-mono ${match.row.income > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                        {match.row.income > 0 ? '+' : '-'}{ (match.row.income || match.row.expense).toLocaleString() }
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 rounded-r-2xl border-y border-r border-slate-50 max-w-xs">
                                                    <div className="text-[10px] text-slate-500 line-clamp-2 leading-tight" title={match.row.purpose}>{match.row.purpose}</div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="p-8 bg-slate-50 border-t border-slate-200 flex justify-between items-center shrink-0">
                                <button onClick={() => setStep('upload')} className="text-xs font-black uppercase text-slate-400 hover:text-slate-600 transition-colors">Назад к выбору файла</button>
                                <button onClick={handleImport} disabled={isProcessing || matches.some(m => m.status === 'unmatched')} className="px-12 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase shadow-xl hover:bg-blue-700 disabled:opacity-30 transition-all active:scale-95">Завершить импорт</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {isCreateModalOpen && (
                <div className="fixed inset-0 bg-slate-900/90 z-[200] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                        <div className="p-6 bg-slate-50 border-b flex justify-between items-center">
                            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-3">
                                <UserPlus className="text-blue-500"/> Групповое создание контрагента
                            </h3>
                            <button onClick={() => setIsCreateModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={20}/></button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                            <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl text-[10px] font-bold text-blue-700 uppercase tracking-widest leading-relaxed">
                                <Info size={16} className="inline mr-2 mb-1"/> 
                                Это действие применится ко всем транзакциям в текущей выписке, где указан этот БИН или Наименование.
                            </div>

                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Наименование</label>
                                    <input className="w-full border-2 border-slate-100 rounded-2xl p-4 font-bold text-slate-700 focus:border-blue-500 outline-none transition-all" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Тип контрагента</label>
                                    <select className="w-full border-2 border-slate-100 rounded-2xl p-4 font-bold text-slate-700 focus:border-blue-500 outline-none transition-all" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as CounterpartyType})}>
                                        <option value={CounterpartyType.CLIENT}>Клиент</option>
                                        <option value={CounterpartyType.SUPPLIER}>Поставщик</option>
                                        <option value={CounterpartyType.EMPLOYEE}>Сотрудник</option>
                                        <option value={CounterpartyType.OUR_COMPANY}>Наша компания</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-6 p-6 bg-slate-50 rounded-[2rem] border-2 border-slate-100">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-4">Реквизиты</h4>
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">БИН / ИИН</label>
                                        <input className="w-full border border-slate-200 rounded-xl p-3 font-mono text-sm font-bold" value={formData.binIin} onChange={e => setFormData({...formData, binIin: e.target.value})} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Юр. адрес</label>
                                        <input className="w-full border border-slate-200 rounded-xl p-3 text-sm font-bold" value={formData.legalAddress} onChange={e => setFormData({...formData, legalAddress: e.target.value})} />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4 p-6 bg-slate-50 rounded-[2rem] border-2 border-slate-100">
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Банковские счета</h4>
                                    <button onClick={() => setFormData({...formData, accounts: [...formData.accounts, { id: ApiService.generateUUID(), name: '', bankName: '', iik: '', bik: '', currency: selectedCurrency, isDefault: false }]})} className="text-[9px] font-black text-blue-600 uppercase flex items-center gap-1 hover:text-blue-800 transition-colors">
                                        <PlusCircle size={14}/> Добавить счет
                                    </button>
                                </div>
                                {formData.accounts.map((acc: any, idx: number) => (
                                    <div key={acc.id} className="grid grid-cols-12 gap-3 items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm relative group">
                                        <div className="col-span-3">
                                            <input placeholder="Название счета" className="w-full text-xs font-bold p-2 bg-slate-50 rounded-lg outline-none focus:bg-white border border-transparent focus:border-blue-200" value={acc.name} onChange={e => {
                                                const newAccs = [...formData.accounts]; newAccs[idx].name = e.target.value; setFormData({...formData, accounts: newAccs});
                                            }} />
                                        </div>
                                        <div className="col-span-4">
                                            <input placeholder="ИИК (IBAN)" className="w-full text-xs font-mono font-bold p-2 bg-slate-50 rounded-lg outline-none focus:bg-white border border-transparent focus:border-blue-200" value={acc.iik} onChange={e => {
                                                const newAccs = [...formData.accounts]; newAccs[idx].iik = e.target.value; setFormData({...formData, accounts: newAccs});
                                            }} />
                                        </div>
                                        <div className="col-span-2">
                                            <input placeholder="БИК" className="w-full text-xs font-mono font-bold p-2 bg-slate-50 rounded-lg outline-none focus:bg-white border border-transparent focus:border-blue-200" value={acc.bik} onChange={e => {
                                                const newAccs = [...formData.accounts]; newAccs[idx].bik = e.target.value; setFormData({...formData, accounts: newAccs});
                                            }} />
                                        </div>
                                        <div className="col-span-2">
                                            <select className="w-full text-xs font-bold p-2 bg-slate-50 rounded-lg border-transparent" value={acc.currency} onChange={e => {
                                                const newAccs = [...formData.accounts]; newAccs[idx].currency = e.target.value; setFormData({...formData, accounts: newAccs});
                                            }}>
                                                {Object.values(Currency).map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                        </div>
                                        <div className="col-span-1 flex justify-end">
                                            <button onClick={() => setFormData({...formData, accounts: formData.accounts.filter((_:any, i:number) => i !== idx)})} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="p-8 bg-slate-50 border-t flex justify-end">
                            <button onClick={handleSaveNewCounterparty} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl hover:bg-slate-800 transition-all active:scale-95 flex items-center justify-center gap-3">
                                <Save size={20}/> Сохранить и применить ко всем строкам
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
