(function () {
  'use strict';

  const viewerContainer = document.getElementById('aps-viewer');
  const statusRoot = document.getElementById('status');
  const statusTitle = statusRoot.querySelector('.status__title');
  const statusMessage = statusRoot.querySelector('.status__message');
  const statusSource = statusRoot.querySelector('.status__source');
  const statusSpinner = statusRoot.querySelector('.status__spinner');

  const STATUS_COPY = {
    idle: { title: 'Preparing model', message: 'Loading the Revit model…' },
    ready: { title: 'Ready', message: 'Loading viewer…' },
    failed: { title: 'Something went wrong', message: 'See details below.' },
  };

  let viewer = null;
  let loadedUrn = null;

  const showStatus = (snapshot) => {
    statusRoot.hidden = false;
    statusSpinner.hidden = snapshot.status === 'failed';
    statusRoot.classList.toggle('is-error', snapshot.status === 'failed');

    const copy = STATUS_COPY[snapshot.status] ?? STATUS_COPY.idle;

    statusTitle.textContent = copy.title;
    let message = copy.message;
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
    const tokenUrl =
      window.__APP_CONFIG__?.tokenUrl || '/api/auth/aps/token';
    fetchJson(tokenUrl)
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
          showStatus({
            status: 'failed',
            error:
              'No viewable geometry found. The model may still be processing in Autodesk Docs.',
          });
          return;
        }
        viewer.loadDocumentNode(doc, geometry).then(hideStatus);
      },
      (code) => {
        console.error('[viewer] document load failure:', code);
        showStatus({
          status: 'failed',
          error:
            `Document load failed (code ${code}). The model may still be processing in Autodesk Docs.`,
        });
      }
    );
  };

  const bootstrap = async () => {
    const config = window.__APP_CONFIG__ || {};
    const backHref = config.backHref || '/hubs';

    if (config.error) {
      showStatus({ status: 'failed', error: config.error });
      statusSource.hidden = false;
      statusSource.innerHTML = `<a href="${backHref}">Back to project</a>`;
      return;
    }

    const model = config.model;
    if (!model?.urn) {
      showStatus({
        status: 'failed',
        error: 'No Revit model selected. Open a .rvt file from a project folder.',
      });
      statusSource.hidden = false;
      statusSource.innerHTML = `<a href="${backHref}">Back to project</a>`;
      return;
    }

    showStatus({
      status: 'ready',
      sourceFileName: model.fileName || null,
    });

    const ready = await initViewer();
    if (!ready) return;

    loadUrn(model.urn);
  };

  bootstrap();
})();
