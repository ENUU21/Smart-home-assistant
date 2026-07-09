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
  onOpenWeeklyReport?: () => void;
  onOpenWeather?: () => void;
  onOpenKittenSwear?: () => void;
}

export default function VoiceAssistant({
  data,
  onVoiceTrigger,
  onCommandTriggered,
  addLog,
  isLoading,
  onOpenWeeklyReport,
  onOpenWeather,
  onOpenKittenSwear,
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
    if (normalized.includes("weekly report")) {
      reply = "Initiating core synchronization. Opening the KITTEN Weekly Environment & Energy Insights Report now.";
      if (onOpenWeeklyReport) {
        setTimeout(() => onOpenWeeklyReport(), 200);
      }
    } else if (normalized.includes("weather")) {
      reply = "Acquiring real-time meteorological station logs. Opening Weather Station panel now.";
      if (onOpenWeather) {
        setTimeout(() => onOpenWeather(), 200);
      }
    } else if (normalized.includes("kitten swear") || normalized.includes("swear")) {
      reply = "Initiating verbal defense array. Discharging unfiltered frustration matrices.";
      if (onOpenKittenSwear) {
        setTimeout(() => onOpenKittenSwear(), 200);
      }
    } else if (normalized.includes("heading out")) {
      updates.led = 0;
      updates.fan = 0;
      updates.auto = true;
      reply = "Acknowledged. Activating Heading Out mode: shutting down lighting arrays and ventilation fan, and switching systems to Automatic microclimate mode.";
    } else if (normalized.includes("movie")) {
      const { logMsg, ...stateUpdates } = getPresetStateUpdates('movie');
      Object.assign(updates, stateUpdates);
      reply = "Activating movie night preset: Theater lighting levels set, quiet ventilation running.";
    } else if (normalized.includes("gaming") || normalized.includes("game")) {
      const { logMsg, ...stateUpdates } = getPresetStateUpdates('gaming');
      Object.assign(updates, stateUpdates);
      reply = "Activating gaming preset: Neon glow maximized (100%), active room cooling activated.";
    } else if (normalized.includes("sleep")) {
      const { logMsg, ...stateUpdates } = getPresetStateUpdates('sleep');
      Object.assign(updates, stateUpdates);
      reply = "Activating bedtime sleep preset: Environment dimmed, silent ventilation enabled.";
    } else if (normalized.includes("study") || normalized.includes("work")) {
      const { logMsg, ...stateUpdates } = getPresetStateUpdates('study');
      Object.assign(updates, stateUpdates);
      reply = "Activating productive study preset: Focus lights at 200 (80%), gentle ventilation fan at 100 (40%).";
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
    else if (normalized.includes("fan") || normalized.includes("cooler") || normalized.includes("ventilation")) {
      // Find the first number in the string
      const numberMatch = normalized.match(/\d+/);
      if (numberMatch) {
        const val = parseInt(numberMatch[0], 10);
        // Treat as percentage if <= 100, otherwise direct analog value (0-255)
        let constrainedVal;
        if (val <= 100) {
          constrainedVal = Math.round(val * 2.55);
        } else {
          constrainedVal = Math.min(255, val);
        }
        updates.fan = constrainedVal;
        updates.auto = false;
        reply = `Setting the ventilation fan power level to ${constrainedVal} (${val <= 100 ? val : Math.round((constrainedVal/255)*100)}%) [Manual Mode].`;
      } else if (normalized.includes("on") || normalized.includes("active") || normalized.includes("start") || normalized.includes("run")) {
        updates.fan = 255; // Full power digital switch
        updates.auto = false;
        reply = "Turning the ventilation fan ON [Manual Mode].";
      } else if (normalized.includes("off") || normalized.includes("stop") || normalized.includes("standby") || normalized.includes("shut")) {
        updates.fan = 0;
        updates.auto = false;
        reply = "Turning the ventilation fan OFF.";
      } else {
        reply = "I heard you mention the fan, but couldn't detect a command. Try 'turn fan on' or 'set fan to 255'.";
      }
    } else if (normalized.includes("led") || normalized.includes("light") || normalized.includes("brightness") || normalized.includes("glow")) {
      const numberMatch = normalized.match(/\d+/);
      if (numberMatch) {
        const val = parseInt(numberMatch[0], 10);
        // Treat as percentage if <= 100, otherwise direct analog value (0-255)
        let constrainedVal;
        if (val <= 100) {
          constrainedVal = Math.round(val * 2.55);
        } else {
          constrainedVal = Math.min(255, val);
        }
        updates.led = constrainedVal;
        updates.auto = false;
        reply = `Setting the light brightness level to ${constrainedVal} (${val <= 100 ? val : Math.round((constrainedVal/255)*100)}%) [Manual Mode].`;
      } else if (normalized.includes("on")) {
        updates.led = 255;
        updates.auto = false;
        reply = "Turning the lighting array ON [Maximum glow].";
      } else if (normalized.includes("off")) {
        updates.led = 0;
        updates.auto = false;
        reply = "Turning the lighting array OFF.";
      } else {
        reply = "I heard you mention the light, but couldn't detect a level. Try 'turn light off' or 'set LED to 150'.";
      }
    } else {
      reply = "Local command received but not matched. Try saying 'turn fan on', 'set fan to 255', or 'movie mode'.";
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

        // Check for report or weather in transcript
        const transcriptLower = (resData.transcript || "").toLowerCase();
        if (transcriptLower.includes("weekly report")) {
          if (onOpenWeeklyReport) {
            setTimeout(() => onOpenWeeklyReport(), 200);
          }
        } else if (transcriptLower.includes("weather")) {
          if (onOpenWeather) {
            setTimeout(() => onOpenWeather(), 200);
          }
        } else if (transcriptLower.includes("kitten swear") || transcriptLower.includes("swear")) {
          if (onOpenKittenSwear) {
            setTimeout(() => onOpenKittenSwear(), 200);
          }
        }

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

        if (cmdObj.command === 'Kitten swear') {
          if (onOpenKittenSwear) {
            setTimeout(() => onOpenKittenSwear(), 200);
          }
        }

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
          <div className="mt-4 border-t border-slate-900 pt-4 flex flex-col gap-4 font-mono text-[11px] text-slate-300 leading-relaxed max-h-[500px] overflow-y-auto pr-2">
            <div>
              <h4 className="text-cyan-400 font-bold uppercase mb-1.5 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full" />
                1. Main Controller Hardware Connections
              </h4>
              <p className="pl-3 text-slate-400">
                The main ESP32 controller manages the environmental sensors, ventilation speed, and lighting controls:
              </p>
              <ul className="list-disc pl-7 mt-1 text-slate-400 flex flex-col gap-1">
                <li><strong>DHT11 Sensor</strong>: Measures room temperature and humidity metrics.</li>
                <li><strong>HC-SR501 / AM312 PIR Motion Sensor</strong>: Detects room occupancy state.</li>
                <li><strong>PWM Lighting Pin</strong>: Controls RGB LED levels.</li>
                <li><strong>Fan Speed Controller (MOSFET Driver)</strong>: Uses high-frequency PWM to smoothly regulate DC ventilation fan speed (0% to 100%).</li>
              </ul>
            </div>

            <div>
              <h4 className="text-cyan-400 font-bold uppercase mb-1.5 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full" />
                2. Pin Configuration & Wiring (Main ESP32)
              </h4>
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-900 text-[10px] flex flex-col gap-3">
                <div>
                  <p className="text-slate-400 font-bold border-b border-slate-900 pb-1 mb-1">DHT11 Sensor Pinout:</p>
                  <ul className="flex flex-col gap-0.5">
                    <li>• VCC ➔ 3.3V / 5V</li>
                    <li>• DATA ➔ GPIO 32</li>
                    <li>• GND ➔ GND</li>
                  </ul>
                </div>
                
                <div>
                  <p className="text-slate-400 font-bold border-b border-slate-900 pb-1 mb-1">PIR Motion Sensor Pinout:</p>
                  <ul className="flex flex-col gap-0.5">
                    <li>• VCC ➔ 5V</li>
                    <li>• OUT ➔ GPIO 27</li>
                    <li>• GND ➔ GND</li>
                  </ul>
                </div>

                <div>
                  <p className="text-slate-400 font-bold border-b border-slate-900 pb-1 mb-1">Control Output Pinout:</p>
                  <ul className="flex flex-col gap-0.5">
                    <li>• Combined LED Pin ➔ GPIO 12 (PWM)</li>
                    <li>• Fan Speed Pin ➔ GPIO 13 (PWM)</li>
                  </ul>
                </div>

                <div className="border-t border-slate-900/60 pt-2 text-cyan-400">
                  <p className="font-bold mb-1">New Fan Speed Controller MOSFET Wiring:</p>
                  <ul className="flex flex-col gap-0.5 text-slate-400 pl-2">
                    <li>1. <strong>Gate</strong> ➔ Connect to <strong>GPIO 13</strong> with a 220Ω resistor. Connect a 10kΩ pulldown resistor from Gate to GND (keeps fan off on startup).</li>
                    <li>2. <strong>Source</strong> ➔ Connect to <strong>ESP32 GND</strong> (Common Ground with external power supply).</li>
                    <li>3. <strong>Drain</strong> ➔ Connect to the <strong>Fan Negative (-) wire</strong>.</li>
                    <li>4. <strong>Fan Positive (+)</strong> ➔ Connect directly to the <strong>External 5V/12V VCC</strong> power source.</li>
                    <li>5. <strong>Flyback Diode (1N4007)</strong> ➔ Place across Fan terminals: Anode to Drain, Cathode to VCC (protects ESP32 against back-EMF spikes).</li>
                  </ul>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-cyan-400 font-bold uppercase mb-1.5 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full" />
                3. Secondary Bluetooth Music ESP32
              </h4>
              <p className="pl-3 text-slate-400 mb-2">
                Your secondary ESP32 connects directly to your phone/tablet/computer via Bluetooth to play audio. It decodes the incoming Bluetooth stream and outputs high-fidelity sound to an external I2S DAC (e.g. MAX98357A, PCM5102) and speaker, separating audio workload from the smart home controller:
              </p>

              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-900 text-[10px] mb-3">
                <p className="text-slate-400 font-bold border-b border-slate-900 pb-1 mb-1">I2S DAC (MAX98357A) Pinout:</p>
                <ul className="flex flex-col gap-0.5 text-slate-300">
                  <li>• LRC / WS ➔ GPIO 25</li>
                  <li>• BCLK / BCK ➔ GPIO 26</li>
                  <li>• DIN / SD ➔ GPIO 22</li>
                  <li>• VIN ➔ 5V (or 3.3V)</li>
                  <li>• GND ➔ GND</li>
                </ul>
              </div>

              <p className="pl-3 text-slate-400 mb-2 font-bold">Bluetooth Speaker Arduino Code (ESP32-A2DP):</p>
              <pre className="bg-slate-950 p-3 rounded-lg border border-slate-900 text-[10px] text-emerald-400 overflow-x-auto leading-tight">
{`#include <Arduino.h>
#include "BluetoothA2DPSink.h"

// Initialize the A2DP Bluetooth Audio Receiver object
BluetoothA2DPSink a2dp_sink;

void setup() {
  Serial.begin(115200);
  Serial.println("Starting Bluetooth Smart Speaker Subsystem...");

  // Custom I2S Pin mappings for external audio DAC (MAX98357A / PCM5102)
  // For ESP32-A2DP version 4.0.0+ (compatible with ESP32 board manager core 3.x / ESP-IDF v5)
  // We can set custom pins (bck, ws, data) directly without using the deprecated i2s_pin_config_t structure
  a2dp_sink.set_pins(26, 25, 22);

  // Broadcast device name for Bluetooth pairing
  // This will appear on your phone as "KITTEN Smart Speaker"
  a2dp_sink.start("KITTEN Smart Speaker");
  Serial.println("Ready! Pair device to 'KITTEN Smart Speaker' to play music.");
}

void loop() {
  // Bluetooth streaming is handled asynchronously by the library on Core 0!
  delay(100);
}`}
              </pre>
            </div>
          </div>
        )}
      </GlowCard>
    </div>
  );
}
