import type { AtpResolver } from './types';

interface CacheEntry<T> {
    value: T;
    expiry: number;
}

/**
 * AtpResolver backed by direct XRPC fetch calls.
 *
 * DID → PDS resolution is done by fetching the DID document:
 * - did:plc: resolved via plc.directory
 * - did:web: resolved via .well-known/did.json
 *
 * All record/blob fetches are unauthenticated (public data).
 */
export class PdsResolver implements AtpResolver {
    private pdsCache = new Map<string, CacheEntry<string>>();
    private ttlMs: number;

    constructor(opts?: { ttlMs?: number }) {
        this.ttlMs = opts?.ttlMs ?? 5 * 60 * 1000; // 5 minutes default
    }

    async resolvePds(did: string): Promise<string> {
        const cached = this.pdsCache.get(did);
        if (cached && cached.expiry > Date.now()) {
            return cached.value;
        }

        const didDoc = await this.resolveDidDocument(did);
        const pdsUrl = this.extractPdsEndpoint(didDoc);

        this.pdsCache.set(did, { value: pdsUrl, expiry: Date.now() + this.ttlMs });
        return pdsUrl;
    }

    async getRecord<T = unknown>(
        did: string,
        collection: string,
        rkey: string,
    ): Promise<{ value: T; cid: string }> {
        const pds = await this.resolvePds(did);
        const params = new URLSearchParams({ repo: did, collection, rkey });
        const res = await fetch(
            `${pds}/xrpc/com.atproto.repo.getRecord?${params}`,
        );
        if (!res.ok) {
            throw new Error(
                `Failed to fetch record ${collection}/${rkey} from ${did}: ${res.status}`,
            );
        }
        const json = await res.json() as { value: T; cid: string };
        return { value: json.value, cid: json.cid };
    }

    async getBlob(did: string, cid: string): Promise<Uint8Array> {
        const pds = await this.resolvePds(did);
        const params = new URLSearchParams({ did, cid });
        const res = await fetch(
            `${pds}/xrpc/com.atproto.sync.getBlob?${params}`,
        );
        if (!res.ok) {
            throw new Error(
                `Failed to fetch blob ${cid} from ${did}: ${res.status}`,
            );
        }
        return new Uint8Array(await res.arrayBuffer());
    }

    private async resolveDidDocument(did: string): Promise<Record<string, unknown>> {
        let url: string;
        if (did.startsWith('did:plc:')) {
            url = `https://plc.directory/${did}`;
        } else if (did.startsWith('did:web:')) {
            const host = did.slice('did:web:'.length).replace(/%3A/g, ':');
            url = `https://${host}/.well-known/did.json`;
        } else {
            throw new Error(`Unsupported DID method: ${did}`);
        }

        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(`Failed to resolve DID ${did}: ${res.status}`);
        }
        return res.json() as Promise<Record<string, unknown>>;
    }

    private extractPdsEndpoint(didDoc: Record<string, unknown>): string {
        const services = didDoc.service as Array<{
            id: string;
            type: string;
            serviceEndpoint: string;
        }> | undefined;

        if (!services) {
            throw new Error('DID document has no service entries');
        }

        const pds = services.find(
            (s) => s.id === '#atproto_pds' || s.type === 'AtprotoPersonalDataServer',
        );
        if (!pds) {
            throw new Error('No #atproto_pds service found in DID document');
        }

        return pds.serviceEndpoint.replace(/\/$/, '');
    }
}
