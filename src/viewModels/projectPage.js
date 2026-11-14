import { toContentEntry } from './contentEntry.js';

const dash = (value) => (value == null || value === '' ? '—' : String(value));

const toFolder = (folder, ids) => ({
  name: folder.name,
  countLabel: folder.objectCount == null ? null : `${folder.objectCount} item(s)`,
  contentsError: folder.contentsError || null,
  isEmpty: !folder.contentsError && !(folder.contents?.length),
  entries: (folder.contents ?? []).map((entry) => toContentEntry(entry, ids)),
});

export const toProjectPage = ({ hubId, projectId, overview, error }) => {
  const project = overview?.project ?? null;
  const fields = [];

  if (project) {
    fields.push(
      { label: 'Type', value: dash(project.extensionType) },
      {
        label: 'Scopes',
        value: project.scopes?.length ? project.scopes.join(', ') : '—',
      },
    );
    if (project.extensionData?.projectType) {
      fields.push({ label: 'Project type', value: String(project.extensionData.projectType) });
    }
  }

  const folders = (overview?.folders ?? []).map((folder) =>
    toFolder(folder, { hubId, projectId }),
  );

  return {
    title: project?.name ? `BimWorx · ${project.name}` : 'BimWorx · Project',
    error,
    projectName: project?.name ?? 'Project',
    projectId: project?.id ?? '',
    fields,
    hasFolders: folders.length > 0,
    folders,
  };
};
