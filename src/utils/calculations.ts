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
  CRITICAL_VOLUME: 1,
  POSSIBLE_OCCLUSION: 2,
  POSSIBLE_EXCESSIVE_FLOW: 3,
  POSSIBLE_LEAKAGE: 4,
  ABNORMAL_FLOW: 5,
  ABNORMAL: 6,
  HIGH_PULSE: 7,
  LOW_PULSE: 8,
  LOW_VOLUME: 9,
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

export function calculateFlowRate(dripRate: number, dropFactor: number): number {
  if (!dropFactor || dropFactor <= 0 || !dripRate || dripRate <= 0) return 0;
  // Flow Rate (mL/min) = dripRate / dropFactor
  // Flow Rate (mL/hour) = (dripRate / dropFactor) * 60
  return Math.round(((dripRate / dropFactor) * 60) * 10) / 10;
}

export function calculateETAMinutes(
  remainingVolume: number,
  flowRate: number
): number | null {
  if (flowRate <= 0.05 || remainingVolume <= 0) {
    return null;
  }
  // flowRate is in mL/hour -> ETA (minutes) = (remainingVolume / flowRate) * 60
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
  return `${pad(hours)}:${pad(mins)}`;
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
  const prescribed = details.prescribedDripRate || 20;

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

  // 2. Possible Leakage (Volume decreasing while drip rate is very low or near zero <= 2 dpm)
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
  if (volume > 15 && dripRate <= 2 && prescribed >= 5) {
    return {
      status: 'POSSIBLE_OCCLUSION',
      severity: 'CRITICAL',
      alertType: 'POSSIBLE_OCCLUSION',
      alertMessage: `Possible Line Blockage/Occlusion: Fluid remains (${volume} mL), but detected drip rate is stopped (${dripRate} dpm).`,
      suggestedAction: 'Check IV tubing for kinks, roller clamp closure, or catheter occlusion.',
    };
  }

  // 4. Possible Excessive Flow (Drip rate significantly higher than prescribed rate)
  if (dripRate > Math.max(30, prescribed * 1.35) && volume > 10) {
    return {
      status: 'POSSIBLE_EXCESSIVE_FLOW',
      severity: 'CRITICAL',
      alertType: 'POSSIBLE_EXCESSIVE_FLOW',
      alertMessage: `Excessive IV Flow Rate Detected: ${dripRate} dpm (prescribed: ${prescribed} dpm).`,
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
  const tareWeight = typeof details.tareWeight === 'number' ? details.tareWeight : 30;
  const calibrationFactor =
    typeof details.calibrationFactor === 'number' && details.calibrationFactor > 0
      ? details.calibrationFactor
      : 1.0;
  const initialVolume =
    typeof details.initialVolume === 'number' && details.initialVolume > 0
      ? details.initialVolume
      : 500;
  const dropFactor =
    typeof details.dropFactor === 'number' && details.dropFactor > 0 ? details.dropFactor : 20;

  // 1. Load Cell Calculations
  let rawWeight = 0;
  if (typeof (input as any)?.loadCell === 'number') {
    rawWeight = (input as any).loadCell;
  } else if (typeof input?.loadCell?.weight === 'number' && input.loadCell.weight > 0) {
    rawWeight = input.loadCell.weight;
  } else if (typeof input?.loadCell?.rawValue === 'number' && input.loadCell.rawValue > 0) {
    rawWeight = input.loadCell.rawValue;
  } else if (typeof (input as any)?.weight === 'number') {
    rawWeight = (input as any).weight;
  }

  let remainingVolume = 0;
  let remainingPercentage = 0;

  if (rawWeight > 0) {
    const netWeight = Math.max(0, rawWeight - tareWeight);
    const calculatedVolume = netWeight / calibrationFactor;
    remainingVolume = Math.min(initialVolume, Math.max(0, Math.round(calculatedVolume * 10) / 10));
    remainingPercentage = Math.min(
      100,
      Math.max(0, Math.round(((remainingVolume / initialVolume) * 100) * 10) / 10)
    );
  } else if (
    (input?.lastUpdated === 0 || !input?.lastUpdated) &&
    (!input?.esp32Status || input.esp32Status === 'DISCONNECTED')
  ) {
    remainingVolume = 0;
    remainingPercentage = 0;
  } else if (previousOutput && previousOutput.remainingVolume > 0) {
    remainingVolume = previousOutput.remainingVolume;
    remainingPercentage = previousOutput.remainingPercentage;
  }

  // 2. IR Sensor Calculations
  let dropCount = 0;
  let dripRate = 0;

  if (typeof (input as any)?.irSensor === 'number') {
    dripRate = (input as any).irSensor;
    dropCount = (input as any).irSensor;
  } else if (input?.irSensor && typeof input.irSensor === 'object') {
    dropCount = typeof input.irSensor.dropCount === 'number' ? Math.max(0, input.irSensor.dropCount) : 0;
    if (typeof (input.irSensor as any).dripRate === 'number') {
      dripRate = (input.irSensor as any).dripRate;
    } else if (typeof (input.irSensor as any).dropRate === 'number') {
      dripRate = (input.irSensor as any).dropRate;
    }
  } else if (typeof (input as any)?.dripRate === 'number') {
    dripRate = (input as any).dripRate;
  } else if (typeof (input as any)?.dropRate === 'number') {
    dripRate = (input as any).dropRate;
  }

  const irStatus = input?.irSensor?.sensorStatus || (dripRate > 0 || dropCount > 0 ? 'GOOD' : 'NO_SIGNAL');

  if (dripRate === 0 && dropCount > 0) {
    if (
      previousOutput &&
      previousOutput.dropCount > 0 &&
      input?.irSensor?.lastDropTimestamp &&
      previousOutput.lastCalculated
    ) {
      const deltaDrops = dropCount - previousOutput.dropCount;
      const deltaMs = input.irSensor.lastDropTimestamp - previousOutput.lastCalculated;
      if (deltaDrops > 0 && deltaMs > 500 && deltaMs < 180000) {
        dripRate = Math.round(deltaDrops / (deltaMs / 60000));
      } else if (previousOutput.dripRate > 0) {
        dripRate = previousOutput.dripRate;
      }
    } else if (previousOutput?.dripRate && previousOutput.dripRate > 0) {
      dripRate = previousOutput.dripRate;
    } else {
      dripRate = details.prescribedDripRate || 20;
    }
  }

  // flowRate in mL/hour: (dripRate / dropFactor) * 60
  const flowRate = dripRate > 0 ? calculateFlowRate(dripRate, dropFactor) : 0;

  // ETA Calculation (in hours: remainingVolume / flowRate_mL_per_hour -> in minutes: (remainingVolume / flowRate) * 60)
  let eta = '--';
  if (flowRate > 0.05 && remainingVolume > 0) {
    const totalMinutes = Math.round((remainingVolume / flowRate) * 60);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    eta = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  // 3. Pulse Sensor Calculations
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

  // 4. IV Status Logic
  let ivStatus: PatientStatus = 'NORMAL';
  if (details.monitoring === false) {
    ivStatus = 'MONITORING_STOPPED';
    pulseStatus = 'STOPPED';
  } else if (
    (input?.lastUpdated === 0 || !input?.lastUpdated) &&
    rawWeight === 0 &&
    dropCount === 0 &&
    heartRate === 0
  ) {
    ivStatus = 'NO_DATA';
  } else if (input?.esp32Status === 'DISCONNECTED') {
    ivStatus = 'ESP32_DISCONNECTED';
  } else if (remainingPercentage < 10 && remainingVolume >= 0) {
    ivStatus = 'CRITICAL_VOLUME';
  } else if (remainingVolume > 15 && dripRate <= 2 && (details.prescribedDripRate || 0) >= 5) {
    ivStatus = 'POSSIBLE_OCCLUSION';
  } else if (
    dripRate > Math.max(30, (details.prescribedDripRate || 0) * 1.35) &&
    remainingVolume > 10
  ) {
    ivStatus = 'POSSIBLE_EXCESSIVE_FLOW';
  } else if (remainingPercentage <= 20 && remainingPercentage >= 10) {
    ivStatus = 'LOW_VOLUME';
  } else {
    ivStatus = 'NORMAL';
  }

  return {
    remainingVolume,
    remainingPercentage,
    dropCount,
    dripRate,
    flowRate,
    eta,
    heartRate,
    spo2,
    ivStatus,
    pulseStatus,
    lastCalculated: Date.now(),
  };
}
