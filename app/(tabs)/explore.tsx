import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function last7Days(): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d;
  });
}

function last30Days(): Date[] {
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    return d;
  });
}

function completionRateForDay(habits: Habit[], date: Date): number {
  if (habits.length === 0) return 0;
  const key = localDateKey(date);
  const done = habits.filter((h) => {
    const c = h.completions.find((comp) => comp.date === key);
    return c && c.count >= h.targetCount;
  }).length;
  return done / habits.length;
}

// ─── Weekly Bar Chart ─────────────────────────────────────────────────────────

function WeeklyBarChart({ habits, scheme }: { habits: Habit[]; scheme: 'light' | 'dark' }) {
  const colors = Colors[scheme];
  const emptyBg = scheme === 'dark' ? '#3A3A3C' : '#E5E5EA';
  const days = last7Days();
  const today = localDateKey();

  return (
    <View style={chartStyles.container}>
      <View style={chartStyles.bars}>
        {days.map((d, i) => {
          const rate = completionRateForDay(habits, d);
          const isToday = localDateKey(d) === today;
          const hasData = rate > 0;
          const barColor = rate >= 1 ? '#4CAF50' : hasData ? colors.tint : emptyBg;
          const barHeight = hasData ? Math.max(rate * 100, 8) : 4;

          return (
            <View key={i} style={chartStyles.col}>
              <View style={[chartStyles.track, { backgroundColor: emptyBg }]}>
                <View style={[chartStyles.fill, { height: `${barHeight}%`, backgroundColor: barColor }]} />
              </View>
              <Text style={[chartStyles.label, { color: isToday ? colors.tint : colors.icon, fontWeight: isToday ? '700' : '400' }]}>
                {DAY_LABELS[d.getDay()]}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const chartStyles = StyleSheet.create({
  container: { paddingTop: 0 },
  bars: { flexDirection: 'row', gap: 6, height: 70, alignItems: 'flex-end' },
  col: { flex: 1, alignItems: 'center', gap: 4 },
  track: { flex: 1, width: '80%', borderRadius: 6, overflow: 'hidden', justifyContent: 'flex-end' },
  fill: { width: '100%', borderRadius: 6, minHeight: 4 },
  label: { fontSize: 11 },
});

// ─── Monthly Calendar (dots overview, no numbers) ──────────────────────────────

function MonthlyCalendar({ habits, scheme }: { habits: Habit[]; scheme: 'light' | 'dark' }) {
  const colors = Colors[scheme];
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  function getDayColor(day: number): string | null {
    const d = new Date(year, month, day);
    if (d > today) return null;
    const rate = completionRateForDay(habits, d);
    if (habits.length === 0) return scheme === 'dark' ? '#3A3A3C' : '#E5E5EA';
    if (rate === 0) return scheme === 'dark' ? '#3A3A3C' : '#E5E5EA';
    if (rate >= 1) return '#4CAF50';
    if (rate >= 0.5) return '#FF9500';
    return '#FF6B6B';
  }

  const todayDay = today.getDate();
  const emptyColor = scheme === 'dark' ? '#3A3A3C' : '#E5E5EA';

  return (
    <View style={calStyles.container}>
      <ThemedText type="defaultSemiBold" style={{ marginBottom: 8 }}>{monthName}</ThemedText>

      <View style={calStyles.row}>
        {DAY_LABELS.map((d) => (
          <Text key={d} style={[calStyles.dayHeader, { color: colors.icon }]}>{d}</Text>
        ))}
      </View>

      {Array.from({ length: cells.length / 7 }, (_, row) => (
        <View key={row} style={calStyles.row}>
          {cells.slice(row * 7, row * 7 + 7).map((day, col) => {
            if (!day) return <View key={col} style={calStyles.cell} />;
            const isToday = day === todayDay;
            const bg = getDayColor(day);
            return (
              <View
                key={col}
                style={[
                  calStyles.cell,
                  { backgroundColor: bg ?? 'transparent' },
                  isToday && calStyles.todayCell,
                ]}
              />
            );
          })}
        </View>
      ))}

      <View style={calStyles.legend}>
        {[
          { color: '#4CAF50', label: 'All done' },
          { color: '#FF9500', label: '≥50%' },
          { color: '#FF6B6B', label: '<50%' },
          { color: emptyColor, label: 'None' },
        ].map((item) => (
          <View key={item.label} style={calStyles.legendItem}>
            <View style={[calStyles.legendDot, { backgroundColor: item.color }]} />
            <Text style={[calStyles.legendLabel, { color: colors.icon }]}>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const calStyles = StyleSheet.create({
  container: { gap: 3 },
  row: { flexDirection: 'row', gap: 3 },
  dayHeader: { flex: 1, textAlign: 'center', fontSize: 9, fontWeight: '600', paddingVertical: 2 },
  cell: { flex: 1, aspectRatio: 1, borderRadius: 3 },
  todayCell: { borderWidth: 2, borderColor: '#0a7ea4' },
  legend: { flexDirection: 'row', gap: 10, marginTop: 6, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 10 },
});

// ─── Consistency Stats ────────────────────────────────────────────────────────

function ConsistencyStats({ habits, scheme }: { habits: Habit[]; scheme: 'light' | 'dark' }) {
  const colors = Colors[scheme];
  const cardBg = scheme === 'dark' ? '#1C1C1E' : '#F2F2F7';

  function consistencyFor(days: number): number {
    if (habits.length === 0) return 0;
    let total = 0;
    let done = 0;
    for (let i = 0; i < days; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const rate = completionRateForDay(habits, d);
      total++;
      if (rate >= 1) done++;
    }
    return total > 0 ? done / total : 0;
  }

  const stats = [
    { label: '7 days', value: consistencyFor(7) },
    { label: '30 days', value: consistencyFor(30) },
    { label: '90 days', value: consistencyFor(90) },
  ];

  return (
    <View style={conStyles.row}>
      {stats.map((s) => (
        <View key={s.label} style={[conStyles.card, { backgroundColor: cardBg }]}>
          <Text style={[conStyles.pct, { color: s.value >= 0.8 ? '#4CAF50' : s.value >= 0.5 ? '#FF9500' : colors.text }]}>
            {Math.round(s.value * 100)}%
          </Text>
          <ThemedText style={{ color: colors.icon, fontSize: 12 }}>{s.label}</ThemedText>
        </View>
      ))}
    </View>
  );
}

const conStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  card: { flex: 1, padding: 14, borderRadius: 14, alignItems: 'center', gap: 4 },
  pct: { fontSize: 22, fontWeight: '700' },
});

// ─── Progress Screen ──────────────────────────────────────────────────────────

export default function ProgressScreen() {
  const { habits } = useHabits();
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const colors = Colors[scheme];
  const cardBg = scheme === 'dark' ? '#1C1C1E' : '#F2F2F7';

  const [tab, setTab] = useState<'streaks' | 'history'>('streaks');

  const totalDone = habits.filter(isTodayComplete).length;
  const bestHabit = habits.reduce(
    (best, h) => (getStreak(h) > getStreak(best ?? h) ? h : best ?? h),
    null as Habit | null
  );

  function streakLabel(n: number): string {
    if (n === 0) return 'Start today!';
    if (n === 1) return '1 day';
    return `${n} days`;
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.content}>

          <View style={styles.header}>
            <ThemedText type="title">Progress 📊</ThemedText>
            <ThemedText style={{ color: colors.icon }}>Your consistency at a glance</ThemedText>
          </View>

          <View style={styles.summaryRow}>
            <View style={[styles.summaryCard, { backgroundColor: cardBg }]}>
              <Text style={[styles.summaryValue, { color: colors.text }]}>{totalDone}</Text>
              <ThemedText style={{ color: colors.icon, fontSize: 13 }}>Done today</ThemedText>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: cardBg }]}>
              <Text style={[styles.summaryValue, { color: colors.text }]}>{habits.length}</Text>
              <ThemedText style={{ color: colors.icon, fontSize: 13 }}>Total habits</ThemedText>
            </View>
            {bestHabit && (
              <View style={[styles.summaryCard, { backgroundColor: cardBg }]}>
                <Text style={styles.summaryValue}>{bestHabit.emoji}</Text>
                <ThemedText style={{ color: colors.icon, fontSize: 13 }} numberOfLines={1}>
                  Best {getStreak(bestHabit)}d streak
                </ThemedText>
              </View>
            )}
          </View>

          <ThemedText style={[styles.sectionLabel, { color: colors.icon }]}>CONSISTENCY</ThemedText>
          <ConsistencyStats habits={habits} scheme={scheme} />

          {/* Weekly chart */}
          <View style={[styles.chartCard, { backgroundColor: cardBg }]}>
            <ThemedText type="defaultSemiBold" style={styles.chartTitle}>This Week</ThemedText>
            <WeeklyBarChart habits={habits} scheme={scheme} />
          </View>

          {/* Monthly calendar widget — always visible */}
          <View style={[styles.chartCard, { backgroundColor: cardBg }]}>
            <MonthlyCalendar habits={habits} scheme={scheme} />
          </View>

          <View style={[styles.tabRow, { backgroundColor: cardBg }]}>
            {(['streaks', 'history'] as const).map((t) => {
              const labels = { streaks: '🔥 Streaks', history: '📋 History' };
              return (
                <Pressable
                  key={t}
                  onPress={() => setTab(t)}
                  style={[styles.tabBtn, tab === t && { backgroundColor: colors.tint }]}>
                  <Text style={[styles.tabBtnText, { color: tab === t ? (scheme === 'dark' ? '#151718' : '#fff') : colors.text }]}>
                    {labels[t]}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {tab === 'streaks' && (
            <>
              {habits.length === 0 ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyEmoji}>🌱</Text>
                  <ThemedText style={{ color: colors.icon }}>Add habits on the Today tab</ThemedText>
                </View>
              ) : (
                habits.map((habit) => {
                  const streak = getStreak(habit);
                  const count = getTodayCount(habit);
                  const flames =
                    streak >= 14 ? '🔥🔥🔥' : streak >= 7 ? '🔥🔥' : streak >= 1 ? '🔥' : '💤';
                  const weekRate = (() => {
                    let c = 0;
                    for (let i = 0; i < 7; i++) {
                      const d = new Date();
                      d.setDate(d.getDate() - i);
                      const comp = habit.completions.find((c) => c.date === localDateKey(d));
                      if (comp && comp.count >= habit.targetCount) c++;
                    }
                    return c / 7;
                  })();

                  return (
                    <View key={habit.id} style={[styles.habitRow, { backgroundColor: cardBg }]}>
                      <Text style={styles.habitEmoji}>{habit.emoji}</Text>
                      <View style={styles.habitInfo}>
                        <ThemedText type="defaultSemiBold">{habit.name}</ThemedText>
                        <View style={styles.weekGrid}>
                          {Array.from({ length: 7 }, (_, i) => {
                            const d = new Date();
                            d.setDate(d.getDate() - (6 - i));
                            const comp = habit.completions.find((c) => c.date === localDateKey(d));
                            const dayDone = comp && comp.count >= habit.targetCount;
                            return (
                              <View key={i} style={[styles.dot, {
                                backgroundColor: dayDone ? '#4CAF50' : scheme === 'dark' ? '#3A3A3C' : '#E5E5EA',
                              }]} />
                            );
                          })}
                        </View>
                        <Text style={{ color: colors.icon, fontSize: 13 }}>
                          {Math.round(weekRate * 100)}% this week
                          {habit.type === 'volume' ? ` · ${count}/${habit.targetCount} today` : ''}
                        </Text>
                      </View>
                      <View style={styles.streakBadge}>
                        <Text style={styles.flames}>{flames}</Text>
                        <ThemedText type="defaultSemiBold" style={{ fontSize: 13 }}>{streakLabel(streak)}</ThemedText>
                      </View>
                    </View>
                  );
                })
              )}
            </>
          )}

          {tab === 'history' && (
            <>
              {last30Days().reverse().map((d, i) => {
                const key = localDateKey(d);
                const doneHabits = habits.filter((h) => {
                  const c = h.completions.find((c) => c.date === key);
                  return c && c.count >= h.targetCount;
                });
                if (doneHabits.length === 0 && i > 7) return null;

                const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                const isToday = key === localDateKey();
                const allDone = doneHabits.length === habits.length && habits.length > 0;

                return (
                  <View key={key} style={[styles.logRow, { backgroundColor: cardBg }]}>
                    <View style={styles.logLeft}>
                      <Text style={[styles.logDate, { color: isToday ? colors.tint : colors.text }]}>
                        {isToday ? 'Today' : label}
                      </Text>
                      <Text style={[styles.logCount, { color: colors.icon }]}>
                        {doneHabits.length}/{habits.length} habits
                      </Text>
                    </View>
                    <View style={styles.logEmojis}>
                      {doneHabits.map((h) => (
                        <Text key={h.id} style={styles.logEmoji}>{h.emoji}</Text>
                      ))}
                      {doneHabits.length === 0 && (
                        <Text style={[styles.logCount, { color: colors.icon }]}>—</Text>
                      )}
                    </View>
                    {allDone && <Text style={styles.logStar}>⭐</Text>}
                  </View>
                );
              })}
            </>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeArea: { flex: 1 },
  content: { padding: 20, gap: 12 },
  header: { gap: 4, paddingTop: 8 },
  sectionLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 1, marginTop: 4 },

  summaryRow: { flexDirection: 'row', gap: 10 },
  summaryCard: { flex: 1, padding: 16, borderRadius: 16, alignItems: 'center', gap: 4 },
  summaryValue: { fontSize: 28, fontWeight: '700' },

  chartCard: { borderRadius: 16, padding: 16, gap: 8 },
  chartTitle: { marginBottom: 0 },

  tabRow: { flexDirection: 'row', borderRadius: 12, padding: 4, gap: 4 },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  tabBtnText: { fontSize: 13, fontWeight: '600' },

  empty: { alignItems: 'center', paddingTop: 40, gap: 8 },
  emptyEmoji: { fontSize: 48 },

  habitRow: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, gap: 12 },
  habitEmoji: { fontSize: 28, width: 36 },
  habitInfo: { flex: 1, gap: 6 },
  weekGrid: { flexDirection: 'row', gap: 4 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  streakBadge: { alignItems: 'center', gap: 2, minWidth: 56 },
  flames: { fontSize: 18 },

  logRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, gap: 12 },
  logLeft: { flex: 1, gap: 2 },
  logDate: { fontSize: 14, fontWeight: '600' },
  logCount: { fontSize: 12 },
  logEmojis: { flexDirection: 'row', gap: 2, flexWrap: 'wrap', maxWidth: 120, justifyContent: 'flex-end' },
  logEmoji: { fontSize: 18 },
  logStar: { fontSize: 16 },
});
