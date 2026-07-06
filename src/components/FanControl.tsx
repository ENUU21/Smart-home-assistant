/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Wind, Power, Clock } from 'lucide-react';
import { ESP32Data } from '../types';
import GlowCard from './GlowCard';

interface FanControlProps {
  data: ESP32Data;
  onFanChange: (value: number) => void;
  isLoading: boolean;
  arrivalSchedule?: {
    enabled: boolean;
    type: 'school' | 'office' | 'custom';
    time: string;
  };
  onChangeArrivalSchedule?: (newSchedule: {
    enabled: boolean;
    type: 'school' | 'office' | 'custom';
    time: string;
  }) => void;
}

export default function FanControl({
  data,
  onFanChange,
  isLoading,
  arrivalSchedule,
  onChangeArrivalSchedule,
}: FanControlProps) {
  const isFanOn = data.fan > 0;

  // Compute CSS rotation animation duration based on state
  const getSpinStyle = () => {
    if (!isFanOn) {
      return { animationPlayState: 'paused' };
    }
    // Calculate speed duration based on fan speed: 255 (full speed) -> 0.2s, 50 (slow speed) -> 2.0s
    const speedPercent = data.fan / 255;
    const duration = 0.2 + (1 - speedPercent) * 1.8; // scales from 0.2s to 2.0s
    return {
      animationName: 'spin',
      animationDuration: `${duration}s`,
      animationIterationCount: 'infinite',
      animationTimingFunction: 'linear',
    };
  };

  const handleToggle = () => {
    if (isFanOn) {
      onFanChange(0);
    } else {
      onFanChange(255); // Full power digital switch
    }
  };

  return (
    <GlowCard
      id="card-fan-control"
      title="Climate Control"
      subtitle="VENTILATION POWER STATE"
      glowColor="blue"
      className="overflow-hidden"
      headerAction={
        <button
          id="btn-toggle-fan"
          onClick={handleToggle}
          disabled={isLoading}
          className={`p-2 rounded-xl border transition-all duration-300 ${
            isFanOn
              ? 'border-blue-500/40 bg-blue-950/20 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.2)]'
              : 'border-slate-800 bg-slate-950/40 text-slate-500'
          }`}
        >
          <Power className="w-4 h-4" />
        </button>
      }
    >
      <div className="flex flex-col gap-6">
        {/* Animated Fan Blade SVG */}
        <div className="flex justify-center items-center py-6 relative">
          <div className="relative w-24 h-24 flex items-center justify-center">
            {/* Outer Fan Shroud / Ring */}
            <div className={`absolute inset-0 rounded-full border border-dashed transition-all duration-500 ${
              isFanOn ? 'border-blue-500/50 animate-[spin_10s_linear_infinite]' : 'border-slate-800'
            }`} />
            <div className="absolute inset-1.5 rounded-full border border-slate-900 bg-slate-950/40" />
            
            {/* SVG Blades */}
            <svg
              id="svg-fan-blades"
              className={`w-16 h-16 text-blue-400 z-10 transition-all duration-500 ${
                isFanOn ? 'drop-shadow-[0_0_12px_rgba(59,130,246,0.6)]' : 'text-slate-600'
              }`}
              style={getSpinStyle()}
              viewBox="0 0 100 100"
            >
              {/* Central Cap */}
              <circle cx="50" cy="50" r="12" className={`${isFanOn ? 'fill-blue-500 stroke-blue-300' : 'fill-slate-700 stroke-slate-600'} stroke-[2px]`} />
              
              {/* Blade 1 */}
              <path
                d="M50 38 C40 38 35 20 50 10 C65 20 60 38 50 38 Z"
                className={`${isFanOn ? 'fill-blue-400/85 stroke-blue-300' : 'fill-slate-700/60 stroke-slate-600'} stroke-[1px]`}
              />
              {/* Blade 2 */}
              <path
                d="M62 50 C62 40 80 35 90 50 C80 65 62 60 62 50 Z"
                className={`${isFanOn ? 'fill-blue-400/85 stroke-blue-300' : 'fill-slate-700/60 stroke-slate-600'} stroke-[1px]`}
              />
              {/* Blade 3 */}
              <path
                d="M50 62 C60 62 65 80 50 90 C35 80 40 62 50 62 Z"
                className={`${isFanOn ? 'fill-blue-400/85 stroke-blue-300' : 'fill-slate-700/60 stroke-slate-600'} stroke-[1px]`}
              />
              {/* Blade 4 */}
              <path
                d="M38 50 C38 60 20 65 10 50 C20 35 38 40 38 50 Z"
                className={`${isFanOn ? 'fill-blue-400/85 stroke-blue-300' : 'fill-slate-700/60 stroke-slate-600'} stroke-[1px]`}
              />
            </svg>
          </div>
        </div>

        {/* Sliders and Info Panel */}
        <div>
          <div className="flex justify-between items-baseline mb-2">
            <span className="text-xs text-slate-400 font-mono flex items-center gap-1.5">
              <Wind className="w-3.5 h-3.5 text-blue-400" /> Ventilation Speed
            </span>
            <div className="flex items-baseline gap-1 font-mono">
              <span className="text-sm font-bold text-slate-100">{Math.round((data.fan / 255) * 100)}</span>
              <span className="text-[10px] text-slate-500">%</span>
              <span className="text-xs text-slate-500 ml-1.5">({data.fan})</span>
            </div>
          </div>

          <div className="relative group flex items-center">
            <input
              id="slider-fan-speed"
              type="range"
              min="0"
              max="255"
              value={data.fan}
              onChange={(e) => onFanChange(parseInt(e.target.value, 10))}
              disabled={isLoading}
              className="w-full h-2 rounded-lg bg-slate-900 border border-slate-800/80 appearance-none cursor-pointer focus:outline-none accent-blue-400 group-hover:border-slate-700 transition-colors duration-200"
            />
          </div>

          <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-2">
            <span>OFF</span>
            <span className="text-[10px] text-slate-600 font-mono flex items-center gap-1">
              PORT: GPIO 13
            </span>
            <span>MAX VENTILATION</span>
          </div>
        </div>

        {/* Arrival Pre-Cooling Scheduler */}
        {arrivalSchedule && onChangeArrivalSchedule && (
          <div className="pt-4 border-t border-slate-900/60 mt-2">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-slate-400 font-mono flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-cyan-400" /> Arrival Pre-Cooling
              </span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  id="toggle-arrival-precooling"
                  type="checkbox"
                  checked={arrivalSchedule.enabled}
                  onChange={(e) => onChangeArrivalSchedule({
                    ...arrivalSchedule,
                    enabled: e.target.checked
                  })}
                  className="sr-only peer"
                />
                <div className="w-8 h-4 bg-slate-900 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-slate-400 after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-cyan-500/30 peer-checked:after:bg-cyan-400" />
              </label>
            </div>

            {arrivalSchedule.enabled && (
              <div className="flex flex-col gap-2.5 p-2.5 rounded-lg bg-slate-950/60 border border-slate-900/80 animate-fadeIn">
                <div className="grid grid-cols-3 gap-1.5 text-[10px] font-mono">
                  <button
                    id="btn-arrival-school"
                    onClick={() => onChangeArrivalSchedule({
                      ...arrivalSchedule,
                      type: 'school',
                      time: '15:30'
                    })}
                    className={`py-1 px-1.5 rounded border transition-colors ${
                      arrivalSchedule.type === 'school'
                        ? 'border-cyan-500/40 bg-cyan-950/20 text-cyan-400 font-bold'
                        : 'border-slate-900 bg-slate-950 text-slate-500 hover:border-slate-800'
                    }`}
                  >
                    After School
                  </button>
                  <button
                    id="btn-arrival-office"
                    onClick={() => onChangeArrivalSchedule({
                      ...arrivalSchedule,
                      type: 'office',
                      time: '18:00'
                    })}
                    className={`py-1 px-1.5 rounded border transition-colors ${
                      arrivalSchedule.type === 'office'
                        ? 'border-cyan-500/40 bg-cyan-950/20 text-cyan-400 font-bold'
                        : 'border-slate-900 bg-slate-950 text-slate-500 hover:border-slate-800'
                    }`}
                  >
                    After Office
                  </button>
                  <button
                    id="btn-arrival-custom"
                    onClick={() => onChangeArrivalSchedule({
                      ...arrivalSchedule,
                      type: 'custom'
                    })}
                    className={`py-1 px-1.5 rounded border transition-colors ${
                      arrivalSchedule.type === 'custom'
                        ? 'border-cyan-500/40 bg-cyan-950/20 text-cyan-400 font-bold'
                        : 'border-slate-900 bg-slate-950 text-slate-500 hover:border-slate-800'
                    }`}
                  >
                    Custom Time
                  </button>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span className="text-[10px] text-slate-500 font-mono">
                    {arrivalSchedule.type === 'school' && "School arrival (3:30 PM)"}
                    {arrivalSchedule.type === 'office' && "Office arrival (6:00 PM)"}
                    {arrivalSchedule.type === 'custom' && "Set your arrival time"}
                  </span>

                  <input
                    id="input-arrival-time"
                    type="time"
                    disabled={arrivalSchedule.type !== 'custom'}
                    value={arrivalSchedule.time}
                    onChange={(e) => onChangeArrivalSchedule({
                      ...arrivalSchedule,
                      time: e.target.value
                    })}
                    className={`bg-slate-950 border text-[11px] font-mono px-2 py-1 rounded focus:outline-none transition-all ${
                      arrivalSchedule.type === 'custom'
                        ? 'border-cyan-500/30 text-cyan-400 focus:border-cyan-400'
                        : 'border-slate-900 text-slate-600'
                    }`}
                  />
                </div>

                <div className="text-[9px] text-cyan-500/80 font-mono leading-relaxed bg-cyan-950/10 p-1.5 rounded border border-cyan-500/10">
                  ⚡ <strong>Auto pre-cooling:</strong> Fan will automatically spin up to 70% speed 5 minutes before your arrival ({
                    (() => {
                      const [h, m] = arrivalSchedule.time.split(':').map(Number);
                      let totalMin = h * 60 + m - 5;
                      if (totalMin < 0) totalMin += 24 * 60;
                      const fh = Math.floor(totalMin / 60);
                      const fm = totalMin % 60;
                      return `${fh.toString().padStart(2, '0')}:${fm.toString().padStart(2, '0')}`;
                    })()
                  }) to ensure the perfect microclimate.
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </GlowCard>
  );
}
