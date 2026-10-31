/**
 * Minimal declarations for the two built-in Node crypto APIs used by the
 * market-data package. The package intentionally does not depend on the full
 * @types/node ambient namespace.
 */
declare module "node:crypto" {
  export interface KeyObject {
    readonly asymmetricKeyType?: string;
  }

  export function createPublicKey(key: string): KeyObject;

  export function verify(
    algorithm: null,
    data: Uint8Array,
    key: KeyObject,
    signature: Uint8Array
  ): boolean;
}
