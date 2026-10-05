import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { File } from 'expo-file-system';
import { PaymentFrequency, useFinance } from '../context/FinanceContext';
import { ChipSelect, FormField, SwitchRow, TimeField } from './ui/FormControls';
import { confirmAsync, showAlert } from '../utils/dialogs';
import { requestReminderPermission } from '../utils/notifications';
import { REMINDER_HORIZON_DAYS } from '../utils/reminders';
import { pickPaycheckIncome } from '../utils/payPeriod';
import { isIncomeActive } from '../utils/schedule';
import { startOfToday } from '../utils/dates';
import { haptics } from '../utils/haptics';
import AppText from './ui/AppText';
import Button from './ui/Button';
import Card from './ui/Card';
import PrivacyScreen from './PrivacyScreen';

const DAYS_BEFORE = ['0', '1', '2', '3'] as const;
const DAYS_BEFORE_LABELS: Record<(typeof DAYS_BEFORE)[number], string> = {
    '0': 'On the day',
    '1': '1 day before',
    '2': '2 days before',
    '3': '3 days before',
};
const AUTO = 'auto';

export default function SettingsScreen() {
    const {
        incomes,
        settings,
        updateSettings,
        biometricSupport,
        biometricEnabled,
        setBiometricUnlock,
        lockVault,
        exportData,
        importData,
        clearAllData,
    } = useFinance();
    const [biometricBusy, setBiometricBusy] = useState(false);
    const reminders = settings.reminders;
    const today = startOfToday();

    const biometricLabel = biometricSupport?.label ?? 'Face ID';

    const handleBiometricToggle = async (enabled: boolean) => {
        setBiometricBusy(true);
        try {
            const ok = await setBiometricUnlock(enabled);
            if (ok) haptics.success();
            else if (enabled) showAlert(`${biometricLabel} not turned on`, `${biometricLabel} wasn't confirmed, so unlocking still uses your PIN.`);
        } finally {
            setBiometricBusy(false);
        }
    };

    const handleRemindersToggle = async (enabled: boolean) => {
        if (enabled) {
            let granted = false;
            try {
                granted = await requestReminderPermission();
            } catch (e) {
                console.warn('Notification permission request failed:', e);
            }
            if (!granted) {
                showAlert('Notifications are off', 'Allow notifications for Billy in your device settings to get bill reminders.');
                return;
            }
        }
        updateSettings(s => ({ ...s, reminders: { ...s.reminders, enabled } }));
    };

    const recurringIncomes = incomes.filter(i => i.frequency !== PaymentFrequency.Onetime && isIncomeActive(i, today));
    const autoPaycheck = pickPaycheckIncome(incomes, undefined, today);
    const paycheckValue = settings.payPeriodIncomeId && recurringIncomes.some(i => i.id === settings.payPeriodIncomeId)
        ? settings.payPeriodIncomeId
        : AUTO;

    const handleImportFile = async () => {
        // expo-file-system's own picker grants read access to the chosen file (Expo Go's sandbox
        // refuses to read files handed over by other modules). Cloud providers often report JSON as
        // octet-stream, so any file is allowed and validated when parsed.
        const picked = await File.pickFileAsync({ mimeTypes: '*/*' });
        if (picked.canceled) return;

        const confirmed = await confirmAsync(
            'Import Data',
            'WARNING: Importing will OVERWRITE your current data with what\'s in the file. Do you wish to proceed?',
            { confirmText: 'Overwrite', destructive: true }
        );
        if (!confirmed) return;

        try {
            importData(await picked.result.text());
        } catch (error) {
            console.warn('Import read failed:', error);
            showAlert('Import Failed', 'Could not read the selected file.');
        }
    };

    const handleDeleteAllData = async () => {
        const confirmed = await confirmAsync(
            'Delete All Data',
            'WARNING: This will permanently delete all bills, income, budgets, cards, and your PIN-protected vault data. This cannot be undone.\n\nDo you want to continue?',
            { confirmText: 'Delete Everything', destructive: true }
        );
        if (!confirmed) return;
        await clearAllData();
    };

    return (
        <View style={styles.page}>
            <AppText variant="h2">Settings</AppText>

            <Card style={styles.card}>
                <AppText variant="h3" style={styles.cardTitle}>Security</AppText>
                <SwitchRow
                    label={`Unlock with ${biometricLabel}`}
                    description={biometricSupport?.available === false ? biometricSupport.reason : 'Your PIN still works as a backup.'}
                    value={biometricEnabled}
                    onValueChange={handleBiometricToggle}
                    disabled={biometricBusy || !biometricSupport?.available}
                />
                <AppText variant="small" muted style={styles.note}>Billy locks itself after 2 minutes in the background.</AppText>
                <Button title="Lock Now" onPress={lockVault} style={styles.alignStart} />
            </Card>

            <Card style={styles.card}>
                <AppText variant="h3" style={styles.cardTitle}>Bill Reminders</AppText>
                <SwitchRow
                    label="Remind me before bills are due"
                    description="Includes credit card and loan payments. Bills already marked paid are skipped."
                    value={reminders.enabled}
                    onValueChange={handleRemindersToggle}
                />
                {reminders.enabled && (
                    <>
                        <FormField label="When">
                            <ChipSelect
                                options={DAYS_BEFORE}
                                value={String(Math.min(3, reminders.daysBefore)) as (typeof DAYS_BEFORE)[number]}
                                onChange={v => updateSettings(s => ({ ...s, reminders: { ...s.reminders, daysBefore: Number(v) } }))}
                                getLabel={v => DAYS_BEFORE_LABELS[v]}
                            />
                        </FormField>
                        <FormField label="At">
                            <TimeField
                                hour={reminders.hour}
                                minute={reminders.minute}
                                onChange={(hour, minute) => updateSettings(s => ({ ...s, reminders: { ...s.reminders, hour, minute } }))}
                            />
                        </FormField>
                        <SwitchRow
                            label="Show Bill names & amounts"
                            description="When enabled, bill details are shown in the notifications."
                            value={reminders.showDetails}
                            onValueChange={showDetails => updateSettings(s => ({ ...s, reminders: { ...s.reminders, showDetails } }))}
                        />
                        <AppText variant="small" muted>
                            {`Reminders are scheduled ${REMINDER_HORIZON_DAYS} days ahead each time you open Billy, so open it at least once a month to keep them coming.`}
                        </AppText>
                    </>
                )}
            </Card>

            <Card style={styles.card}>
                <AppText variant="h3" style={styles.cardTitle}>Pay Period</AppText>
                <AppText variant="small" muted style={styles.note}>
                    Which paycheck starts each pay period on the dashboard and for pay-period budgets.
                </AppText>
                {recurringIncomes.length === 0 ? (
                    <AppText muted>Add a recurring income to use pay periods.</AppText>
                ) : (
                    <ChipSelect
                        options={[AUTO, ...recurringIncomes.map(i => i.id)]}
                        value={paycheckValue}
                        onChange={v => updateSettings(s => ({ ...s, payPeriodIncomeId: v === AUTO ? undefined : v }))}
                        getLabel={v => (v === AUTO ? `Automatic${autoPaycheck ? ` (${autoPaycheck.name})` : ''}` : incomes.find(i => i.id === v)?.name ?? '')}
                    />
                )}
            </Card>

            <Card style={styles.card}>
                <AppText variant="h3" style={styles.cardTitle}>Your Data</AppText>
                <View style={styles.buttons}>
                    <Button title="Import Data from JSON" onPress={handleImportFile} />
                    <Button title="Export Data to JSON" onPress={exportData} />
                    <Button title="Delete All Data" variant="danger" onPress={handleDeleteAllData} />
                </View>
            </Card>

            <PrivacyScreen />

            <AppText variant="caption" muted center onPress={() => Linking.openURL('https://github.com/kylestarrtech/billy-finance-manager')}>
                Billy is privacy first FOSS (Free and Open-Source Software).
            </AppText>
        </View>
    );
}

const styles = StyleSheet.create({
    page: {
        gap: 20,
    },
    card: {
        gap: 4,
    },
    cardTitle: {
        marginBottom: 12,
    },
    note: {
        marginBottom: 12,
    },
    alignStart: {
        alignSelf: 'flex-start',
    },
    buttons: {
        gap: 12,
        alignItems: 'stretch',
    },
});
