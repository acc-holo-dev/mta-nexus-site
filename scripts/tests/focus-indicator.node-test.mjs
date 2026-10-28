import assert from "node:assert/strict";
import { test } from "node:test";

/** Mirrors shell-accessibility.playwright.mjs focus-ring detection for box-shadow. */
function boxShadowShowsFocusRing(boxShadow) {
  if (!boxShadow || boxShadow === "none") return false;
  for (const layer of boxShadow.split(/,(?![^(]*\))/u)) {
    const lengths = [...layer.matchAll(/(-?\d*\.?\d+)px/gu)].map((match) => Number(match[1]));
    if (lengths.some((value) => Math.abs(value) > 0)) return true;
  }
  return false;
}

test("treats a 2px focus ring as visible even beside a zero shadow layer", () => {
  assert.equal(boxShadowShowsFocusRing("rgb(36, 86, 217) 0px 0px 0px 2px"), true);
  assert.equal(
    boxShadowShowsFocusRing("rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgb(36, 86, 217) 0px 0px 0px 2px"),
    true,
  );
});

test("rejects empty or all-zero box shadows", () => {
  assert.equal(boxShadowShowsFocusRing("none"), false);
  assert.equal(boxShadowShowsFocusRing(""), false);
  assert.equal(boxShadowShowsFocusRing("0px 0px 0px 0px"), false);
  assert.equal(boxShadowShowsFocusRing("rgba(0, 0, 0, 0) 0px 0px 0px 0px"), false);
});
