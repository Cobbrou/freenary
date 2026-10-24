# Freenary documentation website

This app serves the Freenary documentation. It uses [Fumadocs](https://fumadocs.dev) on TanStack Start.

Run it from the repository root:

```bash
bun install
cd apps/fumadocs && bun run dev
```

Open http://localhost:4000.

The pages live in [`content/docs/next`](content/docs/next) — one folder per version, and `next` is the one a change edits. The writing rules and the page tree live in [`AGENTS.md`](AGENTS.md).

```bash
bun run docs:check    # frontmatter, icons, components, links, anchors, navigation, moved pages
bun run build         # production build
bun run check-types   # TypeScript
```

`docs:check` is the gate a documentation change must pass. The build catches a missing frontmatter field and an unknown code-fence language. `docs:check` catches what the build lets through. Add `--strict` to fail on warnings too.

A release freezes the pages as a new version folder. The `Release` workflow does it; by hand it is `bun run docs:snapshot 1.2.0`.
