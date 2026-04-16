
import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bundle } from '@/types';
import { Box, Disc, Star, Wrench, ShieldAlert } from 'lucide-react';
import { ConfiguratorBuilder } from './components/ConfiguratorBuilder';
import { MobileConfiguratorBuilder } from './components/MobileConfiguratorBuilder';
import { TemplatesGallery } from './components/TemplatesGallery';
import { OptionsEditor } from './components/OptionsEditor';
import { MobileOptionsEditor } from './components/MobileOptionsEditor';
import { useAccess } from '../auth/hooks/useAccess';
import { useIsMobile } from '@/hooks/useIsMobile';

export const BundlesPage: React.FC = () => {
    const isMobile = useIsMobile();
    const accessBundles = useAccess('bundles');
    const accessOptions = useAccess('options_editor');
    
    const canSeeBuild = accessBundles.canSee('tabs', 'build_tab');
    const canSeeTemplates = accessBundles.canSee('tabs', 'templates_tab');

    const hasBundlesAccess = accessBundles.canSee('tabs', 'main');
    const hasOptionsAccess = accessOptions.canSee('tabs', 'main');
    const navigate = useNavigate();
    const location = useLocation();

    const mode = location.pathname === '/options' ? 'options' : 'configurator';
    
    const [configTab, setConfigTab] = useState<'build' | 'templates'>(canSeeBuild ? 'build' : 'templates');
    const [editingBundle, setEditingBundle] = useState<Bundle | null>(null);

    if (mode === 'configurator' && !hasBundlesAccess) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-30">
                <ShieldAlert size={64} className="mb-4" />
                <p className="font-black uppercase tracking-widest text-xs">Доступ к конфигуратору ограничен</p>
            </div>
        );
    }

    if (mode === 'options' && !hasOptionsAccess) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-30">
                <ShieldAlert size={64} className="mb-4" />
                <p className="font-black uppercase tracking-widest text-xs">Доступ к базе опций ограничен</p>
            </div>
        );
    }

    if (mode === 'options' && isMobile) {
        return <div className="h-full"><MobileOptionsEditor /></div>;
    }

    if (mode === 'configurator' && isMobile) {
        return (
            <div className="h-full flex flex-col overflow-hidden">
                {/* Мобильный переключатель вкладок */}
                {canSeeBuild && canSeeTemplates && (
                    <div className="flex-none flex bg-white border-b border-slate-200">
                        <button
                            onClick={() => setConfigTab('build')}
                            className={`flex-1 py-3 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-1.5 border-b-2 transition-all ${configTab === 'build' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400'}`}>
                            <Wrench size={13} /> {editingBundle ? 'Изменение' : 'Новая сборка'}
                        </button>
                        <button
                            onClick={() => { setConfigTab('templates'); setEditingBundle(null); }}
                            className={`flex-1 py-3 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-1.5 border-b-2 transition-all ${configTab === 'templates' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400'}`}>
                            <Star size={13} /> Шаблоны
                        </button>
                    </div>
                )}
                <div className="flex-1 min-h-0 relative">
                    {configTab === 'build'
                        ? <MobileConfiguratorBuilder editingBundle={editingBundle} onSaved={() => { setEditingBundle(null); setConfigTab('templates'); }} />
                        : <TemplatesGallery onLoad={(bundle) => { setEditingBundle(bundle); setConfigTab('build'); }} />}
                </div>
            </div>
        );
    }

    const handleEditBundle = (bundle: Bundle) => {
        setEditingBundle(bundle);
        setConfigTab('build');
    };

    return (
        <div className="h-[calc(100vh-40px)] flex flex-col space-y-4">
            <div className="flex justify-between items-center flex-none">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center">
                        {mode === 'configurator' ? <Box className="mr-3 text-blue-600" size={28} /> : <Disc className="mr-3 text-indigo-600" size={28} />}
                        {mode === 'configurator' ? 'Комплектации' : 'Опции'}
                    </h2>
                    <p className="text-slate-500 text-xs font-medium mt-0.5">
                        {mode === 'configurator' ? 'Управление составом и ценообразованием готовых сборок' : 'Настройка базы заменяемых компонентов'}
                    </p>
                </div>

                <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200">
                    {hasBundlesAccess && (
                        <button onClick={() => navigate('/bundles')} className={`px-5 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${mode === 'configurator' ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'text-slate-400 hover:text-slate-600'}`}>Комплектации</button>
                    )}
                    {hasOptionsAccess && (
                        <button onClick={() => navigate('/options')} className={`px-5 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${mode === 'options' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'text-slate-400 hover:text-slate-600'}`}>База опций</button>
                    )}
                </div>
            </div>

            {mode === 'configurator' ? (
                <div className="flex-1 flex flex-col min-h-0 space-y-4">
                    <div className="flex bg-slate-200/50 p-1 rounded-xl w-fit shadow-inner border border-slate-200">
                        {canSeeBuild && (
                            <button onClick={() => setConfigTab('build')} className={`px-6 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1.5 ${configTab === 'build' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-slate-300/50' : 'text-slate-500 hover:text-slate-700'}`}>
                                <Wrench size={12}/> {editingBundle ? 'ИЗМЕНЕНИЕ ШАБЛОНА' : 'СБОРКА НОВОЙ'}
                            </button>
                        )}
                        {canSeeTemplates && (
                            <button onClick={() => { setConfigTab('templates'); setEditingBundle(null); }} className={`px-6 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1.5 ${configTab === 'templates' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-slate-300/50' : 'text-slate-500 hover:text-slate-700'}`}>
                                <Star size={12}/> БИБЛИОТЕКА ШАБЛОНОВ
                            </button>
                        )}
                    </div>
                    <div className="flex-1 min-h-0">
                        {configTab === 'build' ? <ConfiguratorBuilder editingBundle={editingBundle} onSaved={() => { setEditingBundle(null); setConfigTab('templates'); }} /> : <TemplatesGallery onLoad={handleEditBundle}/>}
                    </div>
                </div>
            ) : (
                <div className="flex-1 min-h-0">
                    <OptionsEditor />
                </div>
            )}
        </div>
    );
};
