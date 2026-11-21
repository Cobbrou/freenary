---
title: Connect your first bank
description: Finish the setup screen with a Powens sandbox and import your first transactions.
---

In this tutorial you finish the setup screen, connect a test bank, and see your first imported transactions. You use a free Powens sandbox, so no real bank account is involved.

Freenary does not talk to banks itself. It uses a **bank provider**, a service that connects to banks for it. The setup screen offers two: Powens and Enable Banking. A real instance cannot finish setup without one. This tutorial uses Powens because the app marks it **Recommended** and describes it as **Free sandbox, no contract, ready in about 5 minutes.**

## Before you start

- Freenary runs and you are signed in as the operator, on the setup screen. If not, follow [Get it running](get-it-running.md) or [Self-host on a server](self-host-on-a-server.md) first.
- You know your instance's address: `http://localhost:3001` after [Get it running](get-it-running.md), or your `https://` domain.
- The `server` container can reach the internet: it calls the Powens API.

## 1. Create a Powens sandbox

1. Open [the Powens console registration page](https://console.powens.com/auth/register) and create a free account.
2. In the console, create a **domain** with **Add domain**. A domain is your own space at Powens. The console lists it by its short name with a **Sandbox** badge; its full address is `<name>.biapi.pro`, for example `acme-sandbox.biapi.pro`. Write down the part before `.biapi.pro`, for example `acme-sandbox`.

> **TODO (unverified):** the sign-up form and the **Add domain** dialog. This tutorial was run with an account and a sandbox domain that already existed.

## 2. Choose Powens on the setup screen

1. On the **Bank provider** page, select **Powens**.

   ![The Bank provider page with Powens selected](../images/03-setup-bank-provider.png)

2. Select **Continue**.

The page now shows **Connect Powens** and **Step 1 of 4**.

## 3. Enter the Powens details

1. **Step 1 of 4, Powens domain.** Enter the domain name from part 1, for example `acme-sandbox`. Type the name only, without `https://`. Select **Next**.
2. **Step 2 of 4, Redirect URL.** The page shows your instance's address followed by `/callback/powens`, for example `http://localhost:3001/callback/powens`. Select **Copy**.

   ![Connect Powens, Step 2 of 4: the Redirect URL http://localhost:3001/callback/powens with a Copy button](../images/04-powens-redirect-url.png)

   Powens sends you back to this URL after you connect a bank. Register it in the Powens console:

   1. Open your domain, then select **Applications** in the left menu, under **DOMAIN**.
   2. Select **Add an application**. On **NEW CLIENT APPLICATION**, enter a **Name**, which Powens shows to people who connect a bank, and paste the URL into **Redirect URIs**. Select **Save**, then **Exit**.

      ![The Powens console form NEW CLIENT APPLICATION with the Name and Redirect URIs fields filled in](../images/10-powens-console-new-application.png)

   3. **Client applications** now lists the application with its **Client ID**, **Client secret** (select **Show** to see it) and **Redirect URIs**. Keep this page open for the next two steps.

      ![The new application in the Powens console, with its Client ID, a hidden Client secret and the redirect URI](../images/11-powens-console-application.png)

   4. Select **Connectors** in the left menu, and type `Connecteur de test` in **Filter connectors by name or UUID**. **Connecteur de test** must read **Activated**. If it reads **Activate**, select it. Turn on any other bank the same way.

      ![The Powens Connectors page filtered on Connecteur de test, which reads Activated](../images/12-powens-console-connectors.png)

   Then select **Next** in Freenary.

3. **Step 3 of 4, Client ID.** Copy the **Client ID** of the application you just added, and paste it. Select **Next**.
4. **Step 4 of 4, Client secret.** Select **Show** next to **Client secret** in the console, copy it, and paste it.
5. Select **Save and continue**.

Freenary tests the details with Powens before it saves them. If the test passes, the setup screen moves to **Categories**. If you see **Powens refused these credentials. Check them and try again.**, check that the client ID and the client secret come from the same client. [Configure Powens](../how-to/configure-powens.md#if-something-goes-wrong) lists the other messages.

## 4. Skip categorisation for now

The **Categories** step connects a model that sorts new transactions into categories. You can add one later.

1. Read the note next to the button: **Without a model, new transactions stay uncategorised until you add one in Settings › Connections.**
2. Select **Skip for now**.

   ![The Categorisation model step with Jev by TypeSafe, SubQ Snap and OpenAI-compatible endpoint, and the Skip for now button](../images/06-categories-step.png)

The setup screen moves on to the **Done** step. To set up categorisation later, see [Enable transaction categorisation](../how-to/enable-transaction-categorisation.md).

## 5. Finish the setup

1. On **Review and finish**, check your choices.
2. Select **Finish setup**.

   ![The Review and finish step with the Finish setup button](../images/07-review-and-finish.png)

The page shows **Applying your settings…** and **This page reconnects on its own.** The server restarts to load the new settings, then the app shows **The instance is set up.** and moves on.

![The Applying your settings… screen shown while the server restarts](../images/08-applying-settings.png)

## 6. Connect the test bank

Every member, including you, now sets up their own account.

1. **What’s your tax residency?** Add **France**, the country of **Connecteur de test**, then select **Continue**. The countries you pick decide which banks you can link.

   ![The onboarding step What’s your tax residency? with an Add a country… field](../images/09-onboarding-tax-residency.png)

2. **Connect your bank.** Find **Connecteur de test** in the list, or type it in **Search banks…**, then select **Connect** next to it.
3. The browser opens the Powens connection page, which names your Powens application. Select **Accept**.

   ![The Powens page saying that your application partners with Powens to connect your accounts, with an Accept button](../images/13-powens-webview-consent.png)

4. On **Please select your space**, select **Particuliers**. On the next page, select **Open**.
5. The test bank's sign-in page opens. It says **Enter any credentials, it's a fake bank anyway**. Enter any **Username or email** and **Password**, for example `demo` and `1234`, and select **Log in**.

   ![The Powens test bank sign-in page, Demo Bank, with Username or email and Password fields](../images/14-powens-demo-bank-login.png)

6. On **Enter the code received on your fake phone**, enter any code, for example `123456`, and select **Next**. Then select **Allow**.
7. On **Select the accounts to use**, keep **Select all** checked and select **Connect**. On **You're almost done**, select **Finish**.

   ![The Powens page Select the accounts to use, with three test accounts checked and a Connect button](../images/15-powens-select-accounts.png)

8. Powens sends you back to Freenary. A notice says **Connected 3 accounts**, and **Connecteur de test** now reads **3 accounts · Not synced yet**.

   ![Connect your bank in Freenary: Connecteur de test with 3 accounts, the Finish (1) button and the notice Connected 3 accounts](../images/16-onboarding-bank-connected.png)

9. Select **Finish (1)**. The number counts your connected banks.

## 7. Check that it works

1. The home page lists the test bank's accounts under **Accounts**, such as **Compte chèque**, each marked **Connecteur de test**, with their balances.

   ![The Freenary home page with three Connecteur de test accounts and their balances](../images/17-home.png)

2. Open **Settings**, then **Connections**. Under **Bank accounts**, **Connecteur de test** reads **3 accounts · Synced** with the date. Under **Services**, **Bank provider** reads **Configured · Powens**.

   ![Settings, Connections: the Connecteur de test bank with 3 accounts, and the Bank provider row reading Configured · Powens](../images/18-settings-connections.png)

## You're done

Your instance has a bank provider, and your first bank account is connected.

Next:

- [Enable transaction categorisation](../how-to/enable-transaction-categorisation.md) so new transactions get a category.
- [Configure email](../how-to/configure-email.md) so members can confirm their address and reset their password.
- [Configure Powens](../how-to/configure-powens.md) to move from the sandbox to production credentials, or to set the details in `.env`.

## If something goes wrong

- **The Bank step shows Configured through environment variables instead of the provider list.** The server's `.env` already sets the bank provider and its credentials, so there is nothing to enter here. Select **Continue**, or remove those lines from `.env` and run `docker compose up -d --wait` to enter them in the app.
- **Saving shows Your server's environment sets this provider.** `.env` sets `BANKING_PROVIDER` to a different provider than the one you chose. Remove that line from `.env`, run `docker compose up -d --wait`, and try again.
- **Unable to reach Powens. Check the address and your network, then try again.** The `server` container cannot reach `https://<domain>.biapi.pro`. Check the domain name and the server's internet access.
- **The server did not restart** after **Finish setup**. Run `docker compose ps` and `docker compose logs server`, then `docker compose up -d --wait`, and select **Try again**.
- **Bank connection cancelled. Nothing was linked.** You left the Powens page before the end. Select **Connect** again.
