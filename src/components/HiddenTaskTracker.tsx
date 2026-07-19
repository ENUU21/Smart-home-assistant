/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Plus, Minus, Flame, Calendar, BarChart3, 
  Sparkles, Check, Edit2, Info, RefreshCw, Shield, ShieldAlert, 
  Activity, Award, ArrowLeft, Trash2
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { saveTaskCompletion, getTaskCompletions } from '../lib/firebase';

interface HiddenTaskTrackerProps {
  isOpen: boolean;
  onClose: () => void;
  firestoreSyncEnabled: boolean;
  addLog: (message: string, type: 'info' | 'warning' | 'success' | 'alert') => void;
}

export default function HiddenTaskTracker({
  isOpen,
  onClose,
  firestoreSyncEnabled,
  addLog
}: HiddenTaskTrackerProps) {
  // Config state
  const [taskName, setTaskName] = useState<string>(() => {
    return localStorage.getItem('kitten_secret_task_name') || 'Feed Kitten';
  });
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempTaskName, setTempTaskName] = useState(taskName);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Data State: date string "YYYY-MM-DD" -> count of bad habit occurrences.
  // Strictly clean slate!
  const [completions, setCompletions] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('kitten_secret_task_completions');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return {};
      }
    }
    return {};
  });

  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'tracker' | 'weekly' | 'monthly' | 'yearly'>('tracker');

  const todayStr = useMemo(() => {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const localNow = new Date(now.getTime() - (offset * 60 * 1000));
    return localNow.toISOString().split('T')[0];
  }, []);

  const todayCount = completions[todayStr] || 0;

  // Sync with Firestore if enabled
  useEffect(() => {
    if (!isOpen) return;

    const loadFirestoreData = async () => {
      if (!firestoreSyncEnabled) return;
      setIsLoading(true);
      try {
        const remoteData = await getTaskCompletions(taskName);
        if (remoteData && remoteData.length > 0) {
          const merged = { ...completions };
          remoteData.forEach((item) => {
            merged[item.date] = item.count;
          });
          setCompletions(merged);
          localStorage.setItem('kitten_secret_task_completions', JSON.stringify(merged));
          addLog(`[Cloud] Loaded ${remoteData.length} entries for "${taskName}"`, 'success');
        }
      } catch (err) {
        console.warn('Failed to load task completions from Firestore:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadFirestoreData();
  }, [isOpen, firestoreSyncEnabled, taskName]);

  // Save changes locally and optionally in Firestore
  const updateCount = async (newCount: number) => {
    const updated = {
      ...completions,
      [todayStr]: Math.max(0, newCount),
    };
    setCompletions(updated);
    localStorage.setItem('kitten_secret_task_completions', JSON.stringify(updated));

    if (firestoreSyncEnabled) {
      try {
        await saveTaskCompletion(taskName, todayStr, Math.max(0, newCount));
      } catch (err) {
        console.warn('Failed to save task completion to Firestore:', err);
      }
    }
  };

  const handleIncrement = () => {
    const nextCount = todayCount + 1;
    updateCount(nextCount);
    addLog(`Logged 1 incident of "${taskName}". Total today: ${nextCount}`, 'warning');
  };

  const handleDecrement = () => {
    if (todayCount > 0) {
      const nextCount = todayCount - 1;
      updateCount(nextCount);
      addLog(`Corrected count for "${taskName}". Total today: ${nextCount}`, 'info');
    }
  };

  const handleSaveName = () => {
    const cleanName = tempTaskName.trim();
    if (cleanName) {
      setTaskName(cleanName);
      localStorage.setItem('kitten_secret_task_name', cleanName);
      setIsEditingName(false);
      addLog(`Tracker name updated to "${cleanName}"`, 'info');
    }
  };

  const handleResetData = async () => {
    setCompletions({});
    localStorage.setItem('kitten_secret_task_completions', JSON.stringify({}));
    setShowResetConfirm(false);

    if (firestoreSyncEnabled) {
      try {
        // Overwrite today's count to 0 in Firestore as well
        await saveTaskCompletion(taskName, todayStr, 0);
      } catch (err) {
        console.warn('Failed to reset in Firestore:', err);
      }
    }
    addLog('All tracker logs have been reset to zero.', 'info');
  };

  // Streak Calculator: Clean Streak (Consecutive days with 0 occurrences)
  const streaks = useMemo(() => {
    const keys = Object.keys(completions).sort();
    if (keys.length === 0) {
      return { current: 0, longest: 0 };
    }

    const today = new Date();
    const start = new Date(keys[0]);
    
    // Generate all consecutive dates between start date and today
    const dateList: string[] = [];
    const cur = new Date(start);
    while (cur <= today) {
      dateList.push(cur.toISOString().split('T')[0]);
      cur.setDate(cur.getDate() + 1);
    }

    // Calculate Longest Clean Streak
    let longest = 0;
    let tempStreak = 0;

    dateList.forEach((dStr) => {
      const val = completions[dStr] === undefined ? 0 : completions[dStr];
      if (val === 0) {
        tempStreak++;
        if (tempStreak > longest) {
          longest = tempStreak;
        }
      } else {
        tempStreak = 0;
      }
    });

    // Calculate Current Clean Streak walking backwards from today
    let current = 0;
    const backCursor = new Date();
    const offset = backCursor.getTimezoneOffset();
    const localNow = new Date(backCursor.getTime() - (offset * 60 * 1000));
    const localCursor = new Date(localNow);

    while (true) {
      const dKey = localCursor.toISOString().split('T')[0];
      const val = completions[dKey] !== undefined ? completions[dKey] : 0;
      if (val === 0) {
        current++;
        localCursor.setDate(localCursor.getDate() - 1);
      } else {
        break;
      }
      if (current > 371) break; // Guard limit
    }

    // If today is not clean, current streak is strictly 0
    if ((completions[todayStr] || 0) > 0) {
      current = 0;
    }

    return { current, longest };
  }, [completions, todayStr]);

  // Total Lifetime Occurrences
  const totalLifetimeCount = useMemo(() => {
    return Object.values(completions).reduce((sum: number, val: number) => sum + val, 0);
  }, [completions]);

  // WEEKLY REPORT STATS (Last 7 Days)
  const weeklyStats = useMemo(() => {
    const data = [];
    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    
    let totalOccurrences = 0;
    let cleanDays = 0;

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const count = completions[dateStr] || 0;
      
      totalOccurrences += count;
      if (count === 0) {
        cleanDays++;
      }

      data.push({
        name: daysOfWeek[d.getDay()],
        date: dateStr,
        Occurrences: count,
        Status: count === 0 ? 'Clean Day' : `${count} times`
      });
    }

    return {
      chartData: data,
      totalOccurrences,
      cleanDays
    };
  }, [completions]);

  // MONTHLY REPORT STATS (Last 30 Days)
  const monthlyStats = useMemo(() => {
    const data = [];
    const today = new Date();
    
    let totalOccurrences = 0;
    let cleanDays = 0;

    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const count = completions[dateStr] || 0;
      
      totalOccurrences += count;
      if (count === 0) {
        cleanDays++;
      }

      data.push({
        date: d.toLocaleDateString([], { month: 'short', day: 'numeric' }),
        fullDate: dateStr,
        Count: count,
        isClean: count === 0
      });
    }

    return {
      gridData: data,
      totalOccurrences,
      cleanDays
    };
  }, [completions]);

  // YEARLY REPORT HEATMAP DATA (Scrollable grid of blocks, 53 weeks)
  const yearlyReportWeeks = useMemo(() => {
    const weeks: { date: string; dayOfWeek: number; count: number; formattedDate: string }[][] = [];
    const today = new Date();
    const totalDays = 371; // 53 full weeks
    const startDate = new Date();
    startDate.setDate(today.getDate() - totalDays);

    // Align row columns with Sundays
    const startDayOfWeek = startDate.getDay();
    startDate.setDate(startDate.getDate() - startDayOfWeek);

    const dateCursor = new Date(startDate);
    let currentWeek: { date: string; dayOfWeek: number; count: number; formattedDate: string }[] = [];

    while (dateCursor <= today) {
      const dateStr = dateCursor.toISOString().split('T')[0];
      const count = completions[dateStr] || 0;
      
      currentWeek.push({
        date: dateStr,
        dayOfWeek: dateCursor.getDay(),
        count: count,
        formattedDate: dateCursor.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }),
      });

      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }

      dateCursor.setDate(dateCursor.getDate() + 1);
    }

    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }

    return weeks;
  }, [completions]);

  // YEARLY STATISTICS
  const yearlyStats = useMemo(() => {
    let totalOccurrences = 0;
    let cleanDays = 0;
    let totalTrackedDays = 0;

    yearlyReportWeeks.forEach((week) => {
      week.forEach((day) => {
        totalTrackedDays++;
        totalOccurrences += day.count;
        if (day.count === 0) {
          cleanDays++;
        }
      });
    });

    return {
      totalOccurrences,
      cleanDays,
      totalTrackedDays
    };
  }, [yearlyReportWeeks]);

  // Map count to color scale for Yearly Heatmap: simple, minimal representation
  const getHeatmapColor = (count: number) => {
    if (count === 0) {
      return 'bg-emerald-500/20 hover:bg-emerald-500/40 border border-emerald-500/10';
    }
    if (count === 1) {
      return 'bg-amber-500/30 hover:bg-amber-500/50 border border-amber-500/10';
    }
    if (count === 2) {
      return 'bg-rose-500/40 hover:bg-rose-500/60 border border-rose-500/10';
    }
    return 'bg-red-500/80 hover:bg-red-500/90 border border-red-500/20';
  };

  if (!isOpen) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col font-sans select-none antialiased">
      {/* Minimal Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-900 bg-slate-950 sticky top-0 z-40">
        <div>
          <h1 className="text-base font-medium tracking-tight text-slate-100">
            Habit Tracker
          </h1>
          <p className="text-xs text-slate-500">
            Track daily progress and streaks
          </p>
        </div>

        <button
          onClick={onClose}
          className="px-3 py-1.5 text-xs rounded border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 transition-all cursor-pointer flex items-center gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </button>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl w-full mx-auto px-4 py-8 flex-grow flex flex-col gap-6">
        {/* Compact Stats Row */}
        <div className="grid grid-cols-3 gap-3">
          {/* Stat 1: Current Streak */}
          <div className="bg-slate-900/40 border border-slate-900 rounded-lg p-4 relative overflow-hidden flex flex-col justify-between">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">Current Streak</span>
            <div className="text-xl font-semibold text-orange-400 mt-1">
              {streaks.current} <span className="text-xs text-slate-500 font-normal">days clean</span>
            </div>
          </div>

          {/* Stat 2: Longest Streak */}
          <div className="bg-slate-900/40 border border-slate-900 rounded-lg p-4 relative overflow-hidden flex flex-col justify-between">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">Longest Streak</span>
            <div className="text-xl font-semibold text-emerald-400 mt-1">
              {streaks.longest} <span className="text-xs text-slate-500 font-normal">days clean</span>
            </div>
          </div>

          {/* Stat 3: Total Occurrences */}
          <div className="bg-slate-900/40 border border-slate-900 rounded-lg p-4 relative overflow-hidden flex flex-col justify-between">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">Total Times</span>
            <div className="text-xl font-semibold text-rose-400 mt-1">
              {totalLifetimeCount} <span className="text-xs text-slate-500 font-normal">incidents</span>
            </div>
          </div>
        </div>

        {/* Short, Simple Buttons for Navigation to Avoid Wrapping */}
        <div className="flex border-b border-slate-900 gap-1.5">
          <button
            onClick={() => setActiveTab('tracker')}
            className={`px-3 py-1.5 rounded text-xs transition-all cursor-pointer ${
              activeTab === 'tracker'
                ? 'bg-slate-900 border border-slate-800 text-emerald-400 font-medium'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/20'
            }`}
          >
            Tracker
          </button>
          <button
            onClick={() => setActiveTab('weekly')}
            className={`px-3 py-1.5 rounded text-xs transition-all cursor-pointer ${
              activeTab === 'weekly'
                ? 'bg-slate-900 border border-slate-800 text-emerald-400 font-medium'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/20'
            }`}
          >
            Weekly
          </button>
          <button
            onClick={() => setActiveTab('monthly')}
            className={`px-3 py-1.5 rounded text-xs transition-all cursor-pointer ${
              activeTab === 'monthly'
                ? 'bg-slate-900 border border-slate-800 text-emerald-400 font-medium'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/20'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setActiveTab('yearly')}
            className={`px-3 py-1.5 rounded text-xs transition-all cursor-pointer ${
              activeTab === 'yearly'
                ? 'bg-slate-900 border border-slate-800 text-emerald-400 font-medium'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/20'
            }`}
          >
            Yearly
          </button>
        </div>

        {/* Tab content area */}
        <div className="flex-1 min-h-[350px]">
          {isLoading && (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-xs text-slate-500 bg-slate-900/20 border border-slate-900 rounded-lg">
              <RefreshCw className="w-5 h-5 animate-spin text-slate-500" /> 
              <span>Syncing with database...</span>
            </div>
          )}

          {!isLoading && (
            <AnimatePresence mode="wait">
              {activeTab === 'tracker' && (
                <motion.div
                  key="tab-tracker"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="grid grid-cols-1 md:grid-cols-2 gap-6"
                >
                  {/* Left panel: Name & Log controls */}
                  <div className="flex flex-col gap-4">
                    {/* Habit Name Panel */}
                    <div className="border border-slate-900 bg-slate-900/20 rounded-lg p-5">
                      <div className="text-[10px] uppercase text-slate-500 mb-1.5 font-medium">Habit Label</div>
                      {isEditingName ? (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={tempTaskName}
                            onChange={(e) => setTempTaskName(e.target.value)}
                            className="flex-1 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-slate-750"
                            placeholder="Enter habit name..."
                            maxLength={35}
                          />
                          <button
                            onClick={handleSaveName}
                            className="p-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setTempTaskName(taskName);
                              setIsEditingName(false);
                            }}
                            className="p-1.5 bg-slate-900 border border-slate-800 text-slate-400 rounded cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-slate-200">{taskName}</span>
                          <button
                            onClick={() => {
                              setTempTaskName(taskName);
                              setIsEditingName(true);
                            }}
                            className="p-1 hover:bg-slate-900 rounded text-slate-500 hover:text-slate-300 cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Simple Interaction Controls */}
                    <div className="border border-slate-900 bg-slate-900/20 rounded-lg p-6 flex flex-col items-center justify-center gap-5 min-h-[200px]">
                      <div className="text-[10px] uppercase text-slate-500 font-medium tracking-wider">
                        Log Occurrence
                      </div>
                      
                      <button
                        onClick={handleIncrement}
                        className={`w-24 h-24 rounded-full border flex flex-col items-center justify-center gap-1 transition-all duration-200 cursor-pointer ${
                          todayCount > 0
                            ? 'bg-rose-950/20 border-rose-500/30 text-rose-400 hover:border-rose-400'
                            : 'bg-slate-900/50 border-emerald-500/20 text-emerald-400 hover:border-emerald-400'
                        }`}
                      >
                        <Plus className="w-6 h-6" />
                        <span className="text-[9px] uppercase font-bold tracking-wider">Add</span>
                      </button>

                      {todayCount > 0 && (
                        <button
                          onClick={handleDecrement}
                          className="px-2.5 py-1 text-[10px] rounded border border-slate-800 bg-slate-900 text-slate-400 hover:bg-slate-850 cursor-pointer flex items-center gap-1"
                        >
                          <Minus className="w-3 h-3" /> Remove Mistake
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Right panel: Today's Status */}
                  <div className="border border-slate-900 bg-slate-900/20 rounded-lg p-6 flex flex-col justify-between min-h-[280px]">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase text-slate-500 font-medium tracking-wider">Today's Log</span>
                      <span className="text-xs text-slate-500">{todayStr}</span>
                    </div>

                    <div className="flex flex-col items-center justify-center my-6">
                      <div className={`w-32 h-32 rounded-full border-2 flex flex-col items-center justify-center ${
                        todayCount === 0 
                          ? 'border-emerald-500/20 bg-emerald-950/5 text-emerald-400' 
                          : 'border-rose-500/20 bg-rose-950/5 text-rose-400'
                      }`}>
                        <span className="text-3xl font-semibold font-mono">{todayCount}</span>
                        <span className="text-[10px] uppercase text-slate-500 mt-1">occurrences</span>
                      </div>
                    </div>

                    <div className="text-xs text-slate-400 text-center">
                      {todayCount === 0 ? (
                        <span>Clean day so far. Keep it up!</span>
                      ) : (
                        <span>Logged {todayCount} incident{todayCount > 1 ? 's' : ''} today.</span>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'weekly' && (
                <motion.div
                  key="tab-weekly"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col gap-4"
                >
                  <div className="grid grid-cols-2 gap-4">
                    <div className="border border-slate-900 bg-slate-900/20 rounded-lg p-4">
                      <div className="text-[10px] uppercase text-slate-500">Clean Days</div>
                      <div className="text-base font-semibold text-emerald-400 mt-1">
                        {weeklyStats.cleanDays} <span className="text-xs text-slate-500 font-normal">/ 7 days</span>
                      </div>
                    </div>
                    <div className="border border-slate-900 bg-slate-900/20 rounded-lg p-4">
                      <div className="text-[10px] uppercase text-slate-500">Total Occurrences</div>
                      <div className="text-base font-semibold text-rose-400 mt-1">
                        {weeklyStats.totalOccurrences} <span className="text-xs text-slate-500 font-normal">times</span>
                      </div>
                    </div>
                  </div>

                  <div className="border border-slate-900 bg-slate-900/20 rounded-lg p-5">
                    <h3 className="text-xs font-semibold uppercase text-slate-400 mb-4">
                      Weekly Overview
                    </h3>

                    <div className="h-56 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={weeklyStats.chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                          <XAxis 
                            dataKey="name" 
                            stroke="#475569" 
                            fontSize={10} 
                            tickLine={false}
                          />
                          <YAxis 
                            stroke="#475569" 
                            fontSize={10} 
                            allowDecimals={false}
                            tickLine={false}
                          />
                          <Tooltip
                            cursor={{ fill: 'rgba(255, 255, 255, 0.02)' }}
                            content={({ active, payload }: any) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                return (
                                  <div className="bg-slate-900 border border-slate-800 p-2 rounded text-[10px] text-slate-300">
                                    <div className="text-slate-500">{data.date}</div>
                                    <div className={data.Occurrences === 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                      {data.Status}
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <ReferenceLine y={0} stroke="#10b981" strokeWidth={1} />
                          <Bar 
                            dataKey="Occurrences" 
                            fill="#f43f5e" 
                            radius={[2, 2, 0, 0]} 
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'monthly' && (
                <motion.div
                  key="tab-monthly"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col gap-4"
                >
                  <div className="grid grid-cols-2 gap-4">
                    <div className="border border-slate-900 bg-slate-900/20 rounded-lg p-4">
                      <div className="text-[10px] uppercase text-slate-500">Clean Days</div>
                      <div className="text-base font-semibold text-emerald-400 mt-1">
                        {monthlyStats.cleanDays} <span className="text-xs text-slate-500 font-normal">/ 30 days</span>
                      </div>
                    </div>
                    <div className="border border-slate-900 bg-slate-900/20 rounded-lg p-4">
                      <div className="text-[10px] uppercase text-slate-500">Total Occurrences</div>
                      <div className="text-base font-semibold text-rose-400 mt-1">
                        {monthlyStats.totalOccurrences} <span className="text-xs text-slate-500 font-normal">times</span>
                      </div>
                    </div>
                  </div>

                  <div className="border border-slate-900 bg-slate-900/20 rounded-lg p-5">
                    <h3 className="text-xs font-semibold uppercase text-slate-400 mb-4">
                      30-Day Grid
                    </h3>

                    <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-2">
                      {monthlyStats.gridData.map((day, idx) => {
                        return (
                          <div 
                            key={idx}
                            className={`p-2.5 rounded border text-[10px] flex flex-col justify-between transition-all ${
                              day.isClean 
                                ? 'bg-emerald-950/10 border-emerald-500/10 text-emerald-400' 
                                : 'bg-rose-950/10 border-rose-500/10 text-rose-400'
                            }`}
                          >
                            <span className="text-[9px] text-slate-500">{day.date}</span>
                            <div className="text-xs font-semibold font-mono mt-1">
                              {day.Count} time{day.Count !== 1 ? 's' : ''}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'yearly' && (
                <motion.div
                  key="tab-yearly"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col gap-4"
                >
                  <div className="grid grid-cols-2 gap-4">
                    <div className="border border-slate-900 bg-slate-900/20 rounded-lg p-4">
                      <div className="text-[10px] uppercase text-slate-500">Clean Days</div>
                      <div className="text-base font-semibold text-emerald-400 mt-1">
                        {yearlyStats.cleanDays} <span className="text-xs text-slate-500 font-normal">/ {yearlyStats.totalTrackedDays} days</span>
                      </div>
                    </div>
                    <div className="border border-slate-900 bg-slate-900/20 rounded-lg p-4">
                      <div className="text-[10px] uppercase text-slate-500">Total Occurrences</div>
                      <div className="text-base font-semibold text-rose-400 mt-1">
                        {yearlyStats.totalOccurrences} <span className="text-xs text-slate-500 font-normal">times</span>
                      </div>
                    </div>
                  </div>

                  <div className="border border-slate-900 bg-slate-900/20 rounded-lg p-5">
                    <h3 className="text-xs font-semibold uppercase text-slate-400 mb-4">
                      Yearly Grid
                    </h3>

                    {/* Heatmap Grid Wrapper */}
                    <div className="overflow-x-auto pb-2">
                      <div className="flex gap-1 min-w-[620px] justify-center">
                        <div className="grid grid-flow-col gap-1 auto-cols-[10px]">
                          {yearlyReportWeeks.map((week, weekIdx) => (
                            <div key={weekIdx} className="grid grid-rows-7 gap-1">
                              {week.map((day, dayIdx) => (
                                <div
                                  key={dayIdx}
                                  className={`w-[10px] h-[10px] rounded-[1px] transition-all hover:scale-110 cursor-help ${getHeatmapColor(day.count)}`}
                                  title={`${day.formattedDate}: ${day.count} time(s)`}
                                />
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Simple minimalist legend */}
                    <div className="flex items-center justify-end gap-2 text-[9px] text-slate-500 mt-4 border-t border-slate-900/40 pt-3">
                      <span>Occurrences:</span>
                      <div className="flex items-center gap-1">
                        <div className="w-2.5 h-2.5 rounded-[1px] bg-emerald-500/20 border border-emerald-500/10" />
                        <span>0</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2.5 h-2.5 rounded-[1px] bg-amber-500/30 border border-amber-500/10" />
                        <span>1</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2.5 h-2.5 rounded-[1px] bg-rose-500/40 border border-rose-500/10" />
                        <span>2</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2.5 h-2.5 rounded-[1px] bg-red-500/80 border border-red-500/20" />
                        <span>3+</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}

          {/* Reset button section */}
          <div className="mt-8 border-t border-slate-900/60 pt-6 flex items-center justify-between">
            <span className="text-[10px] text-slate-600 uppercase">Manage tracker data</span>
            {showResetConfirm ? (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-rose-400">Delete everything?</span>
                <button
                  onClick={handleResetData}
                  className="px-2.5 py-1 text-[10px] font-medium rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 cursor-pointer"
                >
                  Yes, Reset
                </button>
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="px-2.5 py-1 text-[10px] font-medium rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowResetConfirm(true)}
                className="px-3 py-1.5 text-[10px] rounded border border-slate-900 bg-slate-950 text-slate-500 hover:text-rose-400 hover:border-rose-950/40 hover:bg-rose-950/5 transition-all flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> Clear All Data
              </button>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-4 border-t border-slate-900 bg-slate-950 flex items-center justify-between text-[10px] text-slate-600">
        <span>Cloud backup synchronized</span>
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span>Active</span>
        </div>
      </footer>
    </div>
  );
}
