import Link from "next/link";
import type { MouseEventHandler, ReactNode } from "react";

export const platformSignInFocusClass =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

const loginLinkClass = `inline-flex min-h-11 items-center rounded-md bg-accent px-4 text-sm font-medium text-white underline-offset-4 hover:underline ${platformSignInFocusClass}`;
const registerLinkClass = `inline-flex min-h-11 items-center text-sm text-secondary underline ${platformSignInFocusClass}`;

export function GuestAuthLinks({
  loginHref,
  registerHref,
  signInLabel,
  createAccountLabel,
  className,
  onLoginClick,
  onRegisterClick,
}: {
  loginHref: string;
  registerHref: string;
  signInLabel: ReactNode;
  createAccountLabel: ReactNode;
  className?: string;
  onLoginClick?: MouseEventHandler<HTMLAnchorElement>;
  onRegisterClick?: MouseEventHandler<HTMLAnchorElement>;
}) {
  return (
    <div className={`flex flex-wrap items-center gap-4${className ? ` ${className}` : ""}`}>
      <Link href={loginHref} className={loginLinkClass} onClick={onLoginClick}>
        {signInLabel}
      </Link>
      <Link href={registerHref} className={registerLinkClass} onClick={onRegisterClick}>
        {createAccountLabel}
      </Link>
    </div>
  );
}

GuestAuthLinks.displayName = "GuestAuthLinks";
