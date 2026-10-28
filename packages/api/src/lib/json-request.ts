const JSON_MEDIA_TYPE = "application/json";

export const isJsonRequest = (request: Request): boolean =>
  request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ===
  JSON_MEDIA_TYPE;
