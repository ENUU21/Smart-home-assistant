/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { 
  Mic, 
  MicOff, 
  MessageSquare, 
  CornerDownRight, 
  Sparkles, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Music, 
  HelpCircle, 
  ChevronDown, 
  ChevronUp,
  Cpu,
  Radio,
  Zap,
  RefreshCw,
  AlertCircle,
  Send,
  Keyboard
} from 'lucide-react';
import { ESP32Data } from '../types';
import GlowCard from './GlowCard';
import { mockVoiceCommands, createLog, getPresetStateUpdates } from '../mockData';

// Public high-quality MP3 tracks for smart speaker simulation
const SONGS = [
  { 
    name: "Synthwave Sunset", 
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", 
    desc: "Retro-futuristic outrun synth drive" 
  },
  { 
    name: "Cozy Lofi Rain", 
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3", 
    desc: "Gentle relaxing study and sleep breeze" 
  },
  { 
    name: "Cyberpunk Overdrive", 
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3", 
    desc: "High-octane neon cybernetic tempo" 
  }
];

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
  const [assistantReply, setAssistantReply] = useState<string>('Awaiting vocal activation or real mic recording.');
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(60); // 0-100
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSong, setCurrentSong] = useState(SONGS[0]);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [voiceMode, setVoiceMode] = useState<'free-stt' | 'gemini-ai'>('free-stt');
  const [textCommand, setTextCommand] = useState('');
  const [isConstantListening, setIsConstantListening] = useState<boolean>(false);
  const isConstantListeningRef = useRef<boolean>(false);

  const recognitionRef = useRef<any>(null);

  // Spark Plan Credit Quota (Default: 150)
  const [credits, setCredits] = useState<number>(() => {
    const saved = localStorage.getItem('kitten_ai_credits');
    return saved !== null ? parseInt(saved, 10) : 150;
  });

  // Local Voice parser to prevent any token usage
  const parseTextCommand = (command: string) => {
    const normalized = command.toLowerCase();
    const updates: Partial<ESP32Data> = { voice: false };
    let reply = "I parsed your command.";
    
    // 1. Match high-priority presets and system automation modes first
    if (normalized.includes("movie")) {
      updates.led = 20;
      updates.fan = 0;
      updates.auto = false;
      reply = "Activating movie night preset: Lights dimmed low, ventilation fan silenced.";
    } else if (normalized.includes("gaming") || normalized.includes("game")) {
      updates.led = 255;
      updates.fan = 255;
      updates.auto = false;
      reply = "Activating gaming preset: Full LED glow and maximum fan power.";
    } else if (normalized.includes("sleep")) {
      updates.led = 0;
      updates.fan = 0;
      updates.auto = false;
      reply = "Activating bedtime sleep preset: LED off and fan shut down.";
    } else if (normalized.includes("study") || normalized.includes("work")) {
      updates.led = 150;
      updates.fan = 80;
      updates.auto = false;
      reply = "Activating productive study preset: Focus lights at 150, gentle ventilation fan.";
    } else if (normalized.includes("auto") || normalized.includes("automatic") || normalized.includes("manual")) {
      if (normalized.includes("off") || normalized.includes("disable") || normalized.includes("manual")) {
        updates.auto = false;
        reply = "Switching to manual microclimate control mode.";
      } else {
        updates.auto = true;
        reply = "Enabling automatic microclimate system automation.";
      }
    }
    // 2. Fall back to direct hardware control statements
    else {
      const hasLightWord = normalized.includes("light") || normalized.includes("lights") || normalized.includes("led");
      const hasFanWord = normalized.includes("fan") || normalized.includes("cooler") || normalized.includes("ventilation");

      if (hasLightWord || hasFanWord) {
        const replies: string[] = [];

        if (hasLightWord) {
          // Check for specific number following light keyword, or fall back to any number
          const lightNumberMatch = normalized.match(/(?:led|light|lights)\D*(\d+)/) || normalized.match(/\d+/);
          if (lightNumberMatch) {
            const percent = parseInt(lightNumberMatch[1] || lightNumberMatch[0], 10);
            const pwmVal = Math.round((percent / 100) * 255);
            const constrainedVal = Math.min(255, Math.max(0, pwmVal));
            updates.led = constrainedVal;
            updates.auto = false;
            replies.push(`Setting the light brightness to ${percent}% (${constrainedVal}/255) [Manual Mode].`);
          } else if (normalized.includes("on")) {
            updates.led = 255;
            updates.auto = false;
            replies.push("Turning the lighting array ON [Maximum glow].");
          } else if (normalized.includes("off")) {
            updates.led = 0;
            updates.auto = false;
            replies.push("Turning the lighting array OFF.");
          } else {
            replies.push("I heard you mention the light, but couldn't detect a percentage or state.");
          }
        }

        if (hasFanWord) {
          // Check for specific number following fan keyword, or fall back to any number (if not already used by light)
          let fanNumberMatch = normalized.match(/(?:fan|cooler|ventilation)\D*(\d+)/);
          if (!fanNumberMatch) {
            const generalMatch = normalized.match(/\d+/);
            if (generalMatch) {
              const lightNumberMatch = normalized.match(/(?:led|light|lights)\D*(\d+)/);
              if (!lightNumberMatch || generalMatch[0] !== (lightNumberMatch[1] || lightNumberMatch[0])) {
                fanNumberMatch = generalMatch;
              }
            }
          }

          if (fanNumberMatch) {
            const percent = parseInt(fanNumberMatch[1] || fanNumberMatch[0], 10);
            const pwmVal = Math.round((percent / 100) * 255);
            const constrainedVal = Math.min(255, Math.max(0, pwmVal));
            updates.fan = constrainedVal;
            updates.auto = false;
            replies.push(`Setting the ventilation fan power level to ${percent}% (${constrainedVal}/255) [Manual Mode].`);
          } else if (normalized.includes("on")) {
            updates.fan = 255;
            updates.auto = false;
            replies.push("Turning the ventilation fan ON [Manual Mode].");
          } else if (normalized.includes("off")) {
            updates.fan = 0;
            updates.auto = false;
            replies.push("Turning the ventilation fan OFF.");
          } else {
            replies.push("I heard you mention the fan, but couldn't detect a percentage or state.");
          }
        }

        reply = replies.join(" ");
      } else {
        reply = "Voice command received but not matched. Try saying 'turn fan on', 'set fan to 50%', or 'movie mode'.";
      }
    }

    return { updates, reply };
  };

  // Synchronize continuous listening ref and trigger restart/stop controls
  useEffect(() => {
    isConstantListeningRef.current = isConstantListening;
    if (isConstantListening) {
      if (voiceStatus === 'IDLE') {
        if (recognitionRef.current) {
          try {
            onVoiceTrigger();
            recognitionRef.current.start();
            setVoiceStatus('LISTENING');
          } catch (err) {
            console.warn('Failed to start speech recognition for constant listening:', err);
          }
        } else {
          setAssistantReply('⚠️ Speech recognition not supported or not loaded in this browser.');
          setIsConstantListening(false);
        }
      }
    } else {
      if (voiceStatus === 'LISTENING' && recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (err) {
          console.warn('Failed to stop speech recognition:', err);
        }
      }
    }
  }, [isConstantListening]);

  // Initialize Web Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';

      rec.onstart = () => {
        setVoiceStatus('LISTENING');
        if (isConstantListeningRef.current) {
          setLastCommand('Kitten listener is active...');
          setAssistantReply('Listening constantly! Start your command with "kitten" (e.g. "kitten turn fan on").');
        } else {
          setLastCommand('Listening to your voice command...');
          setAssistantReply('Speak now! Say a command like "set fan to 255" or "turn fan off".');
        }
      };

      rec.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript.trim();
        setLastCommand(`"${transcript}"`);

        if (isConstantListeningRef.current) {
          const lowerTranscript = transcript.toLowerCase();
          if (lowerTranscript.startsWith('kitten')) {
            // Strip "kitten" (6 letters) and clean remaining whitespace/symbols
            const commandText = transcript.slice(6).trim().replace(/^[:,\s]+/, '');
            
            if (commandText) {
              setVoiceStatus('PROCESSING');
              setAssistantReply(`Wake-word detected! Processing: "${commandText}"`);

              setTimeout(() => {
                const { updates, reply } = parseTextCommand(commandText);
                setAssistantReply(`[Kitten] ${reply}`);
                
                onCommandTriggered(
                  updates,
                  `Local Speech (Wake-word): "${commandText}". Reply: "${reply}"`
                );

                // Music triggers based on parsing
                if (commandText.toLowerCase().includes('sleep')) {
                  playSong(SONGS[1]);
                } else if (commandText.toLowerCase().includes('gaming') || commandText.toLowerCase().includes('game')) {
                  playSong(SONGS[2]);
                } else if (commandText.toLowerCase().includes('music') || commandText.toLowerCase().includes('play')) {
                  playSong(SONGS[0]);
                } else if (commandText.toLowerCase().includes('stop') && commandText.toLowerCase().includes('music')) {
                  stopSong();
                }

                setVoiceStatus('IDLE');
              }, 800);
            } else {
              setAssistantReply('Wake-word "kitten" detected, but no command followed.');
            }
          } else {
            setAssistantReply(`Ignored (Does not start with "kitten"): "${transcript}"`);
          }
        } else {
          setVoiceStatus('PROCESSING');
          setAssistantReply('Parsing text command locally...');

          setTimeout(() => {
            const { updates, reply } = parseTextCommand(transcript);
            setAssistantReply(reply);
            
            onCommandTriggered(
              updates,
              `Local Speech: "${transcript}". Reply: "${reply}"`
            );

            // Music triggers based on parsing
            if (transcript.toLowerCase().includes('sleep')) {
              playSong(SONGS[1]);
            } else if (transcript.toLowerCase().includes('gaming') || transcript.toLowerCase().includes('game')) {
              playSong(SONGS[2]);
            } else if (transcript.toLowerCase().includes('music') || transcript.toLowerCase().includes('play')) {
              playSong(SONGS[0]);
            } else if (transcript.toLowerCase().includes('stop') && transcript.toLowerCase().includes('music')) {
              stopSong();
            }

            setVoiceStatus('IDLE');
          }, 800);
        }
      };

      rec.onerror = (event: any) => {
        console.warn('Speech recognition status warning:', event.error);
        
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setAssistantReply('⚠️ Microphone permission denied or blocked. Disabling continuous mode.');
          setIsConstantListening(false);
          isConstantListeningRef.current = false;
        }

        if (isConstantListeningRef.current) {
          if (event.error === 'no-speech') {
            // Silence warnings in constant mode can be ignored
            return;
          }
        }

        if (event.error === 'no-speech') {
          setAssistantReply('No speech detected. Click the Mic to try again.');
        } else if (event.error === 'network') {
          setAssistantReply('⚠️ Speech Recognition Network Error! \n\nCheck browser settings or permissions.');
        } else {
          setAssistantReply(`Speech recognition error: ${event.error}`);
        }
        setVoiceStatus('IDLE');
      };

      rec.onend = () => {
        setVoiceStatus('IDLE');
        if (isConstantListeningRef.current) {
          // Restart after a small delay to prevent rapid spinning
          setTimeout(() => {
            if (isConstantListeningRef.current) {
              try {
                rec.start();
                setVoiceStatus('LISTENING');
              } catch (err) {
                console.warn('Auto-restart speech recognition failed:', err);
              }
            }
          }, 400);
        }
      };

      recognitionRef.current = rec;
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('kitten_ai_credits', credits.toString());
  }, [credits]);

  // Microphone recording refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Audio player and visualizer refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const [visLevels, setVisLevels] = useState<number[]>(new Array(12).fill(4));
  const animationFrameRef = useRef<number | null>(null);

  // We have disabled automatic browser microphone wake-up to ensure user privacy and prevent unrequested resource use.
  // The microphone must be manually activated by clicking the microphone button in the UI.

  // Clean up recording on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  // Web Audio Visualizer polling loop
  const updateVisualizer = () => {
    if (analyserRef.current && dataArrayRef.current) {
      analyserRef.current.getByteFrequencyData(dataArrayRef.current);
      // Map frequencies to 12 visualizer bars
      const rawData = Array.from(dataArrayRef.current);
      const step = Math.floor(rawData.length / 12);
      const levels = Array.from({ length: 12 }, (_, i) => {
        const val = Number(rawData[i * step] || 0);
        // Normalize 0-255 to a nice height in px (e.g., 4 to 32)
        return Math.max(4, Math.round((val / 255) * 28) + 4);
      });
      setVisLevels(levels);
    } else {
      // Procedural fallback visualizer so it matches beats even without CORS/WebAudio setup
      if (isPlaying) {
        setVisLevels(prev => prev.map(() => Math.floor(Math.random() * 24) + 6));
      } else {
        setVisLevels(new Array(12).fill(4));
      }
    }
    animationFrameRef.current = requestAnimationFrame(updateVisualizer);
  };

  // Init Audio Player & Context
  const initAudioEngine = () => {
    if (!audioRef.current) return;

    // Apply initial mute/volume states
    audioRef.current.muted = isMuted;
    audioRef.current.volume = volume / 100;

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass && !audioCtxRef.current) {
        const ctx = new AudioContextClass();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64; // Small size for responsive visualizer

        // Create media element source
        const source = ctx.createMediaElementSource(audioRef.current);
        source.connect(analyser);
        analyser.connect(ctx.destination);

        audioCtxRef.current = ctx;
        analyserRef.current = analyser;
        dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
        sourceRef.current = source;
      }
    } catch (err) {
      console.warn("Web Audio API not supported or blocked by sandbox:", err instanceof Error ? err.message : String(err));
    }

    if (!animationFrameRef.current) {
      updateVisualizer();
    }
  };

  // Toggle speaker playback
  const handleTogglePlay = () => {
    initAudioEngine();
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      addLog(createLog(`KITTEN Smart Speaker: Music playback paused.`, 'info'));
    } else {
      // Resume AudioContext if suspended
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
      audioRef.current.play()
        .then(() => {
          setIsPlaying(true);
          addLog(createLog(`KITTEN Smart Speaker: Now playing "${currentSong.name}"`, 'success'));
        })
        .catch(err => {
          console.error("Audio playback failed: " + (err instanceof Error ? err.message : String(err)));
          // Fallback simulation toggle
          setIsPlaying(true);
        });
    }
  };

  const playSong = (song: typeof SONGS[0]) => {
    initAudioEngine();
    setCurrentSong(song);
    setIsPlaying(true);

    if (audioRef.current) {
      audioRef.current.src = song.url;
      audioRef.current.load();
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
      audioRef.current.play()
        .then(() => {
          addLog(createLog(`KITTEN Smart Speaker: Spoken command activated "${song.name}"`, 'success'));
        })
        .catch(err => {
          console.warn("Playback error (handling CORS gracefully): " + (err instanceof Error ? err.message : String(err)));
        });
    }
  };

  const stopSong = () => {
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
    }
    addLog(createLog(`KITTEN Smart Speaker: Speaker playback stopped on command.`, 'info'));
  };

  const handleNextSong = () => {
    const currentIndex = SONGS.findIndex(s => s.name === currentSong.name);
    const nextIndex = (currentIndex + 1) % SONGS.length;
    playSong(SONGS[nextIndex]);
  };

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    if (audioRef.current) {
      audioRef.current.volume = newVol / 100;
    }
  };

  const handleToggleMute = () => {
    setIsMuted(!isMuted);
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
    }
  };

  // Web Browser Real-Time Audio Recording Logic
  const startRecording = async () => {
    if (voiceStatus !== 'IDLE') return;

    if (credits < 15) {
      setAssistantReply('⚠️ Insufficient credits for Live Voice Processing (Requires 15 credits). Please recharge your Spark Plan quota.');
      addLog(createLog('Credits low: Live voice command aborted. Click "RECHARGE" to restore credits.', 'warning'));
      return;
    }
    
    onVoiceTrigger(); // Sync state to parent system
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Select supported audio formats
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = 'audio/webm';
      } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
        mimeType = 'audio/ogg';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      }

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        setVoiceStatus('PROCESSING');
        setAssistantReply('Connecting to Gemini 3.5 Flash server...');
        
        const audioBlob = new Blob(chunksRef.current, { type: mimeType });
        await uploadAudioToGemini(audioBlob);

        // Turn off mic hardware stream
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setVoiceStatus('LISTENING');
      setLastCommand('Listening to your speech command...');
      setAssistantReply('Speak now! Click the Mic button again to finish or wait 6 seconds.');

      // Limit recording length to 6s
      recordingTimerRef.current = setTimeout(() => {
        if (recorder.state === 'recording') {
          recorder.stop();
        }
      }, 6000);

    } catch (err: any) {
      console.error("Microphone access failed: " + (err instanceof Error ? err.message : String(err)));
      setAssistantReply(`Microphone Error: ${err.message}. Please check browser settings and grant mic access.`);
      setVoiceStatus('IDLE');
    }
  };

  const stopRecording = () => {
    if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const uploadAudioToGemini = async (audioBlob: Blob) => {
    try {
      // Read binary blob to Base64 string for transmission
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64Data = (reader.result as string).split(',')[1];

        // Deduct live audio query credits on successful connection
        setCredits(prev => Math.max(0, prev - 15));

        const response = await fetch('/api/voice-command', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            audio: base64Data,
            mimeType: audioBlob.type
          })
        });

        if (!response.ok) {
          throw new Error(`Server returned error code: ${response.status}`);
        }

        const resData = await response.json();

        if (resData.fallback) {
          setLastCommand(resData.transcript);
          setAssistantReply(resData.reply);
          setVoiceStatus('IDLE');
          return;
        }

        setLastCommand(`"${resData.transcript}"`);
        setAssistantReply(resData.reply);

        // Propagate smart home state updates
        const updates: Partial<ESP32Data> = { voice: false };
        if (resData.mode) {
          const modeUpdates = getPresetStateUpdates(resData.mode);
          const { logMsg, ...stateUpdates } = modeUpdates;
          Object.assign(updates, stateUpdates);
        } else {
          if (resData.led !== undefined) updates.led = resData.led;
          if (resData.fan !== undefined) updates.fan = resData.fan;
          if (resData.auto !== undefined) updates.auto = resData.auto;
        }

        onCommandTriggered(
          updates,
          `Gemini Command: "${resData.transcript}". Reply: "${resData.reply}"`
        );

        // Music player response trigger
        if (resData.playMusic) {
          if (resData.playMusic.play) {
            const requestedName = resData.playMusic.songName || "";
            const matchedSong = SONGS.find(s => s.name.toLowerCase().includes(requestedName.toLowerCase())) || SONGS[0];
            playSong(matchedSong);
          } else if (resData.playMusic.stop) {
            stopSong();
          }
        }

        setVoiceStatus('IDLE');
      };
    } catch (err: any) {
      console.error("Gemini audio upload error: " + (err instanceof Error ? err.message : String(err)));
      setAssistantReply(`Analysis failed: ${err.message || 'Server timeout'}`);
      setVoiceStatus('IDLE');
    }
  };

  // Simulate local legacy commands (Fallback Preset Buttons)
  const handlePresetSimulation = (cmdObj: typeof mockVoiceCommands[0]) => {
    if (voiceStatus !== 'IDLE') return;

    if (credits < 2) {
      setAssistantReply('⚠️ Insufficient credits for Preset Simulation (Requires 2 credits). Please recharge your Spark Plan quota.');
      addLog(createLog('Credits low: Preset simulation aborted. Click "RECHARGE" to restore credits.', 'warning'));
      return;
    }

    // Deduct preset simulation credits
    setCredits(prev => Math.max(0, prev - 2));

    onVoiceTrigger();

    setVoiceStatus('LISTENING');
    setLastCommand('Listening...');
    setAssistantReply('Recording sound input waves...');

    setTimeout(() => {
      setVoiceStatus('PROCESSING');
      setLastCommand(`"${cmdObj.command}"`);
      setAssistantReply('Synthesizing command rules local...');

      setTimeout(() => {
        setVoiceStatus('IDLE');
        setAssistantReply(cmdObj.response);
        
        const updates: Partial<ESP32Data> = { voice: false };
        if ((cmdObj as any).mode !== undefined) {
          const modeUpdates = getPresetStateUpdates((cmdObj as any).mode);
          const { logMsg, ...stateUpdates } = modeUpdates;
          Object.assign(updates, stateUpdates);
        } else {
          if (cmdObj.led !== undefined) updates.led = cmdObj.led;
          if (cmdObj.fan !== undefined) updates.fan = cmdObj.fan;
        }
        
        onCommandTriggered(
          updates,
          `Preset simulation: "${cmdObj.command}". Reply: "${cmdObj.response}"`
        );

        // Handle preset music trigger
        if (cmdObj.command.toLowerCase().includes('sleep')) {
          playSong(SONGS[1]); // Cozy Lofi Rain
        } else if (cmdObj.command.toLowerCase().includes('gaming')) {
          playSong(SONGS[2]); // Cyberpunk Overdrive
        }
      }, 1000);
    }, 1000);
  };

  const handleMicClick = () => {
    if (isConstantListening) {
      setIsConstantListening(false);
      return;
    }
    if (voiceStatus === 'LISTENING') {
      if (voiceMode === 'free-stt') {
        if (recognitionRef.current) {
          recognitionRef.current.stop();
        }
      } else {
        stopRecording();
      }
    } else {
      if (voiceMode === 'free-stt') {
        if (recognitionRef.current) {
          onVoiceTrigger();
          recognitionRef.current.start();
        } else {
          setAssistantReply('⚠️ Local Speech Recognition is not supported in this browser. Please use Google Chrome or Edge, or switch to Gemini Live AI mode.');
        }
      } else {
        startRecording();
      }
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <GlowCard
        id="card-voice-assistant"
        title="Voice Assistant"
        subtitle="KITTEN NLP COGNITIVE MODULE"
        glowColor={voiceStatus === 'LISTENING' ? 'cyan' : voiceStatus === 'PROCESSING' ? 'purple' : 'none'}
      >
        <div className="flex flex-col gap-5">
          {/* Voice Processing Mode Selector */}
          <div className="grid grid-cols-2 p-1 bg-slate-950 rounded-xl border border-slate-900 text-center text-[10px] font-mono">
            <button
              id="btn-voice-mode-stt"
              onClick={() => {
                if (voiceStatus === 'IDLE') setVoiceMode('free-stt');
              }}
              disabled={voiceStatus !== 'IDLE'}
              className={`py-1.5 rounded-lg font-bold cursor-pointer transition-all ${
                voiceMode === 'free-stt'
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                  : 'text-slate-500 hover:text-slate-400 border border-transparent'
              }`}
              title="Transcribe speech in browser for free, parsing triggers with zero token costs"
            >
              FREE GOOGLE STT
            </button>
            <button
              id="btn-voice-mode-gemini"
              onClick={() => {
                if (voiceStatus === 'IDLE') setVoiceMode('gemini-ai');
              }}
              disabled={voiceStatus !== 'IDLE'}
              className={`py-1.5 rounded-lg font-bold cursor-pointer transition-all ${
                voiceMode === 'gemini-ai'
                  ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                  : 'text-slate-500 hover:text-slate-400 border border-transparent'
              }`}
              title="Stream speech raw to Gemini for rich semantic and generative intelligence"
            >
              GEMINI LIVE AI
            </button>
          </div>

          {/* Constant Wake-Word Listener Toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-900 bg-slate-950/20">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Radio className={`w-3.5 h-3.5 ${isConstantListening ? 'text-cyan-400 animate-pulse' : 'text-slate-500'}`} />
                Constant "Kitten" Listening
              </span>
              <span className="text-[9.5px] text-slate-500 font-mono">
                Scans voice continuously. Only processes commands starting with "kitten".
              </span>
            </div>
            <button
              id="btn-constant-listening-toggle"
              onClick={() => {
                if (!isConstantListening) {
                  setVoiceMode('free-stt');
                }
                setIsConstantListening(!isConstantListening);
              }}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                isConstantListening ? 'bg-cyan-500' : 'bg-slate-800'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  isConstantListening ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* State Display, Mic Control, & Waveform */}
          <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-900 bg-slate-950/40">
            <div className="flex items-center gap-3">
              <button
                id="btn-voice-mic-trigger"
                onClick={handleMicClick}
                disabled={voiceStatus === 'PROCESSING' || isLoading}
                className={`p-3 rounded-xl transition-all duration-300 cursor-pointer ${
                  voiceStatus === 'LISTENING'
                    ? 'bg-rose-500/20 text-rose-400 animate-pulse border border-rose-500/30'
                    : voiceStatus === 'PROCESSING'
                      ? 'bg-purple-500/10 text-purple-400 animate-spin border border-purple-500/20'
                      : 'bg-slate-900 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 border border-slate-800'
                }`}
                title={voiceStatus === 'LISTENING' ? 'Click to stop recording' : 'Click to start speaking'}
              >
                {voiceStatus === 'LISTENING' ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </button>

              <div>
                <span className="text-[9px] text-slate-500 font-mono tracking-wider block leading-none">
                  ASSISTANT STATE
                </span>
                <span
                  className={`text-xs font-bold font-mono tracking-widest ${
                    voiceStatus === 'LISTENING'
                      ? 'text-cyan-400 animate-pulse'
                      : voiceStatus === 'PROCESSING'
                        ? 'text-purple-400'
                        : 'text-slate-400'
                  }`}
                >
                  {voiceStatus === 'LISTENING' ? (isConstantListening ? 'KITTEN EARS ACTIVE...' : 'RECORDING MIC...') : voiceStatus}
                </span>
              </div>
            </div>

            {/* Hologram style sound waves */}
            <div className="flex gap-1 items-end h-8">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((barIndex) => {
                let animationClass = '';
                if (voiceStatus === 'LISTENING') {
                  animationClass = 'animate-[pulse_0.4s_infinite_alternate]';
                } else if (voiceStatus === 'PROCESSING') {
                  animationClass = 'animate-[pulse_0.15s_infinite_alternate]';
                }
                const delay = `${barIndex * 80}ms`;

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
                      height: voiceStatus === 'IDLE' ? '4px' : `${Math.floor(Math.random() * 24) + 6}px`,
                      animationDelay: delay,
                    }}
                  />
                );
              })}
            </div>
          </div>

          {/* AI Processing Credits Counter & Progress Bar */}
          <div className="p-3.5 rounded-xl border border-slate-900 bg-slate-950/20 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Zap className={`w-3.5 h-3.5 ${credits > 30 ? 'text-amber-400' : 'text-rose-500 animate-pulse'}`} />
                <span className="text-[10px] text-slate-400 font-mono tracking-wider font-semibold">
                  SPARK PLAN COGNITIVE QUOTA
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-slate-200">
                  {credits} <span className="text-slate-500">/ 150</span>
                </span>
                <button
                  id="btn-replenish-credits"
                  onClick={() => {
                    setCredits(150);
                    addLog(createLog("Spark Plan cognitive quota replenished successfully to 150 credits.", "success"));
                  }}
                  className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-850 text-cyan-400 hover:text-cyan-300 transition-all text-[9px] font-mono cursor-pointer flex items-center gap-1"
                  title="Replenish Spark Quota"
                >
                  <RefreshCw className="w-2.5 h-2.5" /> RECHARGE
                </button>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-900/40">
              <div
                className={`h-full transition-all duration-500 ${
                  credits > 75
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                    : credits > 30
                      ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                      : 'bg-gradient-to-r from-rose-600 to-rose-400 animate-pulse'
                }`}
                style={{ width: `${Math.min(100, (credits / 150) * 100)}%` }}
              />
            </div>

            {/* Explanation details */}
            <div className="flex justify-between items-center text-[8.5px] font-mono text-slate-500 leading-none mt-0.5">
              <span>Cost: -15/audio request, -2/preset trigger</span>
              {credits < 15 && (
                <span className="text-rose-400 animate-pulse flex items-center gap-1 font-bold">
                  <AlertCircle className="w-2.5 h-2.5" /> LOW CREDITS
                </span>
              )}
            </div>
          </div>

          {/* NLP Command Terminal Output */}
          <div className="p-4 rounded-xl border border-slate-900 bg-slate-950/80 font-mono text-xs flex flex-col gap-2.5">
            <div>
              <div className="flex items-center gap-1.5 text-slate-500 text-[10px]">
                <CornerDownRight className="w-3 h-3 text-cyan-400" />
                <span>LAST COGNITIVE INPUT RECEIVED:</span>
              </div>
              <div className="text-slate-200 pl-4.5 font-sans font-medium mt-1">
                {lastCommand}
              </div>
            </div>

            <div className="border-t border-slate-900/60 pt-2.5">
              <div className="flex items-center gap-1.5 text-slate-500 text-[10px]">
                <MessageSquare className="w-3 h-3 text-cyan-400" />
                <span>VIRTUAL RESPONSE OUT:</span>
              </div>
              <div className="text-cyan-400/90 pl-4.5 text-[11px] leading-relaxed mt-1 italic">
                {assistantReply}
              </div>
            </div>
          </div>

          {/* Keyboard Command Console Input Fallback */}
          <div>
            <span className="text-[10px] text-slate-500 font-mono tracking-wider block mb-2 uppercase flex items-center gap-1">
              <Keyboard className="w-3.5 h-3.5 text-cyan-400" /> Type Keyboard Command
            </span>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const cmd = textCommand.trim();
                if (!cmd) return;
                setTextCommand('');
                setLastCommand(`"${cmd}" (Typed)`);
                setVoiceStatus('PROCESSING');
                setAssistantReply('Parsing text command locally...');
                
                setTimeout(() => {
                  const { updates, reply } = parseTextCommand(cmd);
                  setAssistantReply(reply);
                  onCommandTriggered(
                    updates,
                    `Typed: "${cmd}". Reply: "${reply}"`
                  );
                  
                  // Music triggers based on parsing
                  if (cmd.toLowerCase().includes('sleep')) {
                    playSong(SONGS[1]);
                  } else if (cmd.toLowerCase().includes('gaming') || cmd.toLowerCase().includes('game')) {
                    playSong(SONGS[2]);
                  } else if (cmd.toLowerCase().includes('music') || cmd.toLowerCase().includes('play')) {
                    playSong(SONGS[0]);
                  } else if (cmd.toLowerCase().includes('stop') && cmd.toLowerCase().includes('music')) {
                    stopSong();
                  }

                  setVoiceStatus('IDLE');
                }, 400);
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={textCommand}
                onChange={(e) => setTextCommand(e.target.value)}
                placeholder='e.g. "turn fan on", "set fan to 180", "movie mode"'
                className="flex-grow bg-slate-950 border border-slate-900 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/25 font-mono"
              />
              <button
                type="submit"
                disabled={voiceStatus !== 'IDLE' || isLoading}
                className="px-4 py-2.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 rounded-xl text-xs font-mono font-bold tracking-wider cursor-pointer active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-1.5"
              >
                <Send className="w-3 h-3" />
                <span>SEND</span>
              </button>
            </form>
          </div>

          {/* Quick Voice Simulation Buttons */}
          <div>
            <span className="text-[10px] text-slate-500 font-mono tracking-wider block mb-2 uppercase flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" /> Click to Simulate Command
            </span>

            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
              {mockVoiceCommands.map((cmdObj, idx) => (
                <button
                  key={idx}
                  id={`btn-voice-preset-${idx}`}
                  onClick={() => handlePresetSimulation(cmdObj)}
                  disabled={voiceStatus !== 'IDLE' || isLoading}
                  className="text-[10px] font-mono px-2 py-1 rounded-lg border border-slate-900 bg-slate-950/50 text-slate-400 hover:border-cyan-500/30 hover:bg-cyan-950/10 hover:text-cyan-300 transition-all duration-200 disabled:opacity-40 disabled:pointer-events-none text-left cursor-pointer"
                >
                  "{cmdObj.command}"
                </button>
              ))}
            </div>
          </div>
        </div>
      </GlowCard>

      {/* Futuristic KITTEN Smart Speaker Card */}
      <GlowCard
        id="card-smart-speaker"
        title="KITTEN Speaker"
        subtitle="I2S AMBIENT AUDIO SUBSYSTEM"
        glowColor={isPlaying ? 'emerald' : 'none'}
      >
        {/* Hidden Audio Player for actual playback */}
        <audio
          ref={audioRef}
          src={currentSong.url}
          crossOrigin="anonymous"
          onEnded={handleNextSong}
          onError={(e) => {
            console.warn("Smart Speaker local audio load failure: Audio playback error event.");
            addLog(createLog("Smart Speaker Preview: Local browser playback failed to load audio from remote source. However, the ESP32 streaming URL remains synchronized and is broadcastable!", "info"));
          }}
          className="hidden"
        />

        <div className="flex flex-col gap-4">
          {/* Playback Track Telemetry */}
          <div className="flex items-center gap-4 p-3.5 rounded-xl border border-slate-900 bg-slate-950/40">
            <div className={`p-3 rounded-xl ${isPlaying ? 'bg-emerald-500/10 text-emerald-400 animate-pulse' : 'bg-slate-900 text-slate-500'} transition-all`}>
              <Music className="w-5 h-5" />
            </div>

            <div className="flex-grow min-w-0">
              <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest block leading-none mb-1">
                {isPlaying ? 'NOW BROADCASTING' : 'SPEAKER STANDBY'}
              </span>
              <h3 className="text-sm font-bold text-slate-200 truncate leading-none mb-1">
                {currentSong.name}
              </h3>
              <p className="text-[10px] text-slate-400 truncate font-mono">
                {currentSong.desc}
              </p>
            </div>

            {/* EQ Frequency Animation */}
            <div className="flex items-end gap-[2px] h-7 px-1">
              {visLevels.map((height, idx) => (
                <div
                  key={idx}
                  className={`w-[3px] rounded-full transition-all duration-100 ${isPlaying ? 'bg-emerald-400' : 'bg-slate-800'}`}
                  style={{ height: `${height}px` }}
                />
              ))}
            </div>
          </div>

          {/* Playback controls */}
          <div className="flex items-center justify-between gap-4 font-mono">
            <div className="flex items-center gap-2">
              <button
                id="btn-speaker-play-toggle"
                onClick={handleTogglePlay}
                className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
                  isPlaying 
                    ? 'border-emerald-500/20 bg-emerald-950/10 text-emerald-400' 
                    : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700 hover:text-white'
                }`}
                title={isPlaying ? "Pause Music" : "Play Music"}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>

              <button
                id="btn-speaker-next"
                onClick={handleNextSong}
                className="p-2.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700 hover:text-white cursor-pointer"
                title="Skip Track"
              >
                <Radio className="w-4 h-4" />
              </button>

              <button
                id="btn-speaker-mute"
                onClick={handleToggleMute}
                className="p-2.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700 hover:text-white cursor-pointer"
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>

            {/* Vol Slider */}
            <div className="flex items-center gap-2 flex-grow max-w-[120px]">
              <span className="text-[10px] text-slate-500">VOL</span>
              <input
                id="slider-speaker-volume"
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(e) => handleVolumeChange(parseInt(e.target.value))}
                className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
              />
              <span className="text-[10px] text-slate-400 min-w-[20px] text-right">{volume}</span>
            </div>
          </div>
        </div>
      </GlowCard>

      {/* Collapsible ESP32 Hardware Integration Guide */}
      <GlowCard
        id="card-esp32-integration-guide"
        title="ESP32 Guide"
        subtitle="HARDWARE CONNECTIVITY DEPLOYMENT"
        glowColor="none"
      >
        <button
          id="btn-toggle-hardware-guide"
          onClick={() => setIsGuideOpen(!isGuideOpen)}
          className="w-full flex items-center justify-between text-left cursor-pointer text-xs font-mono text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-cyan-400" />
            <span>ESP32 HARDWARE PINOUTS & CODE</span>
          </div>
          {isGuideOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {isGuideOpen && (
          <div className="mt-4 border-t border-slate-900 pt-4 flex flex-col gap-4 font-mono text-[11px] text-slate-300 leading-relaxed max-h-[400px] overflow-y-auto pr-2">
            <div>
              <h4 className="text-cyan-400 font-bold uppercase mb-1.5 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full" />
                1. Required Audio Hardware
              </h4>
              <p className="pl-3 text-slate-400">
                To enable vocal voice assistance and audio streaming directly on your physical microcontroller:
              </p>
              <ul className="list-disc pl-7 mt-1 text-slate-400 flex flex-col gap-1">
                <li><strong>I2S Microphone (e.g., INMP441)</strong>: Feeds high-fidelity digitized audio into the ESP32.</li>
                <li><strong>I2S Audio DAC (e.g., MAX98357A)</strong>: Amplifies signals to direct-drive a 4Ω speaker.</li>
              </ul>
            </div>

            <div>
              <h4 className="text-cyan-400 font-bold uppercase mb-1.5 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full" />
                2. Pin Connections (ESP32)
              </h4>
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-900 text-[10px]">
                <p className="text-slate-400 font-bold border-b border-slate-900 pb-1 mb-1">INMP441 Mic Pinout:</p>
                <ul className="flex flex-col gap-0.5">
                  <li>• VDD ➔ 3.3V</li>
                  <li>• GND ➔ GND</li>
                  <li>• L/R ➔ GND (Left Channel)</li>
                  <li>• SCK ➔ GPIO 14</li>
                  <li>• SD  ➔ GPIO 32</li>
                  <li>• WS  ➔ GPIO 15</li>
                </ul>
                <p className="text-slate-400 font-bold border-b border-slate-900 pb-1 mt-2.5 mb-1">MAX98357A DAC Speaker Pinout:</p>
                <ul className="flex flex-col gap-0.5">
                  <li>• Vin ➔ 5V (or 3.3V)</li>
                  <li>• GND ➔ GND</li>
                  <li>• LRC ➔ GPIO 25</li>
                  <li>• BCLK ➔ GPIO 26</li>
                  <li>• DIN ➔ GPIO 22</li>
                </ul>
              </div>
            </div>

            <div>
              <h4 className="text-cyan-400 font-bold uppercase mb-1.5 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full" />
                3. ESP32 Arduino Code Snippet
              </h4>
              <p className="pl-3 text-slate-400 mb-2">
                Use the standard HTTPClient library to POST captured Base64 WebM/WAV audio data directly to KITTEN's server:
              </p>
              <pre className="bg-slate-950 p-3 rounded-lg border border-slate-900 text-[10px] text-emerald-400 overflow-x-auto leading-tight">
{`#include <WiFi.h>
#include <HTTPClient.h>

// Endpoint URL from Settings Panel
const char* serverUrl = "https://your-app-domain.com/api/voice-command";

void sendVoiceCommand(uint8_t* wavBuffer, size_t size) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");

    // Convert binary sound buffer to base64
    String base64Audio = base64::encode(wavBuffer, size);

    // Build JSON packet
    String jsonPayload = "{\\"audio\\":\\"" + base64Audio + "\\",\\"mimeType\\":\\"audio/wav\\"}";

    int httpResponseCode = http.POST(jsonPayload);
    if (httpResponseCode > 0) {
      String response = http.getString();
      Serial.println(response);
      // Parse response to adjust LED level & Fan speed!
    } else {
      Serial.print("HTTP error: ");
      Serial.println(httpResponseCode);
    }
    http.end();
  }
}`}
              </pre>
            </div>
          </div>
        )}
      </GlowCard>
    </div>
  );
}
