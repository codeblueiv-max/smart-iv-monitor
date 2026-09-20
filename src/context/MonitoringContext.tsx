import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import {
  Alert,
  AlertSeverity,
  BedCalibration,
  ConnectionState,
  IVFluidType,
  Patient,
  PatientDetails,
  PatientInput,
  PatientOutput,
  AIPrediction,
  PatientEvent,
  PatientLogRecord,
  PatientStatus,
  PulseSensorQuality,
  PulseStatus,
  SensorQuality,
  SensorReading,
  SystemStatus,
} from '../types';
import {
  calculatePatientOutput,
  playAlertChime,
  STATUS_PRIORITIES,
} from '../utils/calculations';
import { AlertStateMachine } from '../utils/alertStateMachine';
import {
  getSavedFirebaseConfig,
  initializeFirebase,
  saveFirebaseConfig,
  subscribeToAllPatients,
  subscribeToFirebaseConnectionState,
  updatePatientMonitoringStatus,
  updatePatientDetailsInFirebase,
  writePatientToFirebase,
  writePatientOutputToFirebase,
  validateFirebaseConfig,
  deleteAllFirebaseData,
  normalizePatientInput,
  normalizePatientOutput,
  normalizeAIPrediction,
  writePatientCalibrationToFirebase,
  FirebaseConfig,
  FirebaseValidationResult,
} from '../services/firebase';

interface MonitoringContextType {
  patients: Patient[];
  activePatients: Patient[];
  systemStatus: SystemStatus;
  activeAlerts: Alert[];
  criticalAlertQueue: Alert[];
  currentPatientId: string | null;
  currentView: 'DASHBOARD' | 'MONITORING' | 'LOGS' | 'SETUP' | 'CALIBRATION';
  audioAlertsEnabled: boolean;
  calibrations: Record<string, BedCalibration>;
  firebaseConfig: FirebaseConfig;
  firebaseValidation: FirebaseValidationResult;

  // Navigation & Actions
  setCurrentView: (view: 'DASHBOARD' | 'MONITORING' | 'LOGS' | 'SETUP' | 'CALIBRATION') => void;
  selectPatient: (id: string | null) => void;
  toggleAudioAlerts: () => void;

  addPatient: (data: {
    bedNo: string;
    patientName: string;
    fluidType: IVFluidType;
    initialVolume: number;
    prescribedInfusionTimeHours?: number;
    prescribedInfusionTimeMinutes?: number;
    prescribedDripRate: number;
    dropFactor: number;
    notes?: string;
  }) => Promise<string>;

  updatePatientDetails: (
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

  stopMonitoring: (patientId: string) => Promise<void>;
  startMonitoring: (patientId: string) => Promise<void>;
  acknowledgeAlert: (alertId: string) => void;
  saveBedCalibration: (bedNo: string, tareWeight: number, calibrationFactor: number, irSensitivity: number) => void;
  savePatientCalibration: (patientId: string, tareWeight: number, calibrationFactor: number, irSensitivity?: number) => Promise<void>;
  updateFirebaseSettings: (config: Partial<FirebaseConfig>) => void;
  wipeAllData: () => Promise<{ success: boolean; message: string }>;
}

const MonitoringContext = createContext<MonitoringContextType | null>(null);

const STORAGE_KEY_PATIENTS = 'smart_iv_patients_v5';
const STORAGE_KEY_CALIBRATION = 'smart_iv_calibrations_v2';
const STORAGE_KEY_AUDIO = 'smart_iv_audio_enabled';

const DEFAULT_INITIAL_PATIENTS: Patient[] = [
  {
    details: {
      id: 'pat_168_bavj0',
      bedNo: '168',
      patientName: 'Patient 168',
      fluidType: 'Normal Saline',
      initialVolume: 100,
      prescribedInfusionTimeHours: 1,
      prescribedInfusionTimeMinutes: 0,
      prescribedDripRate: 33.333333333333336,
      dropFactor: 20,
      startTime: Date.now() - 3600000,
      stopTime: null,
      monitoring: true,
      notes: 'Real-time ESP32 Smart IV Telemetry Bed 168',
      tareWeight: 0,
      calibrationFactor: 1.0,
    },
    input: {
      esp32Status: 'CONNECTED',
      lastUpdated: Date.now(),
      loadCell: {
        rawValue: 56,
        weight: 56.0,
      },
      irSensor: {
        dropCount: 1240,
        lastDropTimestamp: Date.now(),
        sensorStatus: 'GOOD',
      },
      pulseSensor: {
        heartRateRaw: 75,
        spo2Raw: 98,
        sensorStatus: 'GOOD',
      },
    },
    output: {
      remainingVolume: 56,
      remainingPercentage: 56,
      dropCount: 1240,
      dripRate: 35,
      flowRate: 105,
      eta: '00:56',
      heartRate: 75,
      spo2: 98,
      ivStatus: 'NORMAL',
      pulseStatus: 'NORMAL',
      lastCalculated: Date.now(),
    },
    current: {
      weight: 115.0,
      loadCellWeight: 115.0,
      loadCellRaw: -417478,
      volume: 115,
      remainingVolume: 115,
      remainingPercentage: 23,
      remainingPercent: 23,
      dripRate: 30,
      flowRate: 1.5,
      totalDrops: 42,
      etaMinutes: 230,
      status: 'NORMAL',
      sensorQuality: 'GOOD',
      esp32Status: 'CONNECTED',
      lastUpdated: Date.now(),
      pulseRate: 75,
      pulseStatus: 'NORMAL',
      pulseSensorQuality: 'GOOD',
      pulseLastUpdated: Date.now(),
      spo2: 98,
    },
    logs: [
      {
        id: 'log_init_1',
        timestamp: Date.now() - 60000,
        weight: 432,
        loadCellWeight: 432,
        volume: 402,
        remainingVolume: 402,
        remainingPercentage: 80.4,
        dripRate: 30,
        flowRate: 1.5,
        totalDrops: 1770,
        etaMinutes: 268,
        status: 'NORMAL',
        sensorQuality: 'GOOD',
        esp32Status: 'CONNECTED',
        pulseRate: 74,
        pulseStatus: 'NORMAL',
        pulseSensorQuality: 'GOOD',
        spo2: 98,
      },
      {
        id: 'log_init_2',
        timestamp: Date.now(),
        weight: 430,
        loadCellWeight: 430,
        volume: 400,
        remainingVolume: 400,
        remainingPercentage: 80,
        dripRate: 30,
        flowRate: 1.5,
        totalDrops: 1800,
        etaMinutes: 266,
        status: 'NORMAL',
        sensorQuality: 'GOOD',
        esp32Status: 'CONNECTED',
        pulseRate: 75,
        pulseStatus: 'NORMAL',
        pulseSensorQuality: 'GOOD',
        spo2: 98,
      },
    ],
    alerts: [],
    events: [
      {
        id: 'evt_init',
        patientId: 'pat_bed_111',
        bedNo: '111',
        patientName: 'Loki',
        type: 'MONITORING_STARTED',
        severity: 'INFO',
        timestamp: Date.now() - 3600000,
        message: 'Monitoring initiated for Loki on Bed 111 with strict Input/Output architecture.',
      },
    ],
  },
];

function sendBrowserNotification(title: string, options?: NotificationOptions) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  try {
    if (Notification.permission === 'granted') {
      const notif = new Notification(title, {
        icon: '/favicon.ico',
        ...options,
      });
      notif.onclick = () => {
        window.focus();
      };
    } else if (Notification.permission === 'default') {
      Notification.requestPermission()
        .then((perm) => {
          if (perm === 'granted') {
            const notif = new Notification(title, {
              icon: '/favicon.ico',
              ...options,
            });
            notif.onclick = () => {
              window.focus();
            };
          }
        })
        .catch((err) => {
          console.warn('Browser notification permission request note:', err);
        });
    }
  } catch (e) {
    console.warn('Browser notification notice:', e);
  }
}

export function MonitoringProvider({ children }: { children: ReactNode }) {
  const initialConfig = getSavedFirebaseConfig();
  const initialValidation = validateFirebaseConfig(initialConfig);

  const [patients, setPatients] = useState<Patient[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PATIENTS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const validPatients = parsed.filter(
            (p) => p && typeof p === 'object' && p.details && p.details.id && p.details.bedNo
          );
          if (validPatients.length > 0) return validPatients;
        }
      }
    } catch {
      // fallback
    }
    return DEFAULT_INITIAL_PATIENTS;
  });

  const [currentView, setCurrentView] = useState<'DASHBOARD' | 'MONITORING' | 'LOGS' | 'SETUP' | 'CALIBRATION'>('DASHBOARD');
  const [currentPatientId, setCurrentPatientId] = useState<string | null>(null);

  const [audioAlertsEnabled, setAudioAlertsEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_AUDIO);
    return saved !== null ? saved === 'true' : true;
  });

  const [calibrations, setCalibrations] = useState<Record<string, BedCalibration>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CALIBRATION);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return {};
  });

  const [firebaseConfig, setFirebaseConfig] = useState<FirebaseConfig>(initialConfig);
  const [firebaseValidation, setFirebaseValidation] = useState<FirebaseValidationResult>(initialValidation);
  const [firebaseConnected, setFirebaseConnected] = useState<ConnectionState>('DISCONNECTED');
  const [lastSyncTime, setLastSyncTime] = useState<number>(0);

  // Debounced saving to localStorage
  useEffect(() => {
    const handler = setTimeout(() => {
      try {
        const lightPatients = patients.map((p) => ({
          ...p,
          logs: (p.logs || []).slice(-20),
          events: (p.events || []).slice(-20),
        }));
        localStorage.setItem(STORAGE_KEY_PATIENTS, JSON.stringify(lightPatients));
      } catch (e) {
        console.warn('Failed to save patients to storage', e);
      }
    }, 2000);

    return () => clearTimeout(handler);
  }, [patients]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_AUDIO, String(audioAlertsEnabled));
  }, [audioAlertsEnabled]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CALIBRATION, JSON.stringify(calibrations));
    } catch (e) {
      console.warn('Failed to save calibrations', e);
    }
  }, [calibrations]);

  // Audio chime throttling ref to prevent sound stutter/freeze
  const lastChimeTimeRef = useRef<number>(0);
  const playThrottledChime = useCallback((type: 'CRITICAL' | 'WARNING' | 'ACK') => {
    if (!audioAlertsEnabled) return;
    const now = Date.now();
    if (type === 'ACK' || now - lastChimeTimeRef.current > 6000) {
      lastChimeTimeRef.current = now;
      playAlertChime(type);
    }
  }, [audioAlertsEnabled]);

  // Ref tracking last written output hashes to avoid infinite Firebase write loops
  const lastWrittenOutputRef = useRef<Record<string, string>>({});

  // Independent Alert State Machine per patient and per alert type
  // Ensures alerts ONLY trigger on NORMAL -> ABNORMAL state transitions and prevents repeated popups during continuous active conditions or Firebase syncs
  const alertStateMachineRef = useRef<AlertStateMachine>(new AlertStateMachine());

  // Process and compute output from input and details
  const processPatientData = useCallback(
    (
      patient: Patient,
      newInput: PatientInput,
      forcedOutput?: PatientOutput
    ): Patient => {
      const now = Date.now();

      // If monitoring is stopped:
      if (patient.details.monitoring !== true) {
        const stoppedOutput: PatientOutput = {
          remainingVolume: patient.output?.remainingVolume ?? 0,
          remainingPercentage: patient.output?.remainingPercentage ?? 0,
          dropCount: newInput.irSensor?.dropCount ?? patient.output?.dropCount ?? 0,
          dripRate: 0,
          flowRate: 0,
          eta: '--',
          heartRate: 0,
          spo2: 0,
          ivStatus: 'MONITORING_STOPPED',
          pulseStatus: 'STOPPED',
          lastCalculated: now,
        };

        const stoppedCurrent: SensorReading = {
          weight: newInput.loadCell.weight,
          loadCellWeight: newInput.loadCell.weight,
          loadCellRaw: newInput.loadCell.rawValue,
          remainingVolume: stoppedOutput.remainingVolume,
          volume: stoppedOutput.remainingVolume,
          remainingPercentage: stoppedOutput.remainingPercentage,
          remainingPercent: stoppedOutput.remainingPercentage,
          dropCount: stoppedOutput.dropCount,
          irDropCount: stoppedOutput.dropCount,
          dropRate: 0,
          dripRate: 0,
          totalDrops: stoppedOutput.dropCount,
          flowRate: 0,
          etaMinutes: null,
          status: 'MONITORING_STOPPED',
          sensorQuality: 'NO_DATA',
          esp32Status: 'DISCONNECTED',
          lastUpdated: newInput.lastUpdated || 0,
          pulseRate: null,
          pulseBpm: null,
          pulse: null,
          pulseStatus: 'NO_PULSE_DATA',
          pulseSensorQuality: 'NO_SIGNAL',
          pulseLastUpdated: null,
          spo2: 0,
        };

        return {
          ...patient,
          input: newInput,
          output: stoppedOutput,
          current: stoppedCurrent,
        };
      }

      // Calculate output using strict math engine (single source of truth)
      const calculatedOutput =
        forcedOutput || calculatePatientOutput(patient.details, newInput, patient.output);

      // Construct backward-compatible `current` view
      const etaMin =
        calculatedOutput.flowRate > 0 && calculatedOutput.remainingVolume > 0
          ? Math.round(calculatedOutput.remainingVolume / calculatedOutput.flowRate)
          : null;

      const sensorQuality: SensorQuality =
        newInput.esp32Status === 'DISCONNECTED'
          ? 'NO_DATA'
          : newInput.loadCell.weight < 0
          ? 'INVALID'
          : newInput.loadCell.weight > 0
          ? 'GOOD'
          : 'NO_DATA';

      const pulseSensorQuality: PulseSensorQuality =
        newInput.pulseSensor.sensorStatus === 'GOOD'
          ? 'GOOD'
          : newInput.pulseSensor.sensorStatus === 'UNSTABLE'
          ? 'UNSTABLE'
          : newInput.pulseSensor.heartRateRaw > 0
          ? 'GOOD'
          : 'NO_SIGNAL';

      const currentReading: SensorReading = {
        loadCellRaw: newInput.loadCell.rawValue,
        loadCellWeight: newInput.loadCell.weight,
        weight: newInput.loadCell.weight,
        remainingVolume: calculatedOutput.remainingVolume,
        volume: calculatedOutput.remainingVolume,
        remainingPercent: calculatedOutput.remainingPercentage,
        remainingPercentage: calculatedOutput.remainingPercentage,
        dropCount: calculatedOutput.dropCount,
        irDropCount: calculatedOutput.dropCount,
        dropRate: calculatedOutput.dripRate,
        dripRate: calculatedOutput.dripRate,
        totalDrops: calculatedOutput.dropCount,
        flowRate: calculatedOutput.flowRate,
        etaMinutes: etaMin,
        status: calculatedOutput.ivStatus,
        sensorQuality,
        esp32Status: newInput.esp32Status,
        lastUpdated: newInput.lastUpdated || now,
        pulseBpm: calculatedOutput.heartRate > 0 ? calculatedOutput.heartRate : null,
        pulse: calculatedOutput.heartRate > 0 ? calculatedOutput.heartRate : null,
        pulseRate: calculatedOutput.heartRate > 0 ? calculatedOutput.heartRate : null,
        pulseStatus: calculatedOutput.pulseStatus,
        pulseSensorQuality,
        pulseLastUpdated: calculatedOutput.heartRate > 0 ? newInput.lastUpdated || now : null,
        spo2: calculatedOutput.spo2,
      };

      // Handle Alerts & Alarms for Actively Monitored Patients using State Transitions
      let updatedAlerts = [...(patient.alerts || [])];
      let updatedEvents = [...(patient.events || [])];
      let hasNewAlarm = false;
      const patientId = patient.details.id;
      const alertStateMachine = alertStateMachineRef.current;

      // Core Popup Alert Conditions Evaluator (BAG_NEARLY_EMPTY, OCCLUSION, LEAKAGE, EXCESSIVE_FLOW, ABNORMAL_PULSE)
      const alertConfigs: Array<{
        alertType: 'BAG_NEARLY_EMPTY' | 'LOW_VOLUME' | 'OCCLUSION' | 'LEAKAGE' | 'EXCESSIVE_FLOW' | 'ABNORMAL_PULSE';
        isActive: boolean;
        category: 'IV' | 'PULSE';
        getSeverity: () => AlertSeverity;
        getMessage: () => string;
        getSuggestedAction: () => string;
      }> = [
        {
          alertType: 'BAG_NEARLY_EMPTY',
          isActive:
            patient.details.monitoring &&
            (calculatedOutput.ivStatus === 'BAG_NEARLY_EMPTY' ||
              calculatedOutput.ivStatus === 'CRITICAL_VOLUME' ||
              calculatedOutput.ivStatus === 'LOW_VOLUME' ||
              (calculatedOutput.remainingPercentage !== null &&
                calculatedOutput.remainingPercentage <= 20 &&
                calculatedOutput.remainingPercentage >= 0) ||
              (calculatedOutput.remainingVolume !== null && calculatedOutput.remainingVolume <= 100)),
          category: 'IV',
          getSeverity: () =>
            calculatedOutput.ivStatus === 'CRITICAL_VOLUME' ||
            (calculatedOutput.remainingPercentage !== null && calculatedOutput.remainingPercentage <= 10)
              ? 'CRITICAL'
              : 'WARNING',
          getMessage: () =>
            calculatedOutput.ivStatus === 'CRITICAL_VOLUME' ||
            (calculatedOutput.remainingPercentage !== null && calculatedOutput.remainingPercentage <= 10)
              ? `CRITICAL: IV bottle almost empty (${calculatedOutput.remainingVolume} mL remaining / ${calculatedOutput.remainingPercentage}%)`
              : `BAG NEARLY EMPTY: IV bag fluid is low (${calculatedOutput.remainingVolume} mL remaining / ${calculatedOutput.remainingPercentage}%)`,
          getSuggestedAction: () =>
            calculatedOutput.remainingPercentage !== null && calculatedOutput.remainingPercentage <= 10
              ? 'Replace IV infusion bottle immediately.'
              : 'Prepare replacement IV bag.',
        },
        {
          alertType: 'OCCLUSION',
          isActive:
            patient.details.monitoring &&
            (calculatedOutput.ivStatus === 'POSSIBLE_OCCLUSION' ||
              calculatedOutput.ivStatus === ('OCCLUSION' as PatientStatus)),
          category: 'IV',
          getSeverity: () => 'CRITICAL',
          getMessage: () =>
            `BLOCKAGE / OCCLUSION: Drip rate is 0 drops/min with ${calculatedOutput.remainingVolume} mL remaining.`,
          getSuggestedAction: () => 'Check IV line for kinks, roller clamp closure, or catheter occlusion.',
        },
        {
          alertType: 'LEAKAGE',
          isActive:
            patient.details.monitoring &&
            (calculatedOutput.ivStatus === 'POSSIBLE_LEAKAGE' ||
              calculatedOutput.ivStatus === ('LEAKAGE' as PatientStatus)),
          category: 'IV',
          getSeverity: () => 'CRITICAL',
          getMessage: () => `LEAKAGE DETECTED: Rapid fluid volume drop detected without expected drop count.`,
          getSuggestedAction: () => 'Check IV bottle seal, catheter site, and tubing joints.',
        },
        {
          alertType: 'EXCESSIVE_FLOW',
          isActive:
            patient.details.monitoring &&
            calculatedOutput.remainingVolume > 10 &&
            (calculatedOutput.ivStatus === 'POSSIBLE_EXCESSIVE_FLOW' ||
              calculatedOutput.ivStatus === ('EXCESSIVE_FLOW' as PatientStatus) ||
              calculatedOutput.dripRate > Math.max(30, (patient.details.prescribedDripRate || 30) * 1.35)),
          category: 'IV',
          getSeverity: () => 'WARNING',
          getMessage: () =>
            `EXCESSIVE FLOW: Current drip rate (${calculatedOutput.dripRate} drops/min) exceeds maximum limit (${patient.details.prescribedDripRate || 30} dpm).`,
          getSuggestedAction: () => 'Adjust roller clamp or check IV infusion pump flow rate setting.',
        },
        {
          alertType: 'ABNORMAL_PULSE',
          isActive:
            patient.details.monitoring &&
            (calculatedOutput.pulseStatus === 'ABNORMAL' ||
              (calculatedOutput.heartRate > 0 &&
                (calculatedOutput.heartRate < 60 || calculatedOutput.heartRate > 100))),
          category: 'PULSE',
          getSeverity: () =>
            calculatedOutput.heartRate < 45 || calculatedOutput.heartRate > 130 ? 'CRITICAL' : 'WARNING',
          getMessage: () =>
            `ABNORMAL PULSE: ${
              calculatedOutput.heartRate > 0 && calculatedOutput.heartRate < 60 ? 'Bradycardia' : 'Tachycardia'
            } (${calculatedOutput.heartRate} BPM).`,
          getSuggestedAction: () => 'Assess patient vitals, responsiveness, and pulse sensor placement.',
        },
      ];

      alertConfigs.forEach((config) => {
        const res = alertStateMachine.evaluateCondition(patientId, config.alertType, config.isActive);

        if (res.type === 'TRIGGER') {
          // Edge Transition NORMAL -> ABNORMAL: Generate popup alert ONCE
          const severity = config.getSeverity();
          const alertMsg = config.getMessage();
          const action = config.getSuggestedAction();
          const alertId = `alt_${config.alertType.toLowerCase()}_${now}_${Math.random().toString(36).substring(2, 6)}`;
          res.entry.alertId = alertId;

          const newAlert: Alert = {
            id: alertId,
            patientId: patient.details.id,
            bedNo: patient.details.bedNo,
            patientName: patient.details.patientName,
            type: config.alertType as PatientStatus,
            severity,
            category: config.category,
            timestamp: now,
            message: alertMsg,
            suggestedAction: action,
            acknowledged: false,
            readingsSnapshot: {
              volume: calculatedOutput.remainingVolume,
              remainingPercentage: calculatedOutput.remainingPercentage,
              dripRate: calculatedOutput.dripRate,
              flowRate: calculatedOutput.flowRate,
              etaMinutes: etaMin,
              pulseRate: calculatedOutput.heartRate > 0 ? calculatedOutput.heartRate : null,
            },
          };

          // Filter out previous instances of this alert type before inserting new active alert
          updatedAlerts = [newAlert, ...updatedAlerts.filter((a) => a.type !== config.alertType)];
          updatedEvents = [
            {
              id: `evt_${config.alertType.toLowerCase()}_${now}`,
              patientId: patient.details.id,
              bedNo: patient.details.bedNo,
              patientName: patient.details.patientName,
              type: config.alertType as PatientStatus,
              severity,
              timestamp: now,
              message: alertMsg,
            },
            ...updatedEvents,
          ];
          hasNewAlarm = true;

          sendBrowserNotification(
            `Bed ${patient.details.bedNo} – ${config.alertType.replace(/_/g, ' ')}`,
            {
              body: `Patient: ${patient.details.patientName} | ${alertMsg}`,
              tag: `${config.alertType.toLowerCase()}_${patient.details.id}`,
            }
          );
        } else if (res.type === 'CONTINUING_ACTIVE') {
          // Condition continues ABNORMAL -> ABNORMAL: Update snapshot telemetry, DO NOT create new popup or alarm.
          updatedAlerts = updatedAlerts.map((a) => {
            if (a.type === config.alertType && !a.acknowledged) {
              return {
                ...a,
                severity: config.getSeverity(),
                message: config.getMessage(),
                readingsSnapshot: {
                  volume: calculatedOutput.remainingVolume,
                  remainingPercentage: calculatedOutput.remainingPercentage,
                  dripRate: calculatedOutput.dripRate,
                  flowRate: calculatedOutput.flowRate,
                  etaMinutes: etaMin,
                  pulseRate: calculatedOutput.heartRate > 0 ? calculatedOutput.heartRate : null,
                },
              };
            }
            return a;
          });
        } else if (res.type === 'RECTIFIED') {
          // Edge Transition ABNORMAL -> NORMAL: Reset alert state (active=false, acknowledged=false) and mark alert as resolved.
          updatedAlerts = updatedAlerts.map((a) =>
            a.type === config.alertType && !a.acknowledged
              ? { ...a, acknowledged: true, acknowledgedAt: now }
              : a
          );
          updatedEvents = [
            {
              id: `evt_resolved_${config.alertType.toLowerCase()}_${now}_${Math.random().toString(36).substring(2, 6)}`,
              patientId: patient.details.id,
              bedNo: patient.details.bedNo,
              patientName: patient.details.patientName,
              type: `${config.alertType}_RESOLVED` as PatientStatus,
              severity: 'INFO',
              timestamp: now,
              message: `Condition Normal: ${config.alertType.replace(/_/g, ' ')} returned to safe range.`,
            },
            ...updatedEvents,
          ];
        }
      });

      // 3. ESP32 Disconnected Alert
      const isEspDisconnected =
        newInput.esp32Status === 'DISCONNECTED' &&
        (newInput.lastUpdated > 0 || (patient.alerts && patient.alerts.length > 0));
      const espRes = alertStateMachine.evaluateCondition(patientId, 'ESP32_DISCONNECTED', isEspDisconnected);

      if (espRes.type === 'TRIGGER') {
        const espMsg = `ESP32 Disconnected: Lost telemetry from sensor module for Bed ${patient.details.bedNo}.`;
        const alertId = `alt_esp_${now}_${Math.random().toString(36).substring(2, 6)}`;
        espRes.entry.alertId = alertId;

        const newEspAlert: Alert = {
          id: alertId,
          patientId: patient.details.id,
          bedNo: patient.details.bedNo,
          patientName: patient.details.patientName,
          type: 'ESP32_DISCONNECTED',
          severity: 'CRITICAL',
          category: 'SYSTEM',
          timestamp: now,
          message: espMsg,
          suggestedAction: 'Verify ESP32 power, Wi-Fi connectivity, and sensor wiring.',
          acknowledged: false,
          readingsSnapshot: {
            volume: calculatedOutput.remainingVolume,
            remainingPercentage: calculatedOutput.remainingPercentage,
            dripRate: calculatedOutput.dripRate,
            flowRate: calculatedOutput.flowRate,
            etaMinutes: etaMin,
            pulseRate: calculatedOutput.heartRate > 0 ? calculatedOutput.heartRate : null,
          },
        };

        updatedAlerts = [newEspAlert, ...updatedAlerts];
        updatedEvents = [
          {
            id: `evt_esp_${now}`,
            patientId: patient.details.id,
            bedNo: patient.details.bedNo,
            patientName: patient.details.patientName,
            type: 'ESP32_DISCONNECTED',
            severity: 'CRITICAL',
            timestamp: now,
            message: espMsg,
          },
          ...updatedEvents,
        ];
        hasNewAlarm = true;

        sendBrowserNotification(
          `Bed ${patient.details.bedNo} – ESP32 Disconnected`,
          {
            body: `Patient: ${patient.details.patientName} | ${espMsg}`,
            tag: `esp_${patient.details.id}`,
          }
        );
      } else if (espRes.type === 'RECTIFIED') {
        updatedAlerts = updatedAlerts.map((a) =>
          a.type === 'ESP32_DISCONNECTED' && !a.acknowledged ? { ...a, acknowledged: true, acknowledgedAt: now } : a
        );
        updatedEvents = [
          {
            id: `evt_esp_resolved_${now}_${Math.random().toString(36).substring(2, 6)}`,
            patientId: patient.details.id,
            bedNo: patient.details.bedNo,
            patientName: patient.details.patientName,
            type: 'ESP32_RECONNECTED',
            severity: 'INFO',
            timestamp: now,
            message: `ESP32 Reconnected: Telemetry restored for Bed ${patient.details.bedNo}.`,
          },
          ...updatedEvents,
        ];
      }

      // 4. Sensor Unstable / Hardware Problem Alert
      const isSensorInvalid = sensorQuality === 'INVALID';
      const sensRes = alertStateMachine.evaluateCondition(patientId, 'SENSOR_UNSTABLE', isSensorInvalid);

      if (sensRes.type === 'TRIGGER') {
        const sensorMsg = `Sensor Problem: Load cell reading unstable or invalid on Bed ${patient.details.bedNo}.`;
        const alertId = `alt_sens_${now}_${Math.random().toString(36).substring(2, 6)}`;
        sensRes.entry.alertId = alertId;

        const newSensorAlert: Alert = {
          id: alertId,
          patientId: patient.details.id,
          bedNo: patient.details.bedNo,
          patientName: patient.details.patientName,
          type: 'SENSOR_UNSTABLE',
          severity: 'WARNING',
          category: 'SYSTEM',
          timestamp: now,
          message: sensorMsg,
          suggestedAction: 'Inspect load cell physical mounting and ensure no cable strain.',
          acknowledged: false,
          readingsSnapshot: {
            volume: calculatedOutput.remainingVolume,
            remainingPercentage: calculatedOutput.remainingPercentage,
            dripRate: calculatedOutput.dripRate,
            flowRate: calculatedOutput.flowRate,
            etaMinutes: etaMin,
            pulseRate: calculatedOutput.heartRate > 0 ? calculatedOutput.heartRate : null,
          },
        };

        updatedAlerts = [newSensorAlert, ...updatedAlerts];
        hasNewAlarm = true;

        sendBrowserNotification(
          `Bed ${patient.details.bedNo} – Sensor Warning`,
          {
            body: `Patient: ${patient.details.patientName} | ${sensorMsg}`,
            tag: `sens_${patient.details.id}`,
          }
        );
      } else if (sensRes.type === 'RECTIFIED') {
        updatedAlerts = updatedAlerts.map((a) =>
          a.type === 'SENSOR_UNSTABLE' && !a.acknowledged ? { ...a, acknowledged: true, acknowledgedAt: now } : a
        );
        updatedEvents = [
          {
            id: `evt_sens_resolved_${now}_${Math.random().toString(36).substring(2, 6)}`,
            patientId: patient.details.id,
            bedNo: patient.details.bedNo,
            patientName: patient.details.patientName,
            type: 'SENSOR_STABILIZED',
            severity: 'INFO',
            timestamp: now,
            message: `Sensor Stabilized: Load cell readings returned to valid range for Bed ${patient.details.bedNo}.`,
          },
          ...updatedEvents,
        ];
      }

      if (hasNewAlarm) {
        playThrottledChime(
          calculatedOutput.ivStatus === 'CRITICAL_VOLUME' ||
          calculatedOutput.ivStatus === 'POSSIBLE_OCCLUSION' ||
          newInput.esp32Status === 'DISCONNECTED' ||
          calculatedOutput.heartRate < 45 ||
          calculatedOutput.heartRate > 130
            ? 'CRITICAL'
            : 'WARNING'
        );
      }

      // 3. Maintain in-memory log history (throttled to at most 1 entry per 8 seconds)
      let updatedLogs = patient.logs || [];
      const lastLog = updatedLogs[updatedLogs.length - 1];
      const shouldAppendLog =
        !lastLog ||
        now - lastLog.timestamp >= 8000 ||
        lastLog.status !== calculatedOutput.ivStatus ||
        (lastLog.pulseRate !== null &&
          calculatedOutput.heartRate > 0 &&
          Math.abs((lastLog.pulseRate || 0) - calculatedOutput.heartRate) > 10);

      if (shouldAppendLog) {
        const newLogRecord: PatientLogRecord = {
          id: `log_${now}`,
          timestamp: now,
          loadCellRaw: newInput.loadCell.rawValue,
          loadCellWeight: newInput.loadCell.weight,
          weight: newInput.loadCell.weight,
          remainingVolume: calculatedOutput.remainingVolume,
          volume: calculatedOutput.remainingVolume,
          remainingPercentage: calculatedOutput.remainingPercentage,
          remainingPercent: calculatedOutput.remainingPercentage,
          irDropCount: calculatedOutput.dropCount,
          dropCount: calculatedOutput.dropCount,
          dripRate: calculatedOutput.dripRate,
          dropRate: calculatedOutput.dripRate,
          flowRate: calculatedOutput.flowRate,
          totalDrops: calculatedOutput.dropCount,
          etaMinutes: etaMin,
          status: calculatedOutput.ivStatus,
          sensorQuality,
          esp32Status: newInput.esp32Status,
          pulse: calculatedOutput.heartRate > 0 ? calculatedOutput.heartRate : null,
          pulseRate: calculatedOutput.heartRate > 0 ? calculatedOutput.heartRate : null,
          pulseBpm: calculatedOutput.heartRate > 0 ? calculatedOutput.heartRate : null,
          pulseStatus: calculatedOutput.pulseStatus,
          pulseSensorQuality,
          spo2: calculatedOutput.spo2,
        };
        updatedLogs = [...updatedLogs, newLogRecord];
        if (updatedLogs.length > 200) {
          updatedLogs = updatedLogs.slice(-200);
        }
      }

      // 4. Sync calculated output back to Firebase OUTPUT node
      // Use fingerprint to avoid repetitive writes
      const outputFingerprint = `${calculatedOutput.remainingVolume}_${calculatedOutput.remainingPercentage}_${calculatedOutput.dripRate}_${calculatedOutput.heartRate}_${calculatedOutput.ivStatus}_${calculatedOutput.pulseStatus}`;
      if (lastWrittenOutputRef.current[patient.details.id] !== outputFingerprint) {
        lastWrittenOutputRef.current[patient.details.id] = outputFingerprint;
        writePatientOutputToFirebase(patient.details.id, calculatedOutput).catch((e) =>
          console.warn('Background output sync note:', e)
        );
      }

      return {
        ...patient,
        input: newInput,
        output: calculatedOutput,
        current: currentReading,
        logs: updatedLogs,
        alerts: updatedAlerts,
        events: updatedEvents,
      };
    },
    [playThrottledChime]
  );

  // Periodic Heartbeat Supervisor (runs every 6s, checks if ESP32 lastUpdated > 25s)
  useEffect(() => {
    const supervisorInterval = setInterval(() => {
      const currentTime = Date.now();
      setPatients((prevList): Patient[] => {
        let changed = false;
        const updated: Patient[] = prevList.map((patient): Patient => {
          if (!patient.details.monitoring) return patient;
          const lastUp = patient.input?.lastUpdated || patient.current?.lastUpdated || 0;

          if (lastUp === 0) {
            if (patient.output?.ivStatus !== 'NO_DATA') {
              changed = true;
              const emptyInput: PatientInput = {
                esp32Status: 'DISCONNECTED',
                lastUpdated: 0,
                loadCell: { rawValue: 0, weight: 0 },
                irSensor: { dropCount: 0, lastDropTimestamp: 0, sensorStatus: 'NO_SIGNAL' },
                pulseSensor: { heartRateRaw: 0, spo2Raw: 0, sensorStatus: 'NO_SIGNAL' },
              };
              return processPatientData(patient, emptyInput);
            }
            return patient;
          }

          const timeSinceLastReading = currentTime - lastUp;
          if (timeSinceLastReading > 25000 && patient.input?.esp32Status !== 'DISCONNECTED') {
            changed = true;
            const timedOutInput: PatientInput = {
              ...patient.input,
              esp32Status: 'DISCONNECTED',
            };
            return processPatientData(patient, timedOutInput);
          }
          return patient;
        });
        return changed ? updated : prevList;
      });
    }, 6000);

    return () => clearInterval(supervisorInterval);
  }, [processPatientData]);

  // Realtime Database Listener for strict Input / Output structure
  useEffect(() => {
    const val = validateFirebaseConfig(firebaseConfig);
    setFirebaseValidation(val);

    const { db, isConfigured } = initializeFirebase(firebaseConfig);
    if (!isConfigured || !db) {
      setFirebaseConnected('DISCONNECTED');
      return;
    }

    // 1. Connection state heartbeat
    const connUnsub = subscribeToFirebaseConnectionState((isConnected) => {
      setFirebaseConnected(isConnected ? 'CONNECTED' : 'DISCONNECTED');
    });

    // 2. Single root `/patients` subscription for all telemetry & changes
    const rootPatientsUnsub = subscribeToAllPatients((rtdbPatients) => {
      setLastSyncTime(Date.now());
      if (!rtdbPatients || typeof rtdbPatients !== 'object') return;

      setPatients((prev): Patient[] => {
        let hasChanges = false;
        const updated: Patient[] = prev.map((p): Patient => {
          if (!p || !p.details) return p;
          const patientKey = Object.keys(rtdbPatients).find(
            (k) => k === p.details.id || rtdbPatients[k]?.details?.id === p.details.id
          );
          if (!patientKey) return p;

          const remoteData = rtdbPatients[patientKey];
          if (!remoteData) return p;

          // Determine remote monitoring status
          const isRemoteMonitoring =
            remoteData.details?.monitoring !== undefined
              ? Boolean(remoteData.details.monitoring)
              : remoteData.monitoring !== undefined
              ? Boolean(remoteData.monitoring)
              : p.details.monitoring;

          const remoteStopTime =
            remoteData.details?.stopTime !== undefined
              ? remoteData.details.stopTime
              : remoteData.stopTime !== undefined
              ? remoteData.stopTime
              : p.details.stopTime;

          const remoteAI = normalizeAIPrediction(remoteData.AI || remoteData.ai);

          const updatedPatientWithDetails: Patient = {
            ...p,
            details: {
              ...p.details,
              ...(remoteData.details || {}),
              monitoring: isRemoteMonitoring,
              stopTime: isRemoteMonitoring ? null : remoteStopTime,
            },
            ai: remoteAI || p.ai,
          };

          // Extract strict INPUT
          const remoteInput = normalizePatientInput(
            remoteData.input || remoteData.current || remoteData
          );

          // If monitoring is stopped:
          if (!isRemoteMonitoring) {
            hasChanges = true;
            return processPatientData(updatedPatientWithDetails, {
              ...remoteInput,
              esp32Status: 'DISCONNECTED',
            });
          }

          // If monitoring is active: run math engine on INPUT
          hasChanges = true;
          return processPatientData(updatedPatientWithDetails, remoteInput);
        });

        // Add any newly discovered remote patients
        Object.keys(rtdbPatients).forEach((key) => {
          const node = rtdbPatients[key];
          if (!node || typeof node !== 'object') return;
          const exists = updated.some(
            (p) => (p?.details && p.details.id === key) || (node.details?.id && p?.details && p.details.id === node.details.id)
          );
          if (!exists && node.details) {
            hasChanges = true;
            const isRemoteMon =
              node.details?.monitoring !== undefined
                ? Boolean(node.details.monitoring)
                : node.monitoring !== undefined
                ? Boolean(node.monitoring)
                : true;

            const safeBedNo = String(node.details.bedNo || key.replace(/^pat_/, '') || 'Bed');
            const safeName = String(node.details.patientName || 'Patient');

            const newDetails: PatientDetails = {
              id: node.details.id || key,
              bedNo: safeBedNo,
              patientName: safeName,
              fluidType: node.details.fluidType || 'Normal Saline',
              initialVolume: Number(node.details.initialVolume) || 500,
              prescribedDripRate: Number(node.details.prescribedDripRate) || 30,
              dropFactor: Number(node.details.dropFactor) || 20,
              startTime: Number(node.details.startTime) || Date.now(),
              stopTime: node.details.stopTime || null,
              notes: node.details.notes || '',
              tareWeight: node.details.tareWeight || 30,
              calibrationFactor: node.details.calibrationFactor || 1.0,
              ...node.details,
              monitoring: isRemoteMon,
            };

            const remoteInput = normalizePatientInput(
              node.input || node.current || node
            );

            const initialPatient: Patient = {
              details: newDetails,
              input: remoteInput,
              output: normalizePatientOutput(node.output, newDetails.initialVolume),
              logs: Array.isArray(node.logs) ? node.logs : [],
              alerts: Array.isArray(node.alerts) ? node.alerts : [],
              events: Array.isArray(node.events) ? node.events : [],
            };

            updated.push(processPatientData(initialPatient, remoteInput));
          }
        });

        return hasChanges ? updated : prev;
      });
    });

    return () => {
      if (connUnsub) connUnsub();
      if (rootPatientsUnsub) rootPatientsUnsub();
    };
  }, [firebaseConfig, processPatientData]);

  // Derived Active Lists and Status
  const activePatients = patients.filter((p) => p && p.details && p.details.monitoring === true);

  const activeAlerts = patients
    .filter((p) => p && p.details && p.details.monitoring === true)
    .flatMap((p) => (Array.isArray(p.alerts) ? p.alerts.filter((a) => a && !a.acknowledged) : []))
    .sort((a, b) => {
      const pA = STATUS_PRIORITIES[a.type] || 99;
      const pB = STATUS_PRIORITIES[b.type] || 99;
      return pA - pB;
    });

  // All unacknowledged alerts for actively monitored patients are delivered to the emergency popup queue
  const criticalAlertQueue = activeAlerts;

  // Overall ESP32 Sensor Network Status based on active patients' latest heartbeat
  const now = Date.now();
  let esp32State: ConnectionState = 'DISCONNECTED';
  if (activePatients.length > 0) {
    const validTimestamps = activePatients
      .map((p) => p.input?.lastUpdated || p.current?.lastUpdated)
      .filter((t): t is number => typeof t === 'number' && t > 0);
    if (validTimestamps.length > 0) {
      const latestHeartbeat = Math.min(...validTimestamps.map((t) => now - t));
      if (latestHeartbeat < 8000) {
        esp32State = 'CONNECTED';
      } else if (latestHeartbeat < 20000) {
        esp32State = 'UNSTABLE';
      }
    }
  }

  const systemStatus: SystemStatus = {
    esp32Network: esp32State,
    firebase: firebaseConnected,
    lastSyncTimestamp: lastSyncTime,
    activePatientsCount: activePatients.length,
    criticalAlertsCount: criticalAlertQueue.length,
    missingEnvKeys: firebaseValidation.missingKeys,
    isFirebaseConfigValid: firebaseValidation.isValid,
  };

  const selectPatient = useCallback((id: string | null) => {
    setCurrentPatientId(id);
    if (id) {
      setCurrentView('MONITORING');
    }
  }, []);

  const toggleAudioAlerts = useCallback(() => {
    setAudioAlertsEnabled((prev) => !prev);
  }, []);

  const addPatient = useCallback(
    async (data: {
      bedNo: string;
      patientName: string;
      fluidType: IVFluidType;
      initialVolume: number;
      prescribedDripRate: number;
      dropFactor: number;
      notes?: string;
    }): Promise<string> => {
      // Step 1: Validation
      const cleanBed = (data.bedNo || '').trim();
      const cleanName = (data.patientName || '').trim();
      if (!cleanBed) {
        throw new Error('Bed Number is required.');
      }
      if (!cleanName) {
        throw new Error('Patient Name is required.');
      }
      if (!data.initialVolume || isNaN(data.initialVolume) || data.initialVolume <= 0 || data.initialVolume > 5000) {
        throw new Error('Please enter a valid initial IV volume (10 to 5000 mL).');
      }
      if (!data.prescribedDripRate || isNaN(data.prescribedDripRate) || data.prescribedDripRate <= 0 || data.prescribedDripRate > 200) {
        throw new Error('Please enter a valid prescribed drip rate (1 to 200 dpm).');
      }
      const dropFactor = data.dropFactor && !isNaN(data.dropFactor) && data.dropFactor > 0 ? data.dropFactor : 20;

      // Step 2: Unique Firebase-safe patient ID
      const safeBed = cleanBed.replace(/[^a-zA-Z0-9]/g, '_');
      const randomSuffix = Math.random().toString(36).substring(2, 7);
      const id = `pat_${safeBed}_${randomSuffix}`;
      const now = Date.now();
      const tare = calibrations[cleanBed]?.tareWeight ?? 30;
      const factor = calibrations[cleanBed]?.calibrationFactor ?? 1.0;

      const details: PatientDetails = {
        id,
        bedNo: cleanBed,
        patientName: cleanName,
        fluidType: data.fluidType,
        initialVolume: data.initialVolume,
        prescribedDripRate: data.prescribedDripRate,
        dropFactor,
        startTime: now,
        stopTime: null,
        monitoring: true,
        notes: data.notes || '',
        tareWeight: tare,
        calibrationFactor: factor,
      };

      const input: PatientInput = {
        esp32Status: 'DISCONNECTED',
        lastUpdated: 0,
        loadCell: { rawValue: 0, weight: 0 },
        irSensor: { dropCount: 0, lastDropTimestamp: 0, sensorStatus: 'NO_SIGNAL' },
        pulseSensor: { heartRateRaw: 0, spo2Raw: 0, sensorStatus: 'NO_SIGNAL' },
      };

      const output: PatientOutput = {
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

      const current: SensorReading = {
        loadCellRaw: 0,
        loadCellWeight: 0,
        weight: 0,
        remainingVolume: 0,
        volume: 0,
        remainingPercent: 0,
        remainingPercentage: 0,
        dropRate: 0,
        dripRate: 0,
        dropCount: 0,
        irDropCount: 0,
        totalDrops: 0,
        flowRate: 0,
        etaMinutes: null,
        status: 'NO_DATA',
        sensorQuality: 'NO_DATA',
        esp32Status: 'DISCONNECTED',
        lastUpdated: 0,
        pulseBpm: 0,
        pulse: 0,
        pulseRate: 0,
        pulseStatus: 'NO_PULSE_DATA',
        pulseSensorQuality: 'NO_SIGNAL',
        pulseLastUpdated: 0,
        spo2: 0,
      };

      const newPatient: Patient = {
        details,
        input,
        output,
        current,
        logs: [],
        alerts: [],
        events: [
          {
            id: `evt_${now}`,
            patientId: id,
            bedNo: cleanBed,
            patientName: cleanName,
            type: 'MONITORING_STARTED',
            severity: 'INFO',
            timestamp: now,
            message: `Monitoring initiated for ${cleanName} (Bed ${cleanBed}, ${data.initialVolume} mL ${data.fluidType} at ${data.prescribedDripRate} dpm). Waiting for ESP32 sensor input...`,
          },
        ],
      };

      // Step 3 & 4: Write to Firebase Realtime Database
      await writePatientToFirebase(newPatient);

      // Step 5: Update Local State & Navigate
      setPatients((prev) => [
        newPatient,
        ...prev.filter(
          (p) =>
            p &&
            p.details &&
            p.details.id !== id &&
            String(p.details.bedNo || '').toLowerCase() !== cleanBed.toLowerCase()
        ),
      ]);

      setCurrentPatientId(id);
      setCurrentView('MONITORING');

      return id;
    },
    [calibrations]
  );

  const updatePatientDetails = useCallback(
    async (
      patientId: string,
      data: {
        bedNo: string;
        patientName: string;
        fluidType: IVFluidType;
        initialVolume: number;
        prescribedDripRate: number;
        dropFactor: number;
        notes?: string;
      }
    ): Promise<void> => {
      // Step 1: Validation
      const cleanBed = (data.bedNo || '').trim();
      const cleanName = (data.patientName || '').trim();
      if (!cleanBed) {
        throw new Error('Bed Number is required.');
      }
      if (!cleanName) {
        throw new Error('Patient Name is required.');
      }
      if (!data.initialVolume || isNaN(data.initialVolume) || data.initialVolume <= 0 || data.initialVolume > 5000) {
        throw new Error('Please enter a valid initial IV volume (10 to 5000 mL).');
      }
      if (!data.prescribedDripRate || isNaN(data.prescribedDripRate) || data.prescribedDripRate <= 0 || data.prescribedDripRate > 200) {
        throw new Error('Please enter a valid prescribed drip rate (1 to 200 dpm).');
      }
      const dropFactor = data.dropFactor && !isNaN(data.dropFactor) && data.dropFactor > 0 ? data.dropFactor : 20;

      // Find target patient
      const existing = patients.find((p) => p?.details?.id === patientId);
      if (!existing) {
        throw new Error('Patient record not found.');
      }

      const updatedDetails: PatientDetails = {
        ...existing.details,
        bedNo: cleanBed,
        patientName: cleanName,
        fluidType: data.fluidType,
        initialVolume: data.initialVolume,
        prescribedDripRate: data.prescribedDripRate,
        dropFactor,
        notes: data.notes !== undefined ? data.notes : existing.details.notes,
      };

      // Step 2: Write updated details to Firebase RTDB
      await updatePatientDetailsInFirebase(patientId, updatedDetails);

      // Step 3: Update local state while preserving all monitoring data, sensor inputs, logs, and alerts
      setPatients((prev) =>
        prev.map((p) => {
          if (p?.details?.id === patientId) {
            const reprocessed = processPatientData(
              {
                ...p,
                details: updatedDetails,
              },
              p.input
            );
            return reprocessed;
          }
          return p;
        })
      );
    },
    [patients, processPatientData]
  );

  const stopMonitoring = useCallback(async (patientId: string) => {
    const now = Date.now();
    // Clear state-transition condition tracking for this stopped patient
    alertStateMachineRef.current.resetPatient(patientId);

    setPatients((prev) =>
      prev.map((p) => {
        if (p?.details?.id === patientId) {
          const updatedDetails: PatientDetails = {
            ...p.details,
            monitoring: false,
            stopTime: now,
          };
          const endEvent: PatientEvent = {
            id: `evt_${now}`,
            patientId,
            bedNo: p.details.bedNo || '',
            patientName: p.details.patientName || 'Patient',
            type: 'MONITORING_STOPPED',
            severity: 'INFO',
            timestamp: now,
            message: `Monitoring stopped by user. Final volume: ${p.output?.remainingVolume ?? p.current?.volume ?? 0} mL (${p.output?.remainingPercentage ?? p.current?.remainingPercentage ?? 0}%).`,
          };
          return {
            ...p,
            details: updatedDetails,
            output: {
              ...p.output,
              ivStatus: 'MONITORING_STOPPED',
              pulseStatus: 'STOPPED',
              dripRate: 0,
              flowRate: 0,
              eta: '--',
            },
            current: {
              ...p.current,
              status: 'MONITORING_STOPPED',
              esp32Status: 'DISCONNECTED',
              dripRate: 0,
              pulseStatus: 'NO_PULSE_DATA',
            },
            alerts: (Array.isArray(p.alerts) ? p.alerts : []).map((a) =>
              !a.acknowledged ? { ...a, acknowledged: true, acknowledgedAt: now } : a
            ),
            events: [endEvent, ...(Array.isArray(p.events) ? p.events : [])],
          };
        }
        return p;
      })
    );

    await updatePatientMonitoringStatus(patientId, false);
  }, []);

  const startMonitoring = useCallback(async (patientId: string) => {
    const now = Date.now();
    setPatients((prev) =>
      prev.map((p) => {
        if (p?.details?.id === patientId) {
          const updatedDetails: PatientDetails = {
            ...p.details,
            monitoring: true,
            stopTime: null,
          };
          const startEvent: PatientEvent = {
            id: `evt_${now}`,
            patientId,
            bedNo: p.details.bedNo || '',
            patientName: p.details.patientName || 'Patient',
            type: 'MONITORING_STARTED',
            severity: 'INFO',
            timestamp: now,
            message: `Monitoring resumed for ${p.details.patientName} (Bed ${p.details.bedNo}). Telemetry and alerts active.`,
          };
          return {
            ...p,
            details: updatedDetails,
            output: {
              ...p.output,
              ivStatus: 'NORMAL',
              lastCalculated: now,
            },
            current: {
              ...p.current,
              status: 'NORMAL',
              lastUpdated: now,
            },
            events: [startEvent, ...(Array.isArray(p.events) ? p.events : [])],
          };
        }
        return p;
      })
    );

    await updatePatientMonitoringStatus(patientId, true);
  }, []);

  const acknowledgeAlert = useCallback((alertId: string) => {
    playAlertChime('ACK');
    alertStateMachineRef.current.acknowledgeById(alertId);

    setPatients((prev) =>
      prev.map((p) => {
        const targetAlert = (p.alerts || []).find((a) => a.id === alertId);
        if (targetAlert) {
          alertStateMachineRef.current.acknowledge(p.details.id, targetAlert.type);
        }
        return {
          ...p,
          alerts: (p.alerts || []).map((a) =>
            a.id === alertId ? { ...a, acknowledged: true, acknowledgedAt: Date.now() } : a
          ),
        };
      })
    );
  }, [playAlertChime]);

  const savePatientCalibration = useCallback(
    async (
      patientId: string,
      tareWeight: number,
      calibrationFactor: number,
      irSensitivity: number = 8
    ) => {
      const now = Date.now();
      const targetPatient = patients.find((p) => p?.details?.id === patientId);
      const bedNo = targetPatient?.details?.bedNo;

      // 1. Update calibrations dictionary state
      if (bedNo) {
        setCalibrations((prev) => ({
          ...prev,
          [bedNo]: {
            bedNo,
            tareWeight,
            calibrationFactor,
            irSensitivity,
            lastCalibrated: now,
          },
        }));
      }

      // 2. Write to Firebase at /patients/{patientId}/calibration and update details in Firebase
      await writePatientCalibrationToFirebase(patientId, {
        tareWeight,
        calibrationFactor,
        irSensitivity,
        lastCalibrated: now,
        bedNo,
      });

      // 3. Immediately update patient in local state & reprocess patient calculations with new tare/calibration factor
      setPatients((prev) =>
        prev.map((p) => {
          if (p?.details?.id === patientId) {
            const updatedDetails: PatientDetails = {
              ...p.details,
              tareWeight,
              calibrationFactor,
            };
            return processPatientData(
              {
                ...p,
                details: updatedDetails,
              },
              p.input
            );
          }
          return p;
        })
      );
    },
    [patients, processPatientData]
  );

  const saveBedCalibration = useCallback(
    (
      bedNo: string,
      tareWeight: number,
      calibrationFactor: number,
      irSensitivity: number
    ) => {
      const now = Date.now();
      setCalibrations((prev) => ({
        ...prev,
        [bedNo]: {
          bedNo,
          tareWeight,
          calibrationFactor,
          irSensitivity,
          lastCalibrated: now,
        },
      }));

      // Find any active patient assigned to this bed and sync calibration
      const matchingPatient = patients.find(
        (p) => String(p?.details?.bedNo).toLowerCase() === String(bedNo).toLowerCase()
      );
      if (matchingPatient?.details?.id) {
        savePatientCalibration(
          matchingPatient.details.id,
          tareWeight,
          calibrationFactor,
          irSensitivity
        );
      }
    },
    [patients, savePatientCalibration]
  );

  const updateFirebaseSettings = useCallback((config: Partial<FirebaseConfig>) => {
    saveFirebaseConfig(config);
    const updated = getSavedFirebaseConfig();
    setFirebaseConfig(updated);
    setFirebaseValidation(validateFirebaseConfig(updated));
  }, []);

  const wipeAllData = useCallback(async (): Promise<{ success: boolean; message: string }> => {
    // 1. Wipe Firebase Realtime Database
    const res = await deleteAllFirebaseData();

    // 2. Wipe Local State, Condition Tracker & Storage
    alertStateMachineRef.current.clear();
    setPatients([]);
    setCalibrations({});
    setCurrentPatientId(null);
    try {
      localStorage.setItem(STORAGE_KEY_PATIENTS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEY_CALIBRATION, JSON.stringify({}));
    } catch (e) {
      console.warn('Could not clear localStorage keys', e);
    }

    return res;
  }, []);

  return (
    <MonitoringContext.Provider
      value={{
        patients,
        activePatients,
        systemStatus,
        activeAlerts,
        criticalAlertQueue,
        currentPatientId,
        currentView,
        audioAlertsEnabled,
        calibrations,
        firebaseConfig,
        firebaseValidation,
        setCurrentView,
        selectPatient,
        toggleAudioAlerts,
        addPatient,
        updatePatientDetails,
        stopMonitoring,
        startMonitoring,
        acknowledgeAlert,
        saveBedCalibration,
        savePatientCalibration,
        updateFirebaseSettings,
        wipeAllData,
      }}
    >
      {children}
    </MonitoringContext.Provider>
  );
}

export function useMonitoring() {
  const context = useContext(MonitoringContext);
  if (!context) {
    throw new Error('useMonitoring must be used within a MonitoringProvider');
  }
  return context;
}
