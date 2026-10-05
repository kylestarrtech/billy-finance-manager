import { useState } from 'react';
import TabScreen from '../../components/TabScreen';
import SpendingTab, { SPENDING_SECTIONS, type SpendingSection } from '../../components/SpendingTab';
import SegmentedControl from '../../components/ui/SegmentedControl';
import { useFinance } from '../../context/FinanceContext';
import { useAddActions, type AddActionKind } from '../../hooks/useAddActions';

export default function BillsRoute() {
  const [section, setSection] = useState<SpendingSection>('bills');
  const { budgets } = useFinance();
  // The add button follows the section: logging spending is the everyday action once budgets exist.
  const kind: Record<SpendingSection, AddActionKind> = {
    bills: 'bill',
    budgets: budgets.length > 0 ? 'spend' : 'budget',
    cards: 'card',
    loans: 'loan',
  };
  const actions = useAddActions([kind[section]]);
  return (
    <TabScreen
      actions={actions}
      footer={<SegmentedControl segments={SPENDING_SECTIONS} value={section} onChange={setSection} floating />}
    >
      <SpendingTab section={section} />
    </TabScreen>
  );
}
