import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/editor")({
  component: EditorPage,
});

function EditorPage() {
  const [Editor, setEditor] = useState<React.ComponentType | null>(null);

  useEffect(() => {
    import("~/editor/SpritePixelEditor").then((m) => {
      setEditor(() => m.SpritePixelEditor);
    });
  }, []);

  if (!Editor) return null;

  return (
    <div className="min-h-screen p-4">
      <Editor />
    </div>
  );
}
