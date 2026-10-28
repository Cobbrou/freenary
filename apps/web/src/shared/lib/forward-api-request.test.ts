import { afterAll, describe, expect, it, spyOn } from "bun:test";
import { gzipSync } from "node:zlib";

import { z } from "zod";

import { forwardApiRequest, isForwardedPath } from "./forward-api-request";

const WEB_ORIGIN = "https://app.example.com";
const UNREACHABLE_ORIGIN = "http://127.0.0.1:1";
const GZIPPED_BODY = '{"compressed":true}';
const SLOW_ANSWER_MS = 2000;

const echoServer = Bun.serve({
  fetch: async (request) => {
    const url = new URL(request.url);

    if (url.pathname === "/api/auth/callback/google") {
      const redirect = new Response(null, {
        headers: { Location: `${WEB_ORIGIN}/` },
        status: 302,
      });

      redirect.headers.append("Set-Cookie", "first=1; Path=/");
      redirect.headers.append("Set-Cookie", "second=2; Path=/");

      return redirect;
    }

    if (url.pathname === "/rpc/gzipped") {
      return new Response(gzipSync(GZIPPED_BODY), {
        headers: {
          "Content-Encoding": "gzip",
          "Content-Type": "application/json",
        },
      });
    }

    if (url.pathname === "/rpc/slow") {
      await Bun.sleep(SLOW_ANSWER_MS);

      return new Response("late");
    }

    return Response.json(
      {
        acceptEncoding: request.headers.get("accept-encoding"),
        body: await request.text(),
        cookie: request.headers.get("cookie"),
        forwardedFor: request.headers.get("x-forwarded-for"),
        host: request.headers.get("host"),
        keepAlive: request.headers.get("keep-alive"),
        method: request.method,
        path: `${url.pathname}${url.search}`,
        upgrade: request.headers.get("upgrade"),
      },
      { headers: { "X-Echo-Method": request.method } }
    );
  },
  port: 0,
});

afterAll(async () => {
  await echoServer.stop(true);
});

const withServerUrl = async <T>(
  serverUrl: string | undefined,
  run: () => Promise<T> | T
): Promise<T> => {
  const previous = process.env.SERVER_URL;

  if (serverUrl === undefined) {
    delete process.env.SERVER_URL;
  } else {
    process.env.SERVER_URL = serverUrl;
  }

  const outcome = await run();

  if (previous === undefined) {
    delete process.env.SERVER_URL;
  } else {
    process.env.SERVER_URL = previous;
  }

  return outcome;
};

const CAPTURED_CONSOLE_METHODS = [
  "debug",
  "error",
  "info",
  "log",
  "warn",
] as const;

const captureConsole = async <T>(
  run: () => Promise<T> | T
): Promise<{ logged: string; outcome: T }> => {
  const spies = CAPTURED_CONSOLE_METHODS.map((method) =>
    spyOn(console, method)
  );

  const outcome = await run();

  const logged = spies
    .flatMap((spy) => spy.mock.calls.flat())
    .map((argument) => Bun.inspect(argument))
    .join("\n");

  for (const spy of spies) {
    spy.mockRestore();
  }

  return { logged, outcome };
};

const forwardedForSent = async ({
  forwardedFor,
  peer,
  trustedProxies,
}: {
  forwardedFor: string;
  peer: string | undefined;
  trustedProxies: string | undefined;
}): Promise<string | null> => {
  const request = new Request(`${WEB_ORIGIN}/api/auth/sign-in/email`, {
    headers: { "X-Forwarded-For": forwardedFor },
  });

  Object.defineProperty(request, "ip", { value: peer });

  const previous = process.env.TRUSTED_PROXIES;

  if (trustedProxies === undefined) {
    delete process.env.TRUSTED_PROXIES;
  } else {
    process.env.TRUSTED_PROXIES = trustedProxies;
  }

  const response = await withServerUrl(echoServer.url.origin, () =>
    forwardApiRequest(request)
  );

  if (previous === undefined) {
    delete process.env.TRUSTED_PROXIES;
  } else {
    process.env.TRUSTED_PROXIES = previous;
  }

  const echoed = z
    .object({ forwardedFor: z.string().nullable() })
    .parse(await response?.json());

  return echoed.forwardedFor;
};

describe("isForwardedPath", () => {
  it("matches every API server route and its subpaths", () => {
    expect(isForwardedPath("/rpc")).toBe(true);
    expect(isForwardedPath("/rpc/budget/list")).toBe(true);
    expect(isForwardedPath("/api/auth/get-session")).toBe(true);
    expect(isForwardedPath("/ai/chat")).toBe(true);
    expect(isForwardedPath("/api-reference")).toBe(true);
    expect(isForwardedPath("/api-reference/spec.json")).toBe(true);
  });

  it("leaves the web app routes alone", () => {
    expect(isForwardedPath("/")).toBe(false);
    expect(isForwardedPath("/login")).toBe(false);
    expect(isForwardedPath("/callback/powens")).toBe(false);
    expect(isForwardedPath("/rpcs")).toBe(false);
    expect(isForwardedPath("/api")).toBe(false);
  });
});

describe("forwardApiRequest", () => {
  it("does nothing without SERVER_URL", async () => {
    const forwarded = await withServerUrl(undefined, () =>
      forwardApiRequest(new Request(`${WEB_ORIGIN}/rpc/viewer`))
    );

    expect(forwarded).toBeUndefined();
  });

  it("does nothing for a web app path", async () => {
    const forwarded = await withServerUrl(echoServer.url.origin, () =>
      forwardApiRequest(new Request(`${WEB_ORIGIN}/login`))
    );

    expect(forwarded).toBeUndefined();
  });

  it("forwards the path, query, method, body and cookie", async () => {
    const response = await withServerUrl(`${echoServer.url.origin}/`, () =>
      forwardApiRequest(
        new Request(`${WEB_ORIGIN}/rpc/budget/list?month=2026-10`, {
          body: JSON.stringify({ json: { month: "2026-10" } }),
          headers: { Cookie: "better-auth.session_token=abc" },
          method: "POST",
        })
      )
    );

    expect(response?.status).toBe(200);

    expect(await response?.json()).toMatchObject({
      body: JSON.stringify({ json: { month: "2026-10" } }),
      cookie: "better-auth.session_token=abc",
      method: "POST",
      path: "/rpc/budget/list?month=2026-10",
    });
  });

  it.each([
    ["no proxy is trusted", undefined, "198.51.100.9"],
    ["the peer is not a trusted proxy", "10.0.0.0/8", "198.51.100.9"],
  ])(
    "replaces a forged X-Forwarded-For with the peer address when %s",
    async (_case, trustedProxies, peer) => {
      const forwardedFor = await forwardedForSent({
        forwardedFor: "203.0.113.7",
        peer,
        trustedProxies,
      });

      expect(forwardedFor).toBe(peer);
    }
  );

  it("takes the caller address a trusted proxy appended, not the forged one", async () => {
    const forwardedFor = await forwardedForSent({
      forwardedFor: "203.0.113.7, 198.51.100.9",
      peer: "172.18.0.1",
      trustedProxies: "172.16.0.0/12",
    });

    expect(forwardedFor).toBe("198.51.100.9");
  });

  it("sends no X-Forwarded-For when the peer address is unknown", async () => {
    const forwardedFor = await forwardedForSent({
      forwardedFor: "203.0.113.7",
      peer: undefined,
      trustedProxies: undefined,
    });

    expect(forwardedFor).toBeNull();
  });

  it("drops the hop headers, asks for an uncompressed answer and targets the API host", async () => {
    const response = await withServerUrl(echoServer.url.origin, () =>
      forwardApiRequest(
        new Request(`${WEB_ORIGIN}/rpc/viewer`, {
          headers: {
            "Accept-Encoding": "gzip, br",
            "Keep-Alive": "timeout=5",
            Upgrade: "websocket",
          },
        })
      )
    );

    expect(await response?.json()).toMatchObject({
      acceptEncoding: "identity",
      host: echoServer.url.host,
      keepAlive: null,
      upgrade: null,
    });
  });

  it("returns a compressed answer decoded, without its stale encoding headers", async () => {
    const response = await withServerUrl(echoServer.url.origin, () =>
      forwardApiRequest(new Request(`${WEB_ORIGIN}/rpc/gzipped`))
    );

    expect(response?.headers.get("content-encoding")).toBeNull();
    expect(response?.headers.get("content-length")).toBeNull();
    expect(await response?.text()).toBe(GZIPPED_BODY);
  });

  it("forwards a HEAD request with no body", async () => {
    const response = await withServerUrl(echoServer.url.origin, () =>
      forwardApiRequest(
        new Request(`${WEB_ORIGIN}/api-reference`, { method: "HEAD" })
      )
    );

    expect(response?.status).toBe(200);
    expect(response?.headers.get("x-echo-method")).toBe("HEAD");
    expect(await response?.text()).toBe("");
  });

  it("hands a redirect and every Set-Cookie back to the browser", async () => {
    const response = await withServerUrl(echoServer.url.origin, () =>
      forwardApiRequest(
        new Request(`${WEB_ORIGIN}/api/auth/callback/google?code=xyz`)
      )
    );

    expect(response?.status).toBe(302);
    expect(response?.headers.get("location")).toBe(`${WEB_ORIGIN}/`);

    expect(response?.headers.getSetCookie()).toEqual([
      "first=1; Path=/",
      "second=2; Path=/",
    ]);
  });

  it("answers 502 when the API server does not answer, and keeps the query string out of the log", async () => {
    const { logged, outcome: response } = await captureConsole(() =>
      withServerUrl(UNREACHABLE_ORIGIN, () =>
        forwardApiRequest(
          new Request(`${WEB_ORIGIN}/api/auth/verify-email?token=SECRET123`)
        )
      )
    );

    expect(response?.status).toBe(502);
    expect(logged).toContain("/api/auth/verify-email");
    expect(logged).not.toContain("SECRET123");
  });

  it("answers 502 when the API server holds the answer past the timeout", async () => {
    const { logged, outcome: response } = await captureConsole(() =>
      withServerUrl(echoServer.url.origin, () =>
        forwardApiRequest(
          new Request(`${WEB_ORIGIN}/rpc/slow?token=SECRET456`),
          "100 millis"
        )
      )
    );

    expect(response?.status).toBe(502);
    expect(logged).toContain("/rpc/slow");
    expect(logged).not.toContain("SECRET456");
  });

  it("answers 499, not 502, when the caller closes the request", async () => {
    const caller = new AbortController();

    const pending = withServerUrl(echoServer.url.origin, () =>
      forwardApiRequest(
        new Request(`${WEB_ORIGIN}/rpc/slow`, { signal: caller.signal })
      )
    );

    caller.abort();

    const response = await pending;

    expect(response?.status).toBe(499);
  });
});
