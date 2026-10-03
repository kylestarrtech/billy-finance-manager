import { createContext, useContext } from 'react';

// The header and floating buttons are drawn by the tabs layout, on top of the native tab screens.
// Screens need the header's height to pad their content, and the layout needs to know where the
// native tab bar starts (it can't be measured directly) to keep the floating buttons above it.
export interface TabChromeContextType {
    headerHeight: number;
    /** Window y-coordinate of the top edge of the native tab bar, as measured by the focused screen. */
    reportTabBarTop: (y: number) => void;
}

export const TabChromeContext = createContext<TabChromeContextType | undefined>(undefined);

export const useTabChrome = () => {
    const context = useContext(TabChromeContext);
    if (context === undefined) {
        throw new Error('useTabChrome must be used within the tabs layout');
    }
    return context;
};
