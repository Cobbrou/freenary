import { describe, expect, it } from "bun:test";

import { isJsonRequest } from "./json-request";

const postedAs = (contentType: string) =>
  new Request("http://localhost/api-reference/settings/createCustomCategory", {
    body: "{}",
    headers: { "content-type": contentType },
    method: "POST",
  });

describe("isJsonRequest", () => {
  it("accepts application/json with or without parameters", () => {
    expect(isJsonRequest(postedAs("application/json"))).toBe(true);
    expect(isJsonRequest(postedAs("Application/JSON; charset=utf-8"))).toBe(
      true
    );
  });

  it("refuses the content types a cross-site page can post without a preflight", () => {
    expect(isJsonRequest(postedAs("text/plain"))).toBe(false);
    expect(isJsonRequest(postedAs("text/plain; application/json"))).toBe(false);
    expect(isJsonRequest(postedAs("multipart/form-data"))).toBe(false);
    expect(isJsonRequest(postedAs("application/x-www-form-urlencoded"))).toBe(
      false
    );
  });
});
