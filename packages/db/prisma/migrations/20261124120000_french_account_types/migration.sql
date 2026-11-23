-- French savings and investment wrappers get a type of their own, so each one can
-- follow its own rule in the balance, net worth and cash-flow calculations.
-- Existing rows keep their type until the next sync reads it again from the provider.
ALTER TYPE "BankAccountType" ADD VALUE 'LIVRET_A';
ALTER TYPE "BankAccountType" ADD VALUE 'LDDS';
ALTER TYPE "BankAccountType" ADD VALUE 'LEP';
ALTER TYPE "BankAccountType" ADD VALUE 'CEL';
ALTER TYPE "BankAccountType" ADD VALUE 'PEL';
ALTER TYPE "BankAccountType" ADD VALUE 'TERM_DEPOSIT';
ALTER TYPE "BankAccountType" ADD VALUE 'PEA';
