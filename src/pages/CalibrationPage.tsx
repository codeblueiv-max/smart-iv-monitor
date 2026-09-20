import React, { useState, useEffect } from 'react';
import { useMonitoring } from '../context/MonitoringContext';
import {
  ArrowLeft,
  Sliders,
  Scale,
  Eye,
  CheckCircle2,
  AlertCircle,
  Save,
  RotateCcw,
  Sparkles,
  User,
} from 'lucide-react';

interface CalibrationPageProps {
  onBack: () => void;
}

export function CalibrationPage({ onBack }: CalibrationPageProps) {
  const { calibrations, savePatientCalibration, saveBedCalibration, patients, currentPatientId } = useMonitoring();

  // Find currently active/selected patient
  const initialPatient =
    patients.find((p) => p?.details?.id === currentPatientId) ||
    patients.find((p) => p?.details?.monitoring) ||
    patients[0];

  const [selectedPatientId, setSelectedPatientId] = useState<string>(
    initialPatient?.details?.id || ''
  );

  const selectedPatient =
    patients.find((p) => p?.details?.id === selectedPatientId) || initialPatient;
  const currentBedNo = selectedPatient?.details?.bedNo || '168';

  const [tareWeightInput, setTareWeightInput] = useState<string>(
    String(selectedPatient?.details?.tareWeight ?? calibrations[currentBedNo]?.tareWeight ?? 30)
  );
  const [knownVolumeInput, setKnownVolumeInput] = useState<string>(
    String(selectedPatient?.details?.initialVolume ?? 500)
  );
  const [measuredWeightInput, setMeasuredWeightInput] = useState<string>(
    String((selectedPatient?.details?.initialVolume ?? 500) + (selectedPatient?.details?.tareWeight ?? 30))
  );
  const [irSensitivityInput, setIrSensitivityInput] = useState<number>(
    calibrations[currentBedNo]?.irSensitivity ?? 8
  );

  // Sync inputs when selected patient changes
  useEffect(() => {
    if (selectedPatient) {
      const tare = selectedPatient.details.tareWeight ?? calibrations[selectedPatient.details.bedNo]?.tareWeight ?? 30;
      const vol = selectedPatient.details.initialVolume ?? 500;
      const factor = selectedPatient.details.calibrationFactor ?? calibrations[selectedPatient.details.bedNo]?.calibrationFactor ?? 1.0;
      setTareWeightInput(String(tare));
      setKnownVolumeInput(String(vol));
      setMeasuredWeightInput(String(Math.round(tare + vol * factor)));
      setIrSensitivityInput(calibrations[selectedPatient.details.bedNo]?.irSensitivity ?? 8);
    }
  }, [selectedPatientId, selectedPatient, calibrations]);

  // IR Drop calibration test state
  const [actualDrops, setActualDrops] = useState<number>(20);
  const [detectedDrops, setDetectedDrops] = useState<number>(20);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Load current bed's saved calibration
  const currentBedCal = calibrations[currentBedNo] || {
    bedNo: currentBedNo,
    tareWeight: selectedPatient?.details?.tareWeight ?? 30,
    calibrationFactor: selectedPatient?.details?.calibrationFactor ?? 1.0,
    irSensitivity: 8,
    lastCalibrated: Date.now(),
  };

  const calculateFactor = () => {
    const netWeight = parseFloat(measuredWeightInput) - parseFloat(tareWeightInput);
    const volume = parseFloat(knownVolumeInput);
    if (volume <= 0 || isNaN(netWeight) || isNaN(volume)) return 1.0;
    return Math.round((netWeight / volume) * 1000) / 1000;
  };

  const calculatedFactor = calculateFactor();
  const irAccuracy =
    actualDrops > 0 ? Math.min(100, Math.round((detectedDrops / actualDrops) * 100)) : 100;

  const handleSaveCalibration = async () => {
    const tare = parseFloat(tareWeightInput) || 30;
    if (selectedPatient?.details?.id) {
      await savePatientCalibration(
        selectedPatient.details.id,
        tare,
        calculatedFactor,
        irSensitivityInput
      );
      setSaveMessage(
        `Calibration saved successfully for Patient ${selectedPatient.details.patientName} (Bed ${selectedPatient.details.bedNo}) and persisted to Firebase!`
      );
    } else {
      saveBedCalibration(currentBedNo, tare, calculatedFactor, irSensitivityInput);
      setSaveMessage(`Calibration saved successfully for Bed ${currentBedNo}!`);
    }
    setTimeout(() => setSaveMessage(null), 4000);
  };

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
                <Sliders className="w-5 h-5 text-teal-400" />
                <span>BED SENSOR CALIBRATION WIZARD</span>
              </h1>
              <p className="text-xs text-slate-400">
                Load cell tare, scale calibration factor, and IR optical sensor accuracy
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6 flex-1">
        {/* Patient / Bed Selector Bar */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-bold text-slate-700 uppercase">Select Patient / Bed for Calibration:</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {patients.map((p) => {
                const isSelected = p.details.id === selectedPatientId;
                return (
                  <button
                    key={p.details.id}
                    onClick={() => {
                      setSelectedPatientId(p.details.id);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-sky-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <span>Bed {p.details.bedNo}</span>
                    <span className="text-[10px] opacity-75">({p.details.patientName})</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="text-xs text-slate-500">
            Last Calibrated:{' '}
            <span className="font-semibold text-slate-700">
              {new Date(currentBedCal.lastCalibrated).toLocaleDateString()}
            </span>
          </div>
        </div>

        {saveMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{saveMessage}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Module 1: Load Cell Calibration */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Scale className="w-4 h-4 text-sky-600" />
                <span>1. Load Cell (HX711) Tare & Calibration</span>
              </h3>
              <span className="text-[11px] font-semibold text-slate-400">
                Bed {currentBedNo} {selectedPatient?.details?.patientName ? `• ${selectedPatient.details.patientName}` : ''}
              </span>
            </div>

            <div className="space-y-4 text-xs">
              {/* Step 1: Tare */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="font-bold text-slate-800 flex items-center justify-between">
                  <span>Step 1: Empty Bottle Tare Weight</span>
                  <span className="text-[10px] text-sky-700 uppercase font-semibold">Zero Reference</span>
                </div>
                <p className="text-slate-500 text-[11px]">
                  Place an empty IV bottle / container with cap onto the load cell hook.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={tareWeightInput}
                    onChange={(e) => setTareWeightInput(e.target.value)}
                    className="w-28 px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold bg-white focus:ring-2 focus:ring-sky-500"
                  />
                  <span className="text-slate-500">grams (g)</span>
                  <button
                    type="button"
                    onClick={() => setTareWeightInput('0')}
                    className="ml-auto px-2.5 py-1 text-[11px] font-bold bg-slate-200 text-slate-700 hover:bg-slate-300 rounded-lg flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" /> Tare to 0
                  </button>
                </div>
              </div>

              {/* Step 2: Known Weight */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="font-bold text-slate-800 flex items-center justify-between">
                  <span>Step 2: Add Known Fluid Volume</span>
                  <span className="text-[10px] text-emerald-700 uppercase font-semibold">Scale Slope</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Known Fluid Volume (mL)</label>
                    <input
                      type="number"
                      value={knownVolumeInput}
                      onChange={(e) => setKnownVolumeInput(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold bg-white focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Measured Total Weight (g)</label>
                    <input
                      type="number"
                      value={measuredWeightInput}
                      onChange={(e) => setMeasuredWeightInput(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold bg-white focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>
              </div>

              {/* Step 3: Resulting Factor */}
              <div className="p-3.5 bg-sky-50/70 border border-sky-200 rounded-xl flex items-center justify-between">
                <div>
                  <div className="font-bold text-sky-900 text-xs">Calculated Calibration Factor:</div>
                  <div className="text-[11px] text-sky-700">Formula: (Gross Weight - Tare) / Volume</div>
                </div>
                <div className="text-xl font-black text-sky-800">{calculatedFactor} g/mL</div>
              </div>
            </div>
          </div>

          {/* Module 2: IR Sensor Calibration */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Eye className="w-4 h-4 text-teal-600" />
                <span>2. Optical IR Drop Sensor Accuracy Test</span>
              </h3>
              <span className="text-[11px] font-semibold text-slate-400">
                Bed {currentBedNo}
              </span>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="font-bold text-slate-800">Drop Counter Verification Test</div>
                <p className="text-slate-500 text-[11px]">
                  Introduce a known count of manual drops into the chamber to calibrate IR pulse precision.
                </p>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Actual Known Drops</label>
                    <input
                      type="number"
                      value={actualDrops}
                      onChange={(e) => setActualDrops(parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold bg-white focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Detected Drop Pulses</label>
                    <input
                      type="number"
                      value={detectedDrops}
                      onChange={(e) => setDetectedDrops(parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold bg-white focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">
                    Compare physical drip chamber drops against IR detected count.
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      setDetectedDrops(actualDrops);
                    }}
                    className="text-[11px] text-teal-700 font-bold hover:text-teal-900 underline"
                  >
                    Match Detected to Actual ({actualDrops})
                  </button>
                </div>
              </div>

              {/* Accuracy Display Box */}
              <div className="p-3.5 bg-teal-50/70 border border-teal-200 rounded-xl flex items-center justify-between">
                <div>
                  <div className="font-bold text-teal-900 text-xs">IR Detection Accuracy:</div>
                  <div className="text-[11px] text-teal-700">
                    Actual: {actualDrops} | Detected: {detectedDrops}
                  </div>
                </div>
                <div
                  className={`text-2xl font-black ${
                    irAccuracy >= 95 ? 'text-teal-700' : 'text-amber-700'
                  }`}
                >
                  {irAccuracy}%
                </div>
              </div>

              {/* Sensitivity Slider */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex justify-between font-bold text-slate-800">
                  <span>IR Sensitivity Threshold</span>
                  <span className="text-teal-700">Level {irSensitivityInput} / 10</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={irSensitivityInput}
                  onChange={(e) => setIrSensitivityInput(parseInt(e.target.value))}
                  className="w-full accent-teal-600 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Global Save Bar */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Applying calibration configuration to <strong>Bed {currentBedNo}</strong> {selectedPatient ? `(${selectedPatient.details.patientName})` : ''} (Tare: {tareWeightInput}g, Factor: {calculatedFactor}, IR: {irAccuracy}%)
          </div>

          <button
            onClick={handleSaveCalibration}
            className="px-6 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-md transition-colors flex items-center gap-2"
          >
            <Save className="w-4 h-4 text-emerald-400" />
            <span>SAVE CALIBRATION</span>
          </button>
        </div>
      </main>
    </div>
  );
}
