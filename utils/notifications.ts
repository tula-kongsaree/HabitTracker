import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleDaily(
  id: string,
  hour: number,
  minute: number,
  title: string,
  body: string
) {
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier: id,
    content: { title, body },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}

export async function cancelAll() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function setupDefaultReminders(morningHour = 9, eveningHour = 20) {
  const granted = await requestPermission();
  if (!granted) return;

  await scheduleDaily(
    'morning-reminder',
    morningHour,
    0,
    'Time for your habits 🌅',
    "A fresh day — let's build those streaks!"
  );

  await scheduleDaily(
    'evening-checkin',
    eveningHour,
    0,
    'Evening check-in 🔥',
    "Don't forget your habits before the day ends!"
  );
}

export async function scheduleHabitReminder(habitId: string, habitName: string, hour: number, minute: number) {
  const granted = await requestPermission();
  if (!granted) return;
  await scheduleDaily(
    `habit-${habitId}`,
    hour,
    minute,
    `Time for: ${habitName} 🎯`,
    "Don't forget to log your habit today!"
  );
}

export async function cancelHabitReminder(habitId: string) {
  await Notifications.cancelScheduledNotificationAsync(`habit-${habitId}`).catch(() => {});
}
