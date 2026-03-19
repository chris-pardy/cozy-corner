/** Text/emoji to display in the bubble. */
export const SPEECH_TEXT = "engine:speechText";

/** Bubble style: "thought" or "speech". */
export const SPEECH_BUBBLE = "engine:speechBubble";

/** Timestamp (ms) when the bubble was set. */
export const SPEECH_START = "engine:speechStart";

/** Duration (ms) to display the bubble. */
export const SPEECH_DURATION = "engine:speechDuration";

/** Default bubble duration. */
export const DEFAULT_SPEECH_DURATION = 3000;

/** Mixin interface for entities with speech state. */
export interface SpeechMixin {
  [SPEECH_TEXT]: string;
  [SPEECH_BUBBLE]: "thought" | "speech";
  [SPEECH_START]: number;
  [SPEECH_DURATION]: number;
}
