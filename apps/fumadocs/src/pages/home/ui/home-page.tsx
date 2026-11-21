import { Link } from "@tanstack/react-router";
import { HomeLayout } from "fumadocs-ui/layouts/home";

import { baseOptions } from "@/shared/config";
import { buttonVariants } from "@/shared/ui/button";

const GET_IT_RUNNING_SLUG = "tutorials/get-it-running";

const ENTRY_POINTS = [
  {
    description: "Run Freenary on a Linux server under your own domain.",
    slug: "tutorials/self-host-on-a-server",
    title: "Self-host on a server",
  },
  {
    description: "Configure email, bank providers, sign-in and updates.",
    slug: "how-to/configure-email",
    title: "How-to guides",
  },
  {
    description: "Every environment variable, command and API route.",
    slug: "reference/configuration",
    title: "Reference",
  },
  {
    description: "How the services, apps and packages fit together.",
    slug: "explanation/architecture",
    title: "Explanation",
  },
];

export const HomePage = () => (
  <HomeLayout {...baseOptions()}>
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-8 px-4 py-16">
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-medium">Freenary documentation</h1>
        <p className="text-fd-muted-foreground">
          Freenary is an open-source personal finance app you host yourself. It
          connects your banks, sorts your spending into a budget, and keeps your
          data in your own database.
        </p>
        <div className="flex flex-row gap-2 pt-2">
          <Link
            to="/docs/$"
            params={{ _splat: GET_IT_RUNNING_SLUG }}
            className={buttonVariants({ variant: "primary" })}
          >
            Get it running
          </Link>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {ENTRY_POINTS.map((entry) => (
          <Link
            key={entry.title}
            to="/docs/$"
            params={{ _splat: entry.slug }}
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
