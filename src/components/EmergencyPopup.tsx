import React, { useState } from 'react';
import { Alert } from '../types';
import { formatETA } from '../utils/calculations';
import {
  AlertTriangle,
  AlertCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Volume2,
  VolumeX,
  Heart,
  Bell,
  X,
  ExternalLink,
  Minimize2,
  Maximize2,
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
  const isCritical = activeAlert.severity === 'CRITICAL';

  // Minimized Compact Floating Alert Badge
  if (isMinimized) {
    return (
      <div className="fixed top-4 right-4 sm:top-6 sm:right-6 z-50 animate-in fade-in slide-in-from-top-4 duration-200">
        <button
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold px-4 py-2.5 rounded-2xl shadow-xl border-2 border-white/90 transition-all hover:scale-105"
        >
          <Bell className="w-5 h-5 animate-bounce text-amber-200" />
          <div className="text-left leading-tight">
            <div className="text-[10px] uppercase font-black text-rose-200 tracking-wider">
              {alerts.length} Active Notification{alerts.length > 1 ? 's' : ''}
            </div>
            <div className="text-xs font-bold text-white">
              Bed {activeAlert.bedNo} - {activeAlert.patientName}
            </div>
          </div>
          <Maximize2 className="w-4 h-4 ml-1 opacity-80" />
        </button>
      </div>
    );
  }

  // Top-Right Notification Panel Alert Section (Non-disruptive floating toast)
  return (
    <div className="fixed top-4 right-4 sm:top-6 sm:right-6 z-50 max-w-md w-full pointer-events-none animate-in slide-in-from-top-5 fade-in duration-200">
      <div className="pointer-events-auto bg-white rounded-2xl shadow-2xl border-2 border-rose-500 overflow-hidden ring-4 ring-rose-500/10">
        {/* Notification Header */}
        <div
          className={`px-4 py-3 text-white flex items-center justify-between ${
            isPulseAlert
              ? 'bg-gradient-to-r from-rose-700 via-rose-600 to-amber-700'
              : isCritical
              ? 'bg-gradient-to-r from-rose-600 to-red-700'
              : 'bg-gradient-to-r from-amber-600 to-rose-600'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 bg-white/20 rounded-lg shrink-0 animate-pulse">
              {isPulseAlert ? (
                <Heart className="w-5 h-5 text-white fill-white" />
              ) : (
                <ShieldAlert className="w-5 h-5 text-white" />
              )}
            </div>
            <div className="truncate">
              <div className="text-[10px] uppercase tracking-wider font-extrabold text-rose-100 flex items-center gap-1.5">
                <Bell className="w-3 h-3 text-amber-200 inline" />
                <span>NOTIFICATION ALERT</span>
                {alerts.length > 1 && (
                  <span className="bg-white/20 px-1.5 py-0.2 rounded text-[10px] font-bold">
                    {validIndex + 1} of {alerts.length}
                  </span>
                )}
              </div>
              <h3 className="text-sm font-black tracking-tight leading-tight truncate text-white">
                {activeAlert.message}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            <button
              onClick={onToggleAudio}
              title={audioAlertsEnabled ? 'Mute Alert Audio' : 'Unmute Alert Audio'}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              {audioAlertsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setIsMinimized(true)}
              title="Minimize Notification"
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsMinimized(true)}
              title="Dismiss to Badge"
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Multi-notification Queue Selector Bar */}
        {alerts.length > 1 && (
          <div className="bg-rose-50 px-3.5 py-1.5 border-b border-rose-100 flex items-center justify-between text-xs text-rose-800">
            <span className="font-semibold text-[11px] truncate">
              Notification Queue ({alerts.length} active alerts)
            </span>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                disabled={validIndex === 0}
                className="p-1 rounded bg-white hover:bg-rose-100 border border-rose-200 disabled:opacity-40"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="font-bold px-1 text-[11px]">
                {validIndex + 1}/{alerts.length}
              </span>
              <button
                onClick={() => setCurrentIndex((prev) => Math.min(alerts.length - 1, prev + 1))}
                disabled={validIndex === alerts.length - 1}
                className="p-1 rounded bg-white hover:bg-rose-100 border border-rose-200 disabled:opacity-40"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Notification Body */}
        <div className="p-3.5 space-y-3">
          {/* Patient Details & Detection Time Header */}
          <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
            <div className="min-w-0">
              <div className="text-[10px] text-slate-500 uppercase font-extrabold tracking-wider">
                Patient & Bed
              </div>
              <div className="text-sm font-bold text-slate-900 truncate flex items-center gap-2">
                <span>{activeAlert.patientName}</span>
                <span className="text-[11px] font-bold px-1.5 py-0.2 bg-slate-200 text-slate-800 rounded">
                  BED {activeAlert.bedNo}
                </span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[10px] text-slate-500 font-medium">Detected At</div>
              <div className="text-xs font-semibold text-slate-700 flex items-center justify-end gap-1">
                <Clock className="w-3 h-3 text-slate-400" />
                {detectionTime}
              </div>
            </div>
          </div>

          {/* Telemetry Snapshot Pill Grid */}
          {snapshot && (
            <div className="grid grid-cols-4 gap-1.5 text-center">
              <div className="bg-rose-50/80 border border-rose-100 rounded-lg p-1.5">
                <div className="text-[9px] font-bold text-rose-600 uppercase">REM %</div>
                <div className="text-base font-black text-rose-700">
                  {snapshot.remainingPercentage !== null && snapshot.remainingPercentage !== undefined
                    ? `${Math.round(snapshot.remainingPercentage)}%`
                    : '—'}
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-1.5">
                <div className="text-[9px] font-bold text-slate-500 uppercase">VOLUME</div>
                <div className="text-xs font-bold text-slate-800 mt-0.5">
                  {snapshot.volume !== null && snapshot.volume !== undefined ? `${snapshot.volume} mL` : '—'}
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-1.5">
                <div className="text-[9px] font-bold text-slate-500 uppercase">DRIP RATE</div>
                <div className="text-xs font-bold text-slate-800 mt-0.5">
                  {snapshot.dripRate !== null && snapshot.dripRate !== undefined ? `${snapshot.dripRate} dpm` : '—'}
                </div>
              </div>

              <div className="bg-rose-50/70 border border-rose-200 rounded-lg p-1.5">
                <div className="text-[9px] font-bold text-rose-700 uppercase flex items-center justify-center gap-0.5">
                  <Heart className="w-2.5 h-2.5 text-rose-600 fill-rose-500" />
                  <span>PULSE</span>
                </div>
                <div className="text-xs font-black text-rose-900 mt-0.5">
                  {snapshot.pulseRate !== null && snapshot.pulseRate !== undefined ? `${snapshot.pulseRate} BPM` : '—'}
                </div>
              </div>
            </div>
          )}

          {/* Suggested Nursing Action */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs leading-tight">
              <span className="font-bold text-amber-900">Suggested Action: </span>
              <span className="text-amber-800 font-medium">{activeAlert.suggestedAction}</span>
            </div>
          </div>
        </div>

        {/* Notification Action Buttons */}
        <div className="bg-slate-50 px-3.5 py-2.5 border-t border-slate-200 flex items-center justify-between gap-2">
          {onViewPatient ? (
            <button
              onClick={() => onViewPatient(activeAlert.patientId)}
              className="text-xs font-bold text-sky-700 hover:text-sky-900 flex items-center gap-1 transition-colors"
            >
              <span>View Bed</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                onStopMonitoring(activeAlert.patientId, activeAlert.patientName, activeAlert.bedNo)
              }
              className="px-2.5 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 rounded-lg border border-rose-200 transition-colors"
            >
              Stop
            </button>

            <button
              onClick={() => {
                onAcknowledge(activeAlert.id);
                if (validIndex >= alerts.length - 1 && validIndex > 0) {
                  setCurrentIndex(validIndex - 1);
                }
              }}
              className="px-4 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
            >
              <span>Acknowledge</span>
              {alerts.length > 1 && (
                <span className="text-[10px] bg-slate-700 px-1 py-0.2 rounded font-normal">
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
        <div
          className={`p-2 rounded-lg ${
            isCritical ? 'bg-rose-200 text-rose-700 animate-pulse' : 'bg-amber-200 text-amber-700'
          }`}
        >
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

