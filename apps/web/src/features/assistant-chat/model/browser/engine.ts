import type { WebWorkerMLCEngine } from "@mlc-ai/web-llm";
import { Data, Effect, Predicate, Result } from "effect";
import { useSyncExternalStore } from "react";

import { WebLlmLanguageModel } from "./language-model";
import { browserModels } from "./models";
import type { BrowserModel } from "./models";
// eslint-disable-next-line import/default -- Vite's `?worker` import yields a Worker constructor the import plugin cannot see
import EngineWorker from "./worker?worker";

export type BrowserModelStatus =
  | { phase: "idle" }
  | { phase: "loading"; modelId: string; progress: number; text: string }
  | { phase: "ready"; modelId: string }
  | { phase: "error"; modelId: string; message: string };

interface LoadProgress {
  progress: number;
  text: string;
}

interface SharedEngine {
  engine: WebWorkerMLCEngine | null;
  languageModel: WebLlmLanguageModel | null;
  status: BrowserModelStatus;
}

class BrowserModelLoadFailed extends Data.TaggedError(
  "BrowserModelLoadFailed"
)<{
  readonly modelId: string;
  readonly cause: unknown;
}> {}

const IDLE: BrowserModelStatus = { phase: "idle" };

export const CONTEXT_WINDOW_SIZE = 8192;

const shared: SharedEngine = {
  engine: null,
  languageModel: null,
  status: IDLE,
};

const listeners = new Set<() => void>();

const setStatus = (next: BrowserModelStatus) => {
  shared.status = next;

  for (const listener of listeners) {
    listener();
  }
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};

const readStatus = () => shared.status;

const idleUntilHydrated = () => IDLE;

export const useBrowserModel = (): BrowserModelStatus =>
  useSyncExternalStore(subscribe, readStatus, idleUntilHydrated);

const hasWebGpu = (): boolean => Predicate.hasProperty(navigator, "gpu");

const unknownUntilHydrated = () => null;

export const useWebGpuSupport = (): boolean | null =>
  useSyncExternalStore(subscribe, hasWebGpu, unknownUntilHydrated);

const importWebLlm = () => import("@mlc-ai/web-llm");

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

export const browserLanguageModel = (): WebLlmLanguageModel | null =>
  shared.status.phase === "ready" ? shared.languageModel : null;

const chatOptions = { context_window_size: CONTEXT_WINDOW_SIZE };

const engineFor = Effect.fnUntraced(function* engineFor(
  modelId: string,
  report: (progress: LoadProgress) => void
) {
  const { CreateWebWorkerMLCEngine } = yield* Effect.tryPromise({
    catch: (cause) => new BrowserModelLoadFailed({ cause, modelId }),
    try: () => importWebLlm(),
  });

  const running = shared.engine;

  if (running) {
    running.setInitProgressCallback(report);

    yield* Effect.tryPromise({
      catch: (cause) => new BrowserModelLoadFailed({ cause, modelId }),
      try: () => running.reload(modelId, chatOptions),
    });

    return running;
  }

  return yield* Effect.tryPromise({
    catch: (cause) => new BrowserModelLoadFailed({ cause, modelId }),
    try: () =>
      CreateWebWorkerMLCEngine(
        new EngineWorker(),
        modelId,
        { initProgressCallback: report, logLevel: "WARN" },
        chatOptions
      ),
  });
});

const discardHalfLoadedEngine = (modelId: string) =>
  Effect.ignore(
    Effect.suspend(() => {
      const running = shared.engine;

      return running === null
        ? Effect.void
        : Effect.tryPromise({
            catch: (cause) => new BrowserModelLoadFailed({ cause, modelId }),
            try: () => running.unload(),
          });
    })
  );

const messageOf = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause);

export const loadBrowserModel = async (modelId: string): Promise<void> => {
  if (shared.status.phase === "loading") {
    return;
  }

  if (shared.languageModel?.modelId === modelId) {
    setStatus({ modelId, phase: "ready" });

    return;
  }

  setStatus({ modelId, phase: "loading", progress: 0, text: "" });
  shared.languageModel = null;

  const report = ({ progress, text }: LoadProgress) => {
    setStatus({ modelId, phase: "loading", progress, text });
  };

  const loaded = await Effect.runPromise(
    Effect.result(
      engineFor(modelId, report).pipe(
        Effect.onError(() => discardHalfLoadedEngine(modelId))
      )
    )
  );

  if (Result.isFailure(loaded)) {
    setStatus({
      message: messageOf(loaded.failure.cause),
      modelId,
      phase: "error",
    });

    return;
  }

  shared.engine = loaded.success;
  shared.languageModel = new WebLlmLanguageModel(loaded.success, modelId);
  setStatus({ modelId, phase: "ready" });
};
