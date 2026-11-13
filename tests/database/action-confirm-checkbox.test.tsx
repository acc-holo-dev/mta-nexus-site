import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ActionConfirmCheckbox } from "../../site/src/components/action-confirm-checkbox";

describe("ActionConfirmCheckbox", () => {
  it("wires label htmlFor to the checkbox id", () => {
    const markup = renderToStaticMarkup(
      <ActionConfirmCheckbox id="order-confirm" checked={false} onCheckedChange={() => {}}>
        Confirm cancellation
      </ActionConfirmCheckbox>,
    );

    expect(markup).toContain('id="order-confirm"');
    expect(markup).toContain('for="order-confirm"');
    expect(markup).toContain("Confirm cancellation");
    expect(markup).toContain('type="checkbox"');
  });

  it("reflects disabled, required, and described-by state", () => {
    const markup = renderToStaticMarkup(
      <ActionConfirmCheckbox
        id="lifecycle-confirm"
        checked
        disabled
        required
        describedBy="lifecycle-note"
        onCheckedChange={() => {}}
        labelClassName="flex items-start gap-3 text-sm text-secondary"
      >
        I understand
      </ActionConfirmCheckbox>,
    );

    expect(markup).toContain('disabled=""');
    expect(markup).toContain('required=""');
    expect(markup).toContain('checked=""');
    expect(markup).toContain('aria-describedby="lifecycle-note"');
    expect(markup).toContain("focus-visible:ring-[color:var(--nexus-accent)]");
  });

  it("forwards checked changes to the caller", () => {
    const onCheckedChange = vi.fn();
    const markup = renderToStaticMarkup(
      <ActionConfirmCheckbox id="staff-confirm" checked={false} onCheckedChange={onCheckedChange}>
        Release product
      </ActionConfirmCheckbox>,
    );

    expect(markup).toContain("Release product");
    expect(onCheckedChange).not.toHaveBeenCalled();
  });
});
