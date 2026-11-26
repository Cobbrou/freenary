import type { DataExport } from "@freenary/api/lib/data-export";

const fileNameOf = (exported: DataExport): string =>
  `freenary-export-${exported.exportedAt.slice(0, 10)}.json`;

export const downloadDataExport = (exported: DataExport): void => {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(exported, null, 2)], {
      type: "application/json",
    })
  );

  const link = document.createElement("a");

  link.href = url;
  link.download = fileNameOf(exported);
  document.body.append(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 0);
};
