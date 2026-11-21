---
title: Sign-in and email
description: What changes for members when the instance has an email provider.
---

Freenary works with or without an email provider. This page describes how sign-up, sign-in and password reset behave in each case, as the code in `packages/auth` and `apps/web/src/pages/login` does it. To connect a provider, see [Configure email](../how-to/configure-email.md).

## Without and with an email provider

With no email provider, which is the default:

- Sign-up signs the new member in at once. Nobody confirms an email address.
- The sign-in form shows no **Forgot password?** link.

With an email provider:

- Sign-up sends a code and shows **Account created. Confirm your email with the code we sent.** The member enters it on **Confirm your email** before the account opens.
- A password sign-in with an unconfirmed address sends a new code and asks for it. Accounts created while email was off have unconfirmed addresses, so their owners confirm them at their next password sign-in.
- The sign-in form shows **Forgot password?**, which leads to **Reset your password** and **Send reset code**.
- A code expires after 10 minutes, and Freenary allows 3 attempts per code.

Freenary does not offer sign-in by email code alone.

## Related

- [Configure email](../how-to/configure-email.md)
- [Add sign-in providers](../how-to/add-sign-in-providers.md)
- [First run and the operator](first-run-and-operator.md)
