/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { AreaChart, Area, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { HistoryDataPoint } from '../types';
import GlowCard from './GlowCard';
import { LineChart as ChartIcon, Zap, Thermometer, TrendingUp, BarChart3, X, Award, Sparkles, DollarSign, Leaf, Calendar, Lightbulb } from 'lucide-react';

interface AnalyticsSectionProps {
  historyData: HistoryDataPoint[];
  showWeeklyModal?: boolean;
  onOpenWeeklyModal?: () => void;
  onCloseWeeklyModal?: () => void;
}

export default function AnalyticsSection({
  historyData,
  showWeeklyModal,
  onOpenWeeklyModal,
  onCloseWeeklyModal,
}: AnalyticsSectionProps) {
  const [activeChart, setActiveChart] = useState<'climate' | 'actuators'>('climate');
  const [localShowWeekly, setLocalShowWeekly] = useState<boolean>(false);

  const isWeeklyOpen = showWeeklyModal !== undefined ? showWeeklyModal : localShowWeekly;
  const openWeekly = onOpenWeeklyModal || (() => setLocalShowWeekly(true));
  const closeWeekly = onCloseWeeklyModal || (() => setLocalShowWeekly(false));

  // Simulated Weekly Energy Data
  const weeklyData = [
    { day: 'Mon', activeHours: 4.2, energyUsed: 1.8, energySaved: 0.6 },
    { day: 'Tue', activeHours: 3.8, energyUsed: 1.6, energySaved: 0.5 },
    { day: 'Wed', activeHours: 5.1, energyUsed: 2.2, energySaved: 0.8 },
    { day: 'Thu', activeHours: 4.5, energyUsed: 1.9, energySaved: 0.7 },
    { day: 'Fri', activeHours: 6.0, energyUsed: 2.6, energySaved: 0.9 },
    { day: 'Sat', activeHours: 2.5, energyUsed: 1.1, energySaved: 0.4 },
    { day: 'Sun', activeHours: 3.2, energyUsed: 1.4, energySaved: 0.5 },
  ];

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
    <>
      <GlowCard
        id="card-analytics-charts"
        title="Environment Analytics"
        subtitle="REAL-TIME TIME-SERIES telemetry ANALYSIS"
        glowColor="none"
        className="md:col-span-3 flex flex-col min-h-[380px]"
        headerAction={
          <div className="flex items-center gap-2">
            <button
              id="btn-open-weekly-report"
              onClick={openWeekly}
              className="flex items-center gap-1.5 px-3 py-1 rounded-md font-mono text-[10px] font-bold transition-all bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 text-cyan-400 hover:from-cyan-500/20 hover:to-blue-500/20 cursor-pointer"
            >
              <BarChart3 className="w-3 h-3 text-cyan-400" />
              <span>WEEKLY REPORT</span>
            </button>
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

    {/* Weekly Energy & Telemetry Insights Modal */}
    {isWeeklyOpen && (
      <div className="fixed inset-0 z-55 flex items-center justify-center p-4 backdrop-blur-md bg-slate-950/80 animate-fadeIn">
        <div className="relative w-full max-w-2xl bg-slate-950/95 border border-slate-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-900/80 flex items-center justify-between bg-slate-950">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-cyan-400" />
              <div>
                <h3 className="text-sm font-bold text-slate-100 font-mono tracking-wider">WEEKLY ENVIRONMENT & ENERGY INSIGHTS</h3>
                <p className="text-[10px] text-slate-500 font-mono">AUTOMATED ANALYTICS FOR PREV 7 DAYS</p>
              </div>
            </div>
            <button
              onClick={closeWeekly}
              className="p-1.5 rounded-lg border border-slate-900 bg-slate-950 hover:border-slate-800 text-slate-400 hover:text-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto flex flex-col gap-6 bg-slate-950/40">
            {/* Stats Overview */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              <div className="p-3 bg-slate-950 border border-slate-900 rounded-xl flex flex-col gap-1">
                <span className="text-[9px] text-slate-500 font-mono uppercase flex items-center gap-1">
                  <Zap className="w-3 h-3 text-cyan-400" /> ENERGY USED
                </span>
                <span className="text-lg font-bold font-sans text-slate-200">12.6 <span className="text-xs text-slate-500 font-mono">kWh</span></span>
                <span className="text-[8.5px] text-slate-500 font-mono">Total grid consumption</span>
              </div>

              <div className="p-3 bg-slate-950 border border-emerald-500/10 rounded-xl flex flex-col gap-1">
                <span className="text-[9px] text-emerald-400 font-mono uppercase flex items-center gap-1">
                  <Award className="w-3 h-3" /> ENERGY SAVED
                </span>
                <span className="text-lg font-bold font-sans text-emerald-400">4.4 <span className="text-xs text-emerald-500/70 font-mono">kWh</span></span>
                <span className="text-[8.5px] text-emerald-500/80 font-mono">⚡ 25.8% Saved!</span>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-900 rounded-xl flex flex-col gap-1">
                <span className="text-[9px] text-slate-500 font-mono uppercase flex items-center gap-1">
                  <DollarSign className="w-3 h-3 text-cyan-400" /> COST REDUCTION
                </span>
                <span className="text-lg font-bold font-sans text-slate-200">$1.06 <span className="text-xs text-slate-500 font-mono">USD</span></span>
                <span className="text-[8.5px] text-slate-500 font-mono">Smart tariff optimization</span>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-900 rounded-xl flex flex-col gap-1">
                <span className="text-[9px] text-slate-500 font-mono uppercase flex items-center gap-1">
                  <Leaf className="w-3 h-3 text-teal-400" /> CO₂ OFFSET
                </span>
                <span className="text-lg font-bold font-sans text-slate-200">3.1 <span className="text-xs text-slate-500 font-mono">kg</span></span>
                <span className="text-[8.5px] text-slate-500 font-mono">Carbon footprint saved</span>
              </div>
            </div>

            {/* Recharts Bar Chart comparing used vs saved */}
            <div className="p-4 bg-slate-950/80 border border-slate-900 rounded-xl">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-[10px] text-slate-400 font-mono uppercase font-bold tracking-wider">Daily Energy Efficiency Chart</h4>
                <div className="flex gap-3 text-[9px] font-mono">
                  <span className="flex items-center gap-1 text-cyan-400">
                    <span className="w-2 h-2 rounded bg-cyan-500" /> USED (kWh)
                  </span>
                  <span className="flex items-center gap-1 text-emerald-400">
                    <span className="w-2 h-2 rounded bg-emerald-500" /> SAVED (kWh)
                  </span>
                </div>
              </div>
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyData} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#0f172a" vertical={false} />
                    <XAxis
                      dataKey="day"
                      stroke="#475569"
                      tickLine={false}
                      axisLine={false}
                      style={{ fontSize: 9, fontFamily: 'JetBrains Mono' }}
                    />
                    <YAxis
                      stroke="#475569"
                      tickLine={false}
                      axisLine={false}
                      style={{ fontSize: 9, fontFamily: 'JetBrains Mono' }}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#020617', borderColor: '#1e293b' }}
                      labelStyle={{ fontSize: 9, color: '#94a3b8', fontFamily: 'JetBrains Mono' }}
                      itemStyle={{ fontSize: 10, fontFamily: 'JetBrains Mono' }}
                    />
                    <Bar dataKey="energyUsed" name="Energy Used" fill="#06b6d4" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="energySaved" name="Energy Saved" fill="#10b981" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Smart Microclimate AI Insights */}
            <div className="flex flex-col gap-2">
              <h4 className="text-[10px] text-slate-500 font-mono uppercase font-bold tracking-wider">AI Microclimate Insights</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10.5px] leading-relaxed">
                <div className="p-3.5 bg-slate-950/40 border border-slate-900 rounded-xl flex gap-2.5 items-start">
                  <Lightbulb className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <div className="flex flex-col gap-0.5">
                    <strong className="text-slate-300 font-semibold font-mono text-[9px] uppercase tracking-wide">Pre-Cooling Rule Efficiency</strong>
                    <span className="text-slate-400">The Arrival Pre-Cooling schedule successfully decreased peak power surges by cooling the space 5 minutes in advance before human activity heated it.</span>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-950/40 border border-slate-900 rounded-xl flex gap-2.5 items-start">
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="flex flex-col gap-0.5">
                    <strong className="text-slate-300 font-semibold font-mono text-[9px] uppercase tracking-wide">Automated Presets Yield</strong>
                    <span className="text-slate-400">Switching from manual cooling to automated microclimate presets reduced average fan current draw by 14.8% during late-night cycles.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-3.5 border-t border-slate-900 bg-slate-950 flex justify-end">
            <button
              onClick={closeWeekly}
              className="px-4 py-2 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 border border-cyan-500/20 rounded-xl text-xs font-mono font-bold tracking-wider cursor-pointer transition-all active:scale-95"
            >
              CLOSE REPORT
            </button>
          </div>
        </div>
      </div>
    )}
  </>
);
}
