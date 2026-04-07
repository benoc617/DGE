/** Fixed AI opponents (names + persona keys). Shared by admin UI and create-ai-players. */
export const AI_CONFIGS = [
  { name: "Admiral Koss", persona: "economist" as const },
  { name: "Warlord Vrex", persona: "warlord" as const },
  { name: "Shadow Nyx", persona: "spymaster" as const },
  { name: "Ambassador Sol", persona: "diplomat" as const },
  { name: "Fortress Prime", persona: "turtle" as const },
  { name: "Optimax", persona: "optimal" as const },
] as const;

export type AIPersonaKey = (typeof AI_CONFIGS)[number]["persona"];
