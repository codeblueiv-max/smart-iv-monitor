import React, { useState } from 'react';
import { Database, CheckCircle, X, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { FirebaseConfig, sanitizeDatabaseURL, deleteAllFirebaseData } from '../services/firebase';
import { useMonitoring } from '../context/MonitoringContext';

interface FirebaseSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: FirebaseConfig;
  onSave: (config: Partial<FirebaseConfig>) => void;
}

export function FirebaseSettingsModal({
  isOpen,
  onClose,
  config,
  onSave,
}: FirebaseSettingsModalProps) {
  const { wipeAllData } = useMonitoring();
  const [apiKey, setApiKey] = useState(config.apiKey);
  const [databaseURL, setDatabaseURL] = useState(config.databaseURL);
  const [projectId, setProjectId] = useState(config.projectId);
  const [authDomain, setAuthDomain] = useState(config.authDomain);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = sanitizeDatabaseURL(databaseURL);
    onSave({
      apiKey: apiKey.trim(),
      databaseURL: cleanUrl,
      projectId: projectId.trim(),
      authDomain: authDomain.trim(),
    });
    setDatabaseURL(cleanUrl);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 800);
  };

  const handleDeleteAllFirebaseData = async () => {
    setIsDeleting(true);
    setDeleteStatus(null);
    try {
      const res = await wipeAllData();
      if (res.success) {
        setDeleteStatus('Successfully deleted all data from Firebase RTDB and reset workspace.');
        setDeleteConfirm(false);
      } else {
        setDeleteStatus(`Notice: ${res.message}`);
      }
    } catch (err: any) {
      setDeleteStatus(`Error: ${err?.message || 'Failed to wipe data'}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">FIREBASE RTDB CONFIGURATION</h2>
              <p className="text-xs text-slate-400">Direct ESP32 Realtime Database Connection</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4">
          {/* Database URL */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Firebase Realtime Database URL <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="url"
                required
                value={databaseURL}
                onChange={(e) => setDatabaseURL(e.target.value)}
                placeholder="https://your-project-default-rtdb.firebaseio.com"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              The root database endpoint where the ESP32 pushes sensor readings to <code className="text-slate-600 bg-slate-100 px-1 py-0.5 rounded">/patients/&#123;patientId&#125;/current</code>
            </p>
          </div>

          {/* API Key */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Firebase Web API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />
          </div>

          {/* Project ID */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Project ID
            </label>
            <input
              type="text"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              placeholder="smart-iv-monitoring"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />
          </div>

          {/* Auth Domain */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Auth Domain (Optional)
            </label>
            <input
              type="text"
              value={authDomain}
              onChange={(e) => setAuthDomain(e.target.value)}
              placeholder="smart-iv-monitoring.firebaseapp.com"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />
          </div>

          {/* Database Reset / Clear Section */}
          <div className="pt-3 border-t border-slate-200">
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 text-rose-700 font-bold text-xs uppercase tracking-wide">
                  <Trash2 className="w-4 h-4 text-rose-600" />
                  <span>Delete All Firebase Data</span>
                </div>
              </div>
              <p className="text-[11px] text-rose-600 mb-3 leading-relaxed">
                Permanently wipes all patient records, live telemetry streams, alerts, events, and calibration data from your Firebase Realtime Database and resets the local dashboard.
              </p>

              {deleteStatus && (
                <div className="mb-3 p-2 bg-white rounded-lg border border-rose-200 text-xs font-medium text-slate-700">
                  {deleteStatus}
                </div>
              )}

              {deleteConfirm ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={handleDeleteAllFirebaseData}
                    className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Deleting Firebase Data...</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Confirm Permanent Delete</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => setDeleteConfirm(false)}
                    className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(true)}
                  className="px-3.5 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-700 border border-rose-300 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Wipe All Firebase RTDB Data</span>
                </button>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
            >
              {savedSuccess ? (
                <>
                  <CheckCircle className="w-4 h-4 text-emerald-300" />
                  <span>Saved!</span>
                </>
              ) : (
                <span>Save Configuration</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
