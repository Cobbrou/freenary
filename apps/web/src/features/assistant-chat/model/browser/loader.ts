import { Data, Effect, Result } from "effect";

export type BrowserModelStatus =
  | { phase: "idle" }
  | { phase: "loading"; modelId: string; progress: number; text: string }
  | { phase: "ready"; modelId: string }
  | { phase: "error"; modelId: string; message: string }
  | { phase: "cancelled"; modelId: string };

export interface LoadProgress {
  progress: number;
  text: string;
}

type Report = (progress: LoadProgress) => void;

export interface LoadableEngine {
  setInitProgressCallback: (report: Report) => void;
  unload: () => Promise<void>;
}

export interface EngineWorker {
  terminate: () => void;
}

export interface EngineSource<
  Worker extends EngineWorker,
  Engine extends LoadableEngine,
  Model extends { modelId: string },
> {
  create: (worker: Worker, modelId: string, report: Report) => Promise<Engine>;
  reload: (engine: Engine, modelId: string) => Promise<void>;
  spawnWorker: () => Worker;
  wrap: (engine: Engine, modelId: string) => Model;
}

class BrowserModelLoadFailed extends Data.TaggedError(
  "BrowserModelLoadFailed"
)<{
  readonly modelId: string;
  readonly cause: unknown;
}> {}

const IDLE: BrowserModelStatus = { phase: "idle" };

const failed = (modelId: string) => (cause: unknown) =>
  new BrowserModelLoadFailed({ cause, modelId });

const messageOf = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause);

export const createBrowserModelLoader = <
  Worker extends EngineWorker,
  Engine extends LoadableEngine,
  Model extends { modelId: string },
>(
  source: EngineSource<Worker, Engine, Model>
) => {
  let engine: Engine | null = null;
  let model: Model | null = null;
  let worker: Worker | null = null;
  let status: BrowserModelStatus = IDLE;
  let loads = 0;
  const listeners = new Set<() => void>();

  const setStatus = (next: BrowserModelStatus) => {
    status = next;

    for (const listener of listeners) {
      listener();
    }
  };

  const engineFor = Effect.fnUntraced(function* engineFor(
    modelId: string,
    report: Report
  ) {
    const running = engine;

    if (running) {
      running.setInitProgressCallback(report);

      yield* Effect.tryPromise({
        catch: failed(modelId),
        try: () => source.reload(running, modelId),
      });

      return running;
    }

    return yield* Effect.tryPromise({
      catch: failed(modelId),
      try: () => {
        worker = source.spawnWorker();

        return source.create(worker, modelId, report);
      },
    });
  });

  const discardHalfLoadedEngine = (modelId: string) =>
    Effect.ignore(
      Effect.suspend(() => {
        const running = engine;

        return running === null
          ? Effect.void
          : Effect.tryPromise({
              catch: failed(modelId),
              try: () => running.unload(),
            });
      })
    );

  const load = async (modelId: string): Promise<void> => {
    if (status.phase === "loading") {
      return;
    }

    if (model?.modelId === modelId) {
      setStatus({ modelId, phase: "ready" });

      return;
    }

    loads += 1;
    const thisLoad = loads;
    const current = () => loads === thisLoad;

    setStatus({ modelId, phase: "loading", progress: 0, text: "" });
    model = null;

    const report = ({ progress, text }: LoadProgress) => {
      if (current()) {
        setStatus({ modelId, phase: "loading", progress, text });
      }
    };

    const loaded = await Effect.runPromise(
      Effect.result(
        engineFor(modelId, report).pipe(
          Effect.onError(() =>
            current() ? discardHalfLoadedEngine(modelId) : Effect.void
          )
        )
      )
    );

    if (!current()) {
      return;
    }

    if (Result.isFailure(loaded)) {
      setStatus({
        message: messageOf(loaded.failure.cause),
        modelId,
        phase: "error",
      });

      return;
    }

    engine = loaded.success;
    model = source.wrap(loaded.success, modelId);
    setStatus({ modelId, phase: "ready" });
  };

  const cancel = (): void => {
    if (status.phase !== "loading") {
      return;
    }

    loads += 1;
    worker?.terminate();
    worker = null;
    engine = null;
    model = null;
    setStatus({ modelId: status.modelId, phase: "cancelled" });
  };

  return {
    cancel,
    load,
    model: (): Model | null => (status.phase === "ready" ? model : null),
    status: (): BrowserModelStatus => status,
    subscribe: (listener: () => void) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };
};
