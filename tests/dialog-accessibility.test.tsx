import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ConfirmDialog, Dialog, nextDialogFocusIndex } from "../packages/ui/src/dialog";

function attributeValues(markup: string, attribute: string) {
  return [...markup.matchAll(new RegExp(`${attribute}="([^"]+)"`, "gu"))].map((match) => match[1]);
}

describe("Dialog accessibility identity", () => {
  it("uses native dialog elements with unique label and description ids", () => {
    const markup = renderToStaticMarkup(
      <>
        <Dialog
          isOpen
          onClose={() => undefined}
          title="First dialog"
          description="First description"
        >
          First body
        </Dialog>
        <Dialog
          isOpen
          onClose={() => undefined}
          title="Second dialog"
          description="Second description"
        >
          Second body
        </Dialog>
      </>,
    );

    expect(markup.match(/<dialog\b/gu)?.length).toBe(2);

    const ids = attributeValues(markup, "id");
    expect(ids).toHaveLength(4);
    expect(new Set(ids).size).toBe(ids.length);

    const labelledBy = attributeValues(markup, "aria-labelledby");
    const describedBy = attributeValues(markup, "aria-describedby");
    expect(labelledBy).toHaveLength(2);
    expect(describedBy).toHaveLength(2);

    for (const id of [...labelledBy, ...describedBy]) {
      expect(ids).toContain(id);
    }
  });

  it("omits aria-describedby when a dialog has no description", () => {
    const markup = renderToStaticMarkup(
      <Dialog isOpen onClose={() => undefined} title="Title only">
        Body
      </Dialog>,
    );

    expect(attributeValues(markup, "aria-labelledby")).toHaveLength(1);
    expect(attributeValues(markup, "aria-describedby")).toHaveLength(0);
  });

  it("shows object, scope and consequences in ConfirmDialog without submitting on cancel", () => {
    const markup = renderToStaticMarkup(
      <ConfirmDialog
        isOpen
        title="Remove selection"
        object="Acme Org"
        scope="3 members"
        consequences="Access will be revoked."
        confirmLabel="Remove"
        cancelLabel="Cancel"
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />,
    );

    expect(markup).toContain("<dialog");
    expect(markup).toContain("Acme Org");
    expect(markup).toContain("3 members");
    expect(markup).toContain("Access will be revoked.");
    expect(markup).toContain("Cancel");
    expect(markup).toContain("Remove");
  });
});

describe("Dialog keyboard focus containment", () => {
  it("wraps forward focus from the last control to the first", () => {
    expect(nextDialogFocusIndex(4, 3, false)).toBe(0);
  });

  it("wraps backward focus from the first control to the last", () => {
    expect(nextDialogFocusIndex(4, 0, true)).toBe(3);
  });

  it("recovers focus entering from outside the dialog", () => {
    expect(nextDialogFocusIndex(4, -1, false)).toBe(0);
    expect(nextDialogFocusIndex(4, -1, true)).toBe(3);
  });

  it("leaves normal in-dialog tab movement to the browser", () => {
    expect(nextDialogFocusIndex(4, 1, false)).toBeNull();
    expect(nextDialogFocusIndex(4, 2, true)).toBeNull();
  });

  it("handles a dialog with no focusable controls defensively", () => {
    expect(nextDialogFocusIndex(0, -1, false)).toBeNull();
  });
});
