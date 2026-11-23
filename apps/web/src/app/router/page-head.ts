export const pageHead = (title: () => string) => () => ({
  meta: [{ title: `${title()} · Freenary` }],
});
