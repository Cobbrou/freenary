import { env } from "@freenary/env/server";

import { MOCK_INSTITUTIONS } from "./catalog";
import { mockSessionCode } from "./session";

export const MOCK_CONSENT_PATH = "/mock-bank/consent";
export const MOCK_CALLBACK_PATH = "/callback/mock";

const HTML_ESCAPES: Readonly<Record<string, string>> = {
  '"': "&quot;",
  "&": "&amp;",
  "'": "&#39;",
  "<": "&lt;",
  ">": "&gt;",
};

const HTML_SPECIAL = /["&'<>]/gu;

const escapeHtml = (text: string): string =>
  text.replace(
    HTML_SPECIAL,
    (character) => HTML_ESCAPES[character] ?? character
  );

const plainResponse = (status: number, body: string): Response =>
  new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8" },
    status,
  });

const callbackWith = (
  redirectUri: string,
  params: Record<string, string>
): string => {
  const target = new URL(redirectUri);

  for (const [key, entry] of Object.entries(params)) {
    target.searchParams.set(key, entry);
  }

  return target.toString();
};

const consentPage = (
  institutionName: string,
  approveUrl: string,
  declineUrl: string
): string => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mock bank consent</title>
<style>
body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#f5f5f4;color:#1c1917}
main{max-width:26rem;padding:2rem;border-radius:1rem;background:#fff;box-shadow:0 1px 3px #0002}
h1{font-size:1.25rem;margin:0 0 .5rem}
p{color:#57534e;line-height:1.5}
nav{display:flex;gap:.75rem;margin-top:1.5rem}
a{flex:1;text-align:center;padding:.6rem 1rem;border-radius:.5rem;text-decoration:none;font-weight:600}
.approve{background:#1c1917;color:#fff}
.decline{border:1px solid #d6d3d1;color:#1c1917}
</style>
</head>
<body>
<main>
<h1>${escapeHtml(institutionName)}</h1>
<p>This is the mock banking provider. It stands in for the bank consent screen on a development stack, and every account and transaction it returns is generated.</p>
<nav>
<a class="decline" href="${escapeHtml(declineUrl)}">Decline</a>
<a class="approve" href="${escapeHtml(approveUrl)}">Approve</a>
</nav>
</main>
</body>
</html>`;

export const handleMockConsent = (request: Request): Response => {
  if (env.NODE_ENV === "production") {
    return plainResponse(404, "Not Found");
  }

  const search = new URL(request.url).searchParams;
  const redirectUri = search.get("redirect_uri");
  const state = search.get("state");
  const institution = MOCK_INSTITUTIONS.find(
    (candidate) => candidate.id === search.get("institution")
  );

  if (redirectUri !== `${env.CORS_ORIGIN}${MOCK_CALLBACK_PATH}`) {
    return plainResponse(400, "redirect_uri is not this instance's callback");
  }

  if (!(state && institution)) {
    return plainResponse(400, "Missing state or unknown institution");
  }

  const approveUrl = callbackWith(redirectUri, {
    code: mockSessionCode(new Date()),
    state,
  });

  const declineUrl = callbackWith(redirectUri, {
    error: "access_denied",
    state,
  });

  return new Response(consentPage(institution.name, approveUrl, declineUrl), {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
};
