import React, { useState, useEffect } from 'react';
import { PackageCheck, ArrowLeft } from 'lucide-react';
import { useStore } from '../system/context/GlobalStore';
import { PendingOrders } from './components/PendingOrders';
import { ReceivingHistory } from './components/ReceivingHistory';
import { ReceivingForm } from './components/ReceivingForm';
import { api } from '@/services';
import { TableNames } from '@/constants';
import { Batch } from '@/types';

export const ReceivingPage: React.FC = () => {
    const { state, actions } = useStore();
    const [view, setView] = useState<'list' | 'form'>('list');
    const [selectedOrderId, setSelectedOrderId] = useState('');
    const [selectedBatchId, setSelectedBatchId] = useState<string | undefined>();

    // Загружаем все партии для поиска связи order → batch
    const [batches, setBatches] = useState<Batch[]>([]);
    useEffect(() => {
        api.fetchAll<Batch>(TableNames.BATCHES).then(setBatches).catch(() => {});
    }, []);

    const handleOrderSelect = (orderId: string) => {
        // Ищем партию, в которой этот заказ присутствует
        const linkedBatch = batches.find(b =>
            Array.isArray(b.supplierOrderIds) && b.supplierOrderIds.includes(orderId)
        );
        setSelectedOrderId(orderId);
        setSelectedBatchId(linkedBatch?.id);
        setView('form');
    };

    const handleSaveReception = (reception: any) => {
        actions.saveReception({ ...reception, batchId: selectedBatchId });
        setView('list');
        setSelectedOrderId('');
        setSelectedBatchId(undefined);
    };

    const getBusinessDisplayId = (id: string) => id.includes('-') ? `#${id.slice(-6).toUpperCase()}` : id;

    if (view === 'form') {
        const order = state.orders.find(o => o.id === selectedOrderId);
        if (!order) { setView('list'); return null; }

        const linkedBatch = selectedBatchId ? batches.find(b => b.id === selectedBatchId) : undefined;

        return (
            <div className="space-y-6 animate-in fade-in duration-300">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setView('list')} className="p-2 hover:bg-slate-200 rounded-xl transition-all text-slate-400">
                            <ArrowLeft size={24}/>
                        </button>
                        <div>
                            <h2 className="text-2xl font-bold text-slate-800 flex items-center">
                                <PackageCheck className="mr-3 text-blue-600" size={28}/> Новая приемка
                            </h2>
                            <p className="text-slate-500 text-sm font-medium mt-1">
                                Основание: {getBusinessDisplayId(selectedOrderId)}
                                {linkedBatch && (
                                    <span className="ml-3 px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-black uppercase">
                                        Партия: {linkedBatch.name}
                                    </span>
                                )}
                            </p>
                        </div>
                    </div>
                </div>
                <ReceivingForm
                    order={order}
                    state={state}
                    actions={actions}
                    batchId={selectedBatchId}
                    batchName={linkedBatch?.name}
                    onCancel={() => setView('list')}
                    onSave={handleSaveReception}
                />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center">
                        <PackageCheck className="mr-3 text-blue-600" size={28}/> Приемка
                    </h2>
                    <p className="text-slate-500 text-sm font-medium mt-1">Оприходование товаров на склад и распределение затрат</p>
                </div>
            </div>
            <PendingOrders orders={state.orders} onSelect={handleOrderSelect} />
            <ReceivingHistory receptions={state.receptions} orders={state.orders} />
        </div>
    );
};
