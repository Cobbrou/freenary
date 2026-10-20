import { describe, expect, it } from "bun:test";

import { env } from "@freenary/env/server";
import { Option } from "effect";

import { handleMockConsent, MOCK_CALLBACK_PATH } from "./consent";
import { openedOnOf } from "./session";

const CALLBACK = `${env.CORS_ORIGIN}${MOCK_CALLBACK_PATH}`;
const APPROVE_LINK = /class="approve" href="(?<href>[^"]+)"/u;
const DECLINE_LINK = /class="decline" href="(?<href>[^"]+)"/u;

const consentFor = (params: Record<string, string>) =>
  handleMockConsent(
    new Request(
      `http://server.test/mock-bank/consent?${new URLSearchParams(params).toString()}`
    )
  );

const linkOf = (page: string, pattern: RegExp): URL =>
  new URL((pattern.exec(page)?.groups?.href ?? "").replaceAll("&amp;", "&"));

describe("mock consent page", () => {
  it("refuses a redirect_uri that is not this instance's callback", () => {
    const response = consentFor({
      institution: "mock-banque-lumiere",
      redirect_uri: "https://elsewhere.example/callback/mock",
      state: "signed-state",
    });

    expect(response.status).toBe(400);
  });

  it("refuses a request with no state", () => {
    const response = consentFor({
      institution: "mock-banque-lumiere",
      redirect_uri: CALLBACK,
    });

    expect(response.status).toBe(400);
  });

  it("refuses an institution it does not list", () => {
    const response = consentFor({
      institution: "real-bank",
      redirect_uri: CALLBACK,
      state: "signed-state",
    });

    expect(response.status).toBe(400);
  });

  it("approves with a session code and declines with an error", async () => {
    const response = consentFor({
      institution: "mock-credit-mistral",
      redirect_uri: CALLBACK,
      state: '{"hmac":"<x>"}',
    });

    const page = await response.text();
    const approve = linkOf(page, APPROVE_LINK);
    const decline = linkOf(page, DECLINE_LINK);

    expect(response.status).toBe(200);
    expect(`${approve.origin}${approve.pathname}`).toBe(CALLBACK);
    expect(approve.searchParams.get("state")).toBe('{"hmac":"<x>"}');
    expect(
      Option.isSome(openedOnOf(approve.searchParams.get("code") ?? ""))
    ).toBe(true);

    expect(decline.searchParams.get("error")).toBe("access_denied");
    expect(page).not.toContain('"<x>"');
  });
});
