import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { PatientLogRecord } from '../types';
import { Heart } from 'lucide-react';

interface PulseRateChartProps {
  logs: PatientLogRecord[];
}

function PulseRateChartComponent({ logs }: PulseRateChartProps) {
  const chartData = useMemo(() => {
    return (logs || [])
      .filter((l) => l.pulseRate !== null && l.pulseRate !== undefined && l.pulseRate > 0)
      .slice(-30)
      .map((log) => ({
        time: new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        pulseRate: log.pulseRate,
        pulseStatus: log.pulseStatus || 'NORMAL',
      }));
  }, [logs]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
            <Heart className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">Heart Rate Trend (BPM)</h3>
            <p className="text-xs text-slate-400">Continuous ESP32 pulse sensor telemetry</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-semibold border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Normal (60–100 BPM)
          </span>
          <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-semibold border border-amber-200">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Abnormal (&lt;60 or &gt;100)
          </span>
        </div>
      </div>

      <div className="h-56 w-full">
        {chartData.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200 p-4">
            <Heart className="w-8 h-8 text-slate-300 mb-2" />
            <p className="font-semibold text-slate-600">No Pulse Sensor Data Yet</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Telemetry readings will appear here in real time as received from ESP32.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              {/* Normal range reference boundaries */}
              <ReferenceLine y={100} stroke="#10b981" strokeDasharray="3 3" strokeOpacity={0.6} />
              <ReferenceLine y={60} stroke="#10b981" strokeDasharray="3 3" strokeOpacity={0.6} />
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} />
              <YAxis
                domain={[30, 160]}
                tick={{ fontSize: 10, fill: '#64748b' }}
                tickLine={false}
                unit=" bpm"
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-slate-900 text-white text-xs p-2.5 rounded-lg shadow-lg border border-slate-700">
                        <div className="text-[11px] text-slate-400">{data.time}</div>
                        <div className="font-bold text-sm text-rose-300 mt-0.5 flex items-center gap-1.5">
                          <Heart className="w-3.5 h-3.5 fill-rose-400 text-rose-400" />
                          <span>{data.pulseRate} BPM</span>
                        </div>
                        <div className="text-[10px] text-slate-300 mt-1">Status: {data.pulseStatus}</div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Line
                type="monotone"
                dataKey="pulseRate"
                stroke="#e11d48"
                strokeWidth={2.5}
                dot={{ r: 3, fill: '#e11d48', strokeWidth: 1, stroke: '#fff' }}
                activeDot={{ r: 6, fill: '#be123c', stroke: '#fff', strokeWidth: 2 }}
                name="Pulse Rate (BPM)"
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

export const PulseRateChart = React.memo(PulseRateChartComponent);

