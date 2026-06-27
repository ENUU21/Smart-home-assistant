/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Sliders, Cpu, Save, RefreshCw, Volume2, ShieldAlert, BookOpen, AlertTriangle } from 'lucide-react';
import { DashboardSettings } from '../types';
import GlowCard from './GlowCard';

interface SettingsPanelProps {
  settings: DashboardSettings;
  onSaveSettings: (newSettings: DashboardSettings) => void;
  onClose: () => void;
}

export default function SettingsPanel({ settings, onSaveSettings, onClose }: SettingsPanelProps) {
  const handleInputChange = (key: keyof DashboardSettings, value: any) => {
    onSaveSettings({
      ...settings,
      [key]: value,
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Configuration Sliders Card */}
      <GlowCard
        id="card-settings-parameters"
        title="Software Configurations"
        subtitle="DASHBOARD & REFRESH CALIBRATIONS"
        glowColor="blue"
      >
        <div className="flex flex-col gap-5">
          {/* IP Address Field */}
          <div>
            <label className="text-[10px] text-slate-500 font-mono block mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-blue-400" /> Physical ESP32 IPv4 Network Target
            </label>
            <input
              id="input-esp-ip-address"
              type="text"
              value={settings.espIpAddress}
              onChange={(e) => handleInputChange('espIpAddress', e.target.value)}
              placeholder="e.g. 192.168.1.50"
              disabled={settings.simulationMode}
              className="w-full bg-slate-950 text-slate-100 border border-slate-900 rounded-xl px-4 py-2.5 font-mono text-sm focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            />
            {settings.simulationMode ? (
              <p className="text-[9px] text-amber-500 font-mono mt-1.5 leading-snug">
                * Simulated Mode is active. Turn off simulator in header to bind physical IP.
              </p>
            ) : (
              <p className="text-[9px] text-slate-500 font-mono mt-1.5 leading-snug">
                Enter your local ESP32 IP address on your private home Wi-Fi.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Poll rate */}
            <div>
              <div className="flex justify-between items-baseline mb-1.5">
                <label className="text-[10px] text-slate-500 font-mono block uppercase tracking-wider flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 text-cyan-400" /> Refresh Rate (ms)
                </label>
                <span className="text-xs text-cyan-400 font-bold font-mono">
                  {settings.refreshRateMs} ms
                </span>
              </div>
              <input
                id="range-refresh-rate"
                type="range"
                min="500"
                max="5000"
                step="250"
                value={settings.refreshRateMs}
                onChange={(e) => handleInputChange('refreshRateMs', parseInt(e.target.value, 10))}
                className="w-full h-1.5 rounded bg-slate-900 appearance-none cursor-pointer focus:outline-none accent-cyan-400"
              />
              <div className="flex justify-between text-[8px] text-slate-500 font-mono mt-1">
                <span>0.5s (POLL FAST)</span>
                <span>5.0s (POLL SLOW)</span>
              </div>
            </div>

            {/* Voice Sensitivity */}
            <div>
              <div className="flex justify-between items-baseline mb-1.5">
                <label className="text-[10px] text-slate-500 font-mono block uppercase tracking-wider flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-purple-400" /> Voice Sensitivity
                </label>
                <span className="text-xs text-purple-400 font-bold font-mono">
                  Lvl {settings.voiceSensitivity}
                </span>
              </div>
              <input
                id="range-voice-sensitivity"
                type="range"
                min="1"
                max="10"
                value={settings.voiceSensitivity}
                onChange={(e) => handleInputChange('voiceSensitivity', parseInt(e.target.value, 10))}
                className="w-full h-1.5 rounded bg-slate-900 appearance-none cursor-pointer focus:outline-none accent-purple-500"
              />
              <div className="flex justify-between text-[8px] text-slate-500 font-mono mt-1">
                <span>QUIET (1)</span>
                <span>HYPER-SENSITIVE (10)</span>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-900/40 pt-4 grid grid-cols-2 gap-4">
            {/* Notifications Toggle */}
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                id="checkbox-notifications"
                type="checkbox"
                checked={settings.notificationsEnabled}
                onChange={(e) => handleInputChange('notificationsEnabled', e.target.checked)}
                className="sr-only peer"
              />
              <div className="relative w-10 h-5.5 bg-slate-900 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600 peer-checked:after:bg-cyan-300" />
              <div>
                <span className="text-xs font-bold text-slate-300 font-sans group-hover:text-slate-100 transition-colors">
                  Desktop Alerts
                </span>
                <span className="text-[8px] text-slate-500 font-mono block leading-none mt-0.5">
                  Toggle browser popups
                </span>
              </div>
            </label>

            {/* Power Saving Theme Mode Toggle */}
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                id="checkbox-power-saving"
                type="checkbox"
                checked={settings.lowLightMode}
                onChange={(e) => handleInputChange('lowLightMode', e.target.checked)}
                className="sr-only peer"
              />
              <div className="relative w-10 h-5.5 bg-slate-900 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600 peer-checked:after:bg-cyan-300" />
              <div>
                <span className="text-xs font-bold text-slate-300 font-sans group-hover:text-slate-100 transition-colors">
                  Cyber Dimmer
                </span>
                <span className="text-[8px] text-slate-500 font-mono block leading-none mt-0.5">
                  Ultra low glow style
                </span>
              </div>
            </label>
          </div>
        </div>
      </GlowCard>

      {/* Connection Docs and CORS Workaround Guidelines */}
      <GlowCard
        id="card-settings-troubleshooting-docs"
        title="Developer Connection Portal"
        subtitle="HOW TO ESTABLISH PHYSICAL ENDPOINTS"
        glowColor="cyan"
      >
        <div className="flex flex-col gap-4 font-mono text-[11px] leading-relaxed text-slate-400">
          <div className="flex items-start gap-2.5 p-3 rounded-xl border border-cyan-500/10 bg-cyan-950/5">
            <BookOpen className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <span className="text-xs font-bold text-slate-200 block mb-1">
                ESP32 HTTP Routing Protocols
              </span>
              <span>
                To connect your real hardware board directly, configure your ESP32 Arduino sketches
                or MicroPython code to host a web server on port <strong className="text-cyan-400">80</strong>, implementing these exact endpoints:
              </span>
            </div>
          </div>

          <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-900 flex flex-col gap-1.5 select-all font-mono text-[10px]">
            <div>
              <span className="text-cyan-400 font-bold">GET /data</span>
              <span className="text-slate-500"> - Returns live sensor JSON structure</span>
            </div>
            <div>
              <span className="text-cyan-400 font-bold">GET /led?value=X</span>
              <span className="text-slate-500"> - Configures LED level (0-255)</span>
            </div>
            <div>
              <span className="text-cyan-400 font-bold">GET /fan?value=Y</span>
              <span className="text-slate-500"> - Sets ventilation speed (0-255)</span>
            </div>
            <div>
              <span className="text-cyan-400 font-bold">GET /auto</span>
              <span className="text-slate-500"> - Toggles smart auto profile engine</span>
            </div>
            <div>
              <span className="text-cyan-400 font-bold">GET /voice</span>
              <span className="text-slate-500"> - Triggers the ESP32 vocal mic record</span>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-xl border border-amber-500/10 bg-amber-950/5">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <span className="text-xs font-bold text-slate-200 block mb-1">
                Bypassing Browser Insecure Content (CORS / Mixed Content)
              </span>
              <span className="block mb-2 text-[10.5px]">
                Because this website loads over <strong className="text-slate-200">HTTPS (Secure)</strong>, browsers will automatically block XMLHttpRequests to <strong className="text-slate-200">HTTP (Insecure)</strong> local IP addresses like <code className="text-amber-400 font-mono bg-amber-950/30 px-1 py-0.5 rounded">http://192.168.x.x</code> due to <strong>Mixed Content Security Policies</strong>.
              </span>
              
              <span className="font-bold text-slate-300 block mb-1">Workarounds to connect real hardware:</span>
              <ul className="list-decimal pl-4 flex flex-col gap-1 text-[10px]">
                <li>
                  <strong>Open in New Tab & Run Insecure</strong>: Click the 'Open in new tab' button in AI Studio, click the browser lock icon next to the address bar, choose <strong>Site Settings</strong>, and set <strong>Insecure Content</strong> to <strong>Allow</strong>.
                </li>
                <li>
                  <strong>Use CORS Extension</strong>: Install a browser extension like <em>"Allow CORS"</em> or <em>"CORS Unblock"</em> to allow local network requests.
                </li>
                <li>
                  <strong>CORS headers in ESP32</strong>: Ensure your ESP32 server appends this CORS header to every HTTP response: 
                  <code className="block bg-slate-950 px-2 py-1 rounded text-[9px] text-cyan-300 border border-slate-900 mt-1 select-all">
                    server.sendHeader("Access-Control-Allow-Origin", "*");
                  </code>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </GlowCard>

      <button
        id="btn-close-settings-modal"
        onClick={onClose}
        className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 text-slate-950 font-bold text-xs uppercase tracking-wider py-3 rounded-xl font-mono hover:shadow-[0_0_15px_rgba(0,255,208,0.35)] hover:from-blue-500 hover:to-cyan-400 transition-all duration-200 cursor-pointer"
      >
        DISMISS & RUN SYSTEM
      </button>
    </div>
  );
}
