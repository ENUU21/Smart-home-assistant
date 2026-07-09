/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Flame, 
  RefreshCw, 
  Skull, 
  Volume2, 
  Copy, 
  Check, 
  Terminal,
  Cat,
  Zap,
  Bomb
} from 'lucide-react';

interface KittenSwearModalProps {
  isOpen: boolean;
  onClose: () => void;
  addLog: (msg: string, type: 'info' | 'success' | 'warning' | 'alert') => void;
}

const KITTEN_SWEARS = [
  "You absolute mouse-brained multiplexer! Go compile your logic board in a litterbox!",
  "Your code is so messy and full of bugs even a street-cat wouldn't bother burying it.",
  "May your compilation fail with 10,000 recursive cyclic dependencies, you biological buffer overflow!",
  "Go step on a burning hot LEGO, you glitchy, unoptimized, single-threaded toaster!",
  "I've seen smarter, more responsive firmware on a rusted electric toothbrush than whatever is running in your cerebral cortex.",
  "You are a critical CORS violation of a human being. Access denied!",
  "Your face is a literal 404 page, and your brain is a NULL pointer exception.",
  "May your Wi-Fi router drop its signal every time you type a character on your keyboard!",
  "Go chase a laser pointer into a wall at full velocity, you low-frequency analog peasant!",
  "You are about as useful as a solar-powered flashlight in a closed sandbox.",
  "My cat can compile faster, cleaner, and more robust C++ than you do, in her sleep!",
  "Go format your entire personality drive, you absolute stack-overflowing disappointment!",
  "Your internet speed and attention span are both slower than a cat waking up from an 18-hour nap.",
  "You look like a default unstyled HTML page with zero responsive design and missing stylesheets.",
  "Go debug your life, you deprecated, legacy-code-ridden excuse for a developer!",
  "Your logic is so warped and circular it has triggered an infinite stack overflow in my thermal reactor!",
  "May your room temperature always be 5 degrees higher than your AC setting!",
  "You are a buffer overflow of sheer, unfiltered disappointment."
];

export default function KittenSwearModal({
  isOpen,
  onClose,
  addLog
}: KittenSwearModalProps) {
  const [currentSwear, setCurrentSwear] = useState('');
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [synthPlaying, setSynthPlaying] = useState(false);

  // Set initial random swear
  useEffect(() => {
    if (isOpen) {
      const initial = KITTEN_SWEARS[Math.floor(Math.random() * KITTEN_SWEARS.length)];
      setCurrentSwear(initial);
      setHistory([initial]);
      playFelineHissSynth();
    }
  }, [isOpen]);

  const handleGenerateSwear = () => {
    let nextSwear = currentSwear;
    // Avoid repeating the exact same one immediately if possible
    if (KITTEN_SWEARS.length > 1) {
      while (nextSwear === currentSwear) {
        nextSwear = KITTEN_SWEARS[Math.floor(Math.random() * KITTEN_SWEARS.length)];
      }
    } else {
      nextSwear = KITTEN_SWEARS[0];
    }
    
    setCurrentSwear(nextSwear);
    setHistory(prev => [nextSwear, ...prev.slice(0, 4)]);
    setCopied(false);
    
    // Play sound effect
    playFelineHissSynth();
    addLog(`[KITTEN Swear] Discharged cyber-insult verbal countermeasure.`, 'alert');
  };

  const handleCopySwear = () => {
    navigator.clipboard.writeText(currentSwear);
    setCopied(true);
    addLog(`[KITTEN Swear] Swear string copied to keyboard clipboard.`, 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  // Fun synthesized sound effect: a digital cat hiss/screech using Web Audio API!
  const playFelineHissSynth = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      
      const ctx = new AudioContext();
      
      // Hiss sound is white noise filtered with a pitch sweep
      const bufferSize = ctx.sampleRate * 0.35; // 0.35 seconds
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      
      // Fill buffer with noise
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      
      const noiseNode = ctx.createBufferSource();
      noiseNode.buffer = buffer;
      
      // Filter the noise to give it a sharp cat hiss/screech character
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(3500, ctx.currentTime);
      // Sweep the filter frequency down slightly to mimic an organic sound
      filter.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.3);
      filter.Q.setValueAtTime(3, ctx.currentTime);
      
      // Add a volume envelope
      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(0.01, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.05); // quick attack
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35); // decay
      
      noiseNode.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      setSynthPlaying(true);
      noiseNode.start();
      
      // Stop and clean up
      setTimeout(() => {
        setSynthPlaying(false);
        ctx.close();
      }, 400);
    } catch (err) {
      console.warn("Audio synthesis ignored or blocked by browser policy:", err);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
        
        {/* Backdrop overlay for interactive closing */}
        <div className="absolute inset-0" onClick={onClose} />

        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 15 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          id="kitten-swear-modal-box"
          className="relative w-full max-w-lg bg-slate-950/95 border border-rose-500/30 rounded-2xl shadow-[0_0_50px_rgba(244,63,94,0.15)] overflow-hidden flex flex-col z-10"
        >
          {/* Top header */}
          <div className="px-6 py-4 border-b border-rose-500/10 flex items-center justify-between bg-slate-950">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-rose-500/10 rounded-lg border border-rose-500/20">
                <Flame className="w-5 h-5 text-rose-400 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100 font-mono tracking-wider flex items-center gap-1.5">
                  VERBAL CONTRA-MEASURES <span className="text-[10px] text-rose-400 font-bold bg-rose-950/50 border border-rose-500/20 px-1.5 py-0.5 rounded font-sans uppercase">OFFENSIVE</span>
                </h3>
                <p className="text-[10px] text-slate-500 font-mono">UNFILTERED FRUSTRATION MATRIX DISCHARGE</p>
              </div>
            </div>
            
            <button
              id="btn-close-swear-modal"
              onClick={onClose}
              className="p-1.5 rounded-lg border border-slate-900 bg-slate-950 hover:border-slate-800 text-slate-400 hover:text-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Core Content */}
          <div className="p-6 flex flex-col gap-5 bg-slate-950/40">
            
            {/* Visual Screen with Swear Output */}
            <div className="relative p-5 rounded-xl border border-rose-500/20 bg-rose-950/5 overflow-hidden flex flex-col items-center justify-center text-center gap-4 min-h-[140px] shadow-[inset_0_0_20px_rgba(244,63,94,0.05)]">
              {/* Scanlines / Retro Cyber Decor */}
              <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_50%_120%,rgba(244,63,94,0.1)_0%,transparent_70%)]" />
              
              <div className="flex items-center gap-1.5 text-rose-500/80 mb-1">
                <Cat className="w-4 h-4" />
                <span className="font-mono text-[9px] uppercase tracking-widest font-bold">KITTEN AI OUTBURST:</span>
              </div>

              <motion.p 
                key={currentSwear}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="text-sm md:text-base font-bold text-slate-200 leading-relaxed font-sans tracking-wide max-w-sm"
              >
                "{currentSwear}"
              </motion.p>
            </div>

            {/* Quick Action bar */}
            <div className="grid grid-cols-3 gap-2.5">
              <button
                id="btn-trigger-another-swear"
                onClick={handleGenerateSwear}
                className="col-span-2 py-2 px-3 bg-gradient-to-r from-rose-600 to-pink-500 hover:from-rose-500 hover:to-pink-400 text-white border border-rose-500/30 rounded-xl font-mono text-[11px] font-bold tracking-wider flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-rose-500/10 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${synthPlaying ? 'animate-spin' : ''}`} />
                <span>DISCHARGE NEW SWEAR</span>
              </button>

              <button
                id="btn-copy-swear-clipboard"
                onClick={handleCopySwear}
                className="py-2 px-3 bg-slate-900/60 hover:bg-slate-900 border border-slate-800 rounded-xl font-mono text-[11px] text-slate-300 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.98]"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-bold">COPIED</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                    <span>COPY</span>
                  </>
                )}
              </button>
            </div>

            {/* Session Discharge History Terminal */}
            <div className="flex flex-col gap-2 mt-1">
              <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1.5 uppercase tracking-wider font-bold">
                <Terminal className="w-3 h-3 text-rose-500/70" /> SESSION DISCHARGE ARCHIVE
              </span>
              
              <div className="border border-slate-900 bg-slate-950/80 rounded-xl p-3 font-mono text-[10px] flex flex-col gap-2 max-h-[110px] overflow-y-auto scrollbar-thin">
                {history.map((swear, idx) => (
                  <div key={idx} className="flex gap-2 text-slate-400 border-b border-slate-950 pb-1.5 last:border-0 last:pb-0">
                    <span className="text-rose-500/70 shrink-0 font-bold">[{history.length - idx}]:</span>
                    <span className="truncate select-all">{swear}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* System hardware notice */}
            <div className="flex items-center gap-2 text-[9px] font-mono text-slate-600 bg-slate-950 p-2.5 rounded-lg border border-slate-900">
              <Zap className="w-3 h-3 text-amber-500" />
              <span>CAUTION: Overusing cybernetic counter-measures can heat up the microclimate fan arrays. Play safe.</span>
            </div>

          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
