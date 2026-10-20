export type BankLinking =
  | "available"
  | "check-failed"
  | "pending"
  | "unavailable";

export const bankLinkingOf = ({
  available,
  isError,
}: {
  available: boolean | undefined;
  isError: boolean;
}): BankLinking => {
  if (available !== undefined) {
    return available ? "available" : "unavailable";
  }

  return isError ? "check-failed" : "pending";
};
