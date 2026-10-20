export const appName = "Freenary";
export const docsRoute = "/docs";
export const docsImageRoute = "/og/docs";

export const gitConfig = {
  user: "suiramdev",
  repo: "freenary",
  branch: "dev",
  releaseBranch: "main",
};

export const repoBlobUrl = (ref: string) =>
  `https://github.com/${gitConfig.user}/${gitConfig.repo}/blob/${ref}/`;

export const repoRawUrl = (ref: string) =>
  `https://raw.githubusercontent.com/${gitConfig.user}/${gitConfig.repo}/${ref}/`;
