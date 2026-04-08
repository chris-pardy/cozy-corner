import type { BlobRef } from '@atproto/lexicon';
import type { ImageCodec } from '@/compositor/codec/types';
import type { CompositeInput } from '@/compositor/types';
import type { AtpResolver } from './types';
import { parseAtUri } from './at-uri';
import type * as AvatarRecord from '@/atproto/generated/types/at/cozy-corner/avatar';
import type * as AvatarBase from '@/atproto/generated/types/at/cozy-corner/avatar/base';
import type * as Wearable from '@/atproto/generated/types/at/cozy-corner/wearable';

/**
 * Extract the CID string from a BlobRef.
 * BlobRef stores the CID in ref.$link (ipld link format).
 */
function blobCid(blob: BlobRef): string {
    // BlobRef from @atproto/lexicon stores CID as ref.$link
    const ref = blob as unknown as { ref: { $link: string } | { toString(): string } };
    if (typeof ref.ref === 'object' && '$link' in ref.ref) {
        return ref.ref.$link;
    }
    return String(ref.ref);
}

/**
 * Resolve an avatar AT URI into a fully pre-fetched CompositeInput
 * ready for the compositing pipeline.
 */
export async function resolveAvatar(
    avatarUri: string,
    resolver: AtpResolver,
    codec: ImageCodec,
): Promise<CompositeInput> {
    const parsed = parseAtUri(avatarUri);

    // Fetch the avatar record
    const { value: avatar } = await resolver.getRecord<AvatarRecord.Main>(
        parsed.did,
        parsed.collection,
        parsed.rkey,
    );

    // Fetch the base avatar record
    const baseParsed = parseAtUri(avatar.baseAvatar.uri);
    const { value: base } = await resolver.getRecord<AvatarBase.Main>(
        baseParsed.did,
        baseParsed.collection,
        baseParsed.rkey,
    );

    // Fetch all wearable records in parallel
    const wearableEntries = avatar.wearables ?? [];
    const wearableRecords = await Promise.all(
        wearableEntries.map(async (ew) => {
            const wp = parseAtUri(ew.wearable.uri);
            const { value } = await resolver.getRecord<Wearable.Main>(
                wp.did,
                wp.collection,
                wp.rkey,
            );
            return { record: value, tints: ew.tints ?? [] };
        }),
    );

    // Fetch all blobs in parallel
    const baseBlobCid = blobCid(base.spriteSheet);
    const allBlobFetches = [
        resolver.getBlob(baseParsed.did, baseBlobCid),
        ...wearableRecords.map((w) => {
            const wCid = blobCid(w.record.spriteSheet);
            const wParsed = parseAtUri(
                wearableEntries[wearableRecords.indexOf(w)].wearable.uri,
            );
            return resolver.getBlob(wParsed.did, wCid);
        }),
    ];

    const blobBytes = await Promise.all(allBlobFetches);

    // Decode all blobs in parallel
    const decoded = await Promise.all(blobBytes.map((b) => codec.decode(b)));

    return {
        base: {
            blobCid: baseBlobCid,
            pixels: decoded[0],
            layers: base.layers,
        },
        baseTints: avatar.baseAvatarTints ?? [],
        wearables: wearableRecords.map((w, i) => ({
            source: {
                blobCid: blobCid(w.record.spriteSheet),
                pixels: decoded[i + 1],
                layers: w.record.layers,
            },
            tints: w.tints,
            equipOrder: i,
        })),
    };
}
