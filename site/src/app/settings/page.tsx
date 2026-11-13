import { SettingsPageClient } from "../../components/settings-page-client";

const pageShellClass = "min-w-0 overflow-x-clip";

export default function SettingsPage() {
  return (
    <div className={pageShellClass}>
      <SettingsPageClient />
    </div>
  );
}
