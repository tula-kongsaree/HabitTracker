import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
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

// ─── SVG Progress Ring ─────────────────────────────────────────────────────────

function ProgressRing({ progress, size, color }: {
  progress: number; size: number; color: string;
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
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(150,150,150,0.25)" strokeWidth={strokeWidth} fill="none" />
        <Circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={color} strokeWidth={strokeWidth} fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round" rotation="-90" origin={`${size / 2},${size / 2}`}
        />
      </Svg>
      <Text style={{ fontSize: size * 0.2, fontWeight: '700', color }}>
        {`${Math.round(animPct * 100)}%`}
      </Text>
    </View>
  );
}

// ─── Duration Wheel ────────────────────────────────────────────────────────────

const DURATION_OPTS = [3, 5, 7, 10, 14, 21, 30, 45, 60, 90];
const WHEEL_H = 48;

function DurationWheel({ value, onChange, scheme }: {
  value: number; onChange: (v: number) => void; scheme: 'light' | 'dark';
}) {
  const colors = Colors[scheme];
  const scrollRef = useRef<ScrollView>(null);
  const initIdx = DURATION_OPTS.indexOf(value);
  const [centeredIdx, setCenteredIdx] = useState(initIdx >= 0 ? initIdx : 2);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: centeredIdx * WHEEL_H, animated: false });
  }, []);

  function handleScroll(e: any) {
    const i = Math.max(0, Math.min(Math.round(e.nativeEvent.contentOffset.y / WHEEL_H), DURATION_OPTS.length - 1));
    setCenteredIdx(i);
    onChange(DURATION_OPTS[i]);
  }

  return (
    <View style={dwStyles.wrapper}>
      <View
        pointerEvents="none"
        style={[dwStyles.band, { top: WHEEL_H * 2, borderColor: colors.tint, backgroundColor: `${colors.tint}18` }]}
      />
      <ScrollView
        ref={scrollRef}
        style={{ height: WHEEL_H * 5 }}
        showsVerticalScrollIndicator={false}
        snapToInterval={WHEEL_H}
        decelerationRate="fast"
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingVertical: WHEEL_H * 2 }}
      >
        {DURATION_OPTS.map((d, i) => {
          const dist = Math.abs(i - centeredIdx);
          const isCentered = i === centeredIdx;
          return (
            <View key={d} style={{ height: WHEEL_H, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{
                fontSize: isCentered ? 22 : 17,
                fontWeight: isCentered ? '700' : '400',
                color: colors.text,
                opacity: dist === 0 ? 1 : dist === 1 ? 0.5 : dist === 2 ? 0.2 : 0.08,
              }}>
                {d} days
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const dwStyles = StyleSheet.create({
  wrapper: { position: 'relative', overflow: 'hidden', borderRadius: 12 },
  band: { position: 'absolute', left: 0, right: 0, height: WHEEL_H, borderTopWidth: 1, borderBottomWidth: 1, zIndex: 1 },
});

// ─── Challenge Card ────────────────────────────────────────────────────────────

function ChallengeCard({ challenge, scheme, onFireCelebration }: {
  challenge: Challenge; scheme: 'light' | 'dark'; onFireCelebration: () => void;
}) {
  const { habits, completeChallenge, deleteChallenge, updateChallengeDuration } = useHabits();
  const colors = Colors[scheme];
  const cardBg = scheme === 'dark' ? '#1C1C1E' : '#F2F2F7';
  const dividerColor = scheme === 'dark' ? '#3A3A3C' : '#E5E5EA';
  const btnBg = scheme === 'dark' ? '#2C2C2E' : '#E5E5EA';

  const [menuOpen, setMenuOpen] = useState(false);
  const [editDurationOpen, setEditDurationOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [wheelDuration, setWheelDuration] = useState(challenge.durationDays);

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

  const habitEmojis = challenge.habitIds
    .map((id) => habits.find((h) => h.id === id)?.emoji ?? '')
    .join(' ');

  const ringColor = challenge.completedAt ? '#4CAF50' : colors.tint;

  function handleMenuToggle() {
    if (menuOpen) setEditDurationOpen(false);
    setMenuOpen(m => !m);
  }

  function handleSaveDuration() {
    updateChallengeDuration(challenge.id, wheelDuration);
    setEditDurationOpen(false);
    setMenuOpen(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }

  function handleDeleteYes() {
    setConfirmDeleteOpen(false);
    deleteChallenge(challenge.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  }

  return (
    <>
      <Animated.View style={[cStyles.card, { backgroundColor: cardBg }, animatedCard]}>

        {/* Completed badge */}
        {challenge.completedAt && (
          <Animated.View style={[cStyles.completedBadge, animatedBadge]}>
            <Text style={cStyles.completedBadgeText}>🏆 Completed!</Text>
          </Animated.View>
        )}

        {/* Main row: ring + info */}
        <View style={cStyles.cardMain}>
          <ProgressRing progress={progress} size={72} color={ringColor} />
          <View style={cStyles.challengeInfo}>
            <ThemedText type="defaultSemiBold" style={cStyles.challengeName}>{challenge.name}</ThemedText>
            <Text style={[cStyles.challengeMeta, { color: colors.icon }]}>{habitEmojis}</Text>
            <Text style={[cStyles.challengeMeta, { color: colors.icon }]}>
              {challenge.completedAt
                ? `Finished on ${challenge.completedAt}`
                : remaining === 0
                ? 'Last day!'
                : `${remaining} day${remaining !== 1 ? 's' : ''} left · ${challenge.durationDays}-day challenge`}
            </Text>
          </View>
        </View>

        {/* Today habit status pills */}
        <View style={cStyles.habitStatusRow}>
          {challenge.habitIds.map((id) => {
            const habit = habits.find((h) => h.id === id);
            if (!habit) return null;
            const done = isTodayComplete(habit);
            return (
              <View key={id} style={[cStyles.habitStatusPill, { backgroundColor: done ? '#4CAF5022' : `${colors.icon}22` }]}>
                <Text style={cStyles.habitStatusEmoji}>{habit.emoji}</Text>
                <Text style={[cStyles.habitStatusText, { color: done ? '#4CAF50' : colors.icon }]}>
                  {done ? 'Today ✓' : 'Today —'}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Dropdown toggle — same design as habit cards */}
        <Pressable onPress={handleMenuToggle} style={cStyles.menuToggleRow} hitSlop={6}>
          <Text style={[cStyles.menuArrow, { color: colors.icon }]}>{menuOpen ? '▲' : '▼'}</Text>
        </Pressable>

        {/* Dropdown: main options */}
        {menuOpen && !editDurationOpen && (
          <>
            <View style={[cStyles.divider, { backgroundColor: dividerColor }]} />
            <Pressable onPress={() => setEditDurationOpen(true)} style={cStyles.dropdownBtn}>
              <Text style={[cStyles.dropdownBtnText, { color: colors.tint }]}>✏️  Edit Duration</Text>
            </Pressable>
            <View style={[cStyles.divider, { backgroundColor: dividerColor }]} />
            <Pressable onPress={() => { setMenuOpen(false); setConfirmDeleteOpen(true); }} style={cStyles.dropdownBtn}>
              <Text style={[cStyles.dropdownBtnText, { color: '#FF3B30' }]}>✕  Delete Challenge</Text>
            </Pressable>
          </>
        )}

        {/* Dropdown: duration wheel */}
        {menuOpen && editDurationOpen && (
          <>
            <View style={[cStyles.divider, { backgroundColor: dividerColor }]} />
            <DurationWheel value={wheelDuration} onChange={setWheelDuration} scheme={scheme} />
            <View style={cStyles.editActionRow}>
              <Pressable onPress={() => setEditDurationOpen(false)} style={[cStyles.editBtn, { backgroundColor: btnBg, flex: 1 }]}>
                <Text style={[cStyles.editBtnText, { color: colors.text }]}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleSaveDuration} style={[cStyles.editBtn, { backgroundColor: colors.tint, flex: 2 }]}>
                <Text style={[cStyles.editBtnText, { color: scheme === 'dark' ? '#151718' : '#fff' }]}>
                  Save · {wheelDuration} days
                </Text>
              </Pressable>
            </View>
          </>
        )}
      </Animated.View>

      {/* Delete confirmation */}
      <Modal visible={confirmDeleteOpen} transparent animationType="fade">
        <View style={cStyles.confirmOverlay}>
          <View style={[cStyles.confirmBox, { backgroundColor: cardBg }]}>
            <Text style={[cStyles.confirmTitle, { color: colors.text }]}>Delete challenge?</Text>
            <Text style={[cStyles.confirmBody, { color: colors.icon }]}>
              "{challenge.name}" will be permanently removed.
            </Text>
            <View style={cStyles.confirmBtns}>
              <Pressable onPress={() => setConfirmDeleteOpen(false)} style={[cStyles.confirmBtn, { backgroundColor: btnBg }]}>
                <Text style={[cStyles.confirmBtnText, { color: colors.text }]}>No</Text>
              </Pressable>
              <Pressable onPress={handleDeleteYes} style={[cStyles.confirmBtn, { backgroundColor: '#FF3B30' }]}>
                <Text style={[cStyles.confirmBtnText, { color: '#fff' }]}>Yes, Delete</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const cStyles = StyleSheet.create({
  card: { borderRadius: 20, padding: 16, gap: 12 },
  completedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#4CAF50', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4,
  },
  completedBadgeText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  cardMain: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  challengeInfo: { flex: 1, gap: 4 },
  challengeName: { fontSize: 16 },
  challengeMeta: { fontSize: 13 },
  habitStatusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  habitStatusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 },
  habitStatusEmoji: { fontSize: 16 },
  habitStatusText: { fontSize: 12, fontWeight: '600' },
  menuToggleRow: { alignItems: 'center', paddingVertical: 2 },
  menuArrow: { fontSize: 11, fontWeight: '700' },
  divider: { height: 1 },
  dropdownBtn: { paddingVertical: 12 },
  dropdownBtnText: { fontSize: 14, fontWeight: '600' },
  editActionRow: { flexDirection: 'row', gap: 10 },
  editBtn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  editBtnText: { fontSize: 15, fontWeight: '600' },
  confirmOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  confirmBox: { borderRadius: 20, padding: 24, gap: 12, width: '100%', maxWidth: 360 },
  confirmTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  confirmBody: { fontSize: 14, textAlign: 'center', lineHeight: 21 },
  confirmBtns: { flexDirection: 'row', gap: 12, marginTop: 8 },
  confirmBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  confirmBtnText: { fontSize: 16, fontWeight: '600' },
});

// ─── Challenges Screen ─────────────────────────────────────────────────────────

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

      <FireCelebration visible={showFire} />

      <Modal visible={modalVisible} transparent animationType="slide">
        <Pressable style={styles.overlay} onPress={() => setModalVisible(false)} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
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
                  style={[styles.durationBtn, { backgroundColor: cardBg }, selectedDuration === d && { backgroundColor: colors.tint }]}>
                  <Text style={[styles.durationText, { color: selectedDuration === d ? (scheme === 'dark' ? '#151718' : '#fff') : colors.text }]}>
                    {d}d
                  </Text>
                </Pressable>
              ))}
            </View>

            <ThemedText style={{ color: colors.icon, fontSize: 13 }}>Include habits</ThemedText>
            {habits.length === 0 ? (
              <ThemedText style={{ color: colors.icon, fontSize: 13 }}>Add habits on the Today tab first</ThemedText>
            ) : (
              <ScrollView
                style={{ maxHeight: 220 }}
                contentContainerStyle={styles.habitPickerList}
                nestedScrollEnabled
                showsVerticalScrollIndicator={false}
              >
                {habits.map((h) => {
                  const sel = selectedHabitIds.includes(h.id);
                  return (
                    <Pressable
                      key={h.id}
                      onPress={() => toggleHabit(h.id)}
                      style={[styles.habitPickerItem, { backgroundColor: cardBg }, sel && { backgroundColor: `${colors.tint}33`, borderColor: colors.tint, borderWidth: 1.5 }]}>
                      <Text style={{ fontSize: 18 }}>{h.emoji}</Text>
                      <ThemedText style={{ fontSize: 14, flex: 1 }} numberOfLines={1}>{h.name}</ThemedText>
                      {sel && <Text style={{ color: colors.tint, fontWeight: '700' }}>✓</Text>}
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}

            <Pressable
              style={[styles.createBtn, { backgroundColor: colors.tint }, (!challengeName.trim() || selectedHabitIds.length === 0) && styles.createBtnDisabled]}
              onPress={handleCreate}
              disabled={!challengeName.trim() || selectedHabitIds.length === 0}>
              <Text style={[styles.createBtnText, { color: scheme === 'dark' ? '#151718' : '#fff' }]}>
                Start {selectedDuration}-Day Challenge
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
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
