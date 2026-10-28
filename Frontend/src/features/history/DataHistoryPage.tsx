import { useState, useEffect } from 'react';
import { Database, Download, RefreshCw } from 'lucide-react';
import { format, subHours, subMinutes } from 'date-fns';
import { sensorRegistry } from '../sensors/registry';

const BACKEND =
  typeof window !== 'undefined' &&
  window.location.hostname !== 'localhost' &&
  window.location.hostname !== '127.0.0.1'
    ? window.location.origin
    : 'http://localhost:3001';

interface HistoryRow {
  id: number;
  ts: number;
  sensor_id: string;
  field_key: string;
  value: number;
  packet_no: number | null;
  quality: string;
}

const PRESETS = [
  { label: 'Last 15m', from: () => subMinutes(Date.now(), 15).getTime() },
  { label: 'Last 1h', from: () => subHours(Date.now(), 1).getTime() },
  { label: 'Last 6h', from: () => subHours(Date.now(), 6).getTime() },
  { label: 'Last 24h', from: () => subHours(Date.now(), 24).getTime() },
];

export function DataHistoryPage() {
  const fields = sensorRegistry.getAllFields();
  const [selectedField, setSelectedField] = useState(fields[0] ? `${fields[0].sensorId}.${fields[0].fieldDef.fieldKey}` : '');
  const [from, setFrom] = useState(subHours(Date.now(), 1).getTime());
  const [to, setTo] = useState(Date.now());
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  const [sensorId, fieldKey] = selectedField.split('.');

  const fetchHistory = async () => {
    if (!selectedField) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${BACKEND}/api/telemetry/range?sensorId=${sensorId}&fieldKey=${fieldKey}&from=${from}&to=${to}&limit=500`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { rows: HistoryRow[]; total: number };
      setRows(data.rows ?? []);
      setTotalCount(data.total ?? 0);
    } catch (err) {
      setError(`Backend unavailable: ${err instanceof Error ? err.message : String(err)}`);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (selectedField) fetchHistory(); }, [selectedField, from, to]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleExportCSV = async () => {
    if (!selectedField) return;
    try {
      const res = await fetch(
        `${BACKEND}/api/telemetry/export?sensorId=${sensorId}&fieldKey=${fieldKey}&from=${from}&to=${to}`
      );
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `telemetry_${sensorId}_${fieldKey}_${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-white tracking-wide uppercase font-mono flex items-center gap-2">
            <Database size={16} className="text-sky-400" /> Telemetry Archive Log
          </h1>
          <p className="text-white/40 text-xs font-mono mt-0.5">Historical telemetry storage retrieval and data export</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 bg-[#08080a] border border-white/10 rounded-lg p-3">
        {/* Field selector */}
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">Channel</label>
          <select
            value={selectedField}
            onChange={e => setSelectedField(e.target.value)}
            className="bg-black border border-white/10 rounded px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-white/30"
          >
            {fields.map(({ sensorId, fieldDef }) => (
              <option key={`${sensorId}.${fieldDef.fieldKey}`} value={`${sensorId}.${fieldDef.fieldKey}`} className="bg-black text-white">
                {sensorRegistry.getSensor(sensorId)?.displayName} · {fieldDef.label}
              </option>
            ))}
          </select>
        </div>

        {/* Presets */}
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">Time Window</label>
          <div className="flex gap-1.5">
            {PRESETS.map(p => (
              <button
                key={p.label}
                onClick={() => { setFrom(p.from()); setTo(Date.now()); }}
                className="px-2.5 py-1.5 text-xs rounded bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-300 hover:text-white transition-colors font-mono"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 ml-auto">
          <button
            onClick={fetchHistory}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-300 hover:text-white rounded text-xs font-mono uppercase tracking-wider transition-colors"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Query
          </button>
          <button
            onClick={handleExportCSV}
            disabled={rows.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-zinc-200 text-black rounded text-xs font-mono uppercase tracking-wider font-semibold transition-colors disabled:opacity-40"
          >
            <Download size={12} /> Export CSV
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-lg px-3 py-2 font-mono">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="flex items-center gap-4 text-[11px] font-mono text-white/40 px-1">
        <span>{totalCount.toLocaleString()} total entries</span>
        <span>Displaying {rows.length}</span>
        {rows.length > 0 && (
          <>
            <span>Start: {format(new Date(rows[0].ts), 'HH:mm:ss')} UTC</span>
            <span>End: {format(new Date(rows[rows.length - 1].ts), 'HH:mm:ss')} UTC</span>
          </>
        )}
      </div>

      {/* Table */}
      <div className="bg-[#08080a] border border-white/10 rounded-lg overflow-hidden">
        <div className="grid grid-cols-[auto_auto_1fr_auto_auto] gap-0 text-[10px] text-zinc-400 px-4 py-2 border-b border-white/10 bg-[#0c0c0e] uppercase tracking-wider font-mono">
          <span className="w-28">Timestamp</span>
          <span className="w-20 ml-4">Packet#</span>
          <span className="ml-4">Value</span>
          <span className="w-20">Unit</span>
          <span className="w-20">Quality</span>
        </div>

        <div className="max-h-[55vh] overflow-y-auto">
          {loading && (
            <div className="px-4 py-8 text-center text-white/40 text-xs font-mono">Querying historical records...</div>
          )}
          {!loading && rows.length === 0 && (
            <div className="px-4 py-8 text-center text-white/40 text-xs font-mono">
              No telemetry in selected range.{' '}
              {error ? 'Telemetry server offline.' : 'Awaiting sensor packets.'}
            </div>
          )}
          {rows.map((row) => {
            const fd = sensorRegistry.getField(`${row.sensor_id}.${row.field_key}`);
            return (
              <div
                key={row.id}
                className="grid grid-cols-[auto_auto_1fr_auto_auto] gap-0 px-4 py-2 border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors items-center text-xs font-mono"
              >
                <span className="text-white/50 w-28">{format(new Date(row.ts), 'HH:mm:ss.SSS')}</span>
                <span className="text-white/30 w-20 ml-4">{row.packet_no ?? '—'}</span>
                <span className="text-sky-300 font-semibold ml-4">
                  {row.value.toFixed(fd?.precision ?? 2)}
                </span>
                <span className="text-white/40 w-20">{fd?.unit}</span>
                <span className={`w-20 font-medium ${row.quality === 'ok' ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {row.quality.toUpperCase()}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
