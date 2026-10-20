export interface AuthCookieOrigins {
  authUrl: string;
  webOrigin: string;
  isProduction: boolean;
  cookieDomain: string | undefined;
}

export interface AuthCookiePolicy {
  httpOnly: true;
  sameSite: "lax" | "none";
  secure: boolean;
}

const LEADING_DOT = /^\./u;

export const resolveCookiePolicy = ({
  authUrl,
  webOrigin,
  isProduction,
  cookieDomain,
}: AuthCookieOrigins): AuthCookiePolicy => {
  const api = new URL(authUrl);
  const web = new URL(webOrigin);
  const declaredParent = cookieDomain?.toLowerCase().replace(LEADING_DOT, "");
  const isParentOfHost = (host: string) =>
    declaredParent !== undefined &&
    (host === declaredParent || host.endsWith(`.${declaredParent}`));

  if (declaredParent !== undefined) {
    if (declaredParent.endsWith(".")) {
      throw new Error(
        `AUTH_COOKIE_DOMAIN (${cookieDomain}) ends in a dot, which browsers do not strip, so no host would match it. Drop the trailing dot.`
      );
    }

    if (!declaredParent.includes(".")) {
      throw new Error(
        `AUTH_COOKIE_DOMAIN (${cookieDomain}) is a single label, which browsers treat as a public suffix and refuse to scope a cookie to. Declare the domain both origins sit under, e.g. ".example.com".`
      );
    }

    if (
      !(
        isParentOfHost(api.hostname.toLowerCase()) &&
        isParentOfHost(web.hostname.toLowerCase())
      )
    ) {
      throw new Error(
        `AUTH_COOKIE_DOMAIN (${cookieDomain}) is not a parent of both ${api.hostname} and ${web.hostname}, so browsers would drop the session cookie. Declare the domain both origins sit under, or leave it unset.`
      );
    }
  }

  const isProvablySameSite =
    declaredParent !== undefined || api.hostname === web.hostname;

  const secure = api.protocol === "https:";

  if (!(isProvablySameSite || secure)) {
    const message = `The API (${api.origin}) and the web app (${web.origin}) are on different hosts, so the session cookie needs SameSite=None — which browsers reject over plain HTTP. Serve BETTER_AUTH_URL over HTTPS, put both behind one hostname, or set AUTH_COOKIE_DOMAIN to the parent domain they share.`;

    if (isProduction) {
      throw new Error(message);
    }

    console.warn(`[auth] ${message}`);
  }

  return {
    httpOnly: true,
    sameSite: isProvablySameSite ? "lax" : "none",
    secure,
  };
};
