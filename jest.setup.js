// expo-crypto's native random source isn't available under Jest; Node's crypto stands in for it.
jest.mock('expo-crypto', () => {
  const crypto = require('crypto');
  return {
    getRandomBytes: length => new Uint8Array(crypto.randomBytes(length)),
    randomUUID: () => crypto.randomUUID(),
  };
});

// The library's own mock: zero insets, so screens render without a native SafeAreaProvider.
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

// Dev builds log how long vault key derivation took; that's just noise in test output.
const log = console.log;
console.log = (...args) => {
  if (typeof args[0] === 'string' && args[0].startsWith('[vault]')) return;
  log(...args);
};
