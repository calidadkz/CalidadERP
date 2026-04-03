
import React, { useState, useRef } from 'react';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '@/services/firebase';
import { Upload, X, FileText, Download, Loader2, Trash2, AlertCircle } from 'lucide-react';

interface FileUploadProps {
    label: string;
    value?: string; // URL
    fileName?: string;
    onUpload: (url: string, name: string) => void;
    onRemove: () => void;
    folder: string;
    accept?: string;
    isContract?: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ 
    label, value, fileName, onUpload, onRemove, folder, accept = ".pdf,.doc,.docx,.xls,.xlsx,.txt,.ppt,.pptx", isContract = false 
}) => {
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        setError(null);

        try {
            const fileExt = file.name.split('.').pop();
            const sanitizedName = file.name.replace(/[^\w\s.-]/gi, '').replace(/\s+/g, '_');
            const storagePath = `${folder}/${Date.now()}_${sanitizedName}`;
            const storageRef = ref(storage, storagePath);

            const snapshot = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);

            onUpload(downloadURL, file.name);
        } catch (err: any) {
            console.error('Upload error:', err);
            setError('Ошибка при загрузке файла');
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleRemove = () => {
        if (window.confirm('Вы уверены, что хотите удалить этот документ?')) {
            onRemove();
        }
    };

    if (value) {
        return (
            <div className={`flex items-center justify-between p-3 rounded-xl border transition-all ${isContract ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className={`p-2 rounded-lg ${isContract ? 'bg-blue-500 text-white' : 'bg-slate-400 text-white'}`}>
                        <FileText size={16} />
                    </div>
                    <div className="flex flex-col overflow-hidden">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{label}</span>
                        <span className="text-xs font-bold text-slate-700 truncate">{fileName || 'Документ'}</span>
                    </div>
                </div>
                <div className="flex items-center gap-1 ml-4">
                    <a 
                        href={value} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="p-2 hover:bg-white/50 rounded-lg text-slate-500 hover:text-blue-600 transition-colors"
                        title="Скачать"
                    >
                        <Download size={16} />
                    </a>
                    <button 
                        onClick={handleRemove}
                        className="p-2 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 transition-colors"
                        title="Удалить"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-2">
            <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed transition-all active:scale-95 ${
                    isUploading ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed' : 
                    isContract ? 'bg-white border-blue-200 text-blue-500 hover:bg-blue-50' : 
                    'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
            >
                {isUploading ? (
                    <>
                        <Loader2 size={16} className="animate-spin" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Загрузка...</span>
                    </>
                ) : (
                    <>
                        <Upload size={16} />
                        <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
                    </>
                )}
            </button>
            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept={accept} 
                onChange={handleFileChange} 
            />
            {error && (
                <div className="flex items-center gap-1.5 text-red-500 text-[10px] font-bold px-1 animate-in slide-in-from-top-1">
                    <AlertCircle size={12} />
                    {error}
                </div>
            )}
        </div>
    );
};
