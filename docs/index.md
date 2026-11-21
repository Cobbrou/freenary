---
title: Freenary documentation
description: Self-host Freenary, configure it, and find every setting and API route.
---

Freenary is an open-source personal finance app that you run on your own computer or server. It connects to your banks through a bank provider (Powens or Enable Banking), imports your accounts and transactions, puts transactions into categories, and shows a budget. Your data stays in your own PostgreSQL database.

## Start here

New to Freenary? Follow the tutorials in order.

1. [Get it running](tutorials/get-it-running.md): start Freenary on your own computer with Docker Compose in about 10 minutes.
2. [Self-host on a server](tutorials/self-host-on-a-server.md): run it under your own domain with HTTPS.
3. [Connect your first bank](tutorials/connect-your-first-bank.md): finish the setup screen with a free Powens sandbox.

## I want to…

| Goal | Page |
| --- | --- |
| Install from a hosting panel | [Dokploy](how-to/install-with-dokploy.md), [Coolify](how-to/install-with-coolify.md) |
| Put Freenary behind the Caddy or nginx I already run | [Use an existing reverse proxy](how-to/use-an-existing-reverse-proxy.md) |
| Run images I build myself | [Build the images from source](how-to/build-images-from-source.md) |
| Set up the bank provider | [Powens](how-to/configure-powens.md), [Enable Banking](how-to/configure-enable-banking.md) |
| Send sign-in codes and password resets | [Configure email](how-to/configure-email.md) |
| Add Google, Apple or single sign-on buttons | [Add sign-in providers](how-to/add-sign-in-providers.md) |
| Turn on the assistant | [Enable the assistant](how-to/enable-the-assistant.md) |
| Categorise transactions automatically | [Enable transaction categorisation](how-to/enable-transaction-categorisation.md) |
| Update to a new release | [Update Freenary](how-to/update-freenary.md) |
| Back up my data | [Back up and restore](how-to/back-up-and-restore.md) |
| Fix a stack that does not start or a failing sign-in | [Troubleshoot](how-to/troubleshoot.md) |

## Look something up

- [Configuration](reference/configuration.md): every environment variable.
- [Compose files](reference/compose-files.md): services, ports, volumes and required values.
- [Container images](reference/images.md): image names and tags.
- [Commands](reference/commands.md): the scripts in the root `package.json`.
- [API](reference/api.md): every API procedure.

## Understand how it works

- [Architecture](explanation/architecture.md)
- [First run and the operator](explanation/first-run-and-operator.md)
- [Where settings come from](explanation/settings-sources.md)
- [Sign-in and email](explanation/sign-in-and-email.md)
- [How the assistant finds a model](explanation/assistant.md)
- [How transactions get categories](explanation/categorisation.md)

## Contribute

Start with [Run from source](how-to/contribute/run-from-source.md), then [Run the checks](how-to/contribute/run-checks.md) and [Open a pull request](how-to/contribute/open-a-pull-request.md). The rules the checks enforce are in [Code conventions](reference/code-conventions.md).
