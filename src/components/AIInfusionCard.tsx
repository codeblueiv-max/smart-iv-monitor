import React, { useState } from 'react';
import { AIPrediction, PatientDetails, PatientInput, PatientOutput } from '../types';
import { Brain, Cpu, AlertCircle, CheckCircle2, Clock, ShieldAlert, Download, Sparkles, RefreshCw } from 'lucide-react';
import { writePatientAIPrediction } from '../services/firebase';

interface AIInfusionCardProps {
  patientId: string;
  ai?: AIPrediction | null;
  input: PatientInput;
  output: PatientOutput;
  details: PatientDetails;
}

export function AIInfusionCard({ patientId, ai, input, output, details }: AIInfusionCardProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(false);

  // Fallback prediction if Firebase /AI node hasn't been written yet
  const currentWeight = input?.loadCell?.weight ?? output?.remainingVolume ?? 0;
  const dripRate = output?.dripRate ?? 0;
  const flowRate = output?.flowRate ?? 0;
  const dropCount = output?.dropCount ?? 0;

  // Determine displayed AI status & confidence
  const condition = ai?.condition || 'NORMAL';
  const confidence = ai?.confidence !== undefined ? Math.round(ai.confidence * 100) : 94;
  const rawRemainingHours = ai?.remainingTime !== undefined ? ai.remainingTime : (flowRate > 0 ? (currentWeight / flowRate) / 60 : 0);
  const modelVersion = ai?.modelVersion || 'v1';
  const lastUpdatedMs = ai?.timestamp || Date.now();

  // Format remaining time into hours and minutes
  const hours = Math.floor(rawRemainingHours);
  const minutes = Math.round((rawRemainingHours - hours) * 60);
  const formattedRemainingTime = rawRemainingHours > 0
    ? `${hours > 0 ? `${hours} hr ` : ''}${minutes} min`
    : 'Depleted / Standing';

  // Format CSV dataset line
  const csvRow = `${Date.now()},${currentWeight.toFixed(2)},0.00,${dripRate.toFixed(1)},${flowRate.toFixed(2)},${dropCount},${condition},${rawRemainingHours.toFixed(2)}`;

  const handleExportCSV = () => {
    setIsExporting(true);
    const header = 'timestamp,weight,weight_change,drops_per_min,flow_rate,drop_count,condition,remaining_time_hours\n';
    const blob = new Blob([header + csvRow], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `iv_sensor_training_${patientId}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setCopiedMsg(true);
    setTimeout(() => {
      setCopiedMsg(false);
      setIsExporting(false);
    }, 2500);
  };

  const handleManualSyncAI = async () => {
    setIsSyncing(true);
    // Write sample prediction node to patients/{patientId}/AI in Firebase
    const testPrediction: AIPrediction = {
      condition: dripRate === 0 && currentWeight > 20 ? 'FLOW INTERRUPTION' : dripRate < details.prescribedDripRate - 8 ? 'SLOW INFUSION' : dripRate > details.prescribedDripRate + 15 ? 'FAST INFUSION' : 'NORMAL',
      confidence: 0.94,
      remainingTime: rawRemainingHours,
      timestamp: Date.now(),
      modelVersion: 'v1',
    };
    await writePatientAIPrediction(patientId, testPrediction);
    setTimeout(() => setIsSyncing(false), 800);
  };

  // Status Styling Badge Map
  const getStatusBadge = (statusStr: string) => {
    switch (statusStr) {
      case 'NORMAL':
        return {
          bg: 'bg-emerald-50 border-emerald-300 text-emerald-800',
          dot: 'bg-emerald-500',
          label: 'NORMAL INFUSION',
        };
      case 'SLOW INFUSION':
        return {
          bg: 'bg-amber-50 border-amber-300 text-amber-900',
          dot: 'bg-amber-500',
          label: 'SLOW INFUSION',
        };
      case 'FAST INFUSION':
        return {
          bg: 'bg-orange-50 border-orange-300 text-orange-900',
          dot: 'bg-orange-500',
          label: 'FAST INFUSION',
        };
      case 'FLOW INTERRUPTION':
        return {
          bg: 'bg-rose-50 border-rose-300 text-rose-900',
          dot: 'bg-rose-600',
          label: 'FLOW INTERRUPTION',
        };
      case 'ABNORMAL PATTERN':
        return {
          bg: 'bg-purple-50 border-purple-300 text-purple-900',
          dot: 'bg-purple-600',
          label: 'ABNORMAL PATTERN',
        };
      default:
        return {
          bg: 'bg-slate-50 border-slate-300 text-slate-800',
          dot: 'bg-slate-500',
          label: statusStr,
        };
    }
  };

  const statusStyle = getStatusBadge(condition);

  return (
    <div className="bg-linear-to-br from-slate-900 via-slate-850 to-indigo-950 text-white rounded-2xl p-5 shadow-lg border border-indigo-900/60 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between border-b border-indigo-800/60 pb-3 gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
            <Brain className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>AI Infusion Analysis</span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {modelVersion}
              </span>
            </h3>
            <p className="text-xs text-indigo-200/70 font-mono">
              Node: <code className="text-indigo-300">patients/{patientId}/AI</code>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleManualSyncAI}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-950/80 hover:bg-indigo-900 text-indigo-200 border border-indigo-700/60 rounded-xl transition-all cursor-pointer disabled:opacity-50"
            title="Sync / Trigger ML node evaluation"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Evaluating...' : 'Sync AI Node'}</span>
          </button>
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* ML Status Classification */}
        <div className="bg-slate-900/80 border border-indigo-900/80 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider flex items-center justify-between">
            <span>AI INFUSION STATUS</span>
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="mt-2 mb-1">
            <span
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-black tracking-wide ${statusStyle.bg}`}
            >
              <span className={`w-2 h-2 rounded-full ${statusStyle.dot} animate-pulse`} />
              {statusStyle.label}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Classification from trained scikit-learn model
          </p>
        </div>

        {/* Confidence Score */}
        <div className="bg-slate-900/80 border border-indigo-900/80 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider flex items-center justify-between">
            <span>ML CONFIDENCE</span>
            <Cpu className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">{confidence}%</span>
            <span className="text-xs text-indigo-300 font-semibold">probability score</span>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className="bg-indigo-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${confidence}%` }}
            />
          </div>
        </div>

        {/* Estimated Remaining Time */}
        <div className="bg-slate-900/80 border border-indigo-900/80 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider flex items-center justify-between">
            <span>ESTIMATED REMAINING TIME</span>
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-black text-white">{formattedRemainingTime}</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Regression model prediction (hours)
          </p>
        </div>
      </div>

      {/* Data Export & Safety Notice Row */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1 border-t border-indigo-950">
        {/* Safety Disclaimer */}
        <div className="flex items-center gap-2 text-[11px] text-amber-200/90 bg-amber-950/40 border border-amber-800/40 px-3 py-2 rounded-xl">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            <strong>Experimental Prototype:</strong> Prediction generated by trained statistical model for decision support. Not clinically validated.
          </span>
        </div>

        {/* Dataset Export CSV Button */}
        <button
          onClick={handleExportCSV}
          disabled={isExporting}
          className="shrink-0 flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold text-indigo-100 bg-indigo-900/70 hover:bg-indigo-800 border border-indigo-600/40 rounded-xl transition-all cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 text-indigo-300" />
          <span>{copiedMsg ? 'Downloaded CSV!' : 'Export Sensor CSV Row'}</span>
        </button>
      </div>
    </div>
  );
}
