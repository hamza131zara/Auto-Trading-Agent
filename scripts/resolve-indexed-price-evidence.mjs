import { GeckoTerminalAdapterError, GeckoTerminalOhlcvPriceAdapter } from "../packages/market-data/dist/providers/geckoterminal.js";
export const GECKOTERMINAL_INDEPENDENCE_GROUP_ID = "geckoterminal-coingecko-ecosystem";
export class IndexedPriceEvidenceError extends Error {
  constructor(code) { super(code); this.name = "IndexedPriceEvidenceError"; this.code = code; }
}
function utcNow(now) {
  const value=now(), date=value instanceof Date ? value : new Date(value);
  if(!Number.isFinite(date.getTime())) throw new IndexedPriceEvidenceError("INDEXED_SOURCE_CLOCK_INVALID");
  return date.toISOString();
}
/** Resolve price-only evidence; DEX Screener stays default, GeckoTerminal requires two approvals. */
export async function resolveIndexedPriceEvidence({
  source="dex-screener",target,identityReport,geckoTerminalApproved=false,
  adapterFactory=()=>new GeckoTerminalOhlcvPriceAdapter(),now=()=>new Date()
}) {
  if(source==="dex-screener") {
    const m=identityReport?.marketData;
    if(!m||!identityReport?.targetSource||identityReport.targetSource.providerId!=="dex-screener")
      throw new IndexedPriceEvidenceError("DEX_SCREENER_IDENTITY_EVIDENCE_MISSING");
    return {
      providerId:"dex-screener",independenceGroupId:"dex-screener-family",
      priceUsdPerBase:m.price?.unit==="USD_PER_BASE"?m.price.value:null,
      sourceEventAt:m.sourceEventAt??null,sourceObservedAt:m.observedAt??null,retrievedAt:m.retrievedAt,
      requestId:m.provenance?.requestId??identityReport.targetSource.requestId??null,
      rawPayloadSha256:m.provenance?.rawPayloadSha256??identityReport.targetSource.rawPayloadSha256??null,
      synthetic:m.provenance?.synthetic===true||identityReport.targetSource.synthetic===true,
      timeframe:null,aggregate:null
    };
  }
  if(source!=="geckoterminal") throw new IndexedPriceEvidenceError("INDEXED_PRICE_SOURCE_INVALID");
  if(geckoTerminalApproved!==true) throw new IndexedPriceEvidenceError("GECKOTERMINAL_OPERATOR_APPROVAL_MISSING");
  if(!target||typeof target.pool!=="string"||typeof target.baseMint!=="string"||typeof target.quoteMint!=="string")
    throw new IndexedPriceEvidenceError("GECKOTERMINAL_TARGET_INVALID");
  const requestedAt=utcNow(now);
  const request={cluster:"mainnet-beta",baseMint:target.baseMint,quoteMint:target.quoteMint,poolAddress:target.pool,requestedAt};
  const adapter=adapterFactory();
  let raw;
  try { raw=await adapter.fetchRaw(request,new AbortController().signal); }
  catch(error) {
    if(error instanceof GeckoTerminalAdapterError) throw new IndexedPriceEvidenceError("GECKOTERMINAL_"+error.code);
    throw new IndexedPriceEvidenceError("GECKOTERMINAL_FETCH_FAILED");
  }
  const retrievedAt=utcNow(now), requestId="live-geckoterminal-ohlcv-"+Date.parse(retrievedAt).toString(36);
  let normalized;
  try { normalized=adapter.normalize(raw,{requestedAt,retrievedAt,requestId}); }
  catch { throw new IndexedPriceEvidenceError("GECKOTERMINAL_NORMALIZATION_FAILED"); }
  const o=normalized?.observation;
  if(!Array.isArray(normalized?.errors)||normalized.errors.length!==0||!o||
    o.providerId!=="geckoterminal"||o.poolAddress!==target.pool||o.baseMint!==target.baseMint||
    o.quoteMint!==target.quoteMint||o.retrievedAt!==retrievedAt||typeof o.candleStartAt!=="string"||
    typeof o.priceUsdPerBase!=="string"||typeof o.synthetic!=="boolean"||!/^[a-f0-9]{64}$/.test(String(o.rawPayloadSha256)))
    throw new IndexedPriceEvidenceError("GECKOTERMINAL_EVIDENCE_INSUFFICIENT");
  return {
    providerId:"geckoterminal",independenceGroupId:GECKOTERMINAL_INDEPENDENCE_GROUP_ID,
    priceUsdPerBase:o.priceUsdPerBase,sourceEventAt:null,sourceObservedAt:o.candleStartAt,
    retrievedAt:o.retrievedAt,requestId:o.requestId,rawPayloadSha256:o.rawPayloadSha256,
    synthetic:o.synthetic,timeframe:o.timeframe,aggregate:o.aggregate
  };
}
