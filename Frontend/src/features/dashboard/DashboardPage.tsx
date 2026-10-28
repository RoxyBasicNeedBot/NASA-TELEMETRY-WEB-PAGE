import { useCallback, useState, useRef, useEffect } from 'react';
import GridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import {
  Plus, Edit3, RotateCcw, LayoutGrid, ChevronDown, Check,
  Sparkles, ArrowUp, Mic, SlidersHorizontal, MessageSquare
} from 'lucide-react';
import { useDashboardStore, selectActiveLayout } from '../../stores/dashboardStore';
import { useMissionStore } from '../../stores/missionStore';
import { WidgetRenderer } from './WidgetRenderer';
import { AddWidgetModal } from './AddWidgetModal';
import { OrbitraLogo } from '../../components/common/OrbitraLogo';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  const store = useDashboardStore();
  const activeLayout = useDashboardStore(selectActiveLayout);
  const configuredSensorIds = useMissionStore(s => s.configuredSensorIds);
  const [showAddWidget, setShowAddWidget] = useState(false);
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);
  const [newLayoutName, setNewLayoutName] = useState('');
  const [commandPrompt, setCommandPrompt] = useState('');

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

  const handleCommandSubmit = () => {
    if (!commandPrompt.trim()) return;
    const lower = commandPrompt.toLowerCase();
    if (lower.includes('add widget') || lower.includes('new widget')) {
      setShowAddWidget(true);
      setCommandPrompt('');
    } else if (lower.includes('reset') || lower.includes('default')) {
      store.resetToDefault(configuredSensorIds);
      setCommandPrompt('');
    } else if (lower.includes('edit')) {
      store.setEditing(true);
      setCommandPrompt('');
    } else {
      // Navigate to copilot to converse
      navigate('/copilot');
    }
  };

  if (!activeLayout) {
    return (
      <div className="h-full flex items-center justify-center text-zinc-400 bg-[#212121]">
        <div className="text-center p-8 bg-[#2f2f2f] border border-white/10 rounded-2xl">
          <OrbitraLogo size={36} className="mx-auto mb-3 opacity-40" />
          <p className="text-xs text-zinc-300">No active telemetry layout found. Reload to initialize.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#212121] relative overflow-hidden font-sans">
      {/* ChatGPT Styled Dashboard Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-[#212121] shrink-0 z-20">
        <div className="flex items-center gap-2.5 text-xs">
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#10a37f]/10 border border-[#10a37f]/20 text-[#10a37f]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10a37f] animate-pulse" />
            <span className="text-[11px] font-medium tracking-wide">Live Stream</span>
          </div>
          <span className="text-zinc-600">·</span>
          <span className="text-zinc-400 text-xs">
            Layout: <strong className="text-white font-medium">{activeLayout.name}</strong>
          </span>
          <span className="text-zinc-600 hidden md:inline">·</span>
          <span className="text-zinc-400 text-xs hidden md:inline">
            Standard: <strong className="text-sky-400 font-medium font-mono">1U CubeSat LEO</strong>
          </span>
        </div>

        {/* Toolbar Actions */}
        <div className="flex items-center gap-2">
          {/* Layout selector dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowLayoutMenu(m => !m)}
              className="h-8 inline-flex items-center gap-1.5 px-3 text-xs text-zinc-300 hover:text-white bg-[#2f2f2f] hover:bg-[#383838] border border-white/10 rounded-full transition-all shadow-sm active:scale-[0.98]"
            >
              <LayoutGrid size={13} className="text-zinc-400" />
              <span>{activeLayout.name}</span>
              <ChevronDown size={12} className="text-zinc-500" />
            </button>
            {showLayoutMenu && (
              <div
                className="absolute top-full right-0 mt-1.5 rounded-2xl shadow-2xl z-30 w-56 overflow-hidden p-1.5 bg-[#2f2f2f] border border-white/10 animate-in fade-in zoom-in-95"
              >
                <div className="space-y-0.5">
                  {store.layouts.map(l => (
                    <button
                      key={l.id}
                      onClick={() => { store.setActiveLayout(l.id); setShowLayoutMenu(false); }}
                      className={`w-full text-left px-2.5 py-1.5 text-xs rounded-xl transition-colors flex items-center justify-between ${
                        l.id === activeLayout.id
                          ? 'bg-[#383838] text-white font-medium'
                          : 'text-zinc-400 hover:bg-[#343434] hover:text-white'
                      }`}
                    >
                      <span className="truncate">{l.name}</span>
                      <div className="flex items-center gap-1">
                        {l.isDefault && <span className="text-[10px] text-zinc-500">(default)</span>}
                        {l.id === activeLayout.id && <Check size={12} className="text-[#10a37f]" />}
                      </div>
                    </button>
                  ))}
                </div>
                <div className="border-t border-white/10 mt-1.5 pt-1.5 px-1 pb-0.5">
                  <div className="flex gap-1.5">
                    <input
                      value={newLayoutName}
                      onChange={e => setNewLayoutName(e.target.value)}
                      placeholder="New layout name…"
                      className="h-7 flex-1 text-xs bg-[#212121] border border-white/10 rounded-lg px-2 text-white focus:outline-none focus:border-white/30"
                      onKeyDown={e => { if (e.key === 'Enter' && newLayoutName) { store.saveLayout(newLayoutName); setNewLayoutName(''); } }}
                    />
                    <button
                      onClick={() => { if (newLayoutName) { store.saveLayout(newLayoutName); setNewLayoutName(''); } }}
                      className="h-7 px-2.5 bg-white hover:bg-zinc-200 text-black rounded-lg text-xs font-medium"
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
            className="h-8 inline-flex items-center gap-1.5 px-3.5 bg-white hover:bg-zinc-100 active:bg-zinc-200 text-black rounded-full text-xs font-medium transition-all shadow-sm active:scale-[0.98]"
          >
            <Plus size={14} />
            <span>Add widget</span>
          </button>

          <button
            onClick={() => store.setEditing(!store.isEditing)}
            className={`h-8 inline-flex items-center gap-1.5 px-3 rounded-full text-xs font-medium transition-all shadow-sm active:scale-[0.98] ${
              store.isEditing
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'border border-white/10 bg-[#2f2f2f] text-zinc-300 hover:text-white hover:bg-[#383838]'
            }`}
          >
            <Edit3 size={12} className={store.isEditing ? 'text-amber-300' : 'text-zinc-400'} />
            <span>{store.isEditing ? 'Done' : 'Edit grid'}</span>
          </button>

          <button
            onClick={() => store.resetToDefault(configuredSensorIds)}
            className="h-8 w-8 flex items-center justify-center border border-white/10 bg-[#2f2f2f] text-zinc-400 hover:text-white hover:bg-[#383838] rounded-full transition-colors"
            title="Reset layout to default"
          >
            <RotateCcw size={13} />
          </button>
        </div>
      </div>

      {store.isEditing && (
        <div className="px-4 py-1.5 bg-amber-500/10 border-b border-amber-500/20 text-amber-300 text-xs shrink-0 flex items-center justify-between">
          <span>EDIT MODE ACTIVE: Drag headers to reposition widgets. Resize from bottom-right handle. Configure via ⚙ icon.</span>
        </div>
      )}

      {/* Grid Canvas */}
      <div ref={gridContainerRef} className="flex-1 overflow-auto p-4 pb-20">
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
          margin={[14, 14]}
          useCSSTransforms={true}
        >
          {activeLayout.widgets.map((widget) => (
            <div key={widget.id} className="overflow-hidden">
              <WidgetRenderer widget={widget} isEditing={store.isEditing} />
            </div>
          ))}
        </GridLayout>

        {activeLayout.widgets.length === 0 && (
          <div className="flex flex-col items-center justify-center h-72 text-zinc-400 gap-3 bg-[#2a2a2a] border border-dashed border-white/10 rounded-2xl p-8">
            <OrbitraLogo size={42} className="opacity-40" />
            <p className="text-xs font-medium text-zinc-300">No widgets placed in this layout.</p>
            <button
              onClick={() => setShowAddWidget(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-zinc-200 text-black rounded-full text-xs font-medium transition-colors shadow"
            >
              <Plus size={13} /> Add first widget
            </button>
          </div>
        )}
      </div>

      {/* Floating ChatGPT Command Pill at the bottom */}
      <div className="absolute bottom-3 left-0 right-0 max-w-2xl mx-auto px-4 pointer-events-auto z-20">
        <div className="rounded-[26px] bg-[#2f2f2f]/95 backdrop-blur-md border border-white/10 px-3.5 py-2 shadow-2xl flex items-center gap-2 transition-all focus-within:border-white/20">
          <button
            onClick={() => navigate('/copilot')}
            className="w-7 h-7 rounded-full bg-[#10a37f]/20 text-[#10a37f] flex items-center justify-center hover:bg-[#10a37f]/30 transition-colors shrink-0"
            title="Open Telemetry AI Copilot"
          >
            <Sparkles size={14} />
          </button>

          <input
            type="text"
            value={commandPrompt}
            onChange={e => setCommandPrompt(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleCommandSubmit();
              }
            }}
            placeholder="Ask Orbitra AI or command dashboard (e.g. 'Reset view', 'Add widget')..."
            className="flex-1 bg-transparent text-xs text-[#ececec] placeholder-zinc-500 focus:outline-none"
          />

          <button
            onClick={handleCommandSubmit}
            disabled={!commandPrompt.trim()}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all shrink-0 ${
              commandPrompt.trim()
                ? 'bg-white text-black hover:bg-zinc-200'
                : 'bg-[#424242] text-zinc-500 cursor-not-allowed'
            }`}
            title="Submit command or ask AI"
          >
            <ArrowUp size={14} />
          </button>
        </div>
      </div>

      {showAddWidget && <AddWidgetModal onClose={() => setShowAddWidget(false)} />}
    </div>
  );
}
