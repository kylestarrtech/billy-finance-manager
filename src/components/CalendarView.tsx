import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFinance } from '../context/FinanceContext';
import { useEditor } from '../context/EditorContext';
import {
    addDays,
    endOfMonth,
    formatLongDate,
    formatMoney,
    formatMonthYear,
    isSameDay,
    parseISODate,
    startOfMonth,
    startOfToday,
    toISODate,
} from '../utils/dates';
import { getDueItems, getIncomeItems, OVERDUE_WINDOW_DAYS, type DueItem, type IncomeItem } from '../utils/schedule';
import { colors, radius } from '../theme';
import { haptics } from '../utils/haptics';
import AppText from './ui/AppText';
import Button, { ScalePressable } from './ui/Button';
import Card from './ui/Card';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
// Deep blue for "due": unlike the old amber it stays clearly apart from the green "paid" for red-green
// colour blindness (checked with the dataviz palette validator). Red vs green can't be made safe by colour
// alone, so every state also has its own shape.
const DUE_BLUE = '#3f6fd8';

type DueState = 'paid' | 'overdue' | 'upcoming' | 'past';

const dueState = (item: DueItem, today: Date): DueState => {
    if (item.payment) return 'paid';
    if (item.date >= today) return 'upcoming';
    // Unpaid occurrences from before payment tracking existed aren't "overdue", just history.
    return item.date >= addDays(today, -OVERDUE_WINDOW_DAYS) ? 'overdue' : 'past';
};

const STATE_COLOR: Record<DueState, string> = {
    paid: colors.gain,
    overdue: colors.loss,
    upcoming: DUE_BLUE,
    past: colors.placeholder,
};

type MarkerKind = DueState | 'income';

/** ● paid · ○ due · ■ overdue · ● (white) income: shape and colour both carry the state. */
function Marker({ kind, size = 6 }: { kind: MarkerKind; size?: number }) {
    const color = kind === 'income' ? colors.textMain : STATE_COLOR[kind];
    const hollow = kind === 'upcoming' || kind === 'past';
    return (
        <View
            style={{
                width: size,
                height: size,
                borderRadius: kind === 'overdue' ? 1 : size / 2,
                backgroundColor: hollow ? 'transparent' : color,
                borderWidth: hollow ? Math.max(1.5, size / 5) : 0,
                borderColor: color,
            }}
        />
    );
}

export default function CalendarView() {
    const { data, spending, budgets, cards, cardTransactions } = useFinance();
    const { openPaymentSheet, openActualPaySheet } = useEditor();
    const today = startOfToday();
    const [month, setMonth] = useState(() => startOfMonth(today));
    const [selected, setSelected] = useState<Date>(today);
    // Square day cells sized from the grid's measured width (percentage widths + aspectRatio don't
    // combine reliably inside a wrapping row).
    const [cellSize, setCellSize] = useState(0);

    const monthStart = month;
    const monthEnd = endOfMonth(month);

    const { dueByDay, incomeByDay, totals } = useMemo(() => {
        const end = endOfMonth(month);
        const due = getDueItems(data, month, end, startOfToday());
        const income = getIncomeItems(data, month, end);
        const dueMap = new Map<string, DueItem[]>();
        const incomeMap = new Map<string, IncomeItem[]>();
        for (const item of due) dueMap.set(item.dueDate, [...(dueMap.get(item.dueDate) ?? []), item]);
        for (const item of income) {
            const key = toISODate(item.date);
            incomeMap.set(key, [...(incomeMap.get(key) ?? []), item]);
        }
        return {
            dueByDay: dueMap,
            incomeByDay: incomeMap,
            totals: {
                due: due.reduce((s, d) => s + d.amount, 0),
                paid: due.filter(d => d.payment).reduce((s, d) => s + d.amount, 0),
                income: income.reduce((s, i) => s + i.amount, 0),
            },
        };
    }, [data, month]);

    // Leading blanks so the 1st lands on the right weekday, then the month's days.
    const cells: (Date | null)[] = [
        ...Array.from({ length: monthStart.getDay() }, () => null),
        ...Array.from({ length: monthEnd.getDate() }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)),
    ];
    while (cells.length % 7 !== 0) cells.push(null);

    const changeMonth = (delta: number) => {
        haptics.selection();
        const next = new Date(month.getFullYear(), month.getMonth() + delta, 1);
        setMonth(next);
        setSelected(isSameDay(startOfMonth(today), next) ? today : next);
    };

    const selectedKey = toISODate(selected);
    const selectedDue = dueByDay.get(selectedKey) ?? [];
    const selectedIncome = incomeByDay.get(selectedKey) ?? [];
    const selectedSpending = spending.filter(e => e.date === selectedKey);
    const selectedCardActivity = cardTransactions.filter(t => t.date === selectedKey);
    const budgetName = (id: string) => budgets.find(b => b.id === id)?.name ?? 'Budget';
    const cardName = (id: string | undefined) => cards.find(c => c.id === id)?.name;

    return (
        <View style={styles.page}>
            <Card style={styles.calendarCard}>
                <View style={styles.monthRow}>
                    <Button title="‹" small variant="secondary" onPress={() => changeMonth(-1)} />
                    <AppText variant="h3" center style={styles.monthTitle}>{formatMonthYear(month)}</AppText>
                    <Button title="›" small variant="secondary" onPress={() => changeMonth(1)} />
                </View>

                <View style={styles.week}>
                    {WEEKDAYS.map((d, i) => (
                        <AppText key={i} variant="caption" muted center style={styles.weekday}>{d}</AppText>
                    ))}
                </View>

                <View style={styles.grid} onLayout={e => setCellSize(Math.floor(e.nativeEvent.layout.width / 7))}>
                    {cellSize > 0 && cells.map((day, i) => {
                        const cellStyle = [styles.cell, { width: cellSize, height: cellSize }];
                        if (!day) return <View key={`blank-${i}`} style={cellStyle} />;
                        const key = toISODate(day);
                        const due = dueByDay.get(key) ?? [];
                        const hasIncome = incomeByDay.has(key);
                        const isSelected = isSameDay(day, selected);
                        const isToday = isSameDay(day, today);
                        return (
                            <View key={key} style={cellStyle}>
                                <ScalePressable
                                    containerStyle={styles.flex}
                                    pressedScale={0.9}
                                    onPress={() => {
                                        haptics.selection();
                                        setSelected(day);
                                    }}
                                    accessibilityLabel={formatLongDate(day)}
                                    style={[styles.day, isToday && styles.today, isSelected && styles.selectedDay]}
                                >
                                    <AppText variant="small" bold={isToday || isSelected} color={isSelected ? colors.textBright : day < today ? colors.textMuted : colors.textMain}>
                                        {day.getDate()}
                                    </AppText>
                                    <View style={styles.dots}>
                                        {due.slice(0, 3).map(item => (
                                            <Marker key={item.key} kind={dueState(item, today)} />
                                        ))}
                                        {hasIncome && <Marker kind="income" />}
                                    </View>
                                </ScalePressable>
                            </View>
                        );
                    })}
                </View>

                <View style={styles.legend}>
                    {([['Paid', 'paid'], ['Due', 'upcoming'], ['Overdue', 'overdue'], ['Income', 'income']] as const).map(([label, kind]) => (
                        <View key={label} style={styles.legendItem}>
                            <Marker kind={kind} size={9} />
                            <AppText variant="caption" muted>{label}</AppText>
                        </View>
                    ))}
                </View>
            </Card>

            <Card style={styles.dayCard}>
                <AppText variant="h3">{isSameDay(selected, today) ? `Today · ${formatLongDate(selected)}` : formatLongDate(selected)}</AppText>
                {selectedDue.length === 0 && selectedIncome.length === 0 && selectedSpending.length === 0 && selectedCardActivity.length === 0 && (
                    <AppText muted>Nothing due or coming in.</AppText>
                )}
                {selectedDue.map(item => {
                    const state = dueState(item, today);
                    return (
                        <ScalePressable key={item.key} pressedScale={0.98} onPress={() => openPaymentSheet(item)} accessibilityLabel={`${item.name}, ${state}`}>
                            <View style={styles.row}>
                                <Marker kind={state} size={10} />
                                <View style={styles.flex}>
                                    <AppText bold>{item.name}</AppText>
                                    <AppText variant="small" muted>
                                        {state === 'paid'
                                            ? `Paid ${formatMoney(item.payment!.amount)} on ${parseISODate(item.payment!.paidDate).toLocaleDateString()}`
                                            : state === 'overdue' ? 'Overdue · tap to mark paid' : `${item.kind === 'card' ? (item.isLoan ? 'Loan payment' : 'Card payment') : 'Bill'} · tap to mark paid`}
                                    </AppText>
                                </View>
                                <AppText bold color={state === 'paid' ? colors.gain : colors.textMain}>{formatMoney(item.amount)}</AppText>
                            </View>
                        </ScalePressable>
                    );
                })}
                {selectedIncome.map(item => (
                    <ScalePressable key={item.key} pressedScale={0.98} onPress={() => openActualPaySheet(item.incomeId, item.payDate)} accessibilityLabel={`${item.name}, income`}>
                        <View style={styles.row}>
                            <Marker kind="income" size={10} />
                            <View style={styles.flex}>
                                <AppText bold>{item.name}</AppText>
                                <AppText variant="small" muted>{item.actual ? 'Actual pay · tap to change' : 'Expected · tap to enter actual pay'}</AppText>
                            </View>
                            <AppText bold color={colors.gain}>{`+${formatMoney(item.amount)}`}</AppText>
                        </View>
                    </ScalePressable>
                ))}
                {selectedSpending.map(entry => (
                    <View key={entry.id} style={styles.row}>
                        <View style={[styles.dot, styles.rowDot, { backgroundColor: colors.placeholder }]} />
                        <AppText style={styles.flex}>{`${budgetName(entry.budgetId)}${entry.note ? ` · ${entry.note}` : ''}${cardName(entry.cardId) ? ` · ${cardName(entry.cardId)}` : ''}`}</AppText>
                        <AppText muted>{formatMoney(entry.amount)}</AppText>
                    </View>
                ))}
                {selectedCardActivity.map(entry => (
                    <View key={entry.id} style={styles.row}>
                        <View style={[styles.dot, styles.rowDot, { backgroundColor: colors.placeholder }]} />
                        <AppText style={styles.flex}>{`${cardName(entry.cardId) ?? 'Card'} · ${entry.note || (entry.type === 'payment' ? 'Payment' : 'Charge')}`}</AppText>
                        <AppText muted color={entry.type === 'payment' ? colors.gain : undefined}>
                            {`${entry.type === 'payment' ? '-' : '+'}${formatMoney(entry.amount)}`}
                        </AppText>
                    </View>
                ))}
            </Card>

            <Card style={styles.dayCard}>
                <AppText variant="h3">{formatMonthYear(month)}</AppText>
                <View style={styles.totalRow}>
                    <AppText muted>Bills, cards & loans</AppText>
                    <AppText bold>{formatMoney(totals.due)}</AppText>
                </View>
                <View style={styles.totalRow}>
                    <AppText muted>Paid so far</AppText>
                    <AppText bold color={colors.gain}>{formatMoney(totals.paid)}</AppText>
                </View>
                <View style={styles.totalRow}>
                    <AppText muted>Income</AppText>
                    <AppText bold color={colors.gain}>{formatMoney(totals.income)}</AppText>
                </View>
            </Card>
        </View>
    );
}

const styles = StyleSheet.create({
    page: {
        gap: 20,
    },
    calendarCard: {
        paddingHorizontal: 12,
        gap: 8,
    },
    monthRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    monthTitle: {
        flex: 1,
    },
    week: {
        flexDirection: 'row',
    },
    weekday: {
        flex: 1,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    cell: {
        padding: 2,
    },
    day: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius.card,
        gap: 3,
    },
    today: {
        borderWidth: 1,
        borderColor: colors.textMuted,
    },
    selectedDay: {
        backgroundColor: colors.tabActive,
    },
    dots: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        height: 6,
    },
    dot: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
    },
    legend: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 14,
        marginTop: 4,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    dayCard: {
        gap: 12,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    rowDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    flex: {
        flex: 1,
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
});
