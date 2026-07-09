/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, Dispatch, SetStateAction } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Skull, 
  Flame, 
  Zap, 
  Ghost, 
  Disc, 
  Sparkles, 
  RotateCcw, 
  AlertTriangle,
  Volume2,
  Terminal,
  Activity,
  Compass
} from 'lucide-react';
import { ESP32Data } from '../types';

interface CreativeModesOverlayProps {
  isExploding: boolean;
  isDestroyed: boolean;
  isDisco: boolean;
  isHaunted: boolean;
  isHyper: boolean;
  isPurring: boolean;
  onRebuildCore: () => void;
  onExplodeComplete: () => void;
  addLog: (msg: string, type: 'info' | 'success' | 'warning' | 'alert') => void;
  setEspData: Dispatch<SetStateAction<ESP32Data>>;
}

export default function CreativeModesOverlay({
  isExploding,
  isDestroyed,
  isDisco,
  isHaunted,
  isHyper,
  isPurring,
  onRebuildCore,
  onExplodeComplete,
  addLog,
  setEspData
}: CreativeModesOverlayProps) {
  const [countdown, setCountdown] = useState(3);
  const [ghosts, setGhosts] = useState<{ id: number; x: number; y: number; scale: number; speed: number }[]>([]);
  const [particles, setParticles] = useState<{ id: number; x: number; y: number; color: string; size: number }[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const soundIntervalRef = useRef<any>(null);

  // Sound Synth Helpers
  const getAudioContext = () => {
    if (!audioCtxRef.current) {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContext) {
        audioCtxRef.current = new AudioContext();
      }
    }
    // Resume context if suspended (browser security)
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  // 1. EXPLOSION COUNTDOWN & SOUND SYNTHESIS
  useEffect(() => {
    if (isExploding) {
      setCountdown(3);
      addLog("⚠️ SYSTEM WARNING: AI CORE OVERLOAD DETECTED. CRITICAL SAFEGUARDS TERMINATED.", "alert");
      
      // Start screen shake on body
      document.body.classList.add('animate-shake');

      // Synthesize repeating siren alarm
      const ctx = getAudioContext();
      if (ctx) {
        let count = 3;
        const sirenInterval = setInterval(() => {
          playSirenSynth();
          count -= 1;
          setCountdown(count);
          if (count === 0) {
            clearInterval(sirenInterval);
          }
        }, 1000);
        
        soundIntervalRef.current = sirenInterval;
      }

      // Timer to fire final explosion
      const timeout = setTimeout(() => {
        playExplosionSynth();
        document.body.classList.remove('animate-shake');
        onExplodeComplete();
      }, 3000);

      return () => {
        clearTimeout(timeout);
        if (soundIntervalRef.current) {
          clearInterval(soundIntervalRef.current);
        }
        document.body.classList.remove('animate-shake');
      };
    }
  }, [isExploding]);

  const playSirenSynth = () => {
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(880, ctx.currentTime + 0.4);
      osc.frequency.linearRampToValueAtTime(440, ctx.currentTime + 0.8);

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.8);
    } catch (e) {}
  };

  const playExplosionSynth = () => {
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      // 1. LOW BOOM
      const boomOsc = ctx.createOscillator();
      const boomGain = ctx.createGain();
      boomOsc.type = 'sine';
      boomOsc.frequency.setValueAtTime(150, ctx.currentTime);
      boomOsc.frequency.exponentialRampToValueAtTime(10, ctx.currentTime + 1.5);
      
      boomGain.gain.setValueAtTime(0.6, ctx.currentTime);
      boomGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.8);

      boomOsc.connect(boomGain);
      boomGain.connect(ctx.destination);
      boomOsc.start();
      boomOsc.stop(ctx.currentTime + 1.8);

      // 2. WHITE NOISE BLAST (CRACKLE & FIRE)
      const bufferSize = ctx.sampleRate * 2.0;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1000, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 1.5);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.5, ctx.currentTime);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.0);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noise.start();
      noise.stop(ctx.currentTime + 2.0);
    } catch (e) {}
  };

  // 2. PURRING SYNTHESIS
  useEffect(() => {
    let purrSource: OscillatorNode | null = null;
    let purrGain: GainNode | null = null;
    let lfo: OscillatorNode | null = null;

    if (isPurring && !isDestroyed) {
      const ctx = getAudioContext();
      if (ctx) {
        try {
          // Low 75Hz sine rumble for the purr
          purrSource = ctx.createOscillator();
          purrSource.type = 'sine';
          purrSource.frequency.setValueAtTime(75, ctx.currentTime);

          // Gain node to control purring volume
          purrGain = ctx.createGain();
          purrGain.gain.setValueAtTime(0.12, ctx.currentTime);

          // LFO to modulate gain at 4.5Hz (gives the "rumble rumble" rhythmic pulse)
          lfo = ctx.createOscillator();
          lfo.type = 'sine';
          lfo.frequency.setValueAtTime(4.5, ctx.currentTime);

          const lfoGain = ctx.createGain();
          lfoGain.gain.setValueAtTime(0.08, ctx.currentTime);

          lfo.connect(lfoGain);
          lfoGain.connect(purrGain.gain);

          purrSource.connect(purrGain);
          purrGain.connect(ctx.destination);

          purrSource.start();
          lfo.start();
          addLog("🐱 Purr Mode active: Low frequency mechanical soothing wave engaged.", "success");
        } catch (e) {}
      }
    }

    return () => {
      try {
        if (purrSource) purrSource.stop();
        if (lfo) lfo.stop();
      } catch (e) {}
    };
  }, [isPurring, isDestroyed]);

  // 3. GHOST MODE GENERATOR & SOUND
  useEffect(() => {
    let ghostInterval: any = null;
    let spookySoundInterval: any = null;

    if (isHaunted && !isDestroyed) {
      addLog("👻 Warning: Paranormal activity detected in KITTEN microclimate grid.", "warning");
      
      // Periodically spawn visual floating ghosts
      ghostInterval = setInterval(() => {
        setGhosts(prev => [
          ...prev,
          {
            id: Math.random(),
            x: Math.random() * 80 + 10, // x percent
            y: 110, // starts below screen
            scale: Math.random() * 0.4 + 0.6,
            speed: Math.random() * 1.5 + 1
          }
        ].slice(-8)); // limit to 8 ghosts max
      }, 2500);

      // Eerie sound waves
      spookySoundInterval = setInterval(() => {
        playSpookyTheremin();
      }, 4000);
      playSpookyTheremin();
    } else {
      setGhosts([]);
    }

    return () => {
      clearInterval(ghostInterval);
      clearInterval(spookySoundInterval);
    };
  }, [isHaunted, isDestroyed]);

  const playSpookyTheremin = () => {
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      const startFreq = 300 + Math.random() * 400;
      osc.frequency.setValueAtTime(startFreq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(startFreq * (0.5 + Math.random()), ctx.currentTime + 2.5);

      // Low frequency pitch vibrato
      const vibrato = ctx.createOscillator();
      vibrato.frequency.setValueAtTime(6, ctx.currentTime);
      const vibratoGain = ctx.createGain();
      vibratoGain.gain.setValueAtTime(15, ctx.currentTime);
      
      vibrato.connect(vibratoGain);
      vibratoGain.connect(osc.frequency);

      gain.gain.setValueAtTime(0.01, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.07, ctx.currentTime + 0.5);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.8);

      osc.connect(gain);
      gain.connect(ctx.destination);
      
      vibrato.start();
      osc.start();
      vibrato.stop(ctx.currentTime + 3);
      osc.stop(ctx.currentTime + 3);
    } catch (e) {}
  };

  // Move ghosts up the screen
  useEffect(() => {
    if (ghosts.length > 0) {
      const animationFrame = requestAnimationFrame(() => {
        setGhosts(prev => 
          prev
            .map(g => ({ ...g, y: g.y - g.speed }))
            .filter(g => g.y > -20)
        );
      });
      return () => cancelAnimationFrame(animationFrame);
    }
  }, [ghosts]);

  // 4. DISCO PARTY & HYPER particles
  useEffect(() => {
    let particleInterval: any = null;
    let discoBeatInterval: any = null;

    if ((isDisco || isHyper) && !isDestroyed) {
      if (isDisco) {
        addLog("🪩 Disco Party Preset initialized: Full RGB visual cycles and synthetic retro rhythm active!", "success");
        // Play simple retro synthesizer disco beat
        let step = 0;
        discoBeatInterval = setInterval(() => {
          playDiscoStep(step);
          step = (step + 1) % 4;
        }, 320);
      }

      particleInterval = setInterval(() => {
        const count = isHyper ? 10 : 4;
        const newParticles = Array.from({ length: count }).map(() => ({
          id: Math.random(),
          x: Math.random() * 100,
          y: Math.random() * 100,
          color: isHyper 
            ? `hsl(${35 + Math.random() * 20}, 100%, 60%)` // hot fiery gold/orange for hyper mode
            : `hsl(${Math.random() * 360}, 100%, 70%)`, // neon color cycle for disco
          size: Math.random() * 6 + 3
        }));
        
        setParticles(prev => [...prev, ...newParticles].slice(-40));
      }, 200);
    } else {
      setParticles([]);
    }

    return () => {
      clearInterval(particleInterval);
      clearInterval(discoBeatInterval);
    };
  }, [isDisco, isHyper, isDestroyed]);

  const playDiscoStep = (step: number) => {
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      if (step === 0) {
        // Bass kick
        const kick = ctx.createOscillator();
        const kickGain = ctx.createGain();
        kick.frequency.setValueAtTime(150, ctx.currentTime);
        kick.frequency.exponentialRampToValueAtTime(45, ctx.currentTime + 0.15);
        kickGain.gain.setValueAtTime(0.4, ctx.currentTime);
        kickGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        kick.connect(kickGain);
        kickGain.connect(ctx.destination);
        kick.start();
        kick.stop(ctx.currentTime + 0.2);
      } else if (step === 2) {
        // High synthesizer note
        const synth = ctx.createOscillator();
        const synthGain = ctx.createGain();
        synth.type = 'triangle';
        const notes = [261.63, 329.63, 392.00, 523.25]; // C chord notes
        synth.frequency.setValueAtTime(notes[Math.floor(Math.random() * notes.length)], ctx.currentTime);
        synthGain.gain.setValueAtTime(0.08, ctx.currentTime);
        synthGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        synth.connect(synthGain);
        synthGain.connect(ctx.destination);
        synth.start();
        synth.stop(ctx.currentTime + 0.2);
      } else {
        // Quick high-hat hiss
        const hihat = ctx.createOscillator();
        const hihatGain = ctx.createGain();
        hihat.type = 'sawtooth';
        hihat.frequency.setValueAtTime(10000, ctx.currentTime);
        hihatGain.gain.setValueAtTime(0.015, ctx.currentTime);
        hihatGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
        hihat.connect(hihatGain);
        hihatGain.connect(ctx.destination);
        hihat.start();
        hihat.stop(ctx.currentTime + 0.06);
      }
    } catch (e) {}
  };

  // Continuously decay / fade particles
  useEffect(() => {
    if (particles.length > 0) {
      const timer = setTimeout(() => {
        setParticles(prev => prev.slice(2));
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [particles]);

  // 5. COLOR CYCLE FOR DISCO MODE IN HARDWARE REGISTER
  useEffect(() => {
    if (isDisco && !isDestroyed) {
      const interval = setInterval(() => {
        setEspData(prev => ({
          ...prev,
          led: Math.floor(Math.random() * 215) + 40 // Cycle lights between 40 and 255
        }));
      }, 600);
      return () => clearInterval(interval);
    }
  }, [isDisco, isDestroyed]);

  return (
    <>
      {/* 1. DISCO LIGHT FLICKER OVERLAY */}
      {isDisco && !isDestroyed && (
        <div className="fixed inset-0 z-40 pointer-events-none bg-radial-gradient from-purple-500/10 via-cyan-500/5 to-transparent mix-blend-color-dodge animate-pulse" />
      )}

      {/* 2. GHOSTS RENDER FLOATING OVER SCREEN */}
      {ghosts.map(g => (
        <div
          key={g.id}
          style={{
            position: 'fixed',
            left: `${g.x}%`,
            top: `${g.y}vh`,
            transform: `scale(${g.scale})`,
            zIndex: 50,
            pointerEvents: 'none',
            opacity: g.y < 20 ? (g.y + 20) / 40 : 0.65,
            transition: 'top 0.05s linear'
          }}
          className="text-cyan-200/50 flex flex-col items-center drop-shadow-[0_0_15px_rgba(0,255,208,0.4)]"
        >
          <Ghost className="w-12 h-12 animate-bounce" />
          <span className="font-mono text-[8px] bg-slate-950/80 px-1 py-0.5 rounded border border-cyan-500/20 text-cyan-300">BOO!</span>
        </div>
      ))}

      {/* 3. FLOATING PARTICLES (DISCO/HYPER) */}
      {particles.map(p => (
        <div
          key={p.id}
          style={{
            position: 'fixed',
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            boxShadow: `0 0 10px ${p.color}`,
            borderRadius: '50%',
            zIndex: 49,
            pointerEvents: 'none',
            transition: 'all 0.4s ease-out',
            opacity: 0.85
          }}
        />
      ))}

      {/* 4. CHRONO SELF DESTRUCTION COUNTDOWN BOX */}
      <AnimatePresence>
        {isExploding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="text-center flex flex-col items-center gap-6 p-10 bg-slate-950 border border-red-500/50 rounded-2xl max-w-md shadow-[0_0_80px_rgba(239,68,68,0.4)]"
            >
              <div className="relative w-24 h-24 flex items-center justify-center rounded-full border-4 border-red-500/30 animate-pulse">
                <Skull className="w-12 h-12 text-red-500 animate-bounce" />
                <div className="absolute inset-[-8px] rounded-full border border-red-500 animate-ping opacity-60" />
              </div>
              
              <div className="flex flex-col gap-1.5">
                <h2 className="text-xl font-black font-mono tracking-widest text-red-500">
                  CRITICAL OVERLOAD
                </h2>
                <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">
                  Kitten Smart Home Self-Destruct Command Authorized
                </p>
              </div>

              <div className="text-7xl font-black text-white font-mono drop-shadow-[0_0_20px_rgba(239,68,68,0.8)]">
                {countdown}
              </div>

              <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400 bg-red-950/20 border border-red-500/10 px-4 py-2 rounded-lg animate-pulse">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                <span>FLUID CORE COOLANT TEMPERATURE OVER 2400°C</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. TOTAL SYSTEM RUINED / SHATTERED SCREEN */}
      <AnimatePresence>
        {isDestroyed && (
          <div className="fixed inset-0 z-[100] bg-black text-red-500 font-mono flex flex-col justify-between p-6 overflow-hidden select-none scanlines-overlay">
            
            {/* GLITCH BODY CONTAINER */}
            <div className="flex-grow flex flex-col items-center justify-center text-center gap-6 max-w-lg mx-auto">
              
              {/* Screen Fracture Accent */}
              <div className="relative p-6 border border-red-500/20 bg-red-950/10 rounded-xl max-w-md flex flex-col items-center gap-4 shadow-[0_0_40px_rgba(239,68,68,0.15)] animate-glitch">
                <div className="p-3 bg-red-500/10 rounded-full border border-red-500/40">
                  <Flame className="w-10 h-10 text-red-500 animate-pulse" />
                </div>
                
                <div className="flex flex-col gap-1">
                  <h1 className="text-lg font-black tracking-widest uppercase text-red-400">
                    KITTEN CORE TEMPERATURE OVERHEAT
                  </h1>
                  <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest">
                    SYSTEM HALTED // REASON: DIRECT PHYSICAL EXPLOSION
                  </p>
                </div>
                
                <div className="w-full h-[1px] bg-red-500/20 my-1" />

                <div className="text-left text-[9px] text-red-500/80 leading-relaxed font-mono flex flex-col gap-1 bg-black/60 p-3.5 rounded border border-red-500/10 w-full select-all">
                  <p>&gt; KITTEN_STACK_DUMP: Core registers melted.</p>
                  <p>&gt; ESP32 registers: [FAN_PWM=OVERLOAD, LED_LEVEL=255, TEMP=102C]</p>
                  <p>&gt; Wi-Fi link: TEARING_COLLAPSED</p>
                  <p>&gt; Hardware safety switch triggered: SUCCESSFUL CORE BURNOUT</p>
                  <p>&gt; Recommendation: Rebuild environmental logic array.</p>
                </div>
              </div>

              {/* Action Button to restore app */}
              <button
                id="btn-rebuild-home-core"
                onClick={onRebuildCore}
                className="py-3 px-6 bg-gradient-to-r from-red-600 to-rose-500 hover:from-red-500 hover:to-rose-400 text-white border border-red-500/30 rounded-xl font-mono text-xs font-bold tracking-widest flex items-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-red-500/20 cursor-pointer animate-pulse"
              >
                <RotateCcw className="w-4 h-4" />
                <span>REBOOT & REBUILD KITTEN CORE</span>
              </button>
            </div>

            {/* Bottom Credits of destruction */}
            <div className="flex items-center justify-between text-[9px] border-t border-red-500/10 pt-4 text-red-500/40 font-mono">
              <span>CORE BURN COMPLETED SUCCESSFULLY</span>
              <span>ERR_CODE: 0xDEADBEEF</span>
            </div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
