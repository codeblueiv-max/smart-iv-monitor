import React, { useState } from 'react';
import { useMonitoring } from '../context/MonitoringContext';
import { StatusBadge, SeverityBadge, PulseStatusBadge } from '../components/StatusBadge';
import { VolumeChart } from '../components/VolumeChart';
import { DripRateChart } from '../components/DripRateChart';
import { PulseRateChart } from '../components/PulseRateChart';
import { ExportModal } from '../components/ExportModal';
import { formatETA } from '../utils/calculations';
import {
  ArrowLeft,
  Search,
  Download,
  FileText,
  Clock,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Table,
  Heart,
} from 'lucide-react';

interface PatientLogsPageProps {
  onBack: () => void;
}

export function PatientLogsPage({ onBack }: PatientLogsPageProps) {
  const { patients } = useMonitoring();
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(
    patients.length > 0 ? patients[0].details.id : null
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [activeTab, setActiveTab] = useState<'READINGS' | 'CHARTS' | 'ALERTS' | 'EVENTS'>('READINGS');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [logSearchQuery, setLogSearchQuery] = useState('');

  const filteredPatients = patients.filter((p) => {
    if (!p || !p.details) return false;
    const q = searchQuery.toLowerCase().trim();
    const name = String(p.details.patientName || '').toLowerCase();
    const bed = String(p.details.bedNo || '').toLowerCase();
    const fluid = String(p.details.fluidType || '').toLowerCase();
    const matches = !q || name.includes(q) || bed.includes(q) || fluid.includes(q);

    if (!matches) return false;
    if (statusFilter === 'ACTIVE') return p.details.monitoring;
    if (statusFilter === 'FINISHED') return !p.details.monitoring;
    return true;
  });

  const selectedPatient = patients.find((p) => p?.details?.id === selectedPatientId) || patients[0];

  const durationMin = selectedPatient && selectedPatient.details
    ? Math.round(
        ((selectedPatient.details.stopTime || Date.now()) - (selectedPatient.details.startTime || Date.now())) /
          60000
      )
    : 0;
  const durHours = Math.floor(durationMin / 60);
  const durMins = durationMin % 60;

  const avgDripRate =
    selectedPatient && Array.isArray(selectedPatient.logs) && selectedPatient.logs.length > 0
      ? Math.round(
          selectedPatient.logs.reduce((acc, l) => acc + (l?.dripRate || 0), 0) / selectedPatient.logs.length
        )
      : selectedPatient?.current?.dripRate || 0;

  const filteredLogs = (selectedPatient?.logs || []).filter((l) => {
    if (!l) return false;
    if (!logSearchQuery) return true;
    const q = logSearchQuery.toLowerCase();
    const statusStr = String(l.status || '').toLowerCase();
    const pulseStr = String(l.pulseStatus || '').toLowerCase();
    const timeStr = String(new Date(l.timestamp || Date.now()).toLocaleTimeString()).toLowerCase();
    const alertStr = String(l.alertTriggered || '').toLowerCase();
    return (
      statusStr.includes(q) ||
      pulseStr.includes(q) ||
      timeStr.includes(q) ||
      alertStr.includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-12">
      {/* Top Header */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors flex items-center gap-1 text-xs font-bold"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Dashboard</span>
            </button>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <FileText className="w-5 h-5 text-sky-400" />
                <span>PATIENT TELEMETRY LOGS & AUDIT</span>
              </h1>
              <p className="text-xs text-slate-400">Complete historical records, pulse graphs, and data exports</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsExportModalOpen(true)}
              className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              <span>EXPORT LOGS (CSV/XLSX/PDF)</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Patient Directory (4 Cols) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-800">Monitored Records</h3>
                <span className="text-xs text-slate-400">{filteredPatients.length} Patients</span>
              </div>

              {/* Patient Search & Filter */}
              <div className="space-y-2 mb-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search name, bed..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-medium text-slate-600">
                  {(['ALL', 'ACTIVE', 'FINISHED'] as const).map((st) => (
                    <button
                      key={st}
                      onClick={() => setStatusFilter(st)}
                      className={`flex-1 py-1 rounded-md transition-colors text-center ${
                        statusFilter === st ? 'bg-white text-slate-900 shadow-xs font-bold' : ''
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Patient List */}
              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                {filteredPatients.map((p) => {
                  const isSelected = selectedPatient?.details.id === p.details.id;
                  const pulseRate = p.current.pulseRate;
                  return (
                    <div
                      key={p.details.id}
                      onClick={() => setSelectedPatientId(p.details.id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-sky-500 bg-sky-50/70 shadow-xs ring-1 ring-sky-500'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-black bg-slate-200 px-2 py-0.5 rounded text-slate-800">
                          BED {p.details.bedNo}
                        </span>
                        <div className="flex items-center gap-1">
                          <StatusBadge status={p.current.status} size="sm" />
                          <PulseStatusBadge status={p.current.pulseStatus || (pulseRate ? 'NORMAL' : 'NO_PULSE_DATA')} size="sm" />
                        </div>
                      </div>
                      <div className="font-bold text-sm text-slate-900">{p.details.patientName}</div>
                      <div className="flex justify-between text-xs text-slate-500 mt-1">
                        <span>{p.details.fluidType}</span>
                        <span className="font-semibold text-rose-700 flex items-center gap-1">
                          <Heart className="w-3 h-3 text-rose-500 fill-rose-500" />
                          {pulseRate ? `${pulseRate} BPM` : 'No signal'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Selected Patient Log Details (8 Cols) */}
          {selectedPatient ? (
            <div className="lg:col-span-8 space-y-6">
              {/* Infusion Summary Card */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4 mb-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black bg-sky-600 text-white px-2 py-0.5 rounded-md">
                        BED {selectedPatient.details.bedNo}
                      </span>
                      <h2 className="text-xl font-bold text-slate-900">
                        {selectedPatient.details.patientName}
                      </h2>
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          selectedPatient.details.monitoring
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-slate-100 text-slate-700 border border-slate-300'
                        }`}
                      >
                        {selectedPatient.details.monitoring ? 'Active Session' : 'Archived / Stopped'}
                      </span>
                      <PulseStatusBadge
                        status={selectedPatient.current.pulseStatus || (selectedPatient.current.pulseRate ? 'NORMAL' : 'NO_PULSE_DATA')}
                        size="sm"
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {selectedPatient.details.fluidType} • Prescribed {selectedPatient.details.prescribedDripRate} dpm • Drop Factor {selectedPatient.details.dropFactor} drops/mL
                    </p>
                  </div>

                  <div className="text-right">
                    <div className="text-xs text-slate-500">Session Duration</div>
                    <div className="text-sm font-bold text-slate-800 flex items-center gap-1 justify-end">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{durHours}h {durMins}m</span>
                    </div>
                  </div>
                </div>

                {/* KPI Metrics Matrix */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <div className="text-[11px] font-semibold text-slate-500">INITIAL VOL</div>
                    <div className="text-lg font-bold text-slate-900 mt-0.5">
                      {selectedPatient.details.initialVolume} mL
                    </div>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <div className="text-[11px] font-semibold text-slate-500">CURRENT / FINAL</div>
                    <div className="text-lg font-bold text-sky-700 mt-0.5">
                      {selectedPatient.current.volume} mL ({Math.round(selectedPatient.current.remainingPercentage ?? 0)}%)
                    </div>
                  </div>

                  <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-3">
                    <div className="text-[11px] font-semibold text-rose-700 flex items-center justify-center gap-1">
                      <Heart className="w-3 h-3 text-rose-500 fill-rose-500" />
                      <span>CURRENT PULSE</span>
                    </div>
                    <div className="text-lg font-black text-rose-900 mt-0.5">
                      {selectedPatient.current.pulseRate ? `${selectedPatient.current.pulseRate} BPM` : '—'}
                    </div>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <div className="text-[11px] font-semibold text-slate-500">TOTAL DROPS</div>
                    <div className="text-lg font-bold text-slate-800 mt-0.5">
                      {selectedPatient.current.totalDrops.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Sub Tabs: Readings Table / Charts / Alerts / Events */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-200 px-4 pt-3 bg-slate-50">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveTab('READINGS')}
                      className={`px-3 py-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
                        activeTab === 'READINGS'
                          ? 'border-sky-600 text-sky-700'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <Table className="w-4 h-4" />
                      <span>Time-to-Time Readings ({selectedPatient.logs.length})</span>
                    </button>

                    <button
                      onClick={() => setActiveTab('CHARTS')}
                      className={`px-3 py-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
                        activeTab === 'CHARTS'
                          ? 'border-sky-600 text-sky-700'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <Activity className="w-4 h-4" />
                      <span>Graphs & Trends (Volume / Drip / Pulse)</span>
                    </button>

                    <button
                      onClick={() => setActiveTab('ALERTS')}
                      className={`px-3 py-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
                        activeTab === 'ALERTS'
                          ? 'border-sky-600 text-sky-700'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <AlertTriangle className="w-4 h-4 text-rose-500" />
                      <span>Alerts Log ({selectedPatient.alerts.length})</span>
                    </button>

                    <button
                      onClick={() => setActiveTab('EVENTS')}
                      className={`px-3 py-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
                        activeTab === 'EVENTS'
                          ? 'border-sky-600 text-sky-700'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4 text-teal-500" />
                      <span>Events ({selectedPatient.events.length})</span>
                    </button>
                  </div>
                </div>

                <div className="p-4">
                  {/* Tab 1: Time-to-Time Readings Table */}
                  {activeTab === 'READINGS' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <input
                          type="text"
                          placeholder="Filter readings by status or time..."
                          value={logSearchQuery}
                          onChange={(e) => setLogSearchQuery(e.target.value)}
                          className="px-3 py-1.5 border border-slate-300 rounded-xl text-xs w-64 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                        <span className="text-xs text-slate-400">
                          Showing {filteredLogs.length} recorded telemetry frames
                        </span>
                      </div>

                      <div className="overflow-x-auto rounded-xl border border-slate-200">
                        <table className="w-full text-xs text-left text-slate-700">
                          <thead className="bg-slate-100 text-slate-800 uppercase text-[10px] font-bold tracking-wider">
                            <tr>
                              <th className="py-2.5 px-3">Timestamp</th>
                              <th className="py-2.5 px-3">Weight (g)</th>
                              <th className="py-2.5 px-3">Volume</th>
                              <th className="py-2.5 px-3">Remaining</th>
                              <th className="py-2.5 px-3">Drip Rate</th>
                              <th className="py-2.5 px-3 text-rose-700">❤️ Pulse</th>
                              <th className="py-2.5 px-3">Pulse Status</th>
                              <th className="py-2.5 px-3">IV Status</th>
                              <th className="py-2.5 px-3">Sensor Link</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {filteredLogs.slice().reverse().map((log) => (
                              <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                                <td className="py-2 px-3 font-mono text-slate-600 whitespace-nowrap">
                                  {new Date(log.timestamp).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    second: '2-digit',
                                  })}
                                </td>
                                <td className="py-2 px-3 font-semibold">{log.weight} g</td>
                                <td className="py-2 px-3 font-bold text-sky-800">{log.volume} mL</td>
                                <td className="py-2 px-3 font-bold">
                                  <span
                                    className={`${
                                      log.remainingPercentage < 10
                                        ? 'text-rose-600'
                                        : log.remainingPercentage <= 20
                                        ? 'text-amber-600'
                                        : 'text-emerald-700'
                                    }`}
                                  >
                                    {Math.round(log.remainingPercentage)}%
                                  </span>
                                </td>
                                <td className="py-2 px-3">{log.dripRate} dpm</td>
                                <td className="py-2 px-3 font-bold text-rose-700">
                                  {log.pulseRate !== null && log.pulseRate !== undefined ? `${log.pulseRate} BPM` : '—'}
                                </td>
                                <td className="py-2 px-3">
                                  <PulseStatusBadge status={log.pulseStatus || (log.pulseRate ? 'NORMAL' : 'NO_PULSE_DATA')} size="sm" />
                                </td>
                                <td className="py-2 px-3">
                                  <StatusBadge status={log.status} size="sm" />
                                </td>
                                <td className="py-2 px-3">
                                  <span className="text-[10px] font-semibold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded">
                                    {log.esp32Status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Tab 2: Graphs */}
                  {activeTab === 'CHARTS' && (
                    <div className="space-y-6">
                      <PulseRateChart logs={selectedPatient.logs} />
                      <VolumeChart logs={selectedPatient.logs} initialVolume={selectedPatient.details.initialVolume} />
                      <DripRateChart logs={selectedPatient.logs} prescribedDripRate={selectedPatient.details.prescribedDripRate} />
                    </div>
                  )}

                  {/* Tab 3: Alerts Log */}
                  {activeTab === 'ALERTS' && (
                    <div className="space-y-3">
                      {selectedPatient.alerts.length === 0 ? (
                        <div className="text-center p-8 text-xs text-slate-400">
                          No alerts recorded during this session.
                        </div>
                      ) : (
                        selectedPatient.alerts.map((a) => (
                          <div
                            key={a.id}
                            className={`p-3.5 rounded-xl border text-xs ${
                              a.severity === 'CRITICAL'
                                ? 'bg-rose-50 border-rose-200 text-rose-900'
                                : 'bg-amber-50 border-amber-200 text-amber-900'
                            }`}
                          >
                            <div className="flex items-center justify-between font-bold">
                              <div className="flex items-center gap-2">
                                <SeverityBadge severity={a.severity} />
                                <span className="whitespace-pre-line">{a.message}</span>
                              </div>
                              <span className="text-[11px] text-slate-500 font-mono">
                                {new Date(a.timestamp).toLocaleString()}
                              </span>
                            </div>
                            <div className="mt-1 text-slate-700">
                              Suggested Action: <span className="font-semibold">{a.suggestedAction}</span>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
                              <span>Status: {a.acknowledged ? '✓ Acknowledged' : 'Pending Response'}</span>
                              {a.acknowledgedAt && (
                                <span>(at {new Date(a.acknowledgedAt).toLocaleTimeString()})</span>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Tab 4: Events Log */}
                  {activeTab === 'EVENTS' && (
                    <div className="space-y-2">
                      {selectedPatient.events.length === 0 ? (
                        <div className="text-center p-8 text-xs text-slate-400">
                          No milestone events recorded.
                        </div>
                      ) : (
                        selectedPatient.events.map((e) => (
                          <div
                            key={e.id}
                            className="p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-sky-500 shrink-0" />
                              <span className="font-medium text-slate-800">{e.message}</span>
                            </div>
                            <span className="text-slate-400 font-mono text-[11px]">
                              {new Date(e.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="lg:col-span-8 p-12 bg-white rounded-2xl border text-center text-slate-400 text-sm">
              Select a patient from the left directory to view full telemetry logs.
            </div>
          )}
        </div>
      </main>

      {/* Export Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        patients={patients}
        defaultSelectedPatientId={selectedPatient?.details.id}
      />
    </div>
  );
}
