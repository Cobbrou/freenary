import { Data } from "effect";
import type { Effect } from "effect";

export interface ProviderInstitution {
  id: string;
  name: string;
  country: string;
  logoUrl?: string;
  bic?: string;
  group?: string;
}

export interface ProviderCreditorIdentification {
  schemeName: string;
  identification: string;
}

export interface ProviderTransaction {
  providerTransactionId: string;
  bookingDate: string;
  valueDate?: string;
  transactionDate?: string;
  amountMinor: number;
  currency: string;
  originalAmountMinor?: number;
  originalCurrency?: string;
  remittanceLines: string[];
  creditorName?: string;
  debtorName?: string;
  creditorIban?: string;
  debtorIban?: string;
  creditorAgentBic?: string;
  creditorTown?: string;
  creditorCountry?: string;
  creditorIdentifications?: ProviderCreditorIdentification[];
  merchantCategoryCode?: string;
  bankTransactionFamilyCode?: string;
  bankTransactionSubCode?: string;
  bankTransactionDescription?: string;
  referenceNumber?: string;
  referenceNumberScheme?: string;
  balanceAfterMinor?: number;
  status: string;
  exchangeRate?: string;
  psuNote?: string;
}

export interface ProviderUserSession {
  providerUserId: string;
  accessToken: string;
}

export interface StartConnectionRequest {
  institutionId: string;
  country: string;
  providerSessionId?: string;
  redirectUrl: string;
  state: string;
  user: ProviderUserSession | null;
}

export interface CompleteConnectionRequest {
  callbackParams: Record<string, string>;
  providerSessionId?: string;
  user: ProviderUserSession | null;
}

export interface ConnectionRequest {
  providerSessionId: string;
  user: ProviderUserSession | null;
}

export interface FetchTransactionsRequest extends ConnectionRequest {
  providerAccountId: string;
  accountCurrency: string | null;
  dateFrom: string;
  dateTo: string;
}

export interface FetchHoldingsRequest extends ConnectionRequest {
  providerAccountId: string;
}

export interface ProviderBalance {
  currency: string;
  balanceMinor: number;
  balanceAt?: string;
}

export interface ProviderAccount {
  providerAccountId: string;
  name?: string;
  iban?: string;
  type: ProviderAccountType;
  currency?: string;
  balanceMinor?: number;
  balanceAt?: string;
  balances?: ProviderBalance[];
}

export interface ProviderHolding {
  providerHoldingId: string;
  label: string;
  code?: string;
  codeType?: "ISIN" | "AMF";
  quantity: string;
  unitCost?: string;
  unitValue?: string;
  valuationMinor: number;
  unrealisedGainMinor?: number;
  currency: string;
  valuedAt?: string;
}

export interface CompletedConnection {
  providerSessionId: string;
  institutionName: string;
  institutionGroup?: string;
  accounts: {
    providerAccountId: string;
    iban?: string;
    identificationHash?: string;
    name?: string;
    type?: ProviderAccountType;
    currency?: string;
  }[];
}

export interface BankingProvider {
  readonly id: string;
  readonly callbackPath: `/callback/${string}`;
  isConfigured: () => boolean;
  createUser?: () => Promise<ProviderUserSession>;
  deleteUser?: (user: ProviderUserSession) => Promise<void>;
  listInstitutions: () => Effect.Effect<
    ProviderInstitution[],
    BankInstitutionsUnavailable
  >;
  startConnection: (
    request: StartConnectionRequest
  ) => Promise<{ url: string }>;
  completeConnection: (
    request: CompleteConnectionRequest
  ) => Promise<CompletedConnection>;
  closeConnection: (request: ConnectionRequest) => Promise<void>;
  fetchTransactions: (
    request: FetchTransactionsRequest
  ) => Promise<ProviderTransaction[]>;
  needsReconnect: (cause: unknown) => boolean;
  fetchAccounts?: (request: ConnectionRequest) => Promise<ProviderAccount[]>;
  fetchHoldings?: (request: FetchHoldingsRequest) => Promise<ProviderHolding[]>;
}

export const PROVIDER_ACCOUNT_TYPES = [
  "CHECKING",
  "CARD",
  "SAVINGS",
  "LIVRET_A",
  "LDDS",
  "LEP",
  "CEL",
  "PEL",
  "TERM_DEPOSIT",
  "BROKERAGE",
  "PEA",
  "LIFE_INSURANCE",
  "RETIREMENT",
  "EMPLOYEE_SAVINGS",
  "REAL_ESTATE",
  "CROWDLENDING",
  "LOAN",
  "UNKNOWN",
] as const;

export type ProviderAccountType = (typeof PROVIDER_ACCOUNT_TYPES)[number];

export class BankInstitutionsUnavailable extends Data.TaggedError(
  "BankInstitutionsUnavailable"
)<{ cause?: unknown }> {
  override readonly message = "Could not load banks";
}
