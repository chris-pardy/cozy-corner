import { describe, expect, test } from 'bun:test';
import { parseAtUri, buildAtUri } from '../at-uri';

describe('parseAtUri', () => {
    test('parses a standard AT URI', () => {
        const result = parseAtUri('at://did:plc:abc123/at.cozy-corner.avatar/self');
        expect(result.did).toBe('did:plc:abc123');
        expect(result.collection).toBe('at.cozy-corner.avatar');
        expect(result.rkey).toBe('self');
    });

    test('parses a did:web URI', () => {
        const result = parseAtUri('at://did:web:example.com/com.atproto.repo.record/abc');
        expect(result.did).toBe('did:web:example.com');
        expect(result.collection).toBe('com.atproto.repo.record');
        expect(result.rkey).toBe('abc');
    });

    test('throws on non-AT URI', () => {
        expect(() => parseAtUri('https://example.com')).toThrow('Invalid AT URI');
    });

    test('throws on URI with missing components', () => {
        expect(() => parseAtUri('at://did:plc:abc')).toThrow('missing components');
    });

    test('handles rkey with slashes', () => {
        const result = parseAtUri('at://did:plc:abc/collection/rkey/with/slash');
        expect(result.rkey).toBe('rkey/with/slash');
    });
});

describe('buildAtUri', () => {
    test('builds a standard AT URI', () => {
        expect(buildAtUri('did:plc:abc', 'at.cozy-corner.avatar', 'self'))
            .toBe('at://did:plc:abc/at.cozy-corner.avatar/self');
    });

    test('roundtrips with parseAtUri', () => {
        const uri = 'at://did:plc:xyz/at.cozy-corner.item/abc123';
        const parsed = parseAtUri(uri);
        expect(buildAtUri(parsed.did, parsed.collection, parsed.rkey)).toBe(uri);
    });
});
