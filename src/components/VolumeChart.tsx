import React, { useState, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { PatientLogRecord } from '../types';

interface VolumeChartProps {
  logs: PatientLogRecord[];
  initialVolume: number;
}

function VolumeChartComponent({ logs, initialVolume }: VolumeChartProps) {
  const [timeRange, setTimeRange] = useState<'30m' | '1h' | '6h' | 'ALL'>('ALL');

  const chartData = useMemo(() => {
    if (!logs || logs.length === 0) return [];
    const now = Date.now();
    let cutoff = 0;
    if (timeRange === '30m') cutoff = now - 30 * 60000;
    else if (timeRange === '1h') cutoff = now - 60 * 60000;
    else if (timeRange === '6h') cutoff = now - 360 * 60000;

    const filtered = cutoff > 0 ? logs.filter((l) => l.timestamp >= cutoff) : logs;
    return filtered.map((l) => ({
      time: new Date(l.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      volume: l.volume,
      percentage: Math.round(l.remainingPercentage),
      dripRate: l.dripRate,
      timestamp: l.timestamp,
    }));
  }, [logs, timeRange]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h4 className="text-sm font-bold text-slate-800">IV VOLUME VS TIME</h4>
          <p className="text-xs text-slate-500">Fluid depletion trajectory over session</p>
        </div>

        {/* Time range switcher */}
        <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-semibold text-slate-600">
          {(['30m', '1h', '6h', 'ALL'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                timeRange === range ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      <div className="h-60 w-full">
        {chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-slate-400">
            Awaiting telemetry logs...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <defs>
                <linearGradient id="volumeAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0284c7" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={{ stroke: '#e2e8f0' }}
                tickLine={false}
              />
              <YAxis
                domain={[0, Math.max(initialVolume, 100)]}
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={{ stroke: '#e2e8f0' }}
                tickLine={false}
                unit=" mL"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderRadius: '8px',
                  color: '#fff',
                  border: 'none',
                  fontSize: '12px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                }}
                formatter={(value: unknown) => [`${value} mL`, 'Volume']}
                labelFormatter={(label) => `Time: ${label}`}
              />
              <Area
                type="monotone"
                dataKey="volume"
                stroke="#0284c7"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#volumeAreaGrad)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

export const VolumeChart = React.memo(VolumeChartComponent);

