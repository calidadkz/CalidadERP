
import React, { useState, useMemo } from 'react';
import { Product, ProductCategory } from '@/types/product';
import { ProductType } from '@/types/enums';
import { Currency } from '@/types/currency';
import { Counterparty as Supplier, Manufacturer } from '@/types/counterparty';
import { Search, Plus, Pencil, Trash2, X, Box, Package, Wrench, Copy, ChevronRight } from 'lucide-react';
import { useAccess } from '@/features/auth/hooks/useAccess';
import { MobileProductForm } from './MobileProductForm';

interface MobileNomenclatureViewProps {
    products: Product[];
    suppliers: Supplier[];
    categories: ProductCategory[];
    manufacturers: Manufacturer[];
    exchangeRates: Record<Currency, number>;
    onSave: (p: Product) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
}

const TYPE_CONFIG = [
    { type: ProductType.PART,    label: 'Запчасти', Icon: Wrench },
    { type: ProductType.MACHINE, label: 'Станки',   Icon: Box },
    { type: ProductType.SERVICE, label: 'Услуги',   Icon: Package },
];

const StockBadge: React.FC<{ product: Product }> = ({ product }) => {
    const cls = product.stock <= 0
        ? 'bg-red-100 text-red-600'
        : product.stock <= (product.minStock || 0)
            ? 'bg-amber-100 text-amber-700'
            : 'bg-emerald-100 text-emerald-700';
    return (
        <span className={`text-[11px] font-bold rounded-lg px-2 py-0.5 ${cls}`}>
            {product.stock} шт
        </span>
    );
};

const ProductCard: React.FC<{
    product: Product;
    suppliers: Supplier[];
    categories: ProductCategory[];
    canWrite: boolean;
    onEdit: () => void;
    onCopy: () => void;
    onDelete: () => void;
}> = ({ product, suppliers, categories, canWrite, onEdit, onCopy, onDelete }) => {
    const supplier = suppliers.find(s => s.id === product.supplierId);
    const category = categories.find(c => c.id === product.categoryId);

    return (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            {/* Основное тело карточки */}
            <div className="flex gap-3 p-3.5">
                {/* Изображение */}
                <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center flex-none overflow-hidden self-start">
                    {product.imageUrl ? (
                        <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                        <Wrench size={20} className="text-slate-300" />
                    )}
                </div>

                {/* Информация */}
                <div className="flex-1 min-w-0">
                    {/* Название + остаток */}
                    <div className="flex items-start justify-between gap-2">
                        <div className="text-sm font-bold text-slate-800 leading-snug flex-1">{product.name}</div>
                        <StockBadge product={product} />
                    </div>

                    {/* Артикул */}
                    <div className="text-xs text-slate-400 font-mono mt-0.5 truncate">{product.sku}</div>

                    {/* Теги */}
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {category && (
                            <span className="text-[11px] bg-slate-100 text-slate-500 rounded-md px-2 py-0.5 font-medium">
                                {category.name}
                            </span>
                        )}
                        {supplier && (
                            <span className="text-[11px] bg-blue-50 text-blue-600 rounded-md px-2 py-0.5 font-medium">
                                {supplier.name}
                            </span>
                        )}
                        {product.manufacturer && (
                            <span className="text-[11px] bg-slate-50 text-slate-400 rounded-md px-2 py-0.5 font-medium">
                                {product.manufacturer}
                            </span>
                        )}
                    </div>

                    {/* Цена */}
                    <div className="flex items-center gap-3 mt-2">
                        {product.salesPrice ? (
                            <span className="text-sm font-black text-slate-800">
                                {Math.round(product.salesPrice).toLocaleString()} ₸
                            </span>
                        ) : null}
                        {product.basePrice > 0 && (
                            <span className="text-xs text-slate-400">
                                {product.basePrice} {product.currency}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Кнопки действий */}
            {canWrite && (
                <div className="flex border-t border-slate-100">
                    <button
                        onClick={onEdit}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold text-blue-600 hover:bg-blue-50 transition-colors"
                    >
                        <Pencil size={13} />
                        Изменить
                    </button>
                    <div className="w-px bg-slate-100" />
                    <button
                        onClick={onCopy}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-50 transition-colors"
                    >
                        <Copy size={13} />
                        Дублировать
                    </button>
                    <div className="w-px bg-slate-100" />
                    <button
                        onClick={onDelete}
                        className="px-5 flex items-center justify-center text-red-400 hover:bg-red-50 transition-colors"
                    >
                        <Trash2 size={15} />
                    </button>
                </div>
            )}
        </div>
    );
};

export const MobileNomenclatureView: React.FC<MobileNomenclatureViewProps> = ({
    products, suppliers, categories, manufacturers, exchangeRates, onSave, onDelete
}) => {
    const access = useAccess('nomenclature');
    const canWrite = access.canWrite('actions', 'create');

    const [selectedType, setSelectedType] = useState<ProductType>(ProductType.PART);
    const [selectedMachineCatId, setSelectedMachineCatId] = useState<string | 'all'>('all');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | 'all'>('all');
    const [searchQuery, setSearchQuery] = useState('');

    const [formOpen, setFormOpen] = useState(false);
    const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
    const [formInitial, setFormInitial] = useState<Partial<Product>>({});

    const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; id: string; name: string }>({ show: false, id: '', name: '' });
    const [deleteError, setDeleteError] = useState<string | null>(null);

    const machineCategories = useMemo(() =>
        categories.filter(c => c.type === ProductType.MACHINE).sort((a, b) => a.name.localeCompare(b.name, 'ru')),
        [categories]
    );

    const partCategories = useMemo(() =>
        categories.filter(c => c.type === selectedType).sort((a, b) => a.name.localeCompare(b.name, 'ru')),
        [categories, selectedType]
    );

    const filteredProducts = useMemo(() => {
        let list = products.filter(p => p.type === selectedType);
        if (selectedType === ProductType.PART && selectedMachineCatId !== 'all') {
            list = list.filter(p => (p.compatibleMachineCategoryIds || []).includes(selectedMachineCatId));
        }
        if (selectedType === ProductType.MACHINE && selectedMachineCatId !== 'all') {
            list = list.filter(p => p.categoryId === selectedMachineCatId);
        }
        if (selectedCategoryId !== 'all') {
            list = list.filter(p => p.categoryId === selectedCategoryId);
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            list = list.filter(p =>
                p.name?.toLowerCase().includes(q) ||
                p.sku?.toLowerCase().includes(q) ||
                p.supplierProductName?.toLowerCase().includes(q) ||
                p.manufacturer?.toLowerCase().includes(q)
            );
        }
        return list;
    }, [products, selectedType, selectedMachineCatId, selectedCategoryId, searchQuery]);

    const handleTypeChange = (type: ProductType) => {
        setSelectedType(type);
        setSelectedMachineCatId('all');
        setSelectedCategoryId('all');
    };

    const handleAdd = () => {
        setFormMode('create');
        setFormInitial({ type: selectedType, currency: Currency.Cny, markupPercentage: 80 });
        setFormOpen(true);
    };

    const handleEdit = (product: Product) => {
        setFormMode('edit');
        setFormInitial(product);
        setFormOpen(true);
    };

    const handleCopy = (product: Product) => {
        const { id, ...rest } = product;
        setFormMode('create');
        setFormInitial({ ...rest, sku: `${rest.sku}_copy` });
        setFormOpen(true);
    };

    const handleDeleteRequest = (id: string, name: string) => {
        setDeleteError(null);
        setDeleteConfirm({ show: true, id, name });
    };

    const handleDeleteConfirm = async () => {
        try {
            await onDelete(deleteConfirm.id);
            setDeleteConfirm({ show: false, id: '', name: '' });
        } catch (e: any) {
            setDeleteError(e.message || 'Ошибка удаления');
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-100 overflow-hidden">

            <MobileProductForm
                isOpen={formOpen}
                onClose={() => setFormOpen(false)}
                onSave={async (p) => { await onSave(p); setFormOpen(false); }}
                mode={formMode}
                initialData={formInitial}
                suppliers={suppliers}
                categories={categories}
                manufacturers={manufacturers}
                machineCategories={machineCategories}
                exchangeRates={exchangeRates}
                products={products}
            />

            {/* Подтверждение удаления */}
            {deleteConfirm.show && (
                <div className="fixed inset-0 bg-slate-900/60 z-[300] flex items-end justify-center p-4">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl">
                        <Trash2 size={28} className="text-red-500 mx-auto mb-3" />
                        <h3 className="text-base font-black text-slate-800 text-center mb-1">Удалить в корзину?</h3>
                        <p className="text-sm text-slate-500 text-center mb-4 break-words">«{deleteConfirm.name}»</p>
                        {deleteError && (
                            <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2 mb-3 text-center">{deleteError}</p>
                        )}
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteConfirm({ show: false, id: '', name: '' })} className="flex-1 py-3 text-slate-500 font-bold bg-slate-100 rounded-2xl text-sm">Отмена</button>
                            {!deleteError && (
                                <button onClick={handleDeleteConfirm} className="flex-1 py-3 bg-red-600 text-white rounded-2xl font-bold text-sm">Удалить</button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── ШАПКА ─────────────────────────────────────────────── */}
            <div className="bg-white shadow-sm flex-none">
                {/* Строка 1: заголовок + кнопка */}
                <div className="flex items-center justify-between px-4 pt-3 pb-2">
                    <div>
                        <h1 className="text-lg font-black text-slate-800 uppercase italic leading-none">Номенклатура</h1>
                        <div className="text-xs text-slate-400 font-semibold mt-0.5">{filteredProducts.length} позиций</div>
                    </div>
                    {canWrite && (
                        <button
                            onClick={handleAdd}
                            className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-2.5 rounded-xl font-bold text-sm shadow-md shadow-blue-600/25 active:scale-95 transition-transform flex-none"
                        >
                            <Plus size={16} />
                            Добавить
                        </button>
                    )}
                </div>

                {/* Строка 2: поиск */}
                <div className="px-4 pb-2">
                    <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2.5">
                        <Search size={15} className="text-slate-400 flex-none" />
                        <input
                            type="text"
                            className="flex-1 bg-transparent text-[15px] outline-none text-slate-800 placeholder:text-slate-400"
                            placeholder="Поиск по названию, артикулу..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} className="p-0.5 text-slate-400">
                                <X size={14} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Строка 3: тип товара */}
                <div className="px-4 pb-2">
                    <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl">
                        {TYPE_CONFIG.map(({ type, label, Icon }) => {
                            const count = products.filter(p => p.type === type).length;
                            return (
                                <button
                                    key={type}
                                    onClick={() => handleTypeChange(type)}
                                    className={`py-2 rounded-lg text-xs font-bold transition-all flex flex-col items-center ${
                                        selectedType === type ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'
                                    }`}
                                >
                                    <Icon size={13} className="mb-0.5" />
                                    {label}
                                    <span className={`text-[10px] font-black leading-none mt-0.5 ${selectedType === type ? 'text-blue-400' : 'text-slate-400'}`}>
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Строка 4: фильтр станков */}
                {machineCategories.length > 0 && (
                    <div className="px-4 pb-2 overflow-x-auto">
                        <div className="flex gap-1.5 w-max">
                            <button
                                onClick={() => setSelectedMachineCatId('all')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap ${selectedMachineCatId === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500'}`}
                            >
                                Все станки
                            </button>
                            {machineCategories.map(mc => {
                                const count = selectedType === ProductType.PART
                                    ? products.filter(p => p.type === selectedType && (p.compatibleMachineCategoryIds || []).includes(mc.id)).length
                                    : products.filter(p => p.type === selectedType && p.categoryId === mc.id).length;
                                return (
                                    <button
                                        key={mc.id}
                                        onClick={() => setSelectedMachineCatId(selectedMachineCatId === mc.id ? 'all' : mc.id)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap ${
                                            selectedMachineCatId === mc.id ? 'bg-slate-800 text-white' : count > 0 ? 'bg-slate-100 text-slate-600' : 'bg-slate-50 text-slate-300'
                                        }`}
                                    >
                                        {mc.name}{count > 0 && <span className="ml-1 opacity-60">{count}</span>}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Строка 5: фильтр категорий */}
                {partCategories.length > 0 && (
                    <div className="px-4 pb-3 overflow-x-auto">
                        <div className="flex gap-1.5 w-max">
                            <button
                                onClick={() => setSelectedCategoryId('all')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap ${selectedCategoryId === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}
                            >
                                Все
                            </button>
                            {partCategories.map(cat => {
                                const count = products.filter(p =>
                                    p.type === selectedType && p.categoryId === cat.id &&
                                    (selectedMachineCatId === 'all' || (p.compatibleMachineCategoryIds || []).includes(selectedMachineCatId))
                                ).length;
                                return (
                                    <button
                                        key={cat.id}
                                        onClick={() => setSelectedCategoryId(selectedCategoryId === cat.id ? 'all' : cat.id)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap ${
                                            selectedCategoryId === cat.id ? 'bg-blue-600 text-white' : count > 0 ? 'bg-slate-100 text-slate-600' : 'bg-slate-50 text-slate-300'
                                        }`}
                                    >
                                        {cat.name}{count > 0 && <span className="ml-1 opacity-70">{count}</span>}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* ── СПИСОК ────────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
                {filteredProducts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-16 h-16 bg-white rounded-2xl border border-slate-200 flex items-center justify-center mb-4">
                            <Search size={26} className="text-slate-300" />
                        </div>
                        <div className="text-base font-bold text-slate-500">
                            {searchQuery ? 'Ничего не найдено' : 'Позиции ещё не добавлены'}
                        </div>
                        <div className="text-sm text-slate-400 mt-1">
                            {searchQuery ? 'Попробуйте другой запрос' : 'Нажмите «Добавить» чтобы создать первую'}
                        </div>
                        {canWrite && !searchQuery && (
                            <button onClick={handleAdd} className="mt-4 flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-2xl font-bold text-sm">
                                <Plus size={16} /> Добавить
                            </button>
                        )}
                    </div>
                ) : (
                    filteredProducts.map(product => (
                        <ProductCard
                            key={product.id}
                            product={product}
                            suppliers={suppliers}
                            categories={categories}
                            canWrite={canWrite}
                            onEdit={() => handleEdit(product)}
                            onCopy={() => handleCopy(product)}
                            onDelete={() => handleDeleteRequest(product.id, product.name)}
                        />
                    ))
                )}
                <div className="h-4" />
            </div>
        </div>
    );
};
