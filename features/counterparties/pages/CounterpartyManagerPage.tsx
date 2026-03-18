import React, { useState, useMemo } from 'react';
import { useStore } from '@/features/system/context/GlobalStore';
import { Counterparty, CounterpartyAccount, Currency, CounterpartyType } from '@/types';
import { Users, Briefcase, Truck, Plus, X, Pencil, Search, Phone, User, Trash2, Save, Factory, Building2, UserCircle, PlusCircle } from 'lucide-react';
import { useAccess } from '@/features/auth/hooks/useAccess';
import { ApiService } from '@/services/api';

const getCounterpartyTypeTranslation = (type: CounterpartyType) => {
    const translations: Record<CounterpartyType, string> = {
        [CounterpartyType.CLIENT]: 'Клиент',
        [CounterpartyType.SUPPLIER]: 'Поставщик',
        [CounterpartyType.EMPLOYEE]: 'Сотрудник',
        [CounterpartyType.OUR_COMPANY]: 'Наша компания',
        [CounterpartyType.MANUFACTURER]: 'Производитель',
    };
    return translations[type] || 'Контрагент';
};

const CounterpartyTypeIcon = ({ type }: { type: CounterpartyType }) => {
    const icons: Record<CounterpartyType, React.ReactNode> = {
        [CounterpartyType.CLIENT]: <Briefcase size={14} className="text-emerald-500"/>,
        [CounterpartyType.SUPPLIER]: <Truck size={14} className="text-blue-500"/>,
        [CounterpartyType.EMPLOYEE]: <UserCircle size={14} className="text-orange-500"/>,
        [CounterpartyType.OUR_COMPANY]: <Building2 size={14} className="text-indigo-500"/>,
        [CounterpartyType.MANUFACTURER]: <Factory size={14} className="text-purple-500"/>,
    };
    return <>{icons[type]}</>;
};

export const CounterpartyManagerPage: React.FC = () => {
    const { state, actions } = useStore();
    const access = useAccess('counterparties');

    const [activeTab, setActiveTab] = useState<CounterpartyType | 'all'>('all');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCounterparty, setEditingCounterparty] = useState<Counterparty | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<Counterparty | null>(null);

    const [name, setName] = useState('');
    const [type, setType] = useState<CounterpartyType>(CounterpartyType.SUPPLIER);
    const [legalAddress, setLegalAddress] = useState('');
    const [binIin, setBinIin] = useState('');
    const [director, setDirector] = useState('');
    const [legalEmail, setLegalEmail] = useState('');
    const [contactPerson, setContactPerson] = useState('');
    const [phone, setPhone] = useState('');
    const [accounts, setAccounts] = useState<Partial<CounterpartyAccount>[]>([]);

    const resetForm = () => {
        setEditingCounterparty(null);
        setName('');
        setType(CounterpartyType.SUPPLIER);
        setLegalAddress('');
        setBinIin('');
        setDirector('');
        setLegalEmail('');
        setContactPerson('');
        setPhone('');
        setAccounts([]);
        setErrorMsg(null);
    };

    const openCreateModal = () => {
        if (!access.canWrite('actions', 'manage')) return;
        resetForm();
        setType(activeTab !== 'all' ? activeTab : CounterpartyType.SUPPLIER);
        setAccounts([{ id: new ApiService().generateUUID(), name: 'Основной', bankName: '', iik: '', bik: '', currency: Currency.KZT, isDefault: true }]);
        setIsModalOpen(true);
    };

    const openEditModal = (cp: Counterparty) => {
        if (!access.canSee('actions', 'edit')) return;
        resetForm();
        setEditingCounterparty(cp);
        setName(cp.name);
        setType(cp.type);
        setLegalAddress(cp.legalAddress || '');
        setBinIin(cp.binIin || '');
        setDirector(cp.director || '');
        setLegalEmail(cp.legalEmail || '');
        setContactPerson(cp.contactPerson || '');
        setPhone(cp.phone || '');
        
        const cpAccounts = state.counterpartyAccounts.filter(acc => acc.counterpartyId === cp.id);
        setAccounts(cpAccounts.length > 0 ? cpAccounts.map(a => ({...a})) : [{ id: new ApiService().generateUUID(), name: 'Основной', bankName: '', iik: '', bik: '', currency: Currency.KZT, isDefault: true }]);
        
        setIsModalOpen(true);
    };

    const handleAccountChange = (index: number, field: keyof CounterpartyAccount, value: any) => {
        const newAccounts = [...accounts];
        const accountToUpdate = { ...newAccounts[index] };
        (accountToUpdate as any)[field] = value;
        newAccounts[index] = accountToUpdate;
        
        if (field === 'isDefault' && value === true) {
            for (let i = 0; i < newAccounts.length; i++) {
                if (i !== index) {
                    newAccounts[i].isDefault = false;
                }
            }
        }
        setAccounts(newAccounts);
    };

    const addAccountField = () => {
        setAccounts([...accounts, { id: new ApiService().generateUUID(), name: '', bankName: '', iik: '', bik: '', currency: Currency.KZT, isDefault: accounts.length === 0 }]);
    };

    const removeAccountField = (index: number) => {
        const newAccounts = accounts.filter((_, i) => i !== index);
        if (newAccounts.length > 0 && !newAccounts.some(acc => acc.isDefault)) {
            newAccounts[0].isDefault = true;
        }
        setAccounts(newAccounts);
    };

    const handleSubmit = async () => {
        if (!name) { setErrorMsg('Укажите название контрагента'); return; }

        const canWrite = editingCounterparty ? access.canWrite('actions', 'edit') : access.canWrite('actions', 'manage');
        if (!canWrite) return;

        try {
            const counterpartyData = {
                id: editingCounterparty?.id || new ApiService().generateUUID(),
                name,
                type,
                legalAddress,
                binIin,
                director,
                legalEmail,
                contactPerson,
                phone
            };

            if (editingCounterparty) {
                await actions.updateCounterparty(counterpartyData as Counterparty, accounts as CounterpartyAccount[]);
            } else {
                await actions.addCounterparty(counterpartyData as Counterparty, accounts[0]);
            }

            setIsModalOpen(false);
            resetForm();
        } catch (e: any) {
            setErrorMsg(`Ошибка сохранения: ${e.message}`);
        }
    };

    const filteredCounterparties = useMemo(() => {
        let data = state.counterparties;
        if (activeTab !== 'all') {
            data = data.filter(cp => cp.type === activeTab);
        }
        if (searchTerm) {
            const lowerSearch = searchTerm.toLowerCase();
            data = data.filter(cp => 
                cp.name.toLowerCase().includes(lowerSearch) ||
                (cp.binIin || '').includes(lowerSearch) ||
                (cp.contactPerson || '').toLowerCase().includes(lowerSearch)
            );
        }
        return data;
    }, [state.counterparties, activeTab, searchTerm]);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center"><Users className="mr-3 text-blue-600" size={28} /> Контрагенты</h2>
                    <p className="text-slate-500 text-sm font-medium mt-1">Единая база всех партнеров, клиентов и сотрудников</p>
                </div>
                {access.canWrite('actions', 'manage') && (
                    <button onClick={openCreateModal} className="flex items-center px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all active:scale-95 font-black uppercase text-xs tracking-widest">
                        <Plus size={18} className="mr-2" /> Добавить
                    </button>
                )}
            </div>

            {/* Tabs */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex bg-slate-100 p-1 rounded-xl w-full md:w-auto overflow-x-auto">
                    <button onClick={() => setActiveTab('all')} className={`flex-1 md:flex-none flex items-center px-6 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === 'all' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>Все</button>
                    <button onClick={() => setActiveTab(CounterpartyType.SUPPLIER)} className={`flex-1 md:flex-none flex items-center px-6 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === CounterpartyType.SUPPLIER ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}><Truck size={14} className="mr-2"/> Поставщики</button>
                    <button onClick={() => setActiveTab(CounterpartyType.CLIENT)} className={`flex-1 md:flex-none flex items-center px-6 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === CounterpartyType.CLIENT ? 'bg-white shadow text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}><Briefcase size={14} className="mr-2"/> Клиенты</button>
                    <button onClick={() => setActiveTab(CounterpartyType.MANUFACTURER)} className={`flex-1 md:flex-none flex items-center px-6 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === CounterpartyType.MANUFACTURER ? 'bg-white shadow text-purple-600' : 'text-slate-500 hover:text-slate-700'}`}><Factory size={14} className="mr-2"/> Производители</button>
                    <button onClick={() => setActiveTab(CounterpartyType.OUR_COMPANY)} className={`flex-1 md:flex-none flex items-center px-6 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === CounterpartyType.OUR_COMPANY ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}><Building2 size={14} className="mr-2"/> Наши компании</button>
                    <button onClick={() => setActiveTab(CounterpartyType.EMPLOYEE)} className={`flex-1 md:flex-none flex items-center px-6 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === CounterpartyType.EMPLOYEE ? 'bg-white shadow text-orange-600' : 'text-slate-500 hover:text-slate-700'}`}><UserCircle size={14} className="mr-2"/> Сотрудники</button>
                </div>
                <div className="relative w-full md:w-80">
                    <Search className="absolute left-3 top-2.5 text-slate-400" size={18}/>
                    <input type="text" placeholder="Поиск по названию, БИН, контакту..." className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-blue-500/10 font-bold text-sm transition-all" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
                <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-slate-50/50">
                        <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            <th className="px-6 py-4 text-left">Название</th>
                            <th className="px-6 py-4 text-left">Тип</th>
                            <th className="px-6 py-4 text-left">Контакты</th>
                            <th className="px-6 py-4 text-left">БИН/ИИН</th>
                            <th className="px-6 py-4 text-right"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 bg-white">
                        {filteredCounterparties.length === 0 ? (
                            <tr><td colSpan={5} className="p-12 text-center text-slate-300 italic font-medium">Контрагенты не найдены</td></tr>
                        ) : (
                            filteredCounterparties.map(cp => (
                                <tr key={cp.id} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="px-6 py-4"><div className="text-sm font-black text-slate-800">{cp.name}</div></td>
                                    <td className="px-6 py-4"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest"><CounterpartyTypeIcon type={cp.type} /> <span className="text-slate-500">{getCounterpartyTypeTranslation(cp.type)}</span></div></td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-500"><User size={14} className="text-slate-300"/> {cp.contactPerson || '—'}</div>
                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-400"><Phone size={14} className="text-slate-300"/> {cp.phone || '—'}</div>
                                    </td>
                                    <td className="px-6 py-4"><div className="text-sm font-mono text-slate-500">{cp.binIin || '—'}</div></td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {access.canSee('actions', 'edit') && <button onClick={() => openEditModal(cp)} className="p-2 text-slate-300 hover:text-blue-600 transition-all"><Pencil size={18}/></button>}
                                            {access.canWrite('actions', 'delete') && <button onClick={() => setConfirmDelete(cp)} className="p-2 text-slate-300 hover:text-red-500 transition-all"><Trash2 size={18}/></button>}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

             {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm transition-all overflow-y-auto">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl my-8 overflow-hidden border border-slate-100 animate-in zoom-in-95">
                        <div className="p-6 bg-slate-50 border-b flex justify-between items-center sticky top-0 z-10">
                           <h3 className="text-2xl font-black text-slate-800">{editingCounterparty ? 'Редактировать' : 'Новый'} контрагент</h3>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-full hover:bg-slate-200"><X size={20}/></button>
                        </div>
                        <div className="p-8 space-y-8 overflow-y-auto max-h-[calc(90vh-100px)] custom-scrollbar">
                            {/* General Info */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                               <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Название <span className="text-red-500">*</span></label>
                                    <input className="w-full border border-slate-200 rounded-2xl p-4 font-bold text-slate-700 bg-slate-50/50" value={name} onChange={e => setName(e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Тип <span className="text-red-500">*</span></label>
                                    <select className="w-full border border-slate-200 rounded-2xl p-4 font-bold text-slate-700 bg-slate-50/50" value={type} onChange={e => setType(e.target.value as CounterpartyType)}>
                                        <option value={CounterpartyType.SUPPLIER}>Поставщик</option>
                                        <option value={CounterpartyType.CLIENT}>Клиент</option>
                                        <option value={CounterpartyType.MANUFACTURER}>Производитель</option>
                                        <option value={CounterpartyType.OUR_COMPANY}>Наша компания</option>
                                        <option value={CounterpartyType.EMPLOYEE}>Сотрудник</option>
                                    </select>
                                </div>
                            </div>

                            {/* Contact Info */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-slate-50 rounded-2xl border">
                               <h4 className="col-span-full text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 pb-4 border-b">Контактная информация</h4>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Контактное лицо</label>
                                    <input className="w-full border border-slate-200 rounded-xl p-3 text-sm font-bold bg-white" value={contactPerson} onChange={e => setContactPerson(e.target.value)} />
                                </div>
                                 <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Телефон</label>
                                    <input className="w-full border border-slate-200 rounded-xl p-3 text-sm font-bold bg-white" value={phone} onChange={e => setPhone(e.target.value)} />
                                </div>
                            </div>

                            {/* Legal Requisites */}
                            <div className="space-y-6 p-6 bg-slate-50 rounded-2xl border">
                                <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 pb-4 border-b">Реквизиты организации</h4>
                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="col-span-full">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Юр. адрес</label>
                                        <textarea className="w-full border border-slate-200 rounded-xl p-3 text-sm font-bold bg-white h-20" value={legalAddress} onChange={e => setLegalAddress(e.target.value)} />
                                    </div>
                                     <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">БИН / ИИН</label>
                                        <input className="w-full border border-slate-200 rounded-xl p-3 text-sm font-bold bg-white" value={binIin} onChange={e => setBinIin(e.target.value)} />
                                    </div>
                                      <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Директор</label>
                                        <input className="w-full border border-slate-200 rounded-xl p-3 text-sm font-bold bg-white" value={director} onChange={e => setDirector(e.target.value)} />
                                    </div>
                                     <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Юр. Email</label>
                                        <input type="email" className="w-full border border-slate-200 rounded-xl p-3 text-sm font-bold bg-white" value={legalEmail} onChange={e => setLegalEmail(e.target.value)} />
                                    </div>
                                 </div>
                            </div>

                             {/* Bank Accounts */}
                            <div className="space-y-4 p-6 bg-slate-50 rounded-2xl border">
                                <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 pb-4 border-b">Банковские счета</h4>
                                {accounts.map((acc, index) => (
                                    <div key={acc.id || index} className="grid grid-cols-12 gap-2 items-center bg-white p-3 rounded-lg border">
                                        <div className="col-span-2">
                                             <input placeholder="Название счета" className="w-full text-xs font-bold p-2 border-slate-100 rounded-lg" value={acc.name || ''} onChange={e => handleAccountChange(index, 'name', e.target.value)} />
                                        </div>
                                        <div className="col-span-2">
                                             <input placeholder="Название банка" className="w-full text-xs font-bold p-2 border-slate-100 rounded-lg" value={acc.bankName || ''} onChange={e => handleAccountChange(index, 'bankName', e.target.value)} />
                                        </div>
                                        <div className="col-span-3">
                                            <input placeholder="ИИК (IBAN)" className="w-full text-xs font-bold p-2 font-mono border-slate-100 rounded-lg" value={acc.iik || ''} onChange={e => handleAccountChange(index, 'iik', e.target.value)} />
                                        </div>
                                        <div className="col-span-2">
                                            <input placeholder="БИК" className="w-full text-xs font-bold p-2 font-mono border-slate-100 rounded-lg" value={acc.bik || ''} onChange={e => handleAccountChange(index, 'bik', e.target.value)} />
                                        </div>
                                         <div className="col-span-1">
                                            <select className="w-full text-xs font-bold p-2 border-slate-100 rounded-lg" value={acc.currency || Currency.KZT} onChange={e => handleAccountChange(index, 'currency', e.target.value as Currency)}>
                                                <option value={Currency.KZT}>KZT</option><option value={Currency.USD}>USD</option><option value={Currency.EUR}>EUR</option><option value={Currency.RUB}>RUB</option>
                                            </select>
                                        </div>
                                        <div className="col-span-1 flex justify-center">
                                            <input type="checkbox" className="h-5 w-5" checked={acc.isDefault || false} onChange={e => handleAccountChange(index, 'isDefault', e.target.checked)} />
                                        </div>
                                        <div className="col-span-1">
                                            <button onClick={() => removeAccountField(index)} className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={16} /></button>
                                        </div>
                                    </div>
                                ))}
                                <button onClick={addAccountField} className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-blue-600 p-2 hover:bg-blue-50 rounded-lg"><PlusCircle size={16} /> Добавить счет</button>
                            </div>

                            {errorMsg && <p className="text-red-500 text-sm font-bold text-center">{errorMsg}</p>}

                            <div className="pt-4">
                                <button onClick={handleSubmit} className="w-full bg-slate-900 text-white py-5 rounded-[1.5rem] font-black uppercase tracking-widest shadow-xl shadow-slate-200 hover:bg-slate-800 active:scale-95 transition-all flex items-center justify-center gap-3">
                                    <Save size={20}/> {editingCounterparty ? 'Сохранить изменения' : 'Создать контрагента'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {confirmDelete && (
                 <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[200] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2rem] shadow-2xl max-w-sm w-full overflow-hidden border">
                        <div className="p-8 text-center">
                            <div className="w-20 h-20 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6"><Trash2 size={40} /></div>
                            <h3 className="text-2xl font-black text-slate-800 mb-3 uppercase tracking-tight">Удалить?</h3>
                            <p className="text-slate-500 font-medium mb-8 leading-relaxed">Вы уверены, что хотите переместить <b>{confirmDelete.name}</b> в корзину?</p>
                            <div className="flex flex-col gap-3">
                                <button 
                                    onClick={async () => {
                                        await actions.deleteCounterparty(confirmDelete.id);
                                        setConfirmDelete(null);
                                    }}
                                    className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-red-200 transition-all"
                                >
                                    Да, удалить
                                </button>
                                <button onClick={() => setConfirmDelete(null)} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 py-4 rounded-2xl font-bold uppercase tracking-widest transition-all">
                                    Отмена
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
