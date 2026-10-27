/**
 * Anti-corruption layer: maps raw APS JSON:API resources into small, stable
 * shapes the rest of the app depends on. Keeping this isolated means changes to
 * the APS wire format only ripple through this one module.
 */

export const mapHub = (hub) => ({
  id: hub.id,
  name: hub.attributes?.name ?? hub.id,
  region: hub.attributes?.region ?? null,
});

export const mapProject = (project) => ({
  id: project.id,
  name: project.attributes?.name ?? project.id,
});

export const mapProjectDetails = (project) => ({
  id: project.id,
  name: project.attributes?.name ?? project.id,
  scopes: project.attributes?.scopes ?? [],
  extensionType: project.attributes?.extension?.type ?? null,
  extensionData: project.attributes?.extension?.data ?? null,
});

/** Normalizes a folder resource (top folder or nested folder). */
export const mapFolder = (folder) => ({
  id: folder.id,
  name: folder.attributes?.displayName ?? folder.attributes?.name ?? folder.id,
  objectCount: folder.attributes?.objectCount ?? null,
  hidden: folder.attributes?.hidden ?? false,
  createTime: folder.attributes?.createTime ?? null,
  lastModifiedTime: folder.attributes?.lastModifiedTime ?? null,
});

/** Normalizes an item or folder returned inside a folder's contents. */
export const mapContentEntry = (entry) => ({
  id: entry.id,
  // 'folders' | 'items'
  type: entry.type,
  name: entry.attributes?.displayName ?? entry.attributes?.name ?? entry.id,
  fileType: entry.attributes?.extension?.type ?? null,
  // Present on folders: number of children (files + subfolders).
  objectCount: entry.attributes?.objectCount ?? null,
  createTime: entry.attributes?.createTime ?? null,
  createUserName: entry.attributes?.createUserName ?? null,
  lastModifiedTime: entry.attributes?.lastModifiedTime ?? null,
  lastModifiedUserName: entry.attributes?.lastModifiedUserName ?? null,
});
