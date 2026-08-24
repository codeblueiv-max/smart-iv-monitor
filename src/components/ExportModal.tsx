import React, { useState } from 'react';
import { Patient } from '../types';
import { Download, FileText, FileSpreadsheet, X, Check, Calendar, Users, CheckSquare, Heart } from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { formatETA } from '../utils/calculations';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  patients: Patient[];
  defaultSelectedPatientId?: string | null;
}

export function ExportModal({
  isOpen,
  onClose,
  patients,
  defaultSelectedPatientId,
}: ExportModalProps) {
  const [patientScope, setPatientScope] = useState<'SELECTED' | 'ALL'>(
    defaultSelectedPatientId ? 'SELECTED' : 'ALL'
  );
  const [selectedPatientIds, setSelectedPatientIds] = useState<string[]>(
    defaultSelectedPatientId ? [defaultSelectedPatientId] : patients.map((p) => p.details.id)
  );
  const [dateRange, setDateRange] = useState<'TODAY' | '7DAYS' | '30DAYS' | 'ALL'>('ALL');
  const [format, setFormat] = useState<'CSV' | 'XLSX' | 'PDF'>('CSV');
  const [includeReadings, setIncludeReadings] = useState(true);
  const [includeAlerts, setIncludeAlerts] = useState(true);
  const [includeEvents, setIncludeEvents] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen) return null;

  const targetPatients =
    patientScope === 'ALL'
      ? patients
      : patients.filter((p) => selectedPatientIds.includes(p.details.id));

  const togglePatientSelect = (id: string) => {
    setSelectedPatientIds((prev) =>
      prev.includes(id) ? prev.filter((pId) => pId !== id) : [...prev, id]
    );
  };

  const handleExport = async () => {
    if (targetPatients.length === 0) {
      alert('Please select at least one patient to export.');
      return;
    }

    setIsExporting(true);
    try {
      const now = Date.now();
      let dateCutoff = 0;
      if (dateRange === 'TODAY') dateCutoff = now - 24 * 3600000;
      else if (dateRange === '7DAYS') dateCutoff = now - 7 * 24 * 3600000;
      else if (dateRange === '30DAYS') dateCutoff = now - 30 * 24 * 3600000;

      if (format === 'CSV') {
        exportCSV(targetPatients, dateCutoff);
      } else if (format === 'XLSX') {
        exportExcel(targetPatients, dateCutoff);
      } else if (format === 'PDF') {
        exportPDF(targetPatients, dateCutoff);
      }

      setTimeout(() => {
        setIsExporting(false);
        onClose();
      }, 500);
    } catch (e) {
      console.error('Export failed:', e);
      alert('Export failed. Please try again.');
      setIsExporting(false);
    }
  };

  const exportCSV = (pList: Patient[], cutoff: number) => {
    const headers = [
      'Timestamp',
      'DateTime',
      'Patient Name',
      'Bed Number',
      'IV Fluid Type',
      'Initial Volume (mL)',
      'Current Volume (mL)',
      'Remaining %',
      'Drip Rate (dpm)',
      'Flow Rate (mL/min)',
      'Total Drops',
      'Pulse Rate (BPM)',
      'Pulse Status',
      'Pulse Sensor Quality',
      'ETA (HH:MM)',
      'Status',
      'Sensor Quality',
      'ESP32 Status',
      'Alert Triggered',
    ];

    const rows: string[][] = [];

    pList.forEach((patient) => {
      const filteredLogs = patient.logs.filter((l) => l.timestamp >= cutoff);
      filteredLogs.forEach((log) => {
        rows.push([
          log.timestamp.toString(),
          new Date(log.timestamp).toISOString(),
          `"${patient.details.patientName.replace(/"/g, '""')}"`,
          `"${patient.details.bedNo}"`,
          `"${patient.details.fluidType}"`,
          patient.details.initialVolume.toString(),
          log.volume.toString(),
          log.remainingPercentage.toString(),
          log.dripRate.toString(),
          log.flowRate.toString(),
          log.totalDrops.toString(),
          log.pulseRate !== null && log.pulseRate !== undefined ? log.pulseRate.toString() : '""',
          `"${log.pulseStatus || (log.pulseRate ? 'NORMAL' : 'NO_PULSE_DATA')}"`,
          `"${log.pulseSensorQuality || 'GOOD'}"`,
          `"${formatETA(log.etaMinutes)}"`,
          log.status,
          log.sensorQuality,
          log.esp32Status,
          `"${log.alertTriggered || ''}"`,
        ]);
      });
    });

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Smart_IV_Pulse_Telemetry_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportExcel = (pList: Patient[], cutoff: number) => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Patient Details Summary
    const detailsData = pList.map((p) => ({
      'Patient ID': p.details.id,
      'Bed Number': p.details.bedNo,
      'Patient Name': p.details.patientName,
      'Fluid Type': p.details.fluidType,
      'Initial Volume (mL)': p.details.initialVolume,
      'Prescribed Drip Rate (dpm)': p.details.prescribedDripRate,
      'Drop Factor (drops/mL)': p.details.dropFactor,
      'Start Time': new Date(p.details.startTime).toLocaleString(),
      'Stop Time': p.details.stopTime ? new Date(p.details.stopTime).toLocaleString() : 'Active',
      'Monitoring Status': p.details.monitoring ? 'Active' : 'Completed',
      'Latest Volume (mL)': p.current.volume,
      'Latest Remaining %': p.current.remainingPercentage,
      'Latest Drip Rate (dpm)': p.current.dripRate,
      'Current Pulse (BPM)': p.current.pulseRate ?? 'N/A',
      'Pulse Status': p.current.pulseStatus || (p.current.pulseRate ? 'NORMAL' : 'NO_PULSE_DATA'),
      'Current IV Status': p.current.status,
    }));
    const wsDetails = XLSX.utils.json_to_sheet(detailsData);
    XLSX.utils.book_append_sheet(wb, wsDetails, 'Patient Details');

    // Sheet 2: Sensor Readings
    if (includeReadings) {
      const readingsData: Record<string, unknown>[] = [];
      pList.forEach((p) => {
        p.logs
          .filter((l) => l.timestamp >= cutoff)
          .forEach((log) => {
            readingsData.push({
              'Bed No': p.details.bedNo,
              'Patient Name': p.details.patientName,
              'Timestamp': new Date(log.timestamp).toLocaleString(),
              'Weight (g)': log.weight,
              'Volume (mL)': log.volume,
              'Remaining %': log.remainingPercentage,
              'Drip Rate (dpm)': log.dripRate,
              'Pulse Rate (BPM)': log.pulseRate ?? '',
              'Pulse Status': log.pulseStatus || (log.pulseRate ? 'NORMAL' : 'NO_PULSE_DATA'),
              'Pulse Quality': log.pulseSensorQuality || 'GOOD',
              'Flow Rate (mL/min)': log.flowRate,
              'Total Drops': log.totalDrops,
              'ETA': formatETA(log.etaMinutes),
              'IV Status': log.status,
              'Sensor Quality': log.sensorQuality,
              'ESP32 Status': log.esp32Status,
              'Alert': log.alertTriggered || '',
            });
          });
      });
      const wsReadings = XLSX.utils.json_to_sheet(readingsData);
      XLSX.utils.book_append_sheet(wb, wsReadings, 'Sensor Readings');
    }

    // Sheet 3: Alerts
    if (includeAlerts) {
      const alertsData: Record<string, unknown>[] = [];
      pList.forEach((p) => {
        p.alerts
          .filter((a) => a.timestamp >= cutoff)
          .forEach((a) => {
            alertsData.push({
              'Bed No': a.bedNo,
              'Patient Name': a.patientName,
              'Time': new Date(a.timestamp).toLocaleString(),
              'Type': a.type,
              'Severity': a.severity,
              'Message': a.message,
              'Suggested Action': a.suggestedAction,
              'Acknowledged': a.acknowledged ? 'Yes' : 'No',
              'Acknowledged At': a.acknowledgedAt ? new Date(a.acknowledgedAt).toLocaleString() : '',
            });
          });
      });
      const wsAlerts = XLSX.utils.json_to_sheet(alertsData);
      XLSX.utils.book_append_sheet(wb, wsAlerts, 'Alerts');
    }

    // Sheet 4: Events
    if (includeEvents) {
      const eventsData: Record<string, unknown>[] = [];
      pList.forEach((p) => {
        p.events
          .filter((e) => e.timestamp >= cutoff)
          .forEach((e) => {
            eventsData.push({
              'Bed No': e.bedNo,
              'Patient Name': e.patientName,
              'Time': new Date(e.timestamp).toLocaleString(),
              'Event Type': e.type,
              'Severity': e.severity,
              'Message': e.message,
            });
          });
      });
      const wsEvents = XLSX.utils.json_to_sheet(eventsData);
      XLSX.utils.book_append_sheet(wb, wsEvents, 'Events');
    }

    XLSX.writeFile(wb, `Smart_IV_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportPDF = (pList: Patient[], cutoff: number) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    pList.forEach((p, idx) => {
      if (idx > 0) doc.addPage();

      // Title & Header Banner
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, pageWidth, 28, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('SMART IV INFUSION & PULSE MONITORING REPORT', 14, 14);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Generated: ${new Date().toLocaleString()} | Clinical Telemetry Audit`, 14, 22);

      // Patient Summary Card
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(`PATIENT SUMMARY: ${String(p.details?.patientName || 'PATIENT').toUpperCase()} (BED ${p.details?.bedNo || '-'})`, 14, 38);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');

      const col1X = 14;
      const col2X = 110;
      let y = 46;

      doc.text(`IV Solution: ${p.details.fluidType}`, col1X, y);
      doc.text(`Initial Volume: ${p.details.initialVolume} mL`, col2X, y);
      y += 6;

      doc.text(`Prescribed Drip Rate: ${p.details.prescribedDripRate} dpm`, col1X, y);
      doc.text(`Drop Factor: ${p.details.dropFactor} drops/mL`, col2X, y);
      y += 6;

      const durMins = Math.round(((p.details.stopTime || Date.now()) - p.details.startTime) / 60000);
      const hours = Math.floor(durMins / 60);
      const mins = durMins % 60;
      doc.text(`Start Time: ${new Date(p.details.startTime).toLocaleString()}`, col1X, y);
      doc.text(`Monitoring Duration: ${hours}h ${mins}m`, col2X, y);
      y += 6;

      const avgDrip =
        p.logs.length > 0
          ? Math.round(p.logs.reduce((acc, l) => acc + l.dripRate, 0) / p.logs.length)
          : p.current.dripRate;

      doc.text(`Current / Final Volume: ${p.current.volume} mL (${Math.round(p.current.remainingPercentage ?? 0)}%)`, col1X, y);
      doc.text(`Current Pulse Rate: ${p.current.pulseRate ? `${p.current.pulseRate} BPM` : 'No Data'} (${p.current.pulseStatus || 'NORMAL'})`, col2X, y);
      y += 6;

      doc.text(`Final Diagnostic Status: ${p.current.status}`, col1X, y);
      doc.text(`ESP32 Link: ${p.current.esp32Status} | Sensor: ${p.current.sensorQuality}`, col2X, y);
      y += 12;

      // Section: Alert History
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('ALERTS & ABNORMAL EVENTS', 14, y);
      y += 6;

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');

      const filteredAlerts = p.alerts.filter((a) => a.timestamp >= cutoff);
      if (filteredAlerts.length === 0) {
        doc.text('No critical alerts logged for this patient.', 14, y);
        y += 8;
      } else {
        filteredAlerts.slice(0, 6).forEach((alert) => {
          doc.setFont('helvetica', 'bold');
          doc.text(
            `[${alert.severity}] ${new Date(alert.timestamp).toLocaleTimeString()}: ${alert.type}`,
            14,
            y
          );
          doc.setFont('helvetica', 'normal');
          doc.text(`  - ${alert.message} (${alert.suggestedAction})`, 14, y + 4);
          y += 9;
        });
      }

      y += 6;

      // Section: Time-to-Time Readings Snapshot
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('RECENT SENSOR READINGS (LOG ENTRIES)', 14, y);
      y += 6;

      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setFillColor(241, 245, 249);
      doc.rect(14, y - 4, pageWidth - 28, 6, 'F');
      doc.text('Time', 16, y);
      doc.text('Volume (mL)', 42, y);
      doc.text('Remaining %', 72, y);
      doc.text('Drip (dpm)', 102, y);
      doc.text('Pulse (BPM)', 132, y);
      doc.text('Pulse Stat', 160, y);
      doc.text('IV Stat', 185, y);
      y += 6;

      doc.setFont('helvetica', 'normal');
      const recentLogs = p.logs.filter((l) => l.timestamp >= cutoff).slice(-15);
      recentLogs.forEach((log) => {
        if (y > 275) return;
        const timeStr = new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        doc.text(timeStr, 16, y);
        doc.text(`${log.volume}`, 42, y);
        doc.text(`${Math.round(log.remainingPercentage)}%`, 72, y);
        doc.text(`${log.dripRate}`, 102, y);
        doc.text(`${log.pulseRate ?? '—'}`, 132, y);
        doc.text(`${log.pulseStatus || 'NORMAL'}`, 160, y);
        doc.text(`${log.status}`, 185, y);
        y += 5;
      });
    });

    doc.save(`Smart_IV_Pulse_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-slate-900 px-5 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">EXPORT TELEMETRY DATA</h2>
              <p className="text-xs text-slate-400">Download historical logs & patient records</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Export Format Selection */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700 block">1. Choose File Format</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setFormat('CSV')}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                  format === 'CSV'
                    ? 'border-emerald-500 bg-emerald-50/70 text-emerald-900 font-bold ring-1 ring-emerald-500'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <FileText className="w-5 h-5 text-emerald-600" />
                <span>CSV File</span>
                <span className="text-[10px] text-slate-400 font-normal">Raw Telemetry</span>
              </button>

              <button
                type="button"
                onClick={() => setFormat('XLSX')}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                  format === 'XLSX'
                    ? 'border-emerald-500 bg-emerald-50/70 text-emerald-900 font-bold ring-1 ring-emerald-500'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                <span>Excel (.xlsx)</span>
                <span className="text-[10px] text-slate-400 font-normal">Multi-Sheet</span>
              </button>

              <button
                type="button"
                onClick={() => setFormat('PDF')}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                  format === 'PDF'
                    ? 'border-emerald-500 bg-emerald-50/70 text-emerald-900 font-bold ring-1 ring-emerald-500'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <FileText className="w-5 h-5 text-rose-600" />
                <span>PDF Summary</span>
                <span className="text-[10px] text-slate-400 font-normal">Printable Doc</span>
              </button>
            </div>
          </div>

          {/* Patient Scope Selection */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700 block">2. Select Patients</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPatientScope('SELECTED')}
                className={`py-2 px-3 rounded-xl border text-center font-bold transition-all ${
                  patientScope === 'SELECTED'
                    ? 'border-sky-500 bg-sky-50 text-sky-900'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                Selected Patient(s) ({selectedPatientIds.length})
              </button>

              <button
                type="button"
                onClick={() => {
                  setPatientScope('ALL');
                  setSelectedPatientIds(patients.map((p) => p.details.id));
                }}
                className={`py-2 px-3 rounded-xl border text-center font-bold transition-all ${
                  patientScope === 'ALL'
                    ? 'border-sky-500 bg-sky-50 text-sky-900'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                All Patients ({patients.length})
              </button>
            </div>

            {patientScope === 'SELECTED' && (
              <div className="max-h-32 overflow-y-auto border border-slate-200 rounded-xl p-2 space-y-1 bg-slate-50 mt-2">
                {patients.map((p) => {
                  const isChecked = selectedPatientIds.includes(p.details.id);
                  return (
                    <div
                      key={p.details.id}
                      onClick={() => togglePatientSelect(p.details.id)}
                      className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="rounded text-sky-600 focus:ring-sky-500"
                      />
                      <span className="font-bold text-slate-800">Bed {p.details.bedNo}</span>
                      <span className="text-slate-600">— {p.details.patientName}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Date Range Selection */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700 block">3. Date Range</label>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { id: 'TODAY', label: 'Last 24h' },
                { id: '7DAYS', label: '7 Days' },
                { id: '30DAYS', label: '30 Days' },
                { id: 'ALL', label: 'All History' },
              ].map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setDateRange(r.id as any)}
                  className={`py-1.5 text-[11px] rounded-lg border font-semibold transition-all ${
                    dateRange === r.id
                      ? 'border-slate-800 bg-slate-800 text-white'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Included Sections */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700 block">4. Telemetry Modules to Include</label>
            <div className="grid grid-cols-3 gap-2">
              <label className="flex items-center gap-2 p-2 border border-slate-200 rounded-xl bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeReadings}
                  onChange={(e) => setIncludeReadings(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span className="font-semibold text-slate-700">IV & Pulse</span>
              </label>

              <label className="flex items-center gap-2 p-2 border border-slate-200 rounded-xl bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeAlerts}
                  onChange={(e) => setIncludeAlerts(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span className="font-semibold text-slate-700">Alerts Log</span>
              </label>

              <label className="flex items-center gap-2 p-2 border border-slate-200 rounded-xl bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeEvents}
                  onChange={(e) => setIncludeEvents(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span className="font-semibold text-slate-700">Events Log</span>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isExporting || targetPatients.length === 0}
            onClick={handleExport}
            className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Download className="w-4 h-4" />
            <span>{isExporting ? 'Generating...' : `Export ${format} Report`}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
