(function () {
  if (window.__CHAT_TRANSLATOR_INJECTED__) return;
  window.__CHAT_TRANSLATOR_INJECTED__ = true;

  const { keys, normalize, languages } = ChatTranslatorSettings;
  const platform = ChatTranslatorPlatforms;
  const dom = platform.dom;
  const adapter = platform.resolve(location.hostname);
  const editorSelector = adapter.editors;
  const excludedSelector = [platform.exclusions, adapter.messageExclusions].filter(Boolean).join(', ');
  const messageStates = new Map();
  const conversations = new Map();
  const composers = new Map();
  const observedRoots = new Map();
  const observerOptions = { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'id', 'role', 'dir', 'data-scope', 'data-testid', 'data-view-name', 'data-lexical-editor', 'aria-label', 'aria-placeholder', 'data-placeholder', 'placeholder', 'data-urn', 'data-id', 'data-mid', 'data-msg-id', 'data-client-id', 'data-event-urn', 'data-message-id', 'data-conversation-id', 'data-peer-id', 'data-direction', 'data-is-self', 'data-component', 'contenteditable', 'title'] };
  let rawSettings = {};
  let settings = normalize();
  let scanTimer;

  const cardStyles = `
    :host { all: initial; display: block; margin: 6px 0 8px; max-width: 100%; clear: both; color-scheme: light; font: 13px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    :host(.chat-translator-preview) { position: fixed; z-index: 2147483640; margin: 0; }
    :host([hidden]) { display: none !important; }
    * { box-sizing: border-box; }
    .card { border: 1px solid #bdd9d6; border-radius: 10px; padding: 10px 12px; background: #f1faf8; color: #173e3a; box-shadow: 0 2px 8px #12332c0a; }
    .heading { display: flex; justify-content: space-between; align-items: center; gap: 12px; color: #43726b; font-size: 10px; font-weight: 650; margin-bottom: 5px; }
    .translation { white-space: pre-wrap; overflow-wrap: anywhere; max-height: 180px; overflow-y: auto; }
    .hint { color: #59756f; font-size: 11px; font-weight: 400; }
    kbd { font: inherit; font-weight: 650; border: 1px solid #bbd2cc; border-radius: 4px; padding: 1px 5px; background: #fff; }
    .error { color: #a63f35; }
    .card.manual { background: transparent; border: none; box-shadow: none; padding: 0; }
    button { font: inherit; font-size: 11px; cursor: pointer; color: #21665b; border: 1px solid #aacfc5; background: #fff; padding: 3px 8px; border-radius: 5px; }
    button:focus-visible { outline: 2px solid #247f6c; outline-offset: 2px; }
    [hidden] { display: none !important; }
    @media (prefers-color-scheme: dark) {
      :host { color-scheme: dark; }
      .card { background: #132d2b; border-color: #315d56; color: #dcf5ed; }
      .heading, .hint { color: #9bc9bd; }
      kbd, button { background: #1c3934; color: #c5ecdf; border-color: #527c70; }
      .error { color: #ffb4a9; }
    }
  `;

  function enabled(mode, manual = false) {
    return settings.enabled && Boolean(settings.openAiKey) && (manual || settings[mode === 'incoming' ? 'autoTranslateIncoming' : 'autoTranslateOutgoing']);
  }

  function translate(text, mode, targetLang, options = {}) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ action: 'translate', payload: { text, mode, targetLang, ...options } }, (response) => {
          const error = chrome.runtime.lastError;
          resolve(error ? { success: false, error: 'Extension đã cập nhật. Hãy tải lại trang chat.' } : response || { success: false, error: 'Không nhận được bản dịch. Hãy thử lại.' });
        });
      } catch { resolve({ success: false, error: 'Hãy tải lại trang chat để kết nối extension.' }); }
    });
  }

  function createCard(className, preview = false) {
    const host = document.createElement('div');
    host.className = className;
    host.hidden = true;
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = cardStyles;
    const container = document.createElement('div');
    container.className = 'card';
    const heading = document.createElement('div');
    heading.className = 'heading';
    const label = document.createElement('span');
    label.className = 'label';
    const hint = document.createElement('span');
    hint.className = 'hint';
    if (preview) {
      const tab = document.createElement('kbd');
      tab.textContent = 'Tab';
      hint.append(tab, ' để thay thế');
    } else hint.textContent = 'Tự động dịch';
    const text = document.createElement('div');
    text.className = 'translation';
    text.setAttribute('role', 'status');
    text.setAttribute('aria-live', 'polite');
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.hidden = true;
    retry.textContent = 'Thử lại';
    heading.append(label, hint);
    container.append(heading, text, retry);
    shadow.append(style, container);
    return { host, container, heading, label, text, hint, retry };
  }

  function showCard(card, text, targetLang, error = false, pending = false) {
    card.container.classList.remove('manual');
    card.heading.hidden = false;
    card.text.hidden = false;
    card.label.textContent = languages[targetLang].label;
    card.text.textContent = text;
    card.text.classList.toggle('error', error);
    card.text.setAttribute('aria-busy', String(pending));
    card.retry.hidden = !error;
    card.host.hidden = false;
  }

  function readMessage(element) {
    const clone = element.cloneNode(true);
    clone.querySelectorAll(excludedSelector).forEach((node) => node.remove());
    clone.querySelectorAll([platform.metadata, adapter.metadata].filter(Boolean).join(', ')).forEach((node) => node.remove());
    clone.querySelectorAll('br').forEach((node) => node.replaceWith('\n'));
    clone.querySelectorAll('img[alt]').forEach((node) => node.replaceWith(node.getAttribute('alt')));
    clone.querySelectorAll('p, div, div-15').forEach((node) => { if (node.nextSibling) node.append('\n'); });
    return (clone.textContent || '').replace(/\u200b/g, '').trim();
  }

  function isMessage(element) {
    if (dom.closest(element, excludedSelector) || dom.closest(element, '[contenteditable="true"], [contenteditable=""], [contenteditable="plaintext-only"]')) return false;
    // WhatsApp's metadata wrapper contains the same selectable text: use only the leaf.
    if (adapter.id === 'whatsapp' && element.matches('[data-pre-plain-text]') && element.querySelector('.selectable-text, [data-testid="selectable-text"]')) return false;
    return true;
  }

  function ensureMessageCard(state) {
    if (!state.card) {
      state.card = createCard('chat-translator-incoming');
      state.card.retry.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        runMessageTranslation(state, true);
      });
    }
    if (adapter.id === 'zalo' && state.element.matches('.card')) {
      // Zalo rows can be flex containers. Put the fallback translation inside
      // the bubble so it stays below the message rather than beside it.
      if (state.element.lastElementChild !== state.card.host) state.element.append(state.card.host);
    } else if (state.element.nextElementSibling !== state.card.host) state.element.after(state.card.host);
  }

  function showManual(state) {
    ensureMessageCard(state);
    const card = state.card;
    card.container.classList.add('manual');
    card.heading.hidden = true;
    card.text.hidden = true;
    card.retry.hidden = false;
    card.retry.disabled = !enabled('incoming', true);
    card.retry.textContent = 'Dịch tin này';
    card.retry.title = !settings.openAiKey ? 'Thêm OpenAI API key trong cài đặt' : !settings.enabled ? 'Bật extension trong cài đặt' : 'Chỉ dịch nội dung này khi bạn bấm';
    card.host.hidden = !settings.enabled;
  }

  async function runMessageTranslation(state, manual = false, force = false) {
    clearTimeout(state.timer);
    state.timer = null;
    state.autoEligible = false;
    if (!enabled('incoming', manual) || !state.element.isConnected || !isMessage(state.element)) return false;
    const text = readMessage(state.element);
    const targetLang = settings.incomingTargetLang;
    if (!text) return false;
    if (!force && state.pending?.text === text && state.pending?.lang === targetLang) return false;
    const version = ++state.version;
    state.pending = { text, lang: targetLang };
    state.result = null;
    ensureMessageCard(state);
    showCard(state.card, 'Đang dịch…', targetLang, false, true);
    state.card.retry.hidden = false;
    state.card.retry.disabled = true;
    state.card.retry.textContent = 'Đang dịch…';
    state.card.hint.textContent = manual ? 'Theo yêu cầu' : 'Tin mới · Tự dịch';
    // Every bubble is text to read, including our own sent messages. Only the
    // composer preview uses the outgoing (draft) language and automation switch.
    const response = await translate(text, 'incoming', targetLang, { manual, force });
    if (version !== state.version || !state.element.isConnected || !enabled('incoming', manual) || readMessage(state.element) !== text || settings.incomingTargetLang !== targetLang || !isMessage(state.element)) return false;
    state.pending = null;
    if (response.success && typeof response.data?.translatedText === 'string' && response.data.translatedText.trim()) {
      state.result = { text, lang: targetLang, translated: response.data.translatedText };
      showCard(state.card, response.data.translatedText, targetLang);
      state.card.retry.textContent = 'Dịch lại';
    } else {
      state.result = { text, lang: targetLang, error: response.error || 'Không dịch được tin nhắn.' };
      showCard(state.card, response.error || 'Không dịch được tin nhắn.', targetLang, true);
      state.card.retry.textContent = 'Thử lại';
    }
    state.card.retry.hidden = false;
    state.card.retry.disabled = false;
    return true;
  }

  function updateMessage(state) {
    const text = readMessage(state.element);
    if (!text || !isMessage(state.element)) { if (state.card) state.card.host.hidden = true; return; }
    ensureMessageCard(state);
    if (state.pending) {
      if (state.pending.text === text && state.pending.lang === settings.incomingTargetLang) return;
      state.version++;
      state.pending = null;
    }
    if (state.result?.text === text && state.result.lang === settings.incomingTargetLang) {
      state.card.host.hidden = !settings.enabled;
      state.card.retry.disabled = !enabled('incoming', true);
      return;
    }
    state.result = null;
    showManual(state);
    if (state.autoEligible && enabled('incoming') && !state.timer) {
      // Wait for the site's text rendering to settle before making one API request.
      state.timer = setTimeout(() => runMessageTranslation(state), 180);
    }
  }

  function contextFor(root) {
    const key = platform.conversationKey(root, adapter);
    let context = conversations.get(root);
    if (!context || context.key !== key) {
      const now = Date.now();
      // React/virtual lists can replace the entire root without changing the chat.
      const previous = [...conversations].find(([node, value]) => !node.isConnected && value.key === key);
      context = previous?.[1] || { key, createdAt: now, historyUntil: now + 900, seen: new Set(), known: new WeakMap(), initialized: false, lastTime: null, hasMessages: false };
      if (previous) conversations.delete(previous[0]);
      conversations.set(root, context);
    }
    return context;
  }

  function getDraft(editor) {
    if (editor.matches('textarea, input')) return editor.value;
    return normalizeEditableText(editor.innerText);
  }

  function normalizeEditableText(text) {
    // Rich editors use NBSP and trailing empty paragraphs as layout placeholders.
    return text.replace(/\r\n?/g, '\n').replace(/[\u200b\ufeff]/g, '').replace(/\u00a0/g, ' ').replace(/\n+$/, '');
  }

  async function replaceDraft(editor, text) {
    const original = getDraft(editor);
    const plainInput = editor.matches('textarea, input');
    const expected = plainInput ? text : normalizeEditableText(text);
    editor.focus();
    function selectContents() {
      const selection = editor.getRootNode().getSelection?.() || window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(editor);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    if (plainInput) {
      const prototype = editor.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, 'value').set.call(editor, text);
      editor.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertReplacementText', data: text }));
      editor.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    } else {
      // Keep the site's editor model and its native Undo history in sync.
      selectContents();
      // Some frameworks consume the native event but return false from execCommand.
      // Verify the editor contents after their input handlers have committed.
      try { document.execCommand('insertText', false, text); } catch { /* Try the site's controlled input handler below. */ }
    }
    await new Promise((resolve) => setTimeout(resolve, 80));
    if (editor.isConnected && getDraft(editor) === expected) return true;
    if (!plainInput && editor.isConnected && dom.activeElement() === editor && getDraft(editor) === original) {
      // Let a controlled editor commit through its own input handler. Do not
      // rewrite innerHTML/textContent, which would leave the site's model stale.
      selectContents();
      editor.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, composed: true, cancelable: true, inputType: 'insertText', data: text }));
      await new Promise((resolve) => setTimeout(resolve, 80));
    }
    return editor.isConnected && getDraft(editor) === expected;
  }

  function attachComposer(editor) {
    if (composers.has(editor)) return;
    // Avoid attaching twice to nested editor wrappers.
    if (platform.editors(adapter).some((other) => other !== editor && dom.contains(other, editor))) return;
    const card = createCard('chat-translator-preview', true);
    document.body.appendChild(card.host);
    const listeners = new AbortController();
    let timer;
    let version = 0;
    let composing = false;
    let applying = false;
    let ready = null;
    let appliedText = null;
    let observedDraft = getDraft(editor);

    function position() {
      if (card.host.hidden) return;
      if (dom.activeElement() !== editor && dom.activeElement() !== card.host) {
        card.host.hidden = true;
        return;
      }
      const rect = editor.getBoundingClientRect();
      if (rect.bottom <= 0 || rect.top >= innerHeight || rect.width === 0 || editor.getClientRects().length === 0) {
        card.host.hidden = true;
        return;
      }
      const width = Math.min(Math.max(rect.width, 260), 620, innerWidth - 24);
      card.host.style.width = `${width}px`;
      card.host.style.left = `${Math.max(12, Math.min(rect.left, innerWidth - width - 12))}px`;
      card.host.style.top = `${Math.max(8, rect.top - card.host.offsetHeight - 8)}px`;
    }

    function invalidate() {
      clearTimeout(timer);
      version++;
      ready = null;
      card.host.hidden = true;
      card.retry.hidden = true;
    }

    function schedulePreview(force = false) {
      invalidate();
      const text = getDraft(editor);
      observedDraft = text;
      if (applying || composing || !enabled('outgoing') || !text.trim() || (!force && text === appliedText)) return;
      if (adapter.id === 'linkedin' && platform.isLinkedInCommentEditor(editor) && dom.activeElement() !== editor) return;
      appliedText = null;
      const targetLang = settings.outgoingTargetLang;
      const snapshot = version;
      showCard(card, 'Đang chờ dịch…', targetLang, false, true);
      card.hint.hidden = true;
      position();
      timer = setTimeout(async () => {
        if (snapshot !== version || !editor.isConnected || composing || getDraft(editor) !== text) return;
        showCard(card, 'Đang dịch…', targetLang, false, true);
        const response = await translate(text, 'outgoing', targetLang);
        if (snapshot !== version || !editor.isConnected || composing || !enabled('outgoing') || settings.outgoingTargetLang !== targetLang || getDraft(editor) !== text) return;
        if (response.success && typeof response.data?.translatedText === 'string' && response.data.translatedText.trim()) {
          ready = { original: text, translated: response.data.translatedText, targetLang };
          showCard(card, ready.translated, targetLang);
          card.hint.hidden = false;
        } else {
          showCard(card, response.error || 'Không dịch được nội dung.', targetLang, true);
        }
        position();
      }, 550);
    }

    async function accept(event) {
      if (event.key !== 'Tab' || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey || event.isComposing || composing || applying || !ready || !enabled('outgoing')) return;
      if (ready.original !== getDraft(editor) || ready.targetLang !== settings.outgoingTargetLang) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const replacement = ready.translated;
      const snapshot = version;
      applying = true;
      card.host.hidden = true;
      let replaced = false;
      try { replaced = await replaceDraft(editor, replacement); } catch { /* Display the retry message below. */ }
      applying = false;
      if (snapshot !== version || !editor.isConnected) return;
      if (replaced) {
        appliedText = getDraft(editor);
        observedDraft = appliedText;
        invalidate();
      } else {
        ready = null;
        showCard(card, 'Chưa thay được nội dung. Hãy thử lại.', settings.outgoingTargetLang, true);
        card.hint.hidden = true;
        position();
      }
    }

    editor.addEventListener('input', () => { if (!applying) schedulePreview(); }, { signal: listeners.signal });
    editor.addEventListener('compositionstart', () => { composing = true; invalidate(); }, { signal: listeners.signal });
    editor.addEventListener('compositionend', () => { composing = false; schedulePreview(); }, { signal: listeners.signal });
    editor.addEventListener('keydown', accept, { capture: true, signal: listeners.signal });
    editor.addEventListener('focus', () => {
      if (ready) { card.host.hidden = false; position(); }
      else schedulePreview();
    }, { signal: listeners.signal });
    editor.addEventListener('blur', (event) => {
      if (event.relatedTarget !== card.host) card.host.hidden = true;
    }, { signal: listeners.signal });
    card.retry.addEventListener('mousedown', (event) => event.preventDefault());
    card.retry.addEventListener('click', () => { editor.focus(); schedulePreview(true); });

    const controller = {
      editor, position,
      refresh() { appliedText = null; schedulePreview(); },
      check() {
        if (applying) return;
        if (observedDraft !== getDraft(editor)) schedulePreview();
        else position();
      },
      destroy() { invalidate(); listeners.abort(); card.host.remove(); },
    };
    composers.set(editor, controller);
    if (getDraft(editor).trim()) schedulePreview();
  }

  function scan() {
    clearTimeout(scanTimer);
    scanTimer = null;
    const elements = platform.messages(adapter);
    syncDOMObservers();
    const currentElements = new Set(elements);
    for (const root of platform.getRoots(adapter)) contextFor(root);
    for (const [element, state] of messageStates) {
      if (!element.isConnected || !currentElements.has(element) || !isMessage(element) || state.context !== contextFor(platform.getRoot(element, adapter))) {
        // Keep a live request/result attached to the message identity when the
        // site replaces its text node. A DOM replacement is not a new message.
        const replacement = state.messageId && elements.find((candidate) =>
          candidate !== element && isMessage(candidate) && platform.messageId(candidate, adapter) === state.messageId &&
          contextFor(platform.getRoot(candidate, adapter)) === state.context);
        if (replacement) {
          messageStates.delete(element);
          state.element = replacement;
          messageStates.set(replacement, state);
          continue;
        }
        state.version++;
        clearTimeout(state.timer);
        state.card?.host.remove();
        messageStates.delete(element);
      }
    }
    const groups = new Map();
    for (const element of elements) {
      const root = platform.getRoot(element, adapter);
      if (!groups.has(root)) groups.set(root, []);
      groups.get(root).push(element);
    }
    for (const [root, messages] of groups) {
      const context = contextFor(root);
      let lastKnown = -1;
      let firstKnown = -1;
      messages.forEach((element, index) => {
        const id = platform.messageId(element, adapter);
        if (context.known.has(element) && context.known.get(element) === id || id && context.seen.has(id)) { lastKnown = index; if (firstKnown < 0) firstKnown = index; }
      });
      const reverseOrder = getComputedStyle(root).flexDirection === 'column-reverse';
      const previousTime = context.lastTime;
      for (const [index, element] of messages.entries()) {
        const id = platform.messageId(element, adapter);
        const time = platform.timestamp(element, adapter);
        const alreadySeen = context.known.has(element) && context.known.get(element) === id || Boolean(id && context.seen.has(id));
        const settlingHistory = Date.now() < context.historyUntil;
        const followsAnchor = lastKnown >= 0 ? reverseOrder ? index < firstKnown : index > lastKnown : !context.hasMessages;
        const livePosition = !settlingHistory && followsAnchor;
        const newArrival = context.initialized && !alreadySeen && (time !== null
          ? time >= context.createdAt && (previousTime === null || time > previousTime) || livePosition && time + platform.timestampPrecision(element, adapter) > context.createdAt && (previousTime === null || time >= previousTime)
          : livePosition);
        // A history batch arriving in pieces extends the initial quiet period.
        if (!alreadySeen && settlingHistory && !newArrival) context.historyUntil = Date.now() + 900;
        context.known.set(element, id);
        if (id) context.seen.add(id);
        if (context.seen.size > 3000) context.seen.delete(context.seen.values().next().value);
        if (time !== null) context.lastTime = Math.max(context.lastTime || 0, time);
        if (!isMessage(element)) continue;
        let state = messageStates.get(element);
        if (!state) {
          state = { element, context, messageId: id, autoEligible: newArrival && enabled('incoming'), version: 0, card: null, pending: null, result: null, timer: null };
          messageStates.set(element, state);
        } else if (state.messageId !== id) {
          state.version++;
          clearTimeout(state.timer);
          state.timer = null;
          state.pending = null;
          state.result = null;
          state.messageId = id;
          state.autoEligible = newArrival && enabled('incoming');
        }
        updateMessage(state);
      }
      context.initialized = true;
      context.hasMessages = true;
    }
    for (const [root] of conversations) if (!root.isConnected) conversations.delete(root);
    // Track empty chats as well so their first live message can be detected.
    for (const context of conversations.values()) context.initialized = true;
    const currentEditors = platform.editors(adapter);
    for (const [editor, controller] of composers) {
      if (!editor.isConnected || !currentEditors.includes(editor)) { controller.destroy(); composers.delete(editor); }
      else controller.check();
    }
    currentEditors.forEach(attachComposer);
  }

  function scheduleScan() {
    if (!scanTimer) scanTimer = setTimeout(() => { scanTimer = null; scan(); }, 120);
  }

  function refreshSettings() {
    const previous = settings;
    settings = normalize(rawSettings);
    if (['enabled', 'openAiKey', 'incomingTargetLang', 'autoTranslateIncoming'].some((key) => previous[key] !== settings[key])) {
      for (const state of messageStates.values()) {
        state.version++;
        clearTimeout(state.timer);
        state.timer = null;
        state.autoEligible = false;
        state.pending = null;
        updateMessage(state);
      }
    }
    if (['enabled', 'openAiKey', 'outgoingTargetLang', 'autoTranslateOutgoing'].some((key) => previous[key] !== settings[key])) {
      for (const composer of composers.values()) composer.refresh();
    }
    scheduleScan();
  }

  // Storage changes take effect in already-open chat tabs.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !keys.some((key) => key in changes)) return;
    for (const key of keys) {
      if (key in changes) rawSettings[key] = changes[key].newValue;
    }
    refreshSettings();
  });
  chrome.storage.local.get(keys, (result) => {
    if (chrome.runtime.lastError) return;
    rawSettings = { ...result, ...rawSettings };
    refreshSettings();
    scan();
  });

  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (!['inspectChat', 'translateAllIncoming', 'startMessageDiagnostic'].includes(request?.action)) return false;
    dom.refresh(true);
    scan();
    const available = [...messageStates.values()].filter((state) => state.element.isConnected && readMessage(state.element));
    if (request.action === 'startMessageDiagnostic') {
      sendResponse(ChatTranslatorDiagnostics.start({
        platform: adapter.id,
        roots: platform.getRoots(adapter).length,
        rawCandidates: dom.queryAll(adapter.messages).length,
        filteredCandidates: platform.messages(adapter).length,
        recognizedMessages: available.length,
        composers: composers.size,
        shadowRoots: dom.roots().length - 1,
        iframeCount: dom.queryAll('iframe').length,
        editableCandidates: dom.queryAll(editorSelector).length,
        enabled: settings.enabled,
        keyConfigured: Boolean(settings.openAiKey),
        autoIncoming: settings.autoTranslateIncoming,
        autoOutgoing: settings.autoTranslateOutgoing,
      }, adapter));
      return false;
    }
    if (request.action === 'inspectChat') {
      const commentComposers = adapter.id === 'linkedin' ? [...composers.keys()].filter(platform.isLinkedInCommentEditor).length : 0;
      sendResponse({ success: true, platform: adapter.name, messages: available.length, composers: composers.size, commentComposers, contentVersion: ChatTranslatorDiagnostics.version, shadowRoots: dom.roots().length - 1 });
      return false;
    }
    if (!enabled('incoming', true)) {
      sendResponse({ success: false, error: !settings.openAiKey ? 'Thêm API key và lưu cài đặt trước khi dịch.' : 'Bật extension và lưu cài đặt trước khi dịch.' });
      return false;
    }
    // Translate only messages already loaded by the user; never scroll/load history.
    available.forEach((state) => { runMessageTranslation(state, true, true); });
    sendResponse({ success: true, count: available.length, platform: adapter.name });
    return false;
  });

  // A newly mounted comment or floating-chat field can receive focus before scan.
  function onComposerFocus(event) {
    if (adapter.id !== 'linkedin') return;
    if (dom.refresh(true)) { syncDOMObservers(); scheduleScan(); }
    // A closed root hides the editor from the outside event's composedPath.
    // Resolve the actual active editor before the user's first input arrives.
    const target = dom.activeElement() || event.composedPath().find((node) => node instanceof Element);
    const editor = target && dom.closest(target, editorSelector);
    if (editor && platform.editors(adapter).includes(editor)) attachComposer(editor);
  }

  function syncDOMObservers() {
    const roots = dom.roots();
    for (const [root, observer] of observedRoots) {
      if (roots.includes(root)) continue;
      observer.disconnect();
      root.removeEventListener('focusin', onComposerFocus, true);
      observedRoots.delete(root);
    }
    for (const root of roots) {
      if (observedRoots.has(root)) continue;
      const observer = new MutationObserver(scheduleScan);
      observer.observe(root === document ? document.body : root, observerOptions);
      root.addEventListener('focusin', onComposerFocus, true);
      observedRoots.set(root, observer);
    }
  }

  syncDOMObservers();
  if (adapter.id === 'linkedin') {
    // attachShadow() on an existing host produces no mutation on document.body.
    // Discover newly attached roots, then observe their actual chat mutations.
    setInterval(() => { if (!document.hidden && dom.refresh()) scheduleScan(); }, 750);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) scheduleScan(); });
  }
  window.addEventListener('popstate', scheduleScan);
  window.addEventListener('hashchange', scheduleScan);
  window.addEventListener('resize', () => { composers.forEach((controller) => controller.position()); });
  document.addEventListener('scroll', () => { composers.forEach((controller) => controller.position()); }, { capture: true, passive: true });
})();
