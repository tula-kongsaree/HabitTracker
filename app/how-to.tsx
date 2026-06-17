import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';

const SECTIONS = [
  {
    heading: 'Adding habits',
    items: [
      { icon: '➕', text: 'Tap the + button on the Today screen to add a new habit.' },
      { icon: '✓', text: '"Once a day" habits are tapped once to complete. Tap again to undo.' },
      { icon: '🔢', text: '"Multiple times" habits have a daily target. Use + and − to track reps. A mini bar shows your progress.' },
      { icon: '🎨', text: 'Pick an emoji to make your habit instantly recognisable in all views.' },
    ],
  },
  {
    heading: 'Checking in daily',
    items: [
      { icon: '📅', text: 'Open the app each day and check off your habits. The progress bar fills as you complete more.' },
      { icon: '🎉', text: 'When all habits are done a green banner celebrates with you — and a haptic burst fires on device.' },
      { icon: '🔥', text: 'A streak badge appears below a habit name if you have a streak of 2+ days at risk today.' },
    ],
  },
  {
    heading: 'Reminders',
    items: [
      { icon: '🔔', text: 'Tap the 🔔 pill under any habit name to set a daily reminder for that habit.' },
      { icon: '⏰', text: 'Choose from hourly slots between 6 AM and 10 PM. Each habit must have a unique time.' },
      { icon: '🚫', text: 'Grayed-out slots are already taken by another habit — choose a different time or remove the other habit\'s reminder first.' },
    ],
  },
  {
    heading: 'Challenges',
    items: [
      { icon: '🏆', text: 'Go to the Challenges tab and tap "Start a Challenge" to begin.' },
      { icon: '📌', text: 'Name it, pick a duration (3, 7, 14, or 30 days), and select which habits to include.' },
      { icon: '📊', text: 'The circular progress ring shows overall completion across ALL days — it only reaches 100% on the final day if every habit was done every day.' },
      { icon: '🎖️', text: 'Complete a challenge and a 🏆 badge animates in with a celebration haptic.' },
    ],
  },
  {
    heading: 'Progress & Stats',
    items: [
      { icon: '📈', text: 'The weekly bar chart updates every time you log a habit. Bars only appear for days with at least one completion.' },
      { icon: '📅', text: 'The monthly calendar shows each day colour-coded: green = all habits done, orange = ≥ 50%, red = < 50%, gray = none.' },
      { icon: '🔢', text: 'Consistency cards show your perfect-day rate over 7, 30, and 90 days.' },
      { icon: '📋', text: 'History tab shows the last 30 days with a log of which habits were completed.' },
    ],
  },
];

export default function HowToScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme as 'light' | 'dark'];
  const cardBg = scheme === 'dark' ? '#1C1C1E' : '#F2F2F7';

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={[styles.backBtnText, { color: colors.tint }]}>← Back</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.pageTitle, { color: colors.text }]}>How to use HabitFlow</Text>

          {SECTIONS.map((section) => (
            <View key={section.heading} style={styles.section}>
              <Text style={[styles.sectionHeading, { color: colors.text }]}>{section.heading}</Text>
              <View style={[styles.sectionCard, { backgroundColor: cardBg }]}>
                {section.items.map((item, i) => (
                  <View
                    key={i}
                    style={[
                      styles.item,
                      i < section.items.length - 1 && styles.itemBorder,
                      { borderColor: colors.background },
                    ]}>
                    <Text style={styles.itemIcon}>{item.icon}</Text>
                    <Text style={[styles.itemText, { color: colors.text }]}>{item.text}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeArea: { flex: 1 },
  topBar: { paddingHorizontal: 20, paddingTop: 8 },
  backBtn: { alignSelf: 'flex-start', padding: 8 },
  backBtnText: { fontSize: 16, fontWeight: '600' },
  content: { padding: 20, gap: 20 },
  pageTitle: { fontSize: 28, fontWeight: '700', marginBottom: 4 },
  section: { gap: 10 },
  sectionHeading: { fontSize: 18, fontWeight: '700' },
  sectionCard: { borderRadius: 16, overflow: 'hidden' },
  item: { flexDirection: 'row', gap: 14, padding: 14, alignItems: 'flex-start' },
  itemBorder: { borderBottomWidth: 1 },
  itemIcon: { fontSize: 22, width: 32, textAlign: 'center' },
  itemText: { flex: 1, fontSize: 14, lineHeight: 20 },
});
