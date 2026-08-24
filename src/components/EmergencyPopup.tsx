import React, { useState } from 'react';
import { Alert } from '../types';
import { StatusBadge, PulseStatusBadge } from './StatusBadge';
import { formatETA } from '../utils/calculations';
import {
  AlertTriangle,
  AlertCircle,
  Clock,
  Droplets,
  Activity,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Volume2,
  VolumeX,
  Heart,
} from 'lucide-react';

interface EmergencyPopupProps {
  alerts: Alert[];
  onAcknowledge: (alertId: string) => void;
  onStopMonitoring: (patientId: string, patientName: string, bedNo: string) => void;
  audioAlertsEnabled: boolean;
  onToggleAudio: () => void;
  onViewPatient?: (patientId: string) => void;
}

export function EmergencyPopup({
  alerts,
  onAcknowledge,
  onStopMonitoring,
  audioAlertsEnabled,
  onToggleAudio,
  onViewPatient,
}: EmergencyPopupProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);

  if (!alerts || alerts.length === 0) return null;

  // Ensure index stays in bounds if alerts are acknowledged
  const validIndex = Math.min(currentIndex, alerts.length - 1);
  const activeAlert = alerts[validIndex];

  if (!activeAlert) return null;

  const detectionTime = new Date(activeAlert.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const snapshot = activeAlert.readingsSnapshot;
  const isPulseAlert = activeAlert.category === 'PULSE' || activeAlert.type.includes('PULSE');

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-40 animate-bounce">
        <button
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-bold px-4 py-2.5 rounded-full shadow-lg border-2 border-white"
        >
          <AlertCircle className="w-5 h-5 animate-pulse" />
          <span>
            {alerts.length} Critical Alert{alerts.length > 1 ? 's' : ''} (Bed {activeAlert.bedNo})
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border-2 border-rose-500 overflow-hidden">
        {/* Urgent Header */}
        <div className={`px-5 py-3.5 text-white flex items-center justify-between ${isPulseAlert ? 'bg-gradient-to-r from-rose-700 via-rose-600 to-amber-700' : 'bg-gradient-to-r from-rose-600 to-red-700'}`}>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/20 rounded-lg animate-pulse">
              {isPulseAlert ? <Heart className="w-6 h-6 text-white fill-white" /> : <ShieldAlert className="w-6 h-6 text-white" />}
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider font-extrabold text-rose-100 flex items-center gap-2">
                <span>{isPulseAlert ? '❤️ PULSE EMERGENCY' : '🚨 IV EMERGENCY ALERT'}</span>
                {alerts.length > 1 && (
                  <span className="bg-rose-800/80 px-2 py-0.5 rounded text-[11px] font-bold">
                    {validIndex + 1} of {alerts.length}
                  </span>
                )}
              </div>
              <h2 className="text-base font-black tracking-tight leading-tight whitespace-pre-line">
                {activeAlert.message}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onToggleAudio}
              title={audioAlertsEnabled ? 'Mute Alert Sound' : 'Unmute Alert Sound'}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              {audioAlertsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setIsMinimized(true)}
              className="text-xs bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded text-rose-100 font-medium"
            >
              Minimize
            </button>
          </div>
        </div>

        {/* Multi-alert navigator if multiple */}
        {alerts.length > 1 && (
          <div className="bg-rose-50 px-4 py-2 border-b border-rose-100 flex items-center justify-between text-xs text-rose-800">
            <span className="font-semibold">
              Queue: {alerts.length} patients requiring immediate intervention
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                disabled={validIndex === 0}
                className="p-1 rounded bg-white hover:bg-rose-100 border border-rose-200 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-bold px-1.5">
                {validIndex + 1} / {alerts.length}
              </span>
              <button
                onClick={() => setCurrentIndex((prev) => Math.min(alerts.length - 1, prev + 1))}
                disabled={validIndex === alerts.length - 1}
                className="p-1 rounded bg-white hover:bg-rose-100 border border-rose-200 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Content Body */}
        <div className="p-5 space-y-4">
          {/* Patient identification banner */}
          <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-3">
            <div>
              <div className="text-xs text-slate-500 uppercase font-semibold">Patient Information</div>
              <div className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>{activeAlert.patientName}</span>
                <span className="text-xs font-semibold px-2 py-0.5 bg-slate-200 text-slate-700 rounded-md">
                  BED {activeAlert.bedNo}
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500">Detected At</div>
              <div className="text-sm font-semibold text-slate-700 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {detectionTime}
              </div>
            </div>
          </div>

          {/* Telemetry Snapshot Grid */}
          {snapshot && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
              <div className="bg-rose-50/70 border border-rose-100 rounded-lg p-2.5">
                <div className="text-[11px] font-semibold text-rose-600">REMAINING %</div>
                <div className="text-xl font-black text-rose-700">
                  {snapshot.remainingPercentage !== null && snapshot.remainingPercentage !== undefined
                    ? `${Math.round(snapshot.remainingPercentage)}%`
                    : '—'}
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                <div className="text-[11px] font-semibold text-slate-500">VOLUME</div>
                <div className="text-lg font-bold text-slate-800">
                  {snapshot.volume !== null && snapshot.volume !== undefined ? `${snapshot.volume} mL` : '—'}
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                <div className="text-[11px] font-semibold text-slate-500">DRIP RATE</div>
                <div className="text-lg font-bold text-slate-800">
                  {snapshot.dripRate !== null && snapshot.dripRate !== undefined ? `${snapshot.dripRate} dpm` : '—'}
                </div>
              </div>

              <div className="bg-rose-50/60 border border-rose-200 rounded-lg p-2.5">
                <div className="text-[11px] font-semibold text-rose-700 flex items-center justify-center gap-1">
                  <Heart className="w-3 h-3 text-rose-600 fill-rose-500" />
                  <span>PULSE</span>
                </div>
                <div className="text-lg font-black text-rose-900">
                  {snapshot.pulseRate !== null && snapshot.pulseRate !== undefined ? `${snapshot.pulseRate} BPM` : '—'}
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                <div className="text-[11px] font-semibold text-slate-500">ETA</div>
                <div className="text-lg font-bold text-slate-800">
                  {formatETA(snapshot.etaMinutes ?? null)}
                </div>
              </div>
            </div>
          )}

          {/* Suggested Clinical Action Box */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-bold text-amber-900 uppercase">Suggested Nursing Action</div>
              <div className="text-sm text-amber-800 mt-0.5">{activeAlert.suggestedAction}</div>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="bg-slate-50 px-5 py-3.5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          {onViewPatient && (
            <button
              onClick={() => {
                onViewPatient(activeAlert.patientId);
              }}
              className="text-xs font-semibold text-sky-700 hover:text-sky-900 underline underline-offset-2"
            >
              Open Full Patient Monitor →
            </button>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() =>
                onStopMonitoring(activeAlert.patientId, activeAlert.patientName, activeAlert.bedNo)
              }
              className="px-3.5 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 rounded-lg border border-rose-300 transition-colors"
            >
              Stop Monitoring
            </button>

            <button
              onClick={() => {
                onAcknowledge(activeAlert.id);
                if (validIndex >= alerts.length - 1 && validIndex > 0) {
                  setCurrentIndex(validIndex - 1);
                }
              }}
              className="px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
            >
              <span>Acknowledge</span>
              {alerts.length > 1 && (
                <span className="text-[10px] bg-slate-700 px-1.5 py-0.2 rounded font-normal">
                  Next ({alerts.length - 1})
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ActiveAlertBanner({
  alert,
  onAcknowledge,
  onViewPatient,
}: {
  alert: Alert;
  onAcknowledge: (id: string) => void;
  onViewPatient: (id: string) => void;
}) {
  const isCritical = alert.severity === 'CRITICAL';
  return (
    <div
      className={`rounded-xl border px-4 py-3 shadow-xs flex flex-wrap items-center justify-between gap-3 ${
        isCritical
          ? 'bg-rose-50 border-rose-300 text-rose-900'
          : 'bg-amber-50 border-amber-300 text-amber-900'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${isCritical ? 'bg-rose-200 text-rose-700 animate-pulse' : 'bg-amber-200 text-amber-700'}`}>
          {isCritical ? <ShieldAlert className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm tracking-tight uppercase">
              {isCritical ? '🚨 ACTIVE ALERT' : '⚠ WARNING'}
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 bg-white/80 rounded border border-slate-300">
              Bed {alert.bedNo} • {alert.patientName}
            </span>
          </div>
          <p className="text-xs font-medium text-slate-700 mt-0.5 whitespace-pre-line">{alert.message}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onViewPatient(alert.patientId)}
          className="text-xs font-semibold px-3 py-1.5 bg-white rounded-lg border border-slate-300 hover:bg-slate-100 transition-colors"
        >
          View Bed
        </button>
        <button
          onClick={() => onAcknowledge(alert.id)}
          className="text-xs font-bold px-3 py-1.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
        >
          Acknowledge
        </button>
      </div>
    </div>
  );
}
