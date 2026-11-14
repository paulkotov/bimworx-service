(function () {
  'use strict';

  const endpoint = window.__DETAILS_ENDPOINT__;
  const result = document.getElementById('model-details-result');
  const fileName = document.getElementById('model-details-name');
  const crumb = document.getElementById('model-details-crumb');

  if (!endpoint || !result) return;

  const showError = (message) => {
    result.replaceChildren();
    const section = document.createElement('section');
    section.className = 'hubs-card is-error';
    const heading = document.createElement('h2');
    heading.textContent = 'Could not load model details';
    const text = document.createElement('p');
    text.textContent = message;
    section.append(heading, text);
    result.append(section);
  };

  const apply = (body) => {
    if (!body || typeof body.html !== 'string') {
      showError('Failed to load model details.');
      return;
    }
    if (typeof body.fileName === 'string' && body.fileName) {
      if (fileName) fileName.textContent = body.fileName;
      if (crumb) crumb.textContent = body.fileName;
    }
    if (typeof body.title === 'string' && body.title) {
      document.title = body.title;
    }
    result.innerHTML = body.html;
  };

  fetch(endpoint, { headers: { Accept: 'application/json' } })
    .then(async (response) => {
      let body = null;
      try {
        body = await response.json();
      } catch {
        body = null;
      }
      if (!response.ok) {
        showError(body && body.error ? body.error : 'Failed to load model details.');
        return;
      }
      apply(body);
    })
    .catch(() => {
      showError('Failed to load model details.');
    });
})();
