import type { ReactNode } from "react";
import { pageShellMaxMdAuthTall } from "../../shell/page-shell";
import { DictionaryFieldRouteLoading } from "../../shell/route-honest-loading-server";
import { skelH11, skelH28 } from "../../shell/skeleton-shell";

function AuthRouteLoading({
  headingId,
  titlePath,
  loadingPath = "errors.loading",
  className = pageShellMaxMdAuthTall,
  headerClassName = "space-y-2 text-center",
  titleClassName,
  statusClassName,
  rows = 0,
  rowClassName = "h-11 rounded bg-inset",
  leading,
}: {
  headingId: string;
  titlePath: string;
  loadingPath?: string;
  className?: string;
  headerClassName?: string;
  titleClassName?: string;
  statusClassName?: string;
  rows?: number;
  rowClassName?: string;
  leading?: ReactNode;
}) {
  return DictionaryFieldRouteLoading({
    headingId,
    titlePath,
    loadingPath,
    className,
    headerClassName,
    ...(titleClassName !== undefined ? { titleClassName } : {}),
    ...(statusClassName !== undefined ? { statusClassName } : {}),
    rows,
    rowClassName,
    ...(leading !== undefined ? { leading } : {}),
  });
}

export function AuthForgotRouteLoading() {
  return AuthRouteLoading({
    headingId: "auth-forgot-loading-heading",
    titlePath: "recovery.forgotTitle",
    leading: (
      <>
        <div className={skelH11} />
        <div className={skelH11} />
      </>
    ),
  });
}

export function AuthLoginRouteLoading() {
  return AuthRouteLoading({
    headingId: "auth-login-loading-heading",
    titlePath: "auth.loginTitle",
    leading: (
      <>
        <div className={skelH11} />
        <div className={skelH11} />
        <div className={skelH11} />
      </>
    ),
  });
}

export function AuthRegisterRouteLoading() {
  return AuthRouteLoading({
    headingId: "auth-register-loading-heading",
    titlePath: "auth.registerTitle",
    leading: (
      <>
        <div className={skelH11} />
        <div className={skelH11} />
        <div className={skelH11} />
        <div className={skelH11} />
      </>
    ),
  });
}

export function AuthResetRouteLoading() {
  return AuthRouteLoading({
    headingId: "auth-reset-loading-heading",
    titlePath: "recovery.resetTitle",
    loadingPath: "recovery.checkingReset",
    leading: (
      <>
        <div className={skelH11} />
        <div className={skelH11} />
        <div className={skelH11} />
      </>
    ),
  });
}

export function AuthVerifyEmailRouteLoading() {
  return AuthRouteLoading({
    headingId: "auth-verify-email-loading-heading",
    titlePath: "recovery.verifyTitle",
    loadingPath: "recovery.checkingVerification",
    leading: (
      <>
        <div className={skelH28} />
        <div className="h-11 w-40 rounded bg-inset" />
      </>
    ),
  });
}

export function AuthVerifyRouteLoading() {
  return AuthRouteLoading({
    headingId: "auth-verify-loading-heading",
    titlePath: "recovery.verifyTitle",
    loadingPath: "recovery.checkingVerification",
    leading: (
      <>
        <div className={skelH28} />
        <div className="h-11 w-40 rounded bg-inset" />
      </>
    ),
  });
}
