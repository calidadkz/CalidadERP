import React, { useState, useMemo } from 'react';
import { useStore } from '@/features/system/context/GlobalStore';
import { Counterparty, CounterpartyAccount, Currency, CounterpartyType, AppRole } from '@/types';
import { Users, Briefcase, Truck, Plus, Pencil, Search, Phone, User, Trash2, Factory, Building2, UserCircle, Globe } from 'lucide-react';
import { useAccess } from '@/features/auth/hooks/useAccess';
import { useAuth } from '@/features/system/context/AuthContext';
import { CounterpartyCreateModal } from '../components/CounterpartyCreateModal';

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
    const { user } = useAuth();

    // Менеджер может создавать/редактировать только клиентов
    const isClientOnly = user?.role === AppRole.MANAGER;

    const [activeTab, setActiveTab] = useState<CounterpartyType | 'all'>('all');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCounterparty, setEditingCounterparty] = useState<Counterparty | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [confirmDelete, setConfirmDelete] = useState<Counterparty | null>(null);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    const canMutateCounterparty = (cp: Counterparty) => {
        if (isClientOnly) {
            const roles = cp.roles || [cp.type];
            return roles.includes(CounterpartyType.CLIENT);
        }
        return true;
    };

    const openCreateModal = () => {
        if (!access.canWrite('actions', 'manage')) return;
        setEditingCounterparty(null);
        setIsModalOpen(true);
    };

    const openEditModal = (cp: Counterparty) => {
        if (!access.canSee('actions', 'edit')) return;
        if (!canMutateCounterparty(cp)) return;
        setEditingCounterparty(cp);
        setIsModalOpen(true);
    };

    const handleModalSubmit = async (counterparty: Counterparty, accounts: CounterpartyAccount[]) => {
        if (editingCounterparty) {
            await actions.updateCounterparty(counterparty, accounts);
        } else {
            await actions.addCounterparty(counterparty, accounts[0]);
        }
        setIsModalOpen(false);
    };

    // ОБЪЕДИНЯЕМ ВСЕ ИСТОЧНИКИ ДАННЫХ
    const allCounterparties = useMemo(() => {
        // Создаем мапу для дедупликации (если один и тот же ID в разных списках)
        const map = new Map<string, Counterparty>();
        
        state.counterparties.forEach(c => map.set(c.id, { ...c, roles: c.roles || [c.type] }));
        
        // Добавляем производителей, если их нет в основном списке
        state.manufacturers.forEach(m => {
            if (!map.has(m.id)) {
                map.set(m.id, { ...m, type: CounterpartyType.MANUFACTURER, roles: [CounterpartyType.MANUFACTURER] });
            } else {
                // Если уже есть, добавляем роль производителя
                const existing = map.get(m.id)!;
                if (!existing.roles?.includes(CounterpartyType.MANUFACTURER)) {
                    existing.roles = [...(existing.roles || []), CounterpartyType.MANUFACTURER];
                }
            }
        });

        // Добавляем наши компании
        state.ourCompanies.forEach(o => {
            if (!map.has(o.id)) {
                map.set(o.id, { ...o, type: CounterpartyType.OUR_COMPANY, roles: [CounterpartyType.OUR_COMPANY] });
            } else {
                const existing = map.get(o.id)!;
                if (!existing.roles?.includes(CounterpartyType.OUR_COMPANY)) {
                    existing.roles = [...(existing.roles || []), CounterpartyType.OUR_COMPANY];
                }
            }
        });

        return Array.from(map.values());
    }, [state.counterparties, state.manufacturers, state.ourCompanies]);

    const filteredCounterparties = useMemo(() => {
        let data = allCounterparties;
        
        if (activeTab !== 'all') {
            data = data.filter(cp => {
                const roles = cp.roles || [cp.type];
                return roles.includes(activeTab as CounterpartyType);
            });
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
    }, [allCounterparties, activeTab, searchTerm]);

    const editingAccounts = useMemo(() => {
        if (!editingCounterparty) return [];
        return state.counterpartyAccounts.filter(acc => acc.counterpartyId === editingCounterparty.id);
    }, [editingCounterparty, state.counterpartyAccounts]);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center"><Users className="mr-3 text-blue-600" size={28} /> Контрагенты</h2>
                    <p className="text-slate-500 text-sm font-medium mt-1">База партнеров, клиентов и поставщиков</p>
                </div>
                {access.canWrite('actions', 'manage') && (
                    <button onClick={openCreateModal} className="flex items-center px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all active:scale-95 font-black uppercase text-xs tracking-widest">
                        <Plus size={18} className="mr-2" /> Добавить
                    </button>
                )}
            </div>

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

            <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden">
                <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-slate-50/50">
                        <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            <th className="px-4 py-3 text-left">Название</th>
                            <th className="px-4 py-3 text-left">Роли</th>
                            <th className="px-4 py-3 text-left">Контакты</th>
                            <th className="px-4 py-3 text-left">БИН/ИИН</th>
                            <th className="px-4 py-3 text-right"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 bg-white">
                        {filteredCounterparties.length === 0 ? (
                            <tr><td colSpan={5} className="p-20 text-center text-slate-400 italic font-medium">Контрагенты не найдены</td></tr>
                        ) : (
                            filteredCounterparties.map(cp => {
                                const roles = cp.roles || [cp.type];
                                return (
                                    <tr key={cp.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-4 py-3">
                                            <div className="text-sm font-black text-slate-800">{cp.name}</div>
                                            {cp.position && roles.includes(CounterpartyType.EMPLOYEE) && (
                                                <div className="text-[9px] text-orange-500 font-bold uppercase mt-0.5">{cp.position}</div>
                                            )}
                                            {cp.country && !cp.position && <div className="flex items-center gap-1 text-[9px] text-slate-400 font-bold uppercase mt-0.5"><Globe size={10}/> {cp.country}</div>}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-wrap gap-1.5">
                                                {roles.map(r => (
                                                    <div key={r} className="flex items-center gap-1 px-2 py-1 bg-slate-50 border border-slate-100 rounded-lg text-[9px] font-black uppercase tracking-tighter text-slate-500">
                                                        <CounterpartyTypeIcon type={r as CounterpartyType} />
                                                        {getCounterpartyTypeTranslation(r as CounterpartyType)}
                                                    </div>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2 text-xs font-bold text-slate-500"><User size={14} className="text-slate-400"/> {cp.contactPerson || '—'}</div>
                                            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 mt-1"><Phone size={14} className="text-slate-400"/> {cp.phone || '—'}</div>
                                        </td>
                                        <td className="px-4 py-3"><div className="text-sm font-mono text-slate-500">{cp.binIin || '—'}</div></td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {access.canSee('actions', 'edit') && canMutateCounterparty(cp) && <button onClick={() => openEditModal(cp)} className="p-2 text-slate-400 hover:text-blue-600 transition-all" title="Редактировать"><Pencil size={18}/></button>}
                                                {access.canWrite('actions', 'delete') && canMutateCounterparty(cp) && <button onClick={() => { setConfirmDelete(cp); setDeleteError(null); }} className="p-2 text-slate-400 hover:text-red-500 transition-all" title="Удалить"><Trash2 size={18}/></button>}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

             {isModalOpen && (
                <CounterpartyCreateModal
                    onClose={() => setIsModalOpen(false)}
                    onSubmit={handleModalSubmit}
                    initialType={isClientOnly ? CounterpartyType.CLIENT : (activeTab !== 'all' ? (activeTab as CounterpartyType) : CounterpartyType.SUPPLIER)}
                    lockedType={isClientOnly ? CounterpartyType.CLIENT : undefined}
                    editingCounterparty={editingCounterparty}
                    initialAccounts={editingAccounts}
                />
            )}

            {confirmDelete && (
                 <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-sm w-full overflow-hidden border border-slate-100">
                        <div className="p-8 text-center">
                            <div className="w-20 h-20 bg-red-50 text-red-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-xl shadow-red-100 animate-bounce"><Trash2 size={40} /></div>
                            <h3 className="text-2xl font-black text-slate-800 mb-3 uppercase tracking-tight">В корзину?</h3>
                            <p className="text-slate-500 font-medium mb-8 leading-relaxed text-sm">Переместить <b>{confirmDelete.name}</b> в список удаленных объектов?</p>
                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={async () => {
                                        try {
                                            setDeleteError(null);
                                            await actions.deleteCounterparty(confirmDelete.id);
                                            setConfirmDelete(null);
                                        } catch (e: any) {
                                            const code = e?.code || '';
                                            const msg = (e?.message || '').toLowerCase();
                                            if (code === '23503' || msg.includes('foreign key') || msg.includes('violates') || msg.includes('conflict')) {
                                                setDeleteError('Невозможно удалить: контрагент используется в заказах, платежах или других документах.');
                                            } else {
                                                setDeleteError('Ошибка при удалении. Попробуйте ещё раз.');
                                            }
                                        }
                                    }}
                                    className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-red-200 transition-all active:scale-95"
                                >
                                    Да, удалить
                                </button>
                                {deleteError && (
                                    <p className="text-red-500 text-xs font-bold text-center leading-snug">{deleteError}</p>
                                )}
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
