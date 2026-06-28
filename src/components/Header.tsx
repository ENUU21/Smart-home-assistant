/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Wifi, WifiOff, Cpu, PlayCircle, Settings, BookOpen, Database } from 'lucide-react';
import { DashboardSettings } from '../types';
import { getActiveDatabaseId } from '../lib/firebase';

interface HeaderProps {
  isConnected: boolean;
  settings: DashboardSettings;
  setSettings: (updater: (prev: DashboardSettings) => DashboardSettings) => void;
  latency: number | null;
  onOpenSettings: () => void;
  onOpenDocs: () => void;
}

export default function Header({
  isConnected,
  settings,
  setSettings,
  latency,
  onOpenSettings,
  onOpenDocs,
}: HeaderProps) {
  const toggleSimulation = () => {
    setSettings((prev) => ({
      ...prev,
      simulationMode: !prev.simulationMode,
    }));
  };

  return (
    <header
      id="kitten-dashboard-header"
      className="relative z-10 w-full backdrop-blur-md bg-slate-950/60 border-b border-slate-900/60 py-4 px-6 md:px-8 flex flex-col md:flex-row items-center justify-between gap-4"
    >
      {/* Decorative top grid glow */}
      <div className="absolute top-0 left-1/4 right-1/4 h-[1px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-40 blur-sm pointer-events-none" />

      {/* Title & Brand */}
      <div className="flex items-center gap-3.5">
        <div className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-400 p-[1px] shadow-[0_0_15px_rgba(0,255,208,0.25)]">
          <div className="w-full h-full rounded-xl bg-slate-950 flex items-center justify-center">
            {/* Minimalist Cat Logo using cyber typography */}
            <span className="text-xl font-black text-cyan-400 tracking-tighter select-none">
              K
            </span>
          </div>
          {/* Breathing cyber dot */}
          <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-cyan-500 border border-slate-950"></span>
          </span>
        </div>

        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-white tracking-widest font-sans uppercase bg-gradient-to-r from-white via-slate-100 to-cyan-300 bg-clip-text text-transparent">
              KITTEN
            </h1>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-cyan-500/20 bg-cyan-950/30 text-cyan-400 tracking-wider">
              v1.4-SECURE
            </span>
          </div>
          <p className="text-xs text-slate-400 font-mono tracking-wide">
            Smart Home Assistant & Environment Control
          </p>
        </div>
      </div>

      {/* Network & Live Status info */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Simulation Badge */}
        <button
          id="btn-toggle-simulation-mode"
          onClick={toggleSimulation}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg border font-mono text-xs transition-all duration-300 ${
            settings.simulationMode
              ? 'border-amber-500/30 bg-amber-950/20 text-amber-400 hover:bg-amber-950/40 shadow-[0_0_8px_rgba(245,158,11,0.1)]'
              : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700 hover:text-slate-300'
          }`}
        >
          <PlayCircle className={`w-3.5 h-3.5 ${settings.simulationMode ? 'animate-pulse' : ''}`} />
          <span>{settings.simulationMode ? 'SIMULATOR ACTIVE' : 'REAL ESP32 MODE'}</span>
        </button>

        {/* IP and Latency display */}
        {!settings.simulationMode && (
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-800/80 bg-slate-950/30 font-mono text-xs text-slate-400">
            <Cpu className="w-3.5 h-3.5 text-slate-500" />
            <span>IP: {settings.espIpAddress || 'None'}</span>
            {latency !== null && (
              <>
                <span className="text-slate-700">|</span>
                <span className={latency < 100 ? 'text-emerald-400' : 'text-amber-400'}>
                  {latency}ms
                </span>
              </>
            )}
          </div>
        )}

        {/* Firestore Status indicator */}
        {settings.firestoreSyncEnabled && (
          <div
            id="firestore-status-badge"
            title={`Connected to Firestore Database: ${getActiveDatabaseId()}`}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-emerald-500/20 bg-emerald-950/20 text-emerald-400 font-mono text-xs font-semibold tracking-wider shadow-[0_0_10px_rgba(16,185,129,0.1)] transition-all duration-300 cursor-help"
          >
            <Database className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400">FIRESTORE CONNECTED</span>
          </div>
        )}

        {/* Connection Status indicator */}
        <div
          id="connection-status-badge"
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg border font-mono text-xs font-semibold tracking-wider transition-all duration-300 ${
            isConnected
              ? 'border-emerald-500/20 bg-emerald-950/20 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.1)]'
              : 'border-red-500/20 bg-red-950/20 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.1)]'
          }`}
        >
          {isConnected ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <Wifi className="w-3.5 h-3.5" />
              <span>ONLINE</span>
            </>
          ) : (
            <>
              <span className="relative flex h-2 w-2">
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
              <WifiOff className="w-3.5 h-3.5 animate-pulse" />
              <span>OFFLINE</span>
            </>
          )}
        </div>

        {/* Quick Help / Setup Docs */}
        <button
          id="btn-open-help-docs"
          onClick={onOpenDocs}
          title="ESP32 API Setup Guide"
          className="p-2 rounded-lg border border-slate-800 bg-slate-900/40 text-slate-400 hover:text-slate-200 hover:border-slate-700 transition-all duration-200"
        >
          <BookOpen className="w-4 h-4" />
        </button>

        {/* Settings button */}
        <button
          id="btn-open-global-settings"
          onClick={onOpenSettings}
          title="Dashboard Config"
          className="p-2 rounded-lg border border-slate-800 bg-slate-900/40 text-slate-400 hover:text-slate-200 hover:border-slate-700 transition-all duration-200"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
