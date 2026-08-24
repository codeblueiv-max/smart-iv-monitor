import React, { useState, useRef } from 'react';
import { IVFluidType } from '../types';
import { PlusCircle, X, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

interface AddPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (data: {
    bedNo: string;
    patientName: string;
    fluidType: IVFluidType;
    initialVolume: number;
    prescribedDripRate: number;
    dropFactor: number;
    notes?: string;
  }) => Promise<string>;
}

export function AddPatientModal({ isOpen, onClose, onAdd }: AddPatientModalProps) {
  const [bedNo, setBedNo] = useState('');
  const [patientName, setPatientName] = useState('');
  const [fluidType, setFluidType] = useState<IVFluidType>('Normal Saline');
  const [initialVolume, setInitialVolume] = useState('500');
  const [prescribedDripRate, setPrescribedDripRate] = useState('20');
  const [dropFactor, setDropFactor] = useState('20');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current || isSubmitting) return;

    setError(null);
    setSuccessMessage(null);

    // Validation
    if (!bedNo.trim()) {
      setError('Bed Number is required');
      return;
    }
    if (!patientName.trim()) {
      setError('Patient Name is required');
      return;
    }
    const vol = parseFloat(initialVolume);
    if (isNaN(vol) || vol <= 0 || vol > 5000) {
      setError('Please enter a valid initial IV volume (10 to 5000 mL)');
      return;
    }
    const rate = parseFloat(prescribedDripRate);
    if (isNaN(rate) || rate <= 0 || rate > 200) {
      setError('Please enter a valid prescribed drip rate (1 to 200 dpm)');
      return;
    }
    const factor = parseFloat(dropFactor);
    if (isNaN(factor) || factor <= 0) {
      setError('Please select a valid drop factor (e.g. 10, 15, 20, 60)');
      return;
    }

    try {
      isSubmittingRef.current = true;
      setIsSubmitting(true);
      await onAdd({
        bedNo: bedNo.trim(),
        patientName: patientName.trim(),
        fluidType,
        initialVolume: vol,
        prescribedDripRate: rate,
        dropFactor: factor,
        notes: notes.trim() || undefined,
      });

      setSuccessMessage('Patient created successfully! Firebase structure initialized.');
      // reset form after brief confirmation
      setTimeout(() => {
        setBedNo('');
        setPatientName('');
        setInitialVolume('500');
        setPrescribedDripRate('20');
        setDropFactor('20');
        setNotes('');
        setSuccessMessage(null);
        onClose();
      }, 600);
    } catch (err) {
      setError((err as Error).message || 'Failed to start monitoring');
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-sky-500/20 text-sky-400 rounded-lg">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">ADD PATIENT</h2>
              <p className="text-xs text-slate-400">Initialize real-time infusion session</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-2">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Bed Number *
              </label>
              <input
                type="text"
                value={bedNo}
                onChange={(e) => setBedNo(e.target.value)}
                placeholder="e.g. 205, ICU-04"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-sky-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Patient Name *
              </label>
              <input
                type="text"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="e.g. Kumar S., Arun M."
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-sky-500 focus:outline-none"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                IV Fluid Type
              </label>
              <select
                value={fluidType}
                onChange={(e) => setFluidType(e.target.value as IVFluidType)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-medium bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
              >
                <option value="Normal Saline">Normal Saline (0.9% NaCl)</option>
                <option value="Dextrose (D5W)">Dextrose (D5W / 5% Dextrose)</option>
                <option value="Ringer's Lactate">Ringer's Lactate (RL)</option>
                <option value="0.45% Saline">0.45% Half Normal Saline</option>
                <option value="Other">Other Infusion Solution</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Initial IV Volume (mL) *
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="10"
                  max="5000"
                  step="10"
                  value={initialVolume}
                  onChange={(e) => setInitialVolume(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-sky-500 focus:outline-none pr-10"
                  required
                />
                <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-semibold">mL</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Prescribed Drip Rate (dpm) *
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="200"
                  value={prescribedDripRate}
                  onChange={(e) => setPrescribedDripRate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-sky-500 focus:outline-none pr-14"
                  required
                />
                <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-semibold">drops/min</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Drop Factor (Tubing)
              </label>
              <select
                value={dropFactor}
                onChange={(e) => setDropFactor(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-medium bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
              >
                <option value="20">20 drops/mL (Standard IV tubing)</option>
                <option value="15">15 drops/mL (Macro drip)</option>
                <option value="10">10 drops/mL (Blood / macro set)</option>
                <option value="60">60 drops/mL (Microdrip / Pediatric)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Clinical Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Post-op hydration, IV antibiotic piggyback"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 text-sm font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-xl shadow-md shadow-sky-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>INITIALIZING...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>START MONITORING</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
