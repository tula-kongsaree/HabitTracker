import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { FireCelebration } from '@/components/fire-celebration';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import {
  getStreak,
  getTodayCount,
  isTodayComplete,
  localDateKey,
  useHabits,
  type Habit,
} from '@/context/habits-context';
import { scheduleHabitReminder, cancelHabitReminder } from '@/utils/notifications';

const EMOJIS = [
  '💧', '🏃', '📚', '🧘', '💊', '🥗', '😴', '🏋️',
  '✍️', '🎯', '🧹', '💻', '🎵', '🌱', '⭐', '🦷',
];

const TIME_SLOTS = Array.from({ length: 17 }, (_, i) => `${String(i + 6).padStart(2, '0')}:00`);
const DAY_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const WHEEL_ITEM_H = 52;

function formatTime(t: string): string {
  const h = parseInt(t.split(':')[0], 10);
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

// ─── Confetti ─────────────────────────────────────────────────────────────────

const CONFETTI_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98FB98', '#FFB347', '#FF9FF3', '#54A0FF'];

function ConfettiParticle({ x, delay, color, size, screenHeight }: {
  x: number; delay: number; color: string; size: number; screenHeight: number;
}) {
  const ty = useSharedValue(-20);
  const opacity = useSharedValue(0);
  const rotate = useSharedValue(0);

  useEffect(() => {
    ty.value = withDelay(delay, withTiming(screenHeight + 40, { duration: 2200 }));
    opacity.value = withDelay(delay, withSequence(
      withTiming(1, { duration: 100 }),
      withDelay(1600, withTiming(0, { duration: 500 }))
    ));
    rotate.value = withDelay(delay, withTiming(720, { duration: 2200 }));
  }, []);

  const style = useAnimatedStyle(() => ({
    position: 'absolute',
    left: `${x}%` as any,
    top: 0,
    width: size,
    height: size,
    backgroundColor: color,
    borderRadius: size * 0.3,
    opacity: opacity.value,
    transform: [{ translateY: ty.value }, { rotate: `${rotate.value}deg` }],
  }));

  return <Animated.View style={style} />;
}

function Confetti({ visible }: { visible: boolean }) {
  const { height } = useWindowDimensions();
  const particles = useMemo(() =>
    Array.from({ length: 60 }, (_, i) => ({
      id: i,
      x: 5 + (i * 1.62 * 100 / 60) % 90,
      delay: (i * 37) % 900,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      size: 6 + (i % 4) * 3,
    })),
    []
  );

  if (!visible) return null;
  return (
    <View style={[StyleSheet.absoluteFillObject, { zIndex: 50 }]} pointerEvents="none">
      {particles.map((p) => (
        <ConfettiParticle key={p.id} {...p} screenHeight={height} />
      ))}
    </View>
  );
}

// ─── Shared streak helper ─────────────────────────────────────────────────────

function calcOverallStreak(habits: Habit[]): number {
  if (habits.length === 0) return 0;
  let s = 0;
  const cursor = new Date();
  if (!habits.every(isTodayComplete)) cursor.setDate(cursor.getDate() - 1);
  while (s < 365) {
    const key = localDateKey(cursor);
    const allDone = habits.every(h => {
      const c = h.completions.find(comp => comp.date === key);
      return c !== undefined && c.count >= h.targetCount;
    });
    if (!allDone) break;
    s++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return s;
}

// ─── 7-Day Streak Bar ─────────────────────────────────────────────────────────

function StreakBar({ habits, scheme }: { habits: Habit[]; scheme: 'light' | 'dark' }) {
  const colors = Colors[scheme];
  const cardBg = scheme === 'dark' ? '#1C1C1E' : '#F2F2F7';
  const emptyBg = scheme === 'dark' ? '#3A3A3C' : '#E5E5EA';
  const total = habits.length;

  // Earliest date we have any data for (creation or completion) = "day 1"
  const startDate = useMemo(() => {
    if (habits.length === 0) return localDateKey();
    let min = habits.reduce((m, h) => (h.createdAt < m ? h.createdAt : m), habits[0].createdAt);
    for (const h of habits) {
      for (const c of h.completions) {
        if (c.date < min) min = c.date;
      }
    }
    return min;
  }, [habits]);

  // How many full days have passed since day 1 (0 = still day 1)
  const daysSinceStart = useMemo(() => {
    const start = new Date(startDate + 'T00:00:00');
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  }, [startDate]);

  // TODAY sits at this column index (0 = leftmost on day 1, climbs to 6 on day 7+)
  const todayPos = Math.min(daysSinceStart, 6);

  // Build 7 column descriptors
  const columns = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const daysAgo = todayPos - i; // negative → future (unused column)
    if (daysAgo < 0) return { isFuture: true, done: 0, isToday: false };
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    const key = localDateKey(d);
    const done = habits.filter(h => {
      const c = h.completions.find(comp => comp.date === key);
      return c !== undefined && c.count >= h.targetCount;
    }).length;
    return { isFuture: false, done, isToday: daysAgo === 0 };
  }), [habits, todayPos]);

  const todayDone = columns[todayPos]?.done ?? 0;
  const todayAllDone = total > 0 && todayDone === total;

  const streak = useMemo(() => calcOverallStreak(habits), [habits]);

  // Orange fire mode once 7 consecutive perfect days are reached
  const isOnFire = streak >= 7;
  const segCount = Math.max(total, 1);

  const pulseAnim = useSharedValue(1);
  const glowOpacity = useSharedValue(0);

  useEffect(() => {
    if (todayAllDone) {
      pulseAnim.value = withSequence(
        withSpring(1.04, { damping: 8, stiffness: 180 }),
        withSpring(1, { damping: 10, stiffness: 180 }),
        withSpring(1.02, { damping: 10, stiffness: 180 }),
        withSpring(1, { damping: 12, stiffness: 180 })
      );
      glowOpacity.value = withSequence(
        withTiming(0.5, { duration: 300 }),
        withTiming(0.2, { duration: 400 }),
        withTiming(0.4, { duration: 400 }),
        withTiming(0, { duration: 800 })
      );
    }
  }, [todayAllDone, isOnFire]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
    shadowOpacity: glowOpacity.value,
    shadowRadius: 12,
    shadowColor: isOnFire ? '#FFB300' : todayAllDone ? '#4CAF50' : colors.tint,
    shadowOffset: { width: 0, height: 0 },
    elevation: todayAllDone ? 6 : 0,
  }));

  return (
    <Animated.View style={[streakStyles.container, { backgroundColor: cardBg }, containerStyle]}>
      <View style={streakStyles.header}>
        <Text style={[streakStyles.title, { color: isOnFire ? '#FFB300' : colors.text }]}>
          {streak === 0 ? '✨ Start your streak!' : `🔥 ${streak}-day perfect streak`}
        </Text>
        {isOnFire && (
          <View style={streakStyles.fireBadge}>
            <Text style={streakStyles.fireBadgeText}>⚡ On fire!</Text>
          </View>
        )}
      </View>

      {/* 7 fixed columns: dot progresses left→right each day, future cols are empty */}
      <View style={streakStyles.bars}>
        {columns.map(({ isFuture, done, isToday }, i) => {
          const dayAllDone = !isFuture && total > 0 && done === total;
          const segColor = isOnFire ? '#FFB300' : dayAllDone ? '#4CAF50' : colors.tint;

          return (
            <View key={i} style={streakStyles.barCol}>
              <View style={streakStyles.segStack}>
                {Array.from({ length: segCount }).map((_, si) => {
                  const filled = !isFuture && (segCount - 1 - si) < done;
                  return (
                    <View
                      key={si}
                      style={[streakStyles.segment, { backgroundColor: filled ? segColor : emptyBg }]}
                    />
                  );
                })}
              </View>
              <View style={streakStyles.dotPlaceholder}>
                {isToday && <View style={[streakStyles.todayDot, { backgroundColor: isOnFire ? '#FFB300' : colors.tint }]} />}
              </View>
            </View>
          );
        })}
      </View>
    </Animated.View>
  );
}

const streakStyles = StyleSheet.create({
  container: { marginHorizontal: 20, marginTop: 8, padding: 14, borderRadius: 16, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 13, fontWeight: '600' },
  fireBadge: { backgroundColor: '#FFB300', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  fireBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  bars: { flexDirection: 'row', gap: 4 },
  barCol: { flex: 1, alignItems: 'center', gap: 3 },
  segStack: { width: '80%', height: 44, gap: 2 },
  segment: { flex: 1, borderRadius: 3 },
  dotPlaceholder: { height: 4, alignItems: 'center' },
  todayDot: { width: 4, height: 4, borderRadius: 2 },
});

// ─── Time Wheel Picker ────────────────────────────────────────────────────────

function TimeWheel({ localTimes, isVolume, onChange, conflictedTimes, scheme }: {
  localTimes: string[];
  isVolume: boolean;
  onChange: (times: string[]) => void;
  conflictedTimes: Set<string>;
  scheme: 'light' | 'dark';
}) {
  const colors = Colors[scheme];
  const scrollRef = useRef<ScrollView>(null);
  const [centeredIdx, setCenteredIdx] = useState(() => {
    const first = localTimes[0];
    const idx = first ? TIME_SLOTS.indexOf(first) : 0;
    return idx >= 0 ? idx : 0;
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: centeredIdx * WHEEL_ITEM_H, animated: false });
  }, []);

  const centeredTime = TIME_SLOTS[centeredIdx];
  const isCenteredConflicted = conflictedTimes.has(centeredTime);

  function handleScroll(e: any) {
    const y = e.nativeEvent.contentOffset.y;
    const idx = Math.max(0, Math.min(Math.round(y / WHEEL_ITEM_H), TIME_SLOTS.length - 1));
    setCenteredIdx(idx);
    if (!isVolume) {
      const t = TIME_SLOTS[idx];
      onChange(conflictedTimes.has(t) ? [] : [t]);
    }
  }

  function handleAdd() {
    if (isCenteredConflicted || localTimes.includes(centeredTime)) return;
    onChange([...localTimes, centeredTime].sort());
  }

  function handleRemove(t: string) {
    onChange(localTimes.filter(x => x !== t));
  }

  return (
    <View>
      <View style={wheelStyles.wheelContainer}>
        {/* Center selection band */}
        <View
          pointerEvents="none"
          style={[wheelStyles.selectionBand, {
            top: WHEEL_ITEM_H * 2,
            borderColor: colors.tint,
            backgroundColor: `${colors.tint}18`,
          }]}
        />
        <ScrollView
          ref={scrollRef}
          style={[wheelStyles.scroll, { scrollSnapType: 'y mandatory' } as any]}
          showsVerticalScrollIndicator={false}
          snapToInterval={WHEEL_ITEM_H}
          decelerationRate="fast"
          onScroll={handleScroll}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingVertical: WHEEL_ITEM_H * 2 }}
        >
          {TIME_SLOTS.map((t, i) => {
            const dist = Math.abs(i - centeredIdx);
            const conflict = conflictedTimes.has(t);
            const selected = localTimes.includes(t);
            const isCentered = i === centeredIdx;
            return (
              <View
                key={t}
                style={[wheelStyles.wheelItem, { scrollSnapAlign: 'center' } as any]}>
                <Text style={[wheelStyles.wheelItemText, {
                  fontSize: isCentered ? 22 : 17,
                  fontWeight: isCentered ? '700' : '400',
                  color: conflict ? '#FF3B30'
                    : selected ? colors.tint
                    : isCentered ? colors.text
                    : colors.icon,
                  opacity: dist === 0 ? 1 : dist === 1 ? 0.5 : dist === 2 ? 0.2 : 0.08,
                }]}>
                  {formatTime(t)}{conflict ? '  ✗' : selected && isVolume ? '  ●' : ''}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      </View>

      {isVolume && (
        <Pressable
          style={[wheelStyles.addBtn, {
            backgroundColor: isCenteredConflicted || localTimes.includes(centeredTime)
              ? (scheme === 'dark' ? '#2C2C2E' : '#E5E5EA')
              : colors.tint,
          }]}
          onPress={handleAdd}
          disabled={isCenteredConflicted}>
          <Text style={[wheelStyles.addBtnText, {
            color: isCenteredConflicted || localTimes.includes(centeredTime)
              ? colors.icon
              : scheme === 'dark' ? '#151718' : '#fff',
          }]}>
            {localTimes.includes(centeredTime)
              ? `✓ ${formatTime(centeredTime)} added`
              : isCenteredConflicted
              ? `${formatTime(centeredTime)} taken`
              : `+ Add ${formatTime(centeredTime)}`}
          </Text>
        </Pressable>
      )}

      {localTimes.length > 0 && (
        <View style={wheelStyles.chips}>
          {localTimes.map(t => (
            <Pressable
              key={t}
              onPress={() => handleRemove(t)}
              style={[wheelStyles.chip, { backgroundColor: `${colors.tint}22` }]}>
              <Text style={[wheelStyles.chipText, { color: colors.tint }]}>{formatTime(t)}</Text>
              <Text style={[wheelStyles.chipX, { color: colors.tint }]}>×</Text>
            </Pressable>
          ))}
        </View>
      )}

      {!isVolume && localTimes.length > 0 && (
        <Pressable onPress={() => onChange([])} style={wheelStyles.clearBinary}>
          <Text style={wheelStyles.clearBinaryText}>Remove reminder</Text>
        </Pressable>
      )}
    </View>
  );
}

const wheelStyles = StyleSheet.create({
  wheelContainer: { position: 'relative', overflow: 'hidden', borderRadius: 16 },
  scroll: { height: WHEEL_ITEM_H * 5 },
  selectionBand: {
    position: 'absolute',
    left: 0, right: 0,
    height: WHEEL_ITEM_H,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    zIndex: 1,
  },
  wheelItem: { height: WHEEL_ITEM_H, alignItems: 'center', justifyContent: 'center' },
  wheelItemText: { textAlign: 'center' },
  addBtn: { marginTop: 12, padding: 14, borderRadius: 14, alignItems: 'center' },
  addBtnText: { fontWeight: '700', fontSize: 15 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontWeight: '600', fontSize: 14 },
  chipX: { fontSize: 17, lineHeight: 20 },
  clearBinary: { marginTop: 8, alignItems: 'center', padding: 8 },
  clearBinaryText: { color: '#FF3B30', fontSize: 13, fontWeight: '500' },
});

// ─── Reminder Picker Sheet ────────────────────────────────────────────────────

function ReminderPickerSheet({ habit, allHabits, scheme, onClose }: {
  habit: Habit; allHabits: Habit[]; scheme: 'light' | 'dark'; onClose: () => void;
}) {
  const { setHabitReminders } = useHabits();
  const colors = Colors[scheme];
  const sheetBg = scheme === 'dark' ? '#1C1C1E' : '#F2F2F7';
  const isVolume = habit.type === 'volume';

  const conflictedTimes = useMemo(() => {
    const s = new Set<string>();
    for (const h of allHabits) {
      if (h.id !== habit.id) {
        for (const t of h.reminderTimes) s.add(t);
      }
    }
    return s;
  }, [allHabits, habit.id]);

  const [localTimes, setLocalTimes] = useState<string[]>(habit.reminderTimes);

  async function handleDone() {
    const toAdd = localTimes.filter(t => !habit.reminderTimes.includes(t));
    const toRemove = habit.reminderTimes.filter(t => !localTimes.includes(t));
    for (const t of toRemove) await cancelHabitReminder(`${habit.id}-${t}`);
    for (const t of toAdd) {
      const h = parseInt(t.split(':')[0], 10);
      await scheduleHabitReminder(`${habit.id}-${t}`, habit.name, h, 0);
    }
    setHabitReminders(habit.id, localTimes);
    onClose();
  }

  return (
    <View style={[rpStyles.sheet, { backgroundColor: sheetBg }]}>
      <ThemedText type="subtitle" style={rpStyles.title}>
        {habit.emoji} {habit.name}
      </ThemedText>
      <ThemedText style={{ color: colors.icon, fontSize: 13, textAlign: 'center' }}>
        {isVolume ? 'Scroll and tap Add for each time you want' : 'Scroll to your reminder time'}
      </ThemedText>

      <TimeWheel
        localTimes={localTimes}
        isVolume={isVolume}
        onChange={setLocalTimes}
        conflictedTimes={conflictedTimes}
        scheme={scheme}
      />

      <Pressable style={[rpStyles.doneBtn, { backgroundColor: colors.tint }]} onPress={handleDone}>
        <Text style={[rpStyles.doneBtnText, { color: scheme === 'dark' ? '#151718' : '#fff' }]}>Done</Text>
      </Pressable>
    </View>
  );
}

const rpStyles = StyleSheet.create({
  sheet: { padding: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24, gap: 14 },
  title: { textAlign: 'center' },
  doneBtn: { padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 4 },
  doneBtnText: { fontWeight: '700', fontSize: 15 },
});

// ─── Habit Card ───────────────────────────────────────────────────────────────

function HabitCard({ habit, allHabits, scheme, onComplete }: {
  habit: Habit; allHabits: Habit[]; scheme: 'light' | 'dark'; onComplete: (id: string) => void;
}) {
  const { increment, decrement, removeHabit } = useHabits();
  const colors = Colors[scheme];
  const cardBg = scheme === 'dark' ? '#1C1C1E' : '#F2F2F7';
  const btnBg = scheme === 'dark' ? '#2C2C2E' : '#E5E5EA';
  const [reminderOpen, setReminderOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const scale = useSharedValue(1);
  const glowOpacity = useSharedValue(0);

  const done = isTodayComplete(habit);
  const count = getTodayCount(habit);
  const streak = getStreak(habit);
  const streakAtRisk = streak >= 2 && !done;

  const animatedCard = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const animatedGlow = useAnimatedStyle(() => ({ opacity: glowOpacity.value }));

  function fireCompletionBurst() {
    scale.value = withSequence(
      withSpring(0.96, { damping: 20, stiffness: 350 }),
      withSpring(1, { damping: 22, stiffness: 350 })
    );
    glowOpacity.value = withSequence(
      withTiming(0.2, { duration: 80 }),
      withTiming(0, { duration: 500 })
    );
  }

  function handleDeleteYes() {
    setConfirmDeleteOpen(false);
    removeHabit(habit.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  }

  function handleBinaryTap() {
    if (done) {
      decrement(habit.id);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
      scale.value = withSequence(
        withSpring(0.98, { damping: 20, stiffness: 350 }),
        withSpring(1, { damping: 22, stiffness: 350 })
      );
    } else {
      increment(habit.id);
      onComplete(habit.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      fireCompletionBurst();
    }
  }

  function handleVolumeIncrement() {
    if (done) return;
    const willComplete = count + 1 >= habit.targetCount;
    increment(habit.id);
    if (willComplete) {
      onComplete(habit.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      fireCompletionBurst();
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      scale.value = withSequence(
        withSpring(1.015, { damping: 20, stiffness: 400 }),
        withSpring(1, { damping: 22, stiffness: 400 })
      );
    }
  }

  function handleVolumeDecrement() {
    if (count <= 0) return;
    decrement(habit.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
  }

  const reminderLabel = habit.reminderTimes.length === 0
    ? '🔔 Set reminder'
    : `🔔 ${habit.reminderTimes.map(formatTime).join(', ')}`;

  const dividerColor = scheme === 'dark' ? '#3A3A3C' : '#E5E5EA';

  const cardInner = (
    <Animated.View style={[styles.habitCard, { backgroundColor: cardBg }, animatedCard]}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, styles.glowOverlay, animatedGlow]} />

      {/* Main row — fades when done */}
      <View style={[styles.cardMainRow, { opacity: done ? 0.5 : 1 }]}>
        <Text style={styles.habitEmoji}>{habit.emoji}</Text>

        <View style={styles.habitInfo}>
          <ThemedText style={[styles.habitName, done && styles.habitNameDone, done && { color: colors.icon }]}>
            {habit.name}
          </ThemedText>
          {streakAtRisk && <Text style={styles.streakRisk}>🔥 {streak}-day streak at risk</Text>}
          {habit.type === 'volume' && (
            <View style={[styles.volumeBar, { backgroundColor: colors.background }]}>
              <View style={[styles.volumeBarFill, {
                width: `${Math.min((count / habit.targetCount) * 100, 100)}%`,
                backgroundColor: done ? '#4CAF50' : colors.tint,
              }]} />
            </View>
          )}
          <Text style={[styles.reminderIndicator, { color: colors.icon }]}>
            {habit.reminderTimes.length > 0
              ? `🔔 ${habit.reminderTimes.map(formatTime).join(', ')}`
              : '🔔 No reminder set'}
          </Text>
        </View>

        {habit.type === 'binary' ? (
          <Pressable
            onPress={handleBinaryTap}
            hitSlop={10}
            style={[styles.checkbox,
              done ? { backgroundColor: '#4CAF50', borderColor: '#4CAF50' } : { borderColor: colors.icon }]}
          >
            {done && <Text style={styles.checkmark}>✓</Text>}
          </Pressable>
        ) : (
          <View style={styles.volumeControls}>
            <Pressable onPress={handleVolumeDecrement} style={[styles.volBtn, { backgroundColor: btnBg }]}>
              <Text style={[styles.volBtnText, { color: colors.text }]}>−</Text>
            </Pressable>
            <Text style={[styles.countText, { color: done ? '#4CAF50' : colors.text }]}>
              {count}/{habit.targetCount}
            </Text>
            <Pressable
              onPress={handleVolumeIncrement}
              disabled={done}
              style={[styles.volBtn, { backgroundColor: btnBg }, done && { opacity: 0.5 }]}>
              <Text style={[styles.volBtnText, { color: done ? '#4CAF50' : colors.tint }]}>+</Text>
            </Pressable>
          </View>
        )}

        <Pressable onPress={() => setMenuOpen(m => !m)} style={styles.menuToggle} hitSlop={8}>
          <Text style={[styles.menuArrow, { color: colors.icon }]}>{menuOpen ? '▲' : '▼'}</Text>
        </Pressable>
      </View>

      {/* Dropdown — expands inside the same card block */}
      {menuOpen && (
        <>
          <View style={[styles.dropdownDivider, { backgroundColor: dividerColor }]} />
          <Pressable
            onPress={() => { setMenuOpen(false); setReminderOpen(true); }}
            style={styles.dropdownBtn}
          >
            <Text style={[styles.dropdownBtnText, { color: colors.tint }]}>{reminderLabel}</Text>
          </Pressable>
          <View style={[styles.dropdownDivider, { backgroundColor: dividerColor }]} />
          <Pressable
            onPress={() => { setMenuOpen(false); setConfirmDeleteOpen(true); }}
            style={styles.dropdownBtn}
          >
            <Text style={[styles.dropdownBtnText, { color: '#FF3B30' }]}>✕  Delete Habit</Text>
          </Pressable>
        </>
      )}
    </Animated.View>
  );

  return (
    <>
      {cardInner}

      {/* Confirmation dialog — custom modal so it works on web (Alert.alert is native-only) */}
      <Modal visible={confirmDeleteOpen} transparent animationType="fade">
        <View style={styles.confirmOverlay}>
          <View style={[styles.confirmBox, { backgroundColor: cardBg }]}>
            <Text style={[styles.confirmTitle, { color: colors.text }]}>Delete habit?</Text>
            <Text style={[styles.confirmBody, { color: colors.icon }]}>
              "{habit.name}" and all its history will be permanently removed.
            </Text>
            <View style={styles.confirmBtns}>
              <Pressable
                onPress={() => setConfirmDeleteOpen(false)}
                style={[styles.confirmBtn, { backgroundColor: scheme === 'dark' ? '#2C2C2E' : '#E5E5EA' }]}
              >
                <Text style={[styles.confirmBtnText, { color: colors.text }]}>No</Text>
              </Pressable>
              <Pressable
                onPress={handleDeleteYes}
                style={[styles.confirmBtn, { backgroundColor: '#FF3B30' }]}
              >
                <Text style={[styles.confirmBtnText, { color: '#fff' }]}>Yes, Delete</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={reminderOpen} transparent animationType="slide">
        <Pressable style={styles.overlay} onPress={() => setReminderOpen(false)} />
        <ReminderPickerSheet habit={habit} allHabits={allHabits} scheme={scheme} onClose={() => setReminderOpen(false)} />
      </Modal>
    </>
  );
}

// ─── Today Screen ─────────────────────────────────────────────────────────────

export default function TodayScreen() {
  const { habits, addHabit } = useHabits();
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const colors = Colors[scheme];
  const cardBg = scheme === 'dark' ? '#1C1C1E' : '#F2F2F7';
  const inputBg = scheme === 'dark' ? '#2C2C2E' : '#FFFFFF';
  const sheetBg = scheme === 'dark' ? '#1C1C1E' : '#F2F2F7';

  const [modalVisible, setModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('⭐');
  const [habitType, setHabitType] = useState<'binary' | 'volume'>('binary');
  const [targetCount, setTargetCount] = useState(3);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showStreakFire, setShowStreakFire] = useState(false);

  const overallStreak = useMemo(() => calcOverallStreak(habits), [habits]);
  const prevStreakRef = useRef(0);

  const completedCount = habits.filter(isTodayComplete).length;
  const total = habits.length;
  const progress = total > 0 ? completedCount / total : 0;
  const allDone = total > 0 && completedCount === total;

  const prevAllDone = useRef(false);
  const progressScale = useSharedValue(1);
  const celebrationOpacity = useSharedValue(0);

  useEffect(() => {
    if (allDone && !prevAllDone.current && total > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      progressScale.value = withSequence(
        withSpring(1.03, { damping: 14, stiffness: 200 }),
        withSpring(1, { damping: 18, stiffness: 200 })
      );
      celebrationOpacity.value = withSequence(
        withTiming(1, { duration: 200 }),
        withTiming(1, { duration: 2000 }),
        withTiming(0, { duration: 400 })
      );
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
    }
    prevAllDone.current = allDone;
  }, [allDone, total]);

  useEffect(() => {
    if (overallStreak >= 7 && prevStreakRef.current < 7) {
      setShowStreakFire(true);
      setShowConfetti(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => setShowStreakFire(false), 3500);
      setTimeout(() => setShowConfetti(false), 3000);
    }
    prevStreakRef.current = overallStreak;
  }, [overallStreak]);

  const animatedProgress = useAnimatedStyle(() => ({ transform: [{ scale: progressScale.value }] }));
  const animatedCelebration = useAnimatedStyle(() => ({ opacity: celebrationOpacity.value }));

  function handleAdd() {
    if (!newName.trim()) return;
    addHabit(newName.trim(), selectedEmoji, habitType, habitType === 'binary' ? 1 : targetCount);
    setNewName('');
    setSelectedEmoji('⭐');
    setHabitType('binary');
    setTargetCount(3);
    setModalVisible(false);
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>

        <Animated.View pointerEvents="none" style={[styles.celebrationBanner, animatedCelebration]}>
          <Text style={styles.celebrationText}>🎉 All habits done! Amazing!</Text>
        </Animated.View>

        <View style={styles.header}>
          <ThemedText type="title">{greeting()} 👋</ThemedText>
          <ThemedText style={{ color: colors.icon }}>{formatDate()}</ThemedText>
        </View>

        <StreakBar habits={habits} scheme={scheme} />

        <Animated.View style={[styles.progressCard, { backgroundColor: cardBg }, animatedProgress]}>
          <View style={styles.progressRow}>
            <ThemedText type="defaultSemiBold">
              {allDone ? '🎉 All done!' : `${completedCount} of ${total} complete`}
            </ThemedText>
            <ThemedText style={{ color: colors.icon }}>{Math.round(progress * 100)}%</ThemedText>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: colors.background }]}>
            <View style={[styles.progressFill, {
              width: `${progress * 100}%`,
              backgroundColor: allDone ? '#4CAF50' : colors.tint,
            }]} />
          </View>
        </Animated.View>

        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {habits.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>✨</Text>
              <ThemedText style={{ color: colors.icon }}>Add your first habit below</ThemedText>
            </View>
          ) : (
            habits.map((habit) => (
              <HabitCard
                key={habit.id}
                habit={habit}
                allHabits={habits}
                scheme={scheme}
                onComplete={() => {}}
              />
            ))
          )}
          <View style={{ height: 100 }} />
        </ScrollView>

        <Pressable style={[styles.fab, { backgroundColor: colors.tint }]} onPress={() => setModalVisible(true)}>
          <Text style={[styles.fabText, { color: scheme === 'dark' ? '#151718' : '#fff' }]}>+</Text>
        </Pressable>
      </SafeAreaView>

      <Confetti visible={showConfetti} />
      <FireCelebration visible={showStreakFire} title="🔥 7-Day Streak! 🔥" subtitle="Perfect week — you're unstoppable!" />

      <Modal visible={modalVisible} transparent animationType="slide">
        <Pressable style={styles.overlay} onPress={() => setModalVisible(false)} />
        <View style={[styles.sheet, { backgroundColor: sheetBg }]}>
          <ThemedText type="subtitle" style={styles.sheetTitle}>New Habit</ThemedText>

          <TextInput
            style={[styles.input, { backgroundColor: inputBg, color: colors.text, borderColor: colors.background }]}
            placeholder="Habit name…"
            placeholderTextColor={colors.icon}
            value={newName}
            onChangeText={setNewName}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleAdd}
          />

          <View style={[styles.typePicker, { backgroundColor: inputBg }]}>
            {(['binary', 'volume'] as const).map((t) => (
              <Pressable
                key={t}
                onPress={() => setHabitType(t)}
                style={[styles.typeBtn, habitType === t && { backgroundColor: colors.tint }]}>
                <Text style={[styles.typeBtnText, {
                  color: habitType === t ? (scheme === 'dark' ? '#151718' : '#fff') : colors.text,
                }]}>
                  {t === 'binary' ? '✓ Once a day' : '🔢 Multiple times'}
                </Text>
              </Pressable>
            ))}
          </View>

          {habitType === 'volume' && (
            <View style={styles.countStepper}>
              <ThemedText style={{ color: colors.icon, fontSize: 13 }}>Daily target</ThemedText>
              <View style={styles.stepperRow}>
                <Pressable onPress={() => setTargetCount((n) => Math.max(2, n - 1))}
                  style={[styles.stepBtn, { backgroundColor: cardBg }]}>
                  <Text style={[styles.stepBtnText, { color: colors.text }]}>−</Text>
                </Pressable>
                <Text style={[styles.stepCount, { color: colors.text }]}>{targetCount}×</Text>
                <Pressable onPress={() => setTargetCount((n) => Math.min(50, n + 1))}
                  style={[styles.stepBtn, { backgroundColor: colors.tint }]}>
                  <Text style={[styles.stepBtnText, { color: scheme === 'dark' ? '#151718' : '#fff' }]}>+</Text>
                </Pressable>
              </View>
            </View>
          )}

          <ThemedText style={{ color: colors.icon, fontSize: 13 }}>Pick an emoji</ThemedText>
          <View style={styles.emojiGrid}>
            {EMOJIS.map((e) => (
              <Pressable key={e} onPress={() => setSelectedEmoji(e)}
                style={[styles.emojiBtn, selectedEmoji === e && { backgroundColor: colors.tint }]}>
                <Text style={styles.emojiOption}>{e}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            style={[styles.addBtn, { backgroundColor: colors.tint }, !newName.trim() && styles.addBtnDisabled]}
            onPress={handleAdd}
            disabled={!newName.trim()}>
            <Text style={[styles.addBtnText, { color: scheme === 'dark' ? '#151718' : '#fff' }]}>Add Habit</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeArea: { flex: 1 },
  celebrationBanner: {
    position: 'absolute', top: 60, left: 20, right: 20, zIndex: 10,
    backgroundColor: '#4CAF50', borderRadius: 16, padding: 14, alignItems: 'center',
  },
  celebrationText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  progressCard: { marginHorizontal: 20, marginVertical: 8, padding: 16, borderRadius: 16, gap: 8 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 20, paddingTop: 8, gap: 10 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyEmoji: { fontSize: 48 },
  habitCard: { flexDirection: 'column', padding: 16, borderRadius: 16, overflow: 'hidden' },
  cardMainRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  glowOverlay: { borderRadius: 16, backgroundColor: '#4CAF50' },
  habitEmoji: { fontSize: 24, width: 32 },
  habitInfo: { flex: 1, gap: 4 },
  habitName: { fontSize: 16 },
  habitNameDone: { textDecorationLine: 'line-through' },
  streakRisk: { fontSize: 12, color: '#FF9500', fontWeight: '500' },
  reminderIndicator: { fontSize: 11, fontWeight: '500' },
  volumeBar: { height: 4, borderRadius: 2, overflow: 'hidden', marginTop: 2 },
  volumeBarFill: { height: '100%', borderRadius: 2 },
  menuToggle: { paddingLeft: 4, paddingVertical: 4, alignSelf: 'center' },
  menuArrow: { fontSize: 11, fontWeight: '700' },
  dropdownBtn: { paddingVertical: 12, paddingHorizontal: 0 },
  dropdownBtnText: { fontSize: 14, fontWeight: '600' },
  dropdownDivider: { height: 1, marginVertical: 4 },
  confirmOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center', padding: 28,
  },
  confirmBox: { borderRadius: 20, padding: 24, gap: 12, width: '100%', maxWidth: 360 },
  confirmTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  confirmBody: { fontSize: 14, textAlign: 'center', lineHeight: 21 },
  confirmBtns: { flexDirection: 'row', gap: 12, marginTop: 8 },
  confirmBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  confirmBtnText: { fontSize: 16, fontWeight: '600' },
  checkbox: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  checkmark: { color: '#fff', fontSize: 14, fontWeight: '700' },
  volumeControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  volBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  volBtnText: { fontSize: 20, fontWeight: '600', lineHeight: 24 },
  countText: { fontSize: 14, fontWeight: '600', minWidth: 36, textAlign: 'center' },
  fab: {
    position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5,
  },
  fabText: { fontSize: 28, lineHeight: 32 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { padding: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24, gap: 16 },
  sheetTitle: { textAlign: 'center' },
  input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 16 },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  emojiBtn: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  emojiOption: { fontSize: 22 },
  addBtn: { padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 4 },
  addBtnDisabled: { opacity: 0.4 },
  addBtnText: { fontWeight: '600', fontSize: 16 },
  typePicker: { flexDirection: 'row', borderRadius: 12, padding: 4, gap: 4 },
  typeBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  typeBtnText: { fontSize: 14, fontWeight: '600' },
  countStepper: { gap: 8 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  stepBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { fontSize: 20, fontWeight: '600' },
  stepCount: { fontSize: 22, fontWeight: '700', minWidth: 48, textAlign: 'center' },
});
