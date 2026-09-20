import React, { useState, useEffect, useRef } from 'react';
import { IVFluidType, Patient } from '../types';
import { Pencil, X, AlertCircle, CheckCircle, Loader2, Calculator } from 'lucide-react';
import { calculatePrescribedDripRate } from '../utils/calculations';

interface EditPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient | null;
  onSave: (
    patientId: string,
    data: {
      bedNo: string;
      patientName: string;
      fluidType: IVFluidType;
      initialVolume: number;
      prescribedInfusionTimeHours?: number;
      prescribedInfusionTimeMinutes?: number;
      prescribedDripRate: number;
      dropFactor: number;
      notes?: string;
    }
  ) => Promise<void>;
}

export function EditPatientModal({ isOpen, onClose, patient, onSave }: EditPatientModalProps) {
  const [bedNo, setBedNo] = useState('');
  const [patientName, setPatientName] = useState('');
  const [fluidType, setFluidType] = useState<IVFluidType>('Normal Saline');
  const [initialVolume, setInitialVolume] = useState('100');
  const [infusionHours, setInfusionHours] = useState('1');
  const [infusionMinutes, setInfusionMinutes] = useState('0');
  const [dropFactor, setDropFactor] = useState('20');
  const [customPrescribedRate, setCustomPrescribedRate] = useState<string>('');
  const [useCustomRate, setUseCustomRate] = useState(false);
  const [notes, setNotes] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    if (patient && isOpen) {
      setBedNo(patient.details.bedNo || '');
      setPatientName(patient.details.patientName || '');
      setFluidType(patient.details.fluidType || 'Normal Saline');
      setInitialVolume(String(patient.details.initialVolume ?? 100));
      
      const hrs = patient.details.prescribedInfusionTimeHours ?? 1;
      const mins = patient.details.prescribedInfusionTimeMinutes ?? 0;
      setInfusionHours(String(hrs));
      setInfusionMinutes(String(mins));

      setDropFactor(String(patient.details.dropFactor ?? 20));
      setNotes(patient.details.notes || '');

      const currentPrescribed = patient.details.prescribedDripRate ?? 33.33;
      const calculated = calculatePrescribedDripRate(
        patient.details.initialVolume ?? 100,
        patient.details.dropFactor ?? 20,
        hrs,
        mins
      );

      // If user had a custom rate set before
      if (Math.abs(currentPrescribed - calculated) > 0.5) {
        setUseCustomRate(true);
        setCustomPrescribedRate(String(Math.round(currentPrescribed)));
      } else {
        setUseCustomRate(false);
        setCustomPrescribedRate('');
      }

      setError(null);
      setSuccessMessage(null);
    }
  }, [patient, isOpen]);

  if (!isOpen || !patient) return null;

  const volNum = parseFloat(initialVolume) || 0;
  const hoursNum = parseFloat(infusionHours) || 0;
  const minsNum = parseFloat(infusionMinutes) || 0;
  const factorNum = parseFloat(dropFactor) || 20;
  const totalTimeMinutes = hoursNum * 60 + minsNum;

  const autoCalculatedDpm = calculatePrescribedDripRate(volNum, factorNum, hoursNum, minsNum);
  const effectivePrescribedDpm = useCustomRate && customPrescribedRate !== ''
    ? parseFloat(customPrescribedRate) || 0
    : autoCalculatedDpm;

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
    if (isNaN(volNum) || volNum <= 0 || volNum > 5000) {
      setError('Please enter a valid initial IV volume (10 to 5000 mL)');
      return;
    }
    if (totalTimeMinutes <= 0) {
      setError('Please enter a valid prescribed infusion time (hours/minutes)');
      return;
    }
    if (isNaN(effectivePrescribedDpm) || effectivePrescribedDpm <= 0 || effectivePrescribedDpm > 300) {
      setError('Calculated or prescribed drip rate must be a valid number (1 to 300 dpm)');
      return;
    }

    try {
      isSubmittingRef.current = true;
      setIsSubmitting(true);

      await onSave(patient.details.id, {
        bedNo: bedNo.trim(),
        patientName: patientName.trim(),
        fluidType,
        initialVolume: volNum,
        prescribedInfusionTimeHours: hoursNum,
        prescribedInfusionTimeMinutes: minsNum,
        prescribedDripRate: effectivePrescribedDpm,
        dropFactor: factorNum,
        notes: notes.trim() || undefined,
      });

      setSuccessMessage('Patient details updated successfully');
      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 600);
    } catch (err: any) {
      const msg = err?.message || 'Unable to update patient details';
      setError(msg.startsWith('Unable to update') ? msg : `Unable to update patient details: ${msg}`);
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-sky-500/20 text-sky-400 rounded-lg">
              <Pencil className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold uppercase tracking-tight">EDIT PATIENT DETAILS</h2>
              <p className="text-xs text-slate-400">Update record for Bed {patient.details.bedNo}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
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

          {/* Prescribed Infusion Time (Hours & Minutes) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Prescribed Infusion Time *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={infusionHours}
                    onChange={(e) => setInfusionHours(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-sky-500 focus:outline-none pr-9"
                    required
                  />
                  <span className="absolute right-2.5 top-2.5 text-xs text-slate-400 font-semibold">hrs</span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={infusionMinutes}
                    onChange={(e) => setInfusionMinutes(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-sky-500 focus:outline-none pr-10"
                    required
                  />
                  <span className="absolute right-2.5 top-2.5 text-xs text-slate-400 font-semibold">mins</span>
                </div>
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

          {/* Drip Rate Formula & Live Calculation Card */}
          <div className="bg-sky-50/80 border border-sky-200 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-sky-900 font-bold text-xs uppercase tracking-wider">
                <Calculator className="w-4 h-4 text-sky-600" />
                <span>IV Drip Rate Calculation</span>
              </div>
              <span className="text-xs font-extrabold text-sky-800 bg-white px-2.5 py-1 rounded-lg border border-sky-200 shadow-2xs">
                Prescribed Rate: {Math.round(effectivePrescribedDpm)} dpm
              </span>
            </div>

            <div className="text-xs text-sky-700 space-y-1 font-mono bg-white/70 p-2.5 rounded-lg border border-sky-100">
              <div className="flex justify-between items-center text-[11px] text-slate-500">
                <span>Formula: (Volume × Drop Factor) ÷ Total Time in Minutes</span>
              </div>
              <div className="font-semibold text-slate-800">
                ({volNum} mL × {factorNum} drops/mL) ÷ {totalTimeMinutes || 60} mins = {autoCalculatedDpm.toFixed(2)} drops/min
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-slate-700 font-medium">
                <input
                  type="checkbox"
                  checked={useCustomRate}
                  onChange={(e) => {
                    setUseCustomRate(e.target.checked);
                    if (e.target.checked && !customPrescribedRate) {
                      setCustomPrescribedRate(String(Math.round(autoCalculatedDpm)));
                    }
                  }}
                  className="rounded text-sky-600 focus:ring-sky-500"
                />
                <span>Override with custom rate</span>
              </label>

              {useCustomRate && (
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="1"
                    max="200"
                    value={customPrescribedRate}
                    onChange={(e) => setCustomPrescribedRate(e.target.value)}
                    className="w-20 px-2 py-1 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    placeholder="e.g. 33"
                  />
                  <span className="text-slate-500 font-medium text-xs">dpm</span>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Clinical Notes
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
                  <span>SAVING...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>SAVE CHANGES</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
