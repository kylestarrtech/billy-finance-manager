import { useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Switch, TextInput, View, type TextInputProps } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import AppText from './AppText';
import Button, { ScalePressable } from './Button';
import { colors, fonts, radius } from '../../theme';
import { formatISODate, formatTime, parseISODate, toISODate } from '../../utils/dates';
import { haptics } from '../../utils/haptics';

// `.form-group` + label
export function FormField({ label, children }: { label: string; children: ReactNode }) {
    return (
        <View style={styles.group}>
            <AppText muted style={styles.label}>{label}</AppText>
            {children}
        </View>
    );
}

export function TextField({ style, ...props }: TextInputProps) {
    return (
        <TextInput
            placeholderTextColor={colors.placeholder}
            selectionColor={colors.gain}
            keyboardAppearance="dark"
            {...props}
            style={[styles.input, style]}
        />
    );
}

/** Numeric text input. Keeps the raw string so values like "12." can be typed. */
export function NumberField({ value, onChangeText, decimal = true, ...props }: TextInputProps & { decimal?: boolean }) {
    return (
        <TextField
            {...props}
            value={value}
            keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
            onChangeText={text => {
                // Accept a comma as decimal separator (some locales' keypads only offer ",").
                const normalized = text.replace(',', '.');
                const pattern = decimal ? /^\d*\.?\d{0,2}$/ : /^\d*$/;
                if (pattern.test(normalized)) onChangeText?.(normalized);
            }}
        />
    );
}

// Replaces <select>: every option visible as a tappable chip, styled like the tab buttons.
export function ChipSelect<T extends string>({
    options,
    value,
    onChange,
    getLabel = (o: T) => o.charAt(0).toUpperCase() + o.slice(1),
}: {
    options: readonly T[];
    value: T;
    onChange: (value: T) => void;
    getLabel?: (option: T) => string;
}) {
    return (
        <View style={styles.chips}>
            {options.map(option => {
                const active = option === value;
                return (
                    <ScalePressable
                        key={option}
                        onPress={() => {
                            haptics.selection();
                            onChange(option);
                        }}
                        accessibilityLabel={getLabel(option)}
                        style={[styles.chip, active && styles.chipActive]}
                    >
                        <AppText variant="small" bold color={active ? colors.textBright : colors.textMuted}>
                            {getLabel(option)}
                        </AppText>
                    </ScalePressable>
                );
            })}
        </View>
    );
}

// Replaces the checkbox + label rows.
export function SwitchRow({ label, description, value, onValueChange, disabled }: {
    label: string;
    description?: string;
    value: boolean;
    onValueChange: (v: boolean) => void;
    disabled?: boolean;
}) {
    return (
        <Pressable
            style={[styles.group, styles.switchRow, disabled && styles.disabled]}
            onPress={() => !disabled && onValueChange(!value)}
            accessibilityRole="switch"
            accessibilityState={{ checked: value, disabled: !!disabled }}
        >
            <View style={styles.switchText}>
                <AppText>{label}</AppText>
                {!!description && <AppText variant="small" muted>{description}</AppText>}
            </View>
            <Switch
                value={value}
                onValueChange={onValueChange}
                disabled={disabled}
                trackColor={{ false: colors.border, true: colors.gain }}
                thumbColor={colors.textMain}
                ios_backgroundColor={colors.border}
            />
        </Pressable>
    );
}

// Time of day picker (hour/minute), e.g. when reminders go off.
export function TimeField({ hour, minute, onChange }: { hour: number; minute: number; onChange: (hour: number, minute: number) => void }) {
    const [iosPickerOpen, setIosPickerOpen] = useState(false);
    const current = new Date(2000, 0, 1, hour, minute);

    const open = () => {
        if (Platform.OS === 'android') {
            DateTimePickerAndroid.open({
                value: current,
                mode: 'time',
                onValueChange: (_event, date) => onChange(date.getHours(), date.getMinutes()),
            });
        } else {
            setIosPickerOpen(o => !o);
        }
    };

    return (
        <View>
            <Pressable style={[styles.input, styles.dateInput]} onPress={open} accessibilityRole="button" accessibilityLabel={formatTime(hour, minute)}>
                <AppText>{formatTime(hour, minute)}</AppText>
            </Pressable>
            {Platform.OS === 'ios' && iosPickerOpen && (
                <DateTimePicker
                    value={current}
                    mode="time"
                    display="spinner"
                    themeVariant="dark"
                    onValueChange={(_event, date) => onChange(date.getHours(), date.getMinutes())}
                    style={styles.iosPicker}
                />
            )}
        </View>
    );
}

// Replaces <input type="date">. Value is a local 'YYYY-MM-DD' string ('' when unset).
export function DateField({
    value,
    onChange,
    placeholder = 'Select a date',
    clearable,
}: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    clearable?: boolean;
}) {
    const [iosPickerOpen, setIosPickerOpen] = useState(false);
    const current = value ? parseISODate(value) : new Date();

    const open = () => {
        if (Platform.OS === 'android') {
            DateTimePickerAndroid.open({
                value: current,
                mode: 'date',
                onValueChange: (_event, date) => onChange(toISODate(date)),
            });
        } else {
            setIosPickerOpen(o => !o);
        }
    };

    return (
        <View>
            <View style={styles.dateRow}>
                <Pressable style={[styles.input, styles.dateInput]} onPress={open} accessibilityRole="button" accessibilityLabel={value ? formatISODate(value) : placeholder}>
                    <AppText color={value ? colors.textMain : colors.placeholder}>
                        {value ? formatISODate(value) : placeholder}
                    </AppText>
                </Pressable>
                {clearable && !!value && (
                    <Button title="Clear" variant="secondary" small onPress={() => { onChange(''); setIosPickerOpen(false); }} />
                )}
            </View>

            {Platform.OS === 'ios' && iosPickerOpen && (
                <DateTimePicker
                    value={current}
                    mode="date"
                    display="inline"
                    themeVariant="dark"
                    accentColor={colors.gain}
                    onValueChange={(_event, date) => {
                        onChange(toISODate(date));
                        setIosPickerOpen(false);
                    }}
                    style={styles.iosPicker}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    group: {
        marginBottom: 16,
    },
    label: {
        marginBottom: 8,
    },
    input: {
        width: '100%',
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: colors.input,
        borderRadius: radius.input,
        color: colors.textMain,
        fontFamily: fonts.regular,
        fontSize: 15,
        minHeight: 44,
    },
    chips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chip: {
        paddingVertical: 7,
        paddingHorizontal: 12,
        borderRadius: radius.button,
        backgroundColor: colors.btnStandard,
    },
    chipActive: {
        backgroundColor: colors.tabActive,
        boxShadow: '0px 0px 10px 0px rgba(255, 255, 255, 0.05)',
    },
    switchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
    },
    switchText: {
        flexShrink: 1,
        gap: 2,
    },
    disabled: {
        opacity: 0.5,
    },
    dateRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    dateInput: {
        flex: 1,
        width: undefined,
        justifyContent: 'center',
    },
    iosPicker: {
        marginTop: 8,
        alignSelf: 'center',
    },
});
