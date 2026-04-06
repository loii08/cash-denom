// App version - update this with each release
export const APP_VERSION = '1.0.2';

// Release notes
export const VERSION_NOTES: Record<string, string> = {
  '1.0.2': 'Fixed circular dependency issue in Firebase initialization',
  '1.0.1': 'Fixed Firebase deprecation warning, improved offline persistence with modern cache API',
  '1.0.0': 'Initial release with offline support, expense tracking, and real-time syncing'
};
