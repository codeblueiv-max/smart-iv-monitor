import {
  Alert,
  AlertSeverity,
  PatientDetails,
  PatientInput,
  PatientLogRecord,
  PatientOutput,
  PatientStatus,
  PulseSensorQuality,
  PulseStatus,
  SensorQuality,
  SensorReading,
} from '../types';

export const STATUS_PRIORITIES: Record<PatientStatus, number> = {
  BAG_NEARLY_EMPTY: 1,
  CRITICAL_VOLUME: 1,
  LOW_VOLUME: 1,
  OCCLUSION: 2,
  POSSIBLE_OCCLUSION: 2,
  LEAKAGE: 3,
  POSSIBLE_LEAKAGE: 3,
  EXCESSIVE_FLOW: 4,
  POSSIBLE_EXCESSIVE_FLOW: 4,
  ABNORMAL_FLOW: 5,
  ABNORMAL_PULSE: 6,
  ABNORMAL: 6,
  HIGH_PULSE: 7,
  LOW_PULSE: 8,
  SENSOR_UNSTABLE: 10,
  ESP32_DISCONNECTED: 11,
  NO_PULSE_DATA: 12,
  NORMAL: 13,
  RUNNING: 14,
  NO_DATA: 15,
  MONITORING_STOPPED: 16,
  STOPPED: 17,
};

export function calculateVolume(
  measuredWeight: number,
  tareWeight: number = 30, // standard empty bottle/cap ~30g
  calibrationFactor: number = 1.0 // 1g = 1mL for saline/aqueous fluids
): number {
  const netWeight = Math.max(0, measuredWeight - tareWeight);
  const volume = netWeight / (calibrationFactor || 1.0);
  return Math.round(volume * 10) / 10;
}

export function calculateRemainingPercentage(
  currentVolume: number,
  initialVolume: number
): number {
  if (!initialVolume || initialVolume <= 0) return 0;
  const pct = (currentVolume / initialVolume) * 100;
  return Math.min(100, Math.max(0, Math.round(pct * 10) / 10));
}

/**
 * Prescribed IV Drip Rate Formula:
 * Drip Rate (drops/min or gtt/min) = (Total Volume in mL × Drop Factor in drops/mL) ÷ Total Time in minutes
 *
 * Example:
 * Total Volume = 100 mL, Infusion Time = 1 hour (60 min), Drop Factor = 20 drops/mL
 * dripRate = (100 * 20) / 60 = 33.3333... drops/min
 *
 * Returns exact internal float value (e.g. 33.333333333333336).
 * Display values are rounded to the nearest integer (33 dpm).
 */
export function calculatePrescribedDripRate(
  totalVolumeML: number,
  dropFactor: number,
  infusionTimeHours: number = 0,
  infusionTimeMinutes: number = 0
): number {
  if (!totalVolumeML || totalVolumeML <= 0 || !dropFactor || dropFactor <= 0) {
    return 0;
  }
  const totalMinutes = (infusionTimeHours || 0) * 60 + (infusionTimeMinutes || 0);
  if (!totalMinutes || totalMinutes <= 0) {
    return 0;
  }
  const dpm = (totalVolumeML * dropFactor) / totalMinutes;
  return isFinite(dpm) && dpm > 0 ? dpm : 0;
}

/**
 * IV Flow Rate Formula:
 * Flow Rate (mL/hour) = (Actual Drip Rate (dpm) × 60) ÷ Drop Factor (drops/mL)
 *
 * Example:
 * Actual Drip Rate = 20 dpm, Drop Factor = 20 drops/mL -> (20 * 60) / 20 = 60 mL/h
 * Actual Drip Rate = 35 dpm, Drop Factor = 20 drops/mL -> (35 * 60) / 20 = 105 mL/h
 */
export function calculateFlowRate(dripRate: number | null | undefined, dropFactor: number): number | null {
  if (!dropFactor || dropFactor <= 0 || dripRate === null || dripRate === undefined || dripRate <= 0) return null;
  const flowRateMLH = (dripRate * 60) / dropFactor;
  return isFinite(flowRateMLH) && flowRateMLH > 0 ? Math.round(flowRateMLH * 10) / 10 : null;
}

/**
 * Estimated Time of Arrival / Empty Time (ETA):
 * ETA (hours) = Remaining Volume (mL) ÷ Actual Flow Rate (mL/h)
 * ETA (minutes) = (Remaining Volume × 60) ÷ Actual Flow Rate
 *
 * Example:
 * Remaining Volume = 56 mL, Actual Flow Rate = 60 mL/h -> ETA = 56 min -> "0 hr 56 min"
 * If Actual Flow Rate <= 0 -> display "--"
 */
export function calculateETA(remainingVolume: number, actualFlowRateMLH: number | null | undefined): string {
  if (!actualFlowRateMLH || actualFlowRateMLH <= 0 || !remainingVolume || remainingVolume <= 0) {
    return '--';
  }
  const totalMinutes = Math.round((remainingVolume / actualFlowRateMLH) * 60);
  if (!isFinite(totalMinutes) || totalMinutes < 0 || totalMinutes > 5999) {
    return '--';
  }
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${hours} hr ${mins.toString().padStart(2, '0')} min`;
}

export function calculateETAMinutes(
  remainingVolume: number,
  flowRate: number | null | undefined
): number | null {
  if (!flowRate || flowRate <= 0.05 || remainingVolume <= 0) {
    return null;
  }
  const minutes = (remainingVolume / flowRate) * 60;
  if (!isFinite(minutes) || minutes < 0 || minutes > 99999) return null;
  return Math.round(minutes);
}

export function formatETA(etaMinutes: number | null): string {
  if (etaMinutes === null || etaMinutes <= 0) {
    return '--';
  }
  const hours = Math.floor(etaMinutes / 60);
  const mins = Math.floor(etaMinutes % 60);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${hours} hr ${pad(mins)} min`;
}

export function evaluateSensorQuality(
  rawWeight: number,
  recentReadings: PatientLogRecord[] = []
): SensorQuality {
  if (rawWeight <= 0 || isNaN(rawWeight)) {
    return 'INVALID';
  }
  if (recentReadings.length >= 3) {
    const recentWeights = recentReadings.slice(-4).map((r) => r.weight);
    const maxVal = Math.max(...recentWeights, rawWeight);
    const minVal = Math.min(...recentWeights, rawWeight);
    // Sudden erratic spike of > 80g between 1-2 seconds indicates vibration or unstable mount
    if (maxVal - minVal > 90) {
      return 'UNSTABLE';
    }
  }
  return 'GOOD';
}

/**
 * Evaluates pulse rate according to standard medical thresholds:
 * - 60–100 BPM: NORMAL (Green)
 * - < 60 BPM: LOW PULSE (Amber)
 * - > 100 BPM: HIGH PULSE (Amber)
 * - No valid reading: NO PULSE DATA (Grey)
 */
export function evaluatePulseStatus(
  pulseRate: number | null | undefined
): PulseStatus {
  if (pulseRate === null || pulseRate === undefined || isNaN(pulseRate) || pulseRate <= 0) {
    return 'NO PULSE DATA';
  }
  const bpm = Math.round(pulseRate);
  if (bpm >= 60 && bpm <= 100) {
    return 'NORMAL';
  }
  return 'ABNORMAL';
}

/**
 * Returns color classes and styling tokens for Pulse Status
 */
export function getPulseStatusTheme(status: PulseStatus | string | null | undefined): {
  label: string;
  badgeBg: string;
  textColor: string;
  borderColor: string;
  dotBg: string;
  heartColor: string;
} {
  let rawStr = '';
  if (typeof status === 'string') {
    rawStr = status;
  } else if (status && typeof status === 'object') {
    if ('pulseStatus' in status && typeof (status as any).pulseStatus === 'string') {
      rawStr = (status as any).pulseStatus;
    } else if ('status' in status && typeof (status as any).status === 'string') {
      rawStr = (status as any).status;
    }
  }
  const norm = rawStr.toUpperCase().replace(/_/g, ' ').trim();
  if (norm === 'NORMAL') {
    return {
      label: 'NORMAL',
      badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      textColor: 'text-emerald-600',
      borderColor: 'border-emerald-300',
      dotBg: 'bg-emerald-500',
      heartColor: 'text-emerald-500',
    };
  }
  if (norm === 'ABNORMAL') {
    return {
      label: 'ABNORMAL',
      badgeBg: 'bg-amber-50 text-amber-800 border-amber-300',
      textColor: 'text-amber-600',
      borderColor: 'border-amber-400',
      dotBg: 'bg-amber-500 animate-pulse',
      heartColor: 'text-amber-500',
    };
  }
  if (norm === 'LOW PULSE' || norm === 'LOW_PULSE') {
    return {
      label: 'LOW PULSE',
      badgeBg: 'bg-amber-50 text-amber-800 border-amber-300',
      textColor: 'text-amber-600',
      borderColor: 'border-amber-400',
      dotBg: 'bg-amber-500 animate-pulse',
      heartColor: 'text-amber-500',
    };
  }
  if (norm === 'HIGH PULSE' || norm === 'HIGH_PULSE') {
    return {
      label: 'HIGH PULSE',
      badgeBg: 'bg-amber-50 text-amber-800 border-amber-300',
      textColor: 'text-amber-600',
      borderColor: 'border-amber-400',
      dotBg: 'bg-amber-500 animate-pulse',
      heartColor: 'text-amber-500',
    };
  }
  if (norm === 'STOPPED' || norm === 'MONITORING STOPPED' || norm === 'MONITORING_STOPPED') {
    return {
      label: 'STOPPED',
      badgeBg: 'bg-slate-100 text-slate-500 border-slate-300',
      textColor: 'text-slate-400',
      borderColor: 'border-slate-300',
      dotBg: 'bg-slate-400',
      heartColor: 'text-slate-400',
    };
  }
  return {
    label: norm && norm !== 'NO PULSE DATA' ? norm : 'NO PULSE DATA',
    badgeBg: 'bg-slate-100 text-slate-600 border-slate-200',
    textColor: 'text-slate-400',
    borderColor: 'border-slate-300',
    dotBg: 'bg-slate-400',
    heartColor: 'text-slate-400',
  };
}

export interface DiagnosticResult {
  status: PatientStatus;
  severity: AlertSeverity;
  alertType?: PatientStatus;
  alertMessage?: string;
  suggestedAction?: string;
}

export interface PulseDiagnosticResult {
  pulseStatus: PulseStatus;
  alertTriggered?: PatientStatus;
  severity?: AlertSeverity;
  alertMessage?: string;
  suggestedAction?: string;
}

/**
 * Evaluates pulse rate diagnostics with persistence filtering to avoid single noisy glitches
 */
export function evaluatePulseDiagnostics(
  pulseRate: number | null | undefined,
  recentLogs: PatientLogRecord[] = []
): PulseDiagnosticResult {
  const pulseStatus = evaluatePulseStatus(pulseRate);

  if (pulseStatus === 'NO PULSE DATA' || pulseRate === null || pulseRate === undefined || isNaN(pulseRate) || pulseRate <= 0) {
    return { pulseStatus: 'NO PULSE DATA' };
  }

  const bpm = Math.round(pulseRate);

  if (bpm < 60) {
    return {
      pulseStatus: 'ABNORMAL',
      alertTriggered: 'LOW_PULSE',
      severity: bpm < 45 ? 'CRITICAL' : 'WARNING',
      alertMessage: `Low Pulse Rate: ${bpm} BPM (Bradycardia). Normal range is 60–100 BPM.`,
      suggestedAction: 'Assess patient responsiveness, check pulse sensor attachment, and notify clinician.',
    };
  }

  if (bpm > 100) {
    return {
      pulseStatus: 'ABNORMAL',
      alertTriggered: 'HIGH_PULSE',
      severity: bpm > 130 ? 'CRITICAL' : 'WARNING',
      alertMessage: `High Pulse Rate: ${bpm} BPM (Tachycardia). Normal range is 60–100 BPM.`,
      suggestedAction: 'Verify patient vitals, check for distress or infusion side-effects, and alert healthcare staff.',
    };
  }

  return { pulseStatus: 'NORMAL' };
}

export function evaluatePatientDiagnostics(
  current: {
    volume: number;
    remainingPercentage: number;
    dripRate: number;
    flowRate: number;
    weight: number;
    sensorQuality: SensorQuality;
  },
  details: PatientDetails,
  recentLogs: PatientLogRecord[] = []
): DiagnosticResult {
  const { volume, remainingPercentage, dripRate, sensorQuality } = current;
  const prescribedDecimal = details.prescribedDripRate || 33.333;
  const upperToleranceLimit = prescribedDecimal * 1.20;

  // 1. Critical Low Volume (< 10%)
  if (remainingPercentage < 10 && volume >= 0) {
    return {
      status: 'CRITICAL_VOLUME',
      severity: 'CRITICAL',
      alertType: 'CRITICAL_VOLUME',
      alertMessage: `Critical Low IV Volume (<10%): ${Math.round(remainingPercentage)}% (${volume} mL remaining).`,
      suggestedAction: 'Immediate action required: Replace IV fluid container or discontinue infusion.',
    };
  }

  // 2. Possible Leakage (Volume decreasing while drip rate is 0 or very low <= 2 dpm)
  if (recentLogs.length >= 1 && dripRate <= 3 && volume > 0) {
    const prev = recentLogs[recentLogs.length - 1];
    const prevVol = prev.volume ?? (prev.weight ? Math.max(0, prev.weight - 30) : null);
    if (prevVol !== null && prevVol - volume >= 5) {
      return {
        status: 'POSSIBLE_LEAKAGE',
        severity: 'CRITICAL',
        alertType: 'POSSIBLE_LEAKAGE',
        alertMessage: `Possible IV Fluid Leakage: Volume dropped from ${prevVol} mL to ${volume} mL with low drop detection (${dripRate} dpm).`,
        suggestedAction: 'Inspect IV container, spike port, and infusion line joints for fluid leakage.',
      };
    }
  }

  // 3. Possible Occlusion / Blockage (Remaining volume present > 15 mL, drip rate stopped/near zero <= 2 dpm while prescribed >= 5 dpm)
  if (volume > 15 && dripRate <= 2 && prescribedDecimal >= 5) {
    return {
      status: 'POSSIBLE_OCCLUSION',
      severity: 'CRITICAL',
      alertType: 'POSSIBLE_OCCLUSION',
      alertMessage: `Possible Line Blockage/Occlusion: Fluid level unchanged (${volume} mL), but actual drip rate is 0 dpm.`,
      suggestedAction: 'Check IV tubing for kinks, roller clamp closure, or catheter occlusion.',
    };
  }

  // 4. Excessive Flow (Actual IR drip rate > prescribed drip rate * 1.20 tolerance)
  if (dripRate > upperToleranceLimit && volume > 10 && prescribedDecimal > 0) {
    return {
      status: 'POSSIBLE_EXCESSIVE_FLOW',
      severity: 'CRITICAL',
      alertType: 'POSSIBLE_EXCESSIVE_FLOW',
      alertMessage: `Excessive IV Flow Rate Detected: Actual ${Math.round(dripRate)} dpm exceeds upper limit of ${Math.round(upperToleranceLimit)} dpm (prescribed: ${Math.round(prescribedDecimal)} dpm).`,
      suggestedAction: 'Immediately adjust roller clamp or infusion regulator to prevent fluid overload.',
    };
  }

  // 5. Abnormal Sudden Drip Rate Shift (>40% deviation from recent baseline)
  if (recentLogs.length >= 2) {
    const recentDrips = recentLogs.slice(-3).map((r) => r.dripRate);
    const avgRecent = recentDrips.reduce((acc, d) => acc + d, 0) / recentDrips.length;
    if (avgRecent >= 6 && (Math.abs(dripRate - avgRecent) / avgRecent > 0.40 || Math.abs(dripRate - avgRecent) >= 15)) {
      return {
        status: 'ABNORMAL_FLOW',
        severity: 'WARNING',
        alertType: 'ABNORMAL_FLOW',
        alertMessage: `Abnormal Drip Rate Shift: Drip rate changed suddenly from ~${Math.round(avgRecent)} dpm to ${dripRate} dpm.`,
        suggestedAction: 'Inspect patient limb position and verify infusion set roller clamp stability.',
      };
    }
  }

  // 6. Low Volume Warning (10% < remainingPercentage <= 20%)
  if (remainingPercentage <= 20 && remainingPercentage >= 10) {
    return {
      status: 'LOW_VOLUME',
      severity: 'WARNING',
      alertType: 'LOW_VOLUME',
      alertMessage: `Low IV Fluid Level: ${Math.round(remainingPercentage)}% (${volume} mL remaining).`,
      suggestedAction: 'Prepare replacement IV bag and monitor infusion progress.',
    };
  }

  // 7. Sensor Unstable
  if (sensorQuality === 'UNSTABLE') {
    return {
      status: 'SENSOR_UNSTABLE',
      severity: 'WARNING',
      alertType: 'SENSOR_UNSTABLE',
      alertMessage: 'Sensor reading unstable — excessive fluctuation detected on load cell.',
      suggestedAction: 'Ensure load cell fixture is level and free from mechanical vibrations.',
    };
  }

  return {
    status: 'NORMAL',
    severity: 'INFO',
  };
}

// Web Audio API medical chime synthesizer
let audioCtx: AudioContext | null = null;

export function playAlertChime(type: 'CRITICAL' | 'WARNING' | 'ACK') {
  try {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    if (!audioCtx || audioCtx.state === 'suspended') {
      audioCtx = new AudioContextClass();
    }

    if (type === 'CRITICAL') {
      // 3-tone urgent medical chime (A5, C6, E6)
      const tones = [880, 1046.5, 1318.5];
      tones.forEach((freq, idx) => {
        const osc = audioCtx!.createOscillator();
        const gain = audioCtx!.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, audioCtx!.currentTime + idx * 0.12);
        gain.gain.setValueAtTime(0.18, audioCtx!.currentTime + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx!.currentTime + idx * 0.12 + 0.28);
        osc.connect(gain);
        gain.connect(audioCtx!.destination);
        osc.start(audioCtx!.currentTime + idx * 0.12);
        osc.stop(audioCtx!.currentTime + idx * 0.12 + 0.3);
      });
    } else if (type === 'WARNING') {
      // 2-tone soft warning chime (G5, B5)
      const tones = [784, 987.77];
      tones.forEach((freq, idx) => {
        const osc = audioCtx!.createOscillator();
        const gain = audioCtx!.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, audioCtx!.currentTime + idx * 0.15);
        gain.gain.setValueAtTime(0.12, audioCtx!.currentTime + idx * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx!.currentTime + idx * 0.15 + 0.25);
        osc.connect(gain);
        gain.connect(audioCtx!.destination);
        osc.start(audioCtx!.currentTime + idx * 0.15);
        osc.stop(audioCtx!.currentTime + idx * 0.15 + 0.28);
      });
    } else {
      // Single gentle acknowledgement click tone
      const osc = audioCtx!.createOscillator();
      const gain = audioCtx!.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, audioCtx!.currentTime);
      gain.gain.setValueAtTime(0.08, audioCtx!.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx!.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(audioCtx!.destination);
      osc.start(audioCtx!.currentTime);
      osc.stop(audioCtx!.currentTime + 0.1);
    }
  } catch {
    // Gracefully ignore audio autoplay restrictions
  }
}

/**
 * Strict Input -> Output calculation engine:
 * 1. Read loadCell from input, details (tare, calibrationFactor, initialVolume)
 * 2. Calculate remainingVolume and remainingPercentage
 * 3. Read irSensor from input, calculate dropCount, dripRate, flowRate, eta
 * 4. Read pulseSensor from input, calculate heartRate, spo2, pulseStatus
 * 5. Calculate ivStatus
 * 6. Return PatientOutput
 */
export function calculatePatientOutput(
  details: PatientDetails,
  input: PatientInput,
  previousOutput?: PatientOutput
): PatientOutput {
  // ==========================================
  // INPUTS & CONSTANTS
  // ==========================================
  const tareWeight = typeof details.tareWeight === 'number' ? details.tareWeight : 0;
  const calibrationFactor =
    typeof details.calibrationFactor === 'number' && details.calibrationFactor > 0
      ? details.calibrationFactor
      : 1.0;

  // 1. INITIAL IV VOLUME
  const initialVolumeML = typeof details.initialVolume === 'number' && details.initialVolume > 0
    ? details.initialVolume
    : 500;

  // 7. DROP FACTOR
  const dropFactor = typeof details.dropFactor === 'number' && details.dropFactor > 0
    ? details.dropFactor
    : 20;

  const prescribedDripRate = typeof details.prescribedDripRate === 'number' && details.prescribedDripRate > 0
    ? details.prescribedDripRate
    : 0;

  // ==========================================
  // LOAD CELL & VOLUME CALCULATIONS
  // ==========================================
  let weightValue: number | null = null;
  if (typeof (input as any)?.loadCell === 'number') {
    weightValue = (input as any).loadCell;
  } else if (input?.loadCell && typeof input.loadCell === 'object') {
    if (typeof input.loadCell.weight === 'number') {
      weightValue = input.loadCell.weight;
    } else if (typeof input.loadCell.rawValue === 'number') {
      weightValue = input.loadCell.rawValue;
    }
  } else if (typeof (input as any)?.weight === 'number') {
    weightValue = (input as any).weight;
  }

  // 2. REMAINING IV VOLUME (using load cell)
  // Formula: remainingVolumeML = calibratedLoadCellVolumeML
  let remainingVolumeML = 0;
  if (weightValue !== null && !isNaN(weightValue)) {
    const netWeight = Math.max(0, weightValue - tareWeight);
    const calibratedLoadCellVolumeML = netWeight / calibrationFactor;
    remainingVolumeML = Math.min(initialVolumeML, Math.max(0, Math.round(calibratedLoadCellVolumeML * 10) / 10));
  } else if (previousOutput && typeof previousOutput.remainingVolume === 'number') {
    remainingVolumeML = previousOutput.remainingVolume;
  } else {
    remainingVolumeML = initialVolumeML;
  }

  // 3. INFUSED VOLUME
  // Formula: infusedVolumeML = initialVolumeML - remainingVolumeML
  const infusedVolumeML = Math.max(0, Math.round((initialVolumeML - remainingVolumeML) * 10) / 10);

  // 4. REMAINING PERCENTAGE
  // Formula: remainingPercentage = (remainingVolumeML / initialVolumeML) * 100
  let remainingPercentage = 0;
  if (initialVolumeML > 0) {
    remainingPercentage = Math.min(
      100,
      Math.max(0, Math.round(((remainingVolumeML / initialVolumeML) * 100) * 10) / 10)
    );
  }

  // ==========================================
  // IR SENSOR & DRIP RATE CALCULATIONS
  // ==========================================
  // 5. TOTAL DROPS
  // Formula: totalDropsCount = currentIRSensorDropCount
  const totalDropsCount = Number(input?.irSensor?.dropCount ?? 0);

  // 6. ACTUAL DPM (DROPS PER MINUTE)
  // Derived strictly from the manually entered dripRate in Firebase Realtime Database.
  // The ESP32 must not send, calculate, update, or overwrite this value.
  const actualDPM: number | null = (input?.irSensor?.dripRate !== undefined && input?.irSensor?.dripRate !== null)
    ? Number(input.irSensor.dripRate)
    : null;

  // ==========================================
  // FLOW RATE & DEVIATION CALCULATIONS
  // ==========================================
  // 8. ACTUAL FLOW RATE (mL/h)
  // Formula: actualFlowRateMLH = (actualDPM * 60) / dropFactor
  const actualFlowRateMLH = (actualDPM !== null && actualDPM !== undefined && actualDPM > 0 && dropFactor > 0)
    ? Math.round(((actualDPM * 60) / dropFactor) * 10) / 10
    : null;

  // 9. PRESCRIBED FLOW RATE (mL/h)
  // Formula: prescribedFlowRateMLH = (prescribedDripRate * 60) / dropFactor
  const prescribedFlowRateMLH = dropFactor > 0 ? Math.round(((prescribedDripRate * 60) / dropFactor) * 10) / 10 : 0;

  // 10. FLOW RATE DEVIATION (%)
  // Formula: flowDeviationPercentage = ((actualFlowRateMLH - prescribedFlowRateMLH) / prescribedFlowRateMLH) * 100
  let flowDeviationPercentage: number | string = '--';
  if (actualFlowRateMLH !== null && actualFlowRateMLH !== undefined && prescribedFlowRateMLH > 0) {
    flowDeviationPercentage = Math.round(((actualFlowRateMLH - prescribedFlowRateMLH) / prescribedFlowRateMLH) * 100 * 10) / 10;
  }

  // ==========================================
  // 12. ESTIMATED TIME OF ARRIVAL (ETA)
  // Formula: etaHours = remainingVolumeML / actualFlowRateMLH (formatted as X hr Y min)
  // ==========================================
  const eta = calculateETA(remainingVolumeML, actualFlowRateMLH);

  // ==========================================
  // PULSE SENSOR & HEART RATE CALCULATIONS
  // ==========================================
  let heartRateRaw = 0;
  let spo2Raw = 0;
  let pulseStatusSignal = input?.pulseSensor?.sensorStatus || 'NO_SIGNAL';

  if (typeof (input as any)?.pulseSensor === 'number') {
    heartRateRaw = (input as any).pulseSensor;
    spo2Raw = 98;
    pulseStatusSignal = 'GOOD';
  } else if (input?.pulseSensor && typeof input.pulseSensor === 'object') {
    heartRateRaw =
      typeof input.pulseSensor.heartRateRaw === 'number'
        ? input.pulseSensor.heartRateRaw
        : typeof (input.pulseSensor as any).heartRate === 'number'
        ? (input.pulseSensor as any).heartRate
        : typeof (input.pulseSensor as any).pulseRate === 'number'
        ? (input.pulseSensor as any).pulseRate
        : 0;
    spo2Raw =
      typeof input.pulseSensor.spo2Raw === 'number'
        ? input.pulseSensor.spo2Raw
        : typeof (input.pulseSensor as any).spo2 === 'number'
        ? (input.pulseSensor as any).spo2
        : 0;
    pulseStatusSignal = input.pulseSensor.sensorStatus || (heartRateRaw > 0 ? 'GOOD' : 'NO_SIGNAL');
  } else if (typeof (input as any)?.heartRate === 'number') {
    heartRateRaw = (input as any).heartRate;
    pulseStatusSignal = 'GOOD';
  } else if (typeof (input as any)?.pulseRate === 'number') {
    heartRateRaw = (input as any).pulseRate;
    pulseStatusSignal = 'GOOD';
  }

  let heartRate = 0;
  let pulseStatus: PulseStatus = 'NO_PULSE_DATA';
  let spo2 = 0;

  if (heartRateRaw > 0 && pulseStatusSignal !== 'NO_SIGNAL') {
    heartRate = Math.round(heartRateRaw);
    if (heartRate >= 60 && heartRate <= 100) {
      pulseStatus = 'NORMAL';
    } else {
      pulseStatus = 'ABNORMAL';
    }
  } else {
    heartRate = 0;
    pulseStatus = 'NO_PULSE_DATA';
  }

  if (spo2Raw > 0 && pulseStatusSignal !== 'NO_SIGNAL') {
    spo2 = Math.min(100, Math.max(0, Math.round(spo2Raw)));
  } else if (spo2Raw > 0) {
    spo2 = Math.min(100, Math.max(0, Math.round(spo2Raw)));
  } else {
    spo2 = 0;
  }

  // ==========================================
  // 11. FLOW STATUS / IV STATUS LOGIC
  // Tolerance limits: ±15% of prescribed flow rate
  // ==========================================
  let ivStatus: PatientStatus = 'NORMAL';
  let flowStatusLabel = 'Normal Flow';

  const deviationVal = typeof flowDeviationPercentage === 'number' ? flowDeviationPercentage : 0;

  if (details.monitoring === false) {
    ivStatus = 'MONITORING_STOPPED';
    pulseStatus = 'STOPPED';
    flowStatusLabel = 'STOPPED';
  } else if (
    (input?.lastUpdated === 0 || !input?.lastUpdated) &&
    (weightValue === null || weightValue === 0) &&
    totalDropsCount === 0 &&
    heartRate === 0
  ) {
    ivStatus = 'NO_DATA';
    flowStatusLabel = 'No Data';
  } else if (input?.esp32Status === 'DISCONNECTED') {
    ivStatus = 'ESP32_DISCONNECTED';
    flowStatusLabel = 'ESP32 Disconnected';
  } else if (remainingPercentage < 10 && remainingVolumeML >= 0) {
    ivStatus = 'CRITICAL_VOLUME';
    flowStatusLabel = 'Critical Volume';
  } else if (remainingVolumeML > 15 && actualDPM <= 2 && prescribedDripRate >= 5) {
    ivStatus = 'POSSIBLE_OCCLUSION';
    flowStatusLabel = 'POSSIBLE OCCLUSION';
  } else if (
    deviationVal > 15 &&
    remainingVolumeML > 10 &&
    prescribedDripRate > 0
  ) {
    ivStatus = 'POSSIBLE_EXCESSIVE_FLOW';
    flowStatusLabel = 'Excessive Flow';
  } else if (deviationVal < -15 && remainingVolumeML > 10 && prescribedDripRate > 0) {
    ivStatus = 'ABNORMAL_FLOW'; // Low Flow
    flowStatusLabel = 'Low Flow';
  } else if (remainingPercentage <= 20 && remainingPercentage >= 10) {
    ivStatus = 'LOW_VOLUME';
    flowStatusLabel = 'Low Volume Warning';
  } else {
    ivStatus = 'NORMAL';
    flowStatusLabel = 'Normal Flow';
  }

  // ==========================================
  // RETURN NORMALIZED PATIENT OUTPUT
  // ==========================================
  return {
    remainingVolume: remainingVolumeML,
    remainingPercentage,
    dropCount: totalDropsCount,
    dripRate: actualDPM,
    flowRate: actualFlowRateMLH,
    eta,
    heartRate,
    spo2,
    ivStatus,
    pulseStatus,
    lastCalculated: Date.now(),
    // Standard IV Monitoring parameters
    initialVolumeML,
    remainingVolumeML,
    infusedVolumeML,
    totalDropsCount,
    actualDPM,
    dropFactor,
    actualFlowRateMLH,
    prescribedFlowRateMLH,
    flowDeviationPercentage,
    flowStatus: flowStatusLabel,
  };
}
