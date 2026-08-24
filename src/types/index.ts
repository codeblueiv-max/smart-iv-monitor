export type PatientStatus =
  | 'NORMAL'
  | 'RUNNING'
  | 'LOW_VOLUME'
  | 'CRITICAL_VOLUME'
  | 'ABNORMAL_FLOW'
  | 'POSSIBLE_LEAKAGE'
  | 'POSSIBLE_OCCLUSION'
  | 'POSSIBLE_EXCESSIVE_FLOW'
  | 'SENSOR_UNSTABLE'
  | 'ESP32_DISCONNECTED'
  | 'NO_DATA'
  | 'LOW_PULSE'
  | 'HIGH_PULSE'
  | 'ABNORMAL'
  | 'NO_PULSE_DATA'
  | 'MONITORING_STOPPED'
  | 'STOPPED';

export type PulseStatus =
  | 'NORMAL'
  | 'ABNORMAL'
  | 'LOW PULSE'
  | 'HIGH PULSE'
  | 'NO PULSE DATA'
  | 'LOW_PULSE'
  | 'HIGH_PULSE'
  | 'NO_PULSE_DATA'
  | 'STOPPED'
  | 'MONITORING_STOPPED';

export type PulseSensorQuality = 'GOOD' | 'UNSTABLE' | 'POOR' | 'NO_SIGNAL' | 'FAIR';

export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export type SensorQuality = 'GOOD' | 'UNSTABLE' | 'INVALID' | 'WARNING' | 'CRITICAL' | 'NO_DATA';

export type ConnectionState = 'CONNECTED' | 'UNSTABLE' | 'DISCONNECTED';

export type IVFluidType = 'Normal Saline' | 'Dextrose (D5W)' | "Ringer's Lactate" | '0.45% Saline' | 'Other';

export interface PatientDetails {
  id: string;
  bedNo: string;
  patientName: string;
  fluidType: IVFluidType;
  initialVolume: number; // in mL
  prescribedDripRate: number; // in drops/min (dpm)
  dropFactor: number; // in drops/mL (standard is 15, 20 or 60 for microdrip)
  startTime: number;
  stopTime?: number | null;
  monitoring: boolean;
  notes?: string;
  tareWeight?: number; // Empty bottle weight in grams (e.g., 30g)
  calibrationFactor?: number; // grams per mL (approx 1.00 for saline)
}

export interface SensorReading {
  loadCellRaw?: number | null; // raw reading from HX711 load cell
  loadCellWeight?: number | null; // calibrated load cell weight in grams
  weight: number | null; // measured weight alias for backwards compatibility
  remainingVolume: number | null; // remaining IV volume in mL
  volume: number | null; // calculated volume alias for backwards compatibility
  remainingPercent?: number | null; // calculated 0-100%
  remainingPercentage: number | null; // calculated 0-100%
  dropCount?: number | null; // raw drop count from IR optical drop sensor
  irDropCount?: number | null; // raw drop count alias
  dropRate?: number | null; // drops per minute detected by IR sensor
  dripRate: number | null; // drops per minute alias
  totalDrops: number; // cumulative drops counted
  flowRate: number | null; // mL per minute (dripRate / dropFactor)
  etaMinutes: number | null; // estimated minutes until empty
  status: PatientStatus;
  sensorQuality: SensorQuality;
  esp32Status: ConnectionState;
  lastUpdated: number; // Unix timestamp in ms
  rawDripRate?: number;
  // Pulse / Heart Rate Sensor Telemetry
  pulseBpm?: number | null; // pulse heart rate in BPM
  pulse?: number | null; // pulse heart rate in BPM alias
  pulseRate?: number | null; // pulse rate alias in BPM
  pulseStatus?: PulseStatus | string | null; // NORMAL / ABNORMAL / NO PULSE DATA
  pulseSensorQuality?: PulseSensorQuality | string | null; // GOOD / UNSTABLE / POOR / NO_SIGNAL
  pulseLastUpdated?: number | null; // Unix timestamp in ms
  spo2?: number | null; // SpO2 Oxygen Saturation percentage (e.g. 98)
}

export interface PatientLogRecord {
  id: string;
  timestamp: number;
  loadCellRaw?: number | null;
  loadCellWeight?: number;
  weight: number;
  remainingVolume?: number;
  volume: number;
  remainingPercent?: number;
  remainingPercentage: number;
  dropCount?: number;
  irDropCount?: number;
  dropRate?: number;
  dripRate: number;
  flowRate: number;
  totalDrops: number;
  etaMinutes: number | null;
  status: PatientStatus;
  sensorQuality: SensorQuality;
  esp32Status: ConnectionState;
  alertTriggered?: string;
  // Pulse sensor historical log fields
  pulseBpm?: number | null;
  pulse?: number | null;
  pulseRate?: number | null;
  pulseStatus?: PulseStatus | string | null;
  pulseSensorQuality?: PulseSensorQuality | string | null;
  spo2?: number | null;
}

export interface Alert {
  id: string;
  patientId: string;
  bedNo: string;
  patientName: string;
  type: PatientStatus;
  severity: AlertSeverity;
  category?: 'IV' | 'PULSE' | 'SYSTEM';
  timestamp: number;
  message: string;
  suggestedAction: string;
  acknowledged: boolean;
  acknowledgedAt?: number | null;
  readingsSnapshot?: {
    volume: number | null;
    remainingPercentage: number | null;
    dripRate: number | null;
    flowRate: number | null;
    etaMinutes: number | null;
    pulseRate?: number | null;
  };
}

export interface PatientEvent {
  id: string;
  patientId: string;
  bedNo: string;
  patientName: string;
  type: string;
  severity: AlertSeverity;
  timestamp: number;
  message: string;
  acknowledged?: boolean;
}

export interface LoadCellInput {
  rawValue: number;
  weight: number;
}

export interface IRSensorInput {
  dropCount: number;
  lastDropTimestamp: number;
  sensorStatus: string;
}

export interface PulseSensorInput {
  heartRateRaw: number;
  spo2Raw: number;
  sensorStatus: string;
}

export interface PatientInput {
  esp32Status: ConnectionState;
  lastUpdated: number;
  loadCell: LoadCellInput;
  irSensor: IRSensorInput;
  pulseSensor: PulseSensorInput;
}

export interface PatientOutput {
  remainingVolume: number;
  remainingPercentage: number;
  dropCount: number;
  dripRate: number;
  flowRate: number;
  eta: string;
  heartRate: number;
  spo2: number;
  ivStatus: PatientStatus;
  pulseStatus: PulseStatus;
  lastCalculated: number;
}

export interface Patient {
  details: PatientDetails;
  input: PatientInput;
  output: PatientOutput;
  current?: SensorReading; // alias for backwards compatibility
  logs: PatientLogRecord[];
  alerts: Alert[];
  events: PatientEvent[];
}

export interface SystemStatus {
  esp32Network: ConnectionState;
  firebase: ConnectionState;
  lastSyncTimestamp: number;
  activePatientsCount: number;
  criticalAlertsCount: number;
  missingEnvKeys?: string[];
  isFirebaseConfigValid?: boolean;
}

export interface BedCalibration {
  bedNo: string;
  tareWeight: number; // in grams
  calibrationFactor: number; // grams per mL
  irSensitivity: number; // 1-10
  lastCalibrated: number;
}
