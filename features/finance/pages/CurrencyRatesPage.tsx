import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '@/features/system/context/GlobalStore';
import { Currency, PricingMethod } from '@/types';
import { RefreshCcw, DollarSign, Coins, Calculator, Loader2, CheckCircle, AlertCircle, Save } from 'lucide-react';
import { PricingService } from '@/services/PricingService';

export const CurrencyRatesPage: React.FC = () => {
    const { state, actions } = useStore();
    const { exchangeRates, products, bundles, pricingProfiles, optionVariants } = state;
    
    const [isRecalculating, setIsRecalculating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [lastUpdate, setLastUpdate] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showConfirmModal, setShowConfirmModal] = useState(false);

    // Локальное состояние для строковых значений инпутов (чтобы можно было стирать всё и ставить запятые)
    const [inputValues, setInputValues] = useState<Record<Currency, string>>({
        [Currency.USD]: exchangeRates[Currency.USD]?.toString() || '0',
        [Currency.EUR]: exchangeRates[Currency.EUR]?.toString() || '0',
        [Currency.CNY]: exchangeRates[Currency.CNY]?.toString() || '0',
        [Currency.RUB]: exchangeRates[Currency.RUB]?.toString() || '0',
        [Currency.KZT]: '1'
    });

    // Синхронизация при загрузке данных
    useEffect(() => {
        setInputValues({
            [Currency.USD]: exchangeRates[Currency.USD]?.toString() || '0',
            [Currency.EUR]: exchangeRates[Currency.EUR]?.toString() || '0',
            [Currency.CNY]: exchangeRates[Currency.CNY]?.toString() || '0',
            [Currency.RUB]: exchangeRates[Currency.RUB]?.toString() || '0',
            [Currency.KZT]: '1'
        });
    }, [exchangeRates]);

    // Проверка, есть ли отличия между инпутами и сохраненными в БД курсами
    const hasUnsavedChanges = useMemo(() => {
        return (Object.keys(inputValues) as Currency[]).some((curr) => {
            if (curr === Currency.KZT) return false;
            const val = inputValues[curr];
            const numVal = parseFloat(val.replace(',', '.'));
            return !isNaN(numVal) && numVal !== exchangeRates[curr];
        });
    }, [inputValues, exchangeRates]);

    // Проверка, нужен ли глобальный пересчет
    const [needGlobalSync, setNeedGlobalSync] = useState(false);

    const currencies = [Currency.USD, Currency.EUR, Currency.CNY, Currency.RUB];

    const handleInputChange = (c: Currency, val: string) => {
        // Разрешаем только цифры, точки и запятые
        const sanitized = val.replace(/[^0-9.,]/g, '');
        setInputValues(prev => ({ ...prev, [c]: sanitized }));
        setNeedGlobalSync(false); // Сбрасываем флаг синхронизации при новом вводе
    };

    const handleSaveRates = async () => {
        setIsSaving(true);
        setError(null);
        try {
            for (const c of currencies) {
                const numVal = parseFloat(inputValues[c].replace(',', '.'));
                if (!isNaN(numVal) && numVal !== exchangeRates[c]) {
                    await actions.updateExchangeRate(c, numVal);
                }
            }
            setNeedGlobalSync(true);
            await actions.addLog('Update', 'System', 'CurrencyRates', 'Обновлены базовые курсы валют в базе данных');
        } catch (e: any) {
            setError(e.message || "Ошибка при сохранении курсов");
        } finally {
            setIsSaving(false);
        }
    };

    const executeRecalculation = async () => {
        setError(null);
        setIsRecalculating(true);
        setShowConfirmModal(false);
        
        try {
            let prodUpdates = 0;
            let bundleUpdates = 0;

            // Пересчет товаров
            for (const product of products) {
                const profile = PricingService.findProfile(product, pricingProfiles);
                const productVolume = product.packages?.reduce((sum, p) => sum + (p.volumeM3 || 0), 0) || 0;
                const economy = PricingService.calculateSmartPrice(product, profile, exchangeRates, productVolume);
                
                // Если профиль найден, метод ДОЛЖЕН стать PROFILE. 
                // Если нет - оставляем текущий или ставим дефолт.
                const targetMethod = profile ? PricingMethod.PROFILE : (product.pricingMethod || PricingMethod.MARKUP_WITHOUT_VAT);

                if (economy.finalPrice !== product.salesPrice || product.pricingMethod !== targetMethod || (profile && product.pricingProfileId !== profile.id)) {
                    await actions.updateProduct({
                        ...product,
                        salesPrice: economy.finalPrice,
                        pricingMethod: targetMethod,
                        pricingProfileId: profile?.id || product.pricingProfileId
                    });
                    prodUpdates++;
                }
            }

            // Пересчет шаблонов
            for (const bundle of bundles) {
                const baseMachine = products.find(p => p.id === bundle.baseProductId);
                if (!baseMachine) continue;

                const profile = PricingService.findProfile(baseMachine, pricingProfiles);
                const newPurchaseForeign = PricingService.calculateBundlePurchasePrice(
                    baseMachine,
                    bundle.selectedVariantIds,
                    optionVariants,
                    exchangeRates
                );

                const economy = PricingService.calculateSmartPrice(
                    baseMachine,
                    profile,
                    exchangeRates,
                    baseMachine.volumeM3,
                    newPurchaseForeign
                );

                if (economy.finalPrice !== bundle.totalPrice) {
                    await actions.updateBundle({
                        ...bundle,
                        totalPrice: economy.finalPrice,
                        totalPurchasePrice: newPurchaseForeign
                    });
                    bundleUpdates++;
                }
            }

            setLastUpdate(`${new Date().toLocaleTimeString()} (товаров: ${prodUpdates}, шаблонов: ${bundleUpdates})`);
            setNeedGlobalSync(false);
            
            await actions.addLog('Update', 'System', 'CurrencyRates', `Массовый пересчет цен завершен. Обновлено объектов: ${prodUpdates + bundleUpdates}`);

        } catch (error: any) {
            console.error("Recalculation error:", error);
            setError(error.message || "Ошибка при обращении к базе данных");
        } finally {
            setIsRecalculating(false);
        }
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto relative animate-in fade-in duration-500">
            {/* Unified Header Style */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center">
                        <RefreshCcw className="mr-3 text-indigo-600" size={28} /> Курсы валют
                    </h2>
                    <p className="text-slate-500 text-sm font-medium mt-1">Управление стоимостью валют относительно тенге (KZT)</p>
                </div>

                <div className="flex gap-3">
                    {hasUnsavedChanges && (
                        <button 
                            onClick={handleSaveRates}
                            disabled={isSaving}
                            className="flex items-center px-6 py-2.5 bg-blue-600 text-white rounded-xl font-black shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95 uppercase text-[10px] tracking-widest"
                        >
                            {isSaving ? <Loader2 size={16} className="animate-spin mr-2"/> : <Save size={16} className="mr-2"/>}
                            Сохранить
                        </button>
                    )}
                    
                    <button 
                        onClick={() => setShowConfirmModal(true)}
                        disabled={isRecalculating || hasUnsavedChanges}
                        className={`flex items-center px-6 py-2.5 rounded-xl font-black transition-all shadow-lg uppercase text-[10px] tracking-widest ${
                            needGlobalSync 
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-200 ring-4 ring-emerald-500/20 animate-pulse' 
                            : 'bg-slate-100 text-slate-400'
                        } disabled:opacity-50 disabled:cursor-not-allowed active:scale-95`}
                    >
                        {isRecalculating ? (
                            <>
                                <Loader2 size={16} className="mr-2 animate-spin"/>
                                Обновление...
                            </>
                        ) : (
                            <>
                                <Calculator size={16} className="mr-2"/>
                                Пересчитать цены
                            </>
                        )}
                    </button>
                </div>
            </div>

            {needGlobalSync && !isRecalculating && (
                <div className="bg-emerald-50 border-l-4 border-emerald-500 p-5 rounded-r-2xl flex items-center justify-between shadow-sm animate-in slide-in-from-top-4">
                    <div className="flex items-center">
                        <CheckCircle className="text-emerald-500 mr-3" size={24}/>
                        <div>
                            <span className="text-emerald-900 text-sm font-black uppercase tracking-tight block">Курсы успешно сохранены!</span>
                            <span className="text-emerald-700 text-xs font-medium">Теперь рекомендуется запустить глобальный пересчет для обновления всех цен в каталоге.</span>
                        </div>
                    </div>
                    <button onClick={() => setShowConfirmModal(true)} className="text-xs bg-emerald-600 text-white px-4 py-2 rounded-xl font-black uppercase tracking-widest hover:bg-emerald-700 transition-colors shadow-md shadow-emerald-200">Пересчитать сейчас</button>
                </div>
            )}

            {error && (
                <div className="bg-red-50 border border-red-100 p-4 rounded-xl flex items-center text-red-700 text-sm font-bold">
                    <AlertCircle size={20} className="mr-3"/>
                    {error}
                </div>
            )}

            {lastUpdate && !error && !hasUnsavedChanges && !needGlobalSync && (
                <div className="bg-slate-900 text-white p-4 rounded-xl flex items-center text-sm font-bold shadow-xl">
                    <CheckCircle size={18} className="mr-3 text-emerald-400"/>
                    Цены товаров синхронизированы в {lastUpdate}.
                </div>
            )}

            <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-200">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                    {currencies.map(c => {
                        const isChanged = inputValues[c] !== exchangeRates[c].toString();
                        return (
                            <div key={c} className={`p-6 rounded-3xl border-2 transition-all duration-300 ${isChanged ? 'bg-blue-50 border-blue-400 shadow-xl scale-[1.02]' : 'bg-slate-50 border-slate-100'}`}>
                                <div className="flex items-center justify-between mb-4">
                                    <span className={`font-black text-xl ${isChanged ? 'text-blue-700' : 'text-slate-400'}`}>{c}</span>
                                    {isChanged ? <RefreshCcw size={18} className="text-blue-500 animate-spin-slow"/> : <Coins size={18} className="text-slate-300"/>}
                                </div>
                                <div className="flex items-center relative">
                                    <input 
                                        type="text" 
                                        className="w-full text-3xl font-black text-slate-800 bg-white border border-slate-200 rounded-2xl p-3 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all shadow-sm"
                                        value={inputValues[c]}
                                        onChange={(e) => handleInputChange(c, e.target.value)}
                                        placeholder="0.00"
                                    />
                                    <span className="ml-3 font-black text-slate-300 text-xl">₸</span>
                                </div>
                                {isChanged && <div className="text-[10px] font-black text-blue-500 uppercase mt-3 tracking-widest flex items-center gap-1 animate-pulse"><AlertCircle size={10}/> Сохраните курс</div>}
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none"><DollarSign size={160}/></div>
                <h3 className="font-black text-slate-500 text-[10px] uppercase tracking-[0.3em] mb-6 flex items-center"><Calculator size={14} className="mr-2"/> Справочные кросс-курсы</h3>
                <div className="grid grid-cols-3 gap-8 relative z-10">
                    <div className="p-5 bg-slate-800/50 rounded-2xl border border-white/5 backdrop-blur-sm">
                        <span className="block text-[10px] text-slate-500 uppercase font-black mb-2 tracking-widest">USD / CNY</span>
                        <span className="text-2xl font-mono font-black text-blue-400 tracking-tighter">{(parseFloat(inputValues[Currency.USD].replace(',', '.')) / parseFloat(inputValues[Currency.CNY].replace(',', '.')) || 0).toFixed(4)}</span>
                    </div>
                    <div className="p-5 bg-slate-800/50 rounded-2xl border border-white/5 backdrop-blur-sm">
                        <span className="block text-[10px] text-slate-500 uppercase font-black mb-2 tracking-widest">EUR / USD</span>
                        <span className="text-2xl font-mono font-black text-emerald-400 tracking-tighter">{(parseFloat(inputValues[Currency.EUR].replace(',', '.')) / parseFloat(inputValues[Currency.USD].replace(',', '.')) || 0).toFixed(4)}</span>
                    </div>
                    <div className="p-5 bg-slate-800/50 rounded-2xl border border-white/5 backdrop-blur-sm">
                        <span className="block text-[10px] text-slate-500 uppercase font-black mb-2 tracking-widest">CNY / RUB</span>
                        <span className="text-2xl font-mono font-black text-purple-400 tracking-tighter">{(parseFloat(inputValues[Currency.CNY].replace(',', '.')) / parseFloat(inputValues[Currency.RUB].replace(',', '.')) || 0).toFixed(4)}</span>
                    </div>
                </div>
            </div>

            {showConfirmModal && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-[3rem] shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200">
                        <div className="p-10 text-center">
                            <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-8">
                                <Calculator size={48} className="text-blue-600"/>
                            </div>
                            <h3 className="text-2xl font-black text-slate-800 mb-4 uppercase tracking-tight">Глобальное обновление цен</h3>
                            <p className="text-slate-500 leading-relaxed mb-10 font-medium">
                                Будут пересчитаны продажные цены для всех товаров (<b>{products.length} шт.</b>) и шаблонов (<b>{bundles.length} шт.</b>) на основе новых курсов. 
                            </p>
                            <div className="flex flex-col gap-3">
                                <button 
                                    onClick={executeRecalculation}
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-blue-200 transition-all flex items-center justify-center active:scale-95"
                                >
                                    <CheckCircle size={24} className="mr-3"/> ПЕРЕСЧИТАТЬ ВСЁ
                                </button>
                                <button 
                                    onClick={() => setShowConfirmModal(false)}
                                    className="w-full py-4 text-slate-400 font-black uppercase text-xs tracking-widest hover:text-slate-600 transition-colors"
                                >
                                    ОТМЕНА
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
