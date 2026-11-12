const warningText = (warning) => {
  const head = `${warning.code || 'WARNING'}: ${warning.title || ''}`;
  return warning.detail ? `${head} — ${warning.detail}` : head;
};

export const toHubsPage = ({ hubs, warnings, error }) => ({
  title: 'BimWorx · ACC hubs',
  error,
  isEmpty: !error && !(hubs?.length),
  hasWarnings: Boolean(warnings?.length),
  warnings: (warnings ?? []).map((warning) => ({ text: warningText(warning) })),
  hubs: (hubs ?? []).map((hub) => ({
    name: hub.name,
    meta: hub.region ? `${hub.id} · ${hub.region}` : String(hub.id),
    projectsError: Boolean(hub.projectsError),
    isEmpty: !hub.projectsError && !(hub.projects?.length),
    projects: (hub.projects ?? []).map((project) => ({
      name: project.name,
      id: project.id,
      href: `/hubs/${encodeURIComponent(hub.id)}/projects/${encodeURIComponent(project.id)}`,
    })),
  })),
});
