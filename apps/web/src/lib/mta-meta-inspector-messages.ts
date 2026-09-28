import type { MetaInspectionIssue } from "./mta-meta-inspector";
import type { getDictionary } from "./i18n";

type StructuralIssueMessages = ReturnType<typeof getDictionary>["metaInspector"]["structuralIssues"];

const issueMessageKeys: Readonly<Record<string, keyof StructuralIssueMessages>> = {
  UNCLOSED_COMMENT: "unclosedComment",
  META_ROOT_NOT_CONFIRMED: "incompleteMeta",
  INFO_NOT_DECLARED: "missingInfo",
  MULTIPLE_INFO_TAGS: "multipleInfo",
  SCRIPT_SRC_MISSING: "scriptSourceMissing",
  SCRIPT_TYPE_UNKNOWN: "unknownScriptType",
  FILE_SRC_MISSING: "fileSourceMissing",
  MAP_SRC_MISSING: "mapSourceMissing",
  INCLUDE_RESOURCE_MISSING: "includeResourceMissing",
  EXPORT_FUNCTION_MISSING: "exportFunctionMissing",
  EXPORT_TYPE_UNKNOWN: "unknownExportType",
  ISSUE_LIMIT_REACHED: "issueLimitReached",
  MTA_VERSION_MULTIPLE: "multipleMinimumVersions",
  MTA_VERSION_MISSING: "minimumVersionMissing",
  MTA_VERSION_INVALID: "minimumVersionInvalid",
  MTA_VERSION_TARGET_CONFLICT: "minimumVersionConflict",
};

export function getMtaMetaInspectorIssueMessage(
  issue: MetaInspectionIssue,
  messages: StructuralIssueMessages,
): string {
  const messageKey = issueMessageKeys[issue.code];
  if (messageKey) return messages[messageKey];
  if (issue.code.endsWith("_ENTRY_LIMIT_REACHED")) {
    return messages.entryLimitReached;
  }
  return issue.message;
}
