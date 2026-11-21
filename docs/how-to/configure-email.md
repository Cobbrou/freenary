---
title: Configure email
description: Send one-time codes and address confirmations through Resend or SMTP.
---

This page connects Freenary to an email provider, so it can send one-time codes: six-digit codes that confirm an email address or reset a password. Freenary sends email through Resend, a hosted email API, or through any SMTP mail server. You can set this up in **Settings** or in `.env`. If both hold a value for the same setting, the value in `.env` wins. The setup screen has no email step. [Sign-in and email](../explanation/sign-in-and-email.md) explains what changes for members.

## Before you start

- Freenary runs, and you can sign in as the operator. The operator is the first account created on the instance, and only the operator sees the **Services** list in **Settings**.
- To use **Settings**, you finished your own onboarding by connecting a bank: until then every page of the app, including **Settings**, sends you back to onboarding. See [First run and the operator](../explanation/first-run-and-operator.md#onboarding). The `.env` way works at any time.
- You have a sender address, for example `Freenary <no-reply@example.com>`.
- For Resend, you have a Resend API key. For SMTP, you have the host name of the mail server, and its user and password if it asks for them.

  > **TODO (unverified):** how you verify a sending domain and create an API key in the Resend dashboard, and which key permission the connection test needs.

## Steps

### In the app

1. Open **Settings** › **Connections**. Under **Services**, find **Email delivery** and select **Set up**.
2. Select **Resend** or **SMTP**, then select **Continue**.
3. Enter the sender in **Sender address**.
4. For Resend, paste the key in **API key**. For SMTP, enter the mail server in **Host**, then open **More options** to fill **Port**, **Implicit TLS**, **User** and **Password** if your server needs them.
5. Select **Save**. Freenary first tests the settings, then saves them.
6. Select **Apply now** in the **Restart to apply your changes** notice. The page shows **Applying your settings…** while the server restarts.

### In `.env`

1. Add the provider and its values to `.env`. For Resend:

   ```dotenv
   EMAIL_PROVIDER=resend
   EMAIL_FROM=Freenary <no-reply@example.com>
   RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx
   ```

   For SMTP:

   ```dotenv
   EMAIL_PROVIDER=smtp
   EMAIL_FROM=Freenary <no-reply@example.com>
   SMTP_HOST=smtp.example.com
   SMTP_USER=no-reply@example.com
   SMTP_PASSWORD=a-mail-account-password
   ```

   `SMTP_SECURE=false`, the default, uses STARTTLS on port `587`. `SMTP_SECURE=true` uses implicit TLS on port `465`. `SMTP_PORT` overrides the port. Leave out `SMTP_USER` and `SMTP_PASSWORD` for a server that takes no login. See [Configuration](../reference/configuration.md#email).

2. Recreate the server container so it reads the new values:

   ```bash
   docker compose up -d
   ```

## Check that it works

1. Ask the server what it offers:

   ```bash
   curl -s -X POST -H 'content-type: application/json' http://localhost:3001/api-reference/auth/capabilities
   ```

   The answer contains `"emailDelivery":true`. Before you set up email, it contains `"emailDelivery":false`.

2. Sign out. The sign-in form now shows **Forgot password?**. Select it and send a reset code to your own address. The email arrives with the subject `Reset your Freenary password`.
3. In **Settings** › **Connections**, the **Email delivery** row reads **Configured · Resend** or **Configured · SMTP**, or **Set by your server · …** when the values come from `.env`.

## If something goes wrong

- The server stops at start, and `docker compose logs server` shows `EMAIL_PROVIDER=smtp requires SMTP_HOST to be set.` or a similar line for `EMAIL_FROM` or `RESEND_API_KEY`. A required value is missing from `.env`. Add it and run `docker compose up -d`.
- **Fill in …** names the missing fields. Fill them in and save again.
- **Resend refused these credentials. Check them and try again.** Resend refused the key when the test called `https://api.resend.com/domains`. Check the key. **Show details** holds the answer from Resend. **Save anyway** saves without the test.
- **Unable to reach SMTP. Check the address and your network, then try again.** The test could not open a connection to the mail server. Check **Host**, **Port** and **Implicit TLS**: port `465` usually goes with implicit TLS, and port `587` with STARTTLS.
- Codes never arrive through SMTP with `SMTP_SECURE=false` and a user set. Freenary then requires STARTTLS, so the password never travels in clear, and refuses a server that does not offer it. Use `SMTP_SECURE=true` with port `465`, or a server that offers STARTTLS.
- **The server did not restart** and **It did not answer within one minute.** Run `docker compose ps` and `docker compose logs server`, then `docker compose up -d`, and select **Try again**.

## Related

- [Sign-in and email](../explanation/sign-in-and-email.md)
- [Where settings come from](../explanation/settings-sources.md)
- [Configuration](../reference/configuration.md#email)
