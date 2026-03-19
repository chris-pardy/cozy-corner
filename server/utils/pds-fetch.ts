/**
 * Direct PDS record fetching for server-side use.
 */

const PDS_URL = process.env.PDS_URL || "http://localhost:2583";

export async function fetchRecord(
  did: string,
  collection: string,
  rkey: string,
): Promise<{ value: Record<string, unknown>; cid: string }> {
  const qs = new URLSearchParams({ repo: did, collection, rkey }).toString();
  const res = await fetch(`${PDS_URL}/xrpc/com.atproto.repo.getRecord?${qs}`);
  if (!res.ok) {
    throw new Error(`PDS fetch failed: ${collection}/${rkey} (${res.status})`);
  }
  const data = await res.json();
  return { value: data.value, cid: data.cid };
}

export function parseAtUri(
  uri: string,
): { did: string; collection: string; rkey: string } | null {
  const m = uri.match(/^at:\/\/([^/]+)\/([^/]+)\/(.+)$/);
  if (!m) return null;
  return { did: m[1], collection: m[2], rkey: m[3] };
}
