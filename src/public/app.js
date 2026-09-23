(function () {
  'use strict';

  const viewerContainer = document.getElementById('aps-viewer');
  const statusRoot = document.getElementById('status');
  const statusTitle = statusRoot.querySelector('.status__title');
  const statusMessage = statusRoot.querySelector('.status__message');
  const statusSource = statusRoot.querySelector('.status__source');
  const statusSpinner = statusRoot.querySelector('.status__spinner');

  const STATUS_COPY = {
    idle: { title: 'Preparing model', message: 'Looking up the latest file…' },
    syncing: {
      list: { title: 'Looking up file', message: 'Querying Google Drive…' },
      download: { title: 'Downloading', message: 'Fetching the model from Google Drive…' },
      upload: { title: 'Uploading', message: 'Uploading to Autodesk OSS…' },
      translate: { title: 'Translating', message: 'Starting translation…' },
    },
    translating: { title: 'Translating', message: 'Autodesk is preparing the viewables…' },
    ready: { title: 'Ready', message: 'Loading viewer…' },
    failed: { title: 'Something went wrong', message: 'See details below.' },
  };

  let viewer = null;
  let loadedUrn = null;

  const showStatus = (snapshot) => {
    statusRoot.hidden = false;
    statusSpinner.hidden = snapshot.status === 'failed';
    statusRoot.classList.toggle('is-error', snapshot.status === 'failed');

    const copy =
      snapshot.status === 'syncing'
        ? STATUS_COPY.syncing[snapshot.step] ?? STATUS_COPY.syncing.list
        : STATUS_COPY[snapshot.status] ?? STATUS_COPY.idle;

    statusTitle.textContent = copy.title;
    let message = copy.message;
    if (snapshot.status === 'translating' && snapshot.progress) {
      message = `Autodesk is preparing the viewables (${snapshot.progress})…`;
    }
    if (snapshot.status === 'failed' && snapshot.error) {
      message = snapshot.error;
    }
    statusMessage.textContent = message;

    if (snapshot.sourceFileName) {
      statusSource.hidden = false;
      statusSource.textContent = snapshot.sourceFileName;
    } else {
      statusSource.hidden = true;
    }
  };

  const hideStatus = () => {
    statusRoot.hidden = true;
  };

  const fetchJson = async (url, init) => {
    const response = await fetch(url, init);
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`HTTP ${response.status}: ${body || response.statusText}`);
    }
    return response.json();
  };

  const getAccessToken = (onTokenReady) => {
    fetchJson('/api/auth/token')
      .then(({ access_token: token, expires_in: expiresIn }) => {
        if (!token) throw new Error('No access_token in response');
        onTokenReady(token, expiresIn);
      })
      .catch((error) => {
        console.error('[viewer] failed to fetch access token:', error);
        showStatus({ status: 'failed', error: 'Failed to fetch viewer access token.' });
      });
  };

  const initViewer = () =>
    new Promise((resolve) => {
      const options = {
        env: 'AutodeskProduction2',
        api: 'streamingV2',
        getAccessToken,
      };
      Autodesk.Viewing.Initializer(options, () => {
        viewer = new Autodesk.Viewing.GuiViewer3D(viewerContainer);
        const startCode = viewer.start();
        if (startCode > 0) {
          showStatus({ status: 'failed', error: `Viewer init failed (code ${startCode}).` });
          resolve(false);
          return;
        }
        resolve(true);
      });
    });

  const loadUrn = (urn) => {
    if (!viewer || !urn || loadedUrn === urn) return;
    loadedUrn = urn;
    const documentId = urn.startsWith('urn:') ? urn : `urn:${urn}`;
    Autodesk.Viewing.Document.load(
      documentId,
      (doc) => {
        const geometry = doc.getRoot().getDefaultGeometry();
        if (!geometry) {
          showStatus({ status: 'failed', error: 'No default geometry found in the document.' });
          return;
        }
        viewer.loadDocumentNode(doc, geometry).then(hideStatus);
      },
      (code) => {
        console.error('[viewer] document load failure:', code);
        showStatus({ status: 'failed', error: `Document load failed (code ${code}).` });
      }
    );
  };

  const handleSnapshot = (snapshot) => {
    if (!snapshot) return;
    if (snapshot.status === 'ready' && snapshot.urn) {
      showStatus({ ...snapshot, status: 'ready' });
      loadUrn(snapshot.urn);
    } else {
      showStatus(snapshot);
    }
  };

  const initRealtime = () => {
    if (typeof io === 'undefined') {
      console.warn('[realtime] socket.io client not available');
      return;
    }
    const socket = io();
    socket.on('model:update', handleSnapshot);
  };

  const bootstrap = async () => {
    initRealtime();
    const ready = await initViewer();
    if (!ready) return;
    try {
      const snapshot = await fetchJson('/api/model');
      handleSnapshot(snapshot);
    } catch (error) {
      console.error('[bootstrap] failed to fetch model state:', error);
      showStatus({ status: 'failed', error: error.message });
    }
  };

  bootstrap();
})();
