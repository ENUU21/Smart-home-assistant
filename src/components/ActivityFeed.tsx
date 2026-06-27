/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ActivityLog } from '../types';
import GlowCard from './GlowCard';
import { Terminal, ShieldAlert, CircleCheck, Info, Trash2 } from 'lucide-react';

interface ActivityFeedProps {
  logs: ActivityLog[];
  onClearLogs: () => void;
}

export default function ActivityFeed({ logs, onClearLogs }: ActivityFeedProps) {
  const getLogIcon = (type: ActivityLog['type']) => {
    switch (type) {
      case 'success':
        return <CircleCheck className="w-3.5 h-3.5 text-emerald-400" />;
      case 'warning':
        return <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />;
      case 'alert':
        return <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />;
      case 'info':
      default:
        return <Info className="w-3.5 h-3.5 text-cyan-400" />;
    }
  };

  const getLogBorder = (type: ActivityLog['type']) => {
    switch (type) {
      case 'success':
        return 'border-emerald-500/10 bg-emerald-950/5';
      case 'warning':
        return 'border-amber-500/10 bg-amber-950/5';
      case 'alert':
        return 'border-rose-500/10 bg-rose-950/5';
      case 'info':
      default:
        return 'border-slate-900 bg-slate-950/10';
    }
  };

  return (
    <GlowCard
      id="card-activity-logs"
      title="System Activity Feed"
      subtitle="REAL-TIME IOT SECURE PROTOCOL LOGS"
      glowColor="none"
      className="md:col-span-2 overflow-hidden flex flex-col max-h-[380px]"
      headerAction={
        <button
          id="btn-clear-activity-logs"
          onClick={onClearLogs}
          title="Clear Terminal Feed"
          className="p-1.5 rounded-lg border border-slate-900 bg-slate-950 hover:bg-slate-900 text-slate-500 hover:text-slate-300 transition-colors duration-200"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      }
    >
      <div className="flex-grow overflow-y-auto max-h-[250px] pr-1 flex flex-col gap-2 font-mono scrollbar-thin">
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-600 text-center">
            <Terminal className="w-8 h-8 opacity-40 mb-2 animate-pulse" />
            <span className="text-[10px]">No logs registered in this buffer.</span>
          </div>
        ) : (
          [...logs].reverse().map((log) => (
            <div
              key={log.id}
              className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-[10px] leading-relaxed transition-all hover:bg-slate-900/40 ${getLogBorder(
                log.type
              )}`}
            >
              {/* Timestamp */}
              <span className="text-slate-500 shrink-0 font-bold tracking-wider selection:bg-cyan-500">
                {log.timestamp}
              </span>

              {/* Icon badge */}
              <div className="shrink-0 mt-0.5">{getLogIcon(log.type)}</div>

              {/* Message */}
              <span className="text-slate-300 select-all font-mono leading-tight">
                {log.message}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Footer statistics */}
      <div className="mt-4 border-t border-slate-900/40 pt-3 flex items-center justify-between text-[9px] font-mono text-slate-500">
        <span>BUFFER CAPACITY: {logs.length}/500 RECS</span>
        <span>AUDIT SECURE BROADCAST ENABLED</span>
      </div>
    </GlowCard>
  );
}
