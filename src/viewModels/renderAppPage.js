const LINK = 'app-header__link';

/** Header fields shared by every server-rendered page. */
export const pageChrome = (activeNav, authenticated) => ({
  brandHref: authenticated ? '/hubs' : '/login',
  hubsClass: activeNav === 'hubs' ? `${LINK} is-active` : LINK,
  loginClass: activeNav === 'login' ? `${LINK} is-active` : LINK,
});

export const renderAppPage = (res, view, locals) => {
  res.render(view, {
    ...locals,
    ...pageChrome(locals.activeNav, Boolean(res.locals.authenticated)),
  });
};
