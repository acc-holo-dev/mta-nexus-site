import { SettingsPageClient } from "../../features/accounts/settings";

const pageShellClass = "min-w-0 overflow-x-clip";

export default function SettingsPage() {
  return (
    <div className={pageShellClass}>
      <SettingsPageClient />
    </div>
  );
}
