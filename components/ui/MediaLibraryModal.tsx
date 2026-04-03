
import React, { useState, useMemo } from 'react';
import { X, Search, ChevronLeft, ChevronRight, Loader2, Image as ImageIcon, Trash2 } from 'lucide-react';

interface StorageImage {
    name: string;
    url: string;
}

interface MediaLibraryModalProps {
    isOpen: boolean;
    onClose: () => void;
    images: StorageImage[];
    isLoading: boolean;
    onSelect: (url: string) => void;
    currentUrl?: string;
}

const ITEMS_PER_PAGE = 15;

export const MediaLibraryModal: React.FC<MediaLibraryModalProps> = ({ 
    isOpen, onClose, images, isLoading, onSelect, currentUrl 
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);

    const filteredImages = useMemo(() => {
        return images
            .filter(img => img.name.toLowerCase().includes(searchTerm.toLowerCase()))
            .sort((a, b) => b.name.localeCompare(a.name)); // Сортировка по имени (обычно в Firebase в имени есть таймштамп)
    }, [images, searchTerm]);

    const totalPages = Math.ceil(filteredImages.length / ITEMS_PER_PAGE);
    const paginatedImages = filteredImages.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[200] flex items-center justify-center p-6 animate-in fade-in duration-200">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden border border-white/20">
                <div className="p-8 border-b bg-slate-50 flex justify-between items-center flex-none">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-2xl text-white shadow-lg bg-blue-600">
                            <ImageIcon size={28}/>
                        </div>
                        <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Библиотека файлов</span>
                            <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight leading-none">Выбор изображения</h3>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400"><X size={28}/></button>
                </div>

                <div className="p-6 border-b bg-white flex gap-4 items-center">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18}/>
                        <input 
                            type="text"
                            placeholder="Поиск по названию файла..."
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 pl-12 pr-4 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500/50 transition-all"
                            value={searchTerm}
                            onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                        />
                    </div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Всего: {filteredImages.length}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    {isLoading ? (
                        <div className="h-full flex flex-col items-center justify-center opacity-20">
                            <Loader2 className="animate-spin text-blue-500 mb-4" size={48}/>
                            <span className="text-xs font-black uppercase tracking-[0.3em]">Загрузка галереи...</span>
                        </div>
                    ) : filteredImages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-300">
                             <ImageIcon size={64} className="mb-4 opacity-20"/>
                             <p className="font-bold uppercase tracking-widest text-sm">Ничего не найдено</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 md:grid-cols-5 gap-4">
                            {paginatedImages.map(img => (
                                <div 
                                    key={img.name}
                                    onClick={() => { onSelect(img.url); onClose(); }}
                                    className={`relative group aspect-square rounded-3xl overflow-hidden border-4 transition-all cursor-pointer hover:shadow-xl ${
                                        currentUrl === img.url ? 'border-blue-500 ring-4 ring-blue-100 scale-95' : 'border-slate-50 hover:border-blue-200'
                                    }`}
                                >
                                    <img src={img.url} alt={img.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                                        <p className="text-[9px] font-bold text-white truncate uppercase">{img.name}</p>
                                    </div>
                                    {currentUrl === img.url && (
                                        <div className="absolute top-2 right-2 bg-blue-500 text-white p-1.5 rounded-full shadow-lg">
                                            <X size={12} className="rotate-45"/>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-6 border-t bg-slate-50 flex justify-between items-center flex-none">
                    <div className="flex gap-2">
                         <button 
                            onClick={() => { onSelect(''); onClose(); }}
                            className="px-6 py-2.5 text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-50 rounded-xl transition-all flex items-center gap-2"
                         >
                            <Trash2 size={14}/> Сбросить фото
                         </button>
                    </div>
                    
                    {totalPages > 1 && (
                        <div className="flex items-center gap-4">
                            <button 
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:bg-white disabled:opacity-30 transition-all"
                            >
                                <ChevronLeft size={20}/>
                            </button>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-black text-slate-700">{currentPage}</span>
                                <span className="text-slate-300 font-bold">/</span>
                                <span className="text-sm font-bold text-slate-400">{totalPages}</span>
                            </div>
                            <button 
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:bg-white disabled:opacity-30 transition-all"
                            >
                                <ChevronRight size={20}/>
                            </button>
                        </div>
                    )}

                    <button onClick={onClose} className="px-8 py-2.5 bg-slate-800 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-700 transition-all shadow-lg">Закрыть</button>
                </div>
            </div>
        </div>
    );
};
