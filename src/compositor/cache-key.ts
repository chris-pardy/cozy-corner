import type { CompositeInput } from './types';
import type { ChannelTint } from '@/atproto/generated/types/at/cozy-corner/defs';

function sortedTints(tints: ChannelTint[]): string {
    return tints
        .map((t) => `${t.channel}:${t.tint}`)
        .sort()
        .join(',');
}

/**
 * Build the canonical string representation of a composite input.
 * Deterministic given the same CIDs and tints.
 */
function canonicalString(input: CompositeInput): string {
    const base = `base:${input.base.blobCid}|${sortedTints(input.baseTints)}`;
    const wearables = input.wearables
        .map((w) => `${w.source.blobCid}|${sortedTints(w.tints)}`)
        .join(';');
    return `${base}|w:${wearables}`;
}

/**
 * Compute a deterministic cache key for a composite input.
 * Uses SHA-256 and returns a 32-char hex string.
 */
export async function computeCacheKey(input: CompositeInput): Promise<string> {
    const data = new TextEncoder().encode(canonicalString(input));
    const hash = await crypto.subtle.digest('SHA-256', data);
    const bytes = new Uint8Array(hash);
    let hex = '';
    for (let i = 0; i < 16; i++) {
        hex += bytes[i].toString(16).padStart(2, '0');
    }
    return hex;
}

/**
 * Synchronous variant using the canonical string directly (no hashing).
 * Useful for tests or environments without crypto.subtle.
 */
export function canonicalCacheString(input: CompositeInput): string {
    return canonicalString(input);
}
