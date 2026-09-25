import { describe, expect, it } from "vitest";
import {
  MetaInspectionInputError,
  inspectMtaMetaXml,
  metaInspectionLimits,
} from "../apps/web/src/lib/mta-meta-inspector";

describe("MTA meta.xml inspector", () => {
  it("extracts documented resource structure without inventing security verdicts", () => {
    const result = inspectMtaMetaXml(`<?xml version="1.0"?>
<meta>
  <info author="Dev &amp; Team" version="1.2.0" name="Race Core" type="script" />
  <script src="server.lua" />
  <script src="client.lua" type="client" cache="false" validate="false" />
  <script src="shared.lua" type="shared" />
  <file src="html/index.html" download="false" />
  <map src="maps/race.map" dimension="1" />
  <include resource="scoreboard" minversion="1.0" />
  <include resource="scoreboard" />
  <config src="config.xml" type="server" />
  <export function="getRaceState" type="shared" http="true" />
  <html src="web/index.html" default="true" />
  <settings><setting name="rounds" value="[5]" /></settings>
  <min_mta_version both="1.6.0-9.22279.0" />
  <aclrequest><right name="function.startResource" access="true" /></aclrequest>
</meta>`);

    expect(result.root).toBe("meta");
    expect(result.info).toMatchObject({
      author: "Dev & Team",
      version: "1.2.0",
      name: "Race Core",
      type: "script",
    });
    expect(result.scripts).toEqual([
      {
        src: "server.lua",
        type: "server",
        typeDeclared: false,
        cache: null,
        validate: null,
      },
      {
        src: "client.lua",
        type: "client",
        typeDeclared: true,
        cache: "false",
        validate: "false",
      },
      {
        src: "shared.lua",
        type: "shared",
        typeDeclared: true,
        cache: null,
        validate: null,
      },
    ]);
    expect(result.dependencyResources).toEqual(["scoreboard"]);
    expect(result.minMtaVersion).toEqual({
      client: null,
      server: null,
      both: "1.6.0-9.22279.0",
    });
    expect(result.summary).toMatchObject({
      scriptCount: 3,
      clientScripts: 1,
      serverScripts: 1,
      sharedScripts: 1,
      clientCacheDisabledScripts: 1,
      validationDisabledScripts: 1,
      fileCount: 1,
      mapCount: 1,
      dependencyCount: 1,
      exportCount: 1,
      httpExportCount: 1,
      settingCount: 1,
      aclRightCount: 1,
    });
    expect(JSON.stringify(result)).not.toMatch(
      /safe|verified|malware.?free|trusted/iu,
    );
  });

  it("ignores tags inside comments and CDATA", () => {
    const result = inspectMtaMetaXml(`<meta>
<!-- <script src="comment.lua" type="client" /> -->
<![CDATA[<script src="cdata.lua" type="client" />]]>
<script src="real.lua" type="server" />
</meta>`);

    expect(result.scripts).toHaveLength(1);
    expect(result.scripts[0]?.src).toBe("real.lua");
  });

  it("counts settings and ACL rights only inside their documented containers", () => {
    const result = inspectMtaMetaXml(`<meta>
<right name="outside" access="true" />
<setting name="outside" value="1" />
<aclrequest><right name="function.startResource" access="true" /></aclrequest>
<settings><setting name="rounds" value="[5]" /></settings>
</meta>`);

    expect(result.summary.aclRightCount).toBe(1);
    expect(result.aclRights[0]?.name).toBe("function.startResource");
    expect(result.summary.settingCount).toBe(1);
    expect(result.settings[0]?.name).toBe("rounds");
  });

  it("returns bounded structural issues for incomplete entries", () => {
    const result = inspectMtaMetaXml(`<meta>
<script type="mystery" />
<file />
<map />
<include />
<export type="other" />
</meta>`);

    expect(result.issues.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        "INFO_NOT_DECLARED",
        "SCRIPT_SRC_MISSING",
        "SCRIPT_TYPE_UNKNOWN",
        "FILE_SRC_MISSING",
        "MAP_SRC_MISSING",
        "INCLUDE_RESOURCE_MISSING",
        "EXPORT_FUNCTION_MISSING",
        "EXPORT_TYPE_UNKNOWN",
      ]),
    );
  });

  it("rejects DTD/entity declarations instead of interpreting them", () => {
    expect(() =>
      inspectMtaMetaXml(`<!DOCTYPE meta [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
<meta><info name="&xxe;" /></meta>`),
    ).toThrowError(MetaInspectionInputError);

    try {
      inspectMtaMetaXml(`<!ENTITY x "value"><meta />`);
    } catch (error) {
      expect(error).toMatchObject({
        code: "META_FORBIDDEN_XML_FEATURE",
      });
    }
  });

  it("enforces an input byte limit before inspection", () => {
    const oversized = `<meta><!--${"x".repeat(metaInspectionLimits.maxBytes)}--></meta>`;
    expect(() => inspectMtaMetaXml(oversized)).toThrowError(
      /inspection limit/u,
    );
  });

  it("keeps invalid numeric entities inert instead of throwing RangeError", () => {
    const result = inspectMtaMetaXml(
      '<meta><info name="&#999999999999999999999;" /></meta>',
    );
    expect(result.info?.name).toBe("&#999999999999999999999;");
  });

  it("reports when a complete meta root is not confirmed", () => {
    const result = inspectMtaMetaXml('<script src="standalone.lua" />');
    expect(result.root).toBe("unknown");
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "META_ROOT_NOT_CONFIRMED",
        severity: "error",
      }),
    );
  });
});
