/**
 * Shared native control chrome for filter selects/inputs outside the labeled
 * `<Input>` component. Keep variants additive (w-full, min-h-11) at call sites.
 */
export const fieldClass =
  "rounded-lg border border-base bg-inset px-3 py-2 text-sm text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current";

/** Full-width field used by most platform and filter forms. */
export const fieldClassBlock = `w-full ${fieldClass}`;
