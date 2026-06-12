import { Readable } from 'node:stream';
import { env } from '../config/env.js';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';

const FIELDS = [
  'id',
  'name',
  'mimeType',
  'size',
  'modifiedTime',
  'md5Checksum',
  'sha1Checksum',
  'fileExtension',
].join(',');

const ensureOk = async (response, action) => {
  if (response.ok) return response;
  const body = await response.text().catch(() => '');
  throw new Error(
    `Google Drive ${action} failed (${response.status} ${response.statusText}): ${body}`
  );
};

const matchesExtension = (file) => {
  const exts = env.googleDrive.fileExtensions;
  if (!exts.length) return true;
  const name = (file.name ?? '').toLowerCase();
  return exts.some((ext) => name.endsWith(ext));
};

/**
 * Lists `.rvt`-like files inside the configured public folder.
 * Excludes anything in trash and any sub-folders.
 *
 * Requires the folder to be shared as "Anyone with the link can view".
 */
export const listFolderFiles = async () => {
  const q = [
    `'${env.googleDrive.folderId}' in parents`,
    'trashed = false',
    "mimeType != 'application/vnd.google-apps.folder'",
  ].join(' and ');

  const params = new URLSearchParams({
    q,
    fields: `files(${FIELDS})`,
    pageSize: '100',
    orderBy: 'modifiedTime desc',
    key: env.googleDrive.apiKey,
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
  });

  const response = await fetch(`${DRIVE_API}/files?${params}`);
  await ensureOk(response, 'listFolderFiles');
  const body = await response.json();
  return (body.files ?? []).filter(matchesExtension);
};

/**
 * Picks the latest CAD/BIM file in the folder (by modifiedTime).
 */
export const pickLatestFile = async () => {
  const files = await listFolderFiles();
  return files[0] ?? null;
};

/**
 * Streams a public Drive file's bytes.
 *
 * Returns a Node Readable + the Content-Length (if Drive provided one).
 */
export const downloadFile = async (fileId) => {
  const params = new URLSearchParams({
    alt: 'media',
    key: env.googleDrive.apiKey,
    supportsAllDrives: 'true',
  });

  const response = await fetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?${params}`);
  await ensureOk(response, 'downloadFile');

  const contentLength = Number.parseInt(response.headers.get('content-length') ?? '0', 10) || null;
  if (!response.body) {
    throw new Error('Google Drive responded without a body stream.');
  }

  return {
    stream: Readable.fromWeb(response.body),
    contentLength,
  };
};

export const downloadFileBuffer = async (fileId) => {
  const { stream, contentLength } = await downloadFile(fileId);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const buffer = Buffer.concat(chunks);
  return { buffer, size: contentLength ?? buffer.length };
};
