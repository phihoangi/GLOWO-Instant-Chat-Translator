(function () {
  const dom = ChatTranslatorDOM.createScope({ shadow: /(?:^|\.)linkedin\.com$/.test(location.hostname) });
  const commonMessage = '[role="log"] [data-message-text], [role="log"] [data-testid="message-text"], [data-chat-messages] [data-message-text]';
  const commonEditor = '[data-chat-composer] [contenteditable="true"], [data-chat-composer] textarea';
  const commonRoot = '[role="log"], [data-chat-messages]';
  const editable = '[contenteditable="true"], [contenteditable=""], [contenteditable="plaintext-only"], textarea';
  const linkedinChatEditor = '.msg-form [contenteditable="true"], .msg-form textarea, .msg-form__contenteditable[contenteditable="true"], [data-view-name="messaging-compose"] [contenteditable="true"]';
  const linkedinShellSelector = '.msg-thread, .msg-overlay-conversation-bubble, [data-view-name="messaging-conversation"], [data-view-name="messaging-conversation-bubble"], [data-testid="messaging-conversation"]';
  const linkedinListSelector = '.msg-s-message-list, .msg-s-message-list-container, [role="log"], [role="list"], [data-chat-messages]';
  const linkedinRowSelector = '.msg-s-message-list__event, .msg-s-event-listitem, [data-event-urn], [data-message-id], [role="listitem"]';
  const linkedinShellIds = new WeakMap();
  let nextLinkedinShellId = 0;
  let linkedinRoots = [];
  const zaloScope = ':is(#messageViewContainer, #messageView, .message-view)';
  const outgoing = '.message-out, .outgoing, [data-direction="outgoing"], [data-is-self="true"], [data-outgoing="true"], [data-sender="self"]';
  const platforms = [
    {
      id: 'linkedin', name: 'LinkedIn', hosts: ['linkedin.com'],
      messages: '.msg-s-event-listitem__body, .msg-s-event__content, .msg-s-event-listitem__message-bubble, .msg-s-message-list__event [data-message-text], [data-view-name="message-bubble"], [data-view-name="messaging-message"]',
      roots: '.msg-s-message-list, .msg-s-message-list-container, [data-view-name="messaging-conversation"]',
      rows: '.msg-s-message-list__event, .msg-s-event-listitem, [data-event-urn], [data-message-id]',
      editors: `${linkedinChatEditor}, ${editable}`,
      own: '.msg-s-message-group--is-self, .msg-s-event-listitem--self, .msg-s-event-listitem--outgoing, .msg-s-message-list__event--outgoing',
      headers: '.msg-entity-lockup__entity-title, .msg-overlay-bubble-header__title, [data-testid="conversation-title"], header [role="heading"], header h2, header h3, header a[href*="/in/"]',
      shells: linkedinShellSelector,
      metadata: 'header, time, [role="heading"], [role="status"], [role="alert"], [role="button"], .msg-s-event-listitem__timestamp, .msg-s-message-group__profile-link',
    },
    {
      id: 'whatsapp', name: 'WhatsApp', hosts: ['web.whatsapp.com'],
      messages: '#main .message-in .selectable-text, #main .message-out .selectable-text, #main [data-testid="selectable-text"], #main [data-pre-plain-text]',
      roots: '[data-testid="conversation-panel-messages"], #main [role="application"], #messages',
      rows: '.message-in, .message-out, [data-id]',
      editors: '#main footer [contenteditable="true"][role="textbox"], #main footer [contenteditable="true"][data-testid="conversation-compose-box-input"]',
      headers: '#main header [data-testid="conversation-info-header-chat-title"], #main header span[dir="auto"], #main header [title], #main header', shells: '#main',
    },
    {
      id: 'messenger', name: 'Messenger', hosts: ['facebook.com', 'messenger.com'],
      // messages_table may mark the gridcell inside a row, not the whole list.
      messages: '[data-scope="messages_table"] [dir="auto"], [role="grid"] [role="row"] [role="gridcell"] [dir="auto"], [role="grid"] [role="row"] [data-message-text], [data-testid="message-container"] [dir="auto"], .html-div[dir="auto"]',
      roots: '[data-scope="messages_table"], [role="grid"]', rows: '[role="row"], [data-message-id]',
      editors: '[data-testid="mwchat-tab"] [contenteditable="true"][role="textbox"], [role="main"] [contenteditable="true"][role="textbox"], [role="dialog"] [contenteditable="true"][role="textbox"][data-lexical-editor="true"]',
      headers: '[data-testid="conversation-title"], [role="main"] h1, [role="main"] h2, [role="dialog"] h2, [data-testid="mwchat-tab"] h2', shells: '[data-testid="mwchat-tab"], [role="main"], [role="dialog"]',
      metadata: '[role="button"], time, [role="status"], [role="alert"]',
      alignBubbles: true,
    },
    {
      id: 'zalo', name: 'Zalo Web', hosts: ['chat.zalo.me'],
      // Modern Zalo uses custom span-15/div-15 tags and may omit card--text.
      // https://github.com/ncdai/zadark/blob/main/src/core/js/zadark-translate.js
      messages: `[data-component="message-text-content"], ${zaloScope} [data-component="text-container"], ${zaloScope} .card :is(.text-message__container, .text, .text-message, span-15, div-15), ${zaloScope} .card--text, ${zaloScope} .chat-message .message-content`,
      roots: '#messageViewContainer, #messageView, .message-view', rows: '.chat-message, .msg-item, .card',
      editors: '#richInput[contenteditable="true"], #chatInput[contenteditable="true"], .chat-input [contenteditable="true"], .chat-input textarea',
      own: '.card.me, .chat-message.me, .chat-message--outgoing',
      alignBubbles: true,
      headers: '.chat-header .name, .header-title .content, .header-title, .chat-info__header__title, [data-testid="conversation-title"]', shells: '#chatView, #chat-view, .chat-view',
      messageExclusions: '.quote-base, .quote-file, .file-message__container, .file-message__content-container, .card--file, .card--sticker, .card--undo',
      metadata: '.message-reaction-container, .reacts-list, .chat-message__actions, .card-send-status',
    },
    {
      id: 'telegram', name: 'Telegram', hosts: ['web.telegram.org'],
      messages: '.bubbles .bubble .message, .messages-container .Message .text-content, #message-list .Message .text-content, .MessageList .Message .text-content',
      roots: '.bubbles, .messages-container, #message-list, .MessageList', rows: '.bubble, .Message',
      editors: '.input-message-input[contenteditable="true"], #editable-message-text[contenteditable="true"], .Composer [contenteditable="true"][role="textbox"]',
      own: '.bubble.is-out, .Message.own, .Message.is-outgoing',
      headers: '.chat-info .peer-title, .chat-info .title, .middle-header .title, [data-testid="conversation-title"]', shells: '.chat, #MiddleColumn, .middle-column',
    },
    {
      id: 'teams', name: 'Teams', hosts: ['teams.microsoft.com', 'teams.live.com', 'teams.cloud.microsoft'],
      messages: '[data-tid="chat-pane-message"] [id^="content-"], [data-tid="chat-pane-message"] [data-tid="message-body"], [data-tid="message-list-item"] [data-tid="message-content"], [data-tid="message-group-container"] [data-tid="message-body"], .ts-message-list .ts-message-content',
      roots: '[data-tid="thread-body-scrollable-content"], [data-tid="chat-pane-message-list"], [data-tid="scrollable-thread-body"], .ts-message-list',
      rows: '[data-tid="chat-pane-message"], [data-tid="message-list-item"], [data-tid="message-group-container"]',
      editors: '[data-tid="ckeditor"] [contenteditable="true"], [data-tid="ckeditor"][contenteditable="true"], [data-tid="message-editor"][contenteditable="true"], [data-tid="new-message-textarea"] [contenteditable="true"], [data-tid="compose-box"] [contenteditable="true"], [role="textbox"][contenteditable="true"][data-placeholder*="message" i]',
      headers: '[data-tid="chat-header-title"], [data-tid="conversation-title"]', shells: '[data-tid="chat-pane"], [data-tid="thread-view"]',
      selfNames: '[data-tid="me-control-menu-displayname"], [data-current-user-name]',
    },
    {
      id: 'discord', name: 'Discord', hosts: ['discord.com'],
      messages: '[data-list-id="chat-messages"] [id^="message-content-"], [role="log"] [id^="message-content-"]',
      roots: '[data-list-id="chat-messages"]', rows: '[id^="chat-messages-"], [data-list-item-id*="chat-messages"]',
      editors: '[data-slate-editor="true"][role="textbox"], [role="textbox"][contenteditable="true"][aria-label*="Message" i], [role="textbox"][contenteditable="true"][aria-label*="Nhắn" i]',
      selfNames: '[class*="panels"] [class*="nameTag"] [class*="username"], [class*="panels"] [class*="title"], [data-current-user-name]',
    },
  ];

  const exclusions = '.chat-translator-incoming, .chat-translator-preview, .chat-translator-diagnostic, [data-testid="quoted-message"], [data-testid="quoted-message-text"], .quoted-message, .quote-banner, .reply, .reply-wrapper, [class*="repliedMessage"], [data-tid="quoted-reply"]';
  const metadata = '.time, .message-time, .card-send-time, .card-sender-name, .msg-s-message-group__name, .msg-s-message-group__timestamp, [data-tid="message-timestamp"], [class*="edited"], [data-message-metadata], button';
  function resolve(hostname) {
    const entry = platforms.find((platform) => platform.hosts.some((host) => hostname === host || hostname.endsWith(`.${host}`))) || { id: 'generic', name: 'Web chat' };
    return {
      ...entry,
      messages: [entry.messages, commonMessage].filter(Boolean).join(', '),
      editors: [entry.editors, commonEditor].filter(Boolean).join(', '),
      roots: [entry.roots, commonRoot].filter(Boolean).join(', '),
      rows: [entry.rows, '[data-message-id], [data-id], [data-mid]'].filter(Boolean).join(', '),
      own: [entry.own, outgoing].filter(Boolean).join(', '),
    };
  }

  function getRoots(adapter) {
    if (adapter.id === 'messenger') {
      return [...document.querySelectorAll(adapter.shells)].filter((shell) => messengerShell(shell, adapter) === shell);
    }
    const roots = dom.queryAll(adapter.roots);
    if (adapter.id === 'linkedin') {
      const shells = dom.queryAll(adapter.shells);
      for (const editor of dom.queryAll(editable)) {
        const shell = linkedinShell(editor);
        if (shell) shells.push(shell);
      }
      // A popup remains the same conversation when its transcript is remounted,
      // and can be observed even while its transcript is still empty.
      const uniqueShells = [...new Set(shells)];
      linkedinRoots = [...uniqueShells, ...roots.filter((root) => root.matches('.msg-s-message-list, .msg-s-message-list-container') && !uniqueShells.some((shell) => dom.contains(shell, root)))];
      return linkedinRoots;
    }
    if (adapter.id === 'zalo') {
      // Component-marked Zalo messages can outlive the legacy list classes. A
      // composer gives a stable conversation scope even before its first message.
      for (const editor of editors(adapter)) {
        roots.push(editor.closest(`${adapter.shells}, main, [role="main"]`) || document.body);
      }
    }
    return [...new Set(roots)];
  }

  function getRoot(element, adapter) {
    if (adapter.id === 'linkedin') {
      // messages() refreshes these scopes at the start of each scan. Reuse them
      // instead of examining scrolling styles again for every message in a chat.
      const shell = dom.closest(element, linkedinShellSelector) || linkedinRoots.find((root) => root.isConnected && dom.contains(root, element)) || linkedinShell(element);
      if (shell) return shell;
    }
    if (adapter.id === 'messenger') {
      const shell = messengerShell(element, adapter);
      if (shell) return shell;
    }
    if (adapter.id === 'zalo' && element.closest('[data-component="message-text-content"]')) {
      // Use the composer scope consistently for the new component layout, even
      // if a legacy list class comes and goes during a render. Switching roots
      // would otherwise turn the same old messages into apparently new arrivals.
      for (const editor of editors(adapter)) {
        const scope = editor.closest(`${adapter.shells}, main, [role="main"]`) || document.body;
        if (scope.contains(element)) return scope;
      }
    }
    let root = element.closest(adapter.roots);
    while (root) {
      // Zalo also puts data-id on its chat container; that is not a message row.
      const isRow = adapter.id === 'zalo' ? root.matches('.chat-message, .msg-item, .card') : root.matches(adapter.rows);
      // WhatsApp also uses role=application inside an individual message.
      const insideBubble = adapter.id === 'whatsapp' && root.closest('.message-in, .message-out');
      if (!isRow && root !== element && !insideBubble) break;
      root = root.parentElement?.closest(adapter.roots);
    }
    if (root) return root;
    const semantic = element.closest('[role="list"], [role="grid"], ul, ol') || element.closest(adapter.shells || '[data-chat-conversation]');
    if (semantic) return semantic;
    if (adapter.id === 'zalo') {
      const inferred = getRoots(adapter).find((scope) => scope.contains(element));
      if (inferred) return inferred;
    }
    return element.parentElement;
  }

  function conversationKey(root, adapter) {
    const shell = dom.closest(root, adapter.shells || '[data-chat-conversation]') || root;
    // Try specific peer-name selectors before a broad header fallback. Selector-list
    // querySelector uses DOM order, so a header can otherwise mask its title child.
    let header = null;
    for (const selector of (adapter.headers || '').split(',')) {
      if (!selector.trim()) continue;
      header = dom.queryFirst(selector.trim(), shell);
      if (header) break;
    }
    if (!header && adapter.headers && shell === root && adapter.id !== 'linkedin') {
      for (const selector of adapter.headers.split(',')) {
        header = document.querySelector(selector.trim());
        if (header) break;
      }
    }
    const conversationId = root.getAttribute('data-conversation-id') || shell.getAttribute('data-conversation-id') || root.getAttribute('data-peer-id') || '';
    let peer = header?.getAttribute('title') || header?.textContent.trim() || '';
    if (adapter.id === 'linkedin' && !conversationId && !peer) {
      // Unnamed simultaneous popups must not share seen-message IDs. A newly
      // opened anonymous shell gets its own history baseline rather than the
      // title of a different conversation elsewhere on the page.
      if (!linkedinShellIds.has(shell)) linkedinShellIds.set(shell, ++nextLinkedinShellId);
      peer = `popup-${linkedinShellIds.get(shell)}`;
    }
    return [location.pathname, location.hash, conversationId, peer].join('|');
  }

  function messageId(element, adapter) {
    if (adapter.id === 'zalo') {
      const row = element.closest('.chat-message, .msg-item') || element.closest('.card') || element;
      const nodes = [row, element.closest('[data-message-id], [data-msg-id], [data-client-id], [data-mid]'), element.closest('.card'), element].filter(Boolean);
      for (const node of nodes) {
        const id = node.getAttribute('data-message-id') || node.getAttribute('data-msg-id') || node.getAttribute('data-client-id') || node.getAttribute('data-mid') || node.id;
        if (id) return id;
      }
      // The current text-container has its own stable mtc-* message identity.
      const textId = element.querySelector('[data-component="text-container"][id^="mtc-"]')?.id;
      if (textId) return textId;
      for (const node of nodes) {
        const id = node.getAttribute('data-id');
        // Zalo's div_* values identify UI components and repeat across messages.
        if (id && !/^div_/i.test(id)) return id;
      }
      return '';
    }
    const row = element.closest('[data-message-id], [data-event-urn], [data-id], [data-mid], [data-list-item-id]') || element.closest(adapter.rows) || element;
    return row.getAttribute('data-message-id') || row.getAttribute('data-event-urn') || row.getAttribute('data-id') || row.getAttribute('data-mid') || row.getAttribute('data-list-item-id') || row.id || element.id || '';
  }

  function timestamp(element, adapter) {
    const row = element.closest('[data-timestamp], [data-time]') || element.closest(adapter.rows) || element;
    const node = row.matches('[datetime], [data-timestamp]') ? row : row.querySelector('[datetime], [data-timestamp]');
    const value = node?.getAttribute('datetime') || node?.getAttribute('data-timestamp') || row.getAttribute('data-time');
    if (value) {
      const numeric = Number(value);
      const time = Number.isFinite(numeric) ? numeric < 1e12 ? numeric * 1000 : numeric : Date.parse(value);
      if (Number.isFinite(time)) return time;
    }
    // Discord message IDs contain their creation timestamp (not a displayed clock label).
    if (adapter.id === 'discord') {
      const id = messageId(element, adapter).match(/(\d{16,22})$/)?.[1];
      if (id) return Number(BigInt(id) >> 22n) + 1420070400000;
    }
    return null;
  }

  function timestampPrecision(element, adapter) {
    const row = element.closest('[data-timestamp], [data-time]') || element.closest(adapter.rows) || element;
    const node = row.matches('[datetime], [data-timestamp]') ? row : row.querySelector('[datetime], [data-timestamp]');
    const value = node?.getAttribute('datetime') || node?.getAttribute('data-timestamp') || row.getAttribute('data-time');
    if (value && Number.isFinite(Number(value))) return Number(value) < 1e12 ? 1000 : 1;
    return value && !/\.\d{3}/.test(value) ? 1000 : 1;
  }

  function ownMessage(element, adapter) {
    if (element.closest(adapter.own)) return true;
    const row = element.closest('[data-message-id], [data-mid], [data-author-id], [data-sender-id], [id^="chat-messages-"]') || element.closest(adapter.rows) || element;
    const label = row.getAttribute('aria-label') || '';
    if (/^(you sent|you:|bạn đã gửi|bạn:)/i.test(label.trim())) return true;
    const selfId = document.querySelector('[data-current-user-id], [data-self-id]');
    const authorId = row.getAttribute('data-author-id') || row.getAttribute('data-sender-id');
    if (authorId && selfId && authorId === (selfId.getAttribute('data-current-user-id') || selfId.getAttribute('data-self-id'))) return true;
    const ownName = document.querySelector(adapter.selfNames || '[data-current-user-name]')?.textContent.trim();
    const authorSelector = '[id^="message-username-"], [id^="author-"], [data-tid="message-author-name"], [data-author-name]';
    let author = row.querySelector(authorSelector)?.textContent.trim();
    if (!author && adapter.id === 'discord') {
      const referencedAuthor = (row.getAttribute('aria-labelledby') || '').split(/\s+/).find((id) => id.startsWith('message-username-'));
      if (referencedAuthor) author = document.getElementById(referencedAuthor)?.textContent.trim();
      // Compact messages share the author of the preceding header in this list.
      for (let previous = row.previousElementSibling; !author && previous; previous = previous.previousElementSibling) {
        author = previous.querySelector(authorSelector)?.textContent.trim();
      }
    }
    if (ownName && author === ownName) return true;
    if (adapter.alignBubbles) {
      const root = getRoot(element, adapter);
      const box = element.getBoundingClientRect();
      const bounds = root.getBoundingClientRect();
      if (bounds.width && box.width < bounds.width * .85 && box.left + box.width / 2 > bounds.left + bounds.width * .62) return true;
      for (let node = element.parentElement; node && node !== root; node = node.parentElement) {
        if (getComputedStyle(node).justifyContent === 'flex-end') return true;
      }
    }
    return false;
  }

  function messages(adapter) {
    dom.refresh();
    let candidates = dom.queryAll(adapter.messages).filter((element) => !dom.closest(element, exclusions) && !dom.closest(element, editable) && !(adapter.messageExclusions && dom.closest(element, adapter.messageExclusions)));
    if (adapter.id === 'linkedin') {
      const roots = getRoots(adapter);
      const ignored = `${exclusions}, ${metadata}, ${adapter.metadata}, ${editable}, nav, [role="navigation"]`;
      candidates = candidates.filter((element) => roots.some((root) => dom.contains(root, element)) && !dom.closest(element, ignored));
      candidates = candidates.filter((element) => !candidates.some((other) => other !== element && element.contains(other)));
      const inferred = [];
      for (const root of roots) {
        const lists = linkedinTranscripts(root);
        for (const element of dom.queryAll('[data-message-text], [data-testid="message-text"], [data-testid="message-body"], p, [dir="auto"], div', root)) {
          if (dom.closest(element, `${ignored}, a, [role="link"]`)) continue;
          const row = dom.closest(element, linkedinRowSelector);
          if (!lists.some((list) => dom.contains(list, element)) && !(row && dom.contains(root, row))) continue;
          const marked = element.matches('[data-message-text], [data-testid="message-text"], [data-testid="message-body"]');
          // pre-wrap can be inherited by the entire transcript or message row;
          // neither is a text body, even when it contains only one old message.
          if (lists.includes(element) || !marked && (element.matches(linkedinRowSelector) || element.querySelector(linkedinRowSelector))) continue;
          if (!marked && !element.matches('p, [dir="auto"]') && getComputedStyle(element).whiteSpace !== 'pre-wrap') continue;
          const textOnly = element.cloneNode(true);
          textOnly.querySelectorAll(ignored).forEach((node) => node.remove());
          if (!textOnly.textContent.trim()) continue;
          const parent = element.parentElement;
          const siblings = element.matches('p') && row && parent !== row && row.contains(parent)
            ? [...parent.children].filter((child) => !child.matches(ignored)) : [];
          // Several paragraphs in one rich-text body share one message identity.
          // Combine only within a known row, never across transcript paragraphs.
          const body = siblings.filter((child) => child.matches('p')).length > 1 && siblings.every((child) => child.matches('p, br')) ? parent : element;
          inferred.push(body);
        }
      }
      const bodies = [...new Set([...candidates, ...inferred])];
      // Retain complete rich-text bodies, not separate translations for each
      // inline span or paragraph inside a pre-wrap message.
      return bodies.filter((element) => !bodies.some((other) => other !== element && other.contains(element)));
    }
    if (adapter.id === 'messenger') {
      candidates = candidates.filter((element) => {
        if (!messengerShell(element, adapter) || element.closest(`${metadata}, ${adapter.metadata}, a, [role="link"], header, h1, h2, h3, [role="heading"], nav, aside, [role="navigation"], [role="complementary"]`)) return false;
        const structured = element.closest('[data-scope="messages_table"], [data-testid="message-container"], [role="row"], [data-message-text]');
        // Without any list/row hooks, require the message's plaintext formatting;
        // ordinary interface html-divs must not turn into automatic API calls.
        return Boolean(structured) || element.matches('.html-div') && getComputedStyle(element).whiteSpace === 'pre-wrap';
      });
      const rows = new Map();
      for (const element of candidates) {
        const row = element.closest(adapter.rows) || element.closest('[data-testid="message-container"]') || element.parentElement;
        if (!rows.has(row)) rows.set(row, []);
        rows.get(row).push(element);
      }
      candidates = [...rows.values()].flatMap((elements) => {
        const bodies = elements.filter((element) => element.matches('.html-div') || getComputedStyle(element).whiteSpace === 'pre-wrap');
        return bodies.length ? bodies : elements;
      });
      // Keep a whole formatted body, including its inline spans and line breaks.
      return candidates.filter((element) => !candidates.some((other) => other !== element && other.contains(element)));
    }
    if (adapter.id === 'zalo') {
      candidates = candidates.filter((element) => !element.closest([metadata, adapter.metadata].filter(Boolean).join(', ')));
      // One body per bubble: don't translate each inline custom tag separately or
      // mistake a quoted message for the current body. Keep all formatted lines.
      candidates = [...new Set(candidates.map((element) => {
        const markedBody = element.closest('[data-component="message-text-content"]');
        if (markedBody) return markedBody;
        const card = element.closest('.card');
        if (!card) return element;
        const body = [...card.querySelectorAll('.text-message__container, [data-component="message-text-content"]')].find((node) =>
          node.closest('.card') === card && !node.closest([exclusions, adapter.messageExclusions].filter(Boolean).join(', ')));
        return body || card;
      }))];
    }
    // Prefer the text leaf when multiple compatible layouts match one bubble.
    return candidates.filter((element) => !candidates.some((other) => other !== element && element.contains(other)));
  }

  function editors(adapter) {
    return dom.queryAll(adapter.editors).filter((element) => {
      if (adapter.id === 'linkedin') return isLinkedInChatEditor(element) || isLinkedInCommentEditor(element);
      if (adapter.id !== 'messenger') return true;
      const label = [element.getAttribute('aria-label'), element.getAttribute('aria-placeholder'), element.getAttribute('data-placeholder')].filter(Boolean).join(' ');
      if (/comment|bình luận|write a post|viết bài|search|tìm kiếm/i.test(label)) return false;
      return Boolean(messengerShell(element, adapter));
    });
  }

  function isLinkedInCommentEditor(element) {
    if (!element.matches(editable) || !element.isContentEditable && !element.matches('textarea') || element.matches(':disabled, [readonly]')) return false;
    if (isLinkedInChatEditor(element)) return false;
    // Message quotation exclusions such as .reply do not apply to reply editors.
    if (dom.closest(element, '.chat-translator-incoming, .chat-translator-preview, .chat-translator-diagnostic, nav, aside, [role="navigation"], [role="complementary"], .share-creation-state, .share-creation-state__text-editor, .msg-form, .msg-form__contenteditable, [data-view-name="messaging-compose"], [data-chat-composer]')) return false;
    const attributes = ['aria-label', 'aria-placeholder', 'data-placeholder', 'placeholder', 'title'];
    const label = [element, dom.closest(element, 'form')].filter(Boolean).flatMap((node) => attributes.map((attribute) => node.getAttribute(attribute) || '')).join(' ');
    if (/search|tìm kiếm|profile|headline|creating content|creating post|write a post|talk about|viết bài/i.test(label)) return false;
    if (dom.closest(element, '.comments-comment-box, .comments-comment-texteditor, .comments-comment-box__form-container, .comments-comment-item .mentions-texteditor__content')) return true;
    if (/comment|bình luận|binh luan|reply|trả lời|tra loi|répond|coment|antwort|kommentar|评论|留言|回复|コメント|返信|댓글|답글/i.test(label)) return true;
    // New LinkedIn layouts may have hashed classes and no label on the editor.
    // An editable inside a feed item is a comment/reply, after post/profile
    // editors have been excluded above. Never use all textboxes on the site.
    if (dom.closest(element, '[data-testid="mainFeed"], .feed-shared-update-v2, [data-urn^="urn:li:activity:"]')) return true;
    return /^\/(?:feed\/update|posts)\//.test(location.pathname) && Boolean(dom.closest(element, 'main, [role="main"]') && dom.closest(element, 'form'));
  }

  function linkedinEditorLabel(element) {
    const attributes = ['aria-label', 'aria-placeholder', 'data-placeholder', 'placeholder', 'title'];
    return [element, dom.closest(element, 'form')].filter(Boolean).flatMap((node) => attributes.map((attribute) => node.getAttribute(attribute) || '')).join(' ').trim();
  }

  function linkedinMessageEditor(element, scope) {
    if (!element.matches(editable) || !element.isContentEditable && !element.matches('textarea') || element.matches(':disabled, [readonly]')) return false;
    const label = linkedinEditorLabel(element);
    if (/search|tìm kiếm|comment|bình luận|reply|trả lời|profile|headline|creating content|creating post|write a post|talk about|viết bài/i.test(label)) return false;
    if (element.matches(`${linkedinChatEditor}, ${commonEditor}`)) return true;
    if (/message|messag|tin nhắn|tin nhan|nhắn tin|nhan tin|nachricht|mensaje|mensagem|メッセージ|메시지|消息/i.test(label)) return true;
    if (!scope) return false;
    if (scope.matches(linkedinShellSelector)) return true;
    // Some editors show a CSS placeholder without an accessible label. Require
    // a Send control within the same conversation, never a button on the feed.
    return !label && dom.queryAll('button, [role="button"]', scope).some((button) =>
      /^(send|gửi)(?:\s+message|\s+tin nhắn)?(?:\s*\([^)]*\))?$/i.test((button.getAttribute('aria-label') || button.textContent).trim()));
  }

  function linkedinTranscripts(scope) {
    const lists = dom.queryAll(linkedinListSelector, scope);
    if (scope.matches(linkedinListSelector)) lists.push(scope);
    for (const node of dom.queryAll('div, section, ul, ol', scope)) {
      if (dom.closest(node, `${editable}, ${exclusions}, header, nav`)) continue;
      if (/^(auto|scroll)$/.test(getComputedStyle(node).overflowY)) lists.push(node);
    }
    return [...new Set(lists)];
  }

  function linkedinShell(element) {
    const known = dom.closest(element, linkedinShellSelector);
    if (known) return known;
    let conversation = null;
    for (let node = element; node && node !== document.body; node = dom.parent(node)) {
      if (node.matches('main, [role="main"], [data-testid="mainFeed"], .feed-shared-update-v2, nav, [role="navigation"]')) break;
      if (!conversation && dom.queryFirst(editable, node) && linkedinTranscripts(node).length &&
          dom.queryAll(editable, node).some((editor) => linkedinMessageEditor(editor, node))) conversation = node;
      // The nearest transcript + composer container may sit inside a larger
      // fixed dock containing several conversations. Keep the smaller scope.
      if (conversation && (node.matches('[role="dialog"]') || ['fixed', 'absolute'].includes(getComputedStyle(node).position))) return conversation;
    }
    return null;
  }

  function isLinkedInChatEditor(element) {
    if (dom.closest(element, '.chat-translator-incoming, .chat-translator-preview, .chat-translator-diagnostic, nav, [role="navigation"]')) return false;
    const shell = linkedinShell(element);
    return linkedinMessageEditor(element, shell) && (Boolean(shell) || element.matches(`${linkedinChatEditor}, ${commonEditor}`));
  }

  function messengerShell(element, adapter) {
    if (element.closest('nav, aside, [role="navigation"], [role="complementary"]')) return null;
    const fullChat = location.hostname === 'messenger.com' || location.hostname.endsWith('.messenger.com') || /^\/messages(?:\/|$)/.test(location.pathname);
    let shell = element.closest(adapter.shells);
    while (shell) {
      if (shell.matches('[data-testid="mwchat-tab"]')) return shell;
      if (shell.matches('[role="dialog"]')) {
        // Do not climb out of an unrelated modal into the chat/feed underneath.
        return shell.querySelector('[data-scope="messages_table"], [data-testid="message-container"]') ? shell : null;
      }
      if (fullChat && shell.matches('[role="main"]')) return shell;
      shell = shell.parentElement?.closest(adapter.shells);
    }
    return null;
  }

  globalThis.ChatTranslatorPlatforms = Object.freeze({ dom, platforms, resolve, messages, editors, isLinkedInCommentEditor, getRoot, getRoots, conversationKey, messageId, timestamp, timestampPrecision, ownMessage, exclusions, metadata });
})();
