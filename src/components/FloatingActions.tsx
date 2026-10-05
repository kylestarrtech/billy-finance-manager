import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import AppBlur from './ui/Blur';
import AppText from './ui/AppText';
import { ScalePressable } from './ui/Button';
import type { FloatingAction } from '../context/TabChromeContext';
import { colors, radius } from '../theme';
import { haptics } from '../utils/haptics';

interface FloatingActionsProps {
    /** Set by the focused screen. One action shows a single button; several collapse into "+ Add". */
    actions: FloatingAction[];
    /** Distance from the bottom of the screen to the top of the screen's bottom chrome. */
    bottomOffset: number;
}

function Pill({ label, onPress, muted }: { label: string; onPress: () => void; muted?: boolean }) {
    return (
        <ScalePressable
            onPress={() => {
                haptics.tap();
                onPress();
            }}
            accessibilityLabel={label}
            style={styles.shadow}
        >
            <View style={styles.pill}>
                <AppBlur intensity={30} style={StyleSheet.absoluteFill} />
                <AppText bold color={muted ? colors.textMuted : colors.textMain}>{label}</AppText>
            </View>
        </ScalePressable>
    );
}

// The mobile layout of `.header-actions`: a frosted pill floating bottom-right, just above the tab bar
// (or the screen's pinned switcher), offering the add action that fits the current screen.
export default function FloatingActions({ actions, bottomOffset }: FloatingActionsProps) {
    // The menu is open for one particular set of actions, so it collapses by itself when the screen
    // (and with it the actions) changes.
    const actionsKey = actions.map(a => a.label).join('|');
    const [openFor, setOpenFor] = useState<string | null>(null);
    const open = openFor === actionsKey;
    const setOpen = (value: boolean) => setOpenFor(value ? actionsKey : null);

    if (actions.length === 0) return null;

    return (
        <View style={[styles.container, { bottom: bottomOffset + 16, right: 20 }]} pointerEvents="box-none">
            {actions.length === 1 ? (
                <Pill label={actions[0].label} onPress={actions[0].onPress} />
            ) : (
                <>
                    {open && actions.map(action => (
                        <Pill
                            key={action.label}
                            label={action.label}
                            onPress={() => {
                                setOpen(false);
                                action.onPress();
                            }}
                        />
                    ))}
                    <Pill label={open ? '✕ Close' : '+ Add'} muted={open} onPress={() => setOpen(!open)} />
                </>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        alignItems: 'flex-end',
        gap: 12,
    },
    shadow: {
        borderRadius: radius.pill,
        boxShadow: '0px 4px 15px 0px rgba(0, 0, 0, 0.6)',
    },
    pill: {
        borderRadius: radius.pill,
        overflow: 'hidden',
        backgroundColor: colors.btnStandard,
        paddingVertical: 12,
        paddingHorizontal: 20,
    },
});
