import * as Haptics from 'expo-haptics';

// Haptics stand in for the hover feedback the desktop version had. Failures (e.g. devices without a
// vibration motor) are irrelevant, so they are swallowed.
const safe = (fn: () => Promise<void>) => () => {
    fn().catch(() => {});
};

export const haptics = {
    selection: safe(() => Haptics.selectionAsync()),
    tap: safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
    success: safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
    warning: safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
    error: safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
