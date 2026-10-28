import { useState } from 'react';
import { BarChart2, Plus, Check } from 'lucide-react';
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

const COLORS = ['#10a37f', '#38bdf8', '#fbbf24', '#818cf8', '#f87171'];

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
      : 'Telemetry Plot');

    const widget: WidgetConfig = {
      id,
      type: chartType,
      title: fieldTitle,
      fields: selectedFields,
      color: COLORS[0],
      timeRange,
      autoScale: true,
      showGrid: true,
      showLegend: selectedFields.length > 1,
      smoothing: false,
    };

    const isSmall = chartType === 'value' || chartType === 'gauge';
    const isLarge = chartType === 'cubesat' || chartType === 'map';

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
    <div className="h-full flex bg-[#212121] text-[#ececec] font-sans">
      {/* Left panel — field picker + config */}
      <div className="w-80 shrink-0 border-r border-white/5 flex flex-col overflow-hidden bg-[#1a1a1a]">
        <div className="p-4 border-b border-white/5">
          <h1 className="text-sm font-semibold tracking-tight text-white flex items-center gap-2">
            <BarChart2 size={16} className="text-[#10a37f]" /> Plot Designer
          </h1>
          <p className="text-zinc-400 text-xs mt-0.5">Author custom telemetry telemetry views</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-[11px] text-zinc-400 mb-1 font-medium">Plot Title</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Auto-inferred..."
              className="w-full bg-[#242424] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#10a37f]"
            />
          </div>

          {/* Chart type */}
          <div>
            <label className="block text-[11px] text-zinc-400 mb-1 font-medium">Visualization Mode</label>
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
                  className={`text-left px-3 py-2 rounded-xl text-xs transition-colors border ${
                    chartType === ct.value
                      ? 'bg-white text-black border-white font-medium'
                      : 'text-zinc-300 bg-[#242424] border-white/5 hover:text-white hover:bg-[#2c2c2c]'
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
              <label className="block text-[11px] text-zinc-400 mb-1 font-medium">Sampling Window</label>
              <div className="flex flex-wrap gap-1.5">
                {TIME_RANGES.map(r => (
                  <button
                    key={r.value}
                    onClick={() => setTimeRange(r.value)}
                    className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${
                      timeRange === r.value
                        ? 'bg-[#10a37f] text-white font-medium'
                        : 'bg-[#242424] text-zinc-400 hover:text-white border border-white/5'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Field selection */}
          {chartType !== 'cubesat' && chartType !== 'map' && (
            <div>
              <label className="block text-[11px] text-zinc-400 mb-1 font-medium">
                Telemetry Fields {['value', 'gauge'].includes(chartType) ? '(Select 1)' : '(Multiple)'}
              </label>
              <div className="space-y-3">
                {sensors.map(sensor => {
                  const sensorFields = sensor.fields;
                  if (sensorFields.length === 0) return null;
                  return (
                    <div key={sensor.sensorId} className="space-y-1">
                      <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
                        {sensor.displayName}
                      </p>
                      <div className="space-y-1">
                        {sensorFields.map(field => {
                          const ref = `${sensor.sensorId}.${field.fieldKey}`;
                          const isSelected = selectedFields.includes(ref);
                          return (
                            <button
                              key={field.fieldKey}
                              onClick={() => toggleField(ref)}
                              className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-between transition-colors border ${
                                isSelected
                                  ? 'bg-[#10a37f]/15 text-[#10a37f] border-[#10a37f]/30 font-medium'
                                  : 'text-zinc-400 hover:text-white hover:bg-[#242424] border-transparent'
                              }`}
                            >
                              <span>{field.label}</span>
                              {isSelected && <Check size={12} className="text-[#10a37f]" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Add to Dashboard Button */}
          <button
            onClick={handleAddToDashboard}
            disabled={!canAdd}
            className={`w-full py-2.5 rounded-full text-xs font-medium flex items-center justify-center gap-1.5 transition-all shadow-sm ${
              canAdd
                ? added
                  ? 'bg-[#10a37f] text-white'
                  : 'bg-white hover:bg-zinc-200 text-black active:scale-[0.98]'
                : 'bg-[#2a2a2a] text-zinc-600 cursor-not-allowed'
            }`}
          >
            {added ? (
              <>
                <Check size={14} /> Added to dashboard
              </>
            ) : (
              <>
                <Plus size={14} /> Add to dashboard
              </>
            )}
          </button>
        </div>
      </div>

      {/* Right panel — Live Preview */}
      <div className="flex-1 flex flex-col p-6 overflow-hidden bg-[#212121]">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-white tracking-tight">Live Widget Preview</h2>
          <p className="text-xs text-zinc-400">Dynamic rendering with real-time incoming flight telemetry</p>
        </div>

        <div className="flex-1 bg-[#2a2a2a] border border-white/5 rounded-2xl overflow-hidden p-4 shadow-xl">
          {chartType === 'cubesat' ? (
            <CubeSatViewer title={title || 'CubeSat 1U Orientation'} />
          ) : chartType === 'map' ? (
            <GpsMapWidget title={title || 'GPS Ground Track Map'} />
          ) : chartType === 'value' && selectedFields[0] ? (
            <LiveValueCard fieldRef={selectedFields[0]} title={title} />
          ) : chartType === 'gauge' && selectedFields[0] ? (
            <GaugeWidget fieldRef={selectedFields[0]} title={title} />
          ) : (chartType === 'timeseries' || chartType === 'area' || chartType === 'bar') && selectedFields.length > 0 ? (
            <TimeSeriesChart
              series={series}
              title={title}
              chartType={chartType}
              timeRange={timeRange}
              autoScale={true}
              showGrid={true}
              showLegend={selectedFields.length > 1}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-zinc-500 text-xs">
              Select at least one telemetry field to render preview
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
