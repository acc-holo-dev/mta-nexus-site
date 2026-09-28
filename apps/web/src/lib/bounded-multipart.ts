export class MultipartBodyTooLargeError extends Error {
  constructor() {
    super("Multipart request body exceeds the configured limit");
    this.name = "MultipartBodyTooLargeError";
  }
}

/** Parses multipart data while counting actual streamed bytes, even without Content-Length. */
export async function parseMultipartFormDataWithLimit(
  request: Request,
  maxBytes: number,
): Promise<FormData> {
  let bytesRead = 0;
  let exceededLimit = false;

  const boundedBody = request.body?.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        if (bytesRead + chunk.byteLength > maxBytes) {
          exceededLimit = true;
          controller.error(new MultipartBodyTooLargeError());
          return;
        }
        bytesRead += chunk.byteLength;
        controller.enqueue(chunk);
      },
    }),
  );

  const boundedRequest = new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: boundedBody,
    // Node's Request implementation requires duplex when forwarding a body stream.
    duplex: "half",
  } as RequestInit & { duplex: "half" });

  try {
    return await boundedRequest.formData();
  } catch (error) {
    if (exceededLimit) throw new MultipartBodyTooLargeError();
    throw error;
  }
}
