import { useState } from 'react';
import { X, Sliders, Check } from 'lucide-react';
import type { WidgetConfig, TimeRange } from '../../types/telemetry';
import { useDashboardStore } from '../../stores/dashboardStore';
import { sensorRegistry } from '../sensors/registry';

interface Props {
  widget: WidgetConfig;
  onClose: () => void;
}

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: 'live', label: 'Live (5m window)' },
  { value: '1m', label: '1 minute' },
  { value: '5m', label: '5 minutes' },
  { value: '15m', label: '15 minutes' },
  { value: '1h', label: '1 hour' },
  { value: '6h', label: '6 hours' },
];

export function WidgetEditModal({ widget, onClose }: Props) {
  const updateWidget = useDashboardStore(s => s.updateWidget);
  const [title, setTitle] = useState(widget.title);
  const [timeRange, setTimeRange] = useState<TimeRange>(widget.timeRange);
  const [autoScale, setAutoScale] = useState(widget.autoScale);
  const [showGrid, setShowGrid] = useState(widget.showGrid ?? true);
  const [showLegend, setShowLegend] = useState(widget.showLegend ?? false);
  const [smoothing, setSmoothing] = useState(widget.smoothing ?? false);
  const [color, setColor] = useState(widget.color ?? '#38bdf8');

  const handleSave = () => {
    updateWidget(widget.id, { title, timeRange, autoScale, showGrid, showLegend, smoothing, color });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 animate-scale-in"
      onClick={onClose}
    >
      <div
        className="relative overflow-hidden rounded-xl p-5 w-full max-w-md bg-[#0d111c] border border-white/[0.12] shadow-2xl text-white select-none transition-all"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-2">
            <Sliders size={16} className="text-sky-400" />
            <h3 className="text-white font-semibold text-sm tracking-wide uppercase font-mono">
              Configure Widget
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-white/60 mb-1.5">
              Widget Title
            </label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-[#131929] border border-white/[0.1] rounded-lg px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-sky-500 font-mono"
            />
          </div>

          {widget.fields.length > 0 && (
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-white/60 mb-1.5">
                Subscribed Telemetry Channels
              </label>
              <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                {widget.fields.map(f => {
                  const fd = sensorRegistry.getField(f);
                  return (
                    <div
                      key={f}
                      className="flex items-center justify-between text-xs bg-[#131929] border border-white/[0.08] rounded-lg px-3 py-2 font-mono"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                        <span className="text-white/80">{fd?.label ?? f}</span>
                      </div>
                      <span className="text-white/40 text-[10px]">{fd?.unit ?? 'raw'}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-white/60 mb-1.5">
              Time Window
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

          {widget.fields.length > 0 && (
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-white/60 mb-1.5">
                Trace Color
              </label>
              <div className="flex items-center gap-3 bg-[#131929] border border-white/[0.08] rounded-lg p-2">
                <input
                  type="color"
                  value={color}
                  onChange={e => setColor(e.target.value)}
                  className="h-7 w-10 rounded cursor-pointer bg-transparent border-0"
                />
                <span className="font-mono text-xs text-white/70 uppercase">{color}</span>
              </div>
            </div>
          )}

          {/* Toggle Switches */}
          <div className="space-y-2 pt-2 border-t border-white/[0.08]">
            {[
              { key: 'autoScale', label: 'Auto-scale Y Axis', value: autoScale, set: setAutoScale },
              { key: 'showGrid', label: 'Grid Lines', value: showGrid, set: setShowGrid },
              { key: 'showLegend', label: 'Series Legend', value: showLegend, set: setShowLegend },
              { key: 'smoothing', label: 'Smoothing Filter', value: smoothing, set: setSmoothing },
            ].map(({ key, label, value, set }) => (
              <label key={key} className="flex items-center justify-between cursor-pointer py-1 text-xs">
                <span className="font-mono text-white/70">{label}</span>
                <button
                  type="button"
                  onClick={() => set(!value)}
                  className={`w-8 h-4 rounded-full transition-colors relative ${
                    value ? 'bg-sky-500' : 'bg-white/10'
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${
                      value ? 'left-4.5' : 'left-0.5'
                    }`}
                  />
                </button>
              </label>
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex gap-2.5 mt-5 pt-4 border-t border-white/[0.08]">
          <button
            onClick={onClose}
            className="flex-1 py-2 border border-white/[0.1] bg-[#131929] hover:bg-[#1a2236] text-white/70 hover:text-white rounded-lg text-xs font-mono uppercase tracking-wider transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-mono uppercase tracking-wider font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-sm"
          >
            <Check size={14} />
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
