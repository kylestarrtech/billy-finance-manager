import TabScreen from '../../components/TabScreen';
import CalendarView from '../../components/CalendarView';
import { useAddActions } from '../../hooks/useAddActions';

export default function CalendarRoute() {
  const actions = useAddActions(['bill', 'income', 'spend']);
  return (
    <TabScreen actions={actions}>
      <CalendarView />
    </TabScreen>
  );
}
