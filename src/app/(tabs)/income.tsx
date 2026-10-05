import { useState } from 'react';
import TabScreen from '../../components/TabScreen';
import Income from '../../components/Income';
import Goals from '../../components/Goals';
import SegmentedControl from '../../components/ui/SegmentedControl';
import { useAddActions } from '../../hooks/useAddActions';

type IncomeSection = 'income' | 'goals';

const SECTIONS = [
  { value: 'income', label: 'Income' },
  { value: 'goals', label: 'Savings Goals' },
] as const;

export default function IncomeRoute() {
  const [section, setSection] = useState<IncomeSection>('income');
  const actions = useAddActions([section === 'income' ? 'income' : 'goal']);
  return (
    <TabScreen
      actions={actions}
      footer={<SegmentedControl segments={SECTIONS} value={section} onChange={setSection} floating />}
    >
      {section === 'income' ? <Income /> : <Goals />}
    </TabScreen>
  );
}
