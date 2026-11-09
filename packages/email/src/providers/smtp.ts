import { createTransport } from "nodemailer";

import type { EmailMessage, EmailProvider } from "../types";

interface SmtpCredentials {
  from: string;
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  password?: string;
}

export const createSmtpEmailProvider = (
  credentials: SmtpCredentials
): EmailProvider => {
  const pooledTransport = createTransport({
    auth:
      credentials.user === undefined
        ? undefined
        : { pass: credentials.password, user: credentials.user },
    host: credentials.host,
    pool: true,
    port: credentials.port,
    requireTLS: !credentials.secure && credentials.user !== undefined,
    secure: credentials.secure,
  });

  return {
    id: "smtp",
    send: async (message: EmailMessage) => {
      await pooledTransport.sendMail({
        from: credentials.from,
        subject: message.subject,
        text: message.text,
        to: message.to,
      });
    },
  };
};
