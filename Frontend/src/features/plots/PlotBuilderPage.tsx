import { useState } from 'react';
import { BarChart2, Play, Plus, Check } from 'lucide-react';
import { sensorRegistry } from '../sensors/registry';
import { TimeSeriesChart } from '../../components/widgets/TimeSeriesChart';
import { LiveValueCard } from '../../components/widgets/LiveValueCard';
import { GaugeWidget } from '../../components/widgets/GaugeWidget';
import { CubeSatViewer } from '../../components/widgets/CubeSatViewer';
import { GpsMapWidget } from '../../components/widgets/GpsMapWidget';
import { useDashboardStore } from '../../stores/dashboardStore';
import { nanoid } from '../../stores/utils/nanoid';
import type { ChartType, TimeRange, WidgetConfig, GridItemLayout } from '../../types/telemetry';

const CHART_TYPES: { value: ChartType; label: string }[] = [
  { value: 'timeseries', label: 'Line Chart' },
  { value: 'area', label: 'Area Chart' },
  { value: 'bar', label: 'Bar Chart' },
  { value: 'value', label: 'Live Value Card' },
  { value: 'gauge', label: 'Gauge Meter' },
  { value: 'cubesat', label: 'CubeSat 3D Orientation' },
  { value: 'map', label: 'GPS Ground Track Map' },
];

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: 'live', label: 'Live (5m)' },
  { value: '1m', label: '1 min' },
  { value: '5m', label: '5 min' },
  { value: '15m', label: '15 min' },
  { value: '1h', label: '1 hour' },
];

const COLORS = ['#38bdf8', '#34d399', '#fbbf24', '#818cf8', '#f87171', '#38bdf8'];

export function PlotBuilderPage() {
  const addWidget = useDashboardStore(s => s.addWidget);
  const fields = sensorRegistry.getAllFields();
  const sensors = sensorRegistry.getAllSensors();

  const [title, setTitle] = useState('');
  const [chartType, setChartType] = useState<ChartType>('timeseries');
  const [selectedFields, setSelectedFields] = useState<string[]>(
    fields[0] ? [`${fields[0].sensorId}.${fields[0].fieldDef.fieldKey}`] : []
  );
  const [timeRange, setTimeRange] = useState<TimeRange>('5m');
  const [added, setAdded] = useState(false);

  const toggleField = (ref: string) => {
    setSelectedFields(prev => {
      if (prev.includes(ref)) {
        return prev.filter(f => f !== ref);
      }
      if (chartType === 'value' || chartType === 'gauge') {
        return [ref];
      }
      return [...prev, ref];
    });
  };

  const handleAddToDashboard = () => {
    const id = `widget-${nanoid()}`;
    const fieldTitle = title || (selectedFields.length > 0
      ? (sensorRegistry.getField(selectedFields[0])?.label ?? selectedFields[0])
      : 'Plot');

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
      x: 0,
      y: 999,
      w: isSmall ? 3 : (isLarge ? 6 : 6),
      h: isSmall ? 3 : (isLarge ? 5 : 6),
      minW: 2,
      minH: 2,
    };

    addWidget(widget, gridItem);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const series = selectedFields.map((f, i) => ({
    fieldRef: f,
    color: COLORS[i % COLORS.length],
  }));

  const canAdd = selectedFields.length > 0 || chartType === 'cubesat' || chartType === 'map';

  return (
    <div className="h-full flex bg-black">
      {/* Left panel — field picker + config */}
      <div className="w-80 shrink-0 border-r border-white/10 flex flex-col overflow-hidden bg-black">
        <div className="p-4 border-b border-white/10">
          <h1 className="text-sm font-semibold tracking-wide uppercase font-mono text-white flex items-center gap-2">
            <BarChart2 size={16} className="text-white" /> Plot Designer
          </h1>
          <p className="text-zinc-500 text-[11px] font-mono mt-0.5">Author custom telemetry telemetry views</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono">
          {/* Title */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-zinc-400 mb-1">Plot Title</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Auto-inferred..."
              className="w-full bg-[#0d0d0f] border border-white/10 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-white/30"
            />
          </div>

          {/* Chart type */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-zinc-400 mb-1">Visualization Mode</label>
            <div className="grid grid-cols-2 gap-1.5">
              {CHART_TYPES.map(ct => (
                <button
                  key={ct.value}
                  onClick={() => {
                    setChartType(ct.value);
                    if (['value', 'gauge'].includes(ct.value) && selectedFields.length > 1) {
                      setSelectedFields([selectedFields[0]]);
                    }
                  }}
                  className={`text-left px-2.5 py-1.5 rounded text-xs transition-colors border ${
                    chartType === ct.value
                      ? 'bg-white text-black border-white font-semibold'
                      : 'text-zinc-400 bg-zinc-900 border-white/[0.08] hover:text-white hover:bg-zinc-800'
                  }`}
                >
                  {ct.label}
                </button>
              ))}
            </div>
          </div>

          {/* Time range */}
          {!['value', 'gauge'].includes(chartType) && (
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-white/50 mb-1">Sampling Window</label>
              <div className="flex flex-wrap gap-1">
                {TIME_RANGES.map(r => (
                  <button
                    key={r.value}
                    onClick={() => setTimeRange(r.value)}
                    className={`px-2 py-1 rounded text-xs transition-colors ${
                      timeRange === r.value
                        ? 'bg-sky-600 text-white font-semibold'
                        : 'bg-[#131929] text-white/60 hover:text-white border border-white/[0.06]'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Fields list */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-white/50 mb-1">Telemetry Channels</label>
            {chartType === 'cubesat' || chartType === 'map' ? (
              <p className="text-white/40 text-[11px] py-2">Fixed sensor channel assignment.</p>
            ) : (
              <div className="space-y-3">
                {sensors.map(s => {
                  if (s.fields.length === 0) return null;
                  return (
                    <div key={s.sensorId} className="space-y-1">
                      <p className="text-[10px] text-sky-400 uppercase font-semibold">{s.displayName}</p>
                      {s.fields.map(fieldDef => {
                        const ref = `${s.sensorId}.${fieldDef.fieldKey}`;
                        const selected = selectedFields.includes(ref);
                        return (
                          <button
                            key={ref}
                            onClick={() => toggleField(ref)}
                            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors border ${
                              selected
                                ? 'bg-sky-500/15 border-sky-400/30 text-white'
                                : 'text-white/60 bg-[#131929]/50 border-transparent hover:text-white hover:bg-[#131929]'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${selected ? 'bg-sky-400' : 'bg-white/20'}`} />
                            <span className="flex-1 text-left">{fieldDef.label}</span>
                            <span className="text-white/30 text-[10px]">{fieldDef.unit}</span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Add to dashboard */}
        <div className="p-3 border-t border-white/10 bg-black">
          <button
            onClick={handleAddToDashboard}
            disabled={!canAdd}
            className={`w-full flex items-center justify-center gap-2 py-2 rounded text-xs font-mono uppercase tracking-wider font-semibold transition-colors ${
              added
                ? 'bg-emerald-600 text-white'
                : canAdd
                ? 'bg-white hover:bg-zinc-200 text-black'
                : 'bg-zinc-900 text-zinc-600 cursor-not-allowed border border-white/5'
            }`}
          >
            {added ? <><Check size={14} /> Added to Console</> : <><Plus size={14} /> Commit to Dashboard</>}
          </button>
        </div>
      </div>

      {/* Right panel — live preview */}
      <div className="flex-1 flex flex-col min-w-0 bg-black">
        <div className="px-4 py-2 border-b border-white/10 flex items-center gap-2 bg-black">
          <Play size={13} className="text-white" />
          <span className="text-xs text-zinc-300 font-mono uppercase tracking-wider font-medium">Telemetry Monitor Preview</span>
          {selectedFields.length > 0 && (
            <div className="flex gap-1.5 ml-3">
              {selectedFields.map((f, i) => {
                const fd = sensorRegistry.getField(f);
                return (
                  <span
                    key={f}
                    className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 border border-white/10 text-white"
                    style={{ borderLeft: `3px solid ${COLORS[i % COLORS.length]}` }}
                  >
                    {fd?.label ?? f}
                  </span>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex-1 p-4 overflow-auto">
          {selectedFields.length === 0 && chartType !== 'cubesat' && chartType !== 'map' ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-600 gap-2 font-mono">
              <BarChart2 size={36} className="opacity-20 text-white" />
              <p className="text-xs">Select telemetry channel from the side panel</p>
            </div>
          ) : (
            <div className="h-full">
              {chartType === 'cubesat' && (
                <div className="h-full min-h-[350px] bg-[#08080a] border border-white/10 rounded-xl p-1">
                  <CubeSatViewer title={title || 'CubeSat Attitude 3D'} />
                </div>
              )}
              {chartType === 'map' && (
                <div className="h-full min-h-[350px] bg-[#08080a] border border-white/10 rounded-xl p-1">
                  <GpsMapWidget title={title || 'GPS Ground Track Map'} />
                </div>
              )}
              {chartType === 'value' && (
                <div className="max-w-xs h-40 bg-[#08080a] border border-white/10 rounded-xl">
                  <LiveValueCard fieldRef={selectedFields[0]} title={title} />
                </div>
              )}
              {chartType === 'gauge' && (
                <div className="max-w-xs h-64 bg-[#08080a] border border-white/10 rounded-xl">
                  <GaugeWidget fieldRef={selectedFields[0]} title={title} />
                </div>
              )}
              {['timeseries', 'area', 'bar'].includes(chartType) && (
                <div className="h-full min-h-[350px] bg-[#08080a] border border-white/10 rounded-xl p-2">
                  <TimeSeriesChart
                    series={series}
                    title={title}
                    chartType={chartType as 'timeseries' | 'area' | 'bar'}
                    timeRange={timeRange}
                    autoScale={true}
                    showGrid={true}
                    showLegend={selectedFields.length > 1}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
