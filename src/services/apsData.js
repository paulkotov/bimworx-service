import { DataManagementClient } from '@aps_sdk/data-management';

const dataClient = new DataManagementClient();

const sanitizeApsError = (cause, publicMessage) => {
  const err = new Error(cause?.message ?? 'APS Data Management request failed');
  err.status = 502;
  err.publicMessage = publicMessage;
  return err;
};

export const mapHub = (hub) => ({
  id: hub.id,
  name: hub.attributes?.name ?? hub.id,
  region: hub.attributes?.region ?? null,
});

export const mapProject = (project) => ({
  id: project.id,
  name: project.attributes?.name ?? project.id,
});

/**
 * @returns {Promise<{ hubs: Array<{id,name,region}>, warnings: Array<{code,title,detail}> }>}
 */
export const listHubsWithMeta = async (accessToken) => {
  try {
    const resp = await dataClient.getHubs({ accessToken });
    const hubs = (resp.data ?? []).map(mapHub);
    const warnings = (resp.meta?.warnings ?? []).map((w) => ({
      code: w.ErrorCode ?? w.errorCode ?? null,
      title: w.Title ?? w.title ?? null,
      detail: w.Detail ?? w.detail ?? null,
    }));
    return { hubs, warnings };
  } catch (cause) {
    throw sanitizeApsError(cause, 'Failed to list Autodesk hubs.');
  }
};

export const listHubs = async (accessToken) => {
  const { hubs } = await listHubsWithMeta(accessToken);
  return hubs;
};

export const listProjects = async (hubId, accessToken) => {
  try {
    const resp = await dataClient.getHubProjects(hubId, { accessToken });
    return (resp.data ?? []).map(mapProject);
  } catch (cause) {
    throw sanitizeApsError(cause, 'Failed to list Autodesk projects.');
  }
};
