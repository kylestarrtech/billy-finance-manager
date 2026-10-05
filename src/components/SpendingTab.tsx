import Bills from './Bills';
import Budgets from './Budgets';
import Cards from './Cards';
import Loans from './Loans';

export type SpendingSection = 'bills' | 'budgets' | 'cards' | 'loans';

export const SPENDING_SECTIONS = [
    { value: 'bills', label: 'Bills' },
    { value: 'budgets', label: 'Budgets' },
    { value: 'cards', label: 'Cards' },
    { value: 'loans', label: 'Loans' },
] as const;

// The Bills tab: fixed bills, variable budgets, credit cards and loans. The section switcher is pinned
// at the bottom of the screen (see the bills route) so it's within thumb reach.
export default function SpendingTab({ section }: { section: SpendingSection }) {
    switch (section) {
        case 'budgets':
            return <Budgets />;
        case 'cards':
            return <Cards />;
        case 'loans':
            return <Loans />;
        case 'bills':
        default:
            return <Bills />;
    }
}
