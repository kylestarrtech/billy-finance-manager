// Dates are local-time throughout the app, so pin a timezone (one with daylight saving, to exercise the
// DST-safe date helpers) and the tests behave the same on every machine.
module.exports = () => {
  process.env.TZ = 'America/Toronto';
};
