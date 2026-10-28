import { useState } from 'react';
import { X, Plus, Activity, BarChart2, Radio, Compass, Orbit } from 'lucide-react';
import { OrbitraLogo } from '../../components/common/OrbitraLogo';
import { sensorRegistry } from '../sensors/registry';
import { useDashboardStore } from '../../stores/dashboardStore';
import { nanoid } from '../../stores/utils/nanoid';
import type { WidgetConfig, GridItemLayout, ChartType, TimeRange } from '../../types/telemetry';

interface Props { onClose: () => void; }

const CHART_TYPES: { value: ChartType; label: string; desc: string }[] = [
  { value: 'value', label: 'Live Value', desc: 'Current reading with numeric display' },
  { value: 'timeseries', label: 'Line Chart', desc: 'Real-time telemetry trend plot' },
  { value: 'area', label: 'Area Chart', desc: 'Filled area time-series plot' },
  { value: 'bar', label: 'Bar Chart', desc: 'Discrete sample distribution' },
  { value: 'gauge', label: 'Gauge', desc: 'Radial limit & threshold meter' },
  { value: 'cubesat', label: 'CubeSat 3D', desc: 'Flight attitude Euler orientation' },
  { value: 'map', label: 'GPS Ground Track', desc: 'Sub-satellite geospatial coordinates' },
];

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: 'live', label: 'Live (5m window)' },
  { value: '1m', label: '1 minute' },
  { value: '5m', label: '5 minutes' },
  { value: '15m', label: '15 minutes' },
  { value: '1h', label: '1 hour' },
];

export function AddWidgetModal({ onClose }: Props) {
  const addWidget = useDashboardStore(s => s.addWidget);
  const fields = sensorRegistry.getAllFields();
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [chartType, setChartType] = useState<ChartType>('timeseries');
  const [timeRange, setTimeRange] = useState<TimeRange>('5m');
  const [title, setTitle] = useState('');

  const toggleField = (ref: string) => {
    setSelectedFields(prev => {
      if (prev.includes(ref)) return prev.filter(f => f !== ref);
      if (chartType === 'value' || chartType === 'gauge') return [ref];
      return [...prev, ref];
    });
    if (selectedFields.length === 0 && !title) {
      const fieldDef = sensorRegistry.getField(ref);
      if (fieldDef) setTitle(fieldDef.label);
    }
  };

  const handleAdd = () => {
    const id = `widget-${nanoid()}`;
    const fieldTitle = title || (selectedFields.length > 0
      ? (sensorRegistry.getField(selectedFields[0])?.label ?? selectedFields[0])
      : 'Widget');

    const isLarge = chartType === 'cubesat' || chartType === 'map';
    const isSmall = chartType === 'value' || chartType === 'gauge';

    const widget: WidgetConfig = {
      id,
      type: (chartType === 'cubesat' || chartType === 'map') ? chartType : (selectedFields.length === 0 ? 'value' : chartType),
      title: fieldTitle,
      fields: selectedFields,
      timeRange,
      autoScale: true,
      showGrid: true,
      showLegend: selectedFields.length > 1,
    };

    const gridItem: GridItemLayout = {
      i: id,
      x: 0, y: 999,
      w: isSmall ? 3 : (isLarge ? 6 : 6),
      h: isSmall ? 3 : (isLarge ? 5 : 6),
      minW: 2, minH: 2,
    };

    addWidget(widget, gridItem);
    onClose();
  };

  const grouped = fields.reduce<Record<string, typeof fields>>((acc, f) => {
    acc[f.sensorId] = acc[f.sensorId] ?? [];
    acc[f.sensorId].push(f);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={onClose}>
      <div
        className="rounded-xl p-5 w-full max-w-lg bg-[#08080a] border border-white/10 shadow-2xl animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <OrbitraLogo size={18} />
            <h3 className="text-white font-semibold text-xs tracking-wide uppercase font-mono">
              Add Telemetry Widget
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/10 transition-colors">
            <X size={15} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-white/60 mb-1.5">
              Widget Title
            </label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Auto-inferred from selected channel..."
              className="w-full bg-[#131929] border border-white/[0.1] rounded-lg px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-sky-500 font-mono"
            />
          </div>

          {/* Chart type */}
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-white/60 mb-1.5">
              Visualization Mode
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CHART_TYPES.map(ct => (
                <button
                  key={ct.value}
                  onClick={() => setChartType(ct.value)}
                  className={`px-3 py-2.5 rounded-lg text-left border transition-all ${
                    chartType === ct.value
                      ? 'bg-sky-500/15 border-sky-400/60 text-sky-200'
                      : 'border-white/[0.08] bg-[#131929]/50 text-white/60 hover:bg-[#131929] hover:text-white'
                  }`}
                >
                  <div className="font-medium text-xs text-white">{ct.label}</div>
                  <div className="text-white/40 text-[10px] mt-0.5 leading-tight">{ct.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Fields */}
          {fields.length > 0 ? (
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-white/60 mb-1.5">
                Target Telemetry Channel
              </label>
              <div className="max-h-48 overflow-y-auto space-y-2 pr-1 border border-white/[0.08] rounded-lg p-2 bg-[#090c14]">
                {Object.entries(grouped).map(([sensorId, sensorFields]) => {
                  const sensor = sensorRegistry.getSensor(sensorId);
                  return (
                    <div key={sensorId}>
                      <p className="text-[10px] font-mono text-sky-400 px-1 mb-1 font-semibold uppercase tracking-wider">
                        {sensor?.displayName ?? sensorId}
                      </p>
                      <div className="space-y-1">
                        {sensorFields.map(({ sensorId: sid, fieldDef }) => {
                          const ref = `${sid}.${fieldDef.fieldKey}`;
                          const selected = selectedFields.includes(ref);
                          return (
                            <button
                              key={ref}
                              onClick={() => toggleField(ref)}
                              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition-colors ${
                                selected
                                  ? 'bg-sky-500/20 border border-sky-400/40 text-white font-medium'
                                  : 'text-white/70 hover:bg-white/[0.04] border border-transparent'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className={`w-1.5 h-1.5 rounded-full ${selected ? 'bg-sky-400' : 'bg-white/20'}`} />
                                <span>{fieldDef.label}</span>
                              </div>
                              <span className="text-white/40 font-mono text-[10px]">{fieldDef.unit}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center text-white/40 text-xs py-4 border border-dashed border-white/10 rounded-lg font-mono">
              No telemetry channels detected. Check flight sensors.
            </div>
          )}

          {/* Time range (for chart types) */}
          {!['value', 'gauge'].includes(chartType) && (
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-white/60 mb-1.5">
                Sampling Time Window
              </label>
              <select
                value={timeRange}
                onChange={e => setTimeRange(e.target.value as TimeRange)}
                className="w-full bg-[#131929] border border-white/[0.1] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
              >
                {TIME_RANGES.map(r => (
                  <option key={r.value} value={r.value} className="bg-[#0d111c] text-white">
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex gap-2.5 mt-5 pt-4 border-t border-white/10">
          <button
            onClick={onClose}
            className="flex-1 py-2 border border-white/10 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-lg text-xs font-mono uppercase tracking-wider transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-white hover:bg-zinc-200 text-black rounded-lg text-xs font-mono uppercase tracking-wider font-semibold transition-colors shadow-sm"
          >
            <Plus size={14} /> Add Widget
          </button>
        </div>
      </div>
    </div>
  );
}
