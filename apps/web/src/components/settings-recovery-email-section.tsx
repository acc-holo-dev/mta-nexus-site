"use client";

import { Button, fieldControlClass } from "@nexus/ui";
import { MailCheck } from "lucide-react";
import type { FormEvent } from "react";
import type { getDictionary } from "../lib/i18n";
import type { SettingsRecoveryEmail } from "../lib/settings-client-api";

type SettingsCopy = ReturnType<typeof getDictionary>["settings"];

type Props = {
  copy: SettingsCopy;
  recoveryEmail: SettingsRecoveryEmail | null;
  recoveryPassword: string;
  pending: boolean;
  dateLocale: string;
  onRecoveryPasswordChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function SettingsRecoveryEmailSection({
  copy,
  recoveryEmail,
  recoveryPassword,
  pending,
  dateLocale,
  onRecoveryPasswordChange,
  onSubmit,
}: Props) {
  return (
    <section
      aria-labelledby="recovery-email-heading"
      className="nexus-panel space-y-4 p-5 shadow-nexus-sm"
    >
      <div className="flex items-center gap-2">
        <MailCheck className="h-4 w-4 text-accent" aria-hidden="true" />
        <h2 id="recovery-email-heading" className="text-sm font-semibold text-primary">
          {copy.recoveryEmail}
        </h2>
      </div>

      {recoveryEmail && (
        <>
          <div className="rounded-md border border-base bg-inset px-3 py-3">
            <div className="break-all text-sm text-primary">{recoveryEmail.email}</div>
            <div className="mt-1 text-xs text-muted">
              {recoveryEmail.verified
                ? `${copy.verifiedForRecovery}${
                    recoveryEmail.verifiedAt
                      ? ` ${copy.verifiedOn} ${new Date(recoveryEmail.verifiedAt).toLocaleString(
                          dateLocale,
                        )}`
                      : ""
                  }.`
                : recoveryEmail.eligible
                  ? copy.recoveryNotVerified
                  : copy.recoveryUnavailable}
            </div>
          </div>

          {!recoveryEmail.verified && recoveryEmail.eligible && (
            <form onSubmit={onSubmit} aria-label={copy.verifyRecoveryEmail} className="space-y-3">
              <p id="recovery-email-policy" className="text-sm text-muted">
                {copy.recoveryPolicy}
              </p>

              <div className="max-w-sm space-y-1">
                <label htmlFor="recovery-current-password" className="block text-sm text-primary">
                  {copy.recoveryPassword}
                </label>
                <input
                  id="recovery-current-password"
                  name="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  required
                  minLength={1}
                  maxLength={128}
                  disabled={pending}
                  value={recoveryPassword}
                  onChange={(event) => onRecoveryPasswordChange(event.target.value)}
                  aria-describedby="recovery-email-policy"
                  className={fieldControlClass({
                    disabled: pending,
                    className: "min-h-11",
                  })}
                />
              </div>

              <Button type="submit" size="touch" isLoading={pending}>
                {copy.sendVerification}
              </Button>
            </form>
          )}
        </>
      )}
    </section>
  );
}
