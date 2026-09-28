import { describe, expect, it } from "vitest";
import { getDictionary } from "../apps/web/src/lib/i18n";
import { getMtaMetaInspectorIssueMessage } from "../apps/web/src/lib/mta-meta-inspector-messages";

describe("localized MTA manifest diagnostics", () => {
  it("uses Russian and English messages for every parser diagnostic", () => {
    const codes = [
      "UNCLOSED_COMMENT",
      "META_ROOT_NOT_CONFIRMED",
      "INFO_NOT_DECLARED",
      "MULTIPLE_INFO_TAGS",
      "SCRIPT_SRC_MISSING",
      "SCRIPT_TYPE_UNKNOWN",
      "FILE_SRC_MISSING",
      "MAP_SRC_MISSING",
      "INCLUDE_RESOURCE_MISSING",
      "EXPORT_FUNCTION_MISSING",
      "EXPORT_TYPE_UNKNOWN",
      "ISSUE_LIMIT_REACHED",
      "SCRIPT_ENTRY_LIMIT_REACHED",
      "INFO_ENTRY_LIMIT_REACHED",
      "FILE_ENTRY_LIMIT_REACHED",
      "MAP_ENTRY_LIMIT_REACHED",
      "INCLUDE_ENTRY_LIMIT_REACHED",
      "EXPORT_ENTRY_LIMIT_REACHED",
      "HTML_ENTRY_LIMIT_REACHED",
      "MIN_MTA_VERSION_ENTRY_LIMIT_REACHED",
      "SETTING_ENTRY_LIMIT_REACHED",
      "RIGHT_ENTRY_LIMIT_REACHED",
      "MTA_VERSION_MULTIPLE",
      "MTA_VERSION_MISSING",
      "MTA_VERSION_INVALID",
      "MTA_VERSION_TARGET_CONFLICT",
    ];

    for (const code of codes) {
      const issue = { code, severity: "warning" as const, message: `English fallback ${code}` };
      const english = getMtaMetaInspectorIssueMessage(issue, getDictionary("en").metaInspector.structuralIssues);
      const russian = getMtaMetaInspectorIssueMessage(issue, getDictionary("ru").metaInspector.structuralIssues);

      expect(english).not.toContain("English fallback");
      expect(russian).not.toContain("English fallback");
      expect(russian).not.toBe(english);
    }
  });

  it("keeps the API message for unknown future diagnostic codes", () => {
    const issue = { code: "FUTURE_ISSUE", severity: "warning" as const, message: "Fallback message" };
    expect(
      getMtaMetaInspectorIssueMessage(issue, getDictionary("ru").metaInspector.structuralIssues),
    ).toBe("Fallback message");
  });
});
