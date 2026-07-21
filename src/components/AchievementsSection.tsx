import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { Award, Shield, Trophy, Flame, Clock, Sparkles, Lock, CheckCircle2, Zap } from 'lucide-react';

interface AchievementsSectionProps {
  completions: Record<string, number>;
  streaks: {
    current: number;
    longest: number;
  };
  taskName: string;
}

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  glowColor: string;
  progress: number; // 0 to 100
  progressText: string;
  isUnlocked: boolean;
}

export const AchievementsSection: React.FC<AchievementsSectionProps> = ({
  completions,
  streaks,
  taskName
}) => {
  // Compute metrics
  const { totalCleanDays, totalDaysTracked } = useMemo(() => {
    const keys = Object.keys(completions);
    let clean = 0;
    keys.forEach((k) => {
      if (completions[k] === 0) {
        clean++;
      }
    });
    return {
      totalCleanDays: clean,
      totalDaysTracked: keys.length
    };
  }, [completions]);

  // Determine Early Bird unlock
  const isEarlyBirdUnlocked = useMemo(() => {
    // Unlocked if current time is before 9 AM and we have at least one clean record
    const hours = new Date().getHours();
    return hours < 9 && totalCleanDays > 0;
  }, [totalCleanDays]);

  // Define achievements
  const badges: Badge[] = useMemo(() => {
    const badgeList: Omit<Badge, 'progress' | 'progressText' | 'isUnlocked'>[] = [
      {
        id: 'first_step',
        name: 'First Step',
        description: `Successfully log your first clean day (0 occurrences of ${taskName}).`,
        icon: Zap,
        color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
        glowColor: 'shadow-amber-500/10'
      },
      {
        id: '7_day_keeper',
        name: '7 Day Keeper',
        description: 'Achieve a clean streak of 7 consecutive days.',
        icon: Flame,
        color: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
        glowColor: 'shadow-orange-500/10'
      },
      {
        id: '14_day_guardian',
        name: '14 Day Guardian',
        description: 'Achieve a clean streak of 14 consecutive days.',
        icon: Shield,
        color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
        glowColor: 'shadow-blue-500/10'
      },
      {
        id: '30_day_zen',
        name: '30 Day Zen Master',
        description: 'Achieve a clean streak of 30 consecutive days.',
        icon: Trophy,
        color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        glowColor: 'shadow-emerald-500/10'
      },
      {
        id: 'early_bird',
        name: 'Early Bird',
        description: 'Check in with zero occurrences before 9:00 AM local time.',
        icon: Clock,
        color: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
        glowColor: 'shadow-sky-500/10'
      },
      {
        id: 'consistency_champ',
        name: 'Consistency Champion',
        description: 'Log a total of 15 successful clean days.',
        icon: Sparkles,
        color: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
        glowColor: 'shadow-purple-500/10'
      }
    ];

    return badgeList.map((badge) => {
      let isUnlocked = false;
      let progress = 0;
      let progressText = '';

      switch (badge.id) {
        case 'first_step':
          isUnlocked = totalCleanDays >= 1;
          progress = isUnlocked ? 100 : 0;
          progressText = isUnlocked ? 'Completed' : '0 / 1 Day';
          break;
        case '7_day_keeper':
          isUnlocked = streaks.longest >= 7;
          progress = Math.min(100, Math.round((streaks.longest / 7) * 100));
          progressText = `${Math.min(7, streaks.longest)} / 7 Days`;
          break;
        case '14_day_guardian':
          isUnlocked = streaks.longest >= 14;
          progress = Math.min(100, Math.round((streaks.longest / 14) * 100));
          progressText = `${Math.min(14, streaks.longest)} / 14 Days`;
          break;
        case '30_day_zen':
          isUnlocked = streaks.longest >= 30;
          progress = Math.min(100, Math.round((streaks.longest / 30) * 100));
          progressText = `${Math.min(30, streaks.longest)} / 30 Days`;
          break;
        case 'early_bird':
          isUnlocked = isEarlyBirdUnlocked;
          progress = isUnlocked ? 100 : 0;
          progressText = isUnlocked ? 'Unlocked' : 'Check in < 9:00 AM';
          break;
        case 'consistency_champ':
          isUnlocked = totalCleanDays >= 15;
          progress = Math.min(100, Math.round((totalCleanDays / 15) * 100));
          progressText = `${Math.min(15, totalCleanDays)} / 15 Days`;
          break;
        default:
          break;
      }

      return {
        ...badge,
        isUnlocked,
        progress,
        progressText
      };
    });
  }, [streaks, totalCleanDays, isEarlyBirdUnlocked, taskName]);

  const unlockedCount = useMemo(() => {
    return badges.filter(b => b.isUnlocked).length;
  }, [badges]);

  const overallProgress = useMemo(() => {
    if (badges.length === 0) return 0;
    return Math.round((unlockedCount / badges.length) * 100);
  }, [unlockedCount, badges]);

  return (
    <div className="flex flex-col gap-6">
      {/* Overview Card */}
      <div className="border border-slate-900 bg-slate-900/20 rounded-lg p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Award className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-200">Milestone Achievements</h3>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Unlock unique shields and trophies as you build positive habits
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:items-end gap-1">
          <div className="text-xs text-slate-400 font-medium">
            <span className="font-semibold text-emerald-400 font-mono text-sm">{unlockedCount}</span> / {badges.length} Badges Earned
          </div>
          {/* Circular/Linear visual indicator */}
          <div className="w-full sm:w-40 h-2 bg-slate-900 rounded-full overflow-hidden mt-1 border border-slate-800">
            <div 
              className="h-full bg-emerald-500 transition-all duration-500" 
              style={{ width: `${overallProgress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Badges Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {badges.map((badge) => {
          const Icon = badge.icon;
          return (
            <motion.div
              key={badge.id}
              whileHover={badge.isUnlocked ? { scale: 1.02 } : {}}
              className={`border rounded-lg p-4 flex flex-col justify-between min-h-[140px] transition-all relative overflow-hidden ${
                badge.isUnlocked
                  ? 'border-slate-800 bg-slate-900/30'
                  : 'border-slate-900 bg-slate-950/20 opacity-60'
              }`}
            >
              {/* Card glow effect for unlocked */}
              {badge.isUnlocked && (
                <div className={`absolute -right-8 -top-8 w-20 h-20 rounded-full filter blur-2xl opacity-10 bg-current ${badge.color.split(' ')[0]}`} />
              )}

              <div className="flex gap-3 items-start">
                {/* Badge Icon */}
                <div className={`p-2.5 rounded-lg border flex items-center justify-center shrink-0 ${
                  badge.isUnlocked ? badge.color : 'text-slate-600 bg-slate-900/20 border-slate-800/40'
                }`}>
                  <Icon className="w-5 h-5" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h4 className={`text-xs font-semibold truncate ${
                      badge.isUnlocked ? 'text-slate-100' : 'text-slate-500'
                    }`}>
                      {badge.name}
                    </h4>
                    {badge.isUnlocked && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 leading-normal mt-1">
                    {badge.description}
                  </p>
                </div>
              </div>

              {/* Progress Tracker inside Badge */}
              <div className="mt-4 flex flex-col gap-1.5 border-t border-slate-900/40 pt-3">
                <div className="flex items-center justify-between text-[9px]">
                  <span className={badge.isUnlocked ? 'text-emerald-400 font-medium' : 'text-slate-500'}>
                    {badge.isUnlocked ? 'Completed' : 'In Progress'}
                  </span>
                  <span className="font-mono text-slate-400 font-medium">
                    {badge.progressText}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-950">
                  <div 
                    className={`h-full transition-all duration-500 ${
                      badge.isUnlocked ? 'bg-emerald-500' : 'bg-slate-700'
                    }`}
                    style={{ width: `${badge.progress}%` }}
                  />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
