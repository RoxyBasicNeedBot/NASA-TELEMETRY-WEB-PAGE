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
      setError(`Backend query: ${err instanceof Error ? err.message : String(err)}`);
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
    <div className="p-6 space-y-4 max-w-5xl mx-auto bg-[#212121] text-[#ececec] font-sans">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
            <Database size={18} className="text-[#10a37f]" /> Telemetry Archive Log
          </h1>
          <p className="text-zinc-400 text-xs mt-0.5">Historical telemetry storage retrieval and data export</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 bg-[#2a2a2a] border border-white/5 rounded-2xl p-3.5 shadow-sm">
        {/* Field selector */}
        <div>
          <label className="block text-[11px] text-zinc-400 mb-1 font-medium">Channel</label>
          <select
            value={selectedField}
            onChange={e => setSelectedField(e.target.value)}
            className="bg-[#212121] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#10a37f]"
          >
            {fields.map(({ sensorId, fieldDef }) => (
              <option key={`${sensorId}.${fieldDef.fieldKey}`} value={`${sensorId}.${fieldDef.fieldKey}`} className="bg-[#212121] text-white">
                {sensorRegistry.getSensor(sensorId)?.displayName} · {fieldDef.label}
              </option>
            ))}
          </select>
        </div>

        {/* Presets */}
        <div>
          <label className="block text-[11px] text-zinc-400 mb-1 font-medium">Time Window</label>
          <div className="flex gap-1.5">
            {PRESETS.map(p => (
              <button
                key={p.label}
                onClick={() => { setFrom(p.from()); setTo(Date.now()); }}
                className="px-3 py-1.5 text-xs rounded-xl bg-[#212121] hover:bg-[#343434] border border-white/10 text-zinc-300 hover:text-white transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 ml-auto">
          <button
            onClick={fetchHistory}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#212121] hover:bg-[#343434] border border-white/10 text-zinc-300 hover:text-white rounded-full text-xs font-medium transition-colors"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Query
          </button>
          <button
            onClick={handleExportCSV}
            disabled={rows.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-zinc-200 text-black rounded-full text-xs font-medium transition-colors disabled:opacity-40 shadow-sm"
          >
            <Download size={13} /> Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-xs font-mono">
          {error}
        </div>
      )}

      {/* Results table */}
      <div className="bg-[#2a2a2a] border border-white/5 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-4 py-2.5 border-b border-white/5 flex items-center justify-between text-xs text-zinc-400">
          <span>{totalCount > 0 ? `${totalCount} records indexed` : 'Query completed'}</span>
          {rows.length > 0 && <span>Showing latest {rows.length} rows</span>}
        </div>

        <div className="overflow-x-auto max-h-[500px]">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[#242424] text-zinc-400 sticky top-0 border-b border-white/5">
              <tr>
                <th className="px-4 py-2.5">TIMESTAMP (UTC)</th>
                <th className="px-4 py-2.5">PKT #</th>
                <th className="px-4 py-2.5">SENSOR</th>
                <th className="px-4 py-2.5">FIELD</th>
                <th className="px-4 py-2.5 text-right">VALUE</th>
                <th className="px-4 py-2.5">QUALITY</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map(r => (
                <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-2 text-zinc-400 whitespace-nowrap">
                    {format(new Date(r.ts), 'yyyy-MM-dd HH:mm:ss.SSS')}
                  </td>
                  <td className="px-4 py-2 text-zinc-500">{r.packet_no ?? '—'}</td>
                  <td className="px-4 py-2 text-white font-medium">{r.sensor_id}</td>
                  <td className="px-4 py-2 text-[#10a37f]">{r.field_key}</td>
                  <td className="px-4 py-2 text-right text-white font-semibold tabular-nums">
                    {r.value.toFixed(4)}
                  </td>
                  <td className="px-4 py-2">
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#10a37f]/20 text-[#10a37f]">
                      {r.quality}
                    </span>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-zinc-500 font-sans text-xs">
                    No records found for the selected time window.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
