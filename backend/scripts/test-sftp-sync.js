/* Local test runner for SFTP sync without requiring DB or SFTP server.
   It will no-op if SFTP_HOST/USERNAME are missing and print metrics. */
(async () => {
  try {
    const sync = require('../dist/services/sftpSync.js');
    // Ensure we don't accidentally start the cron-based service here.
    if (!process.env.SFTP_HOST) {
      console.log('[test] SFTP_HOST not set, expecting sync to skip download gracefully.');
    }
    await sync.syncSubscriptionData();
    const metrics = sync.getSftpMetrics ? sync.getSftpMetrics() : {};
    console.log('[test] SFTP sync finished. Metrics:', metrics);
    process.exit(0);
  } catch (e) {
    console.error('[test] SFTP sync test failed:', e);
    process.exit(1);
  }
})();
