/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Mic, MicOff, MessageSquare, CornerDownRight, Sparkles } from 'lucide-react';
import { ESP32Data } from '../types';
import GlowCard from './GlowCard';
import { mockVoiceCommands, createLog } from '../mockData';

interface VoiceAssistantProps {
  data: ESP32Data;
  onVoiceTrigger: () => void;
  onCommandTriggered: (updatedData: Partial<ESP32Data>, logMsg: string) => void;
  addLog: (log: ReturnType<typeof createLog>) => void;
  isLoading: boolean;
}

export default function VoiceAssistant({
  data,
  onVoiceTrigger,
  onCommandTriggered,
  addLog,
  isLoading,
}: VoiceAssistantProps) {
  const [voiceStatus, setVoiceStatus] = useState<'IDLE' | 'LISTENING' | 'PROCESSING'>('IDLE');
  const [lastCommand, setLastCommand] = useState<string>('System initialized.');
  const [assistantReply, setAssistantReply] = useState<string>('Awaiting vocal activation prompt.');

  // Automatically cycle mock voice states if external physical voice trigger occurs
  useEffect(() => {
    if (data.voice) {
      triggerDemoCycle(mockVoiceCommands[Math.floor(Math.random() * mockVoiceCommands.length)]);
    }
  }, [data.voice]);

  const triggerDemoCycle = (cmdObj: typeof mockVoiceCommands[0]) => {
    setVoiceStatus('LISTENING');
    setLastCommand('Listening...');
    setAssistantReply('Recording sound input wave...');

    // 1s -> Processing
    setTimeout(() => {
      setVoiceStatus('PROCESSING');
      setLastCommand(`"${cmdObj.command}"`);
      setAssistantReply('Parsing verbal syntax...');

      // 1.8s -> Execute & Idle
      setTimeout(() => {
        setVoiceStatus('IDLE');
        setAssistantReply(cmdObj.response);
        
        // Build state updates
        const updates: Partial<ESP32Data> = { voice: false };
        if (cmdObj.led !== undefined) updates.led = cmdObj.led;
        if (cmdObj.fan !== undefined) updates.fan = cmdObj.fan;
        
        onCommandTriggered(
          updates,
          `Voice activated: "${cmdObj.command}". Reply: "${cmdObj.response}"`
        );
      }, 1200);
    }, 1200);
  };

  const handleSampleClick = (cmdObj: typeof mockVoiceCommands[0]) => {
    if (voiceStatus !== 'IDLE') return;
    onVoiceTrigger(); // trigger standard signal
    triggerDemoCycle(cmdObj);
  };

  return (
    <GlowCard
      id="card-voice-assistant"
      title="Voice Assistant"
      subtitle="KITTEN NLP COGNITIVE MODULE"
      glowColor={voiceStatus === 'LISTENING' ? 'cyan' : voiceStatus === 'PROCESSING' ? 'purple' : 'none'}
    >
      <div className="flex flex-col gap-5">
        {/* State Display & Audio Waveform */}
        <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-900 bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl transition-all duration-300 ${
                voiceStatus === 'LISTENING'
                  ? 'bg-cyan-500/10 text-cyan-400 animate-pulse'
                  : voiceStatus === 'PROCESSING'
                    ? 'bg-purple-500/10 text-purple-400 animate-spin'
                    : 'bg-slate-900 text-slate-500'
              }`}
            >
              {voiceStatus === 'IDLE' ? <MicOff className="w-4.5 h-4.5" /> : <Mic className="w-4.5 h-4.5" />}
            </div>

            <div>
              <span className="text-[9px] text-slate-500 font-mono tracking-wider block leading-none">
                ASSISTANT STATE
              </span>
              <span
                className={`text-sm font-bold font-mono tracking-widest ${
                  voiceStatus === 'LISTENING'
                    ? 'text-cyan-400'
                    : voiceStatus === 'PROCESSING'
                      ? 'text-purple-400'
                      : 'text-slate-400'
                }`}
              >
                {voiceStatus}
              </span>
            </div>
          </div>

          {/* Hologram style sound waves */}
          <div className="flex gap-1 items-end h-8">
            {[1, 2, 3, 4, 5, 6, 7].map((barIndex) => {
              // Dynamic bar heights depending on voice state
              let animationClass = '';
              if (voiceStatus === 'LISTENING') {
                animationClass = 'animate-[pulse_0.4s_infinite_alternate]';
              } else if (voiceStatus === 'PROCESSING') {
                animationClass = 'animate-[pulse_0.15s_infinite_alternate]';
              }
              const delay = `${barIndex * 100}ms`;

              return (
                <div
                  key={barIndex}
                  className={`w-1 rounded-full transition-all duration-300 ${
                    voiceStatus === 'LISTENING'
                      ? 'bg-cyan-400'
                      : voiceStatus === 'PROCESSING'
                        ? 'bg-purple-400'
                        : 'bg-slate-800'
                  } ${animationClass}`}
                  style={{
                    height: voiceStatus === 'IDLE' ? '4px' : `${Math.floor(Math.random() * 20) + 8}px`,
                    animationDelay: delay,
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* NLP Command Terminal Output */}
        <div className="p-4 rounded-xl border border-slate-900 bg-slate-950/80 font-mono text-xs flex flex-col gap-2.5">
          <div>
            <div className="flex items-center gap-1.5 text-slate-500 text-[10px]">
              <CornerDownRight className="w-3 h-3 text-cyan-400" />
              <span>LAST VERBAL INPUT RECORDED:</span>
            </div>
            <div className="text-slate-200 pl-4.5 font-sans font-medium mt-1">
              {lastCommand}
            </div>
          </div>

          <div className="border-t border-slate-900/60 pt-2.5">
            <div className="flex items-center gap-1.5 text-slate-500 text-[10px]">
              <MessageSquare className="w-3 h-3 text-cyan-400" />
              <span>VIRTUAL AUDIO SYNTH REACTION:</span>
            </div>
            <div className="text-cyan-400/90 pl-4.5 text-[11px] leading-relaxed mt-1 italic">
              "{assistantReply}"
            </div>
          </div>
        </div>

        {/* Quick Voice Simulation Buttons */}
        <div>
          <span className="text-[10px] text-slate-500 font-mono tracking-wider block mb-2 uppercase flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" /> Click to Simulate Command
          </span>

          <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto pr-1">
            {mockVoiceCommands.map((cmdObj, idx) => (
              <button
                key={idx}
                id={`btn-voice-preset-${idx}`}
                onClick={() => handleSampleClick(cmdObj)}
                disabled={voiceStatus !== 'IDLE' || isLoading}
                className="text-[10px] font-mono px-2.5 py-1.5 rounded-lg border border-slate-900 bg-slate-950/50 text-slate-400 hover:border-cyan-500/30 hover:bg-cyan-950/10 hover:text-cyan-300 transition-all duration-200 disabled:opacity-40 disabled:pointer-events-none text-left"
              >
                "{cmdObj.command}"
              </button>
            ))}
          </div>
        </div>
      </div>
    </GlowCard>
  );
}
