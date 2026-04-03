
import React from 'react';
import { Settings, Users, Briefcase, Building, Key, Database, FileText, Percent } from 'lucide-react';
import { TaxSettings } from '../components/TaxSettings';

const Page: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="p-8">
    <div className="flex items-center gap-3 mb-8">
      <div className="bg-blue-600 p-2 rounded-xl text-white">
        <Settings size={24} />
      </div>
      <h1 className="text-3xl font-black text-slate-800 tracking-tight">{title}</h1>
    </div>
    {children}
  </div>
);

export const SettingsPage: React.FC = () => {
  return (
    <Page title="Настройки">
      <div className="space-y-8 max-w-6xl mx-auto">
        <div id="taxes">
          <TaxSettings />
        </div>

        {/* Секции для пользователей и валют могут быть добавлены здесь позже, 
            когда будут готовы соответствующие компоненты */}
            
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 opacity-40 pointer-events-none">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-slate-700 uppercase tracking-tight flex items-center gap-2 mb-4">
              <Users size={18}/> Управление пользователями
            </h3>
            <p className="text-sm text-slate-500 italic">Модуль в разработке...</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-slate-700 uppercase tracking-tight flex items-center gap-2 mb-4">
              <Database size={18}/> Валюты и Курсы
            </h3>
            <p className="text-sm text-slate-500 italic">Модуль в разработке...</p>
          </div>
        </div>
      </div>
    </Page>
  );
};
