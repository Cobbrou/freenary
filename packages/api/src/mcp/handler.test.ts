import { describe, expect, it } from "bun:test";

import { refusalBeforeCredential } from "./handler";

const WEB_APP = "https://freenary.example.test";

const mcpRequest = (headers: Record<string, string>, method = "POST") =>
  new Request("https://freenary.example.test/mcp", { headers, method });

describe("refusalBeforeCredential", () => {
  it("lets a POST carrying a bearer key through", () => {
    expect(
      refusalBeforeCredential(
        mcpRequest({ authorization: "Bearer fny_key" }),
        WEB_APP
      )
    ).toBeNull();
  });

  it("lets the web app's own origin through", () => {
    expect(
      refusalBeforeCredential(
        mcpRequest({ origin: WEB_APP, "x-api-key": "fny_key" }),
        `${WEB_APP}/`
      )
    ).toBeNull();
  });

  it("refuses a page on another origin", async () => {
    const refusal = refusalBeforeCredential(
      mcpRequest({
        authorization: "Bearer fny_key",
        origin: "https://elsewhere.example.test",
      }),
      WEB_APP
    );

    expect(refusal?.status).toBe(403);
    expect(await refusal?.text()).toBe("forbidden_origin");
  });

  it.each(["GET", "DELETE"])("refuses %s with the allowed method", (method) => {
    const refusal = refusalBeforeCredential(
      mcpRequest({ authorization: "Bearer fny_key" }, method),
      WEB_APP
    );

    expect(refusal?.status).toBe(405);
    expect(refusal?.headers.get("allow")).toBe("POST");
  });

  it("asks for a bearer key when none is sent, even with a session cookie", () => {
    const refusal = refusalBeforeCredential(
      mcpRequest({ cookie: "better-auth.session_token=abc" }),
      WEB_APP
    );

    expect(refusal?.status).toBe(401);
    expect(refusal?.headers.get("www-authenticate")).toStartWith("Bearer");
  });
});
