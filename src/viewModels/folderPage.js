import { toContentEntry } from './contentEntry.js';

const projectBase = (hubId, projectId) =>
  `/hubs/${encodeURIComponent(hubId)}/projects/${encodeURIComponent(projectId)}`;

const summaryOf = (contents) => {
  const folderCount = contents.filter((entry) => entry.type === 'folders').length;
  const parts = [];
  if (folderCount) parts.push(`${folderCount} folder(s)`);
  parts.push(`${contents.length - folderCount} file(s)`);
  return parts.join(' · ');
};

export const toFolderPage = ({ hubId, projectId, view, error }) => {
  const projectHref = projectBase(hubId, projectId);
  const parentHref = view?.parent
    ? `${projectHref}/folders/${encodeURIComponent(view.parent.id)}`
    : null;
  const contents = view?.contents ?? [];
  const folderId = view?.folder?.id;

  return {
    title: view?.folder?.name ? `BimWorx · ${view.folder.name}` : 'BimWorx · Folder',
    error,
    projectHref,
    parentHref,
    showParent: Boolean(parentHref),
    parentName: view?.parent?.name ?? '',
    folderName: view?.folder?.name ?? 'Folder',
    summary: summaryOf(contents),
    isEmpty: contents.length === 0,
    showUpload: !error && Boolean(folderId),
    uploadEndpoint: folderId
      ? `/api${projectHref}/folders/${encodeURIComponent(folderId)}/upload`
      : '',
    entries: contents.map((entry) => toContentEntry(entry, { hubId, projectId })),
  };
};
