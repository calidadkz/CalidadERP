
import React, { ReactNode, useState } from 'react';
import { 
  Settings, Calculator, FileText, History, Trash2, 
  Box, ShoppingCart, Truck, Users, List, RefreshCcw, PackageSearch, LogOut, ShieldCheck, 
  Calendar, Landmark, Receipt, Tag, ChevronLeft, Menu, Hash, LineChart, Layers
} from 'lucide-react';
import { useAuth } from '@/features/system/context/AuthContext';
import { AppRole } from '@/types';
import { PermissionsService } from '@/services/PermissionsService';

interface LayoutProps {
    children: ReactNode;
    activeTab: string;
    onTabChange: (tab: string) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, activeTab, onTabChange }) => {
    const { user, signOut } = useAuth();
    const [isCollapsed, setIsCollapsed] = useState(false);

    const menuGroups = [
        {
            id: 'warehouse_group',
            label: 'Склад и Товары',
            items: [
                { id: 'inventory', label: 'Остатки и Движения', icon: <PackageSearch size={18} /> },
                { id: 'nomenclature', label: 'Номенклатура', icon: <Box size={18} /> },
                { id: 'hscodes', label: 'Коды ТНВЭД', icon: <Hash size={18} /> },
                { id: 'bundles', label: 'Комплектации', icon: <List size={18} /> },
                { id: 'options', label: 'Опции', icon: <Settings size={18} /> },
                { id: 'categories', label: 'Категории', icon: <Settings size={18} /> },
            ]
        },
        {
            id: 'operations_group',
            label: 'Операции',
            items: [
                { id: 'pre-calculations', label: 'Предрасчеты', icon: <LineChart size={18} /> },
                { id: 'batches', label: 'Партии', icon: <Layers size={18} /> },
                { id: 'procurement', label: 'Снабжение (ЗП)', icon: <Truck size={18} /> },
                { id: 'receiving', label: 'Приемка на склад', icon: <Box size={18} /> },
                { id: 'sales', label: 'Продажи (ЗК)', icon: <ShoppingCart size={18} /> },
                { id: 'shipment', label: 'Отгрузка', icon: <FileText size={18} /> },
                { id: 'discrepancy', label: 'Брак и потери', icon: <History size={18} /> },
            ]
        },
        {
            id: 'finance_group',
            label: 'Финансы',
            items: [
                { id: 'finance_calendar', label: 'Календарь (IPP)', icon: <Calendar size={18} /> },
                { id: 'finance_statements', label: 'Выписки (IP)', icon: <Receipt size={18} /> },
                { id: 'finance_accounts', label: 'Наши счета', icon: <Landmark size={18} /> },
                { id: 'finance_categories', label: 'Статьи ДДС', icon: <Tag size={18} /> },
                { id: 'rates', label: 'Курсы валют', icon: <RefreshCcw size={18} /> },
            ]
        },
        {
            id: 'contacts_group',
            label: 'Справочники',
            items: [
                { id: 'counterparties', label: 'Контрагенты', icon: <Users size={18} /> },
            ]
        },
        {
            id: 'system_group',
            label: 'Система',
            items: [
                { id: 'pricing', label: 'Ценообразование', icon: <Calculator size={18} /> },
                { id: 'permissions', label: 'Права доступа', icon: <ShieldCheck size={18} /> },
                { id: 'history', label: 'История (Логи)', icon: <History size={18} /> },
                { id: 'recycle_bin', label: 'Корзина', icon: <Trash2 size={18} /> }, 
            ]
        }
    ];

    const roleLabels: Record<AppRole, string> = {
        [AppRole.ADMIN]: 'Администратор',
        [AppRole.MANAGER]: 'Менеджер',
        [AppRole.ROP]: 'РОП',
        [AppRole.ACCOUNTANT]: 'Бухгалтер',
        [AppRole.PROCUREMENT]: 'Снабженец',
        [AppRole.TECHNICIAN]: 'Техник',
        [AppRole.LOGISTICS]: 'Логист',
        [AppRole.WAREHOUSE]: 'Складской работник',
        [AppRole.GUEST]: 'Гость'
    };

    const filteredMenu = menuGroups
        .map(group => ({
            ...group,
            items: group.items.filter(item => {
                if (user?.role === AppRole.ADMIN) return true;
                return PermissionsService.canSee(user, item.id, 'tabs', 'main');
            })
        }))
        .filter(group => group.items.length > 0);

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden">
            <aside 
                className={`bg-slate-900 text-white flex flex-col flex-none transition-all duration-300 ease-in-out relative z-40 ${
                    isCollapsed ? 'w-20' : 'w-64'
                }`}
            >
                <div className="p-6 h-20 border-b border-slate-800 flex items-center justify-between overflow-hidden">
                    {!isCollapsed && (
                        <div className="text-xl font-black tracking-tighter text-blue-400 animate-in fade-in duration-500 truncate">
                            CALIDAD ERP
                        </div>
                    )}
                    <button 
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className={`p-2 rounded-xl hover:bg-slate-800 transition-all text-slate-400 hover:text-white ${isCollapsed ? 'mx-auto' : ''}`}
                    >
                        {isCollapsed ? <Menu size={20} /> : <ChevronLeft size={20} />}
                    </button>
                </div>

                <nav className="flex-1 overflow-y-auto p-3 space-y-6 custom-scrollbar">
                    {filteredMenu.map(group => (
                        <div key={group.id} className="space-y-1">
                            {!isCollapsed && (
                                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 ml-3 animate-in fade-in">
                                    {group.label}
                                </div>
                            )}
                            <div className="space-y-1">
                                {group.items.map(item => (
                                    <button
                                        key={item.id}
                                        onClick={() => onTabChange(item.id)}
                                        title={isCollapsed ? item.label : ''}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${
                                            activeTab === item.id 
                                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                                            : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                                        } ${isCollapsed ? 'justify-center' : ''}`}
                                    >
                                        <div className="flex-none">{item.icon}</div>
                                        {!isCollapsed && <span className="truncate animate-in fade-in slide-in-from-left-2">{item.label}</span>}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </nav>
                
                <div className={`p-4 border-t border-slate-800 bg-slate-900/50 transition-all ${isCollapsed ? 'items-center' : ''}`}>
                    <div className={`flex items-center gap-3 px-2 mb-4 ${isCollapsed ? 'justify-center' : ''}`}>
                        <div className="w-10 h-10 bg-blue-600 rounded-2xl flex-none flex items-center justify-center text-white font-black shadow-lg">
                            {user?.fullName?.charAt(0) || user?.email.charAt(0).toUpperCase()}
                        </div>
                        {!isCollapsed && (
                            <div className="flex-1 min-w-0 animate-in fade-in duration-300">
                                <div className="text-xs font-black text-white truncate">{user?.fullName || 'Сотрудник'}</div>
                                <div className="text-[10px] font-bold text-blue-400 uppercase tracking-tighter">
                                    {user ? roleLabels[user.role] : '...'}
                                </div>
                            </div>
                        )}
                    </div>
                    <button 
                        onClick={() => signOut()}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-slate-400 hover:bg-red-50/10 hover:text-red-400 transition-all ${isCollapsed ? 'justify-center' : ''}`}
                        title={isCollapsed ? 'Выйти' : ''}
                    >
                        <LogOut size={18} />
                        {!isCollapsed && <span className="animate-in fade-in">Выйти</span>}
                    </button>
                </div>
            </aside>
            <main className="flex-1 overflow-y-auto pt-8 px-8 pb-5 bg-slate-50 transition-all">
                {children}
            </main>
        </div>
    );
};
