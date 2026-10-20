import { describe, expect, test } from "bun:test";

import { resolveCookiePolicy } from "./cookies";

describe("resolveCookiePolicy", () => {
  test("keeps the session cookie same-site when one hostname serves both", () => {
    expect(
      resolveCookiePolicy({
        authUrl: "https://freenary.example.com",
        cookieDomain: undefined,
        isProduction: true,
        webOrigin: "https://freenary.example.com",
      })
    ).toEqual({ httpOnly: true, sameSite: "lax", secure: true });
  });

  test("treats two ports on one hostname as same-site", () => {
    expect(
      resolveCookiePolicy({
        authUrl: "http://localhost:3000",
        cookieDomain: undefined,
        isProduction: false,
        webOrigin: "http://localhost:3001",
      })
    ).toEqual({ httpOnly: true, sameSite: "lax", secure: false });
  });

  test("keeps split subdomains same-site once their parent is declared", () => {
    expect(
      resolveCookiePolicy({
        authUrl: "https://api.example.com",
        cookieDomain: ".example.com",
        isProduction: true,
        webOrigin: "https://app.example.com",
      })
    ).toEqual({ httpOnly: true, sameSite: "lax", secure: true });
  });

  test("crosses sites for split hostnames with no declared parent", () => {
    expect(
      resolveCookiePolicy({
        authUrl: "https://server.freenary.orb.local",
        cookieDomain: undefined,
        isProduction: false,
        webOrigin: "https://web.freenary.orb.local",
      })
    ).toEqual({ httpOnly: true, sameSite: "none", secure: true });
  });

  test("refuses a cross-site cookie over plain HTTP in production", () => {
    expect(() =>
      resolveCookiePolicy({
        authUrl: "http://api.example.com",
        cookieDomain: undefined,
        isProduction: true,
        webOrigin: "http://app.example.com",
      })
    ).toThrow(/SameSite=None/u);
  });

  test("accepts plain HTTP in production once the parent is declared", () => {
    expect(
      resolveCookiePolicy({
        authUrl: "http://api.example.com",
        cookieDomain: ".example.com",
        isProduction: true,
        webOrigin: "http://app.example.com",
      })
    ).toEqual({ httpOnly: true, sameSite: "lax", secure: false });
  });

  test("lets development run cross-host over HTTP after warning", () => {
    expect(
      resolveCookiePolicy({
        authUrl: "http://api.example.com",
        cookieDomain: undefined,
        isProduction: false,
        webOrigin: "http://app.example.com",
      })
    ).toEqual({ httpOnly: true, sameSite: "none", secure: false });
  });

  test("refuses a declared parent that does not cover both origins", () => {
    expect(() =>
      resolveCookiePolicy({
        authUrl: "https://api.acme-prod.com",
        cookieDomain: ".acme.com",
        isProduction: true,
        webOrigin: "https://app.acme-prod.com",
      })
    ).toThrow(/is not a parent of both/u);

    expect(() =>
      resolveCookiePolicy({
        authUrl: "https://api.example.com",
        cookieDomain: "api.example.com",
        isProduction: true,
        webOrigin: "https://app.example.com",
      })
    ).toThrow(/is not a parent of both/u);
  });

  test("refuses a declared domain browsers will not scope a cookie to", () => {
    expect(() =>
      resolveCookiePolicy({
        authUrl: "https://api.example.com",
        cookieDomain: ".com",
        isProduction: true,
        webOrigin: "https://app.example.com",
      })
    ).toThrow(/single label/u);
  });

  test("matches the declared domain case-insensitively, as a browser does", () => {
    expect(
      resolveCookiePolicy({
        authUrl: "https://API.Example.com",
        cookieDomain: ".Example.COM",
        isProduction: true,
        webOrigin: "https://App.Example.com",
      })
    ).toEqual({ httpOnly: true, sameSite: "lax", secure: true });
  });

  test("refuses a trailing dot, which the browser is sent verbatim", () => {
    expect(() =>
      resolveCookiePolicy({
        authUrl: "https://api.example.com",
        cookieDomain: ".example.com.",
        isProduction: true,
        webOrigin: "https://app.example.com",
      })
    ).toThrow(/trailing dot/u);
  });
});
