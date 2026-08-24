import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { PatientLogRecord } from '../types';

interface DripRateChartProps {
  logs: PatientLogRecord[];
  prescribedDripRate: number;
}

function DripRateChartComponent({ logs, prescribedDripRate }: DripRateChartProps) {
  const chartData = useMemo(() => {
    return (logs || []).slice(-30).map((l) => ({
      time: new Date(l.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      actualRate: l.dripRate,
      prescribedRate: prescribedDripRate,
      status: l.status,
    }));
  }, [logs, prescribedDripRate]);

  const maxVal = useMemo(() => {
    return Math.max(
      prescribedDripRate * 1.6,
      ...chartData.map((d) => d.actualRate || 0),
      40
    );
  }, [prescribedDripRate, chartData]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h4 className="text-sm font-bold text-slate-800">DRIP RATE VS TIME</h4>
          <p className="text-xs text-slate-500">
            Real-time drops/min compared with prescribed baseline ({prescribedDripRate} dpm)
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 font-medium text-sky-700">
            <span className="w-3 h-0.5 bg-sky-600 rounded" />
            <span>Actual</span>
          </div>
          <div className="flex items-center gap-1.5 font-medium text-emerald-600">
            <span className="w-3 h-0.5 bg-emerald-500 border-b border-dashed border-emerald-500" />
            <span>Prescribed</span>
          </div>
        </div>
      </div>

      <div className="h-60 w-full">
        {chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-slate-400">
            Awaiting drop sensor telemetry...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={{ stroke: '#e2e8f0' }}
                tickLine={false}
              />
              <YAxis
                domain={[0, Math.ceil(maxVal / 10) * 10]}
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={{ stroke: '#e2e8f0' }}
                tickLine={false}
                unit=" dpm"
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
                formatter={(value: unknown, name: string) => [
                  `${value} dpm`,
                  name === 'actualRate' ? 'Actual Drip' : 'Prescribed Target',
                ]}
                labelFormatter={(label) => `Time: ${label}`}
              />
              <ReferenceLine
                y={prescribedDripRate}
                stroke="#10b981"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: `Target: ${prescribedDripRate} dpm`,
                  fill: '#10b981',
                  fontSize: 10,
                  position: 'insideTopRight',
                }}
              />
              <Line
                type="monotone"
                dataKey="actualRate"
                stroke="#0284c7"
                strokeWidth={2.5}
                dot={{ r: 2, fill: '#0284c7' }}
                activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

export const DripRateChart = React.memo(DripRateChartComponent);

