import TabScreen from '../../components/TabScreen';
import Dashboard from '../../components/Dashboard';
import { useAddActions } from '../../hooks/useAddActions';

export default function DashboardRoute() {
  const actions = useAddActions(['bill', 'income', 'spend', 'goal']);
  return (
    <TabScreen actions={actions}>
      <Dashboard />
    </TabScreen>
  );
}
