import { env } from "@freenary/env/web";

import { isServer } from "../lib/is-server";

const SERVER_URL_GLOBAL = "__FREENARY_SERVER_URL__";
const VERCEL_PRODUCTION = "production";
const LOCAL_SERVER_ORIGIN = "http://localhost:3000";

// SAFETY: globalThis may carry a Node-style process.env; the cast only widens it to that optional shape
const processEnv = (
  globalThis as { process?: { env?: Record<string, string | undefined> } }
).process?.env;

const stripTrailingSlash = (url: string) =>
  url.endsWith("/") ? url.slice(0, -1) : url;

const escapeForInlineScript = (url: string) =>
  JSON.stringify(url).replaceAll("<", "\\u003c");

export const getPublicServerUrl = (): string | undefined => {
  if (!isServer) {
    return window[SERVER_URL_GLOBAL];
  }

  const requestTimeUrl = processEnv?.PUBLIC_SERVER_URL;

  if (!requestTimeUrl) {
    return undefined;
  }

  if (!URL.canParse(requestTimeUrl)) {
    throw new Error(
      `PUBLIC_SERVER_URL must be an absolute URL such as https://api.example.com, got "${requestTimeUrl}"`
    );
  }

  return stripTrailingSlash(requestTimeUrl);
};

export const getInternalServerUrl = (): string | undefined => {
  const internalUrl = processEnv?.SERVER_URL;

  return internalUrl ? stripTrailingSlash(internalUrl) : undefined;
};

export const getServerUrl = (): string => {
  const internalUrl = isServer ? getInternalServerUrl() : undefined;

  if (internalUrl) {
    return internalUrl;
  }

  const publicUrl = getPublicServerUrl();

  if (publicUrl) {
    return publicUrl;
  }

  const buildTimeUrl = stripTrailingSlash(env.VITE_SERVER_URL);
  const isRelativeToDeploymentOrigin = buildTimeUrl.startsWith("/");

  if (!isRelativeToDeploymentOrigin) {
    return buildTimeUrl;
  }

  if (!isServer) {
    return `${window.location.origin}${buildTimeUrl}`;
  }

  const vercelUrl =
    processEnv?.VERCEL_ENV === VERCEL_PRODUCTION
      ? (processEnv?.VERCEL_PROJECT_PRODUCTION_URL ?? processEnv?.VERCEL_URL)
      : (processEnv?.VERCEL_URL ?? processEnv?.VERCEL_PROJECT_PRODUCTION_URL);

  if (vercelUrl) {
    const origin = vercelUrl.startsWith("http")
      ? vercelUrl
      : `https://${vercelUrl}`;

    return `${origin}${buildTimeUrl}`;
  }

  return `${LOCAL_SERVER_ORIGIN}${buildTimeUrl}`;
};

export const publicServerUrlScript = (): string | undefined => {
  const url = getPublicServerUrl();

  if (!url) {
    return undefined;
  }

  return `window.${SERVER_URL_GLOBAL}=${escapeForInlineScript(url)}`;
};

declare global {
  interface Window {
    __FREENARY_SERVER_URL__?: string;
  }
}
