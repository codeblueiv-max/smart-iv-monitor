import React from 'react';
import { useMonitoring } from '../context/MonitoringContext';
import { IVBottle } from '../components/IVBottle';
import { StatusBadge, PulseStatusBadge } from '../components/StatusBadge';
import { VolumeChart } from '../components/VolumeChart';
import { DripRateChart } from '../components/DripRateChart';
import { PulseRateChart } from '../components/PulseRateChart';
import { formatETA, getPulseStatusTheme } from '../utils/calculations';
import {
  ArrowLeft,
  Activity,
  Clock,
  Cpu,
  AlertTriangle,
  FlaskConical,
  Radio,
  StopCircle,
  Play,
  Database,
  Scale,
  Eye,
  Heart,
} from 'lucide-react';

interface PatientMonitoringPageProps {
  onBack: () => void;
  onOpenStopModal: (patientId: string, name: string, bed: string) => void;
}

export function PatientMonitoringPage({ onBack, onOpenStopModal }: PatientMonitoringPageProps) {
  const { patients, currentPatientId, startMonitoring } = useMonitoring();

  const patient = patients.find((p) => p?.details?.id === currentPatientId);

  if (!patient) {
    return (
      <div className="min-h-screen bg-slate-50 p-8 flex flex-col items-center justify-center text-center">
        <h2 className="text-xl font-bold text-slate-800">Patient Not Found</h2>
        <p className="text-sm text-slate-500 mt-2 mb-6">The requested patient record could not be loaded.</p>
        <button
          onClick={onBack}
          className="px-5 py-2 text-xs font-bold text-white bg-slate-900 rounded-xl"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  const { details, input, output, logs, alerts, events } = patient;
  const isStopped = details.monitoring === false || output?.ivStatus === 'MONITORING_STOPPED';

  const remainingVolume = isStopped ? (output?.remainingVolume ?? 0) : (output?.remainingVolume ?? 0);
  const remainingPercentage = isStopped
    ? (output?.remainingPercentage ?? 0)
    : Math.min(100, Math.max(0, output?.remainingPercentage ?? 0));
  const dripRate = isStopped ? 0 : (output?.dripRate ?? 0);
  const flowRate = isStopped ? 0 : (output?.flowRate ?? 0);
  const dropCount = isStopped ? (output?.dropCount ?? 0) : (output?.dropCount ?? 0);
  const eta = isStopped ? '--' : (output?.eta ?? '--');
  const heartRate = isStopped ? null : (output?.heartRate ?? null);
  const spo2 = isStopped ? null : (output?.spo2 ?? null);
  const esp32Status = isStopped ? 'DISCONNECTED' : (input?.esp32Status ?? 'DISCONNECTED');
  const lastUpdated = input?.lastUpdated ?? 0;

  const isNoData = !isStopped && (output?.ivStatus === 'NO_DATA' && remainingVolume === 0 && dripRate === 0 && !heartRate);

  const pct = remainingPercentage;

  const hasReceivedData = !isStopped && lastUpdated > 0;
  const secondsSinceUpdate = hasReceivedData
    ? Math.max(0, Math.floor((Date.now() - lastUpdated) / 1000))
    : null;

  const pulseStatus = isStopped
    ? 'STOPPED'
    : (output?.pulseStatus || (heartRate !== null && heartRate > 0 ? (heartRate >= 60 && heartRate <= 100 ? 'NORMAL' : 'ABNORMAL') : 'NO_PULSE_DATA'));
  const pulseSensorQuality: 'GOOD' | 'FAIR' | 'POOR' | 'NO_SIGNAL' = isStopped
    ? 'NO_SIGNAL'
    : (heartRate !== null && heartRate > 0 ? 'GOOD' : 'NO_SIGNAL');
  const pulseTheme = getPulseStatusTheme(pulseStatus);

  const durationMin = Math.round(((details.stopTime || Date.now()) - details.startTime) / 60000);
  const durHours = Math.floor(durationMin / 60);
  const durMins = durationMin % 60;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-12">
      {/* Top Sticky Header */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors flex items-center gap-1 text-xs font-bold"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 text-xs font-black bg-sky-500 text-white rounded-md">
                  BED {details.bedNo}
                </span>
                <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  {details.patientName}
                </h1>
                <StatusBadge status={isStopped ? 'MONITORING_STOPPED' : (output?.ivStatus || 'NORMAL')} size="sm" />
                <PulseStatusBadge status={pulseStatus} size="sm" />
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {details.fluidType} • Initial {details.initialVolume} mL • {isStopped ? 'Infusion Stopped' : `Started ${durHours}h ${durMins}m ago`}
              </p>
            </div>
          </div>

          {/* Real-time Link Telemetry Status */}
          <div className="flex items-center gap-3 text-xs flex-wrap">
            <div className="hidden sm:flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
              <Radio className={`w-3.5 h-3.5 ${!isStopped && esp32Status === 'CONNECTED' ? 'text-emerald-400 animate-pulse' : 'text-slate-400'}`} />
              <span className="text-slate-300">ESP32:</span>
              <span className={`font-bold ${isStopped ? 'text-slate-400' : esp32Status === 'CONNECTED' ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isStopped ? '⚪ INACTIVE (STOPPED)' : esp32Status === 'CONNECTED' ? '🟢 ONLINE' : '🔴 OFFLINE'}
              </span>
              <span className="text-slate-500">|</span>
              <span className="text-slate-400">
                {isStopped
                  ? 'Monitoring halted'
                  : secondsSinceUpdate !== null
                  ? `Updated ${secondsSinceUpdate < 2 ? 'just now' : `${secondsSinceUpdate}s ago`}`
                  : 'No telemetry received'}
              </span>
            </div>

            {isStopped ? (
              <button
                onClick={() => startMonitoring(details.id)}
                className="px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Resume Monitoring</span>
              </button>
            ) : (
              <button
                onClick={() => onOpenStopModal(details.id, details.patientName, details.bedNo)}
                className="px-3 py-1.5 text-xs font-bold text-rose-300 hover:text-white bg-rose-950/60 hover:bg-rose-900 border border-rose-800 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <StopCircle className="w-3.5 h-3.5" />
                <span>Stop Infusion</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Monitoring Body */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6 flex-1">
        {/* Monitoring Stopped Notification Banner */}
        {isStopped && (
          <div className="p-4 rounded-2xl border bg-slate-100 border-slate-300 text-slate-800 flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-slate-200 text-slate-700">
                <StopCircle className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Monitoring Stopped
                </div>
                <div className="text-sm font-bold text-slate-900">
                  Infusion monitoring for this bed is inactive. Live telemetry and diagnostic alerts are paused.
                </div>
                {details.stopTime && (
                  <div className="text-xs text-slate-500 mt-0.5">
                    Monitoring stopped at {new Date(details.stopTime).toLocaleTimeString()}
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => startMonitoring(details.id)}
              className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Play className="w-4 h-4" />
              <span>Resume Monitoring</span>
            </button>
          </div>
        )}

        {/* Predictive Empty-Time Advice Banner (Only for actively monitored patients) */}
        {!isStopped && eta !== '--' && remainingVolume > 0 && (
          <div
            className={`p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-3 shadow-xs ${
              pct < 10
                ? 'bg-rose-50 border-rose-300 text-rose-900'
                : pct <= 20
                ? 'bg-amber-50 border-amber-300 text-amber-900'
                : 'bg-sky-50 border-sky-200 text-sky-900'
            }`}
          >
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 shrink-0" />
              <div>
                <div className="text-xs font-bold uppercase tracking-wider">Predictive Empty-Time Analysis</div>
                <div className="text-sm font-semibold">
                  Estimated time until bag depletion:{' '}
                  <span className="font-black text-base">{eta}</span> (HH:MM)
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-bold px-3 py-1 rounded-full uppercase ${
                  pct < 10
                    ? 'bg-rose-600 text-white animate-pulse'
                    : pct <= 20
                    ? 'bg-amber-500 text-white'
                    : 'bg-sky-600 text-white'
                }`}
              >
                {pct < 10 ? '🚨 Replace Bag Now' : pct <= 20 ? '🟠 Prepare Replacement' : '🟢 Infusion Stable'}
              </span>
            </div>
          </div>
        )}

        {/* Pulse Alert Banner if Pulse is LOW or HIGH (Only for actively monitored patients) */}
        {!isStopped && (pulseStatus === 'LOW_PULSE' || pulseStatus === 'HIGH_PULSE') && heartRate !== null && (
          <div className="p-3.5 rounded-xl border bg-amber-50 border-amber-300 text-amber-900 flex flex-wrap items-center justify-between gap-3 shadow-xs animate-pulse">
            <div className="flex items-center gap-3">
              <Heart className="w-5 h-5 shrink-0 text-amber-600 fill-amber-500" />
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-amber-800">
                  ⚠️ Pulse Diagnostic Alert ({pulseStatus.replace('_', ' ')})
                </div>
                <div className="text-sm font-semibold text-amber-950">
                  Patient pulse rate is <span className="font-black text-base">{heartRate} BPM</span> ({pulseStatus === 'LOW_PULSE' ? '< 60 BPM Bradycardia risk' : '> 100 BPM Tachycardia risk'}).
                </div>
              </div>
            </div>
            <PulseStatusBadge status={pulseStatus} size="md" />
          </div>
        )}

        {/* Top Interactive Visualization & Metrics Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Animated IV Bottle (5 Cols) */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col items-center justify-between">
            <div className="w-full flex items-center justify-between border-b border-slate-100 pb-3 mb-2">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <FlaskConical className="w-4 h-4 text-sky-600" />
                IV Container Dynamics
              </span>
              <span className="text-xs text-slate-400">HX711 Load Cell</span>
            </div>

            {/* IV Bottle Component */}
            <div className="py-2">
              <IVBottle
                remainingPercentage={pct}
                currentVolume={remainingVolume}
                initialVolume={details.initialVolume}
                dripRate={dripRate}
                status={output?.ivStatus || 'NORMAL'}
                size="lg"
              />
            </div>

            {/* Prescribed vs Actual Rate Bar */}
            <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 mt-4 space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Prescribed Rate:</span>
                <span className="font-bold text-slate-800">{details.prescribedDripRate} dpm</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Actual IR Drip Rate:</span>
                <span
                  className={`font-bold ${
                    dripRate === 0
                      ? 'text-slate-500'
                      : Math.abs(dripRate - details.prescribedDripRate) > 10
                      ? 'text-amber-600'
                      : 'text-emerald-700'
                  }`}
                >
                  {dripRate > 0 ? `${dripRate} dpm` : '0 dpm'}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Drop Factor:</span>
                <span className="font-semibold text-slate-700">{details.dropFactor} drops/mL</span>
              </div>
            </div>
          </div>

          {/* Right Column: Telemetry Cards (IV + Pulse) & Hardware Info (7 Cols) */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            {/* IV Telemetry Grid (6 Metrics: Volume, Remaining %, Drip Rate, Flow Rate, Total Drops, ETA) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {/* Metric 1: IV Volume */}
              <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">IV VOLUME</div>
                <div className="text-2xl font-black text-slate-900 mt-1">
                  {remainingVolume > 0 && remainingVolume < 10
                    ? `${remainingVolume.toFixed(1)} mL`
                    : `${Math.round(remainingVolume)} mL`}
                </div>
                <div className="text-[11px] text-slate-500">of {details.initialVolume} mL</div>
              </div>

              {/* Metric 2: Remaining % */}
              <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">REMAINING</div>
                <div
                  className={`text-2xl font-black mt-1 ${
                    pct < 10
                      ? 'text-rose-600'
                      : pct <= 20
                      ? 'text-amber-600'
                      : 'text-emerald-600'
                  }`}
                >
                  {Math.round(pct)}%
                </div>
                <div className="text-[11px] text-slate-500">Fluid level</div>
              </div>

              {/* Metric 3: Drip Rate */}
              <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">DRIP RATE</div>
                <div className="text-2xl font-black text-sky-700 mt-1">
                  {dripRate > 0 ? `${dripRate} dpm` : '0 dpm'}
                </div>
                <div className="text-[11px] text-slate-500">drops/min (dpm)</div>
              </div>

              {/* Metric 4: Flow Rate */}
              <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">FLOW RATE</div>
                <div className="text-2xl font-black text-teal-700 mt-1">
                  {flowRate > 0 ? `${flowRate} mL/h` : '--'}
                </div>
                <div className="text-[11px] text-slate-500">mL/hour</div>
              </div>

              {/* Metric 5: Total Drops */}
              <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">TOTAL DROPS</div>
                <div className="text-xl font-bold text-slate-800 mt-1">
                  {(dropCount || 0).toLocaleString()}
                </div>
                <div className="text-[11px] text-slate-500">IR Pulse Count</div>
              </div>

              {/* Metric 6: ETA */}
              <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">ETA</div>
                <div className="text-xl font-bold text-slate-800 mt-1">
                  {eta || '--'}
                </div>
                <div className="text-[11px] text-slate-500">HH:MM format</div>
              </div>
            </div>

            {/* PULSE OXIMETER & VITALS CARD (Positioned directly below IV metrics) */}
            <div className="bg-linear-to-br from-white to-rose-50/40 border-2 border-rose-200/80 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-rose-100 pb-2 mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-rose-500 text-white flex items-center justify-center shadow-xs">
                    <Heart className={`w-4 h-4 fill-white ${heartRate ? 'animate-ping' : ''}`} style={{ animationDuration: heartRate ? `${Math.max(0.4, 60 / heartRate)}s` : '1s' }} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <span>❤️ Pulse Rate & Vitals</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 uppercase">
                        ESP32 Live
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-500">Real-time pulse sensor monitoring (/patients/{details.id}/output/heartRate)</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <PulseStatusBadge status={pulseStatus} size="sm" />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-center">
                {/* BPM Value */}
                <div className="p-3 bg-white border border-rose-200/60 rounded-xl">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">HEART RATE</div>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-3xl font-black text-slate-900 tracking-tight">
                      {heartRate !== null && heartRate > 0 ? Math.round(heartRate) : '—'}
                    </span>
                    <span className="text-xs font-bold text-rose-600 uppercase">BPM</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">Normal: 60–100 BPM</div>
                </div>

                {/* Status Evaluation */}
                <div className="p-3 bg-white border border-rose-200/60 rounded-xl">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">PULSE STATUS</div>
                  <div className="mt-1">
                    <PulseStatusBadge status={pulseStatus} size="sm" />
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1.5 line-clamp-1">
                    {pulseStatus === 'NORMAL' && 'Normal rhythm'}
                    {pulseStatus === 'LOW_PULSE' && '<60 BPM (Bradycardia)'}
                    {pulseStatus === 'HIGH_PULSE' && '>100 BPM (Tachycardia)'}
                    {pulseStatus === 'NO_PULSE_DATA' && 'No finger pulse contact'}
                  </div>
                </div>

                {/* SpO2 Blood Oxygen Saturation */}
                <div className="p-3 bg-white border border-sky-200/60 rounded-xl">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">SpO₂ OXYGEN</div>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-3xl font-black text-slate-900 tracking-tight">
                      {spo2 !== null && spo2 > 0 ? `${spo2}%` : '—'}
                    </span>
                    <span className="text-xs font-bold text-sky-600 uppercase">SpO₂</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    {spo2 !== null ? (spo2 >= 95 ? 'Normal (≥95%)' : 'Low oxygen (<95%)') : 'Target: ≥95%'}
                  </div>
                </div>

                {/* Sensor Quality & Signal */}
                <div className="p-3 bg-white border border-rose-200/60 rounded-xl">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">PULSE SIGNAL</div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span
                      className={`inline-flex items-center text-xs font-black px-2 py-0.5 rounded ${
                        pulseSensorQuality === 'GOOD'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {pulseSensorQuality}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1.5">
                    {heartRate !== null ? 'Optical signal detected' : 'No optical signal'}
                  </div>
                </div>
              </div>
            </div>

            {/* Hardware & Calibration Diagnostic Box */}
            <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <Cpu className="w-4 h-4 text-sky-600" />
                  <span>Hardware & Sensor Parameters</span>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">
                  Bed {details.bedNo} / {details.id}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex items-center gap-1.5 text-slate-600 font-medium mb-1">
                    <Scale className="w-3.5 h-3.5 text-sky-600" />
                    <span>HX711 Load Cell</span>
                  </div>
                  <div className="text-slate-900 font-bold">
                    {typeof input?.loadCell === 'number'
                      ? `${input.loadCell} g`
                      : input?.loadCell?.weight !== undefined
                      ? `${input.loadCell.weight} g`
                      : 'NO DATA'}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Tare: {details.tareWeight || 30}g | Calib: {details.calibrationFactor || 1.0}
                  </div>
                </div>

                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex items-center gap-1.5 text-slate-600 font-medium mb-1">
                    <Eye className="w-3.5 h-3.5 text-teal-600" />
                    <span>IR Drop Sensor</span>
                  </div>
                  <div className="text-slate-900 font-bold">
                    {dripRate > 0 ? `${dripRate} dpm` : '0 dpm'}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Count: {dropCount} drops | Total: {dropCount}
                  </div>
                </div>

                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex items-center gap-1.5 text-slate-600 font-medium mb-1">
                    <Database className="w-3.5 h-3.5 text-emerald-600" />
                    <span>ESP32 & Firebase</span>
                  </div>
                  <div className="text-slate-900 font-bold flex items-center gap-1.5">
                    <span>ESP32:</span>
                    <span className={esp32Status === 'CONNECTED' ? 'text-emerald-700' : 'text-slate-500'}>
                      {esp32Status === 'CONNECTED' ? 'CONNECTED' : 'DISCONNECTED'}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 truncate" title={`patients/${details.id}/input → output`}>
                    In: <code className="text-indigo-600 font-mono">/input</code> • Out: <code className="text-emerald-600 font-mono">/output</code>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Telemetry Charts: Volume, Drip Rate, and Pulse Rate */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <VolumeChart logs={logs} initialVolume={details.initialVolume} />
          <DripRateChart logs={logs} prescribedDripRate={details.prescribedDripRate} />
          <PulseRateChart logs={logs} />
        </div>

        {/* Recent Events & Diagnostic Alerts Feed */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Alerts Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
            <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>Diagnostic Alerts & Warnings ({alerts.length})</span>
            </h4>
            {alerts.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-lg">
                No active or historical alerts for this patient.
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {alerts.map((a) => (
                  <div
                    key={a.id}
                    className={`p-3 rounded-lg border text-xs ${
                      a.severity === 'CRITICAL'
                        ? 'bg-rose-50 border-rose-200 text-rose-900'
                        : 'bg-amber-50 border-amber-200 text-amber-900'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span className="whitespace-pre-line">{a.message}</span>
                      <span className="text-[10px] text-slate-500 font-normal">
                        {new Date(a.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="text-[11px] mt-1 text-slate-600">
                      Action: <span className="font-medium text-slate-800">{a.suggestedAction}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Events Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
            <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-sky-600" />
              <span>Infusion Milestones & Events ({events.length})</span>
            </h4>
            {events.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-lg">
                No events recorded.
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {events.map((e) => (
                  <div
                    key={e.id}
                    className="p-2.5 rounded-lg border border-slate-100 bg-slate-50 text-xs text-slate-700 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-sky-500 shrink-0" />
                      <span>{e.message}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0 ml-2">
                      {new Date(e.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
