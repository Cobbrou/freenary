---
title: Configure Enable Banking
description: Connect Freenary to Enable Banking instead of Powens.
---

This page connects Freenary to Enable Banking, the other bank provider Freenary supports. A bank provider is the service that links members' bank accounts so their transactions arrive on their own. You can enter the credentials in the app or put them in `.env`. If both hold a value for the same setting, the value in `.env` wins.

## Before you start

- Freenary runs, and you can sign in as the operator. The operator is the account that claimed the instance (see [First run and the operator](../explanation/first-run-and-operator.md)), and only the operator sees the setup screen and the **Services** list in **Settings**.
- You know the web address of your instance, for example `http://localhost:3001`. After a member connects a bank, Enable Banking sends them back to that address followed by `/callback/enable-banking`.
- You have an application registered in the [Enable Banking control panel](https://enablebanking.com/sign-in/), with its application ID and its private key in PEM form.

  > **TODO (unverified):** how you register an application in the Enable Banking control panel, where you download its private key, and whether a sandbox application needs a separate step.

## Steps

### In the app

1. Open the setup screen. It opens on its own after the first sign-in, on the **Bank** step. On an instance that is already set up, open **Settings** › **Services** instead, find **Bank provider**, and select **Set up** or **Change**.
2. Select **Enable Banking**, then select **Continue**.
3. On **Step 1 of 3**, enter the ID of your application in **Application ID**. Select **Next**.
4. On **Step 2 of 3**, select **Copy** next to **Redirect URL**, and add this redirect URL to your application in the Enable Banking control panel. Select **Next**.
5. On **Step 3 of 3**, paste your application's private key in **Private key (PEM)**, the `BEGIN` and `END` lines included.
6. Select **Save and continue** on the setup screen, or **Save** in **Settings**. Freenary first tests the credentials, then saves them.
7. If members already connected banks through Powens, **Settings** asks **Switch the bank provider?** Their bank connections can no longer sync, and each owner has to remove the bank and connect it again. Select **Switch provider** to go on.
8. Apply the change. On the setup screen, go on to the **Done** step and select **Finish setup**. In **Settings**, select **Apply now** in the **Restart to apply your changes** notice. The page shows **Applying your settings…** while the server restarts.

### In `.env`

1. Add your web address followed by `/callback/enable-banking` as a redirect URL of your application, for example `http://localhost:3001/callback/enable-banking`. Freenary builds this URL from `CORS_ORIGIN`, which `docker-compose.yml` sets to `http://localhost:3001` when `.env` leaves it out.
2. Add the provider and its two values to `.env`. `BANKING_PROVIDER` defaults to `powens`, so this line is required. Write the key on one line and replace each line break with `\n`: Freenary turns every `\n` back into a line break.

   ```dotenv
   BANKING_PROVIDER=enable-banking
   ENABLE_BANKING_APP_ID=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee
   ENABLE_BANKING_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQ...\n-----END PRIVATE KEY-----"
   ```

   See [Configuration](../reference/configuration.md#bank-providers).

3. Recreate the server container so it reads the new values:

   ```bash
   docker compose up -d
   ```

## Check that it works

1. Open **Settings** › **Services**. The **Bank provider** row reads **Configured · Enable Banking** when you saved the values in the app, or **Set by your server · Enable Banking** when they come from `.env`.
2. For values from `.env`, select **View**, then **Test connection**. The test signs a token with your private key and asks `https://api.enablebanking.com/application` for your application. A working setup shows **Enable Banking is ready**.
3. Connect a bank as described in [Connect your first bank](../tutorials/connect-your-first-bank.md).

## If something goes wrong

- **A value has the wrong format. Check the fields and try again.** Freenary could not sign a token with the key. Paste the whole PEM key, the `BEGIN` and `END` lines included. In `.env`, check that each line break is written as `\n`.
- **Enable Banking refused these credentials. Check them and try again.** Enable Banking answered the test with an error. Check that the application ID and the key belong to the same application. **Show details** holds the answer. **Save anyway** saves the values without the test.
- **Unable to reach Enable Banking. Check the address and your network, then try again.** The server could not reach `https://api.enablebanking.com`. Check that the server container can reach the internet.
- **Your server's environment sets this provider.** `.env` sets `BANKING_PROVIDER` to another provider. Change that line in `.env`, then run `docker compose up -d`.
- **The server did not restart** and **It did not answer within one minute.** The server did not come back after **Apply now** or **Finish setup**. Run `docker compose ps` and `docker compose logs server`, then `docker compose up -d`, and select **Try again**.
- A server log line contains `Enable Banking is not configured`. `ENABLE_BANKING_APP_ID` or `ENABLE_BANKING_PRIVATE_KEY` is missing. Set both.

## Related

- [Configure Powens](configure-powens.md)
- [Where settings come from](../explanation/settings-sources.md)
- [Configuration](../reference/configuration.md#bank-providers)
