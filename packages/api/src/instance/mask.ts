const VISIBLE_EDGE = 4;
const ELLIPSIS = "…";

export const maskEnvironmentValue = (value: string): string => {
  if (value.length <= VISIBLE_EDGE * 2) {
    return ELLIPSIS;
  }

  return `${value.slice(0, VISIBLE_EDGE)}${ELLIPSIS}${value.slice(-VISIBLE_EDGE)}`;
};
