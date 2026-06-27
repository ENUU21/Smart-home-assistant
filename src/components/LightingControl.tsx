/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Sun, Lightbulb, Power } from 'lucide-react';
import { ESP32Data } from '../types';
import GlowCard from './GlowCard';

interface LightingControlProps {
  data: ESP32Data;
  onLedChange: (value: number) => void;
  isLoading: boolean;
}

export default function LightingControl({ data, onLedChange, isLoading }: LightingControlProps) {
  const percentage = Math.round((data.led / 255) * 100);
  
  // Calculate dynamic neon glow styles based on brightness value
  const glowOpacity = (data.led / 255) * 0.85; // up to 85% opacity
  const glowRadius = (data.led / 255) * 45; // up to 45px radius

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onLedChange(parseInt(e.target.value, 10));
  };

  const handleToggle = () => {
    // If on, turn off. If off, turn to full or previous default
    if (data.led > 0) {
      onLedChange(0);
    } else {
      onLedChange(255);
    }
  };

  return (
    <GlowCard
      id="card-lighting-control"
      title="Ambient Lighting"
      subtitle="SYSTEM LED CONTROLLER"
      glowColor="cyan"
      className="overflow-hidden"
      headerAction={
        <button
          id="btn-toggle-led"
          onClick={handleToggle}
          disabled={isLoading}
          className={`p-2 rounded-xl border transition-all duration-300 ${
            data.led > 0
              ? 'border-cyan-500/40 bg-cyan-950/20 text-cyan-400 shadow-[0_0_10px_rgba(0,255,208,0.2)]'
              : 'border-slate-800 bg-slate-950/40 text-slate-500'
          }`}
        >
          <Power className="w-4 h-4" />
        </button>
      }
    >
      <div className="flex flex-col gap-6">
        {/* Bulby Light Indicator with dynamic neon glow */}
        <div className="flex justify-center items-center py-6 relative">
          {/* Dynamic Glow aura in background */}
          <div
            className="absolute rounded-full transition-all duration-300 pointer-events-none"
            style={{
              width: '120px',
              height: '120px',
              background: `radial-gradient(circle, rgba(0, 255, 208, ${glowOpacity * 0.4}) 0%, transparent 70%)`,
              filter: `blur(${10 + glowRadius * 0.3}px)`,
              opacity: data.led > 0 ? 1 : 0,
            }}
          />

          <div
            className={`relative w-20 h-20 rounded-full flex items-center justify-center border transition-all duration-300 ${
              data.led > 0
                ? 'border-cyan-400 bg-cyan-950/30'
                : 'border-slate-800 bg-slate-950/50'
            }`}
            style={{
              boxShadow: data.led > 0 ? `0 0 ${glowRadius}px rgba(0, 255, 208, ${glowOpacity})` : 'none',
            }}
          >
            <Lightbulb
              className={`w-10 h-10 transition-colors duration-300 ${
                data.led > 0 ? 'text-cyan-400' : 'text-slate-600'
              }`}
            />
            {data.led > 0 && (
              <span className="absolute -top-1 right-2 text-[10px] font-mono text-cyan-400 font-bold animate-pulse">
                RGB
              </span>
            )}
          </div>
        </div>

        {/* Sliders and Info Panel */}
        <div>
          <div className="flex justify-between items-baseline mb-2">
            <span className="text-xs text-slate-400 font-mono flex items-center gap-1.5">
              <Sun className="w-3.5 h-3.5 text-cyan-400" /> Brightness Intensity
            </span>
            <div className="flex items-baseline gap-1 font-mono">
              <span className="text-sm font-bold text-slate-100">{percentage}</span>
              <span className="text-[10px] text-slate-500">%</span>
              <span className="text-xs text-slate-500 ml-1.5">({data.led})</span>
            </div>
          </div>

          <div className="relative group flex items-center">
            {/* Custom slider thumb track layout */}
            <input
              id="slider-led-brightness"
              type="range"
              min="0"
              max="255"
              value={data.led}
              onChange={handleSliderChange}
              disabled={isLoading}
              className="w-full h-2 rounded-lg bg-slate-900 border border-slate-800/80 appearance-none cursor-pointer focus:outline-none accent-cyan-400 group-hover:border-slate-700 transition-colors duration-200"
            />
          </div>

          <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-2">
            <span>OFF</span>
            <span>CYBER-RGB GLOW MAX</span>
          </div>
        </div>
      </div>
    </GlowCard>
  );
}
