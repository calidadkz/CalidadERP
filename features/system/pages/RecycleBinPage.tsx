import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from '@/features/system/context/GlobalStore';
import { TrashItem } from '@/types';
import { Trash2, RefreshCw, AlertTriangle, XCircle, CheckCircle, Loader2, ChevronDown } from 'lucide-react';
import { ApiService } from '@/services/api';
import { supabase } from '@/services/supabaseClient';
import { TableNames } from '@/constants';

const PAGE_SIZE = 50;

export const RecycleBinPage: React.FC = () => {
    const { actions } = useStore();
    const [trash, setTrash] = useState<TrashItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isMoreLoading, setIsMoreLoading] = useState(false);
    const [isProcessing, setIsProcessing] = useState<string | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    
    const [hasMore, setHasMore] = useState(true);
    const [offset, setOffset] = useState(0);

    const fetchTrash = useCallback(async (isInitial = false) => {
        if (isInitial) {
            setIsLoading(true);
        } else {
            setIsMoreLoading(true);
        }

        const currentOffset = isInitial ? 0 : offset;

        try {
            const { data, error } = await supabase
                .from(TableNames.TRASH)
                .select('*')
                .order('deleted_at', { ascending: false })
                .range(currentOffset, currentOffset + PAGE_SIZE - 1);

            if (error) throw error;

            const camelData = ApiService.keysToCamel(data || []) as TrashItem[];

            if (isInitial) {
                setTrash(camelData);
                setOffset(PAGE_SIZE);
            } else {
                setTrash(prev => [...prev, ...camelData]);
                setOffset(prev => prev + PAGE_SIZE);
            }

            setHasMore(camelData.length === PAGE_SIZE);
        } catch (e) {
            console.error("Failed to fetch trash", e);
        } finally {
            setIsLoading(false);
            setIsMoreLoading(false);
        }
    }, [offset]);

    useEffect(() => {
        fetchTrash(true);
    }, []);

    const handleRefresh = () => {
        fetchTrash(true);
    };

    const handleRestore = async (item: TrashItem) => {
        setIsProcessing(item.id);
        try {
            await actions.restoreFromTrash(item);
            setTrash(prev => prev.filter(t => t.id !== item.id));
        } catch (e: any) {
            alert(`Ошибка восстановления: ${e.message}`);
        } finally {
            setIsProcessing(null);
        }
    };

    const handlePermanentDelete = async (item: TrashItem) => {
        setIsProcessing(item.id);
        try {
            await actions.permanentlyDelete(item);
            setTrash(prev => prev.filter(t => t.id !== item.id));
            setConfirmDeleteId(null);
        } catch (e: any) {
            console.error("[RECYCLE_BIN] Delete error:", e);
            alert(`Ошибка БД: ${e.message}`);
        } finally {
            setIsProcessing(null);
        }
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                        <Trash2 className="mr-2 text-red-600" size={28} /> Корзина Системы
                    </h2>
                    <p className="text-sm text-gray-500">Элементы удаленные из справочников. Восстановление вернет их в активную базу.</p>
                </div>
                <button 
                  onClick={handleRefresh}
                  disabled={isLoading}
                  className="flex items-center px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  <RefreshCw size={16} className={`mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  Обновить
                </button>
            </div>

            <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
                {isLoading ? (
                    <div className="p-20 text-center text-gray-400 flex flex-col items-center">
                        <Loader2 className="animate-spin text-blue-600 mb-4" size={32} />
                        <span>Загрузка корзины...</span>
                    </div>
                ) : (
                    <>
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr className="text-[10px] font-black uppercase text-gray-400 tracking-wider">
                                    <th className="px-6 py-4 text-left">Объект</th>
                                    <th className="px-6 py-4 text-left">Наименование / ID</th>
                                    <th className="px-6 py-4 text-left">Дата удаления</th>
                                    <th className="px-6 py-4 text-right">Действия</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-100">
                                {trash.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="p-20 text-center text-gray-300 flex flex-col items-center justify-center">
                                            <CheckCircle size={64} className="mb-4 opacity-10" />
                                            <span className="text-lg font-bold">Корзина пуста</span>
                                        </td>
                                    </tr>
                                ) : (
                                    trash.map(item => {
                                        const isConfirming = confirmDeleteId === item.id;
                                        const loading = isProcessing === item.id;

                                        return (
                                            <tr key={item.id} className="hover:bg-red-50/30 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <span className="px-2 py-1 bg-gray-100 rounded text-[10px] font-black border text-gray-500">{item.type}</span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-sm font-bold text-gray-800">{item.name}</div>
                                                    <div className="text-[10px] font-mono text-gray-400">UUID: {item.id}</div>
                                                    <div className="text-[10px] font-mono text-blue-500">Orig ID: {item.originalId}</div>
                                                </td>
                                                <td className="px-6 py-4 text-xs text-gray-500">
                                                    {new Date(item.deletedAt).toLocaleString('ru-RU')}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex justify-end items-center space-x-4">
                                                        {loading ? (
                                                            <Loader2 className="animate-spin text-blue-600" size={18} />
                                                        ) : isConfirming ? (
                                                            <div className="flex items-center bg-red-600 rounded-lg overflow-hidden shadow-lg animate-in slide-in-from-right-4">
                                                                <span className="px-3 py-1 text-[10px] text-white font-bold uppercase tracking-widest">Удалить?</span>
                                                                <button 
                                                                    onClick={() => handlePermanentDelete(item)}
                                                                    className="bg-red-700 hover:bg-red-800 text-white px-3 py-1 text-xs font-bold border-l border-red-500/30"
                                                                >
                                                                    ДА
                                                                </button>
                                                                <button 
                                                                    onClick={() => setConfirmDeleteId(null)}
                                                                    className="bg-white hover:bg-gray-100 text-gray-600 px-3 py-1 text-xs font-bold border-l border-red-500/30"
                                                                >
                                                                    НЕТ
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <button 
                                                                    onClick={() => handleRestore(item)} 
                                                                    className="flex items-center text-blue-600 hover:text-blue-800 text-xs font-black uppercase tracking-tighter transition-all hover:scale-105"
                                                                >
                                                                    <RefreshCw size={14} className="mr-1"/> Вернуть
                                                                </button>
                                                                <button 
                                                                    onClick={() => setConfirmDeleteId(item.id)} 
                                                                    className="flex items-center text-red-400 hover:text-red-700 text-xs font-black uppercase tracking-tighter transition-all hover:scale-105"
                                                                >
                                                                    <XCircle size={14} className="mr-1"/> Стереть
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                        
                        {hasMore && trash.length > 0 && (
                            <div className="p-4 border-t border-gray-100 flex justify-center">
                                <button 
                                    onClick={() => fetchTrash()}
                                    disabled={isMoreLoading}
                                    className="flex items-center px-6 py-2 bg-gray-50 text-gray-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-100 transition-all disabled:opacity-50"
                                >
                                    {isMoreLoading ? (
                                        <Loader2 size={14} className="animate-spin mr-2" />
                                    ) : (
                                        <ChevronDown size={14} className="mr-2" />
                                    )}
                                    Загрузить еще
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
            
            {trash.length > 0 && (
                <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex items-start shadow-sm">
                    <AlertTriangle className="text-amber-600 mr-3 flex-shrink-0" size={24}/>
                    <div className="text-xs text-amber-800">
                        <p className="font-bold mb-1 uppercase tracking-tight">Техническая информация:</p>
                        <p>Для окончательного удаления используется системный UUID записи. Это действие деструктивно и не подлежит отмене через интерфейс системы.</p>
                    </div>
                </div>
            )}
        </div>
    );
};
