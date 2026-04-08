/** Minimal interface for resolving AT Protocol records and blobs. */
export interface AtpResolver {
    /** Resolve a DID to its PDS service endpoint URL. */
    resolvePds(did: string): Promise<string>;

    /**
     * Fetch a record by repo DID, collection, and rkey.
     * Returns the record value and its CID.
     */
    getRecord<T = unknown>(
        did: string,
        collection: string,
        rkey: string,
    ): Promise<{ value: T; cid: string }>;

    /** Fetch raw blob bytes from a PDS. */
    getBlob(did: string, cid: string): Promise<Uint8Array>;
}
