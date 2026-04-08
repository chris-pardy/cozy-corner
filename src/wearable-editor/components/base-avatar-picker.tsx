import { useCallback, useEffect, useState } from 'react';
import { User, X, RefreshCw } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { cn } from '@/lib/utils';
import type { WearableDispatch } from '../redux/store';
import { selectBaseAvatar, setBaseAvatar, clearBaseAvatar, type BaseAvatarRef } from '../redux/wearable-slice';
import { useAuth } from '../../atproto/AuthContext';
import type { AtCozyCornerAvatarBase } from '../../atproto/generated/index';

interface BaseAvatarOption {
  uri: string;
  cid: string;
  name: string;
  value: AtCozyCornerAvatarBase.Record;
}

export function BaseAvatarPicker() {
  const dispatch = useDispatch<WearableDispatch>();
  const baseAvatar = useSelector(selectBaseAvatar);
  const { did, session } = useAuth();
  const [options, setOptions] = useState<BaseAvatarOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const loadBaseAvatars = useCallback(async () => {
    if (!did || !session) return;
    setLoading(true);
    setError(null);
    try {
      const res = await session.fetchHandler(
        '/xrpc/com.atproto.repo.listRecords?repo=' +
          encodeURIComponent(did) +
          '&collection=at.cozy-corner.avatar.base',
      );
      const data = (await res.json()) as {
        records: { uri: string; cid: string; value: AtCozyCornerAvatarBase.Record }[];
      };
      setOptions(
        data.records.map((r) => ({
          uri: r.uri,
          cid: r.cid,
          name: r.value.name,
          value: r.value,
        })),
      );
    } catch (err) {
      console.error('Failed to load base avatars:', err);
      setError(err instanceof Error ? err.message : 'Failed to load base avatars');
    } finally {
      setLoading(false);
    }
  }, [session, did]);

  useEffect(() => {
    loadBaseAvatars();
  }, [loadBaseAvatars]);

  function handleSelect(option: BaseAvatarOption) {
    // We don't have the editor's serialized layers from the PDS record directly.
    // The base avatar record stores layers as AnimationLayer[] (sprite sheet references),
    // not as pixel data. For the composite preview we store the record's layer metadata.
    // The preview component will handle rendering from the base avatar's sprite sheet.
    const ref: BaseAvatarRef = {
      uri: option.uri,
      cid: option.cid,
      name: option.name,
      layers: [],
      canvasWidth: 32,
      canvasHeight: 32,
    };
    dispatch(setBaseAvatar(ref));
    setOpen(false);
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-surface-border bg-surface-deep/50 p-2">
      <div className="flex items-center justify-between">
        <span className="font-heading text-[10px] uppercase tracking-wider text-text-muted">
          Base Avatar
        </span>
        {baseAvatar && (
          <button
            type="button"
            aria-label="Clear base avatar"
            onClick={() => dispatch(clearBaseAvatar())}
            className="flex size-5 items-center justify-center rounded-sm text-text-muted transition-colors hover:bg-surface-muted hover:text-text"
          >
            <X className="size-3" />
          </button>
        )}
      </div>

      {baseAvatar ? (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className={cn(
            'flex items-center gap-2 rounded-sm border px-2 py-1.5 text-left transition-colors',
            'border-gold/40 bg-gold/5 hover:bg-gold/10',
          )}
        >
          <User className="size-4 shrink-0 text-gold" />
          <div className="min-w-0 flex-1">
            <span className="block truncate font-heading text-xs text-text">
              {baseAvatar.name}
            </span>
            <span className="block truncate font-heading text-[9px] text-text-muted">
              {baseAvatar.uri}
            </span>
          </div>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 rounded-sm border border-dashed border-surface-border px-2 py-2.5 text-left transition-colors hover:border-text-muted hover:bg-surface-muted/30"
        >
          <User className="size-4 shrink-0 text-text-muted" />
          <span className="font-heading text-[10px] text-text-muted">
            Select a base avatar...
          </span>
        </button>
      )}

      {open && (
        <div className="flex flex-col gap-px rounded-sm border border-surface-border bg-surface">
          <div className="flex items-center justify-between border-b border-surface-border px-2 py-1">
            <span className="font-heading text-[10px] text-text-muted">
              Your base avatars
            </span>
            <button
              type="button"
              aria-label="Refresh list"
              onClick={loadBaseAvatars}
              className="flex size-5 items-center justify-center rounded-sm text-text-muted transition-colors hover:bg-surface-muted hover:text-text"
            >
              <RefreshCw className={cn('size-3', loading && 'animate-spin')} />
            </button>
          </div>

          {error && (
            <span className="px-2 py-1 font-heading text-[9px] text-red-400">
              {error}
            </span>
          )}

          {loading && options.length === 0 && (
            <span className="px-2 py-2 text-center font-heading text-[9px] text-text-muted">
              Loading...
            </span>
          )}

          {!loading && options.length === 0 && !error && (
            <span className="px-2 py-2 text-center font-heading text-[9px] text-text-muted">
              No base avatars found. Create one in the Base Avatar Editor first.
            </span>
          )}

          <div className="max-h-48 overflow-y-auto">
            {options.map((opt) => {
              const isSelected = baseAvatar?.uri === opt.uri;
              return (
                <button
                  key={opt.uri}
                  type="button"
                  onClick={() => handleSelect(opt)}
                  className={cn(
                    'flex w-full items-center gap-2 px-2 py-1.5 text-left transition-colors',
                    isSelected
                      ? 'bg-gold/15 text-text'
                      : 'text-text-muted hover:bg-surface-muted hover:text-text',
                  )}
                >
                  <User className={cn('size-3.5 shrink-0', isSelected ? 'text-gold' : 'text-text-muted')} />
                  <div className="min-w-0 flex-1">
                    <span className="block truncate font-heading text-[10px]">
                      {opt.name || 'Untitled'}
                    </span>
                    {opt.value.tags && opt.value.tags.length > 0 && (
                      <span className="block truncate font-heading text-[8px] text-text-muted">
                        {opt.value.tags.join(', ')}
                      </span>
                    )}
                  </div>
                  {isSelected && (
                    <span className="shrink-0 font-heading text-[8px] text-gold">selected</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
