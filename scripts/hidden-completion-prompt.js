{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const DEFAULT_PROMPT_VERSION = "hidden-completion-v1";

  function buildHiddenCompletionPrompt(request, options = {}) {
    const version = stringOrDefault(options.promptVersion, request?.promptVersion || DEFAULT_PROMPT_VERSION);
    return {
      version,
      text: [
        "Fill the masked hidden or missing area of the same character part.",
        "Preserve the original webtoon and anime line art, character identity, pose continuity, local texture, local lighting, and color consistency.",
        "Avoid redesigning the character, costume, or scene.",
      ].join(" "),
    };
  }

  function stringOrDefault(value, fallback) {
    return value === undefined || value === null || value === "" ? String(fallback) : String(value);
  }

  Animotion.hiddenCompletionPrompt = { DEFAULT_PROMPT_VERSION, buildHiddenCompletionPrompt };
  if (typeof module !== "undefined") module.exports = Animotion.hiddenCompletionPrompt;
}
