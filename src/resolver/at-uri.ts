/** Parsed AT URI components. */
export interface ParsedAtUri {
    did: string;
    collection: string;
    rkey: string;
}

/**
 * Parse an AT URI string into its components.
 * Format: at://did:plc:xxx/collection.name/rkey
 */
export function parseAtUri(uri: string): ParsedAtUri {
    if (!uri.startsWith('at://')) {
        throw new Error(`Invalid AT URI: ${uri}`);
    }
    const rest = uri.slice(5); // strip "at://"
    const parts = rest.split('/');
    if (parts.length < 3) {
        throw new Error(`Invalid AT URI (missing components): ${uri}`);
    }
    return {
        did: parts[0],
        collection: parts[1],
        rkey: parts.slice(2).join('/'),
    };
}

/**
 * Build an AT URI from components.
 */
export function buildAtUri(did: string, collection: string, rkey: string): string {
    return `at://${did}/${collection}/${rkey}`;
}
