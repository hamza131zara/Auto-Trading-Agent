import { isSolanaPublicKey } from "./index.js";

const MAX_RPC_ADDRESSES = 100;
const DEFAULT_MAX_RESPONSE_BYTES = 2_000_000;
const MAX_ALLOWED_RESPONSE_BYTES = 10_000_000;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const PROVIDER_ID_PATTERN = /^[a-z][a-z0-9._-]{0,63}$/;

export type SolanaRpcReaderFailureCode =
  | "INVALID_REQUEST"
  | "TIMEOUT"
  | "ABORTED"
  | "NETWORK"
  | "RATE_LIMIT"
  | "HTTP"
  | "RPC"
  | "PARSE"
  | "RESPONSE_TOO_LARGE"
  | "CONTEXT_SLOT_BELOW_MINIMUM";

export class SolanaRpcReaderError extends Error {
  readonly code: SolanaRpcReaderFailureCode;
  readonly retryable: boolean;
  readonly statusCode: number | null;

  constructor(
    code: SolanaRpcReaderFailureCode,
    retryable: boolean,
    statusCode: number | null = null
  ) {
    super("Solana RPC account read failed (" + code +
      (statusCode === null ? "" : ", HTTP " + statusCode) + ").");
    this.name = "SolanaRpcReaderError";
    this.code = code;
    this.retryable = retryable;
    this.statusCode = statusCode;
  }
}

export interface SolanaRpcAccountReaderOptions {
  /** Exact administrator-configured endpoint. It is never returned or included in errors. */
  readonly endpoint: string;
  readonly providerId: string;
  readonly timeoutMs?: number;
  readonly maxResponseBytes?: number;
  readonly clock?: () => string;
  /**
   * Injected fetch functions are treated as synthetic by design. This lets tests
   * use deterministic fixtures without ever claiming the response is live RPC data.
   */
  readonly fetchImpl?: typeof fetch;
}

export interface ReadSolanaAccountsRequest {
  readonly addresses: readonly string[];
  readonly commitment: "confirmed" | "finalized";
  readonly minContextSlot: number;
  readonly requestId: string;
  readonly signal?: AbortSignal;
}

export interface SolanaRpcRawAccount {
  readonly address: string;
  readonly exists: boolean;
  /** Solana account 'owner' field: the program that owns the account. */
  readonly ownerProgramId: string | null;
  readonly executable: boolean | null;
  /** Encoded account bytes; decoding is deliberately a separate protocol-specific step. */
  readonly dataBase64: string | null;
  readonly space: number | null;
}

export interface SolanaRpcAccountBundle {
  readonly source: {
    readonly providerId: string;
    readonly commitment: "confirmed" | "finalized";
    readonly retrievedAt: string;
    readonly contextSlot: number;
    readonly requestedMinContextSlot: number;
    readonly requestId: string;
    readonly rawPayloadSha256: string;
    readonly synthetic: boolean;
  };
  /** Accounts are returned in the same order as the requested addresses. */
  readonly accounts: readonly SolanaRpcRawAccount[];
}

export interface SolanaRpcBlockTimeEvidence {
  readonly providerId: string;
  readonly slot: number;
  readonly state: "AVAILABLE" | "UNAVAILABLE";
  readonly blockTimeUnixSeconds: number | null;
  /** Estimated block-production time from validator vote timestamps; not an exact event time. */
  readonly observedAt: string | null;
  readonly timestampKind: "SLOT_BLOCK_TIME_ESTIMATE" | "MISSING";
  readonly retrievedAt: string;
  readonly requestId: string;
  readonly rawPayloadSha256: string;
  readonly synthetic: boolean;
}

interface ParsedRpcAccount {
  readonly data: readonly [string, "base64"];
  readonly executable: boolean;
  readonly owner: string;
  readonly space: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidRequestId(value: unknown): value is string {
  return typeof value === "string" && REQUEST_ID_PATTERN.test(value);
}

function isValidProviderId(value: unknown): value is string {
  return typeof value === "string" && PROVIDER_ID_PATTERN.test(value);
}

function isUtcTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 24) return false;
  const timestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
  return timestampPattern.test(value) && Number.isFinite(Date.parse(value));
}

function timestampMs(value: string): number {
  return Date.parse(value);
}

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "[::1]";
}

function validateEndpoint(input: unknown): URL {
  if (typeof input !== "string" || input.length === 0 || input.length > 2048) {
    throw new TypeError("endpoint must be a valid HTTPS RPC URL");
  }
  let endpoint: URL;
  try {
    endpoint = new URL(input);
  } catch {
    throw new TypeError("endpoint must be a valid HTTPS RPC URL");
  }
  const secure = endpoint.protocol === "https:";
  const localDevelopment = endpoint.protocol === "http:" && isLoopbackHostname(endpoint.hostname);
  if ((!secure && !localDevelopment) ||
      endpoint.username.length > 0 ||
      endpoint.password.length > 0 ||
      endpoint.hash.length > 0) {
    throw new TypeError("endpoint must use HTTPS (HTTP is allowed only for loopback development)");
  }
  return endpoint;
}

function isBase64(value: string): boolean {
  if (value.length % 4 !== 0) return false;
  if (value.length === 0) return true;
  let padding = 0;
  if (value.endsWith("==")) padding = 2;
  else if (value.endsWith("=")) padding = 1;
  const contentLength = value.length - padding;
  for (let index = 0; index < contentLength; index += 1) {
    const code = value.charCodeAt(index);
    const letter = (code >= 65 && code <= 90) ||
      (code >= 97 && code <= 122);
    const digit = code >= 48 && code <= 57;
    if (!letter && !digit && code !== 43 && code !== 47) return false;
  }
  for (let index = contentLength; index < value.length; index += 1) {
    if (value.charCodeAt(index) !== 61) return false;
  }
  return true;
}

async function readBoundedResponseText(
  response: Response,
  maxResponseBytes: number
): Promise<string> {
  const contentLength = response.headers.get("content-length");
  if (contentLength !== null &&
      contentLength.length <= 16 &&
      /^\d+$/.test(contentLength) &&
      Number(contentLength) > maxResponseBytes) {
    await response.body?.cancel().catch(() => undefined);
    throw new SolanaRpcReaderError("RESPONSE_TOO_LARGE", false);
  }

  if (response.body === null) {
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > maxResponseBytes) {
      throw new SolanaRpcReaderError("RESPONSE_TOO_LARGE", false);
    }
    return text;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const chunks: string[] = [];
  let receivedBytes = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      receivedBytes += result.value.byteLength;
      if (receivedBytes > maxResponseBytes) {
        await reader.cancel().catch(() => undefined);
        throw new SolanaRpcReaderError("RESPONSE_TOO_LARGE", false);
      }
      try {
        chunks.push(decoder.decode(result.value, { stream: true }));
      } catch {
        throw new SolanaRpcReaderError("PARSE", false);
      }
    }
    try {
      chunks.push(decoder.decode());
    } catch {
      throw new SolanaRpcReaderError("PARSE", false);
    }
    return chunks.join("");
  } finally {
    reader.releaseLock();
  }
}

function parseAccount(value: unknown, address: string): SolanaRpcRawAccount | null {
  if (value === null) {
    return {
      address,
      exists: false,
      ownerProgramId: null,
      executable: null,
      dataBase64: null,
      space: null
    };
  }
  if (!isRecord(value) ||
      typeof value.owner !== "string" ||
      !isSolanaPublicKey(value.owner) ||
      typeof value.executable !== "boolean" ||
      !Number.isSafeInteger(value.space) ||
      (value.space as number) < 0 ||
      !Array.isArray(value.data) ||
      value.data.length !== 2 ||
      typeof value.data[0] !== "string" ||
      value.data[1] !== "base64" ||
      !isBase64(value.data[0])) {
    return null;
  }
  const typed = value as unknown as ParsedRpcAccount;
  return {
    address,
    exists: true,
    ownerProgramId: typed.owner,
    executable: typed.executable,
    dataBase64: typed.data[0],
    space: typed.space
  };
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
}

/**
 * Read-only Solana JSON-RPC transport for an explicit set of account addresses.
 * It never builds instructions, signs, submits transactions or infers a DEX pool
 * decoder. A supplied fetch implementation marks the output synthetic, making
 * mocked/test data unable to masquerade as live RPC evidence.
 */
export class SolanaRpcAccountReader {
  private readonly endpoint: string;
  private readonly providerId: string;
  private readonly timeoutMs: number;
  private readonly maxResponseBytes: number;
  private readonly fetchImpl: typeof fetch;
  private readonly clock: () => string;
  private readonly synthetic: boolean;

  constructor(options: SolanaRpcAccountReaderOptions) {
    if (!isRecord(options) ||
        !isValidProviderId(options.providerId) ||
        typeof options.endpoint !== "string") {
      throw new TypeError("Solana RPC reader options are invalid");
    }
    const timeoutMs = options.timeoutMs ?? 5_000;
    const maxResponseBytes = options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 60_000) {
      throw new RangeError("timeoutMs must be an integer between 100 and 60000");
    }
    if (!Number.isSafeInteger(maxResponseBytes) ||
        maxResponseBytes < 1_024 ||
        maxResponseBytes > MAX_ALLOWED_RESPONSE_BYTES) {
      throw new RangeError("maxResponseBytes must be an integer between 1024 and 10000000");
    }
    const clock = options.clock ?? (() => new Date().toISOString());
    if (typeof clock !== "function") throw new TypeError("clock must be a function");
    if (options.fetchImpl !== undefined && typeof options.fetchImpl !== "function") {
      throw new TypeError("fetchImpl must be a function when supplied");
    }
    this.endpoint = validateEndpoint(options.endpoint).toString();
    this.providerId = options.providerId;
    this.timeoutMs = timeoutMs;
    this.maxResponseBytes = maxResponseBytes;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.clock = clock;
    this.synthetic = options.fetchImpl !== undefined;
  }

  async readAccounts(request: ReadSolanaAccountsRequest): Promise<SolanaRpcAccountBundle> {
    if (!isRecord(request) ||
        !Array.isArray(request.addresses) ||
        request.addresses.length < 1 ||
        request.addresses.length > MAX_RPC_ADDRESSES ||
        request.addresses.some((address) => !isSolanaPublicKey(address)) ||
        new Set(request.addresses).size !== request.addresses.length ||
        (request.commitment !== "confirmed" && request.commitment !== "finalized") ||
        !Number.isSafeInteger(request.minContextSlot) ||
        request.minContextSlot < 0 ||
        !isValidRequestId(request.requestId) ||
        (request.signal !== undefined &&
          (typeof request.signal !== "object" || request.signal === null ||
           typeof request.signal.aborted !== "boolean"))) {
      throw new SolanaRpcReaderError("INVALID_REQUEST", false);
    }

    const callerSignal = request.signal ?? new AbortController().signal;
    const timeoutSignal = AbortSignal.timeout(this.timeoutMs);
    const combinedSignal = AbortSignal.any([callerSignal, timeoutSignal]);
    const body = JSON.stringify({
      jsonrpc: "2.0",
      id: request.requestId,
      method: "getMultipleAccounts",
      params: [
        request.addresses,
        {
          encoding: "base64",
          commitment: request.commitment,
          minContextSlot: request.minContextSlot
        }
      ]
    });

    let response: Response;
    try {
      response = await this.fetchImpl(this.endpoint, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json"
        },
        body,
        redirect: "error",
        signal: combinedSignal
      });
    } catch {
      if (timeoutSignal.aborted) throw new SolanaRpcReaderError("TIMEOUT", true);
      if (callerSignal.aborted) throw new SolanaRpcReaderError("ABORTED", false);
      throw new SolanaRpcReaderError("NETWORK", true);
    }

    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      if (response.status === 429) throw new SolanaRpcReaderError("RATE_LIMIT", true, 429);
      if (response.status === 408 || response.status === 504) {
        throw new SolanaRpcReaderError("TIMEOUT", true, response.status);
      }
      throw new SolanaRpcReaderError("HTTP", response.status >= 500, response.status);
    }

    let text: string;
    try {
      text = await readBoundedResponseText(response, this.maxResponseBytes);
    } catch (error) {
      if (error instanceof SolanaRpcReaderError) throw error;
      if (timeoutSignal.aborted) throw new SolanaRpcReaderError("TIMEOUT", true);
      if (callerSignal.aborted) throw new SolanaRpcReaderError("ABORTED", false);
      throw new SolanaRpcReaderError("NETWORK", true);
    }

    let payload: unknown;
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      throw new SolanaRpcReaderError("PARSE", false);
    }
    if (!isRecord(payload) || payload.jsonrpc !== "2.0" || payload.id !== request.requestId) {
      throw new SolanaRpcReaderError("PARSE", false);
    }
    if ("error" in payload) {
      // Never include provider error text, request URLs, or raw response bodies.
      throw new SolanaRpcReaderError("RPC", false);
    }
    if (!isRecord(payload.result) ||
        !isRecord(payload.result.context) ||
        !Number.isSafeInteger(payload.result.context.slot) ||
        (payload.result.context.slot as number) < 0 ||
        !Array.isArray(payload.result.value) ||
        payload.result.value.length !== request.addresses.length) {
      throw new SolanaRpcReaderError("PARSE", false);
    }

    const contextSlot = payload.result.context.slot as number;
    if (contextSlot < request.minContextSlot) {
      throw new SolanaRpcReaderError("CONTEXT_SLOT_BELOW_MINIMUM", true);
    }
    const accounts: SolanaRpcRawAccount[] = [];
    for (let index = 0; index < request.addresses.length; index += 1) {
      const account = parseAccount(payload.result.value[index], request.addresses[index]!);
      if (account === null) throw new SolanaRpcReaderError("PARSE", false);
      accounts.push(account);
    }

    let retrievedAt: string;
    try {
      retrievedAt = this.clock();
    } catch {
      throw new SolanaRpcReaderError("INVALID_REQUEST", false);
    }
    if (!isUtcTimestamp(retrievedAt)) throw new SolanaRpcReaderError("INVALID_REQUEST", false);

    let rawPayloadSha256: string;
    try {
      rawPayloadSha256 = await sha256Hex(text);
    } catch {
      throw new SolanaRpcReaderError("PARSE", false);
    }

    return {
      source: {
        providerId: this.providerId,
        commitment: request.commitment,
        retrievedAt,
        contextSlot,
        requestedMinContextSlot: request.minContextSlot,
        requestId: request.requestId,
        rawPayloadSha256,
        synthetic: this.synthetic
      },
      accounts
    };
  }

  /**
   * Read the estimated production time for a slot returned by a finalized
   * account read. Solana's getBlockTime result is an estimate derived from
   * validator vote timestamps; null is a valid "unavailable" response.
   */
  async getBlockTime(
    slot: number,
    requestId: string,
    signal?: AbortSignal
  ): Promise<SolanaRpcBlockTimeEvidence> {
    if (!Number.isSafeInteger(slot) || slot < 0 || !isValidRequestId(requestId) ||
        (signal !== undefined &&
          (typeof signal !== "object" || signal === null || typeof signal.aborted !== "boolean"))) {
      throw new SolanaRpcReaderError("INVALID_REQUEST", false);
    }

    const callerSignal = signal ?? new AbortController().signal;
    const timeoutSignal = AbortSignal.timeout(this.timeoutMs);
    const combinedSignal = AbortSignal.any([callerSignal, timeoutSignal]);
    let response: Response;
    try {
      response = await this.fetchImpl(this.endpoint, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: requestId,
          method: "getBlockTime",
          params: [slot]
        }),
        redirect: "error",
        signal: combinedSignal
      });
    } catch {
      if (timeoutSignal.aborted) throw new SolanaRpcReaderError("TIMEOUT", true);
      if (callerSignal.aborted) throw new SolanaRpcReaderError("ABORTED", false);
      throw new SolanaRpcReaderError("NETWORK", true);
    }

    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      if (response.status === 429) throw new SolanaRpcReaderError("RATE_LIMIT", true, 429);
      if (response.status === 408 || response.status === 504) {
        throw new SolanaRpcReaderError("TIMEOUT", true, response.status);
      }
      throw new SolanaRpcReaderError("HTTP", response.status >= 500, response.status);
    }

    let text: string;
    try {
      text = await readBoundedResponseText(response, this.maxResponseBytes);
    } catch (error) {
      if (error instanceof SolanaRpcReaderError) throw error;
      if (timeoutSignal.aborted) throw new SolanaRpcReaderError("TIMEOUT", true);
      if (callerSignal.aborted) throw new SolanaRpcReaderError("ABORTED", false);
      throw new SolanaRpcReaderError("NETWORK", true);
    }

    let payload: unknown;
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      throw new SolanaRpcReaderError("PARSE", false);
    }
    if (!isRecord(payload) || payload.jsonrpc !== "2.0" || payload.id !== requestId) {
      throw new SolanaRpcReaderError("PARSE", false);
    }
    if ("error" in payload) throw new SolanaRpcReaderError("RPC", false);
    if (!("result" in payload)) throw new SolanaRpcReaderError("PARSE", false);

    const blockTime = payload.result;
    if (blockTime !== null &&
        (!Number.isSafeInteger(blockTime) || (blockTime as number) < 0 ||
         (blockTime as number) > 253_402_300_799)) {
      throw new SolanaRpcReaderError("PARSE", false);
    }

    let retrievedAt: string;
    try {
      retrievedAt = this.clock();
    } catch {
      throw new SolanaRpcReaderError("INVALID_REQUEST", false);
    }
    if (!isUtcTimestamp(retrievedAt)) throw new SolanaRpcReaderError("INVALID_REQUEST", false);

    let rawPayloadSha256: string;
    try {
      rawPayloadSha256 = await sha256Hex(text);
    } catch {
      throw new SolanaRpcReaderError("PARSE", false);
    }

    const observedAt = blockTime === null
      ? null
      : new Date((blockTime as number) * 1_000).toISOString();
    return {
      providerId: this.providerId,
      slot,
      state: observedAt === null ? "UNAVAILABLE" : "AVAILABLE",
      blockTimeUnixSeconds: blockTime as number | null,
      observedAt,
      timestampKind: observedAt === null ? "MISSING" : "SLOT_BLOCK_TIME_ESTIMATE",
      retrievedAt,
      requestId,
      rawPayloadSha256,
      synthetic: this.synthetic
    };
  }
}
