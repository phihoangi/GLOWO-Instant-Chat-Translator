(function () {
  const languages = Object.freeze({
    vi: { label: 'Tiếng Việt', name: 'Vietnamese' },
    en: { label: 'Tiếng Anh', name: 'English' },
    ko: { label: 'Tiếng Hàn', name: 'Korean' },
    ja: { label: 'Tiếng Nhật', name: 'Japanese' },
    zh: { label: 'Tiếng Trung', name: 'Chinese' },
    de: { label: 'Tiếng Đức', name: 'German' },
    fr: { label: 'Tiếng Pháp', name: 'French' },
    ru: { label: 'Tiếng Nga', name: 'Russian' },
    es: { label: 'Tiếng Tây Ban Nha', name: 'Spanish' },
  });
  // Keep existing storage keys: incoming now means all conversation bubbles,
  // outgoing means draft previews. Saved read/draft languages stay unchanged.
  const keys = ['openAiKey', 'enabled', 'autoTranslateIncoming', 'autoTranslateOutgoing', 'incomingTargetLang', 'outgoingTargetLang', 'targetLang'];
  function normalize(raw = {}) {
    const outgoing = raw.outgoingTargetLang || raw.targetLang;
    return {
      enabled: raw.enabled !== false,
      autoTranslateIncoming: raw.autoTranslateIncoming !== false,
      autoTranslateOutgoing: raw.autoTranslateOutgoing !== false,
      incomingTargetLang: raw.incomingTargetLang === 'en' ? 'en' : 'vi',
      outgoingTargetLang: Object.hasOwn(languages, outgoing) ? outgoing : 'en',
      openAiKey: typeof raw.openAiKey === 'string' ? raw.openAiKey.trim() : '',
    };
  }
  globalThis.ChatTranslatorSettings = Object.freeze({ languages, keys, normalize });
})();
