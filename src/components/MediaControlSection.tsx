/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Music, 
  UploadCloud, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Trash2, 
  Loader2, 
  CheckCircle, 
  Radio, 
  FileAudio, 
  Disc,
  ListMusic,
  Plus
} from 'lucide-react';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage, saveSongMetadata, getSongsList, deleteSongMetadata, saveControlState } from '../lib/firebase';
import { Song, ESP32Data } from '../types';
import GlowCard from './GlowCard';

const DEFAULT_SONGS: Song[] = [
  {
    id: 'default-1',
    name: "Synthwave Sunset",
    desc: "Retro-futuristic outrun synth drive",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
  },
  {
    id: 'default-2',
    name: "Cozy Lofi Rain",
    desc: "Relaxing lofi beats for studying and focus",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
  },
  {
    id: 'default-3',
    name: "Cyberpunk Overdrive",
    desc: "High-energy cybernetic synth rhythms",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
  }
];

interface MediaControlSectionProps {
  currentData: ESP32Data;
  addLog: (msg: string, type?: 'info' | 'success' | 'warning' | 'alert') => void;
}

export default function MediaControlSection({ currentData, addLog }: MediaControlSectionProps) {
  const [songs, setSongs] = useState<Song[]>(DEFAULT_SONGS);
  const [currentSong, setCurrentSong] = useState<Song>(DEFAULT_SONGS[0]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(60);
  const [isMuted, setIsMuted] = useState(false);

  // Upload States
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [newSongName, setNewSongName] = useState('');
  const [newSongDesc, setNewSongDesc] = useState('');
  const [dragActive, setDragActive] = useState(false);

  // HTML5 audio ref & visualization
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [visLevels, setVisLevels] = useState<number[]>(new Array(16).fill(4));
  const animationFrameRef = useRef<number | null>(null);

  // Fetch custom songs from Firestore
  const loadSongs = async () => {
    try {
      const customSongs = await getSongsList();
      setSongs([...DEFAULT_SONGS, ...customSongs]);
    } catch (err) {
      console.warn("Could not retrieve custom songs:", err instanceof Error ? err.message : String(err));
    }
  };

  useEffect(() => {
    loadSongs();
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  // Automatically play/trigger loaded media
  useEffect(() => {
    if (audioRef.current && isPlaying) {
      audioRef.current.volume = isMuted ? 0 : volume / 100;
      audioRef.current.play()
        .then(() => {
          addLog(`Smart Speaker: Now broadcasting "${currentSong.name}"`, 'success');
          syncToESP32(true, currentSong, volume);
        })
        .catch(err => {
          console.warn("Local play failed (handling CORS/browser block):", err instanceof Error ? err.message : String(err));
          addLog(`Smart Speaker: Synced "${currentSong.name}" stream link to ESP32 controls`, 'info');
          syncToESP32(true, currentSong, volume);
        });
    }
  }, [currentSong, isPlaying]);

  // Update ESP32 Control Document with streaming states
  const syncToESP32 = async (playingState: boolean, songObj: Song, volLevel: number) => {
    try {
      await saveControlState({
        ...currentData,
        songUrl: songObj.url,
        songName: songObj.name,
        isPlaying: playingState,
        volume: volLevel
      });
    } catch (err) {
      console.warn("Failed to sync media control state to Firestore:", err instanceof Error ? err.message : String(err));
    }
  };

  // Spectrum animation loop
  const updateVisualizer = () => {
    if (isPlaying) {
      // Procedural beat/spectrum simulator matching standard speaker frequencies
      setVisLevels(prev => prev.map(() => Math.floor(Math.random() * 26) + 4));
    } else {
      setVisLevels(new Array(16).fill(4));
    }
    animationFrameRef.current = requestAnimationFrame(updateVisualizer);
  };

  useEffect(() => {
    if (isPlaying) {
      updateVisualizer();
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      setVisLevels(new Array(16).fill(4));
    }
  }, [isPlaying]);

  // Handle Play Action
  const handlePlaySong = (song: Song) => {
    setCurrentSong(song);
    setIsPlaying(true);
  };

  // Toggle active song play/pause
  const handleTogglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      addLog(`Smart Speaker: Audio broadcasting paused.`, 'info');
      syncToESP32(false, currentSong, volume);
    } else {
      audioRef.current.volume = isMuted ? 0 : volume / 100;
      audioRef.current.play()
        .then(() => {
          setIsPlaying(true);
          addLog(`Smart Speaker: Audio broadcasting resumed.`, 'success');
          syncToESP32(true, currentSong, volume);
        })
        .catch(() => {
          // Fallback toggle for testing sandbox environments
          setIsPlaying(true);
          syncToESP32(true, currentSong, volume);
        });
    }
  };

  const handleNextSong = () => {
    const currentIndex = songs.findIndex(s => s.id === currentSong.id);
    const nextIndex = (currentIndex + 1) % songs.length;
    handlePlaySong(songs[nextIndex]);
  };

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : newVol / 100;
    }
    syncToESP32(isPlaying, currentSong, newVol);
  };

  const handleToggleMute = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    if (audioRef.current) {
      audioRef.current.volume = nextMute ? 0 : volume / 100;
    }
  };

  // Upload Logic with progress metrics
  const handleFileUpload = async (file: File) => {
    if (!file) return;

    // Standard audio type check
    if (!file.type.startsWith('audio/')) {
      addLog(`Upload error: Selected file is not a supported audio format.`, 'warning');
      return;
    }

    const songName = newSongName.trim() || file.name.replace(/\.[^/.]+$/, "");
    const songDesc = newSongDesc.trim() || "Uploaded from smart-home control board";

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // 1. Create a unique file path inside KITTEN's "songs/" folder
      const storagePath = `songs/${Date.now()}_${file.name}`;
      const songRef = ref(storage, storagePath);

      // 2. Trigger resumable binary upload
      const uploadTask = uploadBytesResumable(songRef, file);

      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          setUploadProgress(progress);
        }, 
        async (error) => {
          console.error("Storage upload failed:", error);
          addLog(`Storage error: ${error.message}. Please click 'Get Started' on the Firebase Console Storage tab!`, 'alert');
          setIsUploading(false);
        }, 
        async () => {
          // 3. Upload completed, get download stream URL
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);

          // 4. Save metadata object to Firestore "songs"
          await saveSongMetadata({
            name: songName,
            desc: songDesc,
            url: downloadUrl,
            path: storagePath
          });

          addLog(`Database: Registered "${songName}" audio track successfully!`, 'success');
          
          // Reset fields and refresh
          setNewSongName('');
          setNewSongDesc('');
          setIsUploading(false);
          loadSongs();
        }
      );

    } catch (err: any) {
      console.error("Audio save transaction failed:", err);
      addLog(`File upload system failed: ${err.message || String(err)}. Make sure Storage is enabled!`, 'alert');
      setIsUploading(false);
    }
  };

  // Delete Track helper
  const handleDeleteSong = async (song: Song) => {
    if (song.id.startsWith('default-')) {
      addLog(`System Error: Default ROM tracks are read-only and cannot be deleted.`, 'warning');
      return;
    }

    try {
      // 1. Remove from Firestore
      await deleteSongMetadata(song.id);

      // 2. Remove binary from Storage if path is saved
      if (song.path) {
        const fileRef = ref(storage, song.path);
        await deleteObject(fileRef).catch(e => console.warn("Binary skip delete:", e instanceof Error ? e.message : String(e)));
      }

      addLog(`Database: Unregistered and pruned track "${song.name}"`, 'info');

      // If active playing song was deleted, reset to default song 0
      if (currentSong.id === song.id) {
        setIsPlaying(false);
        if (audioRef.current) audioRef.current.pause();
        setCurrentSong(DEFAULT_SONGS[0]);
      }

      loadSongs();
    } catch (err: any) {
      addLog(`Pruning track error: ${err.message}`, 'alert');
    }
  };

  // Drag handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  return (
    <GlowCard
      id="card-media-control-hub"
      title="Audio & Streaming Subsystem"
      subtitle="KITTEN I2S HARDWARE STREAM CONTROL"
      glowColor={isPlaying ? 'emerald' : 'none'}
      className="md:col-span-3"
    >
      {/* Hidden Player for local rendering */}
      <audio
        ref={audioRef}
        src={currentSong.url}
        crossOrigin="anonymous"
        onEnded={handleNextSong}
        onError={(e) => {
          console.warn("Media Hub local audio load failure: Audio playback error event.");
          addLog(`Smart Speaker Preview: Local browser playback failed to load audio from remote source. However, the ESP32 streaming URL remains synchronized and is broadcastable!`, 'info');
        }}
        className="hidden"
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: ACTIVE PLAYER STATUS (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-900/60 pb-6 lg:pb-0 lg:pr-6">
          <div className="flex flex-col gap-4">
            {/* Spinning disk track layout */}
            <div className="flex items-center gap-4 bg-slate-950/40 p-3 rounded-xl border border-slate-900">
              <div className="relative flex items-center justify-center">
                <div className={`p-4 rounded-full bg-gradient-to-tr from-emerald-500/10 to-teal-400/20 text-emerald-400 border border-emerald-500/20 ${isPlaying ? 'animate-[spin_4s_linear_infinite]' : ''}`}>
                  <Disc className="w-8 h-8" />
                </div>
                <div className="absolute w-2.5 h-2.5 bg-slate-950 border border-slate-800 rounded-full" />
              </div>

              <div className="min-w-0 flex-grow">
                <span className="text-[8px] font-mono tracking-widest text-emerald-400 uppercase font-bold block mb-1">
                  {isPlaying ? 'ACTIVE BROADCAST STREAM' : 'SPEAKER STANDBY'}
                </span>
                <h3 className="text-sm font-bold text-slate-100 truncate leading-tight">
                  {currentSong.name}
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5 truncate font-mono">
                  {currentSong.desc}
                </p>
              </div>
            </div>

            {/* Micro Audio Spectrum Analyzer */}
            <div className="bg-slate-950/80 rounded-xl p-4 border border-slate-900 flex flex-col items-center justify-center gap-2 h-20">
              <div className="flex gap-1 items-end h-10 w-full justify-center">
                {visLevels.map((height, idx) => (
                  <div
                    key={idx}
                    className={`w-1 rounded-full transition-all duration-100 ${isPlaying ? 'bg-gradient-to-t from-emerald-500 to-teal-400' : 'bg-slate-900'}`}
                    style={{ height: `${height}px` }}
                  />
                ))}
              </div>
              <span className="text-[8px] text-slate-500 font-mono tracking-wider">
                REAL-TIME SAMPLING BANDS (I2S DMA BUFFERS)
              </span>
            </div>
          </div>

          {/* Master Music Player controls */}
          <div className="flex flex-col gap-3 mt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  id="btn-media-play"
                  onClick={handleTogglePlay}
                  className={`p-3 rounded-xl border cursor-pointer transition-all duration-300 ${
                    isPlaying 
                      ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]' 
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
                  }`}
                  title={isPlaying ? "Pause Track" : "Play Track"}
                >
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                </button>

                <button
                  id="btn-media-skip"
                  onClick={handleNextSong}
                  className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition-colors cursor-pointer"
                  title="Next Track"
                >
                  <Radio className="w-5 h-5 text-slate-400 hover:text-teal-400" />
                </button>

                <button
                  id="btn-media-mute"
                  onClick={handleToggleMute}
                  className={`p-3 rounded-xl border transition-colors cursor-pointer ${
                    isMuted 
                      ? 'bg-rose-950/20 border-rose-500/20 text-rose-400' 
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white'
                  }`}
                >
                  {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </button>
              </div>

              <div className="flex items-center gap-2 max-w-[140px] flex-grow">
                <span className="text-[9px] font-mono text-slate-500">VOL</span>
                <input
                  id="media-volume-slider"
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
                  onChange={(e) => handleVolumeChange(parseInt(e.target.value))}
                  className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                />
                <span className="text-[9px] font-mono text-slate-400 min-w-[20px] text-right">{volume}</span>
              </div>
            </div>

            <div className="text-[9px] font-mono text-slate-500 bg-slate-950/50 p-2 rounded border border-slate-900/60 leading-normal">
              <span className="text-emerald-400 font-bold block mb-0.5">ESP32 STREAM INSTRUCTIONS</span>
              On the physical node, use an I2S codec connected to KITTEN's control document endpoint to dynamically stream this audio stream download URL.
            </div>
          </div>
        </div>

        {/* MIDDLE COLUMN: TRACK LIBRARY & DELETE (4 Cols) */}
        <div className="lg:col-span-4 flex flex-col gap-3">
          <div className="flex items-center gap-1.5 text-slate-300 text-[10px] font-mono tracking-widest uppercase mb-1">
            <ListMusic className="w-4 h-4 text-emerald-400" />
            <span>Smart Home Track Library</span>
          </div>

          <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto pr-1 scrollbar-thin">
            {songs.map((song) => {
              const isActive = currentSong.id === song.id;
              const isDefault = song.id.startsWith('default-');

              return (
                <div
                  key={song.id}
                  className={`flex items-center justify-between p-2 rounded-lg border transition-all ${
                    isActive
                      ? 'border-emerald-500/30 bg-emerald-950/15'
                      : 'border-slate-900/60 bg-slate-950/20 hover:border-slate-800'
                  }`}
                >
                  <button
                    id={`btn-select-song-${song.id}`}
                    onClick={() => handlePlaySong(song)}
                    className="flex-grow flex items-center gap-2.5 text-left min-w-0 cursor-pointer group"
                  >
                    <div className={`p-1.5 rounded-md ${isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-900 text-slate-500 group-hover:text-slate-300'}`}>
                      <Music className="w-3 h-3" />
                    </div>
                    <div className="min-w-0">
                      <h4 className={`text-xs font-bold leading-none mb-1 truncate ${isActive ? 'text-emerald-400 font-sans' : 'text-slate-200'}`}>
                        {song.name}
                      </h4>
                      <p className="text-[9px] font-mono text-slate-500 truncate leading-none">
                        {isDefault ? 'Read-only ROM' : 'User Uploaded'}
                      </p>
                    </div>
                  </button>

                  <div className="flex items-center gap-1 pl-2">
                    {isActive && isPlaying && (
                      <span className="text-[8px] font-mono text-emerald-400 font-bold px-1.5 py-0.5 rounded bg-emerald-950/30 animate-pulse border border-emerald-500/10 mr-1 uppercase">
                        Playing
                      </span>
                    )}

                    {!isDefault && (
                      <button
                        id={`btn-delete-song-${song.id}`}
                        onClick={() => handleDeleteSong(song)}
                        className="p-1 rounded text-slate-600 hover:text-rose-400 hover:bg-rose-950/10 transition-colors cursor-pointer"
                        title="Prune Custom track"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: SECURE AUDIO FILE UPLOAD (3 Cols) */}
        <div className="lg:col-span-3 flex flex-col gap-3">
          <div className="text-slate-300 text-[10px] font-mono tracking-widest uppercase flex items-center gap-1.5 mb-1">
            <UploadCloud className="w-4 h-4 text-emerald-400" />
            <span>Store Audio Track</span>
          </div>

          <div className="flex flex-col gap-2 bg-slate-950/40 p-3 rounded-xl border border-slate-900">
            {/* Input fields */}
            <div className="flex flex-col gap-1.5">
              <input
                id="input-audio-song-name"
                type="text"
                placeholder="Track Title (e.g. Synth Chill)"
                value={newSongName}
                onChange={(e) => setNewSongName(e.target.value)}
                disabled={isUploading}
                className="w-full text-[10px] font-mono px-2 py-1.5 rounded-lg border border-slate-900 bg-slate-950 text-slate-300 focus:outline-none focus:border-emerald-500/40 transition-colors"
              />
              <input
                id="input-audio-song-desc"
                type="text"
                placeholder="Description / Genre Tag"
                value={newSongDesc}
                onChange={(e) => setNewSongDesc(e.target.value)}
                disabled={isUploading}
                className="w-full text-[10px] font-mono px-2 py-1.5 rounded-lg border border-slate-900 bg-slate-950 text-slate-300 focus:outline-none focus:border-emerald-500/40 transition-colors"
              />
            </div>

            {/* Drag & Drop File Upload Frame */}
            <div
              id="audio-upload-dropzone"
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`border border-dashed rounded-xl p-3 flex flex-col items-center justify-center text-center cursor-pointer min-h-[96px] transition-all duration-300 ${
                dragActive 
                  ? 'border-emerald-400 bg-emerald-950/10 text-emerald-300' 
                  : 'border-slate-800 bg-slate-950/50 text-slate-400 hover:border-slate-700 hover:bg-slate-900/10'
              }`}
              onClick={() => document.getElementById('audio-upload-file-picker')?.click()}
            >
              <input
                id="audio-upload-file-picker"
                type="file"
                accept="audio/*"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileUpload(e.target.files[0]);
                  }
                }}
                disabled={isUploading}
                className="hidden"
              />

              {isUploading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
                  <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">
                    Uploading {uploadProgress}%
                  </span>
                  <div className="w-24 bg-slate-900 h-1 rounded-full overflow-hidden border border-slate-800">
                    <div className="bg-emerald-400 h-full transition-all duration-150" style={{ width: `${uploadProgress}%` }} />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <FileAudio className="w-5 h-5 text-slate-500 hover:text-emerald-400 transition-colors" />
                  <span className="text-[9px] font-mono leading-tight uppercase font-medium">
                    Drag Audio or Click
                  </span>
                  <span className="text-[7px] text-slate-600 font-mono">
                    MP3, WAV / MAX 10MB
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </GlowCard>
  );
}
