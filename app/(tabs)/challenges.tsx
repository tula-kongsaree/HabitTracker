import { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
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
import Svg, { Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { FireCelebration } from '@/components/fire-celebration';
import { Colors } from '@/constants/theme';
import {
  getChallengeProgress,
  isTodayComplete,
  localDateKey,
  useHabits,
  type Challenge,
} from '@/context/habits-context';

const DURATIONS = [3, 7, 14, 30];

function daysRemaining(challenge: Challenge): number {
  const start = new Date(challenge.startDate + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const elapsed = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, challenge.durationDays - elapsed - 1);
}

function isChallengeComplete(challenge: Challenge, progress: number): boolean {
  const start = new Date(challenge.startDate + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const elapsed = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return elapsed >= challenge.durationDays - 1 && progress >= 1;
}

// ─── SVG Progress Ring (animated from 0 on mount) ─────────────────────────────

function ProgressRing({ progress, size, color, label }: {
  progress: number; size: number; color: string; label: string;
}) {
  const [animPct, setAnimPct] = useState(0);

  useEffect(() => {
    const target = Math.min(Math.max(progress, 0), 1);
    let rafId: number;
    const start = Date.now();
    const duration = 1000;

    const tick = () => {
      const elapsed = Date.now() - start;
      const t = Math.min(elapsed / duration, 1);
      const eased = t < 1 ? 1 - Math.pow(1 - t, 3) : 1;
      setAnimPct(eased * target);
      if (t < 1) rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [progress]);

  const strokeWidth = size * 0.1;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - animPct);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke="rgba(150,150,150,0.25)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2},${size / 2}`}
        />
      </Svg>
      <Text style={{ fontSize: size * 0.2, fontWeight: '700', color }}>
        {`${Math.round(animPct * 100)}%`}
      </Text>
    </View>
  );
}

// ─── 3-Dot Menu Sheet ─────────────────────────────────────────────────────────

function ChallengeMenuSheet({ challenge, scheme, onClose }: {
  challenge: Challenge;
  scheme: 'light' | 'dark';
  onClose: () => void;
}) {
  const { deleteChallenge, updateChallengeDuration } = useHabits();
  const colors = Colors[scheme];
  const sheetBg = scheme === 'dark' ? '#1C1C1E' : '#F2F2F7';
  const cardBg = scheme === 'dark' ? '#2C2C2E' : '#FFFFFF';
  const [editMode, setEditMode] = useState(false);
  const [newDuration, setNewDuration] = useState(challenge.durationDays);

  function handleDelete() {
    deleteChallenge(challenge.id);
    onClose();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  }

  function handleSaveDuration() {
    updateChallengeDuration(challenge.id, newDuration);
    onClose();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }

  return (
    <View style={[menuStyles.sheet, { backgroundColor: sheetBg }]}>
      <View style={[menuStyles.handle, { backgroundColor: colors.icon }]} />
      <ThemedText type="subtitle" style={{ textAlign: 'center' }}>{challenge.name}</ThemedText>

      {!editMode ? (
        <>
          <Pressable style={[menuStyles.option, { backgroundColor: cardBg }]} onPress={() => setEditMode(true)}>
            <Text style={[menuStyles.optionIcon, { color: colors.tint }]}>✏️</Text>
            <Text style={[menuStyles.optionText, { color: colors.text }]}>Edit Duration</Text>
          </Pressable>

          <Pressable style={[menuStyles.option, menuStyles.dangerOption]} onPress={handleDelete}>
            <Text style={menuStyles.optionIcon}>🗑️</Text>
            <Text style={[menuStyles.optionText, menuStyles.dangerText]}>Delete Challenge</Text>
          </Pressable>

          <Pressable style={[menuStyles.cancelBtn, { backgroundColor: cardBg }]} onPress={onClose}>
            <Text style={[menuStyles.cancelText, { color: colors.text }]}>Cancel</Text>
          </Pressable>
        </>
      ) : (
        <>
          <ThemedText style={{ color: colors.icon, fontSize: 13, textAlign: 'center' }}>
            New duration (days)
          </ThemedText>
          <View style={menuStyles.durationRow}>
            {[3, 7, 14, 21, 30].map((d) => (
              <Pressable
                key={d}
                onPress={() => setNewDuration(d)}
                style={[
                  menuStyles.durationBtn,
                  { backgroundColor: cardBg },
                  newDuration === d && { backgroundColor: colors.tint },
                ]}>
                <Text style={[menuStyles.durationText, {
                  color: newDuration === d ? (scheme === 'dark' ? '#151718' : '#fff') : colors.text,
                }]}>{d}d</Text>
              </Pressable>
            ))}
          </View>
          <View style={menuStyles.editActions}>
            <Pressable style={[menuStyles.cancelBtn, { backgroundColor: cardBg, flex: 1 }]} onPress={() => setEditMode(false)}>
              <Text style={[menuStyles.cancelText, { color: colors.text }]}>Back</Text>
            </Pressable>
            <Pressable style={[menuStyles.saveBtn, { backgroundColor: colors.tint, flex: 1 }]} onPress={handleSaveDuration}>
              <Text style={[menuStyles.saveBtnText, { color: scheme === 'dark' ? '#151718' : '#fff' }]}>Save</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

const menuStyles = StyleSheet.create({
  sheet: { padding: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24, gap: 10, paddingBottom: 32 },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', opacity: 0.3, marginBottom: 4 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 14 },
  optionIcon: { fontSize: 20 },
  optionText: { fontSize: 16, fontWeight: '500' },
  dangerOption: { backgroundColor: '#FF3B3015' },
  dangerText: { color: '#FF3B30' },
  cancelBtn: { padding: 16, borderRadius: 14, alignItems: 'center' },
  cancelText: { fontSize: 16, fontWeight: '600' },
  durationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  durationBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, alignItems: 'center' },
  durationText: { fontWeight: '700', fontSize: 15 },
  editActions: { flexDirection: 'row', gap: 10 },
  saveBtn: { padding: 16, borderRadius: 14, alignItems: 'center' },
  saveBtnText: { fontSize: 16, fontWeight: '700' },
});

// ─── Challenge Card ───────────────────────────────────────────────────────────

function ChallengeCard({ challenge, scheme, onFireCelebration }: {
  challenge: Challenge;
  scheme: 'light' | 'dark';
  onFireCelebration: () => void;
}) {
  const { habits, completeChallenge } = useHabits();
  const colors = Colors[scheme];
  const cardBg = scheme === 'dark' ? '#1C1C1E' : '#F2F2F7';
  const [menuOpen, setMenuOpen] = useState(false);
  const didFire = useRef(false);

  const progress = getChallengeProgress(challenge, habits);
  const remaining = daysRemaining(challenge);
  const complete = isChallengeComplete(challenge, progress) && !challenge.completedAt;

  const cardScale = useSharedValue(1);
  const badgeOpacity = useSharedValue(challenge.completedAt ? 1 : 0);
  const badgeScale = useSharedValue(challenge.completedAt ? 1 : 0.5);

  useEffect(() => {
    if (complete && !didFire.current) {
      didFire.current = true;
      completeChallenge(challenge.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      cardScale.value = withSequence(
        withSpring(1.04, { damping: 14, stiffness: 220 }),
        withSpring(1, { damping: 18, stiffness: 220 })
      );
      badgeOpacity.value = withDelay(300, withTiming(1, { duration: 400 }));
      badgeScale.value = withDelay(300, withSpring(1, { damping: 8, stiffness: 200 }));
      onFireCelebration();
    }
  }, [complete]);

  const animatedCard = useAnimatedStyle(() => ({ transform: [{ scale: cardScale.value }] }));
  const animatedBadge = useAnimatedStyle(() => ({
    opacity: badgeOpacity.value,
    transform: [{ scale: badgeScale.value }],
  }));

  const habitNames = challenge.habitIds
    .map((id) => habits.find((h) => h.id === id)?.emoji ?? '')
    .join(' ');

  const ringColor = challenge.completedAt ? '#4CAF50' : colors.tint;
  const pctLabel = `${Math.round(progress * 100)}%`;

  // Status text for habit pills — clarifies it's today's status, not challenge-long
  const todayStatusLabel = (done: boolean) => done ? 'Today ✓' : 'Today —';

  return (
    <>
      <Animated.View style={[styles.challengeCard, { backgroundColor: cardBg }, animatedCard]}>
        <Pressable style={styles.dotMenuBtn} onPress={() => setMenuOpen(true)}>
          <Text style={[styles.dotMenuIcon, { color: colors.icon }]}>⋮</Text>
        </Pressable>

        {challenge.completedAt && (
          <Animated.View style={[styles.completedBadge, animatedBadge]}>
            <Text style={styles.completedBadgeText}>🏆 Completed!</Text>
          </Animated.View>
        )}

        <View style={styles.challengeTop}>
          <ProgressRing progress={progress} size={72} color={ringColor} label={pctLabel} />
          <View style={styles.challengeInfo}>
            <ThemedText type="defaultSemiBold" style={styles.challengeName}>
              {challenge.name}
            </ThemedText>
            <Text style={[styles.challengeMeta, { color: colors.icon }]}>{habitNames}</Text>
            <Text style={[styles.challengeMeta, { color: colors.icon }]}>
              {challenge.completedAt
                ? `Finished on ${challenge.completedAt}`
                : remaining === 0
                ? 'Last day!'
                : `${remaining} day${remaining !== 1 ? 's' : ''} left · ${challenge.durationDays}-day challenge`}
            </Text>
          </View>
        </View>

        <View style={styles.habitStatusRow}>
          {challenge.habitIds.map((id) => {
            const habit = habits.find((h) => h.id === id);
            if (!habit) return null;
            const done = isTodayComplete(habit);
            return (
              <View
                key={id}
                style={[
                  styles.habitStatusPill,
                  { backgroundColor: done ? '#4CAF5022' : `${colors.icon}22` },
                ]}>
                <Text style={styles.habitStatusEmoji}>{habit.emoji}</Text>
                <Text style={[styles.habitStatusText, { color: done ? '#4CAF50' : colors.icon }]}>
                  {todayStatusLabel(done)}
                </Text>
              </View>
            );
          })}
        </View>
      </Animated.View>

      <Modal visible={menuOpen} transparent animationType="slide">
        <Pressable style={styles.overlay} onPress={() => setMenuOpen(false)} />
        <ChallengeMenuSheet
          challenge={challenge}
          scheme={scheme}
          onClose={() => setMenuOpen(false)}
        />
      </Modal>
    </>
  );
}

// ─── Challenges Screen ────────────────────────────────────────────────────────

export default function ChallengesScreen() {
  const { habits, challenges, addChallenge } = useHabits();
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const colors = Colors[scheme];

  const cardBg = scheme === 'dark' ? '#1C1C1E' : '#F2F2F7';
  const inputBg = scheme === 'dark' ? '#2C2C2E' : '#FFFFFF';
  const sheetBg = scheme === 'dark' ? '#1C1C1E' : '#F2F2F7';

  const [modalVisible, setModalVisible] = useState(false);
  const [challengeName, setChallengeName] = useState('');
  const [selectedDuration, setSelectedDuration] = useState(7);
  const [selectedHabitIds, setSelectedHabitIds] = useState<string[]>([]);
  const [showFire, setShowFire] = useState(false);

  const active = challenges.filter((c) => !c.completedAt);
  const completed = challenges.filter((c) => !!c.completedAt);

  function triggerFire() {
    setShowFire(true);
    setTimeout(() => setShowFire(false), 3500);
  }

  function toggleHabit(id: string) {
    setSelectedHabitIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function handleCreate() {
    if (!challengeName.trim() || selectedHabitIds.length === 0) return;
    addChallenge(challengeName.trim(), selectedDuration, selectedHabitIds);
    setChallengeName('');
    setSelectedDuration(7);
    setSelectedHabitIds([]);
    setModalVisible(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <ThemedText type="title">Challenges 🏆</ThemedText>
            <ThemedText style={{ color: colors.icon }}>Commit to a streak, earn a reward</ThemedText>
          </View>

          {active.length > 0 && (
            <>
              <ThemedText style={[styles.sectionLabel, { color: colors.icon }]}>ACTIVE</ThemedText>
              {active.map((c) => (
                <ChallengeCard key={c.id} challenge={c} scheme={scheme} onFireCelebration={triggerFire} />
              ))}
            </>
          )}

          {challenges.length === 0 && (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🎯</Text>
              <ThemedText style={{ color: colors.icon, textAlign: 'center' }}>
                Start a challenge to push your habits further
              </ThemedText>
            </View>
          )}

          {completed.length > 0 && (
            <>
              <ThemedText style={[styles.sectionLabel, { color: colors.icon, marginTop: 8 }]}>COMPLETED</ThemedText>
              {completed.map((c) => (
                <ChallengeCard key={c.id} challenge={c} scheme={scheme} onFireCelebration={triggerFire} />
              ))}
            </>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>

        <Pressable
          style={[styles.startBtn, { backgroundColor: colors.tint }]}
          onPress={() => setModalVisible(true)}>
          <Text style={[styles.startBtnText, { color: scheme === 'dark' ? '#151718' : '#fff' }]}>
            + Start a Challenge
          </Text>
        </Pressable>
      </SafeAreaView>

      {/* Fire celebration on foreground — rendered outside SafeAreaView */}
      <FireCelebration visible={showFire} />

      <Modal visible={modalVisible} transparent animationType="slide">
        <Pressable style={styles.overlay} onPress={() => setModalVisible(false)} />
        <View style={[styles.sheet, { backgroundColor: sheetBg }]}>
          <ThemedText type="subtitle" style={styles.sheetTitle}>New Challenge</ThemedText>

          <TextInput
            style={[styles.input, { backgroundColor: inputBg, color: colors.text, borderColor: colors.background }]}
            placeholder="Challenge name…"
            placeholderTextColor={colors.icon}
            value={challengeName}
            onChangeText={setChallengeName}
            autoFocus
            returnKeyType="done"
          />

          <ThemedText style={{ color: colors.icon, fontSize: 13 }}>Duration</ThemedText>
          <View style={styles.durationRow}>
            {DURATIONS.map((d) => (
              <Pressable
                key={d}
                onPress={() => setSelectedDuration(d)}
                style={[
                  styles.durationBtn,
                  { backgroundColor: cardBg },
                  selectedDuration === d && { backgroundColor: colors.tint },
                ]}>
                <Text style={[
                  styles.durationText,
                  { color: selectedDuration === d ? (scheme === 'dark' ? '#151718' : '#fff') : colors.text },
                ]}>
                  {d}d
                </Text>
              </Pressable>
            ))}
          </View>

          <ThemedText style={{ color: colors.icon, fontSize: 13 }}>Include habits</ThemedText>
          {habits.length === 0 ? (
            <ThemedText style={{ color: colors.icon, fontSize: 13 }}>
              Add habits on the Today tab first
            </ThemedText>
          ) : (
            <View style={styles.habitPickerList}>
              {habits.map((h) => {
                const sel = selectedHabitIds.includes(h.id);
                return (
                  <Pressable
                    key={h.id}
                    onPress={() => toggleHabit(h.id)}
                    style={[
                      styles.habitPickerItem,
                      { backgroundColor: cardBg },
                      sel && { backgroundColor: `${colors.tint}33`, borderColor: colors.tint, borderWidth: 1.5 },
                    ]}>
                    <Text style={{ fontSize: 18 }}>{h.emoji}</Text>
                    <ThemedText style={{ fontSize: 14, flex: 1 }} numberOfLines={1}>{h.name}</ThemedText>
                    {sel && <Text style={{ color: colors.tint, fontWeight: '700' }}>✓</Text>}
                  </Pressable>
                );
              })}
            </View>
          )}

          <Pressable
            style={[
              styles.createBtn,
              { backgroundColor: colors.tint },
              (!challengeName.trim() || selectedHabitIds.length === 0) && styles.createBtnDisabled,
            ]}
            onPress={handleCreate}
            disabled={!challengeName.trim() || selectedHabitIds.length === 0}>
            <Text style={[styles.createBtnText, { color: scheme === 'dark' ? '#151718' : '#fff' }]}>
              Start {selectedDuration}-Day Challenge
            </Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeArea: { flex: 1 },
  content: { padding: 20, gap: 12 },
  header: { gap: 4, paddingTop: 8 },
  sectionLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 1 },

  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyEmoji: { fontSize: 56 },

  challengeCard: { borderRadius: 20, padding: 16, gap: 14, overflow: 'hidden' },
  dotMenuBtn: { position: 'absolute', top: 10, right: 12, padding: 8, zIndex: 5 },
  dotMenuIcon: { fontSize: 22, fontWeight: '700', lineHeight: 24 },
  completedBadge: {
    position: 'absolute', top: 12, right: 44,
    backgroundColor: '#4CAF50', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4,
  },
  completedBadgeText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  challengeTop: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  challengeInfo: { flex: 1, gap: 4 },
  challengeName: { fontSize: 16 },
  challengeMeta: { fontSize: 13 },

  habitStatusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  habitStatusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 },
  habitStatusEmoji: { fontSize: 16 },
  habitStatusText: { fontSize: 12, fontWeight: '600' },

  startBtn: {
    position: 'absolute', bottom: 24, left: 20, right: 20, padding: 18, borderRadius: 18, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 5,
  },
  startBtnText: { fontWeight: '700', fontSize: 16 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { padding: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24, gap: 14, maxHeight: '85%' },
  sheetTitle: { textAlign: 'center' },
  input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 16 },

  durationRow: { flexDirection: 'row', gap: 8 },
  durationBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  durationText: { fontWeight: '700', fontSize: 15 },

  habitPickerList: { gap: 8 },
  habitPickerItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1.5, borderColor: 'transparent' },

  createBtn: { padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 4 },
  createBtnDisabled: { opacity: 0.4 },
  createBtnText: { fontWeight: '700', fontSize: 16 },
});
