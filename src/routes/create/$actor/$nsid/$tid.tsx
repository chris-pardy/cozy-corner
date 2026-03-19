import { createFileRoute } from "@tanstack/react-router";
import { ItemEditor } from "~/editor/ItemEditor";
import { WearableEditor } from "~/editor/WearableEditor";
import { BaseAvatarEditor } from "~/editor/BaseAvatarEditor";
import { CritterEditor } from "~/editor/CritterEditor";
import { TilesetEditor } from "~/editor/TilesetEditor";
import { StarterPackEditor } from "~/editor/StarterPackEditor";
import { AvatarEditor } from "~/editor/AvatarEditor";
import { RoomEditor } from "~/editor/RoomEditor";
import { HouseEditor } from "~/editor/HouseEditor";
import { getSession } from "~/editor/load-record";

export const Route = createFileRoute("/create/$actor/$nsid/$tid")({
  component: CreateEditor,
});

const NSID_TO_EDITOR: Record<
  string,
  React.ComponentType<{ uri?: string; editRkey?: string; draftKey?: string }>
> = {
  "at.cozy-corner.item": ItemEditor,
  "at.cozy-corner.avatar.wearable": WearableEditor,
  "at.cozy-corner.avatar.base": BaseAvatarEditor,
  "at.cozy-corner.critter": CritterEditor,
  "at.cozy-corner.tileset": TilesetEditor,
  "at.cozy-corner.starterPack": StarterPackEditor,
  "at.cozy-corner.avatar": AvatarEditor,
  "at.cozy-corner.house.room": RoomEditor,
  "at.cozy-corner.house": HouseEditor,
};

function CreateEditor() {
  const { actor, nsid, tid } = Route.useParams();

  const Editor = NSID_TO_EDITOR[nsid];
  if (!Editor) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-10 text-text-muted text-xs">
        Unknown type: {nsid}
      </div>
    );
  }

  const isNew = tid === "new";
  const uri = isNew ? undefined : `at://${actor}/${nsid}/${tid}`;

  // Determine ownership: can overwrite if the actor matches the session
  let editRkey: string | undefined;
  if (!isNew) {
    try {
      const session = getSession();
      const isOwner =
        actor === session.did || actor === session.handle;
      if (isOwner) editRkey = tid;
    } catch {
      // not logged in — treat as non-owner
    }
  }

  const draftKey = `${nsid}|${actor}|${tid}`;

  return (
    <div className="p-6">
      <Editor uri={uri} editRkey={editRkey} draftKey={draftKey} />
    </div>
  );
}
