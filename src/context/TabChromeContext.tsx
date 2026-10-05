import { createContext, useContext } from 'react';

// The header and floating buttons are drawn by the tabs layout, on top of the native tab screens.
// Screens need the header's height to pad their content, and the layout needs to know where the
// native tab bar starts (it can't be measured directly) to keep the floating buttons above it.
/** An add button offered by the focused screen (e.g. "+ Bill" on the Bills section). */
export interface FloatingAction {
    label: string;
    onPress: () => void;
}

export interface TabChromeContextType {
    headerHeight: number;
    /** Window y-coordinate of the top edge of the screen's bottom chrome, as measured by the focused screen. */
    reportTabBarTop: (y: number) => void;
    /** The focused screen sets which add buttons float above its bottom chrome (none: no button). */
    setFloatingActions: (actions: FloatingAction[]) => void;
}

export const TabChromeContext = createContext<TabChromeContextType | undefined>(undefined);

export const useTabChrome = () => {
    const context = useContext(TabChromeContext);
    if (context === undefined) {
        throw new Error('useTabChrome must be used within the tabs layout');
    }
    return context;
};
