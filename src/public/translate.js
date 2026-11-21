const PART_RETRIES = 3;

async function putPart(url, body) {
  const res = await fetch(url, { method: 'PUT', body });
  if (!res.ok) throw new Error(`Part upload failed (HTTP ${res.status}).`);
  const etag = res.headers.get('ETag') ?? res.headers.get('etag');
  if (!etag) throw new Error('S3 did not return an ETag (check bucket CORS ETag exposure).');
  return etag.replace(/"/g, '');
}

async function postJson(url, payload) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request to ${url} failed (HTTP ${res.status}).`);
  return data;
}

/**
 * Uploads a pre-built composite ZIP straight to S3 via service-brokered signed
 * URLs, then asks the service to finalize and start the SVF2 translation.
 * @param {Blob} file the .zip selected by the user
 * @param {string} rootFilename the host .rvt name inside the zip
 * @param {(pct: number) => void} [onProgress]
 * @returns {Promise<string>} the derivative URN
 */
export async function uploadAndTranslate(file, rootFilename, onProgress) {
  const { objectKey, uploadKey, urls, partSize } = await postJson('/api/translate/uploads', {
    rootFilename,
    size: file.size,
  });

  const eTags = [];
  for (let i = 0; i < urls.length; i += 1) {
    const start = i * partSize;
    const chunk = file.slice(start, Math.min(start + partSize, file.size));
    let lastErr;
    for (let attempt = 0; attempt < PART_RETRIES; attempt += 1) {
      try {
        eTags[i] = await putPart(urls[i], chunk);
        lastErr = undefined;
        break;
      } catch (err) {
        lastErr = err;
      }
    }
    if (lastErr) throw lastErr;
    onProgress?.(Math.round(((i + 1) / urls.length) * 100));
  }

  const { urn } = await postJson('/api/translate/uploads/complete', {
    objectKey,
    uploadKey,
    size: file.size,
    eTags,
    rootFilename,
  });
  return urn;
}
