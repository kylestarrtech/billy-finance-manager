import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, Pressable } from 'react-native';

// Replaces the window 'error' / 'unhandledrejection' overlay from main.tsx. In development the
// red-box/LogBox still shows first; this is what a release build falls back to.
export default class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
    state = { error: null as Error | null };

    static getDerivedStateFromError(error: Error) {
        return { error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error('Uncaught error:', error, info.componentStack);
    }

    render() {
        if (!this.state.error) return this.props.children;

        // Plain Text on purpose: custom fonts may be what failed.
        return (
            <ScrollView style={styles.root} contentContainerStyle={styles.content}>
                <Text style={styles.title}>Something went wrong</Text>
                <Text style={styles.message}>{String(this.state.error?.message ?? this.state.error)}</Text>
                <Pressable style={styles.button} onPress={() => this.setState({ error: null })} accessibilityRole="button">
                    <Text style={styles.buttonText}>Try again</Text>
                </Pressable>
            </ScrollView>
        );
    }
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: '#141414',
    },
    content: {
        padding: 24,
        paddingTop: 80,
        gap: 16,
    },
    title: {
        color: '#e53935',
        fontSize: 22,
        fontWeight: 'bold',
    },
    message: {
        color: '#e0e0e0',
        fontSize: 15,
    },
    button: {
        alignSelf: 'flex-start',
        backgroundColor: '#33333380',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 6,
    },
    buttonText: {
        color: '#e0e0e0',
        fontWeight: 'bold',
    },
});
