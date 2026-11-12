/**
 * Display row for one folder or file. The template only chooses the markup.
 */

const isRevitFileName = (fileName) =>
  typeof fileName === 'string' && /\.rvt$/i.test(fileName);

const formatModified = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
};

const projectBase = (hubId, projectId) =>
  `/hubs/${encodeURIComponent(hubId)}/projects/${encodeURIComponent(projectId)}`;

export const toContentEntry = (entry, { hubId, projectId }) => {
  const isFolder = entry.type === 'folders';
  const isRevit = !isFolder && isRevitFileName(entry.name);
  const meta = [];

  if (isFolder) {
    meta.push('Folder');
    if (entry.objectCount != null) meta.push(`${entry.objectCount} item(s)`);
  } else {
    meta.push(entry.fileType || 'File');
  }

  const modified = formatModified(entry.lastModifiedTime);
  if (modified) meta.push(`updated ${modified}`);
  if (entry.lastModifiedUserName) meta.push(`by ${entry.lastModifiedUserName}`);

  const base = projectBase(hubId, projectId);
  const id = encodeURIComponent(entry.id);

  return {
    name: entry.name,
    isFolder,
    isRevit,
    rowClass: isFolder ? 'project-entry project-entry--folder' : 'project-entry',
    meta: meta.join(' · '),
    folderHref: `${base}/folders/${id}`,
    downloadHref: `/api${base}/items/${id}/download`,
    deleteHref: `/api${base}/items/${id}`,
    viewHref: `${base}/items/${id}/view`,
    detailsHref: `${base}/items/${id}/details`,
    viewTitle: `View ${entry.name}`,
    detailsTitle: `Details for ${entry.name}`,
    downloadTitle: `Download ${entry.name}`,
    deleteTitle: `Delete ${entry.name}`,
  };
};
