import React, { useState, useMemo, useEffect } from 'react';
import { ActualPayment, Currency, PlannedPayment, BankAccount, Client, Supplier, PaymentAllocation, Batch, Counterparty, CounterpartyAccount, CounterpartyType } from '@/types';
import { X, AlertCircle, Landmark, Plus, Trash2, UserPlus, Tag, Receipt, Paperclip, Upload, Loader2, CheckCircle } from 'lucide-react';
import { CalidadSelect, CalidadSelectOption } from '@/components/ui/CalidadSelect';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/services/firebase';
import { CashFlowSelector } from '@/components/ui/CashFlowSelector';
import { ApiService } from '@/services/api';
import { TableNames } from '@/constants';
import { CounterpartyCreateModal } from '@/features/counterparties/components/CounterpartyCreateModal';
import { useStore } from '@/features/system/context/GlobalStore';

interface PaymentModalProps {
    direction: 'Incoming' | 'Outgoing';
    plan?: PlannedPayment | null;
    bankAccounts: BankAccount[];
    clients: Client[];
    suppliers: Supplier[];
    onClose: () => void;
    onSubmit: (payment: ActualPayment) => void;
}

// Строка распределения внутри платежа
interface AllocLine {
    id: string;
    plannedPaymentId?: string;
    cashFlowItemId?: string;
    amount: number;
    description?: string;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
    direction, plan, bankAccounts, clients: initialClients, suppliers: initialSuppliers, onClose, onSubmit
}) => {
    const { state } = useStore();
    const { plannedPayments } = state;

    // --- Основные поля платежа ---
    const [counterpartyId, setCounterpartyId] = useState(plan?.counterpartyId || '');
    const [currency, setCurrency] = useState<Currency>(plan?.currency || Currency.Usd);
    const [amount, setAmount] = useState(plan ? (plan.amountDue - (plan.amountPaid || 0)) : 0);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [accountId, setAccountId] = useState('');

    // --- Доп. поля выписки (сворачиваемые) ---
    const [showDetails, setShowDetails] = useState(false);
    const [docNum, setDocNum] = useState('');
    const [knp, setKnp] = useState('');
    const [purpose, setPurpose] = useState('');
    const [cpBin, setCpBin] = useState('');
    const [cpIik, setCpIik] = useState('');

    // --- Строки распределения ---
    const [lines, setLines] = useState<AllocLine[]>([]);

    // ID платежа генерируется заранее, чтобы использовать в пути загрузки файла
    const [paymentId] = useState(() => ApiService.generateId('TX'));

    // --- Прикреплённый документ (чек, скан) ---
    const [receiptFile, setReceiptFile] = useState<File | null>(null);
    const [receiptUrl, setReceiptUrl] = useState<string>('');
    const [isUploading, setIsUploading] = useState(false);

    const [batches, setBatches] = useState<Batch[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [localClients, setLocalClients] = useState<Client[]>(initialClients);
    const [localSuppliers, setLocalSuppliers] = useState<Supplier[]>(initialSuppliers);
    const [isCounterpartyModalOpen, setIsCounterpartyModalOpen] = useState(false);

    // Планы доступные для привязки
    const availablePlans = useMemo(() =>
        plannedPayments.filter(p =>
            !p.isPaid &&
            p.direction === direction &&
            (counterpartyId ? p.counterpartyId === counterpartyId : true) &&
            p.currency === currency
        ), [plannedPayments, direction, counterpartyId, currency]);

    // Приоритетные статьи выбранного контрагента
    const priorityItemIds = useMemo(() => {
        const all = [...localClients, ...localSuppliers, ...state.counterparties];
        return all.find(c => c.id === counterpartyId)?.cashFlowItemIds || [];
    }, [counterpartyId, localClients, localSuppliers, state.counterparties]);

    // Дефолтный счёт при смене валюты
    useEffect(() => {
        const match = bankAccounts.find(a => a.currency === currency);
        setAccountId(match?.id || '');
    }, [currency, bankAccounts]);

    // Синхронизация списков
    useEffect(() => { setLocalClients(initialClients); }, [initialClients]);
    useEffect(() => { setLocalSuppliers(initialSuppliers); }, [initialSuppliers]);

    // Инициализация строк
    useEffect(() => {
        ApiService.fetchAll<Batch>(TableNames.BATCHES).then(bs => setBatches(bs.filter(b => b.status !== 'completed')));

        if (plan) {
            setLines([{
                id: ApiService.generateId('AL'),
                plannedPaymentId: plan.id,
                cashFlowItemId: plan.cashFlowItemId,
                amount: plan.amountDue - (plan.amountPaid || 0),
            }]);
        } else {
            setLines([{ id: ApiService.generateId('AL'), cashFlowItemId: '', amount: 0 }]);
        }
    }, [plan]);

    // Автосинхронизация одиночной строки с суммой
    useEffect(() => {
        if (lines.length === 1 && amount > 0 && !lines[0].plannedPaymentId) {
            setLines(prev => [{ ...prev[0], amount }]);
        }
    }, [amount]);

    const totalAllocated = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
    const isBalanced = Math.abs(totalAllocated - amount) < 0.01;

    const addLine = () => setLines(prev => [...prev, { id: ApiService.generateId('AL'), cashFlowItemId: '', amount: Math.max(0, amount - totalAllocated) }]);
    const removeLine = (id: string) => { if (lines.length > 1) setLines(prev => prev.filter(l => l.id !== id)); };

    const updateLine = (id: string, key: keyof AllocLine, value: any) => {
        setLines(prev => prev.map(l => {
            if (l.id !== id) return l;
            const updated = { ...l, [key]: value };
            if (key === 'plannedPaymentId' && value) {
                const pp = plannedPayments.find(p => p.id === value);
                if (pp) {
                    updated.cashFlowItemId = pp.cashFlowItemId;
                    updated.amount = pp.amountDue - (pp.amountPaid || 0);
                    if (!counterpartyId) setCounterpartyId(pp.counterpartyId);
                }
            }
            return updated;
        }));
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setReceiptFile(file);
        setIsUploading(true);
        try {
            const storageRef = ref(storage, `payment-receipts/${paymentId}/${file.name}`);
            const snapshot = await uploadBytes(storageRef, file);
            const url = await getDownloadURL(snapshot.ref);
            setReceiptUrl(url);
        } catch {
            setError('Ошибка загрузки файла. Попробуйте ещё раз.');
            setReceiptFile(null);
        } finally {
            setIsUploading(false);
            e.target.value = '';
        }
    };

    const handleSave = () => {
        setError(null);
        if (!counterpartyId) { setError('Укажите контрагента'); return; }
        if (!accountId) { setError('Выберите счёт'); return; }
        if (amount <= 0) { setError('Укажите сумму'); return; }
        if (!isBalanced) { setError(`Сумма строк (${totalAllocated}) ≠ сумме платежа (${amount})`); return; }
        if (lines.some(l => !l.cashFlowItemId)) { setError('Выберите статью ДДС для всех строк'); return; }

        const account = bankAccounts.find(a => a.id === accountId);
        if (!account) return;
        const cp = [...localClients, ...localSuppliers].find(c => c.id === counterpartyId);

        onSubmit({
            id: paymentId,
            direction,
            date,
            counterpartyId,
            counterpartyName: cp?.name || '—',
            amount,
            currency,
            bankAccountId: account.id,
            fromAccount: `${account.bank} ${account.number}`,
            exchangeRate: 1,
            allocations: lines.map(l => ({
                id: l.id,
                actualPaymentId: '',
                plannedPaymentId: l.plannedPaymentId,
                cashFlowItemId: l.cashFlowItemId || '',
                amountCovered: Number(l.amount),
                description: l.description,
            } as PaymentAllocation)),
            documentNumber: docNum || undefined,
            knp: knp || undefined,
            purpose: purpose || undefined,
            counterpartyBinIin: cpBin || undefined,
            counterpartyIik: cpIik || undefined,
            receiptUrl: receiptUrl || undefined,
        });
    };

    const handleCreateCounterparty = async (cp: Counterparty, accounts: CounterpartyAccount[]) => {
        const { saved } = await ApiService.createCounterpartyWithAccount(cp, accounts[0] || {});
        if (saved) {
            if (saved.type === CounterpartyType.CLIENT) setLocalClients(prev => [...prev, saved as Client]);
            else setLocalSuppliers(prev => [...prev, saved as Supplier]);
            setCounterpartyId(saved.id);
            setIsCounterpartyModalOpen(false);
        }
    };

    const f = (v: number) => v.toLocaleString('ru-RU');
    const isOutgoing = direction === 'Outgoing';

    return (
        <>
            <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-[2px] flex items-center justify-center z-[110] p-3 xl:p-4">
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl xl:max-w-2xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">

                    {/* Шапка */}
                    <div className="px-6 py-4 border-b bg-slate-50 flex justify-between items-center flex-none">
                        <div className="flex items-center gap-3">
                            <div className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border ${isOutgoing ? 'bg-red-50 text-red-600 border-red-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                                {isOutgoing ? 'Расход' : 'Приход'}
                            </div>
                            <h3 className="font-black text-slate-800 uppercase tracking-tight text-sm">
                                {plan ? 'Исполнение плана' : 'Новый платёж'}
                            </h3>
                        </div>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {error && (
                            <div className="mx-6 mt-4 bg-red-50 border border-red-100 p-3 rounded-xl flex items-center gap-2 text-red-600 text-xs font-bold">
                                <AlertCircle size={14}/> {error}
                            </div>
                        )}

                        {/* Основные поля — компактная строка */}
                        <div className="px-6 pt-5 pb-4 space-y-4">
                            <div className="grid grid-cols-12 gap-3">
                                {/* Контрагент */}
                                <div className="col-span-5">
                                    <label className="block text-[11px] font-black text-slate-500 uppercase mb-1 tracking-widest">Контрагент</label>
                                    <div className="flex gap-1.5">
                                        <select
                                            className="flex-1 border border-slate-200 p-2 rounded-xl text-xs font-bold bg-white outline-none disabled:bg-slate-50"
                                            value={counterpartyId}
                                            onChange={e => setCounterpartyId(e.target.value)}
                                            disabled={!!plan}
                                        >
                                            <option value="">— Выберите —</option>
                                            {(isOutgoing ? localSuppliers : localClients).map(c =>
                                                <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                        {!plan && (
                                            <button onClick={() => setIsCounterpartyModalOpen(true)} className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 hover:bg-blue-600 hover:text-white transition-all" title="Создать контрагента">
                                                <UserPlus size={14}/>
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Дата */}
                                <div className="col-span-3">
                                    <label className="block text-[11px] font-black text-slate-500 uppercase mb-1 tracking-widest">Дата</label>
                                    <input type="date" className="w-full border border-slate-200 p-2 rounded-xl text-xs font-bold bg-white outline-none" value={date} onChange={e => setDate(e.target.value)}/>
                                </div>

                                {/* Валюта */}
                                <div className="col-span-2">
                                    <label className="block text-[11px] font-black text-slate-500 uppercase mb-1 tracking-widest">Валюта</label>
                                    <select className="w-full border border-slate-200 p-2 rounded-xl text-xs font-black bg-white outline-none" value={currency} onChange={e => setCurrency(e.target.value as Currency)} disabled={!!plan}>
                                        {Object.values(Currency).map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>

                                {/* Сумма */}
                                <div className="col-span-2">
                                    <label className="block text-[11px] font-black text-slate-500 uppercase mb-1 tracking-widest">Сумма</label>
                                    <input
                                        type="number"
                                        className="w-full border border-slate-200 p-2 rounded-xl text-sm font-black text-slate-900 outline-none"
                                        value={amount || ''}
                                        onChange={e => setAmount(parseFloat(e.target.value) || 0)}
                                    />
                                </div>
                            </div>

                            {/* Счёт — выпадающий список */}
                            <div>
                                <label className="block text-[11px] font-black text-slate-500 uppercase mb-1.5 tracking-widest flex items-center gap-1"><Landmark size={10}/> Счёт</label>
                                <CalidadSelect
                                    options={bankAccounts
                                        .filter(a => a.currency === currency)
                                        .map(a => ({
                                            id: a.id,
                                            label: `${a.name} · ${a.bank}`,
                                            sub: `№${a.number} · ${f(a.balance)} ${a.currency}`,
                                        } as CalidadSelectOption))}
                                    value={accountId}
                                    onChange={setAccountId}
                                    placeholder="Выберите счёт"
                                    nullLabel={null}
                                    zIndex="z-[200]"
                                />
                            </div>
                        </div>

                        {/* Разделитель */}
                        <div className="border-t border-slate-100 mx-6"/>

                        {/* Строки распределения */}
                        <div className="px-6 py-4 space-y-2">
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><Tag size={10}/> Распределение</label>
                                <button onClick={addLine} className="flex items-center gap-1 text-[11px] font-black uppercase text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg hover:bg-indigo-100 transition-all">
                                    <Plus size={11}/> Добавить строку
                                </button>
                            </div>

                            {lines.map((line, idx) => (
                                <div key={line.id} className="flex items-start gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                                    {/* Привязка к плану (опционально) */}
                                    <div className="flex-1 space-y-1.5">
                                        {availablePlans.length > 0 && (
                                            <div className="flex items-center gap-1.5">
                                                <Receipt size={11} className="text-slate-300 shrink-0"/>
                                                <select
                                                    className="flex-1 bg-white border border-slate-200 rounded-lg px-2 py-1 text-[10px] font-bold outline-none"
                                                    value={line.plannedPaymentId || ''}
                                                    onChange={e => updateLine(line.id, 'plannedPaymentId', e.target.value)}
                                                >
                                                    <option value="">— Без привязки к плану —</option>
                                                    {availablePlans.map(p => (
                                                        <option key={p.id} value={p.id}>
                                                            {p.sourceDocId} • {f(p.amountDue - p.amountPaid)} {p.currency}
                                                        </option>
                                                    ))}
                                                </select>
                                                {line.plannedPaymentId && (
                                                    <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 whitespace-nowrap">↔ план</span>
                                                )}
                                            </div>
                                        )}

                                        <CashFlowSelector
                                            value={line.cashFlowItemId || ''}
                                            onChange={id => updateLine(line.id, 'cashFlowItemId', id)}
                                            direction={isOutgoing ? 'Outgoing' : 'Incoming'}
                                            disabled={!!line.plannedPaymentId}
                                            dropdownMinWidth={260}
                                            priorityItemIds={priorityItemIds}
                                        />
                                    </div>

                                    {/* Сумма */}
                                    <input
                                        type="number"
                                        className="w-24 shrink-0 bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-xs font-black text-right outline-none"
                                        value={line.amount || ''}
                                        onChange={e => updateLine(line.id, 'amount', parseFloat(e.target.value) || 0)}
                                    />

                                    {/* Удалить */}
                                    {lines.length > 1 && (
                                        <button onClick={() => removeLine(line.id)} className="shrink-0 text-slate-300 hover:text-red-500 mt-1 transition-colors">
                                            <Trash2 size={14}/>
                                        </button>
                                    )}
                                </div>
                            ))}

                            {/* Баланс */}
                            <div className={`flex items-center justify-between px-4 py-2.5 rounded-2xl border-2 transition-all ${isBalanced ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}`}>
                                <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">Итого</span>
                                <div className="text-right">
                                    <span className={`text-sm font-black font-mono ${isBalanced ? 'text-emerald-700' : 'text-amber-700'}`}>{f(totalAllocated)}</span>
                                    <span className="text-xs text-slate-400 ml-1">/ {f(amount)} {currency}</span>
                                </div>
                                {!isBalanced && (
                                    <span className="text-[11px] font-black text-amber-600 flex items-center gap-1 ml-2">
                                        <AlertCircle size={12}/> Δ {f(amount - totalAllocated)}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Прикреплённый документ */}
                        <div className="px-6 pb-3">
                            <div className="flex items-center gap-3">
                                <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1 shrink-0">
                                    <Paperclip size={10}/> Документ
                                </span>
                                {receiptUrl ? (
                                    <div className="flex items-center gap-2 min-w-0">
                                        <a href={receiptUrl} target="_blank" rel="noopener noreferrer"
                                           className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:text-emerald-800 truncate max-w-[220px]">
                                            <CheckCircle size={11} className="shrink-0"/>{receiptFile?.name || 'Документ загружен'}
                                        </a>
                                        <button onClick={() => { setReceiptUrl(''); setReceiptFile(null); }}
                                                className="text-slate-300 hover:text-red-500 transition-colors shrink-0" title="Удалить">
                                            <X size={12}/>
                                        </button>
                                    </div>
                                ) : isUploading ? (
                                    <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                                        <Loader2 size={11} className="animate-spin"/> Загрузка...
                                    </span>
                                ) : (
                                    <label className="flex items-center gap-1.5 text-[11px] font-black text-blue-600 cursor-pointer hover:text-blue-800 transition-colors">
                                        <Upload size={11}/> Прикрепить файл
                                        <input
                                            type="file"
                                            className="hidden"
                                            accept="image/*,.pdf,.txt,.doc,.docx,.csv,.xlsx,.xls"
                                            onChange={handleFileSelect}
                                        />
                                    </label>
                                )}
                            </div>
                        </div>

                        {/* Детали выписки — сворачиваемые */}
                        <div className="px-6 pb-4">
                            <button
                                onClick={() => setShowDetails(v => !v)}
                                className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 hover:text-slate-600 transition-colors"
                            >
                                <span className={`transition-transform ${showDetails ? 'rotate-90' : ''}`}>▶</span>
                                Реквизиты выписки (№ документа, КНП, БИН...)
                            </button>
                            {showDetails && (
                                <div className="mt-3 grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2 duration-150">
                                    {[
                                        { label: '№ документа', val: docNum, set: setDocNum },
                                        { label: 'КНП', val: knp, set: setKnp },
                                        { label: 'БИН/ИИН', val: cpBin, set: setCpBin },
                                        { label: 'ИИК', val: cpIik, set: setCpIik },
                                    ].map(({ label, val, set }) => (
                                        <div key={label}>
                                            <label className="block text-[11px] font-black text-slate-500 uppercase mb-1">{label}</label>
                                            <input className="w-full border border-slate-100 bg-slate-50 p-2 rounded-xl text-xs font-mono outline-none" value={val} onChange={e => set(e.target.value)}/>
                                        </div>
                                    ))}
                                    <div className="col-span-2">
                                        <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">Назначение платежа</label>
                                        <input className="w-full border border-slate-100 bg-slate-50 p-2 rounded-xl text-xs outline-none" value={purpose} onChange={e => setPurpose(e.target.value)}/>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Подвал */}
                    <div className="px-6 py-4 border-t bg-slate-50 flex justify-end flex-none">
                        <button
                            onClick={handleSave}
                            disabled={!isBalanced || amount <= 0}
                            className={`px-12 py-3.5 rounded-2xl text-white font-black uppercase text-sm tracking-widest shadow-xl transition-all active:scale-95 disabled:opacity-30 disabled:grayscale ${isOutgoing ? 'bg-slate-900 hover:bg-slate-800' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                        >
                            Провести платёж
                        </button>
                    </div>
                </div>
            </div>

            {isCounterpartyModalOpen && (
                <CounterpartyCreateModal
                    onClose={() => setIsCounterpartyModalOpen(false)}
                    initialType={isOutgoing ? CounterpartyType.SUPPLIER : CounterpartyType.CLIENT}
                    onSubmit={handleCreateCounterparty}
                />
            )}
        </>
    );
};
