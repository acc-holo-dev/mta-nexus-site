"use client";

import { Button, fieldControlClass } from "@nexus/ui";
import { KeyRound } from "lucide-react";
import type { FormEvent } from "react";
import type { getDictionary } from "../lib/i18n";

type SettingsCopy = ReturnType<typeof getDictionary>["settings"];

type PasswordFields = {
  currentPassword: string;
  newPassword: string;
};

type Props = {
  copy: SettingsCopy;
  password: PasswordFields;
  pending: boolean;
  onPasswordChange: (password: PasswordFields) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function SettingsPasswordForm({
  copy,
  password,
  pending,
  onPasswordChange,
  onSubmit,
}: Props) {
  return (
    <section
      aria-labelledby="password-heading"
      className="nexus-panel space-y-4 p-5 shadow-nexus-sm"
    >
      <div className="flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-accent" aria-hidden="true" />
        <h2 id="password-heading" className="text-sm font-semibold text-primary">
          {copy.changePassword}
        </h2>
      </div>

      <p id="password-policy" className="text-sm text-muted">
        {copy.passwordDescription}
      </p>

      <form
        onSubmit={onSubmit}
        aria-label={copy.changePassword}
        aria-describedby="password-policy"
        className="grid gap-3 sm:grid-cols-2"
      >
        <div className="min-w-0 space-y-1">
          <label htmlFor="current-password" className="block text-sm text-primary">
            {copy.currentPassword}
          </label>
          <input
            id="current-password"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            minLength={1}
            maxLength={128}
            disabled={pending}
            value={password.currentPassword}
            onChange={(event) =>
              onPasswordChange({
                ...password,
                currentPassword: event.target.value,
              })
            }
            className={fieldControlClass({
              disabled: pending,
              className: "min-h-11",
            })}
          />
        </div>

        <div className="min-w-0 space-y-1">
          <label htmlFor="new-password" className="block text-sm text-primary">
            {copy.newPassword}
          </label>
          <input
            id="new-password"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={128}
            disabled={pending}
            value={password.newPassword}
            onChange={(event) =>
              onPasswordChange({
                ...password,
                newPassword: event.target.value,
              })
            }
            aria-describedby="password-length"
            className={fieldControlClass({
              disabled: pending,
              className: "min-h-11",
            })}
          />
          <p id="password-length" className="text-xs text-muted">
            {copy.passwordHint}
          </p>
        </div>

        <Button
          type="submit"
          size="touch"
          isLoading={pending}
          className="justify-self-start sm:col-span-2"
        >
          {copy.updatePassword}
        </Button>
      </form>
    </section>
  );
}
