import { EmptyState, SectionHeader, StatusBadge } from "@nexus/ui";
import type { AdSlotPlan } from "@nexus/domain";
import type { Locale } from "../../lib/i18n";

/**
 * UX-24 -- admin overview of the (feature-flagged) advertising placement
 * lifecycle. Read-only inventory listing: slots, capacity, and active bookings.
 * Management actions and any exposure to production visitors or payments remain
 * behind the NEXT_PUBLIC_ADVERTISING_LIFECYCLE switch and a separate activation
 * gate. When disabled the section does not render at all.
 */

type SlotSummary = {
  slot: AdSlotPlan;
  pending: number;
  active: number;
};

function slotLabel(slot: AdSlotPlan): string {
  return slot.name || slot.positionKey;
}

export function AdminAdPlacementSection({
  locale,
  slots,
}: {
  locale: Locale;
  slots: SlotSummary[];
}) {
  const enabledCount = slots.filter((s) => s.slot.enabled).length;
  return (
    <section>
      <SectionHeader
        title={locale === "ru" ? "Размещение (lifecycle)" : "Placement lifecycle"}
        description={
          locale === "ru"
            ? "Слоты, ёмкость и активные размещения (feature-flag, без публичной выдачи)"
            : "Slots, capacity and active placements (feature-flag, no public exposure)"
        }
      />
      {slots.length === 0 ? (
        <EmptyState
          title={locale === "ru" ? "Слоты ещё не созданы" : "No ad slots yet"}
          description={
            locale === "ru"
              ? "Зарегистрируйте админ-оператором слоты через репозиторий размещений."
              : "Register ad slots through the placement repository as an admin operator."
          }
        />
      ) : (
        <ul className="space-y-3">
          {slots.map(({ slot, pending, active }) => (
            <li
              key={slot.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-base p-3"
            >
              <div className="min-w-0">
                <p className="break-words font-semibold text-primary">{slotLabel(slot)}</p>
                <p className="font-caption text-muted">
                  {locale === "ru"
                    ? `Позиция ${slot.positionKey} · ёмкость ${slot.capacity}`
                    : `Position ${slot.positionKey} · capacity ${slot.capacity}`}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {pending > 0 && (
                  <StatusBadge
                    tone="warning"
                    status={locale === "ru" ? `В ожидании: ${pending}` : `Pending: ${pending}`}
                  />
                )}
                <StatusBadge
                  tone={active > 0 ? "success" : "neutral"}
                  status={locale === "ru" ? `Активно: ${active}` : `Active: ${active}`}
                />
              </div>
            </li>
          ))}
          <li className="font-caption text-faint">
            {locale === "ru"
              ? `Итого включено слотов: ${enabledCount}`
              : `Enabled slots total: ${enabledCount}`}
          </li>
        </ul>
      )}
    </section>
  );
}
