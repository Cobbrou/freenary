import { afterAll, afterEach, describe, expect, it, spyOn } from "bun:test";

import type { MutationOptions } from "@tanstack/react-query";
import { toast } from "sonner";

Object.defineProperty(globalThis, "window", { configurable: true, value: {} });

const { createQueryClient } = await import("./orpc");

const toastError = spyOn(toast, "error");

afterAll(() => {
  Reflect.deleteProperty(globalThis, "window");
  toastError.mockRestore();
});

const failMutation = async (options: MutationOptions<never, Error>) => {
  const queryClient = createQueryClient();
  const mutation = queryClient.getMutationCache().build(queryClient, {
    ...options,
    mutationFn: () => Promise.reject(new Error("offline")),
  });

  await mutation.execute().catch(() => null);
};

afterEach(() => {
  toastError.mockClear();
});

describe("a failed mutation", () => {
  it("shows the generic error toast when the caller handles nothing", async () => {
    await failMutation({});

    expect(toastError).toHaveBeenCalledTimes(1);
  });

  it("leaves the toast to the caller's own onError", async () => {
    await failMutation({ onError: () => null });

    expect(toastError).not.toHaveBeenCalled();
  });

  it("shows no toast when the error is shown inline", async () => {
    await failMutation({ meta: { errorShownInline: true } });

    expect(toastError).not.toHaveBeenCalled();
  });
});
