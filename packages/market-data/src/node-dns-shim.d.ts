/**
 * Minimal Node DNS/network declarations used by the owner-pinned registry
 * resolver. The workspace intentionally does not depend on @types/node.
 */
declare module "node:dns" {
  export interface LookupAddress {
    readonly address: string;
    readonly family: number;
  }

  export function lookup(
    hostname: string,
    options: {
      readonly all: true;
      readonly family?: 0 | 4 | 6;
      readonly verbatim: true;
    },
    callback: (error: Error | null, addresses: LookupAddress[]) => void
  ): void;
}

declare module "node:net" {
  export function isIP(input: string): number;
}
