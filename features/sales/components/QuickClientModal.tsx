
import React, { useState } from 'react';
import { UserPlus, X, User, CreditCard } from 'lucide-react';
import { Client } from '@/types';
import { ApiService } from '@/services/api';

interface QuickClientModalProps {
    onClose: () => void;
    onSubmit: (client: Client) => void;
}

export const QuickClientModal: React.FC<QuickClientModalProps> = ({ onClose, onSubmit }) => {
    const [name, setName] = useState('');
    const [contact, setContact] = useState('');
    const [phone, setPhone] = useState('');

    const handleSubmit = () => {
        if (!name) return;
        const client: Client = {
            id: ApiService.generateId(),
            name,
            contactPerson: contact,
            phone
        };
        onSubmit(client);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
                <div className="p-6 bg-slate-50 border-b flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 text-blue-600 rounded-xl"><UserPlus size={20}/></div>
                        <h3 className="font-black text-slate-800 uppercase tracking-tight">Новый клиент</h3>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={24}/></button>
                </div>
                <div className="p-8 space-y-5">
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Название компании</label>
                        <input className="w-full border border-slate-200 rounded-2xl p-4 text-sm font-bold bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all" placeholder="ТОО Название..." value={name} onChange={e => setName(e.target.value)} autoFocus />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Контактное лицо</label>
                        <div className="relative"><User size={18} className="absolute left-4 top-4 text-slate-400"/><input className="w-full border border-slate-200 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all" placeholder="Имя Фамилия" value={contact} onChange={e => setContact(e.target.value)} /></div>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Телефон</label>
                        <div className="relative"><CreditCard size={18} className="absolute left-4 top-4 text-slate-400"/><input className="w-full border border-slate-200 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all" placeholder="+7..." value={phone} onChange={e => setPhone(e.target.value)} /></div>
                    </div>
                    <button onClick={handleSubmit} disabled={!name} className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-blue-600/20 transition-all active:scale-95 mt-4">Создать и выбрать</button>
                </div>
            </div>
        </div>
    );
};
