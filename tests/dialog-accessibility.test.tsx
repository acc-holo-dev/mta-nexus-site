import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Dialog, nextDialogFocusIndex } from "../packages/ui/src/dialog";

function attributeValues(markup: string, attribute: string) {
  return [...markup.matchAll(new RegExp(`${attribute}="([^"]+)"`, "gu"))].map((match) => match[1]);
}

describe("Dialog accessibility identity", () => {
  it("gives concurrently rendered dialogs unique label and description ids", () => {
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
