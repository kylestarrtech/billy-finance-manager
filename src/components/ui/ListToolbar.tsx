import { StyleSheet, Switch, View } from 'react-native';
import AppText from './AppText';
import { TextField } from './FormControls';
import { colors } from '../../theme';

interface ListToolbarProps {
    title: string;
    searchPlaceholder: string;
    searchQuery: string;
    onSearchChange: (query: string) => void;
    isCondensed: boolean;
    onCondensedChange: (condensed: boolean) => void;
}

// Title + search box + "Condensed View" toggle shared by the Bills and Income screens.
export default function ListToolbar({ title, searchPlaceholder, searchQuery, onSearchChange, isCondensed, onCondensedChange }: ListToolbarProps) {
    return (
        <View style={styles.container}>
            <View style={styles.titleRow}>
                <AppText variant="h2">{title}</AppText>
                <View style={styles.toggle}>
                    <AppText variant="small" muted>Condensed</AppText>
                    <Switch
                        value={isCondensed}
                        onValueChange={onCondensedChange}
                        trackColor={{ false: colors.border, true: colors.gain }}
                        thumbColor={colors.textMain}
                        ios_backgroundColor={colors.border}
                    />
                </View>
            </View>
            <TextField
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChangeText={onSearchChange}
                clearButtonMode="while-editing"
                autoCorrect={false}
                returnKeyType="search"
                style={styles.search}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        gap: 12,
    },
    titleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    toggle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    search: {
        borderWidth: 1,
        borderColor: '#444444',
    },
});
