import http from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { ensureBucket } from './services/oss.service.js';
import { reconcileExtractionWebhook } from './services/webhooks.service.js';
import { startTunnel, stopTunnel } from './infra/tunnel.js';
import { initSocket } from './realtime/socket.js';

const app = createApp();
const httpServer = http.createServer(app);

const bootstrap = async () => {
  initSocket(httpServer);

  try {
    const { bucketKey, created } = await ensureBucket();
    console.log(`[oss] bucket "${bucketKey}" ${created ? 'created' : 'verified'}.`);
  } catch (error) {
    console.error('[oss] failed to ensure bucket:', error?.message ?? error);
  }

  const publicUrl = await startTunnel(env.port);
  if (publicUrl) {
    console.log(`[tunnel] public URL: ${publicUrl}`);
    try {
      const result = await reconcileExtractionWebhook(
        `${publicUrl}/api/webhooks/translation-complete`
      );
      console.log(
        `[webhooks] hook ${result.created ? 'created' : 'verified'} for workflow "${result.workflow}".`
      );
    } catch (error) {
      console.error('[webhooks] failed to reconcile webhook:', error?.message ?? error);
    }
  } else {
    console.warn('[tunnel] no public URL — translation status will fall back to manifest polling.');
  }
};

const shutdown = async (signal) => {
  console.log(`\n[shutdown] received ${signal}, closing server…`);
  httpServer.close(() => process.exit(0));
  await stopTunnel();
  setTimeout(() => process.exit(1), 5000).unref();
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

httpServer.listen(env.port, () => {
  console.log(`Server listening on http://localhost:${env.port}`);
  bootstrap().catch((error) => {
    console.error('[bootstrap] unrecoverable error:', error);
  });
});
