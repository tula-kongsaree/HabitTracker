import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { useHabits } from '@/context/habits-context';

const PRESET_HABITS = [
  { id: 'p1', emoji: '💧', name: 'Drink 8 glasses of water', type: 'volume' as const, targetCount: 8 },
  { id: 'p2', emoji: '🏃', name: 'Exercise 30 min', type: 'binary' as const, targetCount: 1 },
  { id: 'p3', emoji: '📚', name: 'Read 20 pages', type: 'binary' as const, targetCount: 1 },
  { id: 'p4', emoji: '🧘', name: 'Meditate', type: 'binary' as const, targetCount: 1 },
  { id: 'p5', emoji: '😴', name: 'Sleep 8 hours', type: 'binary' as const, targetCount: 1 },
  { id: 'p6', emoji: '🥗', name: 'Eat healthy', type: 'binary' as const, targetCount: 1 },
  { id: 'p7', emoji: '✍️', name: 'Journal', type: 'binary' as const, targetCount: 1 },
  { id: 'p8', emoji: '💊', name: 'Take vitamins', type: 'binary' as const, targetCount: 1 },
  { id: 'p9', emoji: '🦷', name: 'Brush teeth', type: 'binary' as const, targetCount: 1 },
  { id: 'p10', emoji: '🧹', name: 'Tidy up', type: 'binary' as const, targetCount: 1 },
];

const DAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
// Sample weekly data for the onboarding preview
const SAMPLE_RATES = [1, 0.6, 1, 0.3, 1, 1, 0.5];

function SampleWeeklyChart({ scheme }: { scheme: 'light' | 'dark' }) {
  const colors = Colors[scheme];
  const emptyBg = scheme === 'dark' ? '#3A3A3C' : '#E5E5EA';

  return (
    <View style={chartStyles.wrapper}>
      <Text style={[chartStyles.title, { color: colors.text }]}>This Week</Text>
      <View style={chartStyles.bars}>
        {SAMPLE_RATES.map((rate, i) => {
          const barColor = rate >= 1 ? '#4CAF50' : rate >= 0.5 ? colors.tint : '#FF6B6B';
          const barHeight = Math.max(rate * 100, 8);
          const isToday = i === 5;
          return (
            <View key={i} style={chartStyles.col}>
              <View style={chartStyles.track}>
                <View style={[chartStyles.fill, { height: `${barHeight}%`, backgroundColor: barColor }]} />
              </View>
              <Text style={[chartStyles.label, { color: isToday ? colors.tint : colors.icon, fontWeight: isToday ? '700' : '400' }]}>
                {DAY_LABELS[i]}
              </Text>
            </View>
          );
        })}
      </View>
      <View style={chartStyles.legend}>
        {[
          { color: '#4CAF50', label: 'All done' },
          { color: colors.tint, label: 'Partial' },
          { color: '#FF6B6B', label: 'Low' },
          { color: emptyBg, label: 'None' },
        ].map((item) => (
          <View key={item.label} style={chartStyles.legendItem}>
            <View style={[chartStyles.legendDot, { backgroundColor: item.color }]} />
            <Text style={[chartStyles.legendText, { color: colors.icon }]}>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const chartStyles = StyleSheet.create({
  wrapper: { gap: 10 },
  title: { fontSize: 15, fontWeight: '700' },
  bars: { flexDirection: 'row', gap: 8, height: 80, alignItems: 'flex-end' },
  col: { flex: 1, alignItems: 'center', gap: 4 },
  track: { flex: 1, width: '80%', borderRadius: 6, overflow: 'hidden', justifyContent: 'flex-end' },
  fill: { width: '100%', borderRadius: 6, minHeight: 4 },
  label: { fontSize: 11 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11 },
});

const STEPS = [
  {
    emoji: '👋',
    title: 'Welcome to HabitFlow',
    body: 'Build powerful daily habits — one check-in at a time. Track your progress, maintain streaks, and grow consistency over weeks and months.',
  },
  {
    emoji: '✅',
    title: 'Two types of habits',
    body: 'Once-a-day habits are simple taps. Volume habits let you log multiple reps — like drinking 8 glasses of water.',
    cards: [
      { icon: '✓', label: 'Once a day', desc: 'Tap to complete — perfect for workouts, meditation, reading.' },
      { icon: '🔢', label: 'Multiple times', desc: 'Set a daily target and tap + each time you complete a rep.' },
    ],
  },
  {
    emoji: '🏆',
    title: 'Challenges & streaks',
    body: 'Commit to a 3, 7, 14, or 30-day challenge. Complete it and earn a fire milestone. Streaks keep you motivated day after day.',
    cards: [
      { icon: '🔥', label: 'Streaks', desc: 'Miss a day and your streak resets — stay consistent!' },
      { icon: '🎯', label: 'Challenges', desc: 'Pick habits and a duration. Hit 100% to unlock your badge.' },
    ],
  },
  {
    emoji: '📊',
    title: 'Track your progress',
    body: 'The Progress tab shows your weekly chart, monthly calendar, and consistency stats — so you can see growth over time.',
    showChart: true,
  },
  {
    emoji: '🎯',
    title: 'Pick your first habits',
    body: 'Choose habits to start tracking today. You can always add more or remove any from the Today tab.',
    showHabitPicker: true,
  },
];

export default function OnboardingScreen() {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const colors = Colors[scheme];
  const cardBg = scheme === 'dark' ? '#1C1C1E' : '#F2F2F7';
  const [step, setStep] = useState(0);
  const [selectedPresets, setSelectedPresets] = useState<string[]>([]);
  const { addHabit } = useHabits();

  const current = STEPS[step] as any;
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;

  function togglePreset(id: string) {
    setSelectedPresets(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  async function handleNext() {
    if (isLast) {
      for (const presetId of selectedPresets) {
        const preset = PRESET_HABITS.find(p => p.id === presetId);
        if (preset) addHabit(preset.name, preset.emoji, preset.type, preset.targetCount);
      }
      await AsyncStorage.setItem('onboarded_v2', '1');
      router.replace('/(tabs)');
    } else {
      setStep((s) => s + 1);
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.safeArea}>
        {/* Progress dots */}
        <View style={styles.dots}>
          {STEPS.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, { backgroundColor: i === step ? colors.tint : colors.icon, opacity: i === step ? 1 : 0.3 }]}
            />
          ))}
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.emoji}>{current.emoji}</Text>
          <Text style={[styles.title, { color: colors.text }]}>{current.title}</Text>
          <Text style={[styles.body, { color: colors.icon }]}>{current.body}</Text>

          {current.cards && (
            <View style={styles.cards}>
              {current.cards.map((card: { icon: string; label: string; desc: string }) => (
                <View key={card.label} style={[styles.card, { backgroundColor: cardBg }]}>
                  <Text style={[styles.cardIcon, { color: colors.tint }]}>{card.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardLabel, { color: colors.text }]}>{card.label}</Text>
                    <Text style={[styles.cardDesc, { color: colors.icon }]}>{card.desc}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {current.showChart && (
            <View style={[styles.chartPreview, { backgroundColor: cardBg }]}>
              <SampleWeeklyChart scheme={scheme} />
            </View>
          )}

          {current.showHabitPicker && (
            <View style={styles.presetList}>
              {PRESET_HABITS.map(preset => {
                const selected = selectedPresets.includes(preset.id);
                return (
                  <Pressable
                    key={preset.id}
                    onPress={() => togglePreset(preset.id)}
                    style={[styles.presetItem, {
                      backgroundColor: selected ? `${colors.tint}22` : cardBg,
                      borderWidth: 1.5,
                      borderColor: selected ? colors.tint : 'transparent',
                    }]}>
                    <Text style={{ fontSize: 28 }}>{preset.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.presetName, { color: colors.text }]}>{preset.name}</Text>
                      <Text style={[styles.presetType, { color: colors.icon }]}>
                        {preset.type === 'volume' ? `× ${preset.targetCount} per day` : 'Once a day'}
                      </Text>
                    </View>
                    {selected && <Text style={[styles.presetCheck, { color: colors.tint }]}>✓</Text>}
                  </Pressable>
                );
              })}
            </View>
          )}
        </ScrollView>

        {/* Footer: centered on step 0, left+right on steps 1+ */}
        {isLast && selectedPresets.length === 0 && (
          <Text style={[styles.pickHint, { color: colors.icon }]}>
            Select at least one habit to continue
          </Text>
        )}
        <View style={[styles.footer, isFirst && styles.footerCentered]}>
          {!isFirst && (
            <Pressable onPress={() => setStep((s) => s - 1)} style={styles.backBtn}>
              <Text style={[styles.backBtnText, { color: colors.icon }]}>← Back</Text>
            </Pressable>
          )}
          <Pressable
            onPress={handleNext}
            disabled={isLast && selectedPresets.length === 0}
            style={[
              styles.nextBtn,
              { backgroundColor: colors.tint },
              !isFirst && styles.nextBtnFlex,
              isLast && selectedPresets.length === 0 && { opacity: 0.35 },
            ]}>
            <Text style={[styles.nextBtnText, { color: scheme === 'dark' ? '#151718' : '#fff' }]}>
              {isLast ? "Let's go 🚀" : 'Next →'}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeArea: { flex: 1, paddingHorizontal: 24 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingTop: 16, paddingBottom: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  content: { flexGrow: 1, justifyContent: 'center', paddingVertical: 20, gap: 16 },
  emoji: { fontSize: 72, textAlign: 'center' },
  title: { fontSize: 28, fontWeight: '700', textAlign: 'center' },
  body: { fontSize: 16, lineHeight: 24, textAlign: 'center' },
  cards: { gap: 12, marginTop: 8 },
  card: { flexDirection: 'row', alignItems: 'flex-start', padding: 16, borderRadius: 16, gap: 14 },
  cardIcon: { fontSize: 28, width: 36, textAlign: 'center', fontWeight: '700' },
  cardLabel: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  cardDesc: { fontSize: 13, lineHeight: 18 },
  chartPreview: { borderRadius: 16, padding: 16, marginTop: 4 },
  footer: { flexDirection: 'row', gap: 12, paddingBottom: 24, paddingTop: 16 },
  footerCentered: { justifyContent: 'center' },
  backBtn: { paddingVertical: 16, paddingHorizontal: 20, borderRadius: 14 },
  backBtnText: { fontSize: 16, fontWeight: '600' },
  nextBtn: { paddingVertical: 16, paddingHorizontal: 32, borderRadius: 14, alignItems: 'center' },
  nextBtnFlex: { flex: 1 },
  nextBtnText: { fontSize: 16, fontWeight: '700' },
  pickHint: { textAlign: 'center', fontSize: 13, paddingBottom: 6 },
  presetList: { gap: 8, width: '100%' },
  presetItem: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, gap: 12 },
  presetName: { fontSize: 15, fontWeight: '600' },
  presetType: { fontSize: 12, marginTop: 2 },
  presetCheck: { fontSize: 18, fontWeight: '700' },
});
