import React from 'react';
import { PatientStatus, AlertSeverity, PulseStatus } from '../types';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Droplets,
  Zap,
  ShieldAlert,
  Activity,
  WifiOff,
  Heart,
  StopCircle,
} from 'lucide-react';
import { getPulseStatusTheme } from '../utils/calculations';

interface StatusBadgeProps {
  status: PatientStatus;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export function StatusBadge({ status, size = 'md', showIcon = true }: StatusBadgeProps) {
  const getStatusConfig = () => {
    const rawStatus = typeof status === 'string' ? status : typeof status === 'object' && status !== null && 'status' in status ? String((status as any).status || '') : '';
    switch (rawStatus) {
      case 'NORMAL':
        return {
          label: 'NORMAL',
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          dot: 'bg-emerald-500',
          icon: CheckCircle2,
        };
      case 'LOW_VOLUME':
        return {
          label: 'LOW VOLUME',
          bg: 'bg-amber-50 text-amber-700 border-amber-300',
          dot: 'bg-amber-500 animate-pulse',
          icon: AlertTriangle,
        };
      case 'CRITICAL_VOLUME':
        return {
          label: 'CRITICAL LOW',
          bg: 'bg-rose-50 text-rose-700 border-rose-300 font-semibold',
          dot: 'bg-rose-600 animate-ping',
          icon: AlertCircle,
        };
      case 'POSSIBLE_OCCLUSION':
        return {
          label: 'POSSIBLE OCCLUSION',
          bg: 'bg-red-50 text-red-700 border-red-300 font-semibold',
          dot: 'bg-red-600 animate-pulse',
          icon: ShieldAlert,
        };
      case 'POSSIBLE_EXCESSIVE_FLOW':
        return {
          label: 'EXCESSIVE FLOW',
          bg: 'bg-rose-50 text-rose-800 border-rose-400 font-semibold',
          dot: 'bg-rose-600 animate-pulse',
          icon: Zap,
        };
      case 'POSSIBLE_LEAKAGE':
        return {
          label: 'POSSIBLE LEAKAGE',
          bg: 'bg-amber-50 text-amber-800 border-amber-400 font-semibold',
          dot: 'bg-amber-600',
          icon: Droplets,
        };
      case 'ABNORMAL_FLOW':
        return {
          label: 'ABNORMAL FLOW',
          bg: 'bg-amber-50 text-amber-800 border-amber-300',
          dot: 'bg-amber-500',
          icon: Activity,
        };
      case 'LOW_PULSE':
        return {
          label: 'LOW PULSE',
          bg: 'bg-amber-50 text-amber-800 border-amber-300 font-semibold',
          dot: 'bg-amber-500 animate-pulse',
          icon: Heart,
        };
      case 'HIGH_PULSE':
        return {
          label: 'HIGH PULSE',
          bg: 'bg-amber-50 text-amber-800 border-amber-300 font-semibold',
          dot: 'bg-amber-500 animate-pulse',
          icon: Heart,
        };
      case 'NO_PULSE_DATA':
        return {
          label: 'NO PULSE DATA',
          bg: 'bg-slate-100 text-slate-600 border-slate-200',
          dot: 'bg-slate-400',
          icon: Heart,
        };
      case 'SENSOR_UNSTABLE':
        return {
          label: 'SENSOR UNSTABLE',
          bg: 'bg-yellow-50 text-yellow-800 border-yellow-300',
          dot: 'bg-yellow-500',
          icon: AlertTriangle,
        };
      case 'ESP32_DISCONNECTED':
        return {
          label: 'DISCONNECTED',
          bg: 'bg-slate-100 text-slate-700 border-slate-300',
          dot: 'bg-slate-500',
          icon: WifiOff,
        };
      case 'NO_DATA':
        return {
          label: 'NO DATA',
          bg: 'bg-slate-100 text-slate-600 border-slate-200',
          dot: 'bg-slate-400',
          icon: WifiOff,
        };
      case 'MONITORING_STOPPED':
      case 'STOPPED':
        return {
          label: 'MONITORING STOPPED',
          bg: 'bg-slate-100 text-slate-600 border-slate-300 font-semibold',
          dot: 'bg-slate-400',
          icon: StopCircle,
        };
      default:
        return {
          label: typeof rawStatus === 'string' && rawStatus ? rawStatus.replace(/_/g, ' ') : 'NO DATA',
          bg: 'bg-slate-50 text-slate-700 border-slate-200',
          dot: 'bg-slate-400',
          icon: AlertCircle,
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5 font-medium',
    lg: 'text-sm px-3 py-1.5 gap-2 font-semibold',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border whitespace-nowrap ${sizeClasses[size]} ${config.bg}`}
    >
      {showIcon && <Icon className={size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-4 h-4' : 'w-3.5 h-3.5'} />}
      <span>{config.label}</span>
    </span>
  );
}

export function PulseStatusBadge({
  status,
  size = 'md',
  showIcon = true,
}: {
  status: PulseStatus | string | null | undefined;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}) {
  const theme = getPulseStatusTheme(status);

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5 font-semibold',
    lg: 'text-sm px-3 py-1.5 gap-2 font-bold',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border whitespace-nowrap ${sizeClasses[size]} ${theme.badgeBg}`}
    >
      {showIcon && (
        <Heart
          className={`${size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-4 h-4' : 'w-3.5 h-3.5'} ${
            theme.heartColor
          } ${theme.label.includes('PULSE') ? 'animate-pulse' : ''}`}
        />
      )}
      <span>{theme.label}</span>
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: AlertSeverity }) {
  if (severity === 'CRITICAL') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
        CRITICAL
      </span>
    );
  }
  if (severity === 'WARNING') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
        WARNING
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-sky-100 text-sky-800 border border-sky-200">
      INFO
    </span>
  );
}
