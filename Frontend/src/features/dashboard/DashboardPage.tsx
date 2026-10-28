import { useCallback, useState, useRef, useEffect } from 'react';
import GridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { Plus, Edit3, RotateCcw, LayoutGrid, ChevronDown, Check } from 'lucide-react';
import { useDashboardStore, selectActiveLayout } from '../../stores/dashboardStore';
import { useMissionStore } from '../../stores/missionStore';
import { WidgetRenderer } from './WidgetRenderer';
import { AddWidgetModal } from './AddWidgetModal';
import type { GridItemLayout } from '../../types/telemetry';

const COLS = 12;
const ROW_HEIGHT = 60;

interface RGLItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

export function DashboardPage() {
  const store = useDashboardStore();
  const activeLayout = useDashboardStore(selectActiveLayout);
  const configuredSensorIds = useMissionStore(s => s.configuredSensorIds);
  const [showAddWidget, setShowAddWidget] = useState(false);
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);
  const [newLayoutName, setNewLayoutName] = useState('');

  const gridContainerRef = useRef<HTMLDivElement>(null);
  const [gridWidth, setGridWidth] = useState(1200);

  useEffect(() => {
    if (!gridContainerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 50) {
          setGridWidth(Math.floor(entry.contentRect.width - 24));
        }
      }
    });
    observer.observe(gridContainerRef.current);
    return () => observer.disconnect();
  }, []);

  const handleLayoutChange = useCallback(
    (layout: RGLItem[]) => {
      if (!activeLayout) return;
      const updated: GridItemLayout[] = layout.map(item => {
        const existing = activeLayout.gridLayout.find(g => g.i === item.i);
        return {
          i: item.i,
          x: item.x,
          y: item.y,
          w: item.w,
          h: item.h,
          minW: existing?.minW,
          minH: existing?.minH,
        };
      });
      store.updateGridLayout(activeLayout.id, updated);
    },
    [activeLayout, store]
  );

  if (!activeLayout) {
    return (
      <div className="h-full flex items-center justify-center text-white/40">
        <div className="text-center p-8 bg-[#0d111c] border border-white/[0.08] rounded-xl font-mono">
          <LayoutGrid size={36} className="mx-auto mb-3 opacity-40 text-sky-400" />
          <p className="text-xs">No active telemetry layout found. Reload to initialize.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-transparent font-mono">
      {/* Precision Aerospace Mission Control Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.08] bg-[#0c0f1a] shrink-0 z-20 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-bold tracking-wider text-emerald-300 uppercase">
              LIVE TELEMETRY
            </span>
          </div>
          <span className="text-white/20 hidden sm:inline">|</span>
          <span className="hidden sm:inline text-[11px] text-slate-400">
            LAYOUT: <strong className="text-slate-200 font-medium uppercase">{activeLayout.name}</strong>
          </span>
          <span className="hidden md:inline text-[11px] text-slate-400">
            ORBIT: <strong className="text-sky-300 font-medium">1U LEO 400KM</strong>
          </span>
        </div>

        {/* Toolbar Actions */}
        <div className="flex items-center gap-2">
          {/* Layout selector */}
          <div className="relative">
            <button
              onClick={() => setShowLayoutMenu(m => !m)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-slate-200 hover:text-white bg-[#141928] hover:bg-[#1a2236] border border-white/10 rounded text-xs transition-colors"
            >
              <LayoutGrid size={12} className="text-sky-400" />
              <span>{activeLayout.name}</span>
              <ChevronDown size={11} className="text-slate-400" />
            </button>
            {showLayoutMenu && (
              <div
                className="absolute top-full right-0 mt-1.5 rounded-lg shadow-2xl z-30 w-60 overflow-hidden p-1 bg-[#101524] border border-white/10"
              >
                <div className="space-y-0.5">
                  {store.layouts.map(l => (
                    <button
                      key={l.id}
                      onClick={() => { store.setActiveLayout(l.id); setShowLayoutMenu(false); }}
                      className={`w-full text-left px-2.5 py-1.5 text-xs rounded transition-colors flex items-center justify-between ${
                        l.id === activeLayout.id
                          ? 'bg-sky-500/20 text-sky-200 border border-sky-500/30 font-medium'
                          : 'text-slate-300 hover:bg-white/[0.06] hover:text-white'
                      }`}
                    >
                      <span className="truncate">{l.name}</span>
                      <div className="flex items-center gap-1">
                        {l.isDefault && <span className="text-[10px] text-slate-500">(default)</span>}
                        {l.id === activeLayout.id && <Check size={11} className="text-sky-400" />}
                      </div>
                    </button>
                  ))}
                </div>
                <div className="border-t border-white/[0.08] mt-1 pt-1 px-1 pb-0.5">
                  <div className="flex gap-1.5">
                    <input
                      value={newLayoutName}
                      onChange={e => setNewLayoutName(e.target.value)}
                      placeholder="New layout name…"
                      className="flex-1 text-xs bg-[#090c14] border border-white/10 rounded px-2 py-1 text-white focus:outline-none focus:border-sky-500"
                      onKeyDown={e => { if (e.key === 'Enter' && newLayoutName) { store.saveLayout(newLayoutName); setNewLayoutName(''); } }}
                    />
                    <button
                      onClick={() => { if (newLayoutName) { store.saveLayout(newLayoutName); setNewLayoutName(''); } }}
                      className="px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded text-xs font-semibold"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => setShowAddWidget(true)}
            className="flex items-center gap-1 px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded text-xs font-semibold uppercase tracking-wider transition-colors shadow-sm"
          >
            <Plus size={12} /> Add Widget
          </button>

          <button
            onClick={() => store.setEditing(!store.isEditing)}
            className={`flex items-center gap-1 px-2.5 py-1 border rounded text-xs transition-colors uppercase tracking-wider ${
              store.isEditing
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'border-white/10 bg-[#141928] text-slate-300 hover:text-white hover:bg-[#1a2236]'
            }`}
          >
            <Edit3 size={11} /> {store.isEditing ? 'Done' : 'Edit'}
          </button>

          <button
            onClick={() => store.resetToDefault(configuredSensorIds)}
            className="p-1 border border-white/10 bg-[#141928] text-slate-400 hover:text-white hover:bg-[#1a2236] rounded text-xs transition-colors"
            title="Reset layout to default"
          >
            <RotateCcw size={12} />
          </button>
        </div>
      </div>

      {store.isEditing && (
        <div className="px-4 py-1.5 bg-amber-500/10 border-b border-amber-500/20 text-amber-300 text-xs shrink-0 flex items-center justify-between">
          <span>EDIT MODE ACTIVE: Drag headers to reposition widgets. Resize from bottom-right handle. Configure via ⚙ icon.</span>
        </div>
      )}

      {/* Grid */}
      <div ref={gridContainerRef} className="flex-1 overflow-auto p-3">
        <GridLayout
          className="layout"
          layout={activeLayout.gridLayout}
          cols={COLS}
          rowHeight={ROW_HEIGHT}
          width={gridWidth}
          isDraggable={store.isEditing}
          isResizable={store.isEditing}
          onLayoutChange={handleLayoutChange as any}
          draggableHandle=".widget-drag-handle"
          margin={[12, 12]}
          useCSSTransforms={true}
        >
          {activeLayout.widgets.map((widget) => (
            <div key={widget.id} className="overflow-hidden">
              <WidgetRenderer widget={widget} isEditing={store.isEditing} />
            </div>
          ))}
        </GridLayout>

        {activeLayout.widgets.length === 0 && (
          <div className="flex flex-col items-center justify-center h-72 text-white/40 gap-3 bg-[#0d111c] border border-dashed border-white/10 rounded-xl p-8">
            <LayoutGrid size={36} className="opacity-40 text-sky-400" />
            <p className="text-xs font-medium text-white/70">No widgets placed in this layout.</p>
            <button
              onClick={() => setShowAddWidget(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded text-xs font-semibold uppercase tracking-wider transition-colors"
            >
              <Plus size={12} /> Add First Widget
            </button>
          </div>
        )}
      </div>

      {showAddWidget && <AddWidgetModal onClose={() => setShowAddWidget(false)} />}
    </div>
  );
}
