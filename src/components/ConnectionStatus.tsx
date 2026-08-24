import React, { useState, useEffect } from 'react';
import { ConnectionState } from '../types';
import { Wifi, Database, Clock, Activity, AlertTriangle, Settings } from 'lucide-react';

interface ConnectionStatusProps {
  esp32Status: ConnectionState;
  firebaseStatus: ConnectionState;
  lastSyncTimestamp: number;
  missingKeys?: string[];
  isFirebaseConfigValid?: boolean;
  onOpenSettings?: () => void;
}

export function ConnectionStatus({
  esp32Status,
  firebaseStatus,
  lastSyncTimestamp,
  missingKeys = [],
  isFirebaseConfigValid = true,
  onOpenSettings,
}: ConnectionStatusProps) {
  const [timeAgo, setTimeAgo] = useState<string>('No data received');

  useEffect(() => {
    const updateAgo = () => {
      if (!lastSyncTimestamp || lastSyncTimestamp === 0) {
        setTimeAgo('No data received');
        return;
      }
      const seconds = Math.max(0, Math.floor((Date.now() - lastSyncTimestamp) / 1000));
      if (seconds < 2) setTimeAgo('just now');
      else if (seconds < 60) setTimeAgo(`${seconds}s ago`);
      else setTimeAgo(`${Math.floor(seconds / 60)}m ago`);
    };

    updateAgo();
    const interval = setInterval(updateAgo, 1000);
    return () => clearInterval(interval);
  }, [lastSyncTimestamp]);

  const renderStateDot = (state: ConnectionState, isMissingConfig = false) => {
    if (isMissingConfig) {
      return (
        <span className="inline-flex items-center gap-1.5 font-bold text-amber-700">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
          Config Required
        </span>
      );
    }

    switch (state) {
      case 'CONNECTED':
        return (
          <span className="inline-flex items-center gap-1.5 font-bold text-emerald-700">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs shadow-emerald-400 animate-pulse" />
            Connected
          </span>
        );
      case 'UNSTABLE':
        return (
          <span className="inline-flex items-center gap-1.5 font-bold text-amber-700">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
            Unstable
          </span>
        );
      case 'DISCONNECTED':
        return (
          <span className="inline-flex items-center gap-1.5 font-bold text-rose-600">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            Disconnected
          </span>
        );
    }
  };

  const showMissingConfigBanner = !isFirebaseConfigValid || missingKeys.length > 0;

  return (
    <div className="space-y-2">
      {/* Main Status Bar */}
      <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs md:text-sm">
          {/* System Title */}
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-sky-600" />
              <span>SMART IV MONITOR LINK</span>
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-900 border border-emerald-300">
              Firebase RTDB
            </span>
          </div>

          {/* Status Indicators */}
          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            <div className="flex items-center gap-2">
              <Wifi className="w-4 h-4 text-slate-400" />
              <span className="text-slate-500 font-medium">ESP32 SENSORS:</span>
              {renderStateDot(esp32Status)}
            </div>

            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-slate-400" />
              <span className="text-slate-500 font-medium">FIREBASE RTDB:</span>
              {renderStateDot(firebaseStatus, showMissingConfigBanner)}
            </div>

            <div className="flex items-center gap-1.5 text-slate-500">
              <Clock className="w-4 h-4 text-slate-400" />
              <span>LAST SYNC:</span>
              <span className="font-semibold text-slate-700">{timeAgo}</span>
            </div>

            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                className="text-xs text-sky-600 hover:text-sky-800 font-bold flex items-center gap-1 bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-200 transition-colors ml-auto"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Config</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Missing Environment Variables Diagnostic Alert */}
      {showMissingConfigBanner && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-3.5 text-xs text-amber-900 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <div>
              <span className="font-bold">Missing Firebase Environment Variables: </span>
              <span className="text-amber-800">
                Please set {missingKeys.map((k) => <code key={k} className="bg-amber-200/80 px-1.5 py-0.5 rounded font-mono font-bold mx-1">{k}</code>)} in your environment or enter your Database URL in Settings.
              </span>
            </div>
          </div>

          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="px-3 py-1 bg-amber-600 text-white font-bold rounded-lg hover:bg-amber-700 transition-colors text-xs shrink-0"
            >
              Configure Firebase RTDB
            </button>
          )}
        </div>
      )}
    </div>
  );
}
