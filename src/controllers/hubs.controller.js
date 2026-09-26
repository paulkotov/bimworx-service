import { listHubs, listProjects } from '../services/apsData.js';

export const getHubs = async (req, res, next) => {
  try {
    const hubs = await listHubs(req.apsAccessToken);
    res.json(hubs);
  } catch (err) {
    next(err);
  }
};

export const getHubProjects = async (req, res, next) => {
  try {
    const projects = await listProjects(req.params.hubId, req.apsAccessToken);
    res.json(projects);
  } catch (err) {
    next(err);
  }
};
