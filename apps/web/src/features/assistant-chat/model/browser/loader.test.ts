import { describe, expect, it } from "bun:test";

import { createBrowserModelLoader } from "./loader";
import type { LoadProgress } from "./loader";

const QWEN = "Qwen3-4B-q4f16_1-MLC";
const LLAMA = "Llama-3.2-3B-Instruct-q4f16_1-MLC";

class FakeWorker {
  terminated = false;

  terminate() {
    this.terminated = true;
  }
}

interface FakeEngine {
  setInitProgressCallback: () => void;
  unload: () => Promise<void>;
}

interface Start {
  finish: () => void;
  modelId: string;
  report: (progress: LoadProgress) => void;
  worker: FakeWorker;
}

const fakeLoader = () => {
  const engine: FakeEngine = {
    setInitProgressCallback: () => null,
    unload: () => Promise.resolve(),
  };

  let next = Promise.withResolvers<Start>();

  const loader = createBrowserModelLoader({
    create: (worker: FakeWorker, modelId, report) => {
      const done = Promise.withResolvers<FakeEngine>();
      const started = next;
      next = Promise.withResolvers<Start>();
      started.resolve({
        finish: () => done.resolve(engine),
        modelId,
        report,
        worker,
      });

      return done.promise;
    },
    reload: () => Promise.withResolvers<undefined>().promise,
    spawnWorker: () => new FakeWorker(),
    wrap: (_engine, modelId) => ({ modelId }),
  });

  const start = async (modelId: string) => {
    const started = next.promise;
    const loading = loader.load(modelId);

    return { loading, ...(await started) };
  };

  return { loader, start };
};

describe("createBrowserModelLoader", () => {
  it("cancels a load, frees its worker and ignores what the load does next", async () => {
    const { loader, start } = fakeLoader();
    const load = await start(QWEN);

    loader.cancel();

    expect(load.worker.terminated).toBe(true);
    expect(loader.status()).toEqual({ modelId: QWEN, phase: "cancelled" });

    load.report({ progress: 0.5, text: "" });
    load.finish();
    await load.loading;

    expect(loader.status()).toEqual({ modelId: QWEN, phase: "cancelled" });
    expect(loader.model()).toBeNull();
  });

  it("loads the same model again after a cancel", async () => {
    const { loader, start } = fakeLoader();
    const cancelled = await start(QWEN);
    loader.cancel();

    const retried = await start(QWEN);
    retried.finish();
    await retried.loading;

    expect(retried.worker).not.toBe(cancelled.worker);
    expect(retried.worker.terminated).toBe(false);
    expect(loader.status()).toEqual({ modelId: QWEN, phase: "ready" });
    expect(loader.model()?.modelId).toBe(QWEN);
  });

  it("loads another model after a cancel", async () => {
    const { loader, start } = fakeLoader();
    await start(QWEN);
    loader.cancel();

    const other = await start(LLAMA);
    other.finish();
    await other.loading;

    expect(loader.model()?.modelId).toBe(LLAMA);
  });

  it("leaves a loaded model alone when nothing is loading", async () => {
    const { loader, start } = fakeLoader();
    const load = await start(QWEN);
    load.finish();
    await load.loading;

    loader.cancel();

    expect(load.worker.terminated).toBe(false);
    expect(loader.status()).toEqual({ modelId: QWEN, phase: "ready" });
  });
});
