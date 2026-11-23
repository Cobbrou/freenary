---
title: First run and the operator
description: What happens the first time someone signs in to a new instance.
---

A new Freenary instance has no administrator account and no bank provider. This page explains how the first account becomes the **operator**, what the setup screen does, and how other members get in. It describes what the code does; it does not give reasons for it.

## Two kinds of account

Every account has a role stored in the `user` table: an ordinary member, or `OPERATOR`. Only the operator can call the procedures that change the instance's settings (in `packages/api/src/index.ts`, `operatorProcedure` answers `FORBIDDEN` to anyone else). Each member, the operator included, has their own bank connections, budget and settings.

## Claiming the instance

The instance's setup state is one row in the `instance_setup` table, with two dates: `claimedAt` and `completedAt` (`packages/instance-config/src/claim.ts`).

1. While `claimedAt` is empty, the server prints this line at every start:

   ```text
   This instance has no operator yet. The first account to sign in at <CORS_ORIGIN> becomes the operator.
   ```

2. Each time a sign-in session is created, the auth layer (`packages/auth/src/index.ts`) tries to claim the instance for that account. Inside one database transaction, it sets `claimedAt` only if it is still empty, and then gives that account the `OPERATOR` role.
3. Once `claimedAt` is set, later sessions do nothing to it. There is no second operator, and the claim does not depend on which sign-in method the account used.

In practice, creating an account signs you in, so the person who creates the first account becomes the operator. Anyone who can reach the address before that can take the role, which is why the tutorials create the account right after the first start.

## The setup screen

While `completedAt` is empty, the instance reports `needs-setup` and the web app sends every signed-in visitor to `/setup` (`apps/web/src/app/routes/_auth/route.tsx`).

- The **operator** sees the steps. Which steps appear comes from `packages/instance-config/src/integrations.ts`: the bank provider is required (**Bank**), categorisation can be skipped (**Categories**), and **Done** reviews the choices. Email and the assistant are not part of setup; the operator sets them later in **Settings**.
- **Any other member** sees **Only the operator can set up this instance** and **The first account on this instance is its operator. Ask the operator to change the configuration.**

**Finish setup** refuses to complete without a bank provider (**Set up a bank provider on the Bank step before you finish.**). When it succeeds, it sets `completedAt`, and the server restarts so it loads the saved settings. See [Where settings come from](settings-sources.md).

## Onboarding

After setup, each member goes through their own onboarding at `/onboarding` before they reach the app: **Tax residency** (the countries whose banks they can link), **Budget month** (the day their budget month starts on, see [How budget months work](budget-months.md)) and **Bank connection**. **Finish** refuses to complete without a connected bank: **Connect a bank before you finish.**

Until a member finishes onboarding, every page of the app sends them back to `/onboarding` (`apps/web/src/app/routes/_auth/route.tsx`). That includes **Settings**, and the update notice, which the app shows in the layout of those pages (`apps/web/src/app/shell/auth-layout.tsx`). The operator is no exception: after **Finish setup**, the operator connects a bank before reaching **Settings** to set up email, the assistant or categorisation.

If the instance has no bank provider, onboarding shows **Ask your instance’s operator to set up a banking provider, then reload this page.**

## Related

- [Get it running](../tutorials/get-it-running.md)
- [Connect your first bank](../tutorials/connect-your-first-bank.md)
- [Where settings come from](settings-sources.md)
- [Architecture](architecture.md)
