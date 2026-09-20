import { AlertSeverity, PatientStatus } from '../types';

export interface AlertStateEntry {
  patientId: string;
  alertType: string;
  active: boolean;
  acknowledged: boolean;
  triggeredAt: number;
  alertId?: string;
  message?: string;
  severity?: AlertSeverity;
}

export type TransitionResult =
  | { type: 'TRIGGER'; entry: AlertStateEntry } // NORMAL -> ABNORMAL: Show popup once, play sound, push alert
  | { type: 'CONTINUING_ACTIVE'; entry: AlertStateEntry } // Still ABNORMAL: Update telemetry, DO NOT create new popup
  | { type: 'RECTIFIED'; entry: AlertStateEntry } // ABNORMAL -> NORMAL: Reset state to active=false, acknowledged=false
  | { type: 'INITIALIZED_ACTIVE'; entry: AlertStateEntry } // Cold load existing abnormal condition: set active=true without showing popup
  | { type: 'INACTIVE' }; // Continues to be normal

const STORAGE_KEY = 'smart_iv_alert_state_v3';

export class AlertStateMachine {
  // Maps `${patientId}::${alertType}` -> AlertStateEntry
  private states: Map<string, AlertStateEntry> = new Map();
  // Tracks consecutive readings per key for false-trigger debounce
  private consecutiveCounts: Map<string, number> = new Map();

  constructor() {
    this.loadFromStorage();
  }

  public static makeKey(patientId: string, alertType: string): string {
    return `${patientId}::${alertType}`;
  }

  /**
   * Loads saved alert states from localStorage to prevent popup spam on page reload / refresh
   */
  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          for (const [key, entry] of Object.entries(parsed)) {
            if (entry && typeof entry === 'object') {
              this.states.set(key, entry as AlertStateEntry);
            }
          }
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }

  /**
   * Persists current alert states to localStorage
   */
  private saveToStorage(): void {
    try {
      const obj: Record<string, AlertStateEntry> = {};
      for (const [key, entry] of this.states.entries()) {
        obj[key] = entry;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch {
      // Ignore localStorage errors
    }
  }

  /**
   * Retrieves current state for a given patient and alert type
   */
  public getState(patientId: string, alertType: string): AlertStateEntry | undefined {
    return this.states.get(AlertStateMachine.makeKey(patientId, alertType));
  }

  /**
   * Evaluates state transition for a specific alert type on a patient.
   * 
   * Strict Edge Detection & Debounce Rules:
   * 1. NORMAL -> ABNORMAL transition requires confirmation (default 2 consecutive readings).
   * 2. When confirmed, returns 'TRIGGER' -> Show popup ONCE, play sound ONCE, send notification ONCE.
   * 3. ABNORMAL -> ABNORMAL (Firebase syncs / re-renders):
   *    Returns 'CONTINUING_ACTIVE' -> DO NOT trigger a new popup or sound.
   * 4. ABNORMAL -> NORMAL (Condition returns to safe range):
   *    Returns 'RECTIFIED' -> Resets state (active=false, acknowledged=false, consecutiveCount=0).
   * 5. Cold Reload (Restored active state from storage):
   *    Returns 'CONTINUING_ACTIVE' or 'INITIALIZED_ACTIVE' -> Silent restoration without popups.
   */
  public evaluateCondition(
    patientId: string,
    alertType: string,
    isConditionActive: boolean,
    metadata?: {
      alertId?: string;
      message?: string;
      severity?: AlertSeverity;
    },
    requiredConsecutive: number = 2
  ): TransitionResult {
    const key = AlertStateMachine.makeKey(patientId, alertType);
    const current = this.states.get(key);
    const currentCount = this.consecutiveCounts.get(key) || 0;

    if (!current) {
      // First time encountering this patientId + alertType
      if (isConditionActive) {
        const newCount = currentCount + 1;
        this.consecutiveCounts.set(key, newCount);

        if (newCount >= requiredConsecutive) {
          const now = Date.now();
          const newEntry: AlertStateEntry = {
            patientId,
            alertType,
            active: true,
            acknowledged: false,
            triggeredAt: now,
            alertId: metadata?.alertId,
            message: metadata?.message,
            severity: metadata?.severity,
          };
          this.states.set(key, newEntry);
          this.saveToStorage();
          return { type: 'TRIGGER', entry: newEntry };
        }
        return { type: 'INACTIVE' };
      } else {
        this.consecutiveCounts.set(key, 0);
        const initialEntry: AlertStateEntry = {
          patientId,
          alertType,
          active: false,
          acknowledged: false,
          triggeredAt: 0,
        };
        this.states.set(key, initialEntry);
        this.saveToStorage();
        return { type: 'INACTIVE' };
      }
    }

    if (isConditionActive) {
      if (!current.active) {
        // Condition is detected abnormal, waiting for confirmation count
        const newCount = currentCount + 1;
        this.consecutiveCounts.set(key, newCount);

        if (newCount >= requiredConsecutive) {
          // Edge transition: NORMAL -> ABNORMAL (Confirmed!)
          const now = Date.now();
          const newEntry: AlertStateEntry = {
            ...current,
            active: true,
            acknowledged: false,
            triggeredAt: now,
            alertId: metadata?.alertId || current.alertId,
            message: metadata?.message || current.message,
            severity: metadata?.severity || current.severity,
          };
          this.states.set(key, newEntry);
          this.saveToStorage();
          return { type: 'TRIGGER', entry: newEntry };
        }
        return { type: 'INACTIVE' };
      } else {
        // Condition continues active (ABNORMAL -> ABNORMAL across Firebase syncs)
        this.consecutiveCounts.set(key, requiredConsecutive);
        if (metadata?.alertId && !current.alertId) current.alertId = metadata.alertId;
        if (metadata?.message) current.message = metadata.message;
        if (metadata?.severity) current.severity = metadata.severity;
        this.saveToStorage();
        return { type: 'CONTINUING_ACTIVE', entry: current };
      }
    } else {
      // Condition is currently normal
      this.consecutiveCounts.set(key, 0);
      if (current.active) {
        // Edge transition: ABNORMAL -> NORMAL (Rectified)
        const rectifiedEntry: AlertStateEntry = {
          ...current,
          active: false,
          acknowledged: false,
          triggeredAt: 0,
        };
        this.states.set(key, rectifiedEntry);
        this.saveToStorage();
        return { type: 'RECTIFIED', entry: rectifiedEntry };
      }
      return { type: 'INACTIVE' };
    }
  }

  /**
   * User clicked "Acknowledge" for a specific alert.
   * Marks ONLY that specific alert type for that patient as acknowledged.
   * Keeps active=true so it won't re-trigger while condition remains abnormal.
   */
  public acknowledge(patientId: string, alertType: string): void {
    const key = AlertStateMachine.makeKey(patientId, alertType);
    const current = this.states.get(key);
    if (current) {
      current.acknowledged = true;
      this.saveToStorage();
    }
  }

  /**
   * Acknowledge by generated alert ID
   */
  public acknowledgeById(alertId: string): string | null {
    for (const [key, entry] of this.states.entries()) {
      if (entry.alertId === alertId) {
        entry.acknowledged = true;
        this.saveToStorage();
        return key;
      }
    }
    return null;
  }

  /**
   * Resets alert state for a specific patient and alert type
   */
  public resetAlert(patientId: string, alertType: string): void {
    const key = AlertStateMachine.makeKey(patientId, alertType);
    this.states.delete(key);
    this.consecutiveCounts.delete(key);
    this.saveToStorage();
  }

  /**
   * Clears state for a patient when monitoring is stopped or patient is removed
   */
  public resetPatient(patientId: string): void {
    for (const [key, entry] of this.states.entries()) {
      if (entry.patientId === patientId) {
        this.states.delete(key);
        this.consecutiveCounts.delete(key);
      }
    }
    this.saveToStorage();
  }

  /**
   * Clears all states (e.g. wipe data)
   */
  public clear(): void {
    this.states.clear();
    this.consecutiveCounts.clear();
    this.saveToStorage();
  }

  /**
   * Exports active unacknowledged entries
   */
  public getActiveUnacknowledged(): AlertStateEntry[] {
    const list: AlertStateEntry[] = [];
    for (const entry of this.states.values()) {
      if (entry.active && !entry.acknowledged) {
        list.push(entry);
      }
    }
    return list;
  }
}
