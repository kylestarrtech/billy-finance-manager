import { Platform } from 'react-native';
// Deliberately NOT `import * as Notifications from 'expo-notifications'`: the package entry point also loads
// its push-token code, which throws on import in Expo Go on Android (push was removed from Expo Go in SDK 53).
// Billy only uses local notifications, so it imports just those modules, none of which touch push.
import { scheduleNotificationAsync } from 'expo-notifications/build/scheduleNotificationAsync';
import { cancelAllScheduledNotificationsAsync } from 'expo-notifications/build/cancelAllScheduledNotificationsAsync';
import { getPermissionsAsync, requestPermissionsAsync } from 'expo-notifications/build/NotificationPermissions';
import { setNotificationChannelAsync } from 'expo-notifications/build/setNotificationChannelAsync';
import { setNotificationHandler } from 'expo-notifications/build/NotificationsHandler';
import { SchedulableTriggerInputTypes } from 'expo-notifications/build/Notifications.types';
import { AndroidImportance } from 'expo-notifications/build/NotificationChannelManager.types';
import type { PlannedReminder } from './reminders';

// Bill reminders are local notifications: scheduled on the phone by the app itself, so nothing is sent to
// or through any server. They look and behave like push notifications.

const CHANNEL_ID = 'bill-reminders';

// Show reminders as banners even if Billy happens to be open when one fires.
setNotificationHandler({
    handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

/**
 * Creates the Android "Bill reminders" channel. Resolves the channel id to use, or undefined to fall back
 * to the default channel (Expo Go on Android can't manage channels; installed builds can).
 */
async function ensureChannel(): Promise<string | undefined> {
    if (Platform.OS !== 'android') return undefined;
    try {
        await setNotificationChannelAsync(CHANNEL_ID, {
            name: 'Bill reminders',
            description: 'Reminders before bills and card payments are due',
            importance: AndroidImportance.HIGH,
        });
        return CHANNEL_ID;
    } catch (e) {
        if (__DEV__) console.log('[reminders] notification channel unavailable, using the default channel:', String(e));
        return undefined;
    }
}

/** Asks for permission if needed. Resolves whether reminders can be shown. */
export async function requestReminderPermission(): Promise<boolean> {
    await ensureChannel();
    const current = await getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const requested = await requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } });
    return requested.granted;
}

export async function hasReminderPermission(): Promise<boolean> {
    return (await getPermissionsAsync()).granted;
}

/** Replaces every scheduled reminder with `plan` (Billy schedules nothing else, so a full reset is safe). */
export async function scheduleReminders(plan: PlannedReminder[]): Promise<void> {
    await cancelAllScheduledNotificationsAsync();
    if (plan.length === 0) return;
    const channelId = await ensureChannel();
    for (const reminder of plan) {
        await scheduleNotificationAsync({
            content: { title: reminder.title, body: reminder.body, sound: 'default' },
            trigger: {
                type: SchedulableTriggerInputTypes.DATE,
                date: reminder.date,
                ...(channelId ? { channelId } : {}),
            },
        });
    }
    if (__DEV__) console.log(`[reminders] scheduled ${plan.length}, next at ${plan[0].date.toLocaleString()}`);
}

export async function cancelAllReminders(): Promise<void> {
    await cancelAllScheduledNotificationsAsync();
}
