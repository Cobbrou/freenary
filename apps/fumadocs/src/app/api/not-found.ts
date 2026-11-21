export const notFoundResponse = () =>
  new Response("Not found", {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
    status: 404,
  });
