import React, { useEffect, useState } from 'react';
import { ActionType, LogItem } from '@/types';
import { History, Activity, RefreshCw } from 'lucide-react';
import { ApiService } from '@/services/api';
import { TableNames } from '@/constants';

export const HistoryPage: React.FC = () => {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      // Загружаем только последние 100 логов для экономии трафика
      const { data, error } = await (window as any).supabase
        .from(TableNames.LOGS)
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      setLogs(ApiService.keysToCamel(data || []));
    } catch (e) {
      console.error("Failed to fetch logs", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);
  
  const getActionColor = (action: ActionType) => {
      switch (action) {
          case 'Create': return 'bg-green-100 text-green-800 border-green-200';
          case 'Update': return 'bg-blue-100 text-blue-800 border-blue-200';
          case 'Delete': return 'bg-red-100 text-red-800 border-red-200';
          case 'Post': return 'bg-purple-100 text-purple-800 border-purple-200';
          case 'Transaction': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
          default: return 'bg-gray-100 text-gray-800';
      }
  };

  const getActionLabel = (action: ActionType) => {
      switch (action) {
          case 'Create': return 'Создание';
          case 'Update': return 'Изменение';
          case 'Delete': return 'Удаление';
          case 'Post': return 'Проведение';
          case 'Transaction': return 'Транзакция';
          default: return action;
      }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                <History className="mr-2 text-blue-600" size={28} /> История операций
            </h2>
            <p className="text-gray-500 text-sm mt-1">
                Журнал действий пользователей с документами и справочниками.
            </p>
        </div>
        <button 
          onClick={fetchLogs}
          disabled={isLoading}
          className="flex items-center px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw size={16} className={`mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Обновить
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
            <div className="p-12 text-center text-gray-400">Загрузка...</div>
        ) : logs.length === 0 ? (
            <div className="p-12 text-center text-gray-400 flex flex-col items-center">
                <Activity size={48} className="mb-4 opacity-20"/>
                <p>История операций пуста.</p>
            </div>
        ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                      <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40">Дата / Время</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Действие</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40">Документ</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">ID</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Описание</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Пользователь</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                      {logs.map(log => (
                          <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap font-mono">
                                  {new Date(log.timestamp).toLocaleString('ru-RU')}
                              </td>
                              <td className="px-6 py-4 text-sm">
                                  <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${getActionColor(log.action)}`}>
                                      {getActionLabel(log.action)}
                                  </span>
                              </td>
                              <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                  {log.documentType}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-500 font-mono text-xs">
                                  {log.documentId}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-600">
                                  {log.description}
                              </td>
                              <td className="px-6 py-4 text-right text-sm text-gray-400 italic">
                                  {log.user}
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
            </div>
        )}
      </div>
    </div>
  );
};
