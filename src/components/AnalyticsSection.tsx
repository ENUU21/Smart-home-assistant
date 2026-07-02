/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { HistoryDataPoint } from '../types';
import GlowCard from './GlowCard';
import { LineChart as ChartIcon, Zap, Thermometer, TrendingUp } from 'lucide-react';

interface AnalyticsSectionProps {
  historyData: HistoryDataPoint[];
}

export default function AnalyticsSection({ historyData }: AnalyticsSectionProps) {
  const [activeChart, setActiveChart] = useState<'climate' | 'actuators'>('climate');

  // Custom tooltips to maintain the high-tech, cyberpunk HUD look
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="backdrop-blur-md bg-slate-950/90 border border-slate-800 p-2.5 rounded-lg shadow-xl font-mono text-[10px] text-slate-300">
          <div className="text-slate-500 mb-1">Time: {label}</div>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-1.5 py-0.5" style={{ color: entry.color }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="uppercase text-[9px] font-bold text-slate-400">{entry.name}:</span>
              <span className="text-slate-100 font-bold">
                {entry.value !== null && entry.value !== undefined && !isNaN(entry.value) ? entry.value : 'N/A'}
                {entry.value !== null && entry.value !== undefined && !isNaN(entry.value) && (entry.name === 'temperature' ? '°C' : entry.name === 'motion' ? ' (Yes/No)' : ' (DAC)')}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <GlowCard
      id="card-analytics-charts"
      title="Environment Analytics"
      subtitle="REAL-TIME TIME-SERIES telemetry ANALYSIS"
      glowColor="none"
      className="md:col-span-3 flex flex-col min-h-[380px]"
      headerAction={
        <div className="flex rounded-lg border border-slate-800 bg-slate-950/40 p-1">
          <button
            id="btn-switch-chart-climate"
            onClick={() => setActiveChart('climate')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-mono text-[10px] font-bold transition-all ${
              activeChart === 'climate'
                ? 'bg-cyan-500/10 text-cyan-400 shadow-[inset_0_0_8px_rgba(0,255,208,0.05)]'
                : 'text-slate-500 hover:text-slate-350'
            }`}
          >
            <Thermometer className="w-3 h-3" />
            <span>CLIMATE DATA</span>
          </button>
          <button
            id="btn-switch-chart-actuators"
            onClick={() => setActiveChart('actuators')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-mono text-[10px] font-bold transition-all ${
              activeChart === 'actuators'
                ? 'bg-blue-500/10 text-blue-400 shadow-[inset_0_0_8px_rgba(0,119,255,0.05)]'
                : 'text-slate-500 hover:text-slate-350'
            }`}
          >
            <Zap className="w-3 h-3" />
            <span>POWER & CONTROLS</span>
          </button>
        </div>
      }
    >
      <div className="flex-grow w-full h-[250px] relative mt-2">
        <ResponsiveContainer width="100%" height="100%">
          {activeChart === 'climate' ? (
            <AreaChart data={historyData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
              <defs>
                <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00ffd0" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#00ffd0" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorMotion" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a855f7" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#a855f7" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#0f172a" vertical={false} />
              <XAxis
                dataKey="time"
                stroke="#475569"
                tickLine={false}
                axisLine={false}
                dy={8}
                style={{ fontSize: 9, fontFamily: 'JetBrains Mono' }}
              />
              <YAxis
                yAxisId="left"
                stroke="#00ffd0"
                domain={[15, 45]}
                tickLine={false}
                axisLine={false}
                style={{ fontSize: 9, fontFamily: 'JetBrains Mono' }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#a855f7"
                domain={[0, 1.2]}
                ticks={[0, 1]}
                tickFormatter={(val) => (val === 1 ? 'YES' : 'NO')}
                tickLine={false}
                axisLine={false}
                style={{ fontSize: 9, fontFamily: 'JetBrains Mono' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="temperature"
                name="temperature"
                stroke="#00ffd0"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorTemp)"
                dot={{ r: 2, stroke: '#00ffd0', fill: '#07111f' }}
              />
              <Area
                yAxisId="right"
                type="step"
                dataKey="motion"
                name="motion"
                stroke="#a855f7"
                strokeWidth={1.5}
                fillOpacity={0.4}
                fill="url(#colorMotion)"
                dot={false}
              />
            </AreaChart>
          ) : (
            <LineChart data={historyData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#0f172a" vertical={false} />
              <XAxis
                dataKey="time"
                stroke="#475569"
                tickLine={false}
                axisLine={false}
                dy={8}
                style={{ fontSize: 9, fontFamily: 'JetBrains Mono' }}
              />
              <YAxis
                stroke="#0077ff"
                domain={[0, 255]}
                tickLine={false}
                axisLine={false}
                style={{ fontSize: 9, fontFamily: 'JetBrains Mono' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="led"
                name="led"
                stroke="#00ffd0"
                strokeWidth={2}
                dot={{ r: 1.5, fill: '#00ffd0' }}
                activeDot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="fan"
                name="fan"
                stroke="#0077ff"
                strokeWidth={2}
                dot={{ r: 1.5, fill: '#0077ff' }}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-900/40 pt-4 mt-auto">
        <div className="flex items-center gap-4 text-[10px] font-mono text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-1 bg-cyan-400 rounded-sm" />
            <span>{activeChart === 'climate' ? 'TEMPERATURE (°C)' : 'LED BRIGHTNESS (0-255)'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-1 bg-purple-500 rounded-sm" style={{ backgroundColor: activeChart === 'climate' ? '#a855f7' : '#0077ff' }} />
            <span>{activeChart === 'climate' ? 'MOTION STATUS' : 'FAN VENTILATION (0-255)'}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 text-[9px] font-mono text-cyan-400 bg-cyan-950/10 border border-cyan-500/10 rounded px-2 py-0.5">
          <TrendingUp className="w-3 h-3" />
          <span>AUTOSAVING TELEMETRY HISTORY LOCALLY</span>
        </div>
      </div>
    </GlowCard>
  );
}
