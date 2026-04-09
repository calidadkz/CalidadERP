
import React, { useState, useEffect, useRef } from 'react';
import { Counterparty, CounterpartyAccount, Currency, CounterpartyType } from '@/types';
import { X, Save, Trash2, PlusCircle, CheckCircle2, Star } from 'lucide-react';
import { ApiService } from '@/services/api';
import { useStore } from '@/features/system/context/GlobalStore';
import { CashFlowSelector } from '@/components/ui/CashFlowSelector';

interface CounterpartyCreateModalProps {
    onClose: () => void;
    onSubmit: (counterparty: Counterparty, accounts: CounterpartyAccount[]) => Promise<void>;
    initialType?: CounterpartyType;
    editingCounterparty?: Counterparty | null;
    initialAccounts?: CounterpartyAccount[];
    autoFillData?: {
        name?: string;
        binIin?: string;
        bankName?: string;
        bik?: string;
        iik?: string;
    };
}

export const CounterpartyCreateModal: React.FC<CounterpartyCreateModalProps> = ({
    onClose,
    onSubmit,
    initialType = CounterpartyType.CLIENT,
    editingCounterparty = null,
    initialAccounts = [],
    autoFillData
}) => {
    const api = new ApiService();
    const { state } = useStore();
    const [name, setName] = useState('');
    const [roles, setRoles] = useState<CounterpartyType[]>([initialType]);
    const [cashFlowItemIds, setCashFlowItemIds] = useState<string[]>([]);
    const [addingCashFlowItem, setAddingCashFlowItem] = useState(false);
    const [legalAddress, setLegalAddress] = useState('');
    const [binIin, setBinIin] = useState('');
    const [director, setDirector] = useState('');
    const [legalEmail, setLegalEmail] = useState('');
    const [contactPerson, setContactPerson] = useState('');
    const [phone, setPhone] = useState('');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [accounts, setAccounts] = useState<Partial<CounterpartyAccount>[]>([]);

    const isInitialized = useRef(false);

    useEffect(() => {
        if (isInitialized.current) return;

        if (editingCounterparty) {
            setName(editingCounterparty.name || '');
            setRoles(editingCounterparty.roles || [editingCounterparty.type]);
            setLegalAddress(editingCounterparty.legalAddress || '');
            setBinIin(editingCounterparty.binIin || '');
            setDirector(editingCounterparty.director || '');
            setLegalEmail(editingCounterparty.legalEmail || '');
            setContactPerson(editingCounterparty.contactPerson || '');
            setPhone(editingCounterparty.phone || '');
            setAccounts(initialAccounts.length > 0 ? initialAccounts.map(a => ({...a})) : []);
            setCashFlowItemIds(editingCounterparty.cashFlowItemIds || []);
        } else if (autoFillData) {
            // Создание нового с автозаполнением
            setName(autoFillData.name || '');
            setBinIin(autoFillData.binIin || '');
            if (autoFillData.iik || autoFillData.bankName || autoFillData.bik) {
                setAccounts([{
                    id: api.generateUUID(),
                    bankName: autoFillData.bankName || '',
                    iik: autoFillData.iik || '',
                    bik: autoFillData.bik || '',
                    currency: Currency.Kzt,
                    isDefault: true
                }]);
            }
        }
        
        isInitialized.current = true;
    }, [editingCounterparty, initialAccounts, autoFillData]);

    const toggleRole = (role: CounterpartyType) => {
        setRoles(prev => prev.includes(role) 
            ? (prev.length > 1 ? prev.filter(r => r !== role) : prev) 
            : [...prev, role]
        );
    };

    const handleAccountChange = (index: number, field: keyof CounterpartyAccount, value: any) => {
        const newAccounts = [...accounts];
        const accountToUpdate = { ...newAccounts[index] };
        (accountToUpdate as any)[field] = value;
        newAccounts[index] = accountToUpdate;
        
        if (field === 'isDefault' && value === true) {
            newAccounts.forEach((acc, i) => { if (i !== index) acc.isDefault = false; });
        }
        setAccounts(newAccounts);
    };

    const addAccountField = () => {
        setAccounts([...accounts, { id: api.generateUUID(), bankName: '', iik: '', bik: '', currency: Currency.Kzt, isDefault: accounts.length === 0 }]);
    };

    const removeAccountField = (index: number) => {
        const newAccounts = accounts.filter((_, i) => i !== index);
        if (newAccounts.length > 0 && !newAccounts.some(acc => acc.isDefault)) newAccounts[0].isDefault = true;
        setAccounts(newAccounts);
    };

    const handleSubmit = async () => {
        if (!name.trim()) { setErrorMsg('Укажите название контрагента'); return; }
        
        try {
            const cleanBinIin = binIin.trim() === '' ? undefined : binIin.trim();
            const counterpartyData: Counterparty = {
                id: editingCounterparty?.id || api.generateUUID(),
                name: name.trim(),
                type: roles[0],
                roles: roles,
                legalAddress: legalAddress.trim() || undefined,
                binIin: cleanBinIin,
                director: director.trim() || undefined,
                legalEmail: legalEmail.trim() || undefined,
                contactPerson: contactPerson.trim() || undefined,
                phone: phone.trim() || undefined,
                cashFlowItemIds: cashFlowItemIds.length > 0 ? cashFlowItemIds : undefined,
            };

            const validAccounts = (accounts as CounterpartyAccount[]).filter(a => a.iik);
            await onSubmit(counterpartyData, validAccounts);
            onClose();
        } catch (e: any) {
            setErrorMsg(`Ошибка сохранения: ${e.message}`);
        }
    };

    const roleOptions = [
        { id: CounterpartyType.CLIENT, label: 'Клиент' },
        { id: CounterpartyType.SUPPLIER, label: 'Поставщик' },
        { id: CounterpartyType.MANUFACTURER, label: 'Производитель' },
        { id: CounterpartyType.OUR_COMPANY, label: 'Наша компания' },
        { id: CounterpartyType.EMPLOYEE, label: 'Сотрудник' },
    ];

    return (
        <div className="fixed inset-0 bg-slate-900/60 z-[10001] flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl my-8 overflow-hidden border border-slate-100 animate-in zoom-in-95">
                <div className="p-6 bg-slate-50 border-b flex justify-between items-center sticky top-0 z-10">
                    <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">{editingCounterparty ? 'Редактировать' : 'Новый'} контрагент</h3>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 transition-colors"><X size={20}/></button>
                </div>
                
                <div className="p-8 space-y-8 overflow-y-auto max-h-[calc(90vh-100px)] custom-scrollbar">
                    <div className="space-y-6">
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Название <span className="text-red-500">*</span></label>
                            <input className="w-full border-2 border-slate-100 rounded-2xl p-4 font-bold text-slate-700 bg-slate-50/50 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all" value={name} onChange={e => setName(e.target.value)} placeholder="Наименование организации или ФИО" />
                        </div>
                        
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Роли контрагента (можно выбрать несколько)</label>
                            <div className="flex flex-wrap gap-3">
                                {roleOptions.map(role => (
                                    <button 
                                        key={role.id}
                                        onClick={() => toggleRole(role.id)}
                                        className={`px-6 py-3 rounded-xl border-2 font-black uppercase text-[10px] tracking-widest transition-all flex items-center gap-2 ${roles.includes(role.id) ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'}`}
                                    >
                                        {roles.includes(role.id) && <CheckCircle2 size={14}/>}
                                        {role.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4 p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 pb-2 border-b border-slate-200 mb-4">Контактные данные</h4>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 ml-1">ФИО представителя</label>
                                    <input className="w-full border border-slate-200 rounded-xl p-3 text-sm font-bold bg-white" value={contactPerson} onChange={e => setContactPerson(e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 ml-1">Телефон</label>
                                    <input className="w-full border border-slate-200 rounded-xl p-3 text-sm font-bold bg-white" value={phone} onChange={e => setPhone(e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 ml-1">Email</label>
                                    <input type="email" className="w-full border border-slate-200 rounded-xl p-3 text-sm font-bold bg-white" value={legalEmail} onChange={e => setLegalEmail(e.target.value)} />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4 p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 pb-2 border-b border-slate-200 mb-4">Реквизиты</h4>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 ml-1">БИН / ИИН</label>
                                    <input className="w-full border border-slate-200 rounded-xl p-3 text-sm font-bold bg-white font-mono" value={binIin} onChange={e => setBinIin(e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 ml-1">Директор</label>
                                    <input className="w-full border border-slate-200 rounded-xl p-3 text-sm font-bold bg-white" value={director} onChange={e => setDirector(e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 ml-1">Юридический адрес</label>
                                    <textarea className="w-full border border-slate-200 rounded-xl p-3 text-sm font-bold bg-white h-20 resize-none" value={legalAddress} onChange={e => setLegalAddress(e.target.value)} />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 p-6 bg-indigo-50/30 rounded-[2rem] border border-indigo-100/50">
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Банковские счета</h4>
                            <button onClick={addAccountField} className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-indigo-600 bg-white px-4 py-2 rounded-lg border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all"><PlusCircle size={14} /> Добавить счет</button>
                        </div>
                        {accounts.map((acc, index) => (
                            <div key={acc.id || index} className="grid grid-cols-11 gap-3 items-center bg-white p-4 rounded-2xl border border-indigo-100 shadow-sm">
                                <div className="col-span-3">
                                    <label className="text-[7px] font-black text-slate-400 uppercase mb-1 block">Название банка</label> 
                                    <input placeholder="Напр: Kaspi, Halyk..." className="w-full text-xs font-bold p-2 bg-slate-50 rounded-lg outline-none border border-transparent focus:border-indigo-200" value={acc.bankName || ''} onChange={e => handleAccountChange(index, 'bankName', e.target.value)} />
                                </div>
                                <div className="col-span-2"> 
                                    <label className="text-[7px] font-black text-slate-400 uppercase mb-1 block">БИК банка</label>
                                    <input placeholder="Напр: HSBKKZKX" className="w-full text-xs font-bold p-2 bg-slate-50 rounded-lg outline-none border border-transparent focus:border-indigo-200" value={acc.bik || ''} onChange={e => handleAccountChange(index, 'bik', e.target.value)} />
                                </div>
                                <div className="col-span-3">
                                    <label className="text-[7px] font-black text-slate-400 uppercase mb-1 block">ИИК (IBAN)</label>
                                    <input placeholder="KZ..." className="w-full text-[10px] font-bold p-2 font-mono bg-slate-50 rounded-lg outline-none border border-transparent focus:border-indigo-200" value={acc.iik || ''} onChange={e => handleAccountChange(index, 'iik', e.target.value)} />
                                </div>
                                <div className="col-span-1">
                                    <label className="text-[7px] font-black text-slate-400 uppercase mb-1 block">Валюта</label>
                                    <select className="w-full text-[10px] font-bold p-2 bg-slate-50 rounded-lg border-transparent" value={acc.currency || Currency.Kzt} onChange={e => handleAccountChange(index, 'currency', e.target.value as Currency)}>
                                        <option value={Currency.Kzt}>KZT</option><option value={Currency.Usd}>USD</option><option value={Currency.Cny}>CNY</option><option value={Currency.Rub}>RUB</option>
                                    </select>
                                </div>
                                <div className="col-span-1 flex flex-col items-center">
                                    <label className="text-[7px] font-black text-slate-400 uppercase mb-1 block">Осн.</label>
                                    <input type="checkbox" className="h-5 w-5 rounded-md border-slate-300 text-indigo-600 focus:ring-0 cursor-pointer" checked={acc.isDefault || false} onChange={e => handleAccountChange(index, 'isDefault', e.target.checked)} />
                                </div>
                                <div className="col-span-1 flex justify-end gap-1"> 
                                    <button onClick={() => removeAccountField(index)} className="p-2 text-slate-300 hover:text-red-500 transition-all"><Trash2 size={18} /></button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Приоритетные статьи ДДС */}
                    <div className="space-y-3 p-6 bg-amber-50/40 rounded-[2rem] border border-amber-100/70">
                        <div className="flex justify-between items-center">
                            <h4 className="text-[10px] font-black text-amber-700 uppercase tracking-widest flex items-center gap-2">
                                <Star size={12} fill="currentColor" /> Приоритетные статьи ДДС
                            </h4>
                            <span className="text-[9px] text-slate-400 font-bold">Первая — автовыбор при импорте выписок</span>
                        </div>

                        {cashFlowItemIds.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {cashFlowItemIds.map((id, idx) => {
                                    const item = state.cashFlowItems.find(x => x.id === id);
                                    if (!item) return null;
                                    return (
                                        <div key={id} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-amber-200 rounded-xl text-[11px] font-bold text-slate-700 shadow-sm">
                                            {idx === 0 && <Star size={9} fill="#f59e0b" className="text-amber-400 shrink-0" />}
                                            <span className="truncate max-w-[200px]">{item.name}</span>
                                            <button
                                                type="button"
                                                onClick={() => setCashFlowItemIds(prev => prev.filter(x => x !== id))}
                                                className="ml-1 text-slate-300 hover:text-red-500 transition-colors shrink-0"
                                            >
                                                <X size={11} />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {addingCashFlowItem ? (
                            <div className="flex items-center gap-2">
                                <div className="flex-1">
                                    <CashFlowSelector
                                        value=""
                                        onChange={id => {
                                            if (id && !cashFlowItemIds.includes(id)) {
                                                setCashFlowItemIds(prev => [...prev, id]);
                                            }
                                            setAddingCashFlowItem(false);
                                        }}
                                        placeholder="— Выберите статью ДДС —"
                                        dropdownMinWidth={320}
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setAddingCashFlowItem(false)}
                                    className="p-2 text-slate-300 hover:text-slate-500 transition-colors"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setAddingCashFlowItem(true)}
                                className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-amber-700 bg-white px-4 py-2 rounded-lg border border-amber-200 hover:bg-amber-600 hover:text-white hover:border-amber-600 transition-all"
                            >
                                <PlusCircle size={13} /> Добавить статью
                            </button>
                        )}
                    </div>

                    {errorMsg && <p className="text-red-500 text-[10px] font-black uppercase text-center bg-red-50 p-4 rounded-xl border border-red-100">{errorMsg}</p>}

                    <div className="pt-4 sticky bottom-0 bg-white pb-2">
                        <button onClick={handleSubmit} className="w-full bg-slate-900 text-white py-5 rounded-[2rem] font-black uppercase tracking-widest shadow-xl shadow-slate-200 hover:bg-slate-800 active:scale-95 transition-all flex items-center justify-center gap-3">
                            <Save size={20}/> {editingCounterparty ? 'Сохранить изменения' : 'Создать контрагента'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
