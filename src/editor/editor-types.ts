/**
 * Shared type definitions for editor components.
 *
 * StateValueData is used by ItemEditor, RoomEditor, and AvatarEditor
 * to represent name/value pairs for state property overrides.
 */

export interface StateValueData {
  name: string;
  value: string;
}
