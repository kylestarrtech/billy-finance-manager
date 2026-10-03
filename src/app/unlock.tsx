import { StyleSheet, View } from 'react-native';
import PinScreen from '../components/PinScreen';
import Background from '../components/ui/Background';

// Shown instead of the tabs whenever the vault is locked or hasn't been set up yet.
export default function UnlockRoute() {
  return (
    <View style={styles.root}>
      <Background />
      <PinScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
