(function () {
  'use strict';

  const status = document.getElementById('upload-status');

  const setStatus = (text, isError) => {
    if (!status) return;
    status.hidden = false;
    status.textContent = text;
    status.classList.toggle('is-error', Boolean(isError));
  };

  const readError = async (res) => {
    let message = 'HTTP ' + res.status;
    try {
      const body = await res.json();
      if (body && body.error) message = body.error;
    } catch (_) {
      /* ignore non-JSON bodies */
    }
    return message;
  };

  // --- Upload ---------------------------------------------------------------
  const initUpload = () => {
    const endpoint = window.__UPLOAD_ENDPOINT__;
    const btn = document.getElementById('upload-btn');
    const input = document.getElementById('upload-input');
    if (!endpoint || !btn || !input) return;

    const putPart = async (uploadId, index, chunk) => {
      const url = endpoint + '/part?uploadId=' + encodeURIComponent(uploadId) + '&index=' + index;
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: chunk,
      });
      if (!res.ok) throw new Error(await readError(res));
    };

    const uploadOne = async (file) => {
      const initRes = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ name: file.name, size: file.size }),
      });
      if (!initRes.ok) throw new Error(await readError(initRes));
      const session = await initRes.json();
      const parts = Number(session.parts);
      const partSize = Number(session.partSize);
      if (!parts || !partSize || !session.uploadId) {
        throw new Error('Upload could not be started.');
      }

      for (let index = 0; index < parts; index += 1) {
        const start = index * partSize;
        const chunk = file.slice(start, Math.min(start + partSize, file.size));
        let lastErr;
        for (let attempt = 0; attempt < 3; attempt += 1) {
          try {
            await putPart(session.uploadId, index, chunk);
            lastErr = undefined;
            break;
          } catch (err) {
            lastErr = err;
          }
        }
        if (lastErr) throw lastErr;
        const percent = Math.round(((index + 1) / parts) * 100);
        setStatus('Uploading ' + file.name + '… ' + percent + '%', false);
      }

      const doneRes = await fetch(endpoint + '/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ uploadId: session.uploadId }),
      });
      if (!doneRes.ok) throw new Error(await readError(doneRes));
    };

    btn.addEventListener('click', () => input.click());

    input.addEventListener('change', async () => {
      const files = Array.from(input.files || []);
      if (!files.length) return;

      btn.disabled = true;
      let done = 0;

      for (const file of files) {
        setStatus(
          'Uploading ' + file.name + ' (' + (done + 1) + '/' + files.length + ')…',
          false,
        );
        try {
          await uploadOne(file);
          done += 1;
        } catch (err) {
          setStatus('Failed to upload ' + file.name + ': ' + err.message, true);
          btn.disabled = false;
          input.value = '';
          return;
        }
      }

      setStatus('Uploaded ' + done + ' file(s). Refreshing…', false);
      window.location.reload();
    });
  };

  // --- Delete ---------------------------------------------------------------
  const initDelete = () => {
    const list = document.querySelector('.project-contents');
    if (!list) return;

    list.addEventListener('click', async (event) => {
      const btn = event.target.closest('[data-delete-url]');
      if (!btn || btn.disabled) return;

      const url = btn.getAttribute('data-delete-url');
      const name = btn.getAttribute('data-delete-name') || 'this file';
      if (!url) return;

      const confirmed = window.confirm(
        'Delete "' + name + '"? It will be moved to the BIM 360 trash.',
      );
      if (!confirmed) return;

      btn.disabled = true;
      setStatus('Deleting ' + name + '…', false);

      try {
        const res = await fetch(url, { method: 'DELETE' });
        if (!res.ok) throw new Error(await readError(res));
        setStatus('Deleted ' + name + '. Refreshing…', false);
        window.location.reload();
      } catch (err) {
        setStatus('Failed to delete ' + name + ': ' + err.message, true);
        btn.disabled = false;
      }
    });
  };

  initUpload();
  initDelete();
})();
