import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { AdminVerificationQueueSection } from "../../apps/web/src/components/admin/admin-verification-queue-section";
import { getDictionary } from "../../apps/web/src/lib/i18n";

vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({
      href,
      children,
      ...props
    }: React.PropsWithChildren<{ href: string } & Record<string, unknown>>) =>
      React.createElement("a", { href, ...props }, children),
  };
});

vi.mock("../../apps/web/src/components/verification-moderation-controls", () => ({
  VerificationModerationControls: ({ requestId }: { requestId: string }) => (
    <button type="button" data-verification={requestId}>
      Decide
    </button>
  ),
}));

const request = {
  id: "ver_server_1",
  targetType: "server",
  targetId: "srv_a",
  requesterId: "usr_a",
  createdAt: "2026-11-06T12:00:00.000Z",
  notes: null,
  evidenceUpdated: false,
  targetUsername: null,
  organizationSlug: null,
  currentSpecialties: null,
  currentGithubUrl: null,
  serverName: "Nexus Drift",
  serverSlug: "nexus-drift",
  claimScope: "organization" as const,
  proofMatchesServer: false,
  proofUrl: null,
  reviewNotes: null,
  resolvedAt: null,
  status: "pending",
  applicationRevision: "rev-1",
};

it.each(["en", "ru"] as const)(
  "shows claim-aware server context and focused deep-link chrome in %s",
  (locale) => {
    const copy = getDictionary(locale).admin;
    const html = renderToStaticMarkup(
      <AdminVerificationQueueSection
        locale={locale}
        copy={copy}
        dateLocale={locale === "ru" ? "ru-RU" : "en-US"}
        verificationView="pending"
        verificationPage={1}
        pendingVerificationCount={1}
        verificationRequests={[request]}
        moreVerifications={false}
        verificationHref={(view, page) =>
          `/admin?verificationView=${view}&verificationPage=${page}`
        }
        focusedVerificationId="ver_server_1"
      />,
    );
    expect(html).toContain('id="verification-ver_server_1"');
    expect(html).toContain('data-verification-focus="true"');
    expect(html).toContain("Nexus Drift");
    expect(html).toContain("/servers/nexus-drift");
    expect(html).toContain("/workspace/servers/srv_a");
    expect(html).toContain(copy.verificationClaimOrganization);
    expect(html).toContain(copy.verificationProofStale);
    expect(html).toContain(copy.verificationOpenServer);
    expect(html).toContain(copy.verificationManagedServer);
  },
);
