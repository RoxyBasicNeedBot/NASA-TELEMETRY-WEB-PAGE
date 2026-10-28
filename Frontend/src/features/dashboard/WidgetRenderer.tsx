import { useState } from 'react';
import { Settings, X, Copy } from 'lucide-react';
import type { WidgetConfig } from '../../types/telemetry';
import { useDashboardStore } from '../../stores/dashboardStore';
import { LiveValueCard } from '../../components/widgets/LiveValueCard';
import { TimeSeriesChart } from '../../components/widgets/TimeSeriesChart';
import { GaugeWidget } from '../../components/widgets/GaugeWidget';
import { ConnectionStatusWidget } from '../../components/widgets/ConnectionStatusWidget';
import { CubeSatViewer } from '../../components/widgets/CubeSatViewer';
import { GpsMapWidget } from '../../components/widgets/GpsMapWidget';
import { WidgetEditModal } from './WidgetEditModal';

interface Props {
  widget: WidgetConfig;
  isEditing: boolean;
}

export function WidgetRenderer({ widget, isEditing }: Props) {
  const removeWidget = useDashboardStore(s => s.removeWidget);
  const duplicateWidget = useDashboardStore(s => s.duplicateWidget);
  const [showEdit, setShowEdit] = useState(false);

  const series = widget.fields.map((f, i) => ({
    fieldRef: f,
    color: widget.color && i === 0 ? widget.color : undefined,
  }));

  const renderContent = () => {
    if (widget.type === 'cubesat') {
      return <CubeSatViewer title={widget.title} />;
    }

    if (widget.type === 'map') {
      return <GpsMapWidget title={widget.title} />;
    }

    // Connection status widget has no fields
    if (widget.fields.length === 0) {
      return <ConnectionStatusWidget />;
    }

    switch (widget.type) {
      case 'value':
        return (
          <LiveValueCard
            fieldRef={widget.fields[0]}
            title={widget.title}
          />
        );
      case 'gauge':
        return (
          <GaugeWidget
            fieldRef={widget.fields[0]}
            title={widget.title}
          />
        );
      case 'timeseries':
        return (
          <TimeSeriesChart
            series={series}
            title={widget.title}
            chartType="timeseries"
            timeRange={widget.timeRange}
            autoScale={widget.autoScale}
            yMin={widget.yMin}
            yMax={widget.yMax}
            showGrid={widget.showGrid ?? true}
            showLegend={widget.showLegend ?? false}
            smoothing={widget.smoothing ?? false}
          />
        );
      case 'area':
        return (
          <TimeSeriesChart
            series={series}
            title={widget.title}
            chartType="area"
            timeRange={widget.timeRange}
            autoScale={widget.autoScale}
            yMin={widget.yMin}
            yMax={widget.yMax}
            showGrid={widget.showGrid ?? true}
            showLegend={widget.showLegend ?? false}
            smoothing={widget.smoothing ?? false}
          />
        );
      case 'bar':
        return (
          <TimeSeriesChart
            series={series}
            title={widget.title}
            chartType="bar"
            timeRange={widget.timeRange}
            autoScale={widget.autoScale}
            showGrid={widget.showGrid ?? true}
          />
        );
      default:
        return (
          <div className="h-full flex items-center justify-center text-zinc-500 text-sm">
            Unknown widget type: {widget.type}
          </div>
        );
    }
  };

  return (
    <div className="h-full flex flex-col rounded-2xl overflow-hidden group bg-[#2a2a2a] border border-white/5 hover:border-white/10 shadow-lg transition-all duration-150">
      {/* Widget title bar */}
      <div className={`widget-drag-handle flex items-center justify-between px-3.5 py-2 border-b border-white/5 shrink-0 select-none bg-[#2a2a2a] ${isEditing ? 'cursor-grab active:cursor-grabbing bg-white/10' : ''}`}>
        <span className="text-zinc-200 text-xs font-medium tracking-tight truncate flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#10a37f] shrink-0" />
          <span className="font-sans text-xs text-white">{widget.title}</span>
        </span>
        {isEditing && (
          <div className="flex items-center gap-1 ml-2">
            <button
              onClick={() => setShowEdit(true)}
              className="p-1 text-zinc-400 hover:text-white hover:bg-white/10 rounded-md transition-colors"
              onMouseDown={e => e.stopPropagation()}
              title="Settings"
            >
              <Settings size={12} />
            </button>
            <button
              onClick={() => duplicateWidget(widget.id)}
              className="p-1 text-zinc-400 hover:text-white hover:bg-white/10 rounded-md transition-colors"
              onMouseDown={e => e.stopPropagation()}
              title="Duplicate"
            >
              <Copy size={12} />
            </button>
            <button
              onClick={() => removeWidget(widget.id)}
              className="p-1 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
              onMouseDown={e => e.stopPropagation()}
              title="Remove"
            >
              <X size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Widget content */}
      <div className="flex-1 min-h-0 overflow-hidden bg-[#242424]">
        {renderContent()}
      </div>

      {showEdit && (
        <WidgetEditModal widget={widget} onClose={() => setShowEdit(false)} />
      )}
    </div>
  );
}
