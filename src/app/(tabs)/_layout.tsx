import { useCallback, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { BlurTargetView } from 'expo-blur';

import AddBill from '../../components/AddBill';
import AddIncome from '../../components/AddIncome';
import AppHeader from '../../components/AppHeader';
import FloatingActions from '../../components/FloatingActions';
import { BlurTargetContext } from '../../components/ui/Blur';
import { EditorContext, type EditorContextType } from '../../context/EditorContext';
import { TabChromeContext, type TabChromeContextType } from '../../context/TabChromeContext';
import type { Bill, Income } from '../../context/FinanceContext';
import { colors } from '../../theme';

type EditorState =
  | { kind: 'bill'; bill?: Bill }
  | { kind: 'income'; income?: Income }
  | null;

// iOS 26 draws the tab bar in Liquid Glass and picks colours from the content behind it, so only the
// selected tint is set there. Android's Material bar is styled to match the app's palette.
const tabBarStyle = Platform.select({
  ios: {
    tintColor: colors.textBright,
    // Only used by iOS 18 and earlier, which have a classic blurred bar instead of Liquid Glass.
    blurEffect: 'systemChromeMaterialDark' as const,
  },
  default: {
    tintColor: colors.textBright,
    backgroundColor: '#1a1a1a',
    indicatorColor: colors.tabActive,
    rippleColor: 'rgba(255, 255, 255, 0.08)',
    // Material hides unselected labels once there are more than three tabs; show them all like iOS.
    labelVisibilityMode: 'labeled' as const,
    iconColor: { default: colors.textMuted, selected: colors.textBright },
    labelStyle: { default: { color: colors.textMuted }, selected: { color: colors.textBright } },
  },
});

export default function TabsLayout() {
  const [headerHeight, setHeaderHeight] = useState(0);
  const [tabBarTop, setTabBarTop] = useState<number | null>(null);
  const [rootBottom, setRootBottom] = useState<number | null>(null);
  const rootRef = useRef<View>(null);
  const blurTargetRef = useRef<View>(null);

  // modals
  const [editor, setEditor] = useState<EditorState>(null);

  const editorContext = useMemo<EditorContextType>(() => ({
    openBillEditor: bill => setEditor({ kind: 'bill', bill }),
    openIncomeEditor: income => setEditor({ kind: 'income', income }),
  }), []);
  const closeEditor = useCallback(() => setEditor(null), []);

  const tabChrome = useMemo<TabChromeContextType>(() => ({
    headerHeight,
    reportTabBarTop: setTabBarTop,
  }), [headerHeight]);

  const handleRootLayout = () => {
    rootRef.current?.measureInWindow((_x, y, _w, h) => setRootBottom(y + h));
  };

  const tabBarOffset = tabBarTop != null && rootBottom != null ? Math.max(0, rootBottom - tabBarTop) : null;

  return (
    <EditorContext.Provider value={editorContext}>
      <TabChromeContext.Provider value={tabChrome}>
        <BlurTargetContext.Provider value={blurTargetRef}>
          <View ref={rootRef} style={styles.root} onLayout={handleRootLayout}>
            {/* Everything the header, floating buttons and modals blur on Android lives in here. */}
            <BlurTargetView ref={blurTargetRef} style={StyleSheet.absoluteFill}>
              <NativeTabs {...tabBarStyle} backBehavior="initialRoute">
                <NativeTabs.Trigger name="index" disableAutomaticContentInsets contentStyle={styles.screen}>
                  <NativeTabs.Trigger.Icon sf={{ default: 'chart.pie', selected: 'chart.pie.fill' }} md="dashboard" />
                  <NativeTabs.Trigger.Label>Dashboard</NativeTabs.Trigger.Label>
                </NativeTabs.Trigger>
                <NativeTabs.Trigger name="bills" disableAutomaticContentInsets contentStyle={styles.screen}>
                  <NativeTabs.Trigger.Icon sf={{ default: 'doc.text', selected: 'doc.text.fill' }} md="receipt_long" />
                  <NativeTabs.Trigger.Label>Bills</NativeTabs.Trigger.Label>
                </NativeTabs.Trigger>
                <NativeTabs.Trigger name="income" disableAutomaticContentInsets contentStyle={styles.screen}>
                  <NativeTabs.Trigger.Icon sf={{ default: 'banknote', selected: 'banknote.fill' }} md="payments" />
                  <NativeTabs.Trigger.Label>Income</NativeTabs.Trigger.Label>
                </NativeTabs.Trigger>
                <NativeTabs.Trigger name="privacy" disableAutomaticContentInsets contentStyle={styles.screen}>
                  <NativeTabs.Trigger.Icon sf={{ default: 'lock.shield', selected: 'lock.shield.fill' }} md="shield_lock" />
                  <NativeTabs.Trigger.Label>Privacy</NativeTabs.Trigger.Label>
                </NativeTabs.Trigger>
              </NativeTabs>
            </BlurTargetView>

            <AppHeader onLayout={e => setHeaderHeight(e.nativeEvent.layout.height)} />

            {tabBarOffset != null && (
              <FloatingActions
                bottomOffset={tabBarOffset}
                onAddBill={() => editorContext.openBillEditor()}
                onAddIncome={() => editorContext.openIncomeEditor()}
              />
            )}

            {editor?.kind === 'bill' && (
              <AddBill billToEdit={editor.bill} onClose={closeEditor} />
            )}

            {editor?.kind === 'income' && (
              <AddIncome incomeToEdit={editor.income} onClose={closeEditor} />
            )}
          </View>
        </BlurTargetContext.Provider>
      </TabChromeContext.Provider>
    </EditorContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  screen: {
    backgroundColor: colors.bg,
  },
});
