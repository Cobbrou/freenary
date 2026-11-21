export const appName = "Freenary";
export const docsRoute = "/docs";

export const gitConfig = {
  user: "suiramdev",
  repo: "freenary",
  branch: "dev",
};

export const docsSourceUrl = (path: string) =>
  `https://github.com/${gitConfig.user}/${gitConfig.repo}/blob/${gitConfig.branch}/docs/${path}`;

export const docsRawUrl = (path: string) =>
  `https://raw.githubusercontent.com/${gitConfig.user}/${gitConfig.repo}/${gitConfig.branch}/docs/${path}`;
