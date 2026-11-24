import type { Transporter } from "nodemailer";

import type { EmailMessage, EmailProvider } from "../types";

interface SmtpCredentials {
  from: string;
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  password?: string;
}

const openPooledTransport = async (
  credentials: SmtpCredentials
): Promise<Transporter> => {
  const { createTransport } = await import("nodemailer");

  return createTransport({
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
};

export const createSmtpEmailProvider = (
  credentials: SmtpCredentials
): EmailProvider => {
  let pooledTransport: Promise<Transporter> | null = null;

  const transport = () => {
    pooledTransport ??= openPooledTransport(credentials);

    return pooledTransport;
  };

  return {
    id: "smtp",
    send: async (message: EmailMessage) => {
      const opened = await transport();

      await opened.sendMail({
        from: credentials.from,
        subject: message.subject,
        text: message.text,
        to: message.to,
      });
    },
  };
};
