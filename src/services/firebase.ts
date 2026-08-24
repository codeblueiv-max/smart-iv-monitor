import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getDatabase,
  ref,
  onValue,
  set,
  update,
  push,
  get,
  Database,
  Unsubscribe,
} from 'firebase/database';
import { getAuth, Auth, signInAnonymously } from 'firebase/auth';
import {
  Patient,
  PatientInput,
  PatientOutput,
  SensorReading,
  PatientLogRecord,
  Alert,
  BedCalibration,
  ConnectionState,
  SensorQuality,
  PatientStatus,
  PulseStatus,
  PulseSensorQuality,
} from '../types';

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  databaseURL: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export interface FirebaseValidationResult {
  isValid: boolean;
  missingKeys: string[];
  config: FirebaseConfig;
}

const STORAGE_KEY_FIREBASE_CONFIG = 'smart_iv_firebase_config';

/**
 * Sanitizes the Database URL to ensure it points strictly to the root of the Firebase Realtime Database
 * (e.g. `https://database-name.firebaseio.com` or `https://database-name.region.firebasedatabase.app`),
 * stripping any inadvertent child paths (like `/patients` or `/patients/bed_205/current`) or trailing slashes.
 */
export function sanitizeDatabaseURL(rawUrl: string): string {
  if (!rawUrl) return '';
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';

  try {
    const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    // Realtime Database URL root must only contain protocol + origin (and search query for local emulator if present)
    if (parsed.search) {
      return `${parsed.origin}${parsed.search}`;
    }
    return parsed.origin;
  } catch {
    // Fallback: match up to the first single slash after http(s)://
    const match = trimmed.match(/^(https?:\/\/[^\/]+)/i);
    if (match) {
      return match[1];
    }
    return trimmed.replace(/\/+$/, '');
  }
}

/**
 * Recursively cleans payloads for Firebase Realtime Database.
 * Firebase throws a fatal error if any property in an object is `undefined`.
 * This replaces `undefined` with `null` or omits it from objects.
 */
export function cleanFirebasePayload<T>(obj: T): any {
  if (obj === undefined) {
    return null;
  }
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => (item === undefined ? null : cleanFirebasePayload(item)));
  }
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      cleaned[key] = cleanFirebasePayload(value);
    } else {
      cleaned[key] = null;
    }
  }
  return cleaned;
}

/**
 * Normalizes input object from Firebase node or legacy flat format
 */
export function normalizePatientInput(raw: any): PatientInput {
  if (!raw || typeof raw !== 'object') {
    return {
      esp32Status: 'DISCONNECTED',
      lastUpdated: 0,
      loadCell: { rawValue: 0, weight: 0 },
      irSensor: { dropCount: 0, lastDropTimestamp: 0, sensorStatus: 'NO_SIGNAL' },
      pulseSensor: { heartRateRaw: 0, spo2Raw: 0, sensorStatus: 'NO_SIGNAL' },
    };
  }

  const esp32Status: ConnectionState =
    raw.esp32Status === 'CONNECTED' || raw.esp32Status === 'UNSTABLE'
      ? raw.esp32Status
      : 'DISCONNECTED';

  const lastUpdated = Number(raw.lastUpdated || raw.timestamp) || 0;

  // Load Cell
  let rawValue = 0;
  let weight = 0;
  if (typeof raw.loadCell === 'number') {
    rawValue = raw.loadCell;
    weight = raw.loadCell;
  } else if (raw.loadCell && typeof raw.loadCell === 'object') {
    rawValue = Number(raw.loadCell.rawValue ?? raw.loadCell.weight) || 0;
    weight = Number(raw.loadCell.weight ?? raw.loadCell.rawValue) || 0;
  } else {
    rawValue = Number(raw.loadCellRaw ?? raw.weight) || 0;
    weight = Number(raw.loadCellWeight ?? raw.weight ?? raw.loadCellRaw) || 0;
  }

  // IR Sensor
  let dropCount = 0;
  let lastDropTimestamp = 0;
  let irSensorStatus = 'NO_SIGNAL';
  if (typeof raw.irSensor === 'number') {
    dropCount = raw.irSensor;
    lastDropTimestamp = Date.now();
    irSensorStatus = raw.irSensor > 0 ? 'GOOD' : 'NO_SIGNAL';
  } else if (raw.irSensor && typeof raw.irSensor === 'object') {
    dropCount = Number(raw.irSensor.dropCount ?? raw.irSensor.dripRate ?? raw.irSensor.dropRate) || 0;
    lastDropTimestamp = Number(raw.irSensor.lastDropTimestamp || raw.lastUpdated || Date.now()) || 0;
    irSensorStatus = raw.irSensor.sensorStatus || (dropCount > 0 ? 'GOOD' : 'NO_SIGNAL');
  } else {
    dropCount = Number(raw.dropCount ?? raw.irDropCount ?? raw.totalDrops ?? raw.dripRate ?? raw.dropRate) || 0;
    lastDropTimestamp = Number(raw.lastDropTimestamp || raw.timestamp || raw.lastUpdated) || 0;
    irSensorStatus = raw.sensorQuality || (dropCount > 0 ? 'GOOD' : 'NO_SIGNAL');
  }

  // Pulse Sensor
  let heartRateRaw = 0;
  let spo2Raw = 0;
  let pulseSensorStatus = 'NO_SIGNAL';
  if (typeof raw.pulseSensor === 'number') {
    heartRateRaw = raw.pulseSensor;
    spo2Raw = 98;
    pulseSensorStatus = raw.pulseSensor > 0 ? 'GOOD' : 'NO_SIGNAL';
  } else if (raw.pulseSensor && typeof raw.pulseSensor === 'object') {
    heartRateRaw = Number(raw.pulseSensor.heartRateRaw ?? raw.pulseSensor.heartRate ?? raw.pulseSensor.pulseRate ?? raw.pulseSensor.pulseBpm) || 0;
    spo2Raw = Number(raw.pulseSensor.spo2Raw ?? raw.pulseSensor.spo2 ?? raw.pulseSensor.spO2) || 0;
    pulseSensorStatus = raw.pulseSensor.sensorStatus || (heartRateRaw > 0 ? 'GOOD' : 'NO_SIGNAL');
  } else {
    heartRateRaw = Number(raw.pulseBpm ?? raw.pulseRate ?? raw.pulse ?? raw.heartRate) || 0;
    spo2Raw = Number(raw.spo2 ?? raw.spO2 ?? raw.SpO2) || 0;
    pulseSensorStatus = raw.pulseSensorQuality || (heartRateRaw > 0 ? 'GOOD' : 'NO_SIGNAL');
  }

  return {
    esp32Status,
    lastUpdated,
    loadCell: { rawValue, weight },
    irSensor: { dropCount, lastDropTimestamp, sensorStatus: irSensorStatus },
    pulseSensor: { heartRateRaw, spo2Raw, sensorStatus: pulseSensorStatus },
  };
}

/**
 * Normalizes output object from Firebase node or legacy flat format
 */
export function normalizePatientOutput(raw: any, initialVolume = 500): PatientOutput {
  if (!raw || typeof raw !== 'object') {
    return {
      remainingVolume: 0,
      remainingPercentage: 0,
      dropCount: 0,
      dripRate: 0,
      flowRate: 0,
      eta: '--',
      heartRate: 0,
      spo2: 0,
      ivStatus: 'NO_DATA',
      pulseStatus: 'NO_PULSE_DATA',
      lastCalculated: 0,
    };
  }

  const remainingVolume = Number(raw.remainingVolume ?? raw.volume) || 0;
  const remainingPercentage =
    typeof raw.remainingPercentage === 'number'
      ? raw.remainingPercentage
      : typeof raw.remainingPercent === 'number'
      ? raw.remainingPercent
      : initialVolume > 0
      ? Math.round(((remainingVolume / initialVolume) * 100) * 10) / 10
      : 0;

  const dropCount = Number(raw.dropCount ?? raw.irDropCount ?? raw.totalDrops) || 0;
  const dripRate = Number(raw.dripRate ?? raw.dropRate) || 0;
  const flowRate = Number(raw.flowRate) || 0;
  const eta = raw.eta ? String(raw.eta) : raw.etaMinutes ? `${Math.floor(raw.etaMinutes / 60).toString().padStart(2, '0')}:${(raw.etaMinutes % 60).toString().padStart(2, '0')}` : '--';

  const heartRate = Number(raw.heartRate ?? raw.pulseRate ?? raw.pulseBpm ?? raw.pulse) || 0;
  const spo2 = Number(raw.spo2 ?? raw.spO2) || 0;
  const ivStatus: PatientStatus = (raw.ivStatus || raw.status || 'NO_DATA') as PatientStatus;
  const pulseStatus: PulseStatus = (raw.pulseStatus || (heartRate > 0 ? (heartRate >= 60 && heartRate <= 100 ? 'NORMAL' : 'ABNORMAL') : 'NO_PULSE_DATA')) as PulseStatus;
  const lastCalculated = Number(raw.lastCalculated) || 0;

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
    lastCalculated,
  };
}

/**
 * Retrieves Firebase configuration from Vite environment variables (VITE_FIREBASE_*)
 * with fallback to user-configured overrides stored in localStorage.
 */
export function getSavedFirebaseConfig(): FirebaseConfig {
  const envConfig: FirebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
    databaseURL: sanitizeDatabaseURL(import.meta.env.VITE_FIREBASE_DATABASE_URL || ''),
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
  };

  try {
    const saved = localStorage.getItem(STORAGE_KEY_FIREBASE_CONFIG);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        apiKey: parsed.apiKey || envConfig.apiKey,
        authDomain: parsed.authDomain || envConfig.authDomain,
        databaseURL: sanitizeDatabaseURL(parsed.databaseURL || envConfig.databaseURL),
        projectId: parsed.projectId || envConfig.projectId,
        storageBucket: parsed.storageBucket || envConfig.storageBucket,
        messagingSenderId: parsed.messagingSenderId || envConfig.messagingSenderId,
        appId: parsed.appId || envConfig.appId,
      };
    }
  } catch (e) {
    console.error('Failed to parse saved firebase config', e);
  }

  return envConfig;
}

/**
 * Validates whether all mandatory configuration properties for Firebase RTDB are present and valid.
 */
export function validateFirebaseConfig(config?: FirebaseConfig): FirebaseValidationResult {
  const cfg = config ? { ...config } : getSavedFirebaseConfig();
  cfg.databaseURL = sanitizeDatabaseURL(cfg.databaseURL);
  const missingKeys: string[] = [];

  if (!cfg.apiKey || cfg.apiKey.trim() === '' || cfg.apiKey.includes('MY_API_KEY')) {
    missingKeys.push('VITE_FIREBASE_API_KEY');
  }

  if (
    !cfg.databaseURL ||
    cfg.databaseURL.trim() === '' ||
    cfg.databaseURL.includes('your-project-default') ||
    !cfg.databaseURL.startsWith('https://')
  ) {
    missingKeys.push('VITE_FIREBASE_DATABASE_URL');
  }

  if (!cfg.projectId || cfg.projectId.trim() === '') {
    missingKeys.push('VITE_FIREBASE_PROJECT_ID');
  }

  return {
    isValid: missingKeys.length === 0,
    missingKeys,
    config: cfg,
  };
}

export function saveFirebaseConfig(config: Partial<FirebaseConfig>) {
  try {
    const current = getSavedFirebaseConfig();
    const merged = {
      ...current,
      ...config,
      databaseURL: config.databaseURL ? sanitizeDatabaseURL(config.databaseURL) : current.databaseURL,
    };
    localStorage.setItem(STORAGE_KEY_FIREBASE_CONFIG, JSON.stringify(merged));
  } catch (e) {
    console.error('Failed to save firebase config', e);
  }
}

let firebaseApp: FirebaseApp | null = null;
let rtdb: Database | null = null;
let authInstance: Auth | null = null;

export function initializeFirebase(customConfig?: FirebaseConfig): {
  app: FirebaseApp | null;
  db: Database | null;
  auth: Auth | null;
  isConfigured: boolean;
  validation: FirebaseValidationResult;
} {
  const validation = validateFirebaseConfig(customConfig);
  const config = { ...validation.config, databaseURL: sanitizeDatabaseURL(validation.config.databaseURL) };

  if (!validation.isValid) {
    return { app: null, db: null, auth: null, isConfigured: false, validation };
  }

  try {
    if (!getApps().length) {
      firebaseApp = initializeApp(config);
    } else {
      firebaseApp = getApp();
    }

    try {
      rtdb = getDatabase(firebaseApp, config.databaseURL);
    } catch (dbErr) {
      console.warn('Realtime database initialization note:', dbErr);
      rtdb = getDatabase(firebaseApp);
    }

    try {
      authInstance = getAuth(firebaseApp);
      signInAnonymously(authInstance).catch((authErr) => {
        console.info('Firebase anonymous auth note:', authErr?.message || authErr);
      });
    } catch {
      // Auth is optional
    }

    return {
      app: firebaseApp,
      db: rtdb,
      auth: authInstance,
      isConfigured: true,
      validation,
    };
  } catch (error) {
    console.warn('Firebase initialization note:', error);
    return { app: null, db: null, auth: null, isConfigured: false, validation };
  }
}

/**
 * Listens to Realtime Database connection state using Firebase's `.info/connected` heartbeat.
 */
export function subscribeToFirebaseConnectionState(
  onStateChange: (isConnected: boolean) => void
): Unsubscribe | null {
  if (!rtdb) return null;
  try {
    const connectedRef = ref(rtdb, '.info/connected');
    return onValue(connectedRef, (snap) => {
      onStateChange(Boolean(snap.val()));
    });
  } catch (e) {
    console.warn('Could not subscribe to .info/connected', e);
    return null;
  }
}

/**
 * Real-time listener for the entire `/patients` collection in Firebase.
 */
export function subscribeToAllPatients(
  onData: (patientsData: Record<string, any>) => void
): Unsubscribe | null {
  if (!rtdb) return null;
  try {
    const patientsRef = ref(rtdb, 'patients');
    return onValue(patientsRef, (snapshot) => {
      if (snapshot.exists()) {
        onData(snapshot.val());
      }
    });
  } catch (e) {
    console.warn('Could not subscribe to all patients', e);
    return null;
  }
}

/**
 * Real-time listener for patient sensor INPUT (`/patients/{patientId}/input`).
 */
export function subscribeToPatientInput(
  patientId: string,
  onData: (input: PatientInput) => void
): Unsubscribe | null {
  if (!rtdb) return null;
  try {
    const inputRef = ref(rtdb, `patients/${patientId}/input`);
    return onValue(inputRef, (snapshot) => {
      if (snapshot.exists()) {
        onData(normalizePatientInput(snapshot.val()));
      }
    });
  } catch (e) {
    console.warn(`Could not subscribe to patient input for ${patientId}`, e);
    return null;
  }
}

/**
 * Real-time listener for patient calculated OUTPUT (`/patients/{patientId}/output`).
 */
export function subscribeToPatientOutput(
  patientId: string,
  onData: (output: PatientOutput) => void
): Unsubscribe | null {
  if (!rtdb) return null;
  try {
    const outputRef = ref(rtdb, `patients/${patientId}/output`);
    return onValue(outputRef, (snapshot) => {
      if (snapshot.exists()) {
        onData(normalizePatientOutput(snapshot.val()));
      }
    });
  } catch (e) {
    console.warn(`Could not subscribe to patient output for ${patientId}`, e);
    return null;
  }
}

/**
 * Writes the complete strict structure for a new patient to Firebase RTDB:
 * patients/{patientId}/details
 * patients/{patientId}/input
 * patients/{patientId}/output
 */
export async function writePatientToFirebase(patient: Patient): Promise<boolean> {
  if (!rtdb) {
    const initialized = initializeFirebase();
    if (!initialized.isConfigured || !rtdb) {
      const validation = validateFirebaseConfig();
      const missing = validation.missingKeys.length > 0
        ? `Firebase is not configured. Missing: ${validation.missingKeys.join(', ')}.`
        : 'Firebase Realtime Database is not configured.';
      throw new Error(`${missing} Please configure Firebase connection in Settings.`);
    }
  }

  try {
    const patientRef = ref(rtdb, `patients/${patient.details.id}`);
    const payload = cleanFirebasePayload({
      details: {
        id: patient.details.id,
        patientName: patient.details.patientName,
        bedNo: patient.details.bedNo,
        initialVolume: patient.details.initialVolume,
        fluidType: patient.details.fluidType,
        prescribedDripRate: patient.details.prescribedDripRate,
        dropFactor: patient.details.dropFactor || 20,
        calibrationFactor: patient.details.calibrationFactor ?? 1.0,
        tareWeight: patient.details.tareWeight ?? 30,
        startTime: patient.details.startTime || Date.now(),
        stopTime: null,
        monitoring: true,
        notes: patient.details.notes ?? '',
      },
      input: {
        esp32Status: patient.input?.esp32Status || 'DISCONNECTED',
        lastUpdated: patient.input?.lastUpdated || 0,
        loadCell: {
          rawValue: patient.input?.loadCell?.rawValue ?? 0,
          weight: patient.input?.loadCell?.weight ?? 0,
        },
        irSensor: {
          dropCount: patient.input?.irSensor?.dropCount ?? 0,
          lastDropTimestamp: patient.input?.irSensor?.lastDropTimestamp ?? 0,
          sensorStatus: patient.input?.irSensor?.sensorStatus ?? 'NO_SIGNAL',
        },
        pulseSensor: {
          heartRateRaw: patient.input?.pulseSensor?.heartRateRaw ?? 0,
          spo2Raw: patient.input?.pulseSensor?.spo2Raw ?? 0,
          sensorStatus: patient.input?.pulseSensor?.sensorStatus ?? 'NO_SIGNAL',
        },
      },
      output: {
        remainingVolume: patient.output?.remainingVolume ?? 0,
        remainingPercentage: patient.output?.remainingPercentage ?? 0,
        dropCount: patient.output?.dropCount ?? 0,
        dripRate: patient.output?.dripRate ?? 0,
        flowRate: patient.output?.flowRate ?? 0,
        eta: patient.output?.eta ?? '--',
        heartRate: patient.output?.heartRate ?? 0,
        spo2: patient.output?.spo2 ?? 0,
        ivStatus: patient.output?.ivStatus ?? 'NO_DATA',
        pulseStatus: patient.output?.pulseStatus ?? 'NO_PULSE_DATA',
        lastCalculated: patient.output?.lastCalculated ?? 0,
      },
      monitoring: true,
      lastUpdated: Date.now(),
    });

    await set(patientRef, payload);
    return true;
  } catch (e: any) {
    console.error('Firebase Realtime Database write error for patient creation:', e);
    const msg = e?.message || e?.code || 'Firebase Realtime Database write failed';
    if (
      e?.code === 'PERMISSION_DENIED' ||
      msg.includes('PERMISSION_DENIED') ||
      msg.includes('permission_denied')
    ) {
      throw new Error(
        'Permission Denied: Firebase Realtime Database rules do not allow writing to /patients. Check database rules in Firebase Console.'
      );
    }
    throw new Error(`Firebase write error: ${msg}`);
  }
}

/**
 * Writes calculated OUTPUT to `/patients/{patientId}/output`.
 * Application calculations -> Firebase OUTPUT
 */
export async function writePatientOutputToFirebase(
  patientId: string,
  output: PatientOutput
): Promise<boolean> {
  if (!rtdb) return false;
  try {
    const outputRef = ref(rtdb, `patients/${patientId}/output`);
    const payload = cleanFirebasePayload({
      remainingVolume: output.remainingVolume,
      remainingPercentage: output.remainingPercentage,
      dropCount: output.dropCount,
      dripRate: output.dripRate,
      flowRate: output.flowRate,
      eta: output.eta,
      heartRate: output.heartRate,
      spo2: output.spo2,
      ivStatus: output.ivStatus,
      pulseStatus: output.pulseStatus,
      lastCalculated: output.lastCalculated || Date.now(),
    });
    await update(outputRef, payload);
    return true;
  } catch (e: any) {
    if (e?.code === 'PERMISSION_DENIED' || e?.message?.includes('PERMISSION_DENIED')) {
      console.warn('Firebase output write notice: Permission denied on /patients/.../output.');
    } else {
      console.warn('Failed to write output to Firebase', e);
    }
    return false;
  }
}

/**
 * Writes sensor INPUT to `/patients/{patientId}/input`.
 * (Used by ESP32 or manual simulation)
 */
export async function writePatientInputToFirebase(
  patientId: string,
  input: Partial<PatientInput>
): Promise<boolean> {
  if (!rtdb) return false;
  try {
    const inputRef = ref(rtdb, `patients/${patientId}/input`);
    const payload = cleanFirebasePayload({
      esp32Status: input.esp32Status ?? 'CONNECTED',
      lastUpdated: input.lastUpdated || Date.now(),
      loadCell: input.loadCell ? {
        rawValue: input.loadCell.rawValue ?? 0,
        weight: input.loadCell.weight ?? 0,
      } : undefined,
      irSensor: input.irSensor ? {
        dropCount: input.irSensor.dropCount ?? 0,
        lastDropTimestamp: input.irSensor.lastDropTimestamp ?? Date.now(),
        sensorStatus: input.irSensor.sensorStatus ?? 'GOOD',
      } : undefined,
      pulseSensor: input.pulseSensor ? {
        heartRateRaw: input.pulseSensor.heartRateRaw ?? 0,
        spo2Raw: input.pulseSensor.spo2Raw ?? 0,
        sensorStatus: input.pulseSensor.sensorStatus ?? 'GOOD',
      } : undefined,
    });
    await update(inputRef, payload);
    return true;
  } catch (e: any) {
    if (e?.code === 'PERMISSION_DENIED' || e?.message?.includes('PERMISSION_DENIED')) {
      console.warn('Firebase input write notice: Permission denied on /patients/.../input.');
    } else {
      console.warn('Failed to write input to Firebase', e);
    }
    return false;
  }
}

/**
 * Appends a telemetry log record to `/patients/{patientId}/logs/{timestamp}`.
 */
export async function writeLogToFirebase(
  patientId: string,
  log: PatientLogRecord
): Promise<boolean> {
  if (!rtdb) return false;
  try {
    const logRef = ref(rtdb, `patients/${patientId}/logs/${log.timestamp}`);
    const payload = cleanFirebasePayload(log);
    await set(logRef, payload);
    return true;
  } catch (e: any) {
    if (e?.code === 'PERMISSION_DENIED' || e?.message?.includes('PERMISSION_DENIED')) {
      console.warn('Firebase log write notice: Permission denied on /patients/.../logs.');
    } else {
      console.warn('Failed to write log to Firebase', e);
    }
    return false;
  }
}

/**
 * Writes an alert record to `/patients/{patientId}/alerts/{alertId}`.
 */
export async function writeAlertToFirebase(
  patientId: string,
  alert: Alert
): Promise<boolean> {
  if (!rtdb) return false;
  try {
    const alertRef = ref(rtdb, `patients/${patientId}/alerts/${alert.id}`);
    const payload = cleanFirebasePayload(alert);
    await set(alertRef, payload);
    return true;
  } catch (e: any) {
    if (e?.code === 'PERMISSION_DENIED' || e?.message?.includes('PERMISSION_DENIED')) {
      console.warn('Firebase alert write notice: Permission denied on /patients/.../alerts.');
    } else {
      console.warn('Failed to write alert to Firebase', e);
    }
    return false;
  }
}

/**
 * Updates monitoring status flag in Firebase RTDB.
 */
export async function updatePatientMonitoringStatus(
  patientId: string,
  monitoring: boolean
): Promise<boolean> {
  if (!rtdb) {
    const initialized = initializeFirebase();
    if (!initialized.isConfigured || !rtdb) return true;
  }
  try {
    const now = Date.now();
    const patientRootRef = ref(rtdb, `patients/${patientId}`);
    const detailsRef = ref(rtdb, `patients/${patientId}/details`);
    const outputRef = ref(rtdb, `patients/${patientId}/output`);

    const detailsPayload = cleanFirebasePayload({
      monitoring,
      stopTime: monitoring ? null : now,
    });
    await update(detailsRef, detailsPayload);

    // Update root level monitoring boolean
    await update(patientRootRef, { monitoring });

    // Update output status
    if (!monitoring) {
      await update(outputRef, {
        ivStatus: 'MONITORING_STOPPED',
        pulseStatus: 'STOPPED',
        dripRate: 0,
        flowRate: 0,
        eta: '--',
      });
    }

    return true;
  } catch (e: any) {
    console.error('Failed to update monitoring status in Firebase', e);
    return false;
  }
}

/**
 * Saves bed calibration configuration to `/calibrations/{bedNo}` in Firebase.
 */
export async function writeCalibrationToFirebase(
  bedNo: string,
  cal: BedCalibration
): Promise<boolean> {
  if (!rtdb) return false;
  try {
    const calRef = ref(rtdb, `calibrations/${bedNo}`);
    const payload = cleanFirebasePayload(cal);
    await set(calRef, payload);
    return true;
  } catch (e: any) {
    if (e?.code === 'PERMISSION_DENIED' || e?.message?.includes('PERMISSION_DENIED')) {
      console.warn('Firebase calibration write notice: Permission denied on /calibrations.');
    } else {
      console.warn('Failed to write calibration to Firebase', e);
    }
    return false;
  }
}

/**
 * Reads all calibrations from `/calibrations` in Firebase.
 */
export async function fetchCalibrationsFromFirebase(): Promise<Record<string, BedCalibration> | null> {
  if (!rtdb) return null;
  try {
    const calRef = ref(rtdb, 'calibrations');
    const snapshot = await get(calRef);
    if (snapshot.exists()) {
      return snapshot.val();
    }
  } catch (e) {
    console.error('Failed to fetch calibrations from Firebase', e);
  }
  return null;
}

/**
 * Deletes all existing data in Firebase Realtime Database (/patients and /calibrations).
 */
export async function deleteAllFirebaseData(): Promise<{ success: boolean; message: string }> {
  if (!rtdb) {
    const initialized = initializeFirebase();
    if (!initialized.isConfigured || !rtdb) {
      return { success: false, message: 'Firebase Realtime Database is not configured or initialized.' };
    }
  }

  try {
    // 1. Wipe /patients
    const patientsRef = ref(rtdb, 'patients');
    await set(patientsRef, null);

    // 2. Wipe /calibrations
    const calibrationsRef = ref(rtdb, 'calibrations');
    await set(calibrationsRef, null);

    try {
      const rootRef = ref(rtdb, '/');
      await set(rootRef, null);
    } catch {
      // Root might be protected
    }

    return {
      success: true,
      message: 'All existing data in Firebase Realtime Database (/patients, /calibrations) has been deleted.',
    };
  } catch (e: any) {
    console.error('Failed to delete data from Firebase:', e);
    return {
      success: false,
      message: e?.message || 'Failed to delete data from Firebase. Check database rules.',
    };
  }
}

