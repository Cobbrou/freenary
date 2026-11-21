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

export interface ApiKeySummary {
  createdAt: Date;
  expiresAt: Date | null;
  id: string;
  lastRequest: Date | null;
  name: string | null;
  start: string | null;
}

export const CREDENTIAL_PROVIDER_ID = "credential";

export const AUTH_SESSIONS_QUERY_KEY = ["auth", "sessions"];
export const AUTH_ACCOUNTS_QUERY_KEY = ["auth", "accounts"];
export const AUTH_API_KEYS_QUERY_KEY = ["auth", "api-keys"];

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

export const authApiKeysQueryOptions = () =>
  queryOptions<ApiKeySummary[]>({
    queryFn: async () => {
      const { data: listing, error } = await authClient.apiKey.list();

      if (error) {
        throw new Error(error.message ?? m.settings_api_keys_load_error());
      }

      return listing.apiKeys.map((apiKey) => ({
        createdAt: new Date(apiKey.createdAt),
        expiresAt:
          apiKey.expiresAt === null ? null : new Date(apiKey.expiresAt),
        id: apiKey.id,
        lastRequest:
          apiKey.lastRequest === null ? null : new Date(apiKey.lastRequest),
        name: apiKey.name,
        start: apiKey.start,
      }));
    },
    queryKey: AUTH_API_KEYS_QUERY_KEY,
  });
