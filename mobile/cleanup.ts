#!/usr/bin/env npx ts-node

// Standalone mobile test cleanup script
// Deletes all test users from the database, useful for manual cleanup after mobile tests
// Usage: npx ts-node mobile/cleanup.ts

import mobileGlobalTeardown from './global-teardown';

(async () => {
	try {
		await mobileGlobalTeardown();
		process.exit(0);
	} catch (e) {
		console.error('Cleanup failed:', e);
		process.exit(1);
	}
})();
