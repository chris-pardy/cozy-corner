import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useClient } from './AuthContext';
import type { AtpBaseClient } from './generated/index';
import type { AtCozyCornerAvatarBase, AtCozyCornerWearable, AtCozyCornerTileset, AtCozyCornerNpc } from './generated/index';

const COLLECTIONS = ['wearable', 'baseAvatar', 'tileset', 'npc'] as const;
export type CollectionType = (typeof COLLECTIONS)[number];

const COLLECTION_LABELS: Record<CollectionType, string> = {
  wearable: 'Wearable',
  baseAvatar: 'Base Avatar',
  tileset: 'Tileset',
  npc: 'NPC',
};

type RecordEntry =
  | { collection: 'wearable'; uri: string; value: AtCozyCornerWearable.Record }
  | { collection: 'baseAvatar'; uri: string; value: AtCozyCornerAvatarBase.Record }
  | { collection: 'tileset'; uri: string; value: AtCozyCornerTileset.Record }
  | { collection: 'npc'; uri: string; value: AtCozyCornerNpc.Record };

async function fetchCollection(
  client: AtpBaseClient,
  repo: string,
  collection: CollectionType,
): Promise<RecordEntry[]> {
  switch (collection) {
    case 'wearable': {
      const res = await client.at.cozyCorner.wearable.list({ repo });
      return res.records.map((r) => ({ collection, uri: r.uri, value: r.value }));
    }
    case 'baseAvatar': {
      // Access avatar.base via the NS — the generated code has a duplicate
      // `avatar` property (Record + NS) so TS can't see `.base`. At runtime
      // the NS constructor runs first and the field is available.
      const avatarNs = client.at.cozyCorner.avatar as unknown as { base: { list(p: { repo: string }): Promise<{ records: { uri: string; value: AtCozyCornerAvatarBase.Record }[] }> } };
      const res = await avatarNs.base.list({ repo });
      return res.records.map((r) => ({ collection, uri: r.uri, value: r.value }));
    }
    case 'tileset': {
      const res = await client.at.cozyCorner.tileset.list({ repo });
      return res.records.map((r) => ({ collection, uri: r.uri, value: r.value }));
    }
    case 'npc': {
      const res = await client.at.cozyCorner.npc.list({ repo });
      return res.records.map((r) => ({ collection, uri: r.uri, value: r.value }));
    }
  }
}

interface PDSBrowserProps {
  /** DID or handle to browse */
  repo: string;
  /** If set, only show records from these collection types */
  filter?: CollectionType[];
  /** Called when the user selects a record */
  onSelect?: (entry: RecordEntry) => void;
}

export function PDSBrowser({ repo, filter, onSelect }: PDSBrowserProps) {
  const client = useClient();
  const [records, setRecords] = useState<RecordEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<CollectionType | null>(null);

  const collectionsToFetch = filter ?? [...COLLECTIONS];

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all(collectionsToFetch.map((c) => fetchCollection(client, repo, c)))
      .then((results) => {
        if (cancelled) return;
        setRecords(results.flat());
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load records');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, repo, collectionsToFetch.join(',')]);

  const filtered = useMemo(
    () => activeFilter ? records.filter((r) => r.collection === activeFilter) : records,
    [records, activeFilter],
  );

  const handleFilterClick = useCallback((collection: CollectionType) => {
    setActiveFilter((prev) => (prev === collection ? null : collection));
  }, []);

  if (loading) {
    return <div className="py-8 text-center text-muted-foreground">Loading records...</div>;
  }

  if (error) {
    return <div className="py-8 text-center text-destructive">{error}</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      {collectionsToFetch.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {collectionsToFetch.map((c) => (
            <Button
              key={c}
              size="sm"
              variant={activeFilter === c ? 'default' : 'outline'}
              onClick={() => handleFilterClick(c)}
            >
              {COLLECTION_LABELS[c]}
            </Button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">No records found</div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((entry) => (
            <Card
              key={entry.uri}
              size="sm"
              className={cn(onSelect && 'cursor-pointer hover:ring-2 hover:ring-primary/50')}
              onClick={onSelect ? () => onSelect(entry) : undefined}
            >
              <CardHeader>
                <CardTitle>{entry.value.name}</CardTitle>
                <Badge variant="secondary">{COLLECTION_LABELS[entry.collection]}</Badge>
              </CardHeader>
              {entry.value.description && (
                <CardContent>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {entry.value.description}
                  </p>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export type { RecordEntry };
