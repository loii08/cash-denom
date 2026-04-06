// App version - update this with each release
export const APP_VERSION = '1.0.7';

// Release notes
export const VERSION_NOTES: Record<string, string> = {
  '1.0.7': 'Logs tab: compact display, calendar date filter, default to today',
  '1.0.6': 'Show filtered total only when date selected; Add separate income/expense stats rows in banner',
  '1.0.5': 'Added filtered total row below history filter buttons',
  '1.0.4': 'Fixed production build TDZ error by simplifying Firebase initialization pattern',
  '1.0.3': 'Fixed Firebase initialization circular dependency with proper lazy loading pattern',
  '1.0.2': 'Fixed circular dependency issue in Firebase initialization',
  '1.0.1': 'Fixed Firebase deprecation warning, improved offline persistence with modern cache API',
  '1.0.0': 'Initial release with offline support, expense tracking, and real-time syncing'
};
