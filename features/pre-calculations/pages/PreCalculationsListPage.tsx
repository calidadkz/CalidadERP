import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PreCalculationList } from '../components/list/PreCalculationList';
import { Plus, ListFilter, Search, Loader2, GanttChartSquare, RefreshCw } from 'lucide-react';
import { api } from '@/services';
import { supabase } from '@/services/supabaseClient'; 
import { useStore } from '../../system/context/GlobalStore';
import { TableNames } from '@/constants';

export const PreCalculationsListPage: React.FC = () => {
  const navigate = useNavigate();
  const [preCalculations, setPreCalculations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { actions } = useStore();

  const fetchPreCalculations = async () => {
    try {
      setLoading(true);
      const data = await api.fetchAll<any>(TableNames.PRE_CALCULATIONS, 'date');
      
      if (data.length === 0) {
          setPreCalculations([]);
          return;
      }

      const pcIds = data.map(pc => pc.id);
      
      const { data: allItems, error: itemsError } = await supabase
        .from(TableNames.PRE_CALCULATION_ITEMS)
        .select('pre_calculation_id, quantity, selling_price_kzt, full_cost_kzt, volume_m3, weight_kg')
        .in('pre_calculation_id', pcIds);

      if (itemsError) throw itemsError;

      const enrichedData = data.map((pc) => {
          const items = (allItems || []).filter((item: any) => item.pre_calculation_id === pc.id);
          
          let totalRevenue = 0;
          let totalCost = 0;
          let totalVolume = 0;
          let totalWeight = 0;
          let totalQty = 0;

          items.forEach((item: any) => {
              const qty = item.quantity || 0;
              totalQty += qty;
              totalRevenue += (item.selling_price_kzt || 0); 
              totalCost += (item.full_cost_kzt || 0); 
              totalVolume += (item.volume_m3 || 0) * qty;
              totalWeight += (item.weight_kg || 0) * qty;
          });

          const profit = totalRevenue - totalCost;
          const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

          return {
              ...pc,
              itemCount: items.length,
              totalQty,
              totalRevenue,
              totalCost,
              profit,
              margin,
              totalVolume,
              totalWeight
          };
      });

      const sortedData = enrichedData.sort((a, b) => {
        return new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime();
      });

      setPreCalculations(sortedData);
      setError(null);
    } catch (err: any) {
      console.error("Failed to fetch pre-calculations", err);
      setError(`Не удалось загрузить данные: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPreCalculations();
  }, []);

  const handleAddPreCalculation = () => {
    navigate('/pre-calculations/new');
  };

  const handleRowClick = (id: string) => {
    navigate(`/pre-calculations/${id}`);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if (window.confirm('Вы уверены, что хотите переместить этот предрасчет в корзину?')) {
          try {
              await actions.deletePreCalculation(id);
              setPreCalculations(prev => prev.filter(p => p.id !== id));
          } catch (error) {
              console.error("Delete error:", error);
              alert('Ошибка при удалении');
          }
      }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex justify-between items-center">
            <div>
                <h2 className="text-2xl font-bold text-slate-800 flex items-center">
                    <GanttChartSquare className="mr-3 text-blue-600" size={28} /> Предрасчеты
                </h2>
                <p className="text-slate-500 text-sm font-medium mt-1">Калькуляция себестоимости и плановой прибыли партии</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={fetchPreCalculations}
                disabled={loading}
                className="flex items-center px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw size={16} className={`${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={handleAddPreCalculation}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-blue-700 transition-all active:scale-95 shadow-xl shadow-blue-100"
              >
                <Plus size={18}/> Создать предрасчет
              </button>
            </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-2 rounded-[1.5rem] shadow-sm border border-slate-200">
            <div className="flex bg-slate-100 p-1 rounded-xl">
                <button className="flex items-center px-6 py-2 text-xs font-black uppercase tracking-widest rounded-lg bg-white shadow-sm text-blue-600">
                    <ListFilter size={14} className="mr-2"/>
                    <span>Все партии</span>
                </button>
            </div>
            <div className="relative w-full md:w-80 mr-2">
                <Search className="absolute left-4 top-3 text-slate-400" size={18}/>
                <input 
                    type="text" 
                    placeholder="Поиск по названию..." 
                    onChange={(e) => {
                        const val = e.target.value.toLowerCase();
                        if (!val) {
                            fetchPreCalculations();
                            return;
                        }
                        setPreCalculations(prev => prev.filter(p => p.name.toLowerCase().includes(val)));
                    }}
                    className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-blue-500/5 font-bold text-xs transition-all"
                />
            </div>
        </div>

        {loading ? (
             <div className="flex justify-center items-center h-64">
                <Loader2 className="animate-spin text-blue-500" size={32} />
            </div>
        ) : error ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-center">
                <p className="font-bold text-red-800">Ошибка</p>
                <p className="text-xs text-red-600">{error}</p>
            </div>
        ) : (
            <PreCalculationList preCalculations={preCalculations} onRowClick={handleRowClick} onDelete={handleDelete} />
        )}
    </div>
  );
};
