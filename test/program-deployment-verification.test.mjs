import assert from "node:assert/strict";
import test from "node:test";
import {
  UPGRADEABLE_LOADER_PROGRAM_ID,
  inspectUpgradeableProgramAccount,
  assessUpgradeableProgramDeployment
} from "../packages/market-data/dist/index.js";
import { createHash } from "node:crypto";

const PROGRAM_ID = "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C";
const LOADER = UPGRADEABLE_LOADER_PROGRAM_ID;
const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function encode58(bytes) {
  let z=0; while(z<bytes.length && bytes[z]===0) z++;
  let n=0n; for(const b of bytes)n=(n<<8n)|BigInt(b);
  let s=""; while(n>0n){s=ALPHABET[Number(n%58n)]+s;n/=58n;}
  return "1".repeat(z)+s;
}
function writeU64(bytes,offset,n){let x=BigInt(n);for(let i=0;i<8;i++){bytes[offset+i]=Number(x&255n);x>>=8n;}}
function account(address,ownerProgramId,bytes,executable=false){return {address,exists:true,ownerProgramId,executable,dataBase64:Buffer.from(bytes).toString("base64"),space:bytes.length};}
function fixture({authority=false,synthetic=false}={}) {
  const pdKeyBytes=Uint8Array.from({length:32},(_,i)=>(i*7+11)&255);
  const pdAddress=encode58(pdKeyBytes);
  const programBytes=new Uint8Array(36); programBytes.set([2,0,0,0]); programBytes.set(pdKeyBytes,4);
  const elf=Uint8Array.from([0x7f,0x45,0x4c,0x46,1,2,3,4,5,6,7,8,9,10,11,12]);
  const pdBytes=new Uint8Array(45+elf.length);
  pdBytes.set([3,0,0,0]); writeU64(pdBytes,4,123456789);
  pdBytes[12]=authority?1:0;
  if(authority) pdBytes.set(new Uint8Array(32).fill(1),13);
  pdBytes.set(elf,45);
  const expected=createHash("sha256").update(elf).digest("hex");
  return {program:account(PROGRAM_ID,LOADER,programBytes,true),programData:account(pdAddress,LOADER,pdBytes,false),expected,synthetic,elfLength:elf.length};
}
test("decodes ProgramData pointer from a strict upgradeable Program account",()=>{
  const f=fixture(); const result=inspectUpgradeableProgramAccount(f.program,PROGRAM_ID);
  assert.equal(result.valid,true); assert.equal(result.programDataAddress,f.programData.address);
});
test("verified source ELF hash matches non-synthetic deployment evidence and reports upgradeability",async()=>{
  const f=fixture({authority:true});
  const result=await assessUpgradeableProgramDeployment({programAccount:f.program,programDataAccount:f.programData,expectedProgramId:PROGRAM_ID,expectedElfSha256:f.expected,expectedElfByteLength:f.elfLength,programAccountContextSlot:100,programDataContextSlot:101,synthetic:false});
  assert.equal(result.status,"MATCH"); assert.equal(result.observedElfSha256,f.expected);
  assert.equal(result.elfByteLength,f.elfLength); assert.equal(result.deploymentSlot,"123456789");
  assert.equal(result.upgradeAuthorityPresent,true); assert.ok(result.reasonCodes.includes("PROGRAM_REMAINS_UPGRADEABLE"));
  assert.equal(result.tradingAuthorized,false);
});
test("hash mismatch does not pass deployment integrity gate",async()=>{
  const f=fixture(); const result=await assessUpgradeableProgramDeployment({programAccount:f.program,programDataAccount:f.programData,expectedProgramId:PROGRAM_ID,expectedElfSha256:"0".repeat(64),expectedElfByteLength:f.elfLength,programAccountContextSlot:1,programDataContextSlot:1,synthetic:false});
  assert.equal(result.status,"HASH_MISMATCH"); assert.deepEqual(result.reasonCodes,["DEPLOYED_ELF_HASH_MISMATCH"]); assert.equal(result.tradingAuthorized,false);
});
test("missing source build reference hashes the observed ELF but remains insufficient evidence",async()=>{
  const f=fixture(); const result=await assessUpgradeableProgramDeployment({programAccount:f.program,programDataAccount:f.programData,expectedProgramId:PROGRAM_ID,expectedElfSha256:null,expectedElfByteLength:f.elfLength,programAccountContextSlot:1,programDataContextSlot:1,synthetic:false});
  assert.equal(result.status,"INSUFFICIENT_EVIDENCE"); assert.equal(result.observedElfSha256,f.expected);
  assert.deepEqual(result.reasonCodes,["EXPECTED_REFERENCE_ELF_SHA256_REQUIRED"]);
});
test("synthetic fixtures cannot produce operational MATCH",async()=>{
  const f=fixture({synthetic:true}); const result=await assessUpgradeableProgramDeployment({programAccount:f.program,programDataAccount:f.programData,expectedProgramId:PROGRAM_ID,expectedElfSha256:f.expected,expectedElfByteLength:f.elfLength,programAccountContextSlot:1,programDataContextSlot:1,synthetic:true});
  assert.equal(result.status,"SYNTHETIC_MATCH"); assert.equal(result.tradingAuthorized,false);
});
test("reference ELF hash excludes only zero-filled ProgramData allocation padding",async()=>{
  const f=fixture(); const withPadding=Buffer.concat([Buffer.from(f.programData.dataBase64,"base64"),Buffer.alloc(32)]);
  const paddedAccount={...f.programData,dataBase64:withPadding.toString("base64"),space:withPadding.length};
  const result=await assessUpgradeableProgramDeployment({programAccount:f.program,programDataAccount:paddedAccount,expectedProgramId:PROGRAM_ID,expectedElfSha256:f.expected,expectedElfByteLength:f.elfLength,programAccountContextSlot:1,programDataContextSlot:1,synthetic:false});
  assert.equal(result.status,"MATCH"); assert.equal(result.programDataPaddingByteLength,32); assert.equal(result.programDataPaddingZeroed,true);
  withPadding[withPadding.length-1]=1;
  const badPadding={...paddedAccount,dataBase64:withPadding.toString("base64"),space:withPadding.length};
  const blocked=await assessUpgradeableProgramDeployment({programAccount:f.program,programDataAccount:badPadding,expectedProgramId:PROGRAM_ID,expectedElfSha256:f.expected,expectedElfByteLength:f.elfLength,programAccountContextSlot:1,programDataContextSlot:1,synthetic:false});
  assert.equal(blocked.status,"MISMATCH"); assert.deepEqual(blocked.reasonCodes,["PROGRAMDATA_NONZERO_BYTES_AFTER_REFERENCE_ELF_LENGTH"]);
});
test("ProgramData below the program context slot remains insufficient",async()=>{
  const f=fixture(); const result=await assessUpgradeableProgramDeployment({programAccount:f.program,programDataAccount:f.programData,expectedProgramId:PROGRAM_ID,expectedElfSha256:f.expected,expectedElfByteLength:f.elfLength,programAccountContextSlot:10,programDataContextSlot:9,synthetic:false});
  assert.equal(result.status,"INSUFFICIENT_EVIDENCE"); assert.deepEqual(result.reasonCodes,["PROGRAMDATA_CONTEXT_SLOT_BELOW_PROGRAM_ACCOUNT"]);
});
test("invalid loader state and ProgramData address mismatch fail closed",async()=>{
  const f=fixture(); const broken=Uint8Array.from(Buffer.from(f.program.dataBase64,"base64")); broken[0]=1;
  assert.equal(inspectUpgradeableProgramAccount(account(PROGRAM_ID,LOADER,broken,true),PROGRAM_ID).valid,false);
  const wrong={...f.programData,address:"11111111111111111111111111111111"};
  const result=await assessUpgradeableProgramDeployment({programAccount:f.program,programDataAccount:wrong,expectedProgramId:PROGRAM_ID,expectedElfSha256:f.expected,expectedElfByteLength:f.elfLength,programAccountContextSlot:1,programDataContextSlot:1,synthetic:false});
  assert.equal(result.status,"MISMATCH"); assert.deepEqual(result.reasonCodes,["PROGRAMDATA_ADDRESS_MISMATCH"]);
});
