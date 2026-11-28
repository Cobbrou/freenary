import { getLocale } from "@/paraglide/runtime.js";

export const formatChange = (change: number): string =>
  new Intl.NumberFormat(getLocale(), {
    maximumFractionDigits: 0,
    signDisplay: "exceptZero",
    style: "percent",
  }).format(change);

export const formatShare = (share: number): string =>
  new Intl.NumberFormat(getLocale(), {
    maximumFractionDigits: 0,
    style: "percent",
  }).format(share);

export const monthLabel = (month: string, width: "long" | "short"): string =>
  new Date(`${month}-01T00:00:00`).toLocaleDateString(getLocale(), {
    month: width,
  });

export const dayLabel = (iso: string): string =>
  new Date(iso).toLocaleDateString(getLocale(), {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
