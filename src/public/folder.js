(function () {
  'use strict';

  const endpoint = window.__UPLOAD_ENDPOINT__;
  const btn = document.getElementById('upload-btn');
  const input = document.getElementById('upload-input');
  const status = document.getElementById('upload-status');

  if (!endpoint || !btn || !input || !status) return;

  const setStatus = (text, isError) => {
    status.hidden = false;
    status.textContent = text;
    status.classList.toggle('is-error', Boolean(isError));
  };

  const uploadOne = async (file) => {
    const url = endpoint + '?name=' + encodeURIComponent(file.name);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: file,
    });
    if (!res.ok) {
      let message = 'HTTP ' + res.status;
      try {
        const body = await res.json();
        if (body && body.error) message = body.error;
      } catch (_) {
        /* ignore */
      }
      throw new Error(message);
    }
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
})();
