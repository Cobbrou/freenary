import { queryOptions } from "@tanstack/react-query";

import { m } from "@/paraglide/messages.js";
import { authClient } from "@/shared/auth";

export interface UserSession {
  createdAt: Date;
  expiresAt: Date;
  id: string;
  ipAddress?: string | null;
  token: string;
  updatedAt: Date;
  userAgent?: string | null;
}

export interface LinkedAccount {
  accountId: string;
  createdAt: Date;
  id: string;
  providerId: string;
  updatedAt: Date;
}

export const CREDENTIAL_PROVIDER_ID = "credential";

export const AUTH_SESSIONS_QUERY_KEY = ["auth", "sessions"];
export const AUTH_ACCOUNTS_QUERY_KEY = ["auth", "accounts"];

export const authSessionsQueryOptions = () =>
  queryOptions<UserSession[]>({
    queryFn: async () => {
      const { data: sessions, error } = await authClient.listSessions();

      if (error) {
        throw new Error(error.message ?? m.settings_sessions_load_error());
      }

      return sessions;
    },
    queryKey: AUTH_SESSIONS_QUERY_KEY,
  });

export const authAccountsQueryOptions = () =>
  queryOptions<LinkedAccount[]>({
    queryFn: async () => {
      const { data: accounts, error } = await authClient.listAccounts();

      if (error) {
        throw new Error(error.message ?? m.settings_accounts_load_error());
      }

      return accounts;
    },
    queryKey: AUTH_ACCOUNTS_QUERY_KEY,
  });
