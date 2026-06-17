import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type HabitType = 'binary' | 'volume';

export interface HabitCompletion {
  date: string;  // YYYY-MM-DD
  count: number;
}

export interface Habit {
  id: string;
  name: string;
  emoji: string;
  type: HabitType;
  targetCount: number;
  completions: HabitCompletion[];
  challengeId?: string;
  reminderTimes: string[];   // "HH:MM" 24h; binary allows max 1, volume allows multiple
  createdAt: string;
}

export interface Challenge {
  id: string;
  name: string;
  durationDays: number;
  startDate: string;
  habitIds: string[];
  completedAt?: string;
}

interface HabitsContextType {
  habits: Habit[];
  challenges: Challenge[];
  addHabit: (name: string, emoji: string, type: HabitType, targetCount: number) => void;
  removeHabit: (id: string) => void;
  increment: (id: string) => void;
  decrement: (id: string) => void;
  setHabitReminders: (id: string, times: string[]) => void;
  toggleHistoricalCompletion: (habitId: string, date: string) => void;
  addChallenge: (name: string, durationDays: number, habitIds: string[]) => Challenge;
  updateChallengeDuration: (id: string, durationDays: number) => void;
  updateChallengeStartDate: (id: string, startDate: string) => void;
  deleteChallenge: (id: string) => void;
  completeChallenge: (id: string) => void;
  resetAll: () => void;
}

const HabitsContext = createContext<HabitsContextType | null>(null);

const STORAGE_KEY = 'habits_v4';
const CHALLENGES_KEY = 'challenges_v2';

export function localDateKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getTodayCount(habit: Habit): number {
  const today = localDateKey();
  return habit.completions.find((c) => c.date === today)?.count ?? 0;
}

export function isTodayComplete(habit: Habit): boolean {
  return getTodayCount(habit) >= habit.targetCount;
}

export function getCompletionForDate(habit: Habit, date: string): boolean {
  const c = habit.completions.find((c) => c.date === date);
  return c ? c.count >= habit.targetCount : false;
}

export function getStreak(habit: Habit): number {
  let streak = 0;
  const cursor = new Date();
  if (!isTodayComplete(habit)) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (true) {
    const key = localDateKey(cursor);
    const completion = habit.completions.find((c) => c.date === key);
    if (!completion || completion.count < habit.targetCount) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function getChallengeProgress(challenge: Challenge, habits: Habit[]): number {
  const start = new Date(challenge.startDate + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const elapsed = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const daysToCheck = Math.min(Math.max(elapsed + 1, 0), challenge.durationDays);

  let completed = 0;
  const total = challenge.habitIds.length * challenge.durationDays;

  for (const habitId of challenge.habitIds) {
    const habit = habits.find((h) => h.id === habitId);
    if (!habit) continue;
    for (let i = 0; i < daysToCheck; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const key = localDateKey(d);
      const c = habit.completions.find((c) => c.date === key);
      if (c && c.count >= habit.targetCount) completed++;
    }
  }
  return total > 0 ? completed / total : 0;
}

const DEFAULT_HABITS: Habit[] = [
  { id: '1', name: 'Drink 8 glasses of water', emoji: '💧', type: 'volume', targetCount: 8, completions: [], reminderTimes: [], createdAt: localDateKey() },
  { id: '2', name: 'Exercise 30 min', emoji: '🏃', type: 'binary', targetCount: 1, completions: [], reminderTimes: [], createdAt: localDateKey() },
  { id: '3', name: 'Read 20 pages', emoji: '📚', type: 'binary', targetCount: 1, completions: [], reminderTimes: [], createdAt: localDateKey() },
  { id: '4', name: 'Meditate', emoji: '🧘', type: 'binary', targetCount: 1, completions: [], reminderTimes: [], createdAt: localDateKey() },
];

export function HabitsProvider({ children }: { children: React.ReactNode }) {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(STORAGE_KEY),
      AsyncStorage.getItem(CHALLENGES_KEY),
    ]).then(([rawHabits, rawChallenges]) => {
      const parsedHabits = rawHabits ? JSON.parse(rawHabits) : [];
      // Migrate old habits that don't have reminderTimes
      const migratedHabits = parsedHabits.map((h: Habit) => ({
        ...h,
        reminderTimes: h.reminderTimes ?? [],
      }));
      setHabits(migratedHabits);
      setChallenges(rawChallenges ? JSON.parse(rawChallenges) : []);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(habits));
  }, [habits, loaded]);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(CHALLENGES_KEY, JSON.stringify(challenges));
  }, [challenges, loaded]);

  const addHabit = useCallback((name: string, emoji: string, type: HabitType, targetCount: number) => {
    setHabits((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name, emoji, type, targetCount, completions: [], reminderTimes: [], createdAt: localDateKey(),
      },
    ]);
  }, []);

  const removeHabit = useCallback((id: string) => {
    setHabits((prev) => prev.filter((h) => h.id !== id));
  }, []);

  const increment = useCallback((id: string) => {
    const today = localDateKey();
    setHabits((prev) =>
      prev.map((h) => {
        if (h.id !== id) return h;
        const existing = h.completions.find((c) => c.date === today);
        if ((existing?.count ?? 0) >= h.targetCount) return h;
        const newCompletions = existing
          ? h.completions.map((c) => (c.date === today ? { ...c, count: c.count + 1 } : c))
          : [...h.completions, { date: today, count: 1 }];
        return { ...h, completions: newCompletions };
      })
    );
  }, []);

  const decrement = useCallback((id: string) => {
    const today = localDateKey();
    setHabits((prev) =>
      prev.map((h) => {
        if (h.id !== id) return h;
        const existing = h.completions.find((c) => c.date === today);
        if (!existing || existing.count <= 0) return h;
        const newCount = existing.count - 1;
        const newCompletions =
          newCount === 0
            ? h.completions.filter((c) => c.date !== today)
            : h.completions.map((c) => (c.date === today ? { ...c, count: newCount } : c));
        return { ...h, completions: newCompletions };
      })
    );
  }, []);

  const setHabitReminders = useCallback((id: string, times: string[]) => {
    setHabits((prev) => prev.map((h) => (h.id === id ? { ...h, reminderTimes: times } : h)));
  }, []);

  // Toggle a full completion for any past (or today) date — used by Dev tools
  const toggleHistoricalCompletion = useCallback((habitId: string, date: string) => {
    setHabits((prev) =>
      prev.map((h) => {
        if (h.id !== habitId) return h;
        const existing = h.completions.find((c) => c.date === date);
        const isDone = existing && existing.count >= h.targetCount;
        if (isDone) {
          return { ...h, completions: h.completions.filter((c) => c.date !== date) };
        }
        const newCompletions = existing
          ? h.completions.map((c) => (c.date === date ? { ...c, count: h.targetCount } : c))
          : [...h.completions, { date, count: h.targetCount }];
        return { ...h, completions: newCompletions };
      })
    );
  }, []);

  const addChallenge = useCallback((name: string, durationDays: number, habitIds: string[]): Challenge => {
    const challenge: Challenge = {
      id: Date.now().toString(),
      name,
      durationDays,
      startDate: localDateKey(),
      habitIds,
    };
    setChallenges((prev) => [...prev, challenge]);
    return challenge;
  }, []);

  const updateChallengeDuration = useCallback((id: string, durationDays: number) => {
    setChallenges((prev) =>
      prev.map((c) => (c.id === id ? { ...c, durationDays, completedAt: undefined } : c))
    );
  }, []);

  const updateChallengeStartDate = useCallback((id: string, startDate: string) => {
    setChallenges((prev) =>
      prev.map((c) => (c.id === id ? { ...c, startDate, completedAt: undefined } : c))
    );
  }, []);

  const deleteChallenge = useCallback((id: string) => {
    setChallenges((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const completeChallenge = useCallback((id: string) => {
    setChallenges((prev) =>
      prev.map((c) => (c.id === id ? { ...c, completedAt: localDateKey() } : c))
    );
  }, []);

  const resetAll = useCallback(() => {
    setHabits([]);
    setChallenges([]);
  }, []);

  return (
    <HabitsContext.Provider
      value={{
        habits, challenges,
        addHabit, removeHabit, increment, decrement,
        setHabitReminders, toggleHistoricalCompletion,
        addChallenge, updateChallengeDuration, updateChallengeStartDate, deleteChallenge, completeChallenge, resetAll,
      }}>
      {children}
    </HabitsContext.Provider>
  );
}

export function useHabits() {
  const ctx = useContext(HabitsContext);
  if (!ctx) throw new Error('useHabits must be used within HabitsProvider');
  return ctx;
}
