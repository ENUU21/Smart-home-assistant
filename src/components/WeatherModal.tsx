/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { 
  X, 
  Sun, 
  Cloud, 
  CloudRain, 
  CloudSnow, 
  Wind, 
  Droplets, 
  Radio, 
  RefreshCw, 
  ThermometerSun, 
  CloudSun,
  Shield,
  Compass,
  Sparkles
} from 'lucide-react';
import { ESP32Data } from '../types';

interface WeatherModalProps {
  isOpen: boolean;
  onClose: () => void;
  indoorData: ESP32Data;
  addLog: (msg: string, type: 'info' | 'success' | 'warning' | 'alert') => void;
}

export default function WeatherModal({
  isOpen,
  onClose,
  indoorData,
  addLog,
}: WeatherModalProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [weatherCity, setWeatherCity] = useState('San Francisco, CA');

  if (!isOpen) return null;

  const handleSyncWeather = () => {
    setIsSyncing(true);
    addLog(`Initiating meteorological satellite downlink for ${weatherCity}...`, 'info');
    setTimeout(() => {
      setIsSyncing(false);
      addLog(`Satellite uplink synchronized. Outside conditions updated successfully.`, 'success');
    }, 1200);
  };

  // Simulated weather data
  const outsideTemp = 19.5; // °C
  const outsideHumidity = 62; // %
  const outsideWind = 14; // km/h
  const outsideUV = 3; // Index
  const comfortDiff = indoorData.temperature ? Math.abs(indoorData.temperature - outsideTemp).toFixed(1) : '8.5';

  const hourlyForecast = [
    { time: '12:00 PM', temp: 18, icon: Sun, label: 'Sunny' },
    { time: '3:00 PM', temp: 20, icon: CloudSun, label: 'Partly Cloudy' },
    { time: '6:00 PM', temp: 19, icon: Cloud, label: 'Cloudy' },
    { time: '9:00 PM', temp: 16, icon: CloudRain, label: 'Drizzle' },
    { time: '12:00 AM', temp: 14, icon: CloudRain, label: 'Rainy' },
  ];

  const dailyOutlook = [
    { day: 'Tomorrow', tempHigh: 21, tempLow: 13, icon: CloudSun, cond: 'Intermittent Clouds' },
    { day: 'Wednesday', tempHigh: 22, tempLow: 14, icon: Sun, cond: 'Full Sun Aura' },
    { day: 'Thursday', tempHigh: 17, tempLow: 11, icon: CloudRain, cond: 'Neo-Rain Showers' },
    { day: 'Friday', tempHigh: 16, tempLow: 10, icon: CloudSnow, cond: 'High Elevation Flurries' },
  ];

  return (
    <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-slate-950/95 border border-slate-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-900/80 flex items-center justify-between bg-slate-950">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
              <ThermometerSun className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 font-mono tracking-wider">KITTEN WEATHER STATION</h3>
              <p className="text-[10px] text-slate-500 font-mono">NEO-METEOROLOGICAL SATELLITE FEED</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg border border-slate-900 bg-slate-950 hover:border-slate-800 text-slate-400 hover:text-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex flex-col gap-6 bg-slate-950/40">
          
          {/* Main Hero Weather and Microclimate Compare */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Outside Terminal */}
            <div className="p-5 bg-gradient-to-br from-slate-950 to-slate-900/40 border border-slate-900 rounded-xl relative overflow-hidden">
              <div className="absolute top-3 right-3 flex items-center gap-1 bg-cyan-950/30 border border-cyan-500/10 rounded-full px-2 py-0.5 text-[8px] font-mono text-cyan-400">
                <span className={`w-1 h-1 rounded-full bg-cyan-400 ${isSyncing ? 'animate-ping' : ''}`} />
                <span>OUTDOOR FEED</span>
              </div>

              <span className="text-[10px] text-slate-500 font-mono block uppercase">OUTDOOR METRICS</span>
              <div className="flex items-center gap-4 mt-2">
                <div className="text-4xl font-black text-slate-100 tracking-tighter">
                  {outsideTemp}°C
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-250 font-mono flex items-center gap-1">
                    <CloudSun className="w-3.5 h-3.5 text-cyan-400" />
                    Cyber-Atmosphere
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono leading-none mt-0.5">Scattered Micro-clouds</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3.5 mt-5 border-t border-slate-900/60 pt-4 font-mono text-[10px]">
                <div className="flex flex-col gap-0.5">
                  <span className="text-slate-500 flex items-center gap-1 uppercase text-[8.5px]"><Droplets className="w-3 h-3 text-cyan-500" /> HUMIDITY</span>
                  <span className="text-slate-200 font-bold">{outsideHumidity}%</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-slate-500 flex items-center gap-1 uppercase text-[8.5px]"><Wind className="w-3 h-3 text-cyan-500" /> WIND</span>
                  <span className="text-slate-200 font-bold">{outsideWind} km/h</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-slate-500 flex items-center gap-1 uppercase text-[8.5px]"><Compass className="w-3 h-3 text-cyan-500" /> UV INDEX</span>
                  <span className="text-slate-200 font-bold">{outsideUV} Med</span>
                </div>
              </div>
            </div>

            {/* Comfort comparison diagnostics */}
            <div className="p-5 bg-slate-950 border border-slate-900 rounded-xl flex flex-col gap-3">
              <span className="text-[10px] text-slate-500 font-mono uppercase block">Microclimate Differential Analysis</span>
              
              <div className="flex-grow flex flex-col gap-2.5">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-900/80">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span className="text-[10.5px] font-mono text-slate-400">Indoor Temperature</span>
                  </div>
                  <span className="text-xs font-bold font-mono text-slate-200">{indoorData.temperature ? `${indoorData.temperature}°C` : 'N/A (Offline)'}</span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-900/80">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    <span className="text-[10.5px] font-mono text-slate-400">Outdoor Temperature</span>
                  </div>
                  <span className="text-xs font-bold font-mono text-slate-200">{outsideTemp}°C</span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-900/80">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                    <span className="text-[10.5px] font-mono text-slate-400">Differential Spread</span>
                  </div>
                  <span className="text-xs font-bold font-mono text-indigo-400">+{comfortDiff}°C spread</span>
                </div>
              </div>

              <div className="text-[10px] leading-relaxed text-slate-400 bg-cyan-950/5 border border-cyan-500/5 rounded-lg p-2 flex items-start gap-2">
                <Shield className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                <span>
                  {indoorData.temperature && indoorData.temperature > outsideTemp 
                    ? "Outside air is cooler than room temp. Recommendation: Increase fan power or open ventilation valve." 
                    : "Room is comfortably pre-cooled relative to hot ambient sun. Automation active."}
                </span>
              </div>
            </div>
          </div>

          {/* Hourly Timeline */}
          <div className="flex flex-col gap-2">
            <h4 className="text-[10px] text-slate-500 font-mono uppercase font-bold tracking-wider">Hourly Atmosphere Forecast</h4>
            <div className="grid grid-cols-5 gap-2">
              {hourlyForecast.map((hour, idx) => (
                <div key={idx} className="p-3 bg-slate-950 border border-slate-900/80 rounded-xl flex flex-col items-center gap-1.5 text-center">
                  <span className="text-[9px] text-slate-500 font-mono font-bold leading-none">{hour.time}</span>
                  <hour.icon className="w-5 h-5 text-cyan-400/80 my-1.5" />
                  <span className="text-xs font-bold text-slate-200">{hour.temp}°C</span>
                  <span className="text-[8px] font-mono text-slate-500 truncate max-w-full leading-none">{hour.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 4-Day Outlook */}
          <div className="flex flex-col gap-2">
            <h4 className="text-[10px] text-slate-500 font-mono uppercase font-bold tracking-wider">Multi-Day Meteorological Outlook</h4>
            <div className="flex flex-col gap-2">
              {dailyOutlook.map((day, idx) => (
                <div key={idx} className="flex items-center justify-between p-3.5 bg-slate-950/60 border border-slate-900 rounded-xl">
                  <div className="flex items-center gap-3 w-1/3">
                    <day.icon className="w-4 h-4 text-cyan-400/90 shrink-0" />
                    <span className="text-xs font-bold text-slate-200 font-mono">{day.day}</span>
                  </div>
                  <div className="w-1/3 text-center">
                    <span className="text-[10.5px] text-slate-500 font-mono uppercase font-bold tracking-wider">{day.cond}</span>
                  </div>
                  <div className="w-1/3 text-right flex items-center justify-end gap-2.5 font-mono text-[11px]">
                    <span className="text-cyan-400 font-bold">{day.tempHigh}°C</span>
                    <span className="text-slate-600">/</span>
                    <span className="text-slate-500">{day.tempLow}°C</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-900 bg-slate-950 flex items-center justify-between">
          <button
            onClick={handleSyncWeather}
            disabled={isSyncing}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-cyan-400 font-mono text-[10px] font-bold rounded-xl tracking-wider cursor-pointer transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 text-cyan-400 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'DOWNLINKING SATELLITE...' : 'SYNC SATELLITE'}</span>
          </button>
          
          <button
            onClick={onClose}
            className="px-4 py-2 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 border border-cyan-500/20 rounded-xl text-xs font-mono font-bold tracking-wider cursor-pointer transition-all active:scale-95"
          >
            DISMISS STATION
          </button>
        </div>

      </div>
    </div>
  );
}
