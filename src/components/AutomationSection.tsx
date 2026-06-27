/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Brain, Sliders, BookOpen, Moon, Film, Gamepad2 } from 'lucide-react';
import { ESP32Data, PresetMode } from '../types';
import GlowCard from './GlowCard';
import { getPresetStateUpdates } from '../mockData';

interface AutomationSectionProps {
  data: ESP32Data;
  onPresetSelect: (updates: Partial<ESP32Data>, logMsg: string) => void;
  isLoading: boolean;
}

export default function AutomationSection({ data, onPresetSelect, isLoading }: AutomationSectionProps) {
  // Try to match current LED/fan combinations to find which mode is active
  const getActiveMode = (): PresetMode => {
    if (data.auto) return 'auto';
    if (data.led === 200 && data.fan === 100) return 'study';
    if (data.led === 15 && data.fan === 45) return 'sleep';
    if (data.led === 40 && data.fan === 70) return 'movie';
    if (data.led === 255 && data.fan === 180) return 'gaming';
    return 'manual';
  };

  const activeMode = getActiveMode();

  const handleModeClick = (mode: PresetMode) => {
    const { logMsg, ...updates } = getPresetStateUpdates(mode);
    onPresetSelect(updates, logMsg);
  };

  const modes = [
    {
      id: 'auto',
      name: 'Auto Mode',
      desc: 'AI Automated Control',
      icon: Brain,
      color: 'border-cyan-500/30 text-cyan-400 bg-cyan-950/15',
      glow: 'cyan' as const,
    },
    {
      id: 'manual',
      name: 'Manual Mode',
      desc: 'User Parameter Override',
      icon: Sliders,
      color: 'border-blue-500/30 text-blue-400 bg-blue-950/15',
      glow: 'blue' as const,
    },
    {
      id: 'study',
      name: 'Study Mode',
      desc: 'Crisp Light & Quiet Ventilation',
      icon: BookOpen,
      color: 'border-emerald-500/30 text-emerald-400 bg-emerald-950/15',
      glow: 'emerald' as const,
    },
    {
      id: 'sleep',
      name: 'Sleep Mode',
      desc: 'Dim Ambient & Silent Fan',
      icon: Moon,
      color: 'border-purple-500/30 text-purple-400 bg-purple-950/15',
      glow: 'purple' as const,
    },
    {
      id: 'movie',
      name: 'Movie Mode',
      desc: 'Teal/Orange Glow & Airflow',
      icon: Film,
      color: 'border-amber-500/30 text-amber-400 bg-amber-950/15',
      glow: 'amber' as const,
    },
    {
      id: 'gaming',
      name: 'Gaming Mode',
      desc: 'Full Neon & Cool Boost',
      icon: Gamepad2,
      color: 'border-rose-500/30 text-rose-400 bg-rose-950/15',
      glow: 'red' as const,
    },
  ];

  return (
    <GlowCard
      id="card-automation-profiles"
      title="Environmental Automation"
      subtitle="PRELOADED INTELLIGENT SYSTEM PROFILES"
      glowColor={activeMode === 'auto' ? 'cyan' : 'none'}
      className="md:col-span-2"
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {modes.map((mode) => {
          const isActive = activeMode === mode.id;
          const IconComp = mode.icon;

          return (
            <button
              key={mode.id}
              id={`btn-automation-profile-${mode.id}`}
              onClick={() => handleModeClick(mode.id as PresetMode)}
              disabled={isLoading}
              className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all duration-300 group disabled:opacity-40 disabled:pointer-events-none relative overflow-hidden ${
                isActive
                  ? `${mode.color} shadow-md`
                  : 'border-slate-900 bg-slate-950/30 text-slate-400 hover:border-slate-800 hover:text-slate-200'
              }`}
            >
              {/* Internal subtle glow for active */}
              {isActive && (
                <div className="absolute inset-0 bg-gradient-to-tr from-current/5 to-current/15 pointer-events-none" />
              )}

              <div className="flex items-center justify-between w-full mb-2">
                <div className={`p-1.5 rounded-lg ${isActive ? 'bg-current/10' : 'bg-slate-900 group-hover:bg-slate-850'}`}>
                  <IconComp className="w-4 h-4" />
                </div>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping" />
                )}
              </div>

              <div className="font-sans font-bold text-xs tracking-wide uppercase">
                {mode.name}
              </div>
              <div className="font-mono text-[9px] text-slate-500 mt-0.5 leading-snug">
                {mode.desc}
              </div>
            </button>
          );
        })}
      </div>
    </GlowCard>
  );
}
