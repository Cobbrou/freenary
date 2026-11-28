import { Predicate } from "effect";
import { useSyncExternalStore } from "react";

import { WebLlmLanguageModel } from "./language-model";
import { createBrowserModelLoader } from "./loader";
import type { BrowserModelStatus } from "./loader";
import { browserModels } from "./models";
import type { BrowserModel } from "./models";
// eslint-disable-next-line import/default -- Vite's `?worker` import yields a Worker constructor the import plugin cannot see
import EngineWorker from "./worker?worker";

export type { BrowserModelStatus } from "./loader";

export const CONTEXT_WINDOW_SIZE = 8192;

const chatOptions = { context_window_size: CONTEXT_WINDOW_SIZE };

const importWebLlm = () => import("@mlc-ai/web-llm");

const loader = createBrowserModelLoader({
  create: async (worker: Worker, modelId, report) => {
    const { CreateWebWorkerMLCEngine } = await importWebLlm();

    return CreateWebWorkerMLCEngine(
      worker,
      modelId,
      { initProgressCallback: report, logLevel: "WARN" },
      chatOptions
    );
  },
  reload: (engine, modelId) => engine.reload(modelId, chatOptions),
  spawnWorker: () => new EngineWorker(),
  wrap: (engine, modelId) => new WebLlmLanguageModel(engine, modelId),
});

const IDLE: BrowserModelStatus = { phase: "idle" };

const idleUntilHydrated = () => IDLE;

export const useBrowserModel = (): BrowserModelStatus =>
  useSyncExternalStore(loader.subscribe, loader.status, idleUntilHydrated);

const hasWebGpu = (): boolean => Predicate.hasProperty(navigator, "gpu");

const unknownUntilHydrated = () => null;

export const useWebGpuSupport = (): boolean | null =>
  useSyncExternalStore(loader.subscribe, hasWebGpu, unknownUntilHydrated);

export const BROWSER_MODELS_QUERY_KEY = ["assistant", "browser-models"];

export const browserModelCatalog = async (): Promise<BrowserModel[]> => {
  const [{ prebuiltAppConfig }, adapter] = await Promise.all([
    importWebLlm(),
    navigator.gpu.requestAdapter(),
  ]);

  return browserModels(
    prebuiltAppConfig,
    adapter?.features.has("shader-f16") ?? false,
    CONTEXT_WINDOW_SIZE
  );
};

export const browserLanguageModel = loader.model;

export const loadBrowserModel = loader.load;

export const cancelBrowserModelLoad = loader.cancel;
