import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { FireCelebration } from '@/components/fire-celebration';
import { Colors } from '@/constants/theme';
import {
  getChallengeProgress,
  getCompletionForDate,
  getStreak,
  isTodayComplete,
  localDateKey,
  useHabits,
  type Challenge,
} from '@/context/habits-context';

const PAST_DAYS = 14;
const FUTURE_DAYS = 7;
const DATE_CELL_W = 48;
const ROW_H = 44;

function getDateRange(): string[] {
  const dates: string[] = [];
  for (let i = PAST_DAYS; i >= -FUTURE_DAYS; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(localDateKey(d));
  }
  return dates;
}

function shortDate(dateKey: string): string {
  const d = new Date(dateKey + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
}

function dayLabel(dateKey: string): string {
  const d = new Date(dateKey + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}

export default function DevScreen() {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const colors = Colors[scheme];
  const cardBg = scheme === 'dark' ? '#1C1C1E' : '#F2F2F7';
  const cellBg = scheme === 'dark' ? '#2C2C2E' : '#FFFFFF';
  const {
    habits, challenges,
    increment, decrement,
    toggleHistoricalCompletion,
    completeChallenge,
    updateChallengeStartDate,
    resetAll,
  } = useHabits();

  const today = localDateKey();
  const dateRange = getDateRange();

  const [showFire, setShowFire] = useState(false);

  function triggerFire() {
    setShowFire(true);
    setTimeout(() => setShowFire(false), 3500);
  }

  function completeAllToday() {
    for (const habit of habits) {
      if (!isTodayComplete(habit)) {
        const needed = habit.targetCount - (habit.completions.find((c) => c.date === today)?.count ?? 0);
        for (let i = 0; i < needed; i++) increment(habit.id);
      }
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  function resetToday() {
    for (const habit of habits) {
      const count = habit.completions.find((c) => c.date === today)?.count ?? 0;
      for (let i = 0; i < count; i++) decrement(habit.id);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  }

  async function handleRestartOnboarding() {
    resetAll();
    await AsyncStorage.removeItem('onboarded_v2');
    await AsyncStorage.removeItem('habits_v4');
    await AsyncStorage.removeItem('challenges_v2');
    router.replace('/onboarding');
  }

  function fillAllCells() {
    for (const d of dateRange) {
      for (const habit of habits) {
        if (!getCompletionForDate(habit, d)) {
          toggleHistoricalCompletion(habit.id, d);
        }
      }
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  function simulateChallengeCompletion(c: Challenge) {
    const newStart = new Date();
    newStart.setDate(newStart.getDate() - c.durationDays);
    const newStartKey = localDateKey(newStart);
    updateChallengeStartDate(c.id, newStartKey);
    for (let i = 0; i < c.durationDays; i++) {
      const d = new Date(newStart);
      d.setDate(d.getDate() + i);
      const dateKey = localDateKey(d);
      for (const habitId of c.habitIds) {
        const habit = habits.find(h => h.id === habitId);
        if (!habit) continue;
        if (!getCompletionForDate(habit, dateKey)) toggleHistoricalCompletion(habitId, dateKey);
      }
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  function forceCompleteChallenge(c: Challenge) {
    if (!c.completedAt) completeChallenge(c.id);
    triggerFire();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <FireCelebration visible={showFire} />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.content}>

          <View style={styles.header}>
            <ThemedText type="title">Dev Tools 🔧</ThemedText>
            <ThemedText style={{ color: colors.icon }}>Testing utilities — not visible to end users</ThemedText>
          </View>

          <View style={[styles.card, { backgroundColor: cardBg }]}>
            <ThemedText type="defaultSemiBold">Current Date</ThemedText>
            <Text style={[styles.mono, { color: colors.tint }]}>{today}</Text>
            <Text style={{ color: colors.icon, fontSize: 13 }}>
              {new Date().toLocaleString('en-US', { weekday: 'long', hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>

          {/* Today actions */}
          <ThemedText style={[styles.sectionLabel, { color: colors.icon }]}>TODAY</ThemedText>
          <View style={styles.actionRow}>
            <Pressable style={[styles.actionBtn, { backgroundColor: '#4CAF50' }]} onPress={completeAllToday}>
              <Text style={styles.actionBtnText}>✓ Complete All</Text>
            </Pressable>
            <Pressable style={[styles.actionBtn, { backgroundColor: '#FF3B30' }]} onPress={resetToday}>
              <Text style={styles.actionBtnText}>↺ Reset Today</Text>
            </Pressable>
          </View>

          {/* Animations */}
          <ThemedText style={[styles.sectionLabel, { color: colors.icon }]}>ANIMATIONS</ThemedText>
          <Pressable style={[styles.soloBtn, { backgroundColor: '#FF6B00' }]} onPress={triggerFire}>
            <Text style={styles.actionBtnText}>🔥 Test Fire Celebration</Text>
          </Pressable>

          {/* App reset */}
          <ThemedText style={[styles.sectionLabel, { color: colors.icon }]}>APP RESET</ThemedText>
          <Pressable style={[styles.soloBtn, { backgroundColor: colors.tint }]} onPress={handleRestartOnboarding}>
            <Text style={[styles.actionBtnText, { color: scheme === 'dark' ? '#151718' : '#fff' }]}>
              ↩ Restart from Onboarding
            </Text>
          </Pressable>

          {/* Habit completion calendar — horizontally scrollable */}
          <ThemedText style={[styles.sectionLabel, { color: colors.icon }]}>HABIT CALENDAR — PAST {PAST_DAYS} + FUTURE {FUTURE_DAYS} DAYS</ThemedText>
          <ThemedText style={{ color: colors.icon, fontSize: 12, marginBottom: 4 }}>
            Tap any cell to toggle. Future cells (blue tint) let you pre-fill habits to trigger challenge events.
          </ThemedText>
          <Pressable style={[styles.soloBtn, { backgroundColor: '#4CAF50' }]} onPress={fillAllCells}>
            <Text style={styles.actionBtnText}>✓ Fill All Calendar Cells</Text>
          </Pressable>

          {habits.length === 0 ? (
            <View style={[styles.card, { backgroundColor: cardBg }]}>
              <ThemedText style={{ color: colors.icon }}>Add habits on the Today tab first.</ThemedText>
            </View>
          ) : (
            <View style={[styles.calendarCard, { backgroundColor: cardBg }]}>
              <View style={{ flexDirection: 'row' }}>

                {/* Fixed habit-name column */}
                <View style={styles.nameCol}>
                  <View style={[styles.nameHeaderCell, { borderBottomColor: `${colors.icon}20` }]}>
                    <Text style={[styles.calendarHeaderText, { color: colors.icon }]}>Habit</Text>
                  </View>
                  {habits.map((habit, idx) => (
                    <View
                      key={habit.id}
                      style={[
                        styles.nameCell,
                        { borderBottomColor: `${colors.icon}15` },
                        idx < habits.length - 1 && styles.nameCellBorder,
                      ]}>
                      <Text numberOfLines={1} style={[styles.calendarHabitText, { color: colors.text }]}>
                        {habit.emoji} {habit.name.split(' ')[0]}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Horizontally scrollable date columns */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
                  <View>
                    {/* Date header row */}
                    <View style={[styles.dateRow, { borderBottomColor: `${colors.icon}20`, borderBottomWidth: 1 }]}>
                      {dateRange.map((d) => {
                        const isFuture = d > today;
                        return (
                          <View key={d} style={[styles.dateHeaderCell, { width: DATE_CELL_W }]}>
                            <Text style={[styles.calendarDayText, { color: isFuture ? colors.tint : colors.icon }]}>
                              {dayLabel(d)}
                            </Text>
                            <Text style={[styles.calendarDateText, {
                              color: d === today ? colors.tint : isFuture ? `${colors.tint}99` : colors.icon,
                              fontWeight: d === today ? '700' : '400',
                            }]}>
                              {shortDate(d)}
                            </Text>
                          </View>
                        );
                      })}
                    </View>

                    {/* Habit rows */}
                    {habits.map((habit, idx) => (
                      <View
                        key={habit.id}
                        style={[
                          styles.dateRow,
                          idx < habits.length - 1 && { borderBottomWidth: 1, borderBottomColor: `${colors.icon}15` },
                        ]}>
                        {dateRange.map((d) => {
                          const done = getCompletionForDate(habit, d);
                          const isToday = d === today;
                          const isFuture = d > today;
                          return (
                            <Pressable
                              key={d}
                              onPress={() => {
                                toggleHistoricalCompletion(habit.id, d);
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              }}
                              style={[
                                styles.dateCell,
                                { width: DATE_CELL_W - 6, backgroundColor: done ? '#4CAF5033' : cellBg },
                                isToday && { borderWidth: 1.5, borderColor: colors.tint },
                                isFuture && !done && { backgroundColor: `${colors.tint}12` },
                                done && { borderColor: '#4CAF50', borderWidth: 1 },
                              ]}>
                              <Text style={[{ fontSize: 14 }, done && { color: '#4CAF50' }]}>
                                {done ? '✓' : '·'}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    ))}
                  </View>
                </ScrollView>
              </View>
            </View>
          )}

          {/* Habit state */}
          <ThemedText style={[styles.sectionLabel, { color: colors.icon }]}>HABIT STATE</ThemedText>
          {habits.map((habit) => {
            const streak = getStreak(habit);
            const done = isTodayComplete(habit);
            const count = habit.completions.find((c) => c.date === today)?.count ?? 0;
            return (
              <View key={habit.id} style={[styles.card, { backgroundColor: cardBg }]}>
                <View style={styles.habitHeader}>
                  <Text style={{ fontSize: 22 }}>{habit.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <ThemedText type="defaultSemiBold">{habit.name}</ThemedText>
                    <Text style={{ color: colors.icon, fontSize: 12 }}>
                      {habit.type} · target {habit.targetCount}
                    </Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: done ? '#4CAF50' : cardBg }]}>
                    <Text style={{ color: done ? '#fff' : colors.icon, fontSize: 12, fontWeight: '600' }}>
                      {done ? '✓ Done' : `${count}/${habit.targetCount}`}
                    </Text>
                  </View>
                </View>
                <View style={styles.metaRow}>
                  <Text style={[styles.metaItem, { color: colors.icon }]}>🔥 Streak: {streak}d</Text>
                  <Text style={[styles.metaItem, { color: colors.icon }]}>
                    📅 Total: {habit.completions.length} days
                  </Text>
                  {habit.reminderTimes.length > 0 && (
                    <Text style={[styles.metaItem, { color: colors.tint }]}>
                      🔔 {habit.reminderTimes.join(', ')}
                    </Text>
                  )}
                </View>
                <Text style={[styles.mono, { color: colors.icon, fontSize: 11 }]} numberOfLines={2}>
                  id: {habit.id} · created: {habit.createdAt}
                </Text>
              </View>
            );
          })}

          {/* Challenge state + controls */}
          {challenges.length > 0 && (
            <>
              <ThemedText style={[styles.sectionLabel, { color: colors.icon }]}>CHALLENGE STATE</ThemedText>
              {challenges.map((c) => {
                const progress = getChallengeProgress(c, habits);
                const start = new Date(c.startDate + 'T00:00:00');
                const now = new Date();
                now.setHours(0, 0, 0, 0);
                const elapsed = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                return (
                  <View key={c.id} style={[styles.card, { backgroundColor: cardBg }]}>
                    <ThemedText type="defaultSemiBold">{c.name}</ThemedText>
                    <View style={styles.metaRow}>
                      <Text style={[styles.metaItem, { color: colors.icon }]}>Duration: {c.durationDays}d</Text>
                      <Text style={[styles.metaItem, { color: colors.icon }]}>Start: {c.startDate}</Text>
                      <Text style={[styles.metaItem, { color: colors.icon }]}>Elapsed: {elapsed}d</Text>
                      <Text style={[styles.metaItem, { color: colors.tint }]}>
                        Progress: {Math.round(progress * 100)}%
                      </Text>
                      {c.completedAt && (
                        <Text style={[styles.metaItem, { color: '#4CAF50' }]}>✓ Completed: {c.completedAt}</Text>
                      )}
                    </View>
                    <Text style={[styles.mono, { color: colors.icon, fontSize: 11 }]}>
                      habits: {c.habitIds.join(', ')}
                    </Text>
                    {!c.completedAt && (
                      <View style={styles.challengeActions}>
                        <Pressable
                          style={[styles.challengeBtn, { backgroundColor: colors.tint }]}
                          onPress={() => simulateChallengeCompletion(c)}>
                          <Text style={[styles.challengeBtnText, { color: scheme === 'dark' ? '#151718' : '#fff' }]}>
                            🎯 Simulate (fills habits + backdates)
                          </Text>
                        </Pressable>
                        <Pressable
                          style={[styles.challengeBtn, { backgroundColor: '#FF6B00' }]}
                          onPress={() => forceCompleteChallenge(c)}>
                          <Text style={styles.challengeBtnText}>🔥 Force Complete + Fire</Text>
                        </Pressable>
                      </View>
                    )}
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
  card: { borderRadius: 16, padding: 16, gap: 8 },
  mono: { fontFamily: 'monospace', fontSize: 12 },
  habitHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metaItem: { fontSize: 12 },
  actionRow: { flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  soloBtn: { padding: 14, borderRadius: 12, alignItems: 'center' },

  challengeActions: { gap: 8, marginTop: 4 },
  challengeBtn: { padding: 12, borderRadius: 10, alignItems: 'center' },
  challengeBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  // Calendar — fixed name column + horizontal scroll
  calendarCard: { borderRadius: 16, overflow: 'hidden' },
  nameCol: { width: 80, borderRightWidth: 1, borderRightColor: 'rgba(150,150,150,0.2)' },
  nameHeaderCell: { height: ROW_H, justifyContent: 'center', padding: 8, borderBottomWidth: 1 },
  nameCell: { height: ROW_H, justifyContent: 'center', padding: 8 },
  nameCellBorder: { borderBottomWidth: 1 },
  calendarHeaderText: { fontSize: 11, fontWeight: '600' },
  calendarHabitText: { fontSize: 11, fontWeight: '500' },
  dateRow: { flexDirection: 'row', alignItems: 'center', height: ROW_H },
  dateHeaderCell: { alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
  calendarDayText: { fontSize: 9, fontWeight: '600' },
  calendarDateText: { fontSize: 10 },
  dateCell: { height: ROW_H - 6, margin: 3, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
});
