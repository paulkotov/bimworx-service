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

    const uploadOne = async (file) => {
      const url = endpoint + '?name=' + encodeURIComponent(file.name);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: file,
      });
      if (!res.ok) throw new Error(await readError(res));
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
