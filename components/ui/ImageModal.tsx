
import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

interface ImageModalProps {
    src: string;
    alt?: string;
    isOpen: boolean;
    onClose: () => void;
}

export const ImageModal: React.FC<ImageModalProps> = ({ src, alt, isOpen, onClose }) => {
    const [isAnimating, setIsAnimating] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setIsAnimating(true);
        } else {
            const timer = setTimeout(() => setIsAnimating(false), 300);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    if (!isOpen && !isAnimating) return null;

    return (
        <div 
            className={`fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300 ease-out ${isOpen ? 'opacity-100' : 'opacity-0'}`}
            onClick={onClose}
        >
            <div 
                className={`relative max-w-5xl max-h-[95vh] transition-all duration-300 ease-out shadow-2xl rounded-2xl overflow-y-auto bg-white border-4 border-white custom-scrollbar ${isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
                onClick={e => e.stopPropagation()}
            >
                <button 
                    onClick={onClose}
                    className="fixed sm:absolute top-6 right-6 sm:top-3 sm:right-3 z-[1100] p-2 bg-slate-900/40 hover:bg-slate-900/80 rounded-full text-white transition-all shadow-lg backdrop-blur-md"
                >
                    <X size={24} />
                </button>
                <div className="flex flex-col items-center justify-start min-h-full">
                    <img 
                        src={src} 
                        alt={alt || "Preview"} 
                        className="w-full h-auto block select-none pointer-events-none"
                    />
                </div>
            </div>
        </div>
    );
};
