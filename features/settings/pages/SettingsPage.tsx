
import React from 'react';
import { Settings, Users, Briefcase, Building, Key, Database, FileText, Percent } from 'lucide-react';
import { CurrencyRates } from '../components/CurrencyRates';
import { UserManagement } from '../components/UserManagement';
import { TaxSettings } from '../components/TaxSettings';
import { Page } from '@/components/ui/page';

export const SettingsPage: React.FC = () => {
  return (
    <Page title="Настройки">
      <div className="space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div id="users">
              <UserManagement />
            </div>
          </div>
          <div className="lg:col-span-1">
            <div id="currencies">
              <CurrencyRates />
            </div>
          </div>
        </div>

        <div id="taxes">
          <TaxSettings />
        </div>

        {/* Другие секции настроек могут быть добавлены здесь */}
        {/* <div id="other" className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-black text-slate-700 uppercase tracking-tight">Другие настройки</h3>
        </div> */}

      </div>
    </Page>
  );
};
