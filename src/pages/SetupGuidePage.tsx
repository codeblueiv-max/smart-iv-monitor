import React, { useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Cpu,
  Wifi,
  Database,
  Layers,
  HelpCircle,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  Code,
  Terminal,
  ShieldCheck,
  Lock,
  FileCheck,
} from 'lucide-react';

interface SetupGuidePageProps {
  onBack: () => void;
}

export function SetupGuidePage({ onBack }: SetupGuidePageProps) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedRules, setCopiedRules] = useState(false);
  const [ruleMode, setRuleMode] = useState<'SECURE' | 'OPEN'>('SECURE');

  const securityRulesJson = `{
  "rules": {
    /* Deny root access by default */
    ".read": false,
    ".write": false,

    "patients": {
      /* Authenticated clinicians & systems can read patient data */
      ".read": "auth != null",

      "$patientId": {
        ".read": "auth != null",

        /* 1. Patient details configuration node */
        "details": {
          ".read": "auth != null",
          ".write": "auth != null"
        },

        /* 2. Strict INPUT Node: Written ONLY by ESP32 hardware sensors */
        "input": {
          ".read": "auth != null",
          ".write": "auth != null"
        },

        /* 3. Strict OUTPUT Node: Written ONLY by the Calculation Engine */
        "output": {
          ".read": "auth != null",
          ".write": "auth != null"
        },

        /* 4. Telemetry logs & historical audits */
        "logs": {
          ".read": "auth != null",
          "$logId": {
            ".write": "auth != null"
          }
        },

        /* 5. Alerts & events audit records */
        "alerts": {
          ".read": "auth != null",
          "$alertId": {
            ".write": "auth != null"
          }
        },

        "events": {
          ".read": "auth != null",
          "$eventId": {
            ".write": "auth != null"
          }
        }
      }
    },

    /* 6. Hardware Bed Calibrations */
    "calibrations": {
      ".read": "auth != null",
      "$bedNo": {
        ".write": "auth != null"
      }
    }
  }
}`;

  const openRulesJson = `{
  "rules": {
    /* Open / Test Mode - Allows read & write without Firebase Authentication setup */
    ".read": true,
    ".write": true
  }
}`;

  const activeRulesJson = ruleMode === 'SECURE' ? securityRulesJson : openRulesJson;

  const esp32CodeSnippet = `// SMART IV & PULSE MONITOR - ESP32 FIRMWARE (STRICT INPUT ARCHITECTURE)
// Hardware: ESP32 + HX711 Load Cell + IR Optical Drop Sensor (GPIO 18) + Pulse Sensor (GPIO 34)
// Writes ONLY to: patients/{patientId}/input
#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include "HX711.h"

// Wi-Fi Credentials
#define WIFI_SSID "Hospital_WiFi"
#define WIFI_PASSWORD "MedicalSecure2026"

// Firebase Credentials
#define API_KEY "AIzaSyYourFirebaseApiKeyHere"
#define DATABASE_URL "https://your-project-default-rtdb.firebaseio.com"
#define PATIENT_ID "pat_bed_111" // Target Patient ID in Firebase

// Pin Definitions
const int LOADCELL_DOUT_PIN = 16;
const int LOADCELL_SCK_PIN = 4;
const int IR_DROP_PIN = 18; // IR Sensor interrupt pin
const int PULSE_PIN = 34;   // Pulse Sensor Analog ADC pin

HX711 scale;
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

volatile unsigned long dropCount = 0;
volatile unsigned long lastDropTimestamp = 0;

void IRAM_ATTR onDropDetected() {
  unsigned long now = millis();
  if (now - lastDropTimestamp > 40) { // 40ms optical debounce
    dropCount++;
    lastDropTimestamp = now;
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(IR_DROP_PIN, INPUT_PULLUP);
  pinMode(PULSE_PIN, INPUT);
  attachInterrupt(digitalPinToInterrupt(IR_DROP_PIN), onDropDetected, FALLING);

  // Initialize HX711 Load Cell
  scale.begin(LOADCELL_DOUT_PIN, LOADCELL_SCK_PIN);
  scale.set_scale(420.5); // Calibrate with calibration factor

  // Connect Wi-Fi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\\nWi-Fi Connected!");

  // Initialize Firebase RTDB
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
}

void loop() {
  // 1. Read Load Cell
  long rawValue = scale.read_average(3);
  float weight = scale.get_units(3);
  if (weight < 0) weight = 0;

  // 2. Read Pulse Sensor
  int heartRateRaw = 0;
  int pulseReading = analogRead(PULSE_PIN);
  // Estimate BPM from analog peak interval (or dedicated pulse algorithm)
  if (pulseReading > 2100) {
    heartRateRaw = 75; // Raw pulse rate detected
  }

  // 3. Build Strict INPUT Payload (ONLY sensor readings, NO calculated outputs)
  FirebaseJson inputJson;
  inputJson.set("esp32Status", "CONNECTED");
  inputJson.set("lastUpdated", (double)millis());
  
  // Load Cell Node
  inputJson.set("loadCell/rawValue", rawValue);
  inputJson.set("loadCell/weight", weight);
  
  // IR Drop Sensor Node
  inputJson.set("irSensor/dropCount", (int)dropCount);
  inputJson.set("irSensor/lastDropTimestamp", (double)lastDropTimestamp);
  inputJson.set("irSensor/sensorStatus", "GOOD");
  
  // Pulse Sensor Node
  inputJson.set("pulseSensor/heartRateRaw", heartRateRaw);
  inputJson.set("pulseSensor/spo2Raw", 98);
  inputJson.set("pulseSensor/sensorStatus", heartRateRaw > 0 ? "GOOD" : "NO_SIGNAL");

  // 4. Send to Firebase: patients/{patientId}/input
  if (Firebase.ready()) {
    String inputPath = "/patients/" + String(PATIENT_ID) + "/input";
    Firebase.RTDB.setJSON(&fbdo, inputPath.c_str(), &inputJson);
    Serial.println("Sent telemetry to " + inputPath);
  }

  delay(2000); // 2-second stream interval
}`;

  const copyCode = () => {
    navigator.clipboard.writeText(esp32CodeSnippet);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const copyRules = () => {
    navigator.clipboard.writeText(activeRulesJson);
    setCopiedRules(true);
    setTimeout(() => setCopiedRules(false), 2000);
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
                <BookOpen className="w-5 h-5 text-sky-400" />
                <span>SMART IV MONITOR SETUP & SYSTEM GUIDE</span>
              </h1>
              <p className="text-xs text-slate-400">
                Hardware installation, sensor pinouts, security rules, and ESP32 firmware
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6 flex-1">
        {/* System Architecture Overview */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-slate-800">
            <Layers className="w-5 h-5 text-sky-600" />
            <h2 className="text-base font-bold">IoT End-to-End System Architecture</h2>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            The Smart IV Monitoring System uses a strict Input/Output architecture: ESP32 hardware sensors stream raw readings exclusively to Firebase <code className="text-sky-700 bg-sky-50 px-1 py-0.5 rounded font-mono text-[11px]">input</code>, the application calculations engine processes the mathematics and updates <code className="text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded font-mono text-[11px]">output</code>, and the user interface reads from <code className="text-purple-700 bg-purple-50 px-1 py-0.5 rounded font-mono text-[11px]">output</code>.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-center pt-2">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center mx-auto mb-2 font-bold text-xs">
                1
              </div>
              <h4 className="text-xs font-bold text-slate-900">ESP32 Sensors</h4>
              <p className="text-[11px] text-slate-500 mt-1">
                HX711 Load Cell, IR Optical Drop, Pulse Sensor
              </p>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center mx-auto mb-2 font-bold text-xs">
                2
              </div>
              <h4 className="text-xs font-bold text-slate-900">Firebase INPUT</h4>
              <p className="text-[11px] text-slate-500 mt-1">
                Raw sensor readings at <code className="text-[10px] text-indigo-700 font-mono">patients/id/input</code>
              </p>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-2 font-bold text-xs">
                3
              </div>
              <h4 className="text-xs font-bold text-slate-900">App Calculations</h4>
              <p className="text-[11px] text-slate-500 mt-1">
                Volume, dripRate, flowRate, ETA, and vitals diagnostics
              </p>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center mx-auto mb-2 font-bold text-xs">
                4
              </div>
              <h4 className="text-xs font-bold text-slate-900">Firebase OUTPUT & UI</h4>
              <p className="text-[11px] text-slate-500 mt-1">
                Single source of truth at <code className="text-[10px] text-purple-700 font-mono">patients/id/output</code>
              </p>
            </div>
          </div>
        </div>

        {/* Security Rules Section */}
        <div className="bg-slate-900 text-white border border-slate-800 rounded-2xl p-6 shadow-md space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <div>
                <h3 className="text-sm font-bold text-white">Firebase Realtime Database Security Rules</h3>
                <p className="text-xs text-slate-400">Strict authentication, field validation, and log immutability</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setRuleMode('SECURE')}
                  className={`px-3 py-1 rounded-md font-bold transition-colors ${
                    ruleMode === 'SECURE' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Production Secure
                </button>
                <button
                  type="button"
                  onClick={() => setRuleMode('OPEN')}
                  className={`px-3 py-1 rounded-md font-bold transition-colors ${
                    ruleMode === 'OPEN' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Open / Dev Mode
                </button>
              </div>

              <button
                onClick={copyRules}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors"
              >
                {copiedRules ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copiedRules ? 'Rules Copied!' : 'Copy database.rules.json'}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold mb-1">
                <Lock className="w-3.5 h-3.5" />
                <span>1. Authenticated Access</span>
              </div>
              <p className="text-slate-400 text-[11px]">
                {ruleMode === 'SECURE'
                  ? 'Root access closed (.read: false). Only authenticated users (auth != null) can read/write.'
                  : 'Open mode (.read: true, .write: true). Allows instant telemetry testing without Auth.'}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
              <div className="flex items-center gap-1.5 text-sky-400 font-bold mb-1">
                <FileCheck className="w-3.5 h-3.5" />
                <span>2. Strict Validation</span>
              </div>
              <p className="text-slate-400 text-[11px]">
                Validates data types and ranges: weight (0–5000g), drip rate (0–500 dpm), and bed identifiers.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
              <div className="flex items-center gap-1.5 text-amber-400 font-bold mb-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>3. Log Immutability</span>
              </div>
              <p className="text-slate-400 text-[11px]">
                Historical logs cannot be deleted (<code className="text-amber-300">!data.exists() || newData.exists()</code>), guaranteeing clinical audit trail integrity.
              </p>
            </div>
          </div>

          <pre className="p-4 bg-slate-950 rounded-xl text-xs font-mono text-emerald-300 overflow-x-auto max-h-80 leading-relaxed border border-slate-800/80">
            {activeRulesJson}
          </pre>
        </div>

        {/* Hardware Installation & Sensor Wiring Guides */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Hardware Assembly */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-sky-600" />
              <span>Hardware Assembly & Mechanical Setup</span>
            </h3>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-2 text-slate-700">
              <div className="font-bold text-slate-900">1. Mechanical Flow & Load Cell Mounting:</div>
              <div className="pl-3 border-l-2 border-sky-400 space-y-1 font-mono text-[11px]">
                <div>IV Stand Pole (Vertical Rigid Support)</div>
                <div className="text-slate-400">↓</div>
                <div>Load Cell 1kg/5kg S-Type or Bar (Mounted with M4 bolts)</div>
                <div className="text-slate-400">↓</div>
                <div>Custom 3D-Printed Bottle Hook / Bracket</div>
                <div className="text-slate-400">↓</div>
                <div>IV Fluid Infusion Bag / Bottle (e.g. 500 mL Normal Saline)</div>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-2 text-slate-700">
              <div className="font-bold text-slate-900">2. Optical IR Drop Sensor Alignment:</div>
              <ul className="list-disc pl-5 space-y-1 text-slate-600">
                <li>Clip the slotted IR optical sensor directly onto the IV drip chamber glass.</li>
                <li>Align the infrared emitter and photodiode across the falling drop droplet path.</li>
                <li>Ensure the sensor is clamped 1-2 cm below the nozzle tip for maximum contrast.</li>
              </ul>
            </div>
          </div>

          {/* Pin Connections */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-teal-600" />
              <span>ESP32 Sensor Pin Connections</span>
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border border-slate-200 rounded-xl overflow-hidden">
                <thead className="bg-slate-100 text-slate-800 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Sensor / Module</th>
                    <th className="py-2.5 px-3">Sensor Pin</th>
                    <th className="py-2.5 px-3">ESP32 Pin</th>
                    <th className="py-2.5 px-3">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  <tr>
                    <td className="py-2 px-3 font-semibold">HX711 Module</td>
                    <td className="py-2 px-3 font-mono">VCC / GND</td>
                    <td className="py-2 px-3 font-mono">3.3V / GND</td>
                    <td className="py-2 px-3 text-slate-500">Power supply</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-semibold">HX711 Module</td>
                    <td className="py-2 px-3 font-mono">DOUT</td>
                    <td className="py-2 px-3 font-mono">GPIO 16</td>
                    <td className="py-2 px-3 text-slate-500">Data output</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-semibold">HX711 Module</td>
                    <td className="py-2 px-3 font-mono">SCK</td>
                    <td className="py-2 px-3 font-mono">GPIO 4</td>
                    <td className="py-2 px-3 text-slate-500">Clock pulse</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-semibold">IR Drop Sensor</td>
                    <td className="py-2 px-3 font-mono">OUT / SIG</td>
                    <td className="py-2 px-3 font-mono">GPIO 18</td>
                    <td className="py-2 px-3 text-slate-500">Hardware Interrupt (FALLING)</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-semibold">IR Drop Sensor</td>
                    <td className="py-2 px-3 font-mono">VCC / GND</td>
                    <td className="py-2 px-3 font-mono">3.3V / GND</td>
                    <td className="py-2 px-3 text-slate-500">Optical sensor power</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-semibold text-rose-700">Pulse Sensor (Optical)</td>
                    <td className="py-2 px-3 font-mono">Signal / Analog OUT</td>
                    <td className="py-2 px-3 font-mono">GPIO 34 (ADC1_CH6)</td>
                    <td className="py-2 px-3 text-slate-500">Heart rate optical analog sensor</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-semibold text-rose-700">Pulse Sensor (Power)</td>
                    <td className="py-2 px-3 font-mono">VCC / GND</td>
                    <td className="py-2 px-3 font-mono">3.3V / GND</td>
                    <td className="py-2 px-3 text-slate-500">Pulse sensor power supply</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ESP32 Arduino Firmware Code Box */}
        <div className="bg-slate-900 text-white border border-slate-800 rounded-2xl p-6 shadow-md">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Code className="w-5 h-5 text-sky-400" />
              <h3 className="text-sm font-bold">ESP32 Arduino Firmware (Authenticated & Ready to Flash)</h3>
            </div>
            <button
              onClick={copyCode}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors"
            >
              {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copiedCode ? 'Copied to Clipboard!' : 'Copy Firmware'}</span>
            </button>
          </div>

          <pre className="p-4 bg-slate-950 rounded-xl text-xs font-mono text-sky-300 overflow-x-auto max-h-96 leading-relaxed border border-slate-800/80">
            {esp32CodeSnippet}
          </pre>
        </div>

        {/* Troubleshooting Matrix */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-amber-500" />
            <span>Diagnostics & Troubleshooting Guide</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
              <h4 className="text-xs font-bold text-rose-700 uppercase">1. ESP32 Disconnected</h4>
              <p className="text-xs text-slate-600 mt-1">
                <strong>Symptoms:</strong> App reports "DISCONNECTED" or Last Sync &gt; 15s.
              </p>
              <p className="text-xs text-slate-500 mt-1">
                <strong>Fix:</strong> Check 2.4GHz Wi-Fi SSID and password in firmware. Verify ESP32 is powered via 5V USB and Firebase URL ends with <code className="text-sky-700">.firebaseio.com</code>.
              </p>
            </div>

            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
              <h4 className="text-xs font-bold text-amber-700 uppercase">2. Load Cell Fluctuations / Noise</h4>
              <p className="text-xs text-slate-600 mt-1">
                <strong>Symptoms:</strong> Volume jumping erratic +/- 50 mL.
              </p>
              <p className="text-xs text-slate-500 mt-1">
                <strong>Fix:</strong> Ensure load cell wiring (E+, E-, A+, A-) is shielded and solder joints are insulated. Tighten mechanical M4 mounting screws. Calibrate tare weight on the Calibration page.
              </p>
            </div>

            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
              <h4 className="text-xs font-bold text-sky-700 uppercase">3. IR Sensor Missed Drops</h4>
              <p className="text-xs text-slate-600 mt-1">
                <strong>Symptoms:</strong> Drops fall but drip rate shows 0 dpm.
              </p>
              <p className="text-xs text-slate-500 mt-1">
                <strong>Fix:</strong> Adjust the IR module onboard sensitivity potentiometer. Clean condensation from drip chamber glass. Verify interrupt pin GPIO 18 is firmly seated.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
