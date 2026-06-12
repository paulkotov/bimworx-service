import path from 'path';
import { fileURLToPath } from 'url';

export const resolveDirname = (importMetaUrl) =>
  path.dirname(fileURLToPath(importMetaUrl));

export const projectSrcDir = path.dirname(resolveDirname(import.meta.url));
export const publicDir = path.join(projectSrcDir, 'public');
