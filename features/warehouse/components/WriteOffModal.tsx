
import React, { useState, useMemo } from 'react';
import { X, AlertTriangle, Save } from 'lucide-react';
import { Product } from '@/types';
import { WriteOff, WriteOffDocument, WriteOffReasonType } from '@/types/inventory';
import { ApiService } from '@/services/api';
import { CalidadSelect } from '@/components/ui/CalidadSelect';
import { FileUpload } from '@/components/ui/FileUpload';

const COLOR_MAP: Record<string, string> = {
    red:    'bg-red-100 text-red-700 border-red-200',
    orange: 'bg-orange-100 text-orange-700 border-orange-200',
    amber:  'bg-amber-100 text-amber-700 border-amber-200',
    blue:   'bg-blue-100 text-blue-700 border-blue-200',
    slate:  'bg-slate-100 text-slate-600 border-slate-200',
    green:  'bg-green-100 text-green-700 border-green-200',
    purple: 'bg-purple-100 text-purple-700 border-purple-200',
};

interface WriteOffModalProps {
    products: Product[];
    reasonTypes: WriteOffReasonType[];
    onSubmit: (wo: WriteOff) => Promise<void>;
    onClose: () => void;
}

export const WriteOffModal: React.FC<WriteOffModalProps> = ({ products, reasonTypes, onSubmit, onClose }) => {
    const writeoffId = useMemo(() => ApiService.generateId('WO'), []);

    const [productId, setProductId] = useState('');
    const [quantity, setQuantity] = useState('');
    const [reasonTypeId, setReasonTypeId] = useState('');
    const [reasonNote, setReasonNote] = useState('');
    const [documents, setDocuments] = useState<WriteOffDocument[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    const productOptions = useMemo(
        () => products.map(p => ({ id: p.id, label: p.name, sub: p.sku })),
        [products]
    );

    const selectedProduct = products.find(p => p.id === productId);

    const handleAddDoc = (url: string, name: string) => {
        setDocuments(prev => [...prev, { name, url, uploadedAt: new Date().toISOString() }]);
    };

    const handleRemoveDoc = (idx: number) => {
        setDocuments(prev => prev.filter((_, i) => i !== idx));
    };

    const handleSubmit = async () => {
        if (!productId) { setError('Выберите товар'); return; }
        const qty = parseFloat(quantity);
        if (!qty || qty <= 0) { setError('Укажите количество > 0'); return; }

        setIsSaving(true);
        setError('');
        try {
            const wo: WriteOff = {
                id: writeoffId,
                date: new Date().toISOString().split('T')[0],
                productId,
                productName: selectedProduct?.name || '',
                sku: selectedProduct?.sku || '',
                quantity: qty,
                unitCostKzt: 0,
                reasonTypeId: reasonTypeId || undefined,
                reasonNote: reasonNote.trim() || undefined,
                documents,
            };
            await onSubmit(wo);
            onClose();
        } catch (e: any) {
            setError(e.message || 'Ошибка при сохранении');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl animate-in zoom-in-95 duration-200 flex flex-col">
                {/* Шапка */}
                <div className="flex items-center justify-between px-8 py-5 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-50 rounded-xl text-red-600"><AlertTriangle size={20}/></div>
                        <div>
                            <h2 className="text-base font-black text-slate-800 uppercase tracking-tight">Новое списание</h2>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{writeoffId}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
                        <X size={18}/>
                    </button>
                </div>

                {/* Тело */}
                <div className="px-8 py-6 space-y-5">
                    {/* Товар */}
                    <div>
                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Товар *</label>
                        <CalidadSelect
                            options={productOptions}
                            value={productId}
                            onChange={setProductId}
                            placeholder="Выберите товар..."
                            nullLabel={null}
                            className="w-full"
                        />
                    </div>

                    {/* Количество */}
                    <div>
                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Количество *</label>
                        <input
                            type="number"
                            min="0"
                            step="1"
                            className="w-32 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all"
                            placeholder="0"
                            value={quantity}
                            onChange={e => setQuantity(e.target.value)}
                        />
                    </div>

                    {/* Тип списания */}
                    <div>
                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Тип списания</label>
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => setReasonTypeId('')}
                                className={`px-3 py-1.5 rounded-lg border text-[11px] font-bold transition-all ${!reasonTypeId ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'}`}
                            >
                                Не указан
                            </button>
                            {reasonTypes.map(rt => (
                                <button
                                    key={rt.id}
                                    onClick={() => setReasonTypeId(rt.id)}
                                    className={`px-3 py-1.5 rounded-lg border text-[11px] font-bold transition-all ${
                                        reasonTypeId === rt.id
                                            ? COLOR_MAP[rt.color] || COLOR_MAP.slate
                                            : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                                    }`}
                                >
                                    {rt.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Причина (текст) */}
                    <div>
                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Комментарий / причина</label>
                        <textarea
                            rows={3}
                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 font-medium outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 resize-none transition-all"
                            placeholder="Опционально — опишите обстоятельства..."
                            value={reasonNote}
                            onChange={e => setReasonNote(e.target.value)}
                        />
                    </div>

                    {/* Документы */}
                    <div>
                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Документы / Фотографии</label>
                        <div className="grid grid-cols-3 gap-2">
                            {documents.map((doc, idx) => (
                                <FileUpload
                                    key={idx}
                                    label={doc.name || `Файл ${idx + 1}`}
                                    value={doc.url}
                                    fileName={doc.name}
                                    onUpload={() => {}}
                                    onRemove={() => handleRemoveDoc(idx)}
                                    folder={`writeoffs/${writeoffId}`}
                                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.heic"
                                />
                            ))}
                            {documents.length < 6 && (
                                <FileUpload
                                    label="Добавить файл"
                                    onUpload={handleAddDoc}
                                    onRemove={() => {}}
                                    folder={`writeoffs/${writeoffId}`}
                                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.heic"
                                />
                            )}
                        </div>
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 text-red-600 text-xs font-bold bg-red-50 px-4 py-3 rounded-xl border border-red-100">
                            <AlertTriangle size={14}/>
                            {error}
                        </div>
                    )}
                </div>

                {/* Футер */}
                <div className="px-8 py-4 border-t border-slate-100 flex justify-end gap-3">
                    <button onClick={onClose} className="px-5 py-2 text-slate-400 hover:text-slate-600 text-xs font-black uppercase tracking-widest transition-colors">
                        Отмена
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow transition-all disabled:opacity-50"
                    >
                        <Save size={14}/>
                        {isSaving ? 'Сохранение...' : 'Провести списание'}
                    </button>
                </div>
            </div>
        </div>
    );
};
