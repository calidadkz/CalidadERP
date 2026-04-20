
import React, { useState, useCallback, useMemo, Suspense } from 'react';
import { Product, ProductType, Currency, Counterparty, OptionType, OptionVariant } from '@/types';
import { Download, Upload, Loader2, CheckCircle, AlertCircle, Box, Trash2, Monitor, Filter, Layers, ChevronRight, ChevronLeft, Hash, Tags } from 'lucide-react';
import { useStore } from '../system/context/GlobalStore';
import { NomenclatureTable } from './components/NomenclatureTable';
import { ProductModal } from './components/ProductModal';
import { useAccess } from '../auth/hooks/useAccess';

const MobileNomenclatureView = React.lazy(() =>
    import('./components/MobileNomenclatureView').then(m => ({ default: m.MobileNomenclatureView }))
);
import { useNomenclatureState } from './hooks/useNomenclatureState';
import { useNomenclatureImportExport } from './hooks/useNomenclatureImportExport';
import { useNomenclatureCRUD } from './hooks/useNomenclatureCRUD';
import { useIsMobile } from './hooks/useIsMobile';

const SidebarItem = ({ label, count, isActive, onClick, icon: Icon, isDimmed }: { label: string, count?: number, isActive: boolean, onClick: () => void, icon?: React.ElementType, isDimmed?: boolean }) => (
    <button 
        onClick={onClick}
        className={`w-full flex items-center justify-between px-4 py-2 min-h-[36px] h-auto rounded-xl text-[10px] font-bold transition-colors duration-75 select-none outline-none ${
            isActive 
            ? 'bg-blue-600 text-white' 
            : isDimmed ? 'text-slate-300 opacity-40 hover:opacity-100 hover:bg-slate-50 hover:text-slate-500' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
        }`}
    >
        <div className="flex items-center gap-2.5 w-full">
            {Icon && <Icon size={14} className={`flex-none ${isActive ? 'text-white' : isDimmed ? 'text-slate-200' : 'text-slate-300'}`} />}
            <span className="whitespace-normal text-left leading-tight break-words">{label}</span>
        </div>
        {count !== undefined && (
            <span className={`text-[8px] px-1.5 py-0.5 rounded-md font-black min-w-[18px] text-center leading-none flex-none ml-2 ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-400'}`}>
                {count}
            </span>
        )}
    </button>
);

export const NomenclaturePage: React.FC = () => {
    const { state, actions } = useStore();
    const access = useAccess('nomenclature');
    const isMobile = useIsMobile();

    const {
        selectedType,
        selectedMachineCatId,
        setSelectedMachineCatId,
        selectedCategoryId,
        setSelectedCategoryId,
        machineCategories,
        subCategoriesWithCounts,
        displayedProducts,
        handleTypeChange,
    } = useNomenclatureState();

    const { 
        fileInputRef, 
        importStatus, 
        setImportStatus, 
        handleExportCSV, 
        handleFileImport 
    } = useNomenclatureImportExport(selectedType);

    const {
        confirmDelete,
        isModalOpen,
        modalMode,
        modalInitialData,
        isCopy,
        setIsModalOpen,
        handleAdd,
        handleEdit,
        handleCopy,
        handleDelete,
        confirmDeleteAction,
        cancelDelete,
        deleteError,
        onSave,
    } = useNomenclatureCRUD(selectedType);

    const [isSidebarVisible, setIsSidebarVisible] = useState(true);
    const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);

    const handleInlineUpdate = useCallback(async (product: Product) => {
        try {
            await actions.updateProduct(product);
        } catch (e) {
            console.error('Inline update failed', e);
        }
    }, [actions]);

    const handleMassUpdate = useCallback(async (ids: string[], changes: Partial<Product>) => {
        const targets = (state.products || []).filter(p => ids.includes(p.id));
        await Promise.all(targets.map(p => actions.updateProduct({ ...p, ...changes })));
    }, [state.products, actions]);

    const handleFilteredProductsChange = useCallback((newFilteredList: Product[]) => {
        setFilteredProducts(prev => {
            if (prev.length === newFilteredList.length && (prev.length === 0 || prev[0].id === newFilteredList[0].id)) {
                return prev;
            }
            return newFilteredList;
        });
    }, []);

    // ФИЛЬТРУЕМ ПОСТАВЩИКОВ ИЗ КОНТРАГЕНТОВ
    const suppliers = useMemo(() => 
        (state.counterparties || []).filter(c => c.type === 'Supplier'),
    [state.counterparties]);

    const handleAddOptionType = async (ot: OptionType) => {
        await actions.addOptionType(ot);
    };

    const handleAddOptionVariant = async (ov: OptionVariant) => {
        await actions.addOptionVariant(ov);
    };

    if (!state || !state.products) {
        return <div className="flex items-center justify-center h-full">Загрузка данных...</div>;
    }

    // Мобильная версия
    if (isMobile) {
        return (
            <Suspense fallback={null}>
                <MobileNomenclatureView
                    products={state.products || []}
                    suppliers={suppliers}
                    categories={state.categories || []}
                    manufacturers={state.manufacturers || []}
                    exchangeRates={state.exchangeRates}
                    onSave={onSave}
                    onDelete={actions.deleteProduct}
                />
            </Suspense>
        );
    }

    return (
        <div className="flex h-[calc(100vh-50px)] gap-6 overflow-hidden">
            <input type="file" ref={fileInputRef} onChange={handleFileImport} accept=".csv" className="hidden" />

            <aside className={`bg-white rounded-[2rem] border border-slate-200 flex flex-col shadow-sm overflow-hidden transition-all duration-300 ease-in-out relative ${isSidebarVisible ? 'w-72' : 'w-0 border-none'}`}>
                <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex-none h-[88px]">
                    <div className="flex bg-slate-200 p-1 rounded-xl shadow-inner h-full items-center">
                        <button onClick={() => handleTypeChange(ProductType.MACHINE)} className={`flex-1 h-full rounded-lg text-[9px] font-black uppercase transition-all ${selectedType === ProductType.MACHINE ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Станки</button>
                        <button onClick={() => handleTypeChange(ProductType.PART)} className={`flex-1 h-full rounded-lg text-[9px] font-black uppercase transition-all ${selectedType === ProductType.PART ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Запчасти</button>
                        <button onClick={() => handleTypeChange(ProductType.SERVICE)} className={`flex-1 h-full rounded-lg text-[9px] font-black uppercase transition-all ${selectedType === ProductType.SERVICE ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Услуги</button>
                    </div>
                </div>

                <div className="flex-1 grid grid-rows-2 min-h-0 overflow-hidden">
                    <div className="flex flex-col min-h-0 border-b border-slate-100 overflow-hidden">
                        <div className="px-5 flex items-center h-10 bg-white flex-none">
                            <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Monitor size={14}/> ТИП ОБОРУДОВАНИЯ</h3>
                        </div>
                        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1 custom-scrollbar">
                            <SidebarItem label={`Все типы`} isActive={selectedMachineCatId === 'all'} onClick={() => { setSelectedMachineCatId('all'); setSelectedCategoryId('all'); }} icon={Hash} count={(state.products || []).filter(p => p.type === selectedType).length} />
                            {machineCategories.map(c => {
                                const count = (state.products || []).filter(p => {
                                    if (selectedType === ProductType.MACHINE) return p.categoryId === c.id;
                                    return p.type === selectedType && (p.compatibleMachineCategoryIds || []).includes(c.id);
                                }).length;
                                return <SidebarItem key={c.id} label={c.name} count={count} isActive={selectedMachineCatId === c.id} onClick={() => { setSelectedMachineCatId(c.id); setSelectedCategoryId('all'); }} icon={Box} />;
                            })}
                        </div>
                    </div>

                    <div className="flex flex-col min-h-0 bg-slate-50/30 overflow-hidden">
                        {selectedType !== ProductType.MACHINE ? (
                            <>
                                <div className="px-5 flex items-center h-10 flex-none">
                                    <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Tags size={14}/> КАТЕГОРИЯ ТОВАРА</h3>
                                </div>
                                <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1 custom-scrollbar">
                                    <SidebarItem label={`Все категории`} isActive={selectedCategoryId === 'all'} onClick={() => setSelectedCategoryId('all')} icon={Hash} />
                                    {subCategoriesWithCounts.map(sc => (
                                        <SidebarItem key={sc.id} label={sc.name} count={sc.count} isActive={selectedCategoryId === sc.id} onClick={() => setSelectedCategoryId(sc.id)} isDimmed={sc.count === 0} icon={Layers} />
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center opacity-20 select-none">
                                 <Filter size={24} className="text-slate-400 mb-3"/>
                                 <p className="text-[8px] font-black uppercase tracking-widest leading-relaxed">Фильтры категорий только для запчастей</p>
                            </div>
                        )}
                    </div>
                </div>
            </aside>

            <div className="flex-1 flex flex-col space-y-4 min-w-0">
                <div className="flex justify-between items-center bg-white p-3.5 rounded-[2rem] border border-slate-200 shadow-sm flex-none">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                        <button onClick={() => setIsSidebarVisible(!isSidebarVisible)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-all border border-slate-100 shadow-sm">
                            {isSidebarVisible ? <ChevronLeft size={20}/> : <ChevronRight size={20}/>}
                        </button>
                        <div className="min-w-0">
                            <h2 className="text-lg font-black text-slate-800 uppercase italic truncate">{selectedType} Реестр</h2>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Результатов: <span className="text-blue-600 font-black">{filteredProducts.length}</span></div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={() => handleExportCSV(filteredProducts)} className="p-3 bg-white border border-slate-200 text-slate-400 hover:text-blue-600 rounded-2xl transition-all shadow-sm flex items-center gap-2">
                            <Download size={20}/><span className="text-[10px] font-black uppercase">{filteredProducts.length}</span>
                        </button>
                        {access.canWrite('actions', 'create') && (
                            <button onClick={() => fileInputRef.current?.click()} className="p-3 bg-white border border-slate-200 text-slate-400 hover:text-orange-600 rounded-2xl shadow-sm"><Upload size={20}/></button>
                        )}
                        {access.canWrite('actions', 'create') && (
                            <button onClick={handleAdd} className="bg-blue-600 text-white px-6 py-3 rounded-2xl shadow-xl font-black uppercase text-[10px] tracking-widest transition-all">Добавить</button>
                        )}
                    </div>
                </div>

                <div className="flex-1 overflow-hidden">
                    <NomenclatureTable
                        products={displayedProducts}
                        suppliers={suppliers}
                        categories={state.categories || []}
                        hscodes={state.hscodes || []}
                        manufacturers={(state.manufacturers || []).map((m: any) => m.name || m)}
                        exchangeRates={state.exchangeRates}
                        onEdit={handleEdit}
                        onCopy={handleCopy}
                        onDelete={handleDelete}
                        onFilteredDataChange={handleFilteredProductsChange}
                        onInlineUpdate={handleInlineUpdate}
                        onMassUpdate={handleMassUpdate}
                    />
                </div>
            </div>

            {importStatus.show && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[500] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-md w-full p-10 text-center border border-slate-100 animate-in zoom-in-95 duration-200">
                        {importStatus.type === 'loading' ? <Loader2 size={48} className="text-blue-600 animate-spin mx-auto mb-6" /> : importStatus.type === 'success' ? <CheckCircle size={48} className="text-emerald-500 mx-auto mb-6" /> : <AlertCircle size={48} className="text-red-500 mx-auto mb-6" />}
                        <h3 className="text-xl font-black text-slate-800 mb-2 uppercase tracking-tight">{importStatus.msg}</h3>
                        {importStatus.details && <div className="text-left bg-slate-50 p-4 rounded-xl mb-6 font-mono text-[10px] whitespace-pre-wrap text-slate-600 border border-slate-100 max-h-48 overflow-y-auto">{importStatus.details}</div>}
                        {importStatus.type !== 'loading' && <button onClick={() => setImportStatus({ ...importStatus, show: false })} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl">Вернуться</button>}
                    </div>
                </div>
            )}

            {confirmDelete.show && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl p-8 text-center border border-slate-100 max-w-sm w-full">
                        <Trash2 size={32} className="text-red-600 mx-auto mb-4" />
                        <h3 className="text-lg font-black text-slate-800 mb-2 uppercase">Удалить в корзину?</h3>
                        <p className="text-slate-500 text-sm mb-4">Товар «{confirmDelete.name}» будет перемещен в корзину.</p>
                        {deleteError && (
                            <p className="text-red-600 text-xs font-bold bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 text-left">{deleteError}</p>
                        )}
                        <div className="flex gap-3">
                            <button onClick={cancelDelete} className="flex-1 py-3 text-slate-400 font-bold hover:bg-slate-50 rounded-xl">Отмена</button>
                            {!deleteError && (
                                <button onClick={confirmDeleteAction} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold">Удалить</button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <ProductModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={onSave}
                modalMode={modalMode}
                isCopy={isCopy}
                initialData={modalInitialData} 
                suppliers={suppliers} 
                categories={state.categories || []} 
                optionTypes={state.optionTypes || []} 
                optionVariants={state.optionVariants || []} 
                products={state.products || []} 
                exchangeRates={state.exchangeRates} 
                manufacturers={state.manufacturers || []}
                addOptionType={handleAddOptionType} 
                addOptionVariant={handleAddOptionVariant} 
            />
        </div>
    );
};
