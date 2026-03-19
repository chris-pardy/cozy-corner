import { useQuery } from "@tanstack/react-query";
import type { SpriteEditorResult } from "./SpritePixelEditor";
import type { AnimationLayer } from "~/atproto/generated/types/at/cozy-corner/defs";
import {
  parseAtUri,
  extractBlobCid,
  blobUrl,
  loadImage,
  reconstructSprites,
  fetchRecord,
  getSession,
  type FetchedRecord,
} from "./load-record";

export interface EditorRecordData {
  record: FetchedRecord;
  targets: string[];
  sprites: Map<string, SpriteEditorResult>;
}

export function useEditorRecord(uri: string | undefined) {
  return useQuery<EditorRecordData>({
    queryKey: ["editor-record", uri],
    queryFn: async () => {
      const session = getSession();
      const { did, collection, rkey } = parseAtUri(uri!);
      const rec = await fetchRecord(session.pds, did, collection, rkey);

      const cid = extractBlobCid(rec.value.spriteSheet);
      let targets: string[] = [];
      let sprites = new Map<string, SpriteEditorResult>();

      if (cid) {
        const img = await loadImage(blobUrl(session.pds, did, cid));
        const result = await reconstructSprites(
          img,
          (rec.value.layers ?? []) as AnimationLayer[],
        );
        targets = result.targets;
        sprites = result.sprites;
      }

      return { record: rec, targets, sprites };
    },
    enabled: !!uri,
  });
}
