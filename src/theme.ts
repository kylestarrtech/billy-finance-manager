// Mirrors the CSS custom properties and recurring colours from the original index.css.
export const colors = {
    bg: '#141414',
    textMain: '#e0e0e0',
    textMuted: '#9e9e9e',
    textBright: '#efefef',

    gain: '#4caf50',
    loss: '#e53935',
    lossTranslucent: '#e5393540',

    dot: '#232323',
    card: '#22222250',
    cardInner: '#2a2a2a40',
    input: '#111111',
    border: '#333333',
    tableBorder: '#33333340',
    btnStandard: '#33333380',
    btnSecondary: '#44444440',
    tabActive: '#444444',
    placeholder: '#6a6a6a',
};

export const fonts = {
    regular: 'NotoSerif-Regular',
    italic: 'NotoSerif-Italic',
    medium: 'NotoSerif-Medium',
    bold: 'NotoSerif-Bold',
    boldItalic: 'NotoSerif-BoldItalic',
};

export const fontAssets = {
    [fonts.regular]: require('../assets/fonts/NotoSerif-Regular.ttf'),
    [fonts.italic]: require('../assets/fonts/NotoSerif-Italic.ttf'),
    [fonts.medium]: require('../assets/fonts/NotoSerif-Medium.ttf'),
    [fonts.bold]: require('../assets/fonts/NotoSerif-Bold.ttf'),
    [fonts.boldItalic]: require('../assets/fonts/NotoSerif-BoldItalic.ttf'),
};

export const radius = {
    input: 4,
    button: 6,
    card: 8,
    pill: 50,
};

// Same glows the planning doc asks for: light, tasteful, driven by gain/loss state.
export const glow = {
    gain: '0px 0px 10px 0px rgba(76, 175, 80, 0.15)',
    loss: '0px 0px 10px 0px rgba(229, 57, 53, 0.35)',
};

export const outline = {
    gain: 'rgba(76, 175, 80, 0.5)',
    loss: 'rgba(229, 57, 53, 0.5)',
};

export const CHART_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#ff7300'];
