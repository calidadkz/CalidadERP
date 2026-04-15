
import React, { ReactNode, useState } from 'react';
import {
  Settings, Calculator, FileText, History, Trash2,
  Box, ShoppingCart, Truck, Users, List, RefreshCcw, PackageSearch, LogOut, ShieldCheck,
  Calendar, Landmark, Receipt, Tag, ChevronLeft, Menu, Hash, LineChart, Layers, X
} from 'lucide-react';
import { useAuth } from '@/features/system/context/AuthContext';
import { AppRole } from '@/types';
import { PermissionsService } from '@/services/PermissionsService';
import { useIsMobile } from '@/hooks/useIsMobile';

interface LayoutProps {
    children: ReactNode;
    activeTab: string;
    onTabChange: (tab: string) => void;
}

const menuGroups = [
    {
        id: 'warehouse_group',
        label: 'Склад и Товары',
        items: [
            { id: 'inventory',    label: 'Остатки и Движения',  icon: PackageSearch },
            { id: 'nomenclature', label: 'Номенклатура',         icon: Box },
            { id: 'hscodes',      label: 'Коды ТНВЭД',           icon: Hash },
            { id: 'bundles',      label: 'Комплектации',          icon: List },
            { id: 'options',      label: 'Опции',                 icon: Settings },
            { id: 'categories',   label: 'Категории',             icon: Settings },
        ]
    },
    {
        id: 'operations_group',
        label: 'Операции',
        items: [
            { id: 'pre-calculations', label: 'Предрасчеты',        icon: LineChart },
            { id: 'batches',          label: 'Партии',              icon: Layers },
            { id: 'procurement',      label: 'Снабжение (ЗП)',      icon: Truck },
            { id: 'receiving',        label: 'Приемка на склад',    icon: Box },
            { id: 'sales',            label: 'Продажи (ЗК)',        icon: ShoppingCart },
            { id: 'shipment',         label: 'Отгрузка',            icon: FileText },
            { id: 'discrepancy',      label: 'Списание и брак',     icon: History },
        ]
    },
    {
        id: 'finance_group',
        label: 'Финансы',
        items: [
            { id: 'finance_calendar',    label: 'Календарь (IPP)', icon: Calendar },
            { id: 'finance_statements',  label: 'Выписки (IP)',    icon: Receipt },
            { id: 'finance_accounts',    label: 'Наши счета',      icon: Landmark },
            { id: 'finance_categories',  label: 'Статьи ДДС',      icon: Tag },
            { id: 'rates',               label: 'Курсы валют',     icon: RefreshCcw },
        ]
    },
    {
        id: 'contacts_group',
        label: 'Справочники',
        items: [
            { id: 'counterparties', label: 'Контрагенты', icon: Users },
        ]
    },
    {
        id: 'system_group',
        label: 'Система',
        items: [
            { id: 'pricing',     label: 'Ценообразование', icon: Calculator },
            { id: 'permissions', label: 'Права доступа',   icon: ShieldCheck },
            { id: 'history',     label: 'История (Логи)',   icon: History },
            { id: 'recycle_bin', label: 'Корзина',          icon: Trash2 },
        ]
    }
];

// Плоская карта id → label для top bar
const tabLabelMap: Record<string, string> = {};
menuGroups.forEach(g => g.items.forEach(item => { tabLabelMap[item.id] = item.label; }));

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

export const Layout: React.FC<LayoutProps> = ({ children, activeTab, onTabChange }) => {
    const { user, signOut } = useAuth();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const isMobile = useIsMobile();

    const filteredMenu = menuGroups
        .map(group => ({
            ...group,
            items: group.items.filter(item => {
                if (user?.role === AppRole.ADMIN) return true;
                return PermissionsService.canSee(user, item.id, 'tabs', 'main');
            })
        }))
        .filter(group => group.items.length > 0);

    const handleTabChange = (tab: string) => {
        onTabChange(tab);
        setIsMobileMenuOpen(false);
    };

    // ── МОБИЛЬНАЯ ВЕРСИЯ ────────────────────────────────────────────
    if (isMobile) {
        return (
            <div className="flex flex-col h-[100dvh] bg-slate-50 overflow-hidden">
                {/* Top bar */}
                <div className="flex-none h-12 bg-slate-900 flex items-center gap-3 px-4 z-40">
                    <button
                        onClick={() => setIsMobileMenuOpen(true)}
                        className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    >
                        <Menu size={20} />
                    </button>
                    <div className="flex-1 min-w-0">
                        <span className="text-sm font-black text-white truncate">
                            {tabLabelMap[activeTab] || 'CALIDAD ERP'}
                        </span>
                    </div>
                    <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-sm flex-none">
                        {user?.fullName?.charAt(0) || user?.email.charAt(0).toUpperCase()}
                    </div>
                </div>

                {/* Main content */}
                <main className="flex-1 overflow-hidden">
                    {children}
                </main>

                {/* Mobile menu drawer */}
                {isMobileMenuOpen && (
                    <div className="fixed inset-0 z-[100] flex">
                        {/* Backdrop */}
                        <div
                            className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm"
                            onClick={() => setIsMobileMenuOpen(false)}
                        />

                        {/* Drawer */}
                        <div className="relative z-10 w-72 max-w-[85vw] bg-slate-900 flex flex-col h-full overflow-hidden shadow-2xl">
                            {/* Drawer header */}
                            <div className="h-14 border-b border-slate-800 flex items-center justify-between px-4">
                                <span className="text-base font-black tracking-tighter text-blue-400">CALIDAD ERP</span>
                                <button
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Navigation */}
                            <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
                                {filteredMenu.map(group => (
                                    <div key={group.id} className="space-y-0.5">
                                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-2">
                                            {group.label}
                                        </div>
                                        <div className="space-y-0.5">
                                            {group.items.map(item => {
                                                const Icon = item.icon;
                                                return (
                                                    <button
                                                        key={item.id}
                                                        onClick={() => handleTabChange(item.id)}
                                                        className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-bold transition-all ${
                                                            activeTab === item.id
                                                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                                                                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                                                        }`}
                                                    >
                                                        <Icon size={18} className="flex-none" />
                                                        <span>{item.label}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </nav>

                            {/* User + logout */}
                            <div className="border-t border-slate-800 p-4 space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 bg-blue-600 rounded-xl flex-none flex items-center justify-center text-white font-black shadow-lg">
                                        {user?.fullName?.charAt(0) || user?.email.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-black text-white truncate">{user?.fullName || 'Сотрудник'}</div>
                                        <div className="text-[10px] font-bold text-blue-400 uppercase tracking-tighter">
                                            {user ? roleLabels[user.role] : '...'}
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => signOut()}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-slate-400 hover:bg-red-50/10 hover:text-red-400 transition-all"
                                >
                                    <LogOut size={16} />
                                    <span>Выйти</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ── ДЕСКТОПНАЯ ВЕРСИЯ ────────────────────────────────────────────
    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden">
            <aside
                className={`bg-slate-900 text-white flex flex-col flex-none transition-all duration-300 ease-in-out relative z-40 ${
                    isCollapsed ? 'w-16' : 'w-56 xl:w-60'
                }`}
            >
                <div className={`h-14 border-b border-slate-800 flex items-center justify-between overflow-hidden ${isCollapsed ? 'px-3' : 'px-4'}`}>
                    {!isCollapsed && (
                        <div className="text-base font-black tracking-tighter text-blue-400 animate-in fade-in duration-500 truncate">
                            CALIDAD ERP
                        </div>
                    )}
                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className={`p-1.5 rounded-xl hover:bg-slate-800 transition-all text-slate-400 hover:text-white flex-none ${isCollapsed ? 'mx-auto' : ''}`}
                    >
                        {isCollapsed ? <Menu size={18} /> : <ChevronLeft size={18} />}
                    </button>
                </div>

                <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4 custom-scrollbar">
                    {filteredMenu.map(group => (
                        <div key={group.id} className="space-y-0.5">
                            {!isCollapsed && (
                                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-2 animate-in fade-in">
                                    {group.label}
                                </div>
                            )}
                            <div className="space-y-0.5">
                                {group.items.map(item => {
                                    const Icon = item.icon;
                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => onTabChange(item.id)}
                                            title={isCollapsed ? item.label : ''}
                                            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-bold transition-all ${
                                                activeTab === item.id
                                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                                                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                                            } ${isCollapsed ? 'justify-center' : ''}`}
                                        >
                                            <Icon size={18} className="flex-none" />
                                            {!isCollapsed && <span className="truncate animate-in fade-in slide-in-from-left-2">{item.label}</span>}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </nav>

                <div className={`border-t border-slate-800 bg-slate-900/50 ${isCollapsed ? 'p-2' : 'p-3'}`}>
                    <div className={`flex items-center gap-2.5 mb-2 ${isCollapsed ? 'justify-center' : 'px-1'}`}>
                        <div className="w-8 h-8 bg-blue-600 rounded-xl flex-none flex items-center justify-center text-white font-black shadow-lg text-sm">
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
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-bold text-slate-400 hover:bg-red-50/10 hover:text-red-400 transition-all ${isCollapsed ? 'justify-center' : ''}`}
                        title={isCollapsed ? 'Выйти' : ''}
                    >
                        <LogOut size={16} />
                        {!isCollapsed && <span className="animate-in fade-in">Выйти</span>}
                    </button>
                </div>
            </aside>

            <main className="flex-1 overflow-y-auto bg-slate-50 transition-all px-4 pt-5 pb-5 xl:px-6 xl:pt-6 2xl:px-8 2xl:pt-7">
                {children}
            </main>
        </div>
    );
};
