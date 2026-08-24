import React from 'react';
import { AlertCircle } from 'lucide-react';

interface StopMonitoringConfirmModalProps {
  isOpen: boolean;
  patientName: string;
  bedNo: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function StopMonitoringConfirmModal({
  isOpen,
  patientName,
  bedNo,
  onConfirm,
  onCancel,
}: StopMonitoringConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3 text-rose-600 mb-4">
          <div className="p-3 bg-rose-100 rounded-xl">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">STOP MONITORING?</h3>
            <p className="text-xs text-slate-500">Confirm infusion session termination</p>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-5 text-sm space-y-1.5">
          <div className="flex justify-between">
            <span className="text-slate-500">Patient:</span>
            <span className="font-semibold text-slate-800">{patientName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Bed Number:</span>
            <span className="font-semibold text-slate-800">Bed {bedNo}</span>
          </div>
          <p className="text-xs text-slate-500 pt-2 border-t border-slate-200 mt-2">
            Historical logs, alerts, and charts will be safely archived in Patient Logs.
          </p>
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition-colors"
          >
            Confirm & Stop
          </button>
        </div>
      </div>
    </div>
  );
}
