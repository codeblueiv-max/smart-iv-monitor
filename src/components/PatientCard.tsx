import React from 'react';
import { Patient } from '../types';
import { StatusBadge, PulseStatusBadge } from './StatusBadge';
import { Droplets, Clock, Heart, ChevronRight, Cpu, Wind, Hash } from 'lucide-react';

interface PatientCardProps {
  key?: React.Key;
  patient: Patient;
  onSelect: (id: string) => void;
}

function PatientCardComponent({ patient, onSelect }: PatientCardProps) {
  const details = patient?.details || {
    id: '',
    bedNo: '—',
    patientName: 'Patient',
    fluidType: 'Normal Saline',
    initialVolume: 500,
    prescribedDripRate: 30,
    dropFactor: 20,
    startTime: Date.now(),
    monitoring: true,
  };

  const output = patient?.output || {
    remainingVolume: 0,
    remainingPercentage: 0,
    dripRate: 0,
    flowRate: 0,
    dropCount: 0,
    eta: '--',
    heartRate: null,
    spo2: null,
    ivStatus: 'NO_DATA',
    pulseStatus: 'NO_PULSE_DATA',
  };

  const input = patient?.input || {
    esp32Status: 'DISCONNECTED',
    lastUpdated: 0,
    loadCell: { rawValue: 0, weight: 0 },
    irSensor: { dropCount: 0, lastDropTimestamp: 0, sensorStatus: 'NO_SIGNAL' },
    pulseSensor: null,
  };

  const isStopped = details.monitoring === false || output.ivStatus === 'MONITORING_STOPPED';

  const remainingVolume = isStopped ? (output.remainingVolume || 0) : output.remainingVolume;
  const remainingPercentage = isStopped ? (output.remainingPercentage || 0) : Math.min(100, Math.max(0, output.remainingPercentage));
  const dripRate = isStopped ? 0 : output.dripRate;
  const flowRate = isStopped ? 0 : output.flowRate;
  const dropCount = isStopped ? (output.dropCount || 0) : output.dropCount;
  const eta = isStopped ? '--' : (output.eta || '--');
  const heartRate = isStopped ? null : output.heartRate;
  const spo2 = isStopped ? null : output.spo2;
  const esp32Status = isStopped ? 'DISCONNECTED' : input.esp32Status;

  const isNoData = !isStopped && (output.ivStatus === 'NO_DATA' && remainingVolume === 0 && dripRate === 0 && !heartRate);

  const pulseStatus = isStopped
    ? 'STOPPED'
    : (output.pulseStatus || (heartRate !== null && heartRate > 0 ? (heartRate >= 60 && heartRate <= 100 ? 'NORMAL' : 'ABNORMAL') : 'NO_PULSE_DATA'));

  // Determine card border & progress color
  let borderColor = 'border-slate-200 hover:border-slate-300';
  let progressBg = 'bg-emerald-500';
  let pctTextColor = 'text-emerald-700';

  if (isStopped) {
    borderColor = 'border-slate-200 hover:border-slate-300 bg-slate-50/60';
    progressBg = 'bg-slate-300';
    pctTextColor = 'text-slate-500';
  } else if (isNoData) {
    borderColor = 'border-slate-200 hover:border-slate-300 bg-slate-50/40';
    progressBg = 'bg-slate-300';
    pctTextColor = 'text-slate-400';
  } else if (remainingPercentage < 10 || output.ivStatus === 'CRITICAL_VOLUME') {
    borderColor = 'border-rose-300 hover:border-rose-400 bg-rose-50/20';
    progressBg = 'bg-rose-600';
    pctTextColor = 'text-rose-700';
  } else if (remainingPercentage <= 20 || output.ivStatus === 'LOW_VOLUME') {
    borderColor = 'border-amber-300 hover:border-amber-400 bg-amber-50/20';
    progressBg = 'bg-amber-500';
    pctTextColor = 'text-amber-700';
  }

  return (
    <div
      onClick={() => onSelect(details.id)}
      className={`relative bg-white rounded-xl border p-4 shadow-xs hover:shadow-md transition-all cursor-pointer group ${borderColor}`}
    >
      {/* Header: Bed & Status & ESP32 connection */}
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="px-2 py-0.5 text-xs font-black bg-slate-100 text-slate-800 rounded-md tracking-wider">
            BED {details.bedNo}
          </span>
          <span className="text-xs text-slate-400 font-medium truncate max-w-[100px]">
            {details.fluidType}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {/* ESP32 Status Pill */}
          <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold tracking-tight ${
              esp32Status === 'CONNECTED'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-slate-100 text-slate-500 border border-slate-200'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                esp32Status === 'CONNECTED' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
              }`}
            />
            {esp32Status === 'CONNECTED' ? 'ESP32' : 'OFFLINE'}
          </span>
          <StatusBadge status={isStopped ? 'MONITORING_STOPPED' : (output.ivStatus || 'NORMAL')} size="sm" />
          <PulseStatusBadge status={pulseStatus} size="sm" />
        </div>
      </div>

      {/* Patient Name & Large Percentage Readout */}
      <div className="flex items-baseline justify-between mb-2">
        <div>
          <h3 className="text-base font-bold text-slate-900 group-hover:text-sky-700 transition-colors">
            {details.patientName}
          </h3>
          <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
            <span className="font-semibold text-slate-800">
              {remainingVolume > 0 && remainingVolume < 10
                ? `${remainingVolume.toFixed(1)} mL`
                : `${Math.round(remainingVolume)} mL`}
            </span>
            <span>/</span>
            <span>{details.initialVolume} mL</span>
          </div>
        </div>

        <div className="text-right">
          <div className={`text-2xl font-black tracking-tight ${pctTextColor}`}>
            {Math.round(remainingPercentage)}%
          </div>
          <div className="text-[10px] text-slate-400 font-medium uppercase">Remaining</div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mb-3">
        <div
          className={`h-full rounded-full transition-all duration-500 ${progressBg}`}
          style={{ width: `${remainingPercentage}%` }}
        />
      </div>

      {/* Telemetry Metrics Grid: Drip Rate, Flow Rate, Drop Count, ETA */}
      <div className="grid grid-cols-4 gap-1.5 py-2 border-t border-slate-100 text-xs">
        {/* Drip Rate */}
        <div className="flex flex-col">
          <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-0.5">
            <Droplets className="w-3 h-3 text-sky-600 shrink-0" /> Drip
          </span>
          <span className="font-bold text-slate-800 text-xs mt-0.5">
            {dripRate > 0 ? `${dripRate} dpm` : '0 dpm'}
          </span>
        </div>

        {/* Flow Rate */}
        <div className="flex flex-col">
          <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-0.5">
            <Wind className="w-3 h-3 text-teal-600 shrink-0" /> Flow
          </span>
          <span className="font-bold text-slate-800 text-xs mt-0.5">
            {flowRate > 0 ? `${flowRate} mL/h` : '--'}
          </span>
        </div>

        {/* Drop Count */}
        <div className="flex flex-col">
          <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-0.5">
            <Hash className="w-3 h-3 text-indigo-500 shrink-0" /> Drops
          </span>
          <span className="font-bold text-slate-800 text-xs mt-0.5">
            {(dropCount || 0).toLocaleString()}
          </span>
        </div>

        {/* ETA */}
        <div className="flex flex-col text-right">
          <span className="text-[10px] text-slate-400 font-semibold flex items-center justify-end gap-0.5">
            <Clock className="w-3 h-3 text-amber-500 shrink-0" /> ETA
          </span>
          <span className="font-bold text-slate-800 text-xs mt-0.5">
            {eta || '--'}
          </span>
        </div>
      </div>

      {/* Vitals Row: Heart Rate & SpO2 */}
      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs items-center bg-slate-50/50 rounded-lg p-1.5 mt-1">
        <div className="flex items-center gap-1.5">
          <Heart className={`w-3.5 h-3.5 text-rose-500 shrink-0 ${heartRate ? 'animate-pulse' : ''}`} />
          <div>
            <div className="text-[9px] font-bold text-slate-400 uppercase">Heart Rate</div>
            <span className="font-bold text-slate-800 text-xs">
              {heartRate !== null && heartRate > 0 ? `${Math.round(heartRate)} BPM` : 'NO PULSE DATA'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 justify-end">
          <div className="text-right">
            <div className="text-[9px] font-bold text-slate-400 uppercase">SpO₂ Oxygen</div>
            <span className="font-bold text-slate-800 text-xs">
              {spo2 !== null && spo2 > 0 ? `${spo2}%` : '--'}
            </span>
          </div>
          <span
            className={`w-2 h-2 rounded-full ${
              spo2 !== null && spo2 >= 95 ? 'bg-sky-500' : spo2 !== null ? 'bg-amber-500' : 'bg-slate-300'
            }`}
          />
        </div>
      </div>

      {/* Hover action cue */}
      <div className="mt-2 text-right">
        <span className="inline-flex items-center text-[11px] font-semibold text-sky-600 group-hover:text-sky-800">
          Open Monitor <ChevronRight className="w-3.5 h-3.5 ml-0.5 group-hover:translate-x-0.5 transition-transform" />
        </span>
      </div>
    </div>
  );
}

export const PatientCard = React.memo(PatientCardComponent);


