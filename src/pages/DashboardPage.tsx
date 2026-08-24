import React, { useState } from 'react';
import { useMonitoring } from '../context/MonitoringContext';
import { ConnectionStatus } from '../components/ConnectionStatus';
import { PatientCard } from '../components/PatientCard';
import { ActiveAlertBanner } from '../components/EmergencyPopup';
import {
  Activity,
  Plus,
  Search,
  FileText,
  HelpCircle,
  Sliders,
  Settings,
  Volume2,
  VolumeX,
  Droplet,
  Users,
} from 'lucide-react';
import { STATUS_PRIORITIES } from '../utils/calculations';

interface DashboardPageProps {
  onOpenAddPatient: () => void;
  onOpenSettings: () => void;
}

export function DashboardPage({ onOpenAddPatient, onOpenSettings }: DashboardPageProps) {
  const {
    activePatients,
    systemStatus,
    activeAlerts,
    selectPatient,
    setCurrentView,
    audioAlertsEnabled,
    toggleAudioAlerts,
    acknowledgeAlert,
  } = useMonitoring();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'CRITICAL' | 'WARNING' | 'NORMAL'>('ALL');

  // Sorted by lowest remaining IV percentage first so urgent beds appear immediately
  const sortedAndFilteredPatients = activePatients
    .filter((patient) => {
      if (!patient || !patient.details) return false;
      const q = searchQuery.toLowerCase().trim();
      const name = String(patient.details.patientName || '').toLowerCase();
      const bed = String(patient.details.bedNo || '').toLowerCase();
      const fluid = String(patient.details.fluidType || '').toLowerCase();
      const matchesSearch = !q || name.includes(q) || bed.includes(q) || fluid.includes(q);

      if (!matchesSearch) return false;

      const pct = patient.current?.remainingPercent ?? patient.current?.remainingPercentage ?? null;
      if (statusFilter === 'CRITICAL') {
        return (
          (pct !== null && pct < 10) ||
          patient.current?.status === 'CRITICAL_VOLUME' ||
          (STATUS_PRIORITIES[patient.current?.status] || 99) <= 5
        );
      }
      if (statusFilter === 'WARNING') {
        return (
          (pct !== null && pct >= 10 && pct <= 20) ||
          patient.current?.status === 'LOW_VOLUME' ||
          patient.current?.status === 'ESP32_DISCONNECTED'
        );
      }
      if (statusFilter === 'NORMAL') {
        return pct !== null && pct > 20 && patient.current?.status === 'NORMAL';
      }
      return true;
    })
    .sort((a, b) => {
      const pctA = a?.current?.remainingPercent ?? a?.current?.remainingPercentage ?? null;
      const pctB = b?.current?.remainingPercent ?? b?.current?.remainingPercentage ?? null;

      // Put patients with active numeric readings sorted lowest % first
      if (pctA !== null && pctB !== null) {
        if (pctA !== pctB) return pctA - pctB;
      } else if (pctA !== null && pctB === null) {
        return -1;
      } else if (pctA === null && pctB !== null) {
        return 1;
      }

      // Secondary: Priority score
      const priorityA = STATUS_PRIORITIES[a?.current?.status || 'NORMAL'] || 99;
      const priorityB = STATUS_PRIORITIES[b?.current?.status || 'NORMAL'] || 99;
      return priorityA - priorityB;
    });

  const unacknowledgedTopAlert = activeAlerts[0];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Header */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          {/* Logo and App Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-teal-400 flex items-center justify-center shadow-md">
              <Droplet className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black tracking-tight text-white">SMART IV MONITOR</h1>
                <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">
                  DASHBOARD
                </span>
              </div>
              <p className="text-xs text-slate-400">Real-Time IV Infusion Monitoring</p>
            </div>
          </div>

          {/* Header Action Nav */}
          <div className="flex items-center flex-wrap gap-2">
            {/* Audio Toggle */}
            <button
              onClick={toggleAudioAlerts}
              title={audioAlertsEnabled ? 'Audio Alerts Enabled' : 'Audio Alerts Muted'}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
            >
              {audioAlertsEnabled ? (
                <Volume2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <VolumeX className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {/* Patient Logs */}
            <button
              onClick={() => setCurrentView('LOGS')}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors"
            >
              <FileText className="w-4 h-4 text-sky-400" />
              <span>Patient Logs</span>
            </button>

            {/* Calibration */}
            <button
              onClick={() => setCurrentView('CALIBRATION')}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors"
            >
              <Sliders className="w-4 h-4 text-teal-400" />
              <span>Calibration</span>
            </button>

            {/* Setup / Info */}
            <button
              onClick={() => setCurrentView('SETUP')}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors"
            >
              <HelpCircle className="w-4 h-4 text-slate-400" />
              <span>Setup Guide</span>
            </button>

            {/* Settings */}
            <button
              onClick={onOpenSettings}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
              title="System Config"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 flex-1 space-y-6">
        {/* System Connection Bar */}
        <ConnectionStatus
          esp32Status={systemStatus.esp32Network}
          firebaseStatus={systemStatus.firebase}
          lastSyncTimestamp={systemStatus.lastSyncTimestamp}
          missingKeys={systemStatus.missingEnvKeys}
          isFirebaseConfigValid={systemStatus.isFirebaseConfigValid}
          onOpenSettings={onOpenSettings}
        />

        {/* Active Emergency Alert Banner if any alert is active */}
        {unacknowledgedTopAlert && (
          <ActiveAlertBanner
            alert={unacknowledgedTopAlert}
            onAcknowledge={acknowledgeAlert}
            onViewPatient={selectPatient}
          />
        )}

        {/* Action Controls & Search Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Activity className="w-5 h-5 text-sky-600" />
              <span>Active Bed Monitoring</span>
              <span className="text-xs font-bold px-2 py-0.5 bg-slate-200 text-slate-700 rounded-full">
                {activePatients.length} Active
              </span>
            </h2>
            <p className="text-xs text-slate-500">
              Sorted by urgency: Lowest remaining IV volume shown first
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-60">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search bed, patient..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            {/* Status Filter Chips */}
            <div className="flex items-center bg-slate-200/80 p-1 rounded-xl text-xs font-semibold text-slate-600">
              {(['ALL', 'CRITICAL', 'WARNING', 'NORMAL'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setStatusFilter(filter)}
                  className={`px-2.5 py-1 rounded-lg transition-colors ${
                    statusFilter === filter
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'hover:text-slate-900'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Patient Cards Grid */}
        {sortedAndFilteredPatients.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-xs">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-700">
              {activePatients.length === 0 ? 'No Patients Monitored' : 'No Patients Matching Filter'}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-5">
              {activePatients.length === 0
                ? 'Register an active hospital bed and IV patient below. Telemetry from the ESP32 will synchronize in real time.'
                : 'No beds currently active under this filter.'}
            </p>
            <button
              onClick={onOpenAddPatient}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-xl shadow-md transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Patient</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sortedAndFilteredPatients.map((patient) => (
              <PatientCard
                key={patient.details.id}
                patient={patient}
                onSelect={selectPatient}
              />
            ))}
          </div>
        )}
      </main>

      {/* Floating Circular "+" Button */}
      <div className="fixed bottom-6 right-6 z-30">
        <button
          onClick={onOpenAddPatient}
          aria-label="Add Patient"
          className="w-14 h-14 rounded-full bg-gradient-to-tr from-sky-600 to-teal-500 text-white shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center ring-4 ring-white"
        >
          <Plus className="w-7 h-7" />
        </button>
      </div>

      {/* Footer Disclaimer */}
      <footer className="bg-white border-t border-slate-200 py-3 text-center text-slate-500 text-[11px]">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between gap-2">
          <span>Smart IV Infusion Monitoring System • IoT & Embedded Realtime Dashboard</span>
          <span className="text-slate-400">
            For academic and demonstration purposes only. Not a certified clinical medical device.
          </span>
        </div>
      </footer>
    </div>
  );
}
