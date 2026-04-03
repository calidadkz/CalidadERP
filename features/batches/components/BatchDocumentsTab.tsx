import React, { useRef, useState } from 'react';
import { BatchDocument } from '@/types';
import { Upload, File, Trash2, Download, Loader2, HardDrive, FileText, Image as ImageIcon, FileArchive } from 'lucide-react';

interface BatchDocumentsTabProps {
    documents: BatchDocument[];
    onUpload: (file: File) => Promise<any>;
    onDelete: (doc: BatchDocument) => Promise<void>;
}

export const BatchDocumentsTab: React.FC<BatchDocumentsTabProps> = ({ documents, onUpload, onDelete }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            await onUpload(file);
        } catch (error) {
            console.error("Upload failed:", error);
            alert("Ошибка при загрузке файла");
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const getFileIcon = (type: string) => {
        if (type.includes('image')) return <ImageIcon size={20} className="text-blue-500" />;
        if (type.includes('pdf')) return <FileText size={20} className="text-red-500" />;
        if (type.includes('zip') || type.includes('rar')) return <FileArchive size={20} className="text-amber-500" />;
        return <File size={20} className="text-slate-400" />;
    };

    const formatSize = (bytes?: number) => {
        if (!bytes) return '—';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="flex flex-col h-full space-y-6">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Документы партии</h3>
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-lg text-[10px] font-bold">{documents.length}</span>
                </div>
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-indigo-900/20"
                >
                    {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                    Загрузить документ
                </button>
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    className="hidden" 
                />
            </div>

            <div className="flex-1 overflow-auto custom-scrollbar">
                {documents.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-slate-100 rounded-[2.5rem]">
                        <div className="w-20 h-20 bg-slate-50 text-slate-200 rounded-3xl flex items-center justify-center mb-6">
                            <HardDrive size={40} />
                        </div>
                        <h3 className="text-base font-black text-slate-800 uppercase tracking-tight mb-2">Хранилище пусто</h3>
                        <p className="text-slate-400 text-xs font-medium max-w-xs leading-relaxed">
                            Загружайте PDF-счета, фотографии груза, таможенные декларации и другие сопроводительные документы.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {documents.map((doc) => (
                            <div key={doc.id} className="group bg-white p-4 rounded-2xl border border-slate-200 hover:border-indigo-200 hover:shadow-md transition-all">
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-indigo-50 transition-colors">
                                        {getFileIcon(doc.type)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[11px] font-black text-slate-800 uppercase tracking-tight truncate mb-1" title={doc.name}>
                                            {doc.name}
                                        </div>
                                        <div className="flex items-center gap-3 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                            <span>{formatSize(doc.size)}</span>
                                            <span>•</span>
                                            <span>{new Date(doc.uploadedAt).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-50">
                                    <a 
                                        href={doc.url} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="flex-1 flex items-center justify-center gap-2 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all"
                                    >
                                        <Download size={12} /> Скачать
                                    </a>
                                    <button 
                                        onClick={() => onDelete(doc)}
                                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
