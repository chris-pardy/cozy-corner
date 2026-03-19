// Type shims for generated code dependencies that lack proper type exports
declare module "multiformats/cid" {
  export class CID {
    readonly version: 0 | 1;
    readonly code: number;
    readonly multihash: { digest: Uint8Array };
    readonly bytes: Uint8Array;
    toString(): string;
    equals(other: unknown): boolean;
    static parse(str: string): CID;
    static decode(bytes: Uint8Array): CID;
  }
}
