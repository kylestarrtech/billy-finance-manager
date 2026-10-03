import { StyleSheet, View, type ViewProps } from 'react-native';
import { colors, glow, outline, radius } from '../../theme';

interface CardProps extends ViewProps {
    tone?: 'gain' | 'loss';
}

// `.card` from the CSS. `tone` adds the coloured outline + soft glow used for gain/loss states.
export default function Card({ tone, style, ...props }: CardProps) {
    return (
        <View
            {...props}
            style={[
                styles.card,
                tone && { borderWidth: 1, borderColor: outline[tone], boxShadow: glow[tone] },
                style,
            ]}
        />
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.card,
        borderRadius: radius.card,
        padding: 20,
    },
});
