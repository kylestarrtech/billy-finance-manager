const { withEntitlementsPlist } = require('expo/config-plugins');

/**
 * expo-notifications always adds the iOS push entitlement (`aps-environment`), but Billy only schedules
 * local notifications on the device. Free Apple IDs (used to sideload the app) can't sign apps that
 * request push, so remove it.
 *
 * Mods run in reverse order of registration, so this must be listed BEFORE "expo-notifications" in
 * app.json's plugins for its removal to happen after the entitlement is added.
 */
module.exports = function withoutPushEntitlement(config) {
    return withEntitlementsPlist(config, config => {
        delete config.modResults['aps-environment'];
        return config;
    });
};
