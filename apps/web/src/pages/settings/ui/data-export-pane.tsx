import { Button } from "@freenary/ui/components/button";

import { m } from "@/paraglide/messages.js";

import { useDataExport } from "../model/use-data-export";
import { SettingsPane, SettingsSection } from "./settings-section";

export const DataExportPane = () => {
  const { download, isDownloading } = useDataExport();

  return (
    <SettingsPane
      description={m.settings_tab_export_description()}
      title={m.settings_tab_export()}
    >
      <SettingsSection
        action={
          <Button loading={isDownloading} onClick={download} variant="tertiary">
            {m.settings_export_action()}
          </Button>
        }
        description={m.settings_export_description()}
        title={m.settings_export_title()}
      />
    </SettingsPane>
  );
};
