/** Text to display in the prompt box. */
export const PROMPT_TEXT = "engine:promptText";

/** Options array (string[]) or null for dismiss-only. */
export const PROMPT_OPTIONS = "engine:promptOptions";

/** User's response — set by the UI when user selects/dismisses. */
export const PROMPT_RESPONSE = "engine:promptResponse";

/** Whether a prompt is currently active/blocking. */
export const PROMPT_ACTIVE = "engine:promptActive";

/** Mixin interface for entities with prompt state. */
export interface PromptMixin {
  [PROMPT_TEXT]: string;
  [PROMPT_OPTIONS]: string[] | null;
  [PROMPT_RESPONSE]: string;
  [PROMPT_ACTIVE]: boolean;
}
