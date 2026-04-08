interface MetadataPanelProps {
  description: string;
  tags: string[];
  onDescriptionChange: (description: string) => void;
  onTagsChange: (tags: string[]) => void;
  descriptionPlaceholder?: string;
  tagsPlaceholder?: string;
}

export function MetadataPanel({
  description,
  tags,
  onDescriptionChange,
  onTagsChange,
  descriptionPlaceholder = 'A cozy creation...',
  tagsPlaceholder = 'tag1, tag2, ...',
}: MetadataPanelProps) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-surface-border bg-surface-deep/50 p-2">
      <div>
        <label className="mb-0.5 block font-heading text-[10px] uppercase tracking-wider text-text-muted">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder={descriptionPlaceholder}
          rows={3}
          className="w-full resize-none rounded-sm border border-surface-border bg-surface-deep px-1.5 py-1 font-body text-[10px] text-text outline-none focus:border-gold"
        />
      </div>
      <div>
        <label className="mb-0.5 block font-heading text-[10px] uppercase tracking-wider text-text-muted">
          Tags
        </label>
        <input
          value={tags.join(', ')}
          onChange={(e) =>
            onTagsChange(e.target.value.split(',').map((t) => t.trim()).filter(Boolean))
          }
          placeholder={tagsPlaceholder}
          className="w-full rounded-sm border border-surface-border bg-surface-deep px-1.5 py-1 font-body text-[10px] text-text outline-none focus:border-gold"
        />
      </div>
    </div>
  );
}
