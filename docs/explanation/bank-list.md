---
title: How the bank list is built
description: Where the banks in Connect your bank come from, and why the member's country does not filter them.
---

This page explains where the banks in **Connect your bank** come from. The bank provider decides which banks exist for the instance, and Freenary shows all of them to every member. The countries a member picks on **What’s your tax residency?** do not filter the list.

## One request for every bank

The `bankConnection.listInstitutions` procedure in `packages/api/src/routers/bank-connection.ts` takes no input. It asks the provider once for its full list, drops duplicates that share a country and an identifier, and returns the rest. Onboarding and **Settings** › **Bank accounts** › **Connect a bank** call the same procedure, so both show the same list. **Search banks…** filters that list in the browser by bank name or BIC, so it reaches every bank.

The server keeps each provider's list in memory for one hour (`packages/api/src/lib/institutions-cache.ts`). Calls within that hour, from any member, reuse it and do not reach the provider. The list is kept per provider, so changing the default provider in **Settings** does not show the previous provider's banks. A server restart empties it.

When the provider does not answer, the server logs `Bank institutions unavailable` and the list shows **Could not load banks**. A failed load is not kept, so the next call asks the provider again.

Each bank still carries a country, which comes from the provider and not from the member. Freenary uses it, with the bank's identifier, to find the bank again when a member selects **Connect** and when the provider sends the member back.

## What each provider returns

### Powens

Freenary calls `GET /connectors?expand=countries` on the Powens domain. Powens answers with the connectors **activated** in the console of the domain, not with every connector it supports. The sandbox domain used for this page counted **Total: 1903 connectors. Activated: 34.** in the console, and the API returned only those activated connectors. [Choose which banks members can connect with Powens](../how-to/choose-powens-banks.md) shows how to activate connectors.

Freenary then drops the connectors that Powens marks as hidden or restricted, and the ones that offer neither the `bank` nor the `wealth` product. A connector can list several countries; Freenary labels it with the first country Powens lists.

### Enable Banking

Freenary calls `GET /aspsps` with no country and keeps every bank in the answer, with the country, BIC and logo Enable Banking returns.

### Mock provider

The mock provider, for development, returns a fixed catalogue labelled France.

## Related

- [Choose which banks members can connect with Powens](../how-to/choose-powens-banks.md)
- [Configure Powens](../how-to/configure-powens.md)
- [Configure Enable Banking](../how-to/configure-enable-banking.md)
