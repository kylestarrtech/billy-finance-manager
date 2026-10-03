import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';
import { colors, fonts } from '../../theme';

// Sizes follow the browser defaults the original relied on (h1 2em, h2 1.5em, ...), scaled a touch
// for phone screens. Custom fonts on Android ignore fontWeight, so weight/italics are expressed by
// picking the matching Noto Serif file instead.
const variants = StyleSheet.create({
    h1: { fontSize: 24, lineHeight: 32, fontFamily: fonts.bold },
    h2: { fontSize: 22, lineHeight: 30, fontFamily: fonts.bold },
    h3: { fontSize: 18, lineHeight: 26, fontFamily: fonts.bold },
    h4: { fontSize: 16, lineHeight: 22, fontFamily: fonts.bold },
    body: { fontSize: 15, lineHeight: 22, fontFamily: fonts.regular },
    small: { fontSize: 13, lineHeight: 19, fontFamily: fonts.regular },
    caption: { fontSize: 11, lineHeight: 15, fontFamily: fonts.regular },
});

export type TextVariant = keyof typeof variants;

interface AppTextProps extends TextProps {
    variant?: TextVariant;
    bold?: boolean;
    medium?: boolean;
    italic?: boolean;
    muted?: boolean;
    center?: boolean;
    color?: string;
}

const pickFamily = (base: string | undefined, bold?: boolean, medium?: boolean, italic?: boolean) => {
    const isBold = bold || base === fonts.bold || base === fonts.boldItalic;
    if (isBold) return italic ? fonts.boldItalic : fonts.bold;
    if (medium) return fonts.medium;
    return italic ? fonts.italic : base;
};

export default function AppText({ variant = 'body', bold, medium, italic, muted, center, color, style, ...props }: AppTextProps) {
    const base = variants[variant];
    const flat = StyleSheet.flatten(style) as TextStyle | undefined;
    const fontFamily = pickFamily(flat?.fontFamily ?? base.fontFamily, bold, medium, italic);

    return (
        <Text
            {...props}
            style={[
                { color: muted ? colors.textMuted : colors.textMain },
                base,
                center && { textAlign: 'center' },
                color ? { color } : null,
                style,
                { fontFamily },
            ]}
        />
    );
}
