import React, { useState } from 'react';
import { MonitoringProvider, useMonitoring } from './context/MonitoringContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { DashboardPage } from './pages/DashboardPage';
import { PatientMonitoringPage } from './pages/PatientMonitoringPage';
import { PatientLogsPage } from './pages/PatientLogsPage';
import { SetupGuidePage } from './pages/SetupGuidePage';
import { CalibrationPage } from './pages/CalibrationPage';
import { EmergencyPopup } from './components/EmergencyPopup';
import { AddPatientModal } from './components/AddPatientModal';
import { StopMonitoringConfirmModal } from './components/StopMonitoringConfirmModal';
import { FirebaseSettingsModal } from './components/FirebaseSettingsModal';

function MainApp() {
  const {
    currentView,
    setCurrentView,
    criticalAlertQueue,
    acknowledgeAlert,
    stopMonitoring,
    audioAlertsEnabled,
    toggleAudioAlerts,
    addPatient,
    firebaseConfig,
    updateFirebaseSettings,
    selectPatient,
  } = useMonitoring();

  const [isAddPatientOpen, setIsAddPatientOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [stopConfirmData, setStopConfirmData] = useState<{
    isOpen: boolean;
    patientId: string;
    patientName: string;
    bedNo: string;
  }>({
    isOpen: false,
    patientId: '',
    patientName: '',
    bedNo: '',
  });

  const handleOpenStopModal = (patientId: string, patientName: string, bedNo: string) => {
    setStopConfirmData({
      isOpen: true,
      patientId,
      patientName,
      bedNo,
    });
  };

  const handleConfirmStop = async () => {
    if (stopConfirmData.patientId) {
      await stopMonitoring(stopConfirmData.patientId);
    }
    setStopConfirmData({ isOpen: false, patientId: '', patientName: '', bedNo: '' });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased selection:bg-sky-500 selection:text-white relative">
      {/* View Switcher */}
      {currentView === 'DASHBOARD' && (
        <DashboardPage
          onOpenAddPatient={() => setIsAddPatientOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
      )}

      {currentView === 'MONITORING' && (
        <PatientMonitoringPage
          onBack={() => setCurrentView('DASHBOARD')}
          onOpenStopModal={handleOpenStopModal}
        />
      )}

      {currentView === 'LOGS' && (
        <PatientLogsPage onBack={() => setCurrentView('DASHBOARD')} />
      )}

      {currentView === 'SETUP' && (
        <SetupGuidePage onBack={() => setCurrentView('DASHBOARD')} />
      )}

      {currentView === 'CALIBRATION' && (
        <CalibrationPage onBack={() => setCurrentView('DASHBOARD')} />
      )}

      {/* Persistent Critical / Emergency Popup */}
      <EmergencyPopup
        alerts={criticalAlertQueue}
        onAcknowledge={acknowledgeAlert}
        onStopMonitoring={handleOpenStopModal}
        audioAlertsEnabled={audioAlertsEnabled}
        onToggleAudio={toggleAudioAlerts}
        onViewPatient={(patientId) => {
          selectPatient(patientId);
        }}
      />

      {/* Add Patient Modal */}
      <AddPatientModal
        isOpen={isAddPatientOpen}
        onClose={() => setIsAddPatientOpen(false)}
        onAdd={addPatient}
      />

      {/* Stop Monitoring Confirmation Modal */}
      <StopMonitoringConfirmModal
        isOpen={stopConfirmData.isOpen}
        patientName={stopConfirmData.patientName}
        bedNo={stopConfirmData.bedNo}
        onConfirm={handleConfirmStop}
        onCancel={() =>
          setStopConfirmData({ isOpen: false, patientId: '', patientName: '', bedNo: '' })
        }
      />

      {/* Firebase & System Configuration Modal */}
      <FirebaseSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={firebaseConfig}
        onSave={updateFirebaseSettings}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MonitoringProvider>
        <MainApp />
      </MonitoringProvider>
    </ErrorBoundary>
  );
}
