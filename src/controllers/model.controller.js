import { modelStore } from '../store/model.store.js';
import { ensureLatestModel, isSyncInFlight } from '../services/sync.service.js';

const fireAndForgetSync = (options) => {
  ensureLatestModel(options).catch((error) => {
    console.error('[model] sync failed:', error?.message ?? error);
  });
};

/**
 * Returns the current model snapshot. Kicks off a lazy sync on the first call
 * (or when explicitly idle / failed) so the page doesn't have to do it.
 */
export const getModel = (req, res) => {
  const snapshot = modelStore.snapshot();
  const eager = req.query.sync !== 'false';

  if (
    eager &&
    !isSyncInFlight() &&
    (snapshot.status === 'idle' || snapshot.status === 'failed')
  ) {
    fireAndForgetSync();
  }

  res.json(modelStore.snapshot());
};

/**
 * Explicitly trigger a re-sync. Useful for cron jobs or admin refresh.
 *   POST /api/model/sync?force=true
 */
export const triggerSync = (req, res) => {
  const force = req.query.force === 'true' || req.body?.force === true;
  fireAndForgetSync({ force });
  res.status(202).json(modelStore.snapshot());
};
