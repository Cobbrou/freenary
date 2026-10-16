import { Link, useLoaderData } from "@tanstack/react-router";
import { HomeLayout } from "fumadocs-ui/layouts/home";

import { baseOptions } from "@/shared/config";
import { buttonVariants } from "@/shared/ui/button";

const GET_STARTED_SLUG = "get-started/before-you-install";

const ENTRY_POINTS = [
  {
    description: "Read your budget, sync your banks, ask the assistant.",
    slug: "use/budget",
    title: "Use Freenary",
  },
  {
    description: "Email, sign-in, updates, backups and troubleshooting.",
    slug: "run/updates-and-backups",
    title: "Run your instance",
  },
  {
    description: "Every setting, bank provider and API detail.",
    slug: "reference/configuration",
    title: "Reference",
  },
  {
    description: "Run the code locally and open a pull request.",
    slug: "contribute",
    title: "Contribute",
  },
];

export const HomePage = () => {
  const newestRelease = useLoaderData({ from: "__root__" });
  const splat = (slug: string) =>
    [newestRelease, slug].filter(Boolean).join("/");

  return (
    <HomeLayout {...baseOptions()}>
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-8 px-4 py-16">
        <div className="flex flex-col gap-3">
          <h1 className="text-2xl font-medium">Freenary documentation</h1>
          <p className="text-fd-muted-foreground">
            Freenary is an open-source personal finance app you host yourself.
            It connects your banks, sorts your spending into a budget, and keeps
            your data in your own database.
          </p>
          <div className="flex flex-row gap-2 pt-2">
            <Link
              to="/docs/$"
              params={{ _splat: splat(GET_STARTED_SLUG) }}
              className={buttonVariants({ variant: "primary" })}
            >
              Get started
            </Link>
            <Link
              to="/docs/$"
              params={{ _splat: splat("") }}
              className={buttonVariants({ variant: "outline" })}
            >
              What is Freenary?
            </Link>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {ENTRY_POINTS.map((entry) => (
            <Link
              key={entry.title}
              to="/docs/$"
              params={{ _splat: splat(entry.slug) }}
              className="hover:bg-fd-accent/50 flex flex-col gap-1 rounded-lg border p-4 transition-colors"
            >
              <span className="font-medium">{entry.title}</span>
              <span className="text-fd-muted-foreground text-sm">
                {entry.description}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </HomeLayout>
  );
};
