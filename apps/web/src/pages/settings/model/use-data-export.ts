import { useMutation } from "@tanstack/react-query";

import { client, orpc } from "@/shared/api";

import { downloadDataExport } from "../lib/download-data-export";

export const useDataExport = () => {
  const exportMutation = useMutation({
    mutationFn: () => client.dataExport.download(),
    mutationKey: orpc.dataExport.download.mutationKey(),
    onSuccess: downloadDataExport,
  });

  return {
    download: () => exportMutation.mutate(),
    isDownloading: exportMutation.isPending,
  };
};
