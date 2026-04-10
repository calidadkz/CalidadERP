import React, { useState, useMemo } from 'react';
import { BatchTimeline } from '@/types';
import { Save, AlertTriangle, Calendar, ChevronRight } from 'lucide-react';

interface Stage {
  key: keyof Omit<BatchTimeline, 'startDate'>;
  label: string;
  color: string;
  bg: string;
}

const STAGES: Stage[] = [
  { key: 'approvalDays',        label: 'Согласование заявки',     color: 'bg-violet-500',  bg: 'bg-violet-50' },
  { key: 'manufacturingDays',   label: 'Изготовление',            color: 'bg-blue-500',    bg: 'bg-blue-50' },
  { key: 'chinaDeliveryDays',   label: 'Доставка по Китаю',       color: 'bg-sky-500',     bg: 'bg-sky-50' },
  { key: 'urumqiAlmatyDays',    label: 'Доставка Урумчи–Алматы',  color: 'bg-amber-500',   bg: 'bg-amber-50' },
  { key: 'almatyKaragandaDays', label: 'Доставка Алматы–Карагандо', color: 'bg-orange-500', bg: 'bg-orange-50' },
  { key: 'commissioningDays',   label: 'Пусконаладка',            color: 'bg-emerald-500', bg: 'bg-emerald-50' },
];

const EMPTY: BatchTimeline = {
  startDate: '',
  approvalDays: 0,
  manufacturingDays: 0,
  chinaDeliveryDays: 0,
  urumqiAlmatyDays: 0,
  almatyKaragandaDays: 0,
  commissioningDays: 0,
};

function addDays(dateStr: string, days: number): Date {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

interface Props {
  timeline?: BatchTimeline;
  earliestDeadline?: string; // ISO date string
  onSave: (timeline: BatchTimeline) => void;
}

export const BatchTimelineTab: React.FC<Props> = ({ timeline, earliestDeadline, onSave }) => {
  const [local, setLocal] = useState<BatchTimeline>(() => timeline ? { ...EMPTY, ...timeline } : { ...EMPTY });
  const [dirty, setDirty] = useState(false);

  const set = (key: keyof BatchTimeline, value: string | number) => {
    setLocal(prev => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const totalDays = useMemo(
    () => STAGES.reduce((sum, s) => sum + (Number(local[s.key]) || 0), 0),
    [local]
  );

  // Даты начала/конца каждого этапа
  const stageTimings = useMemo(() => {
    if (!local.startDate) return null;
    let cursor = 0;
    return STAGES.map(s => {
      const start = addDays(local.startDate!, cursor);
      const days = Number(local[s.key]) || 0;
      cursor += days;
      const end = addDays(local.startDate!, cursor);
      return { stage: s, start, end, days };
    });
  }, [local]);

  const completionDate = local.startDate && totalDays > 0
    ? addDays(local.startDate, totalDays)
    : null;

  const deadlineDiff = completionDate && earliestDeadline
    ? Math.round((new Date(earliestDeadline).getTime() - completionDate.getTime()) / 86400000)
    : null;

  const handleSave = () => {
    onSave(local);
    setDirty(false);
  };

  return (
    <div className="flex flex-col gap-6 h-full overflow-y-auto custom-scrollbar">

      {/* ── Заголовок + сохранение ─────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-tight">Планирование сроков</h2>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
            Итого: <span className="text-slate-700">{totalDays} дней</span>
            {completionDate && (
              <> · Завершение: <span className="text-slate-700">{fmtDate(completionDate)}</span></>
            )}
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={!dirty}
          className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-xl font-black uppercase text-[9px] tracking-widest hover:bg-blue-700 transition-all active:scale-95 shadow-lg shadow-blue-500/20 disabled:opacity-30 disabled:shadow-none disabled:cursor-default"
        >
          <Save size={12} /> Сохранить
        </button>
      </div>

      {/* ── Предупреждение о дедлайне ───────────────────────────────── */}
      {deadlineDiff !== null && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold ${
          deadlineDiff >= 0
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          <AlertTriangle size={14} className={deadlineDiff >= 0 ? 'text-emerald-500' : 'text-red-500'} />
          {deadlineDiff >= 0
            ? `Укладываемся в срок по договору (+${deadlineDiff} дней запаса, дедлайн ${new Date(earliestDeadline!).toLocaleDateString('ru-RU')})`
            : `Выходим за срок по договору на ${Math.abs(deadlineDiff)} дней! Дедлайн ${new Date(earliestDeadline!).toLocaleDateString('ru-RU')}`
          }
        </div>
      )}

      {/* ── Дата старта + форма этапов ──────────────────────────────── */}
      <div className="grid grid-cols-[1fr_3fr] gap-6">

        {/* Левая колонка: ввод */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col">
            <label className="text-[9px] font-black text-slate-400 uppercase mb-1.5 tracking-widest flex items-center gap-1">
              <Calendar size={10}/> Дата старта
            </label>
            <input
              type="date"
              value={local.startDate || ''}
              onChange={e => set('startDate', e.target.value)}
              className="border border-slate-200 p-2 rounded-xl bg-white font-bold text-slate-700 text-xs outline-none focus:ring-4 focus:ring-blue-500/10"
            />
          </div>

          {STAGES.map((s, idx) => (
            <div key={s.key} className={`flex flex-col rounded-xl p-3 ${s.bg} border border-white/60`}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`w-2 h-2 rounded-full ${s.color}`}/>
                <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest leading-tight">{idx + 1}. {s.label}</label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  value={local[s.key] || ''}
                  onChange={e => set(s.key, Number(e.target.value))}
                  placeholder="0"
                  className="w-20 border border-slate-200 p-1.5 rounded-lg bg-white font-black text-slate-700 text-xs outline-none focus:ring-4 focus:ring-blue-500/10 text-center"
                />
                <span className="text-[9px] font-bold text-slate-500">дней</span>
                {stageTimings && stageTimings[idx] && stageTimings[idx].days > 0 && (
                  <span className="text-[9px] font-bold text-slate-400 ml-auto">
                    {fmtDate(stageTimings[idx].start)} – {fmtDate(stageTimings[idx].end)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Правая колонка: диаграмма Ганта */}
        <div className="flex flex-col gap-2">
          <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">
            Диаграмма Ганта
            {totalDays > 0 && <span className="ml-2 text-slate-600">{totalDays} дней</span>}
          </div>

          {totalDays === 0 ? (
            <div className="flex-1 flex items-center justify-center text-slate-300 text-xs font-bold uppercase tracking-widest border-2 border-dashed border-slate-100 rounded-2xl">
              Введите количество дней для отображения диаграммы
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {STAGES.map((s, idx) => {
                const days = Number(local[s.key]) || 0;
                const widthPct = totalDays > 0 ? (days / totalDays) * 100 : 0;
                const offsetPct = totalDays > 0
                  ? (STAGES.slice(0, idx).reduce((sum, ss) => sum + (Number(local[ss.key]) || 0), 0) / totalDays) * 100
                  : 0;

                return (
                  <div key={s.key} className="flex items-center gap-3">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest w-40 shrink-0 truncate">
                      {s.label}
                    </span>
                    <div className="flex-1 h-7 bg-slate-100 rounded-lg overflow-hidden relative">
                      <div
                        className={`absolute top-0 h-full rounded-lg ${s.color} opacity-80 flex items-center justify-end pr-2 transition-all duration-300`}
                        style={{ left: `${offsetPct}%`, width: `${widthPct}%` }}
                      >
                        {days > 0 && <span className="text-white text-[9px] font-black leading-none">{days}д</span>}
                      </div>
                    </div>
                    {stageTimings && stageTimings[idx] && days > 0 && (
                      <div className="text-[9px] font-bold text-slate-400 w-40 shrink-0 flex items-center gap-1">
                        <ChevronRight size={8}/>
                        {fmtDate(stageTimings[idx].end)}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Итог */}
              <div className="flex items-center gap-3 mt-2 pt-2 border-t border-slate-200">
                <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest w-40 shrink-0">
                  Итого
                </span>
                <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-violet-500 to-emerald-500 rounded-full"/>
                </div>
                <div className="text-[9px] font-black text-slate-700 w-40 shrink-0">
                  {totalDays} дней
                  {completionDate && <span className="text-slate-400 font-bold"> → {fmtDate(completionDate)}</span>}
                </div>
              </div>

              {/* Дедлайн-маркер */}
              {earliestDeadline && local.startDate && (
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                  Крайняя дата по договору: <span className={`font-black ${deadlineDiff !== null && deadlineDiff < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                    {new Date(earliestDeadline).toLocaleDateString('ru-RU')}
                  </span>
                  {deadlineDiff !== null && (
                    <span className={`ml-2 ${deadlineDiff >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                      ({deadlineDiff >= 0 ? '+' : ''}{deadlineDiff} дней)
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
