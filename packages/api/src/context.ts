import { requestSession } from "@freenary/auth";
import type { Context as ElysiaContext } from "elysia";

export interface CreateContextOptions {
  context: ElysiaContext;
}

export const createContext = async ({ context }: CreateContextOptions) => {
  const session = await requestSession(context.request.headers);

  return {
    auth: null,
    headers: context.request.headers,
    session,
  };
};

export type Context = Awaited<ReturnType<typeof createContext>>;
