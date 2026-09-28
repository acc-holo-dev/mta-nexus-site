import { describe, expect, it } from "vitest";
import {
  MultipartBodyTooLargeError,
  parseMultipartFormDataWithLimit,
} from "../apps/web/src/lib/bounded-multipart";

function multipartRequest(body: string): Request {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(body);
  return new Request("http://nexus.test/upload", {
    method: "POST",
    headers: { "content-type": "multipart/form-data; boundary=nexus-boundary" },
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, 17));
        controller.enqueue(bytes.slice(17));
        controller.close();
      },
    }),
    duplex: "half",
  } as RequestInit & { duplex: "half" });
}

const validBody =
  "--nexus-boundary\r\nContent-Disposition: form-data; name=\"version\"\r\n\r\n1.0.0\r\n--nexus-boundary--\r\n";

describe("bounded multipart parsing", () => {
  it("parses valid multipart data when Content-Length is absent", async () => {
    const request = multipartRequest(validBody);

    expect(request.headers.has("content-length")).toBe(false);
    const form = await parseMultipartFormDataWithLimit(
      request,
      new TextEncoder().encode(validBody).byteLength,
    );

    expect(form.get("version")).toBe("1.0.0");
  });

  it("rejects based on bytes actually streamed, before parsing an over-limit body", async () => {
    await expect(
      parseMultipartFormDataWithLimit(multipartRequest(validBody), 12),
    ).rejects.toBeInstanceOf(MultipartBodyTooLargeError);
  });
});
