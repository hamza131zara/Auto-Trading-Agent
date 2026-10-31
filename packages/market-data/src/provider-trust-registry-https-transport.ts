/**
 * Phase 6.46 Step 5 — owner-configured direct HTTPS transport.
 *
 * The endpoint is fixed at construction time. This implementation uses
 * node:https directly (not the global fetch dispatcher), a dedicated Agent,
 * normal CA-chain and hostname validation, no proxy agent, no redirect
 * following, and a streamed 48 KiB cap. Compression is deliberately rejected:
 * Accept-Encoding is identity, so received bytes are also decoded bytes.
 */
// @ts-expect-error Node 24 provides this built-in at runtime; this workspace intentionally omits @types/node.
import { Agent, request as defaultHttpsRequest } from "node:https";
import {
  PROVIDER_TRUST_REGISTRY_LIMITS,
  ProviderTrustRegistryError
} from "./provider-trust-registry.js";
import type {
  ProviderTrustRegistryRequest,
  ProviderTrustRegistryTransport,
  ProviderTrustRegistryTransportResponse
} from "./provider-trust-registry.js";

type LookupFunction = (...args: any[]) => any;

interface IncomingMessageLike extends AsyncIterable<Uint8Array> {
  readonly statusCode?: number;
  readonly headers: Readonly<Record<string, string | string[] | undefined>>;
  destroy(): this;
}

interface ClientRequestLike {
  on(event: "error", listener: () => void): this;
  setTimeout(timeoutMs: number, callback: () => void): this;
  end(): this;
  destroy(): this;
}

interface DirectHttpsRequestOptions {
  readonly method: "GET";
  readonly agent: unknown;
  readonly signal: AbortSignal;
  readonly lookup: LookupFunction;
  readonly servername: string;
  readonly rejectUnauthorized: true;
  readonly minVersion: "TLSv1.2";
  readonly maxHeaderSize: number;
  readonly headers: Readonly<Record<string, string>>;
}

type HttpsRequester = (
  url: URL,
  options: DirectHttpsRequestOptions,
  callback: (response: IncomingMessageLike) => void
) => ClientRequestLike;

const MAX_ORIGIN_LENGTH = 512;
const MAX_ENDPOINT_LENGTH = 2_048;
const MAX_RESPONSE_HEADER_BYTES = 8 * 1024;

function fail(code: ConstructorParameters<typeof ProviderTrustRegistryError>[0]): never {
  throw new ProviderTrustRegistryError(code);
}

function parseCanonicalOrigin(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_ORIGIN_LENGTH) {
    return fail("TRUST_REGISTRY_TRANSPORT_RESPONSE_INVALID");
  }
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" ||
        parsed.origin !== value ||
        parsed.username !== "" ||
        parsed.password !== "" ||
        parsed.pathname !== "/" ||
        parsed.search !== "" ||
        parsed.hash !== "") {
      return fail("TRUST_REGISTRY_TRANSPORT_RESPONSE_INVALID");
    }
    return parsed.origin;
  } catch {
    return fail("TRUST_REGISTRY_TRANSPORT_RESPONSE_INVALID");
  }
}

function isUtf8JsonContentType(value: string): boolean {
  if (value.length > 256) return false;
  const segments = value.split(";");
  if (segments[0]?.trim().toLowerCase() !== "application/json") return false;
  for (const parameter of segments.slice(1)) {
    const match = /^\s*charset\s*=\s*(?:"([^"]+)"|([^;\s]+))\s*$/i.exec(parameter);
    if (match === null) return false;
    const charset = (match[1] ?? match[2] ?? "").toLowerCase();
    if (charset !== "utf-8" && charset !== "utf8") return false;
  }
  return true;
}

function readSingleHeader(value: string | string[] | undefined): string | null {
  return typeof value === "string" ? value : null;
}

function validateRequest(request: ProviderTrustRegistryRequest): void {
  if (typeof request !== "object" ||
      request === null ||
      request.redirect !== "error" ||
      request.acceptContentType !== "application/json" ||
      !Number.isSafeInteger(request.timeoutMs) ||
      request.timeoutMs < 1 ||
      request.timeoutMs > PROVIDER_TRUST_REGISTRY_LIMITS.maxRequestTimeoutMs ||
      !Number.isSafeInteger(request.maxResponseBytes) ||
      request.maxResponseBytes < 1 ||
      request.maxResponseBytes > PROVIDER_TRUST_REGISTRY_LIMITS.maxSnapshotBytes ||
      !(request.signal instanceof AbortSignal)) {
    fail("TRUST_REGISTRY_TRANSPORT_RESPONSE_INVALID");
  }
}

function validateContentLength(value: string | null, maximum: number): void {
  if (value === null) return;
  if (!/^\d{1,15}$/.test(value)) {
    fail("TRUST_REGISTRY_TRANSPORT_RESPONSE_INVALID");
  }
  const length = Number(value);
  if (!Number.isSafeInteger(length)) {
    fail("TRUST_REGISTRY_TRANSPORT_RESPONSE_INVALID");
  }
  if (length > maximum) {
    fail("TRUST_REGISTRY_RESPONSE_TOO_LARGE");
  }
}

/**
 * Direct Node HTTPS transport for one owner-provisioned absolute endpoint URL.
 *
 * The optional requester is an injectable test seam. Production callers omit
 * it; no endpoint, host, path, credentials, proxy, custom CA, or redirect target
 * is discovered from response content.
 */
export class NodeHttpsProviderTrustRegistryTransport implements ProviderTrustRegistryTransport {
  private readonly endpointUrl!: URL;
  private readonly requester: HttpsRequester;
  private readonly lookup: LookupFunction;

  constructor(input: {
    readonly endpointUrl: string;
    /** Owner-supplied DNS/IP policy; the adapter never falls back to ambient lookup. */
    readonly lookup: LookupFunction;
    readonly requester?: HttpsRequester;
  }) {
    if (typeof input !== "object" || input === null) {
      fail("TRUST_REGISTRY_TRANSPORT_RESPONSE_INVALID");
    }
    const configured = input.endpointUrl;
    if (typeof configured !== "string" ||
        configured.length === 0 ||
        configured.length > MAX_ENDPOINT_LENGTH) {
      fail("TRUST_REGISTRY_TRANSPORT_RESPONSE_INVALID");
    }
    let endpoint: URL;
    try {
      endpoint = new URL(configured);
    } catch {
      return fail("TRUST_REGISTRY_TRANSPORT_RESPONSE_INVALID");
    }
    if (endpoint.protocol !== "https:" ||
        endpoint.href !== configured ||
        endpoint.username !== "" ||
        endpoint.password !== "" ||
        endpoint.hash !== "" ||
        endpoint.hostname.length === 0) {
      fail("TRUST_REGISTRY_TRANSPORT_RESPONSE_INVALID");
    }
    if (typeof input.lookup !== "function") {
      fail("TRUST_REGISTRY_TRANSPORT_RESPONSE_INVALID");
    }
    this.endpointUrl = endpoint;
    this.lookup = input.lookup;
    this.requester = input.requester ?? defaultHttpsRequest;
  }

  async readSnapshot(
    request: ProviderTrustRegistryRequest
  ): Promise<ProviderTrustRegistryTransportResponse> {
    validateRequest(request);
    const expectedOrigin = parseCanonicalOrigin(request.expectedOrigin);
    if (expectedOrigin !== this.endpointUrl.origin) {
      fail("TRUST_REGISTRY_TRANSPORT_RESPONSE_INVALID");
    }
    if (request.signal.aborted) {
      fail("TRUST_REGISTRY_UNAVAILABLE");
    }

    const endpoint = this.endpointUrl;
    const agent = new Agent({
      keepAlive: false,
      maxSockets: 1,
      maxTotalSockets: 1,
      maxFreeSockets: 0,
      rejectUnauthorized: true,
      minVersion: "TLSv1.2"
    });

    return new Promise<ProviderTrustRegistryTransportResponse>((resolve, reject) => {
      let settled = false;
      let clientRequest: ReturnType<HttpsRequester> | undefined;

      const finish = (result: ProviderTrustRegistryTransportResponse): void => {
        if (settled) return;
        settled = true;
        agent.destroy();
        resolve(result);
      };

      const rejectWith = (
        code:
          | "TRUST_REGISTRY_UNAVAILABLE"
          | "TRUST_REGISTRY_TRANSPORT_RESPONSE_INVALID"
          | "TRUST_REGISTRY_RESPONSE_TOO_LARGE"
      ): void => {
        if (settled) return;
        settled = true;
        clientRequest?.destroy();
        agent.destroy();
        reject(new ProviderTrustRegistryError(code));
      };

      const consume = async (response: IncomingMessageLike): Promise<void> => {
        const status = response.statusCode ?? 0;
        const contentType = readSingleHeader(response.headers["content-type"]) ?? "";
        const metadata = {
          status,
          contentType,
          finalOrigin: endpoint.origin,
          // node:https does not follow redirects; a 3xx is returned to the loader.
          redirected: false as const
        };

        if (status !== 200) {
          response.destroy();
          finish({ ...metadata, bytes: new Uint8Array(0) });
          return;
        }
        if (!isUtf8JsonContentType(contentType)) {
          response.destroy();
          finish({ ...metadata, bytes: new Uint8Array(0) });
          return;
        }

        const rawContentEncoding = response.headers["content-encoding"];
        const contentEncoding = readSingleHeader(rawContentEncoding);
        if (rawContentEncoding !== undefined &&
            (contentEncoding === null || contentEncoding.trim().toLowerCase() !== "identity")) {
          response.destroy();
          rejectWith("TRUST_REGISTRY_TRANSPORT_RESPONSE_INVALID");
          return;
        }

        try {
          const rawContentLength = response.headers["content-length"];
          const contentLength = readSingleHeader(rawContentLength);
          if (rawContentLength !== undefined && contentLength === null) {
            fail("TRUST_REGISTRY_TRANSPORT_RESPONSE_INVALID");
          }
          validateContentLength(contentLength, request.maxResponseBytes);
        } catch (error) {
          response.destroy();
          if (error instanceof ProviderTrustRegistryError) {
            rejectWith(error.code as
              | "TRUST_REGISTRY_TRANSPORT_RESPONSE_INVALID"
              | "TRUST_REGISTRY_RESPONSE_TOO_LARGE");
          } else {
            rejectWith("TRUST_REGISTRY_TRANSPORT_RESPONSE_INVALID");
          }
          return;
        }

        const chunks: Uint8Array[] = [];
        let totalBytes = 0;
        try {
          for await (const chunk of response) {
            if (!(chunk instanceof Uint8Array)) {
              response.destroy();
              rejectWith("TRUST_REGISTRY_TRANSPORT_RESPONSE_INVALID");
              return;
            }
            const copiedChunk = new Uint8Array(chunk);
            totalBytes += copiedChunk.byteLength;
            if (totalBytes > request.maxResponseBytes) {
              response.destroy();
              rejectWith("TRUST_REGISTRY_RESPONSE_TOO_LARGE");
              return;
            }
            chunks.push(copiedChunk);
          }
          const bytes = new Uint8Array(totalBytes);
          let offset = 0;
          for (const chunk of chunks) {
            bytes.set(chunk, offset);
            offset += chunk.byteLength;
          }
          finish({ ...metadata, bytes });
        } catch {
          response.destroy();
          rejectWith("TRUST_REGISTRY_UNAVAILABLE");
        }
      };

      try {
        clientRequest = this.requester(endpoint, {
          method: "GET",
          agent,
          signal: request.signal,
          lookup: this.lookup,
          servername: endpoint.hostname,
          rejectUnauthorized: true,
          minVersion: "TLSv1.2",
          maxHeaderSize: MAX_RESPONSE_HEADER_BYTES,
          headers: {
            Accept: "application/json",
            "Accept-Encoding": "identity",
            "Cache-Control": "no-cache",
            Connection: "close"
          }
        }, (response) => {
          void consume(response);
        });
        clientRequest.on("error", () => {
          rejectWith("TRUST_REGISTRY_UNAVAILABLE");
        });
        clientRequest.setTimeout(request.timeoutMs, () => {
          rejectWith("TRUST_REGISTRY_UNAVAILABLE");
        });
        clientRequest.end();
      } catch {
        rejectWith("TRUST_REGISTRY_UNAVAILABLE");
      }
    });
  }
}
