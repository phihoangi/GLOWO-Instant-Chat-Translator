const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, mkdirSync } = require('node:fs');
const { join } = require('node:path');
const { chromium } = require('@playwright/test');
let browser;
before(async () => { browser = await chromium.launch({ channel: 'chrome', headless: true }); });
after(async () => { await browser?.close(); });
const artifacts = join(__dirname, 'artifacts');

const linkedinFeed = `<main><article class="feed-shared-update-v2" data-urn="urn:li:activity:synthetic-post">
  <header>Synthetic author · Synthetic role</header>
  <div class="feed-shared-inline-show-more-text"><div id="post-body" class="update-components-text update-components-update-v2__commentary"><span>Hiring <a href="https://example.test/job">engineers</a><br>Remote 🌍</span><button>See more</button></div></div>
  <button>Like</button><span>4 reactions</span>
  <article class="comments-comment-item" data-id="synthetic-comment"><header>Synthetic commenter · 2h</header><div id="comment-body" class="comments-comment-item-content-body"><div class="update-components-text">Interested!<br>Thank you 😊</div></div><button>Reply</button></article>
  <div class="comments-comment-box"><form><div class="comments-comment-texteditor"><div id="comment-editor" class="ql-editor" contenteditable="true" role="textbox"></div></div><button type="submit">Comment</button></form></div>
</article><div class="share-creation-state"><form><div class="share-creation-state__text-editor"><div id="post-editor" class="ql-editor" contenteditable="true" role="textbox"></div></div><button type="submit">Post</button></form></div>
<input id="search"><div id="profile-editor" contenteditable="true" role="textbox">Synthetic profile bio</div></main>`;

test('linkedin comments only: published feed and post composer stay untouched; floating chat still auto-translates', async () => {
  const page = await pageFor('linkedin', {}, { url: 'https://www.linkedin.com/feed/', html: linkedinFeed + '<section class="msg-s-message-list" id="messages"><p class="msg-s-event-listitem__body">Synthetic chat history</p></section><form class="msg-form"><div contenteditable="true" role="textbox"></div></form>' });
  try {
    const inspection = await page.evaluate(() => window.command({ action: 'inspectChat' }));
    assert.equal(inspection.composers, 2, 'only chat and comment composer should be attached');
    assert.equal(await page.locator('[data-translation-kind]').count(), 0);
    await page.waitForTimeout(1100);
    await page.evaluate(() => document.querySelector('main').insertAdjacentHTML('beforeend', '<article class="feed-shared-update-v2"><div class="update-components-update-v2__commentary">Lazy synthetic post</div><div class="comments-comment-item-content-body">Lazy synthetic comment</div></article>'));
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => window.calls.length), 0);
    await page.locator('#post-editor').fill('Synthetic post draft');
    await page.locator('#profile-editor').fill('Synthetic biography');
    await page.waitForTimeout(700);
    assert.equal(await page.evaluate(() => window.calls.length), 0);
    await page.evaluate(() => document.querySelector('#messages').insertAdjacentHTML('beforeend', '<p class="msg-s-event-listitem__body">Synthetic live chat</p>'));
    await page.waitForFunction(() => window.calls.length === 1);
    assert.equal(await page.evaluate(() => window.calls[0].text), 'Synthetic live chat');
  } finally { await page.close(); }
});

for (const [kind, html] of [
  ['Quill comment', '<div class="comments-comment-box"><form><div class="comments-comment-texteditor"><div id="draft" class="ql-editor" contenteditable="true"></div></div><button type="submit">Comment</button></form></div>'],
  ['reply textarea', '<article class="comments-comment-item"><div class="comments-comment-box"><form><textarea id="draft"></textarea><button type="submit">Reply</button></form></div></article>'],
  ['nested Reply panel', '<article class="comments-comment-item"><div class="reply"><div class="comments-comment-box"><form><div id="draft" contenteditable="true"></div><button type="submit">Reply</button></form></div></div></article>'],
  ['semantic comment', '<form><div id="draft" contenteditable="true" role="textbox" aria-label="Text editor for creating comment"></div><button type="submit">Comment</button></form>'],
  ['localized placeholder', '<main><form><div id="draft" contenteditable="true" data-placeholder="Thêm bình luận…"></div><button type="submit">Bình luận</button></form></main>'],
  ['aria placeholder reply', '<main><form><div id="draft" contenteditable="true" aria-placeholder="Write a reply…"></div><button type="submit">Reply</button></form></main>'],
  ['hashed feed editor', '<main><div data-testid="mainFeed"><div role="listitem"><p data-testid="expandable-text-box">Synthetic post</p><form><div id="draft" class="_synthetic_hash" contenteditable="true" data-lexical-editor="true"></div><button type="submit">Comment</button></form></div></div></main>'],
  ['permalink plaintext editor', '<main><article><p data-testid="expandable-text-box">Synthetic post</p><form><div id="draft" contenteditable="plaintext-only"></div><button type="submit">Comment</button></form></article></main>'],
  ['legacy empty attribute', '<div class="comments-comment-texteditor"><form><div id="draft" class="mentions-texteditor__content" contenteditable=""></div><button type="submit">Reply</button></form></div>'],
]) {
  test('linkedin comment ' + kind + ': shared chat preview, Tab replacement and no submission', async () => {
    const page = await pageFor('linkedin', { incomingTargetLang: 'vi', outgoingTargetLang: 'ja' }, { url: kind.startsWith('permalink') ? 'https://www.linkedin.com/posts/synthetic-post' : 'https://www.linkedin.com/feed/', html });
    try {
      const editor = page.locator('#draft');
      await editor.fill('Nội dung tổng hợp');
      await page.waitForFunction(() => document.querySelector('.chat-translator-preview')?.shadowRoot.querySelector('.translation').textContent === 'ja: Nội dung tổng hợp', null, { timeout: 2500 });
      await editor.press('Tab');
      await page.waitForFunction(() => { const e = document.querySelector('#draft'); return (e.value ?? e.innerText) === 'ja: Nội dung tổng hợp'; }, null, { timeout: 2500 });
      assert.equal(await page.evaluate(() => window.sent), 0);
      assert.equal(await page.evaluate(() => window.calls[0].mode), 'outgoing');
      if (await editor.getAttribute('contenteditable') !== null) {
        await editor.press('Control+z');
        assert.equal(await editor.innerText(), 'Nội dung tổng hợp');
      }
    } finally { await page.close(); }
  });
}

test('linkedin comment added on focus: Tab beats site bubble handler and controlled beforeinput replaces text', async () => {
  const page = await pageFor('linkedin', {}, { url: 'https://www.linkedin.com/feed/', html: '<main><div data-testid="mainFeed"><div role="listitem" id="post"></div></div></main>' });
  try {
    await page.evaluate(() => {
      document.querySelector('#post').innerHTML = '<form><div id="draft" contenteditable="true" role="textbox" aria-label="Viết bình luận"></div></form>';
      const editor = document.querySelector('#draft');
      editor.addEventListener('keydown', (event) => { if (event.key === 'Tab') window.sent++; });
      document.execCommand = () => false;
      editor.addEventListener('beforeinput', (event) => {
        if (event.inputType === 'insertText' && event.data.startsWith('en: ')) { event.preventDefault(); editor.textContent = event.data; editor.dispatchEvent(new InputEvent('input', { bubbles: true })); }
      });
      editor.focus();
    });
    await page.locator('#draft').fill('Xin chào tổng hợp');
    await page.waitForFunction(() => document.querySelector('.chat-translator-preview')?.shadowRoot.querySelector('.translation').textContent === 'en: Xin chào tổng hợp', null, { timeout: 2500 });
    await page.locator('#draft').press('Tab');
    await page.waitForFunction(() => document.querySelector('#draft').innerText === 'en: Xin chào tổng hợp', null, { timeout: 2500 });
    assert.equal(await page.evaluate(() => window.sent), 0);
  } finally { await page.close(); }
});

test('linkedin comment: placeholder hooks added later attach; unrelated and inactive drafts never translate', async () => {
  const page = await pageFor('linkedin', {}, { url: 'https://www.linkedin.com/feed/', html: '<main><div id="draft" contenteditable="true"></div><div contenteditable="true" aria-label="Add a comment">Synthetic saved comment draft</div><div contenteditable="true" aria-label="Edit profile headline">Synthetic headline</div></main><nav><div contenteditable="true" aria-label="Search comments">Synthetic search</div></nav>' });
  try {
    await page.waitForTimeout(800);
    assert.equal(await page.evaluate(() => window.calls.length), 0);
    await page.evaluate(() => document.querySelector('#draft').setAttribute('aria-placeholder', 'Add a comment…'));
    await page.waitForTimeout(200);
    const inspection = await page.evaluate(() => window.command({ action: 'inspectChat' }));
    assert.equal(inspection.composers, 2);
    await page.locator('#draft').fill('Synthetic active comment');
    await page.waitForFunction(() => window.calls.length === 1, null, { timeout: 2500 });
    assert.equal(await page.evaluate(() => window.calls[0].text), 'Synthetic active comment');
  } finally { await page.close(); }
});

async function pageFor(platform = 'whatsapp', settings = {}, fixture = {}) {
  const page = await browser.newPage();
  const html = fixture.html || (platform === 'whatsapp'
    ? `<div id="main"><header>Test chat</header><section id="messages"><div class="message-in"><div class="copyable-text"><span class="selectable-text">Hello synthetic friend</span></div></div><div class="message-out"><span class="selectable-text">Own synthetic message</span></div></section><footer><div contenteditable="true" role="textbox"></div></footer></div><input id="search" placeholder="Search">`
    : platform === 'linkedin'
      ? `<section id="messages" class="msg-s-message-list"><div class="msg-s-message-group"><p class="msg-s-event-listitem__body">Hello synthetic friend</p></div><div class="msg-s-message-group--is-self"><p class="msg-s-event-listitem__body">Own synthetic message</p></div></section><form class="msg-form"><div class="msg-form__contenteditable" contenteditable="true" role="textbox"></div><button id="send" type="button">Send</button></form><input id="search" placeholder="Search">`
      : `<section id="messages" role="log"><article data-message-id="old-1" data-direction="incoming"><div data-message-text>Hello synthetic friend</div></article><article data-message-id="own-1" data-direction="outgoing"><div data-message-text>Own synthetic message</div></article></section><form data-chat-composer><div contenteditable="true" role="textbox" aria-label="Message"></div></form><input id="search" placeholder="Search">`);
  await page.route('**/*', (route) => route.fulfill({ contentType: 'text/html; charset=utf-8', body: `<html><head></head><body>${html}</body></html>` }));
  await page.goto(fixture.url || (platform === 'whatsapp' ? 'https://web.whatsapp.com/' : platform === 'linkedin' ? 'https://www.linkedin.com/messaging/' : 'https://chat.example.test/'));
  await page.evaluate((initial) => {
    window.calls = [];
    window.pending = [];
    window.hold = false;
    window.fail = false;
    window.settings = { openAiKey: 'synthetic-test-key', ...initial };
    window.changeSettings = (changes) => {
      Object.assign(window.settings, changes);
      window.storageListener(Object.fromEntries(Object.entries(changes).map(([key, newValue]) => [key, { newValue }])), 'local');
    };
    window.chrome = {
      storage: {
        local: { get: (_keys, cb) => cb(window.settings) },
        onChanged: { addListener: (cb) => { window.storageListener = cb; } },
      },
      runtime: { onMessage: { addListener: (listener) => { window.contentListener = listener; } }, sendMessage: (request, cb) => {
        window.calls.push(request.payload);
        const finish = () => cb(window.fail ? { success: false, error: 'Synthetic API error' } : { success: true, data: { translatedText: `${request.payload.targetLang}: ${request.payload.text}`, detectedLanguage: 'en' } });
        if (window.hold) window.pending.push(finish); else setTimeout(finish, 30);
      } },
    };
    window.command = (request) => new Promise((resolve) => window.contentListener(request, {}, resolve));
    window.sent = 0;
    document.querySelector('form')?.addEventListener('submit', (event) => { event.preventDefault(); window.sent++; });
  }, settings);
  if (fixture.setup) await fixture.setup(page);
  await page.addScriptTag({ path: join(__dirname, '../shared/settings.js') });
  await page.addScriptTag({ path: join(__dirname, '../shared/dom.js') });
  await page.addScriptTag({ path: join(__dirname, '../shared/platforms.js') });
  await page.addScriptTag({ path: join(__dirname, '../content/diagnostics.js') });
  await page.addStyleTag({ path: join(__dirname, '../content/styles.css') });
  await page.addScriptTag({ path: join(__dirname, '../content/content.js') });
  return page;
}

for (const kind of ['open', 'closed', 'nested composer']) {
  test(`linkedin shadow ${kind}: recognizes popup, observes live messages, shows preview and accepts Tab`, async () => {
    const html = '<section class="msg-overlay-conversation-bubble"><header><h2>Synthetic shadow peer</h2></header><div class="msg-s-message-list" id="shadow-messages"><article data-message-id="shadow-old"><p class="msg-s-event-listitem__body">Synthetic shadow history</p></article></div><form class="msg-form"><div id="composer-host"><div id="shadow-draft" class="msg-form__contenteditable" contenteditable="true" role="textbox" aria-label="Viết tin nhắn…"></div></div><button type="submit">Gửi</button></form></section>';
    const page = await pageFor('linkedin', { incomingTargetLang: 'vi', outgoingTargetLang: 'ja' }, { url: 'https://www.linkedin.com/feed/', html: '<main><p>Synthetic feed text</p></main><div id="interop-outlet"></div>', setup: async (page) => {
      await page.evaluate(({ kind, html }) => {
        const roots = new WeakMap();
        window.chrome.dom = { openOrClosedShadowRoot: (element) => roots.get(element) || element.shadowRoot };
        const host = document.querySelector('#interop-outlet');
        window.syntheticRoot = host.attachShadow({ mode: kind === 'closed' ? 'closed' : 'open' });
        roots.set(host, window.syntheticRoot);
        window.syntheticRoot.innerHTML = html;
        window.syntheticEditor = window.syntheticRoot.querySelector('#shadow-draft');
        if (kind === 'nested composer') {
          const composer = window.syntheticRoot.querySelector('#composer-host');
          const nested = composer.attachShadow({ mode: 'closed' });
          roots.set(composer, nested);
          nested.append(window.syntheticEditor);
        }
        window.syntheticRoot.querySelector('form').addEventListener('submit', (event) => { event.preventDefault(); window.sent++; });
      }, { kind, html });
    } });
    try {
      const inspection = await page.evaluate(() => window.command({ action: 'inspectChat' }));
      assert.equal(inspection.messages, 1);
      assert.equal(inspection.composers, 1);
      assert.equal(inspection.commentComposers, 0);
      await page.waitForTimeout(1100);
      assert.equal(await page.evaluate(() => window.calls.length), 0);
      await page.evaluate(() => window.syntheticRoot.querySelector('#shadow-messages').insertAdjacentHTML('beforeend', '<article data-message-id="shadow-live"><p class="msg-s-event-listitem__body">Synthetic shadow arrival</p></article><article data-message-id="shadow-sent" data-direction="outgoing"><p class="msg-s-event-listitem__body">Synthetic shadow sent</p></article>'));
      await page.waitForFunction(() => window.calls.length === 2, null, { timeout: 2500 });
      assert.deepEqual(await page.evaluate(() => window.calls.map(({ text, mode, targetLang }) => ({ text, mode, targetLang }))), [
        { text: 'Synthetic shadow arrival', mode: 'incoming', targetLang: 'vi' },
        { text: 'Synthetic shadow sent', mode: 'incoming', targetLang: 'vi' },
      ]);
      await page.evaluate(() => { window.syntheticEditor.focus(); document.execCommand('insertText', false, 'Nội dung tổng hợp'); });
      await page.waitForFunction(() => document.querySelector('.chat-translator-preview')?.shadowRoot.querySelector('.translation').textContent === 'ja: Nội dung tổng hợp', null, { timeout: 2500 });
      assert.equal(await page.locator('.chat-translator-preview').isVisible(), true);
      await page.keyboard.press('Tab');
      await page.waitForFunction(() => window.syntheticEditor.innerText === 'ja: Nội dung tổng hợp', null, { timeout: 2500 });
      assert.equal(await page.evaluate(() => window.sent), 0);
      await page.keyboard.press('Control+z');
      assert.equal(await page.evaluate(() => window.syntheticEditor.innerText), 'Nội dung tổng hợp');
    } finally { await page.close(); }
  });
}

test('linkedin shadow attached after initial load: observes later mounting and diagnostics report actual inner elements without message text', async () => {
  const page = await pageFor('linkedin', {}, { url: 'https://www.linkedin.com/feed/', html: '<main><p>Synthetic feed</p></main><div id="interop-outlet"></div>' });
  try {
    await page.evaluate(() => {
      window.syntheticRoot = document.querySelector('#interop-outlet').attachShadow({ mode: 'open' });
      window.syntheticRoot.innerHTML = '<section class="msg-overlay-conversation-bubble"><div class="msg-s-message-list"><p class="msg-s-event-listitem__body" id="selected-message">Synthetic private chat text</p></div><form class="msg-form"><div class="msg-form__contenteditable" contenteditable="true"></div></form></section>';
    });
    await page.waitForFunction(() => window.syntheticRoot.querySelector('.chat-translator-incoming'), null, { timeout: 2000 });
    assert.equal(await page.evaluate(() => window.calls.length), 0);
    const inspection = await page.evaluate(() => window.command({ action: 'inspectChat' }));
    assert.equal(inspection.messages, 1);
    assert.equal(inspection.composers, 1);
    await page.evaluate(() => window.command({ action: 'startMessageDiagnostic' }));
    await page.evaluate(() => window.syntheticRoot.querySelector('#selected-message').click());
    const report = await page.locator('.chat-translator-diagnostic').locator('textarea').inputValue();
    assert.equal(JSON.parse(report).selected.ancestors[0].tag, 'p');
    assert.ok(report.includes('msg-s-event-listitem__body'));
    assert.ok(!report.includes('Synthetic private chat text'));
    assert.ok(!report.includes('synthetic-test-key'));
    assert.equal(await page.evaluate(() => window.calls.length), 0);
  } finally { await page.close(); }
});

test('linkedin shadow closed: translation and diagnostic UI work with Trusted Types enforcement; picker sees the inner message', async () => {
  const page = await pageFor('linkedin', {}, { url: 'https://www.linkedin.com/feed/', html: '<div id="interop-outlet"></div>', setup: async (page) => {
    await page.evaluate(() => {
      const host = document.querySelector('#interop-outlet');
      window.syntheticRoot = host.attachShadow({ mode: 'closed' });
      window.chrome.dom = { openOrClosedShadowRoot: (node) => node === host ? window.syntheticRoot : node.shadowRoot };
      window.syntheticRoot.innerHTML = '<section class="msg-overlay-conversation-bubble"><div id="messages" class="msg-s-message-list"><p class="msg-s-event-listitem__body">Synthetic old history</p></div><form class="msg-form"><div class="msg-form__contenteditable" contenteditable="true"></div></form></section>';
    });
  } });
  try {
    await page.waitForTimeout(1100);
    await page.evaluate(() => {
      const meta = document.createElement('meta');
      meta.httpEquiv = 'Content-Security-Policy';
      meta.content = "require-trusted-types-for 'script'; trusted-types 'none'";
      document.head.append(meta);
      const message = document.createElement('p');
      message.className = 'msg-s-event-listitem__body';
      message.id = 'selected-inner-message';
      message.textContent = 'Synthetic private message';
      window.syntheticRoot.querySelector('#messages').append(message);
    });
    await page.waitForFunction(() => window.calls.length === 1, null, { timeout: 2500 });
    await page.waitForFunction(() => window.syntheticRoot.querySelector('#selected-inner-message').nextElementSibling?.shadowRoot.querySelector('.translation').textContent === 'vi: Synthetic private message');
    await page.evaluate(() => window.command({ action: 'startMessageDiagnostic' }));
    await page.evaluate(() => window.syntheticRoot.querySelector('#selected-inner-message').click());
    const report = JSON.parse(await page.locator('.chat-translator-diagnostic').locator('textarea').inputValue());
    assert.equal(report.selected.ancestors[0].tag, 'p');
    assert.ok(report.selected.ancestors[0].classes.includes('msg-s-event-listitem__body'));
    assert.ok(!JSON.stringify(report).includes('Synthetic private message'));
    assert.equal(await page.evaluate(() => window.calls.length), 1, 'diagnostic UI never adds a translation request');
  } finally { await page.close(); }
});

test('linkedin shadow closed mounted on first focus: immediate typing attaches preview and observers without an inspection command', async () => {
  const page = await pageFor('linkedin', {}, { url: 'https://www.linkedin.com/feed/', html: '<div id="interop-outlet"></div>' });
  try {
    await page.evaluate(() => {
      const host = document.querySelector('#interop-outlet');
      window.syntheticRoot = host.attachShadow({ mode: 'closed' });
      window.chrome.dom = { openOrClosedShadowRoot: (node) => node === host ? window.syntheticRoot : node.shadowRoot };
      window.syntheticRoot.innerHTML = '<section class="msg-overlay-conversation-bubble"><div id="messages" class="msg-s-message-list"><p class="msg-s-event-listitem__body">Synthetic history</p></div><form class="msg-form"><div id="draft" class="msg-form__contenteditable" contenteditable="true"></div></form></section>';
      window.syntheticRoot.querySelector('#draft').focus();
      document.execCommand('insertText', false, 'Synthetic immediate draft');
    });
    await page.waitForFunction(() => document.querySelector('.chat-translator-preview')?.shadowRoot.querySelector('.translation').textContent === 'en: Synthetic immediate draft', null, { timeout: 2500 });
    assert.equal(await page.locator('.chat-translator-preview').isVisible(), true);
    assert.deepEqual(await page.evaluate(() => window.calls.map(({ mode }) => mode)), ['outgoing']);
    await page.waitForTimeout(1100);
    await page.evaluate(() => window.syntheticRoot.querySelector('#messages').insertAdjacentHTML('beforeend', '<p class="msg-s-event-listitem__body">Synthetic subsequent arrival</p>'));
    await page.waitForFunction(() => window.calls.length === 2, null, { timeout: 2500 });
    assert.equal(await page.evaluate(() => window.calls[1].text), 'Synthetic subsequent arrival');
    assert.equal(await page.evaluate(() => window.calls[1].mode), 'incoming');
  } finally { await page.close(); }
});

// Synthetic floating conversations on the feed; no production messages or IDs.
const linkedinPopups = [
  {
    name: 'legacy shell with modern composer',
    open: '<section class="msg-overlay-conversation-bubble">',
    list: '<div id="transcript" class="msg-s-message-list">',
    editor: '<div id="popup-draft" contenteditable="true" role="textbox" data-placeholder="Viết tin nhắn…"></div>',
    message: (id, text) => `<article class="msg-s-message-list__event" data-event-urn="${id}"><p class="msg-s-event-listitem__body">${text}</p></article>`,
  },
  {
    name: 'semantic dialog with hashed classes',
    open: '<section role="dialog" class="_synthetic_panel">',
    list: '<div id="transcript" role="log">',
    editor: '<div id="popup-draft" contenteditable="plaintext-only" role="textbox" aria-placeholder="Write a message…"></div>',
    message: (id, text) => `<article data-message-id="${id}"><header><a href="/in/synthetic-peer">Synthetic author</a><time>10:30</time></header><p dir="auto">${text}</p><button>React</button></article>`,
  },
  {
    name: 'unmarked floating panel with scrolling transcript',
    open: '<section style="position:fixed;right:20px;bottom:20px;width:460px;background:white">',
    list: '<div id="transcript" style="height:220px;overflow-y:auto">',
    editor: '<div id="popup-draft" contenteditable="true" role="textbox" aria-label="Viết tin nhắn"></div>',
    message: (_id, text) => `<div><div style="white-space:pre-wrap">${text}</div><button>React</button></div>`,
  },
  {
    name: 'unlabelled composer with Send control',
    open: '<section role="dialog" style="position:fixed;right:20px;bottom:20px;width:460px;background:white">',
    list: '<div id="transcript" style="height:220px;overflow-y:auto">',
    editor: '<div id="popup-draft" contenteditable="true" role="textbox"></div>',
    message: (_id, text) => `<div><p>${text}</p></div>`,
  },
  {
    name: 'inherited whitespace formatting in transcript',
    open: '<section class="msg-overlay-conversation-bubble">',
    list: '<div id="transcript" role="log" style="white-space:pre-wrap">',
    editor: '<div id="popup-draft" contenteditable="true" aria-label="Message"></div>',
    message: (id, text) => `<div data-message-id="${id}"><header><span>Synthetic author</span><time>10:30</time></header><div><p>${text}</p></div><button>React</button></div>`,
  },
  {
    name: 'multiple paragraphs in one message body',
    open: '<section role="dialog">',
    list: '<div id="transcript" role="log">',
    editor: '<div id="popup-draft" contenteditable="true" aria-label="Message"></div>',
    message: (id, text) => `<article data-message-id="${id}"><header>Synthetic author</header><div><div class="quoted-message">Synthetic quoted text</div><p>${text.replaceAll('<br>', '</p><p>')}</p></div><button>React</button></article>`,
  },
];
function linkedinPopupHtml(fixture, history = true) {
  return `${fixture.open}<header><h2>Synthetic popup peer</h2><span role="status">Online</span></header><a href="https://example.test/profile">Visit website</a>${fixture.list}${history ? fixture.message('synthetic-old', 'Synthetic popup history') : ''}</div><form>${fixture.editor}<button type="submit">Gửi</button></form></section>`;
}
for (const fixture of linkedinPopups) {
  test(`linkedin popup ${fixture.name}: incoming and sent bubbles auto-translate; draft preview and Tab work on feed`, async () => {
    const page = await pageFor('linkedin', { incomingTargetLang: 'vi', outgoingTargetLang: 'ja' }, { url: 'https://www.linkedin.com/feed/', html: '<main><p>Unrelated feed text</p></main>' + linkedinPopupHtml(fixture) });
    try {
      const inspection = await page.evaluate(() => window.command({ action: 'inspectChat' }));
      assert.equal(inspection.messages, 1);
      assert.equal(inspection.composers, 1);
      assert.equal(inspection.commentComposers, 0, 'a floating direct-message editor is not a feed comment');
      await page.waitForTimeout(1100);
      assert.equal(await page.evaluate(() => window.calls.length), 0, 'opening a popup must not spend tokens on history');
      const additions = fixture.message('synthetic-new', 'Synthetic live <strong>message</strong><br>Second line') + fixture.message('synthetic-sent', 'Synthetic newly sent message');
      await page.evaluate((html) => document.querySelector('#transcript').insertAdjacentHTML('beforeend', html), additions);
      await page.waitForFunction(() => window.calls.length === 2, null, { timeout: 2500 });
      assert.deepEqual(await page.evaluate(() => window.calls.map(({ text, mode, targetLang }) => ({ text, mode, targetLang }))), [
        { text: 'Synthetic live message\nSecond line', mode: 'incoming', targetLang: 'vi' },
        { text: 'Synthetic newly sent message', mode: 'incoming', targetLang: 'vi' },
      ]);
      await page.waitForFunction(() => [...document.querySelectorAll('.chat-translator-incoming')].filter((host) => host.shadowRoot.querySelector('.translation').textContent.startsWith('vi: ')).length === 2);
      await page.locator('#popup-draft').fill('Nội dung tổng hợp');
      await page.waitForFunction(() => document.querySelector('.chat-translator-preview')?.shadowRoot.querySelector('.translation').textContent === 'ja: Nội dung tổng hợp', null, { timeout: 2500 });
      const preview = await page.locator('.chat-translator-preview').boundingBox();
      const draft = await page.locator('#popup-draft').boundingBox();
      assert.ok(preview && draft && preview.y < draft.y, 'preview is visible above the popup composer');
      await page.locator('#popup-draft').press('Tab');
      await page.waitForFunction(() => document.querySelector('#popup-draft').innerText === 'ja: Nội dung tổng hợp', null, { timeout: 2500 });
      assert.equal(await page.evaluate(() => window.sent), 0);
      assert.equal(await page.evaluate(() => window.calls.at(-1).mode), 'outgoing');
    } finally { await page.close(); }
  });
}

test('linkedin popup mounted after feed load: empty chat, old prepend and remounted history keep stable identity', async () => {
  const fixture = linkedinPopups[1];
  const page = await pageFor('linkedin', {}, { url: 'https://www.linkedin.com/feed/', html: '<main><p>Synthetic feed</p></main>' });
  try {
    await page.evaluate((html) => document.body.insertAdjacentHTML('beforeend', html), linkedinPopupHtml(fixture, false));
    await page.waitForTimeout(1150);
    await page.evaluate((html) => document.querySelector('#transcript').insertAdjacentHTML('beforeend', html), fixture.message('synthetic-first', 'Synthetic first arrival'));
    await page.waitForFunction(() => window.calls.length === 1, null, { timeout: 2500 });
    await page.evaluate((html) => document.querySelector('#transcript').insertAdjacentHTML('afterbegin', html), fixture.message('synthetic-older', 'Synthetic paginated history'));
    await page.waitForTimeout(350);
    assert.equal(await page.evaluate(() => window.calls.length), 1);
    await page.evaluate(() => { const list = document.querySelector('#transcript'); const copy = list.cloneNode(true); copy.querySelectorAll('.chat-translator-incoming').forEach((node) => node.remove()); list.replaceWith(copy); });
    await page.waitForTimeout(350);
    assert.equal(await page.evaluate(() => window.calls.length), 1, 're-rendering a transcript is not a new arrival');
    await page.evaluate((html) => document.querySelector('#transcript').insertAdjacentHTML('beforeend', html), fixture.message('synthetic-second', 'Synthetic second arrival'));
    await page.waitForFunction(() => window.calls.length === 2, null, { timeout: 2500 });
  } finally { await page.close(); }
});

test('linkedin popups: simultaneous windows isolate message IDs; feed, search, status and image-only messages are excluded', async () => {
  const fixture = linkedinPopups[1];
  const first = linkedinPopupHtml(fixture).replaceAll('transcript', 'transcript-a').replaceAll('popup-draft', 'draft-a').replace('Synthetic popup peer', 'Synthetic peer A');
  const second = linkedinPopupHtml(fixture).replaceAll('transcript', 'transcript-b').replaceAll('popup-draft', 'draft-b').replace('Synthetic popup peer', 'Synthetic peer B');
  const unrelated = '<main data-testid="mainFeed"><p dir="auto">Synthetic feed text</p><form><div id="comment" contenteditable="true" aria-label="Add a comment"></div></form></main><section role="dialog"><h2>Search</h2><div role="log"><p>Search result</p></div><div contenteditable="true" aria-label="Search messages"></div></section>';
  const page = await pageFor('linkedin', {}, { url: 'https://www.linkedin.com/feed/', html: unrelated + first + second });
  try {
    const inspection = await page.evaluate(() => window.command({ action: 'inspectChat' }));
    assert.equal(inspection.messages, 2);
    assert.equal(inspection.composers, 3);
    assert.equal(inspection.commentComposers, 1);
    await page.waitForTimeout(1100);
    await page.evaluate((html) => {
      document.querySelector('#transcript-a').insertAdjacentHTML('beforeend', html);
      document.querySelector('#transcript-b').insertAdjacentHTML('beforeend', html);
      document.querySelector('#transcript-a').insertAdjacentHTML('beforeend', '<article data-message-id="synthetic-image"><img alt="Synthetic attachment" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"><button>😊 1</button></article><p role="status">Seen</p><time>12:30</time>');
      document.querySelector('main').insertAdjacentHTML('beforeend', '<p dir="auto">Synthetic newly loaded feed text</p>');
    }, fixture.message('synthetic-shared-id', 'Synthetic live popup message'));
    await page.waitForFunction(() => window.calls.length === 2, null, { timeout: 2500 });
    await page.waitForTimeout(250);
    assert.equal(await page.evaluate(() => window.calls.length), 2);
    assert.equal((await page.evaluate(() => window.command({ action: 'inspectChat' }))).messages, 4);
    assert.equal(await page.locator('main .chat-translator-incoming').count(), 0);
  } finally { await page.close(); }
});

test('linkedin popup anonymous windows in a shared fixed dock: opening another conversation does not translate its history', async () => {
  const room = (name, text) => `<section id="${name}"><header><span>Synthetic peer</span></header><div role="log" id="log-${name}"><article data-message-id="${name}-old"><p>${text}</p></article></div><form><div contenteditable="true" aria-placeholder="Viết tin nhắn…"></div><button type="button">Gửi</button></form></section>`;
  const page = await pageFor('linkedin', {}, { url: 'https://www.linkedin.com/feed/', html: '<main data-testid="mainFeed"><p>Synthetic feed</p><div id="dock" style="position:fixed;bottom:0;right:0;display:flex">' + room('room-a', 'Synthetic history A') + room('room-b', 'Synthetic history B') + '</div></main>' });
  try {
    const inspection = await page.evaluate(() => window.command({ action: 'inspectChat' }));
    assert.equal(inspection.messages, 2);
    assert.equal(inspection.composers, 2);
    assert.equal(inspection.commentComposers, 0);
    await page.waitForTimeout(1100);
    await page.evaluate((html) => { document.querySelector('#room-a').remove(); document.querySelector('#dock').insertAdjacentHTML('beforeend', html); }, room('room-c', 'Synthetic history C'));
    await page.waitForTimeout(400);
    assert.equal(await page.evaluate(() => window.calls.length), 0, 'a newly opened conversation needs a new history baseline');
    await page.evaluate(() => document.querySelector('#log-room-b').insertAdjacentHTML('beforeend', '<article data-message-id="shared-live"><p>Synthetic arrival B</p></article>'));
    await page.waitForFunction(() => window.calls.length === 1, null, { timeout: 2500 });
    assert.equal(await page.evaluate(() => window.calls[0].text), 'Synthetic arrival B');
  } finally { await page.close(); }
});

test('linkedin popup conversation hooks added after mounting are detected without reloading', async () => {
  const page = await pageFor('linkedin', {}, { url: 'https://www.linkedin.com/feed/', html: '<section id="popup"><div role="log"><p>Synthetic old message</p></div><form><div id="popup-draft" contenteditable="true" data-placeholder="Viết tin nhắn…"></div><button type="button">Gửi</button></form></section>' });
  try {
    assert.equal((await page.evaluate(() => window.command({ action: 'inspectChat' }))).messages, 0);
    await page.evaluate(() => document.querySelector('#popup').setAttribute('data-view-name', 'messaging-conversation'));
    await page.waitForFunction(() => document.querySelector('.chat-translator-incoming'), null, { timeout: 1500 });
    assert.equal(await page.evaluate(() => window.calls.length), 0);
    await page.locator('#popup-draft').fill('Synthetic draft after mounting');
    await page.waitForFunction(() => document.querySelector('.chat-translator-preview')?.shadowRoot.querySelector('.translation').textContent === 'en: Synthetic draft after mounting', null, { timeout: 2500 });
    await page.locator('#popup-draft').press('Tab');
    await page.waitForFunction(() => document.querySelector('#popup-draft').innerText === 'en: Synthetic draft after mounting', null, { timeout: 2500 });
    assert.equal(await page.evaluate(() => window.sent), 0);
  } finally { await page.close(); }
});

for (const platform of ['whatsapp', 'linkedin', 'generic']) {
  test(`${platform}: old messages require a click; only new incoming messages auto-translate`, async () => {
    const page = await pageFor(platform);
    try {
      const oldButton = page.locator('.chat-translator-incoming').first().getByRole('button', { name: 'Dịch tin này', exact: true });
      await oldButton.waitFor();
      await page.waitForTimeout(250);
      assert.equal(await page.evaluate(() => window.calls.length), 0);
      await page.waitForTimeout(900);
      await page.evaluate((platform) => {
        document.querySelector('#messages').insertAdjacentHTML('beforeend', platform === 'whatsapp'
          ? '<div class="message-in"><span class="selectable-text">New synthetic message</span></div>'
          : platform === 'linkedin' ? '<div class="msg-s-message-group"><p class="msg-s-event-listitem__body">New synthetic message</p></div>' : '<article data-message-id="new-2" data-direction="incoming"><div data-message-text>New synthetic message</div></article>');
      }, platform);
      await page.waitForFunction(() => window.calls.length === 1);
      await page.waitForTimeout(300);
      assert.equal(await page.locator('.chat-translator-incoming').count(), 3);
      await page.evaluate(() => window.changeSettings({ incomingTargetLang: 'en' }));
      await page.waitForTimeout(300);
      assert.equal(await page.evaluate(() => window.calls.length), 1, 'changing settings must not retranslate history');
      await oldButton.first().click();
      await page.waitForFunction(() => window.calls.some((call) => call.targetLang === 'en' && call.manual === true));
    } finally { await page.close(); }
  });

  test(`${platform}: live preview and Tab replace draft, without sending`, async () => {
    const page = await pageFor(platform);
    try {
      const editor = page.locator('[contenteditable=true]');
      await editor.fill('Xin chào tổng hợp');
      await page.waitForFunction(() => document.querySelector('.chat-translator-preview')?.shadowRoot.querySelector('.translation')?.textContent === 'en: Xin chào tổng hợp');
      assert.equal(await editor.innerText(), 'Xin chào tổng hợp');
      const preview = await page.locator('.chat-translator-preview').boundingBox();
      const input = await editor.boundingBox();
      assert.ok(preview.y + preview.height <= input.y, 'preview should be above the editor');
      await editor.press('Tab');
      assert.equal(await editor.innerText(), 'en: Xin chào tổng hợp');
      assert.equal(await page.evaluate(() => window.sent), 0);
      assert.equal(await page.locator('.chat-translator-preview').isVisible(), false);
      await page.waitForTimeout(700);
      assert.equal(await page.evaluate(() => window.calls.filter((call) => call.mode === 'outgoing').length), 1);
    } finally { await page.close(); }
  });
}

test('typing is debounced, stale responses ignored, settings invalidate preview immediately', async () => {
  const page = await pageFor();
  try {
    const editor = page.locator('[contenteditable=true]');
    await page.evaluate(() => { window.hold = true; });
    await editor.fill('First');
    await editor.fill('Second');
    await page.waitForFunction(() => window.calls.some((call) => call.text === 'Second'));
    await editor.fill('Latest');
    await page.evaluate(() => window.pending.splice(0).forEach((finish) => finish()));
    assert.equal(await page.evaluate(() => document.querySelector('.chat-translator-preview').shadowRoot.querySelector('.translation').textContent.includes('en: Second')), false);
    await page.waitForFunction(() => window.calls.some((call) => call.text === 'Latest'));
    await page.evaluate(() => { window.hold = false; window.pending.splice(0).forEach((finish) => finish()); });
    await page.waitForFunction(() => document.querySelector('.chat-translator-preview').shadowRoot.querySelector('.translation').textContent === 'en: Latest');
    await page.evaluate(() => window.changeSettings({ outgoingTargetLang: 'vi' }));
    await editor.press('Tab');
    assert.equal(await editor.innerText(), 'Latest');
    await editor.focus();
    await page.waitForFunction(() => document.querySelector('.chat-translator-preview').shadowRoot.querySelector('.translation').textContent === 'vi: Latest');
    await page.evaluate(() => window.changeSettings({ enabled: false }));
    assert.equal(await page.locator('.chat-translator-preview').isVisible(), false);
    await editor.press('Tab');
    assert.equal(await editor.innerText(), 'Latest');
    assert.equal(await page.evaluate(() => window.calls.some((call) => call.text === 'First')), false);
  } finally { await page.close(); }
});

test('no key, disabled features, and unrelated fields never send text for translation', async () => {
  for (const settings of [{ openAiKey: '' }, { enabled: false }, { autoTranslateIncoming: false, autoTranslateOutgoing: false }]) {
    const page = await pageFor('whatsapp', settings);
    try {
      await page.locator('[contenteditable=true]').fill('Synthetic draft');
      await page.locator('#search').fill('Synthetic search');
      await page.waitForTimeout(800);
      assert.equal(await page.evaluate(() => window.calls.length), 0);
    } finally { await page.close(); }
  }
});

test('Shift+Tab and IME do not replace the draft', async () => {
  const page = await pageFor();
  try {
    const editor = page.locator('[contenteditable=true]');
    await editor.fill('Synthetic draft');
    await page.waitForFunction(() => document.querySelector('.chat-translator-preview').shadowRoot.querySelector('.translation').textContent === 'en: Synthetic draft');
    await editor.press('Shift+Tab');
    assert.equal(await editor.innerText(), 'Synthetic draft');
    await editor.focus();
    await editor.dispatchEvent('compositionstart');
    await editor.fill('Composing');
    await page.waitForTimeout(700);
    assert.equal(await page.evaluate(() => window.calls.some((call) => call.text === 'Composing')), false);
    await editor.dispatchEvent('keydown', { key: 'Tab', isComposing: true });
    assert.equal(await editor.innerText(), 'Composing');
    await editor.dispatchEvent('compositionend');
    await page.waitForFunction(() => window.calls.some((call) => call.text === 'Composing'));
  } finally { await page.close(); }
});

test('incoming edits, virtualized messages, and replacement composers stay in sync', async () => {
  const page = await pageFor();
  try {
    await page.locator('.chat-translator-incoming').first().getByRole('button', { name: 'Dịch tin này', exact: true }).click();
    await page.waitForFunction(() => window.calls.length === 1);
    await page.evaluate(() => { document.querySelector('.message-in .selectable-text').textContent = 'Edited synthetic message'; });
    await page.waitForTimeout(250);
    assert.equal(await page.evaluate(() => window.calls.length), 1);
    await page.locator('.chat-translator-incoming').first().getByRole('button', { name: 'Dịch tin này', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.chat-translator-incoming').shadowRoot.querySelector('.translation').textContent === 'vi: Edited synthetic message');
    assert.equal(await page.locator('.chat-translator-incoming').count(), 2);
    await page.evaluate(() => {
      document.querySelector('footer').innerHTML = '<textarea role="textbox"></textarea>';
    });
    // WhatsApp is contenteditable only; unrelated textarea should not be translated.
    await page.waitForTimeout(250);
    assert.equal(await page.locator('.chat-translator-preview').count(), 0);
    await page.evaluate(() => {
      document.querySelector('footer').innerHTML = '<div contenteditable="true" role="textbox"></div>';
    });
    await page.waitForTimeout(250);
    await page.locator('[contenteditable=true]').fill('New composer');
    await page.waitForFunction(() => document.querySelector('.chat-translator-preview').shadowRoot.querySelector('.translation').textContent === 'en: New composer');
    await page.locator('[contenteditable=true]').press('Tab');
    assert.equal(await page.locator('[contenteditable=true]').innerText(), 'en: New composer');
  } finally { await page.close(); }
});

test('prepended old history never auto-translates when scrolled into view', async () => {
  const page = await pageFor();
  try {
    await page.locator('.chat-translator-incoming').first().getByRole('button', { name: 'Dịch tin này', exact: true }).waitFor();
    await page.evaluate(() => {
      document.querySelector('#messages').insertAdjacentHTML('afterbegin', '<div class="message-in" style="margin-top:2000px"><div data-pre-plain-text="metadata"><div data-testid="quoted-message"><span class="selectable-text">Quoted old message</span></div><span class="selectable-text" id="offscreen">Line one<br>Line two <img alt="😊"></span></div></div>');
    });
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => window.calls.length), 0);
    await page.locator('#offscreen').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => window.calls.length), 0);
    await page.locator('.chat-translator-incoming').first().getByRole('button', { name: 'Dịch tin này', exact: true }).click();
    await page.waitForFunction(() => window.calls.length === 1);
    assert.equal(await page.evaluate(() => window.calls[0].text), 'Line one\nLine two 😊');
    await page.waitForTimeout(250);
    assert.equal(await page.locator('.chat-translator-incoming').count(), 3);
  } finally { await page.close(); }
});

test('native Undo restores draft; a late response cannot reopen preview after leaving editor', async () => {
  const page = await pageFor('whatsapp', { autoTranslateIncoming: false });
  try {
    const editor = page.locator('[contenteditable=true]');
    await editor.fill('Undo original');
    await page.waitForFunction(() => document.querySelector('.chat-translator-preview').shadowRoot.querySelector('.translation').textContent === 'en: Undo original');
    await editor.press('Tab');
    await editor.press('Control+z');
    assert.equal(await editor.innerText(), 'Undo original');
    await page.evaluate(() => { window.hold = true; });
    await editor.fill('Pending draft');
    await page.waitForFunction(() => window.calls.some((call) => call.text === 'Pending draft'));
    await page.locator('#search').focus();
    await page.evaluate(() => window.pending.splice(0).forEach((finish) => finish()));
    assert.equal(await page.locator('.chat-translator-preview').isVisible(), false);
  } finally { await page.close(); }
});

test('programmatic draft changes invalidate pending results even without input events', async () => {
  const page = await pageFor('whatsapp', { autoTranslateIncoming: false });
  try {
    await page.evaluate(() => { window.hold = true; });
    const editor = page.locator('[contenteditable=true]');
    await editor.fill('Pending original');
    await page.waitForFunction(() => window.calls.some((call) => call.text === 'Pending original'));
    await page.evaluate(() => {
      document.querySelector('[contenteditable=true]').textContent = 'Site changed draft';
      window.pending.splice(0).forEach((finish) => finish());
    });
    await page.waitForFunction(() => window.calls.some((call) => call.text === 'Site changed draft'));
    await page.evaluate(() => window.pending.splice(0).forEach((finish) => finish()));
    await page.waitForFunction(() => document.querySelector('.chat-translator-preview').shadowRoot.querySelector('.translation').textContent === 'en: Site changed draft');
    await page.evaluate(() => { document.querySelector('[contenteditable=true]').textContent = ''; });
    await page.waitForFunction(() => document.querySelector('.chat-translator-preview').hidden);
  } finally { await page.close(); }
});

test('translation errors offer retry; failed draft cannot be accepted', async () => {
  const page = await pageFor('whatsapp', { autoTranslateIncoming: false });
  try {
    await page.evaluate(() => { window.fail = true; });
    const editor = page.locator('[contenteditable=true]');
    await editor.fill('Synthetic failure');
    const retry = page.locator('.chat-translator-preview').getByRole('button', { name: 'Thử lại' });
    await retry.waitFor({ state: 'visible' });
    await editor.press('Tab');
    assert.equal(await editor.innerText(), 'Synthetic failure');
    await editor.focus();
    await retry.waitFor({ state: 'visible' });
    await page.evaluate(() => { window.fail = false; });
    await retry.click();
    await page.waitForFunction(() => document.querySelector('.chat-translator-preview').shadowRoot.querySelector('.translation').textContent === 'en: Synthetic failure');
    await editor.press('Tab');
    assert.equal(await editor.innerText(), 'en: Synthetic failure');
  } finally { await page.close(); }
});

test('LinkedIn textarea accepts translation and sends input to the site', async () => {
  const page = await pageFor('linkedin');
  try {
    await page.evaluate(() => {
      document.querySelector('[contenteditable=true]').remove();
      document.querySelector('.msg-form').insertAdjacentHTML('afterbegin', '<textarea></textarea>');
      window.editorEvents = 0;
      document.querySelector('textarea').addEventListener('input', () => { window.editorEvents++; });
    });
    await page.waitForTimeout(250);
    await page.locator('textarea').fill('Synthetic textarea');
    await page.waitForFunction(() => document.querySelector('.chat-translator-preview').shadowRoot.querySelector('.translation').textContent === 'en: Synthetic textarea');
    await page.locator('textarea').press('Tab');
    assert.equal(await page.locator('textarea').inputValue(), 'en: Synthetic textarea');
    assert.ok(await page.evaluate(() => window.editorEvents >= 2));
    assert.equal(await page.evaluate(() => window.sent), 0);
  } finally { await page.close(); }
});

async function popupFor(settings = {}, inspection = { success: true, platform: 'LinkedIn', messages: 2 }) {
  const version = JSON.parse(readFileSync(join(__dirname, '../manifest.json'), 'utf8')).version;
  const page = await browser.newPage({ viewport: { width: 360, height: 680 } });
  await page.addInitScript(({ initial, inspection, version }) => {
    window.saved = { ...initial };
    window.commands = [];
    window.chrome = { runtime: { getManifest: () => ({ version }) }, tabs: {
      query: (_query, cb) => cb([{ id: 123 }]),
      sendMessage: (tab, request, cb) => {
        window.commands.push({ tab, action: request.action });
        cb(request.action === 'inspectChat' ? inspection : { success: true, platform: 'LinkedIn', count: 2 });
      },
    }, storage: { local: {
      get: (_keys, cb) => cb(window.saved),
      set: (changes, cb) => { Object.assign(window.saved, changes); cb(); },
      remove: (key, cb) => { delete window.saved[key]; cb(); },
    } } };
  }, { initial: settings, inspection: { contentVersion: version, ...inspection }, version });
  await page.route('**/*', (route) => {
    const path = new URL(route.request().url()).pathname.slice(1);
    const type = path.endsWith('.png') ? 'image/png' : path.endsWith('.js') ? 'application/javascript' : path.endsWith('.css') ? 'text/css' : 'text/html';
    route.fulfill({ contentType: type, body: readFileSync(join(__dirname, '..', path)) });
  });
  await page.goto('https://extension.test/popup/popup.html');
  await page.locator('#save-btn').waitFor({ state: 'visible' });
  return page;
}

test('popup reports the active content version and zero detection counts for a connected LinkedIn tab', async () => {
  const version = JSON.parse(readFileSync(join(__dirname, '../manifest.json'), 'utf8')).version;
  const page = await popupFor({}, { success: true, platform: 'LinkedIn', messages: 0, composers: 0 });
  try {
    assert.ok((await page.locator('#chat-status').innerText()).includes(`v${version}`));
    assert.equal(await page.locator('#diagnose-chat').isVisible(), true);
  } finally { await page.close(); }
});

test('popup distinguishes a stale content script from failure to connect to the active tab', async () => {
  for (const inspection of [{ success: true, platform: 'LinkedIn', messages: 2, composers: 1, contentVersion: '0.0.1' }, { success: false, error: 'Synthetic disconnected tab' }]) {
    const page = await popupFor({}, inspection);
    try {
      assert.equal(await page.locator('#chat-status').isVisible(), true);
      assert.match(await page.locator('#chat-status').innerText(), /[Tt]ải lại/);
      if (inspection.success) assert.ok((await page.locator('#chat-status').innerText()).includes('v0.0.1'));
    } finally { await page.close(); }
  }
});

test('popup recognizes comment composers on LinkedIn feed without reporting a chat detection error', async () => {
  const page = await popupFor({ openAiKey: 'synthetic-test-key' }, { success: true, platform: 'LinkedIn', messages: 0, composers: 1, commentComposers: 1 });
  try {
    assert.match(await page.locator('#chat-status').innerText(), /1 ô soạn/);
    assert.equal(await page.locator('#diagnose-chat').isVisible(), false);
    assert.equal(await page.locator('#translate-all').isDisabled(), true);
    await page.locator('#outgoing-lang').selectOption('en');
    await page.locator('#save-btn').click();
    assert.equal(await page.evaluate(() => window.saved.outgoingTargetLang), 'en');
    assert.deepEqual(await page.evaluate(() => window.commands.map(({ action }) => action)), ['inspectChat']);
  } finally { await page.close(); }
});

test('popup keeps message diagnostics available on Zalo when the composer works but messages are missing', async () => {
  const page = await popupFor({ openAiKey: 'synthetic-test-key' }, { success: true, platform: 'Zalo Web', messages: 0, composers: 1, commentComposers: 0 });
  try {
    assert.equal(await page.locator('#diagnose-chat').isVisible(), true);
    await page.locator('#diagnose-chat').click();
    assert.deepEqual(await page.evaluate(() => window.commands.map(({ action }) => action)), ['inspectChat', 'startMessageDiagnostic']);
  } finally { await page.close(); }
});

test('popup preserves saved key, migrates language, saves both directions and removes key', async () => {
  const page = await popupFor({ openAiKey: 'synthetic-test-key', targetLang: 'ko' });
  try {
    assert.equal(await page.locator('#outgoing-lang').inputValue(), 'ko');
    assert.equal(await page.locator('#openai-key').inputValue(), '');
    await page.locator('#incoming-lang').selectOption('en');
    await page.locator('#outgoing-lang').selectOption('vi');
    await page.locator('#save-btn').click();
    const saved = await page.evaluate(() => window.saved);
    assert.equal(saved.openAiKey, 'synthetic-test-key');
    assert.equal(saved.incomingTargetLang, 'en');
    assert.equal(saved.outgoingTargetLang, 'vi');
    await page.locator('#api-settings summary').click();
    await page.locator('#remove-key').click();
    assert.equal(await page.evaluate(() => window.saved.openAiKey), undefined);
    await page.locator('#openai-key').fill('synthetic-replacement-key');
    await page.locator('#save-btn').click();
    assert.equal(await page.evaluate(() => window.saved.openAiKey), 'synthetic-replacement-key');
    assert.equal(await page.locator('#openai-key').inputValue(), '');
  } finally { await page.close(); }
});

test('popup setup, pause and layout fit within Chrome popup dimensions', async () => {
  const page = await popupFor();
  try {
    assert.equal(await page.locator('#outgoing-lang').inputValue(), 'en');
    assert.equal(await page.locator('#api-settings').getAttribute('open'), '');
    await page.locator('#enabled').uncheck();
    assert.equal(await page.locator('#incoming-lang').isDisabled(), true);
    assert.equal(await page.locator('#outgoing-lang').isDisabled(), true);
    await page.locator('#save-btn').click();
    assert.equal(await page.evaluate(() => window.saved.enabled), false);
    await page.locator('#enabled').check();
    await page.locator('#openai-key').fill('synthetic-test-key');
    await page.locator('#save-btn').click();
    await page.locator('#api-settings summary').click();
    mkdirSync(artifacts, { recursive: true });
    await page.locator('main').screenshot({ path: join(artifacts, 'popup.png') });
    const dimensions = await page.evaluate(() => ({ width: document.body.scrollWidth, height: document.body.getBoundingClientRect().height }));
    assert.ok(dimensions.width <= 360 && dimensions.height < 600, JSON.stringify(dimensions));
  } finally { await page.close(); }
});

test('popup translates all in the active tab using the selected settings', async () => {
  const page = await popupFor({ openAiKey: 'synthetic-test-key', autoTranslateIncoming: false });
  try {
    await page.locator('#incoming-lang').selectOption('en', { force: true });
    await page.locator('#translate-all').click();
    assert.equal(await page.evaluate(() => window.saved.incomingTargetLang), 'en');
    assert.deepEqual(await page.evaluate(() => window.commands.filter((item) => item.action === 'translateAllIncoming')), [{ tab: 123, action: 'translateAllIncoming' }]);
    assert.match(await page.locator('#toast-msg').innerText(), /2 tin/);
  } finally { await page.close(); }
});

for (const platform of ['whatsapp', 'linkedin', 'generic']) {
  test(`${platform}: manual translate all works with auto off and has no implicit calls`, async () => {
    const page = await pageFor(platform, { autoTranslateIncoming: false });
    try {
      await page.locator('.chat-translator-incoming').first().waitFor();
      assert.equal(await page.evaluate(() => window.calls.length), 0);
      const response = await page.evaluate(() => window.command({ action: 'translateAllIncoming' }));
      assert.equal(response.count, 2);
      await page.waitForFunction(() => window.calls.length === 2);
      assert.equal(await page.evaluate(() => window.calls[0].manual), true);
      assert.equal(await page.evaluate(() => window.calls[0].force), true);
      await page.waitForFunction(() => document.querySelector('.chat-translator-incoming').shadowRoot.querySelector('button').textContent === 'Dịch lại');
      await page.evaluate(() => window.changeSettings({ enabled: false }));
      await page.evaluate(() => window.changeSettings({ enabled: true, autoTranslateIncoming: true }));
      await page.waitForTimeout(350);
      assert.equal(await page.evaluate(() => window.calls.length), 2);
    } finally { await page.close(); }
  });
}

test('initial asynchronous history and switching conversations stay manual', async () => {
  const page = await pageFor('generic', {}, {
    html: '<div data-chat-conversation data-conversation-id="A"><section id="messages" role="log"></section><form data-chat-composer><textarea></textarea></form></div>',
  });
  try {
    await page.evaluate(() => {
      document.querySelector('#messages').innerHTML = '<article data-message-id="a1" data-direction="incoming"><div data-message-text>Async old history</div></article>';
    });
    await page.locator('.chat-translator-incoming').first().waitFor();
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => window.calls.length), 0);
    await page.evaluate(() => {
      document.querySelector('[data-chat-conversation]').setAttribute('data-conversation-id', 'B');
      document.querySelector('#messages').innerHTML = '<article data-message-id="b1" data-direction="incoming"><div data-message-text>Other conversation history</div></article>';
    });
    await page.waitForTimeout(350);
    assert.equal(await page.evaluate(() => window.calls.length), 0);
    await page.waitForTimeout(900);
    await page.evaluate(() => {
      document.querySelector('#messages').insertAdjacentHTML('beforeend', '<article data-message-id="b2" data-direction="incoming"><div data-message-text>Live in conversation B</div></article>');
    });
    await page.waitForFunction(() => window.calls.length === 1);
    assert.equal(await page.evaluate(() => window.calls[0].text), 'Live in conversation B');
  } finally { await page.close(); }
});

test('old timestamps and remounted message IDs never become new messages', async () => {
  const page = await pageFor('generic');
  try {
    await page.locator('.chat-translator-incoming').first().waitFor();
    await page.evaluate(() => {
      document.querySelector('#messages').insertAdjacentHTML('beforeend', `<article data-message-id="late-old" data-timestamp="${Date.now() - 60000}" data-direction="incoming"><div data-message-text>Late old history</div></article>`);
    });
    await page.waitForTimeout(350);
    assert.equal(await page.evaluate(() => window.calls.length), 0);
    await page.evaluate(() => {
      document.querySelector('[data-message-id="old-1"]').remove();
      document.querySelector('#messages').insertAdjacentHTML('beforeend', '<article data-message-id="old-1" data-direction="incoming"><div data-message-text>Hello synthetic friend</div></article>');
    });
    await page.waitForTimeout(350);
    assert.equal(await page.evaluate(() => window.calls.length), 0);
  } finally { await page.close(); }
});

test('a recycled DOM node is classified by message identity and creation time', async () => {
  const page = await pageFor('generic');
  try {
    await page.locator('.chat-translator-incoming').first().waitFor();
    await page.evaluate(() => {
      const row = document.querySelector('[data-message-id="old-1"]');
      row.setAttribute('data-message-id', 'recycled-new');
      row.setAttribute('data-timestamp', Date.now());
      row.querySelector('[data-message-text]').textContent = 'New message in a recycled row';
    });
    await page.waitForFunction(() => window.calls.length === 1);
    assert.equal(await page.evaluate(() => window.calls[0].text), 'New message in a recycled row');
    await page.evaluate(() => {
      const row = document.querySelector('[data-message-id="recycled-new"]');
      row.setAttribute('data-message-id', 'recycled-old');
      row.setAttribute('data-timestamp', Date.now() - 60000);
      row.querySelector('[data-message-text]').textContent = 'Old message in recycled row';
    });
    await page.waitForTimeout(400);
    assert.equal(await page.evaluate(() => window.calls.length), 1);
  } finally { await page.close(); }
});

test('Facebook post/comment editors are excluded from chat translation', async () => {
  const page = await pageFor('messenger', {}, {
    url: 'https://www.facebook.com/',
    html: '<main role="main"><div role="dialog"><div contenteditable="true" role="textbox" data-lexical-editor="true" aria-label="Write a comment"></div></div></main>',
  });
  try {
    await page.locator('[contenteditable=true]').fill('Synthetic comment');
    await page.waitForTimeout(700);
    assert.equal(await page.locator('.chat-translator-preview').count(), 0);
    assert.equal(await page.evaluate(() => window.calls.length), 0);
  } finally { await page.close(); }
});

const layouts = {
  'linkedin-modern': {
    platform: 'linkedin', url: 'https://www.linkedin.com/messaging/thread/test/',
    html: '<section id="messages" class="msg-s-message-list"><div class="msg-s-message-list__event" data-event-urn="old"><div class="msg-s-event__content">Hello synthetic friend</div></div><div class="msg-s-message-list__event msg-s-event-listitem--self" data-event-urn="own"><div class="msg-s-event__content">Own synthetic message</div></div></section><form class="msg-form"><div class="msg-form__contenteditable" contenteditable="true" role="textbox"></div></form>',
    newMessage: '<div class="msg-s-message-list__event" data-event-urn="new"><div class="msg-s-event__content"><p class="msg-s-event-listitem__body">New synthetic message</p></div></div>',
  },
  messenger: {
    url: 'https://www.facebook.com/messages/t/test/',
    html: '<main role="main"><section id="messages" data-scope="messages_table"><div role="row" data-message-id="old"><div role="gridcell"><div dir="auto">Hello synthetic friend</div></div></div><div role="row" data-message-id="own" aria-label="You sent"><div dir="auto">Own synthetic message</div></div></section><div contenteditable="true" role="textbox" aria-label="Message" data-lexical-editor="true"></div></main>',
    newMessage: '<div role="row" data-message-id="new"><div role="gridcell"><div dir="auto">New synthetic message</div></div></div>',
  },
  zalo: {
    url: 'https://chat.zalo.me/',
    html: '<section id="messageViewContainer"><div class="chat-message" data-id="old"><div class="card card--text"><div class="text">Hello synthetic friend</div></div></div><div class="chat-message" data-id="own"><div class="card card--text me"><div class="text">Own synthetic message</div></div></div></section><div id="richInput" contenteditable="true" role="textbox"></div>',
    root: '#messageViewContainer',
    newMessage: '<div class="chat-message" data-id="new"><div class="card card--text"><div class="text">New synthetic message</div></div></div>',
  },
  'telegram-k': {
    platform: 'telegram', url: 'https://web.telegram.org/k/',
    html: '<section id="messages" class="bubbles"><div class="bubble" data-mid="old"><div class="message">Hello synthetic friend<span class="time">10:00</span></div></div><div class="bubble is-out" data-mid="own"><div class="message">Own synthetic message</div></div></section><div class="input-message-input" contenteditable="true" role="textbox"></div>',
    newMessage: '<div class="bubble" data-mid="new"><div class="message">New synthetic message</div></div>',
  },
  'telegram-a': {
    platform: 'telegram', url: 'https://web.telegram.org/a/',
    html: '<section id="messages" class="messages-container"><div class="Message" data-message-id="old"><div class="text-content">Hello synthetic friend</div></div><div class="Message own" data-message-id="own"><div class="text-content">Own synthetic message</div></div></section><div id="editable-message-text" contenteditable="true" role="textbox"></div>',
    newMessage: '<div class="Message" data-message-id="new"><div class="text-content">New synthetic message</div></div>',
  },
  teams: {
    url: 'https://teams.cloud.microsoft/',
    html: '<div data-current-user-name>Me</div><section id="messages" data-tid="chat-pane-message-list"><div data-tid="chat-pane-message" data-mid="old"><span id="author-old">Friend</span><div id="content-old">Hello synthetic friend</div></div><div data-tid="chat-pane-message" data-mid="own"><span id="author-own">Me</span><div id="content-own">Own synthetic message</div></div></section><div data-tid="ckeditor" contenteditable="true" role="textbox"></div>',
    newMessage: '<div data-tid="chat-pane-message" data-mid="new"><span id="author-new">Friend</span><div id="content-new">New synthetic message</div></div>',
  },
  discord: {
    url: 'https://discord.com/channels/@me/test',
    html: '<div data-current-user-name>Me</div><section id="messages" data-list-id="chat-messages"><li id="chat-messages-room-old"><span id="message-username-old">Friend</span><div id="message-content-old">Hello synthetic friend</div></li><li id="chat-messages-room-own"><span id="message-username-own">Me</span><div id="message-content-own">Own synthetic message</div></li></section><div data-slate-editor="true" contenteditable="true" role="textbox" aria-label="Message"></div>',
    newMessage: '<li id="chat-messages-room-new"><span id="message-username-new">Friend</span><div id="message-content-new">New synthetic message</div></li>',
  },
};

for (const [name, layout] of Object.entries(layouts)) {
  test(`${name}: consistent manual history, automatic new incoming, and Tab preview`, async () => {
    const page = await pageFor(layout.platform || name, {}, layout);
    try {
      await page.locator('.chat-translator-incoming').first().getByRole('button', { name: 'Dịch tin này', exact: true }).waitFor();
      assert.equal(await page.locator('.chat-translator-incoming').count(), 2);
      assert.equal(await page.evaluate(() => window.calls.length), 0);
      await page.waitForTimeout(1000);
      await page.evaluate(({ root, html }) => document.querySelector(root).insertAdjacentHTML('beforeend', html), { root: layout.root || '#messages', html: layout.newMessage });
      await page.waitForFunction(() => window.calls.length === 1);
      assert.equal(await page.evaluate(() => window.calls[0].text), 'New synthetic message');
      assert.equal(await page.evaluate(() => window.calls[0].manual), false);
      assert.equal(await page.locator('.chat-translator-incoming').count(), 3);
      const editor = page.locator('[contenteditable=true]');
      await editor.fill('Synthetic draft');
      await page.waitForFunction(() => document.querySelector('.chat-translator-preview').shadowRoot.querySelector('.translation').textContent === 'en: Synthetic draft');
      await editor.press('Tab');
      assert.equal(await editor.innerText(), 'en: Synthetic draft');
    } finally { await page.close(); }
  });
}

test('history hydrated in multiple initial batches incurs zero translation requests', async () => {
  const page = await pageFor('generic');
  try {
    await page.locator('.chat-translator-incoming').first().waitFor();
    await page.evaluate(() => {
      document.querySelector('#messages').insertAdjacentHTML('beforeend', '<article data-message-id="initial-late-1" data-direction="incoming"><div data-message-text>Another old history page</div></article>');
    });
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      document.querySelector('#messages').insertAdjacentHTML('beforeend', '<article data-message-id="initial-late-2" data-direction="incoming"><div data-message-text>Final old history page</div></article>');
    });
    await page.waitForTimeout(1100);
    assert.equal(await page.evaluate(() => window.calls.length), 0);
    await page.evaluate(() => {
      document.querySelector('#messages').insertAdjacentHTML('beforeend', '<article data-message-id="after-history-new" data-direction="incoming"><div data-message-text>Genuinely new arrival</div></article>');
    });
    await page.waitForFunction(() => window.calls.length === 1);
    assert.equal(await page.evaluate(() => window.calls[0].text), 'Genuinely new arrival');
  } finally { await page.close(); }
});

test('a timestamped live arrival is translated during initial hydration', async () => {
  const page = await pageFor('generic');
  try {
    await page.locator('.chat-translator-incoming').first().waitFor();
    await page.evaluate(() => {
      document.querySelector('#messages').insertAdjacentHTML('beforeend', `<article data-message-id="live-now" data-timestamp="${Date.now()}" data-direction="incoming"><div data-message-text>Timestamped live message</div></article>`);
    });
    await page.waitForFunction(() => window.calls.length === 1);
    assert.equal(await page.evaluate(() => window.calls[0].text), 'Timestamped live message');
  } finally { await page.close(); }
});

test('reverse chat order distinguishes a new message from appended old history', async () => {
  const page = await pageFor('generic');
  try {
    await page.locator('.chat-translator-incoming').first().waitFor();
    await page.evaluate(() => { document.querySelector('#messages').style.cssText = 'display:flex;flex-direction:column-reverse'; });
    await page.waitForTimeout(1000);
    await page.evaluate(() => {
      const list = document.querySelector('#messages');
      list.insertAdjacentHTML('afterbegin', '<article data-message-id="reverse-new" data-direction="incoming"><div data-message-text>New in reversed chat</div></article>');
      list.insertAdjacentHTML('beforeend', '<article data-message-id="reverse-old" data-direction="incoming"><div data-message-text>Old in reversed chat</div></article>');
    });
    await page.waitForFunction(() => window.calls.length === 1);
    assert.equal(await page.evaluate(() => window.calls[0].text), 'New in reversed chat');
    await page.waitForTimeout(250);
    assert.equal(await page.evaluate(() => window.calls.length), 1);
  } finally { await page.close(); }
});

test('site rerenders can remove the translation card without losing its result or making another API call', async () => {
  const page = await pageFor('linkedin');
  try {
    await page.locator('.chat-translator-incoming').first().getByRole('button', { name: 'Dịch tin này', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.chat-translator-incoming').shadowRoot.querySelector('button').textContent === 'Dịch lại');
    await page.evaluate(() => document.querySelector('.chat-translator-incoming').remove());
    await page.locator('.msg-s-message-group .chat-translator-incoming').waitFor({ state: 'visible', timeout: 1800 });
    assert.equal(await page.locator('.msg-s-message-group .chat-translator-incoming').locator('.translation').innerText(), 'vi: Hello synthetic friend');
    assert.equal(await page.evaluate(() => window.calls.length), 1);
  } finally { await page.close(); }
});

for (const [name, layout] of Object.entries({ whatsapp: { url: 'https://web.whatsapp.com/', newMessage: '<div class="message-in" data-id="new"><span class="selectable-text">New synthetic message</span></div>' }, ...layouts })) {
  test(`${name}: newly sent messages translate automatically in the conversation language`, async () => {
    const page = await pageFor(layout.platform || name, {}, layout);
    try {
      await page.waitForTimeout(1100);
      await page.evaluate(({ root, html }) => {
        const template = document.createElement('template');
        template.innerHTML = html;
        template.content.firstElementChild.setAttribute('data-direction', 'outgoing');
        document.querySelector(root).append(template.content);
      }, { root: layout.root || '#messages', html: layout.newMessage });
      await page.waitForFunction(() => window.calls.length === 1, null, { timeout: 2200 });
      assert.equal(await page.evaluate(() => window.calls[0].mode), 'incoming');
      assert.equal(await page.evaluate(() => window.calls[0].targetLang), 'vi');
      assert.equal(await page.evaluate(() => window.calls[0].manual), false);
      await page.waitForFunction(() => [...document.querySelectorAll('.chat-translator-incoming')].some((host) => host.shadowRoot.querySelector('.translation').textContent === 'vi: New synthetic message'));
    } finally { await page.close(); }
  });
}

test('remounted chat lists retain message ID anchors for automatic live arrivals', async () => {
  const page = await pageFor('generic');
  try {
    await page.waitForTimeout(1100);
    await page.evaluate(() => {
      const list = document.querySelector('#messages');
      list.outerHTML = `<section id="messages" role="log"><article data-message-id="old-1"><div data-message-text>Hello synthetic friend</div></article><article data-message-id="own-1" data-direction="outgoing"><div data-message-text>Own synthetic message</div></article><article data-message-id="live-remount"><div data-message-text>Live after remount</div></article></section>`;
    });
    await page.waitForFunction(() => window.calls.length === 1, null, { timeout: 2200 });
    assert.equal(await page.evaluate(() => window.calls[0].text), 'Live after remount');
  } finally { await page.close(); }
});

test('second-precision timestamps do not block a live arrival in the same second', async () => {
  const page = await pageFor('generic');
  try {
    await page.waitForTimeout(1100);
    await page.evaluate(() => {
      const second = Math.floor(Date.now() / 1000);
      document.querySelector('[data-message-id="old-1"]').setAttribute('data-timestamp', second);
      const text = document.querySelector('[data-message-id="old-1"] [data-message-text]');
      text.textContent = text.textContent;
    });
    await page.waitForTimeout(180);
    await page.evaluate(() => {
      const time = document.querySelector('[data-message-id="old-1"]').getAttribute('data-timestamp');
      document.querySelector('#messages').insertAdjacentHTML('beforeend', `<article data-message-id="same-second" data-timestamp="${time}"><div data-message-text>Live in the same second</div></article>`);
    });
    await page.waitForFunction(() => window.calls.length === 1, null, { timeout: 2200 });
    assert.equal(await page.evaluate(() => window.calls[0].text), 'Live in the same second');
  } finally { await page.close(); }
});

test('WhatsApp status changes and nested application roles do not reset live detection', async () => {
  const page = await pageFor('whatsapp', {}, {
    html: '<div id="main"><header><span title="Test chat">Test chat</span><span id="presence">offline</span></header><section id="messages"><div class="message-in" data-id="old"><div role="application"><span class="selectable-text">Old message</span></div></div></section><footer><div contenteditable="true" role="textbox"></div></footer></div>',
  });
  try {
    await page.waitForTimeout(1100);
    await page.evaluate(() => {
      document.querySelector('#presence').textContent = 'online';
      document.querySelector('#messages').insertAdjacentHTML('beforeend', '<div class="message-in" data-id="live"><div role="application"><span class="selectable-text">Live with nested application</span></div></div>');
    });
    await page.waitForFunction(() => window.calls.length === 1, null, { timeout: 2200 });
    assert.equal(await page.evaluate(() => window.calls[0].text), 'Live with nested application');
  } finally { await page.close(); }
});

test('WhatsApp Tab accepts rich editor normalization and a false native command return', async () => {
  const page = await pageFor('whatsapp');
  try {
    const editor = page.locator('[contenteditable=true]');
    await editor.fill('Synthetic draft');
    await page.waitForFunction(() => document.querySelector('.chat-translator-preview').shadowRoot.querySelector('.translation').textContent === 'en: Synthetic draft');
    await page.evaluate(() => {
      const nativeCommand = document.execCommand.bind(document);
      document.execCommand = (...args) => { nativeCommand(...args); return false; };
      document.querySelector('[contenteditable=true]').addEventListener('input', (event) => {
        if (event.inputType !== 'insertText') return;
        const input = event.currentTarget;
        const paragraph = document.createElement('p');
        paragraph.textContent = input.textContent.replaceAll(' ', '\u00a0');
        const filler = document.createElement('p');
        filler.append(document.createElement('br'));
        input.replaceChildren(paragraph, filler);
      });
    });
    await editor.press('Tab');
    await page.waitForTimeout(800);
    assert.equal(await editor.evaluate((node) => node.innerText.replaceAll('\u00a0', ' ').trimEnd()), 'en: Synthetic draft');
    assert.equal(await page.locator('.chat-translator-preview').isVisible(), false);
    assert.equal(await page.evaluate(() => window.calls.filter((call) => call.mode === 'outgoing').length), 1);
    assert.equal(await page.evaluate(() => window.sent), 0);
  } finally { await page.close(); }
});

test('conversation translation and draft preview switches operate independently', async () => {
  for (const direction of ['incoming', 'outgoing']) {
    const page = await pageFor('generic', { autoTranslateIncoming: direction === 'incoming', autoTranslateOutgoing: direction === 'outgoing' });
    try {
      await page.waitForTimeout(1100);
      await page.evaluate(() => {
        document.querySelector('#messages').insertAdjacentHTML('beforeend', '<article data-message-id="received" data-direction="incoming"><div data-message-text>Received synthetic message</div></article><article data-message-id="sent" data-direction="outgoing"><div data-message-text>Sent synthetic message</div></article>');
      });
      const messages = direction === 'incoming' ? 2 : 0;
      if (messages) await page.waitForFunction(() => window.calls.length === 2);
      else await page.waitForTimeout(450);
      assert.equal(await page.evaluate(() => window.calls.length), messages);
      await page.locator('[contenteditable=true]').fill('Synthetic independent draft');
      if (direction === 'outgoing') await page.waitForFunction(() => window.calls.length === 1);
      else await page.waitForTimeout(700);
      assert.equal(await page.evaluate(() => window.calls.length), messages + (direction === 'outgoing' ? 1 : 0));
      assert.equal(await page.evaluate(() => window.calls[0].mode), direction);
      await page.locator('[contenteditable=true]').fill('');
      await page.evaluate(() => window.changeSettings({ autoTranslateIncoming: true, autoTranslateOutgoing: true }));
      await page.waitForTimeout(300);
      assert.equal(await page.evaluate(() => window.calls.length), messages + (direction === 'outgoing' ? 1 : 0), 'enabling automation does not translate old sent or received messages');
    } finally { await page.close(); }
  }
});

test('Zalo uses the read language for sent/received messages and a separate language for drafts, manual and bulk translations', async () => {
  const page = await pageFor('zalo', { incomingTargetLang: 'vi', outgoingTargetLang: 'ja' }, {
    url: 'https://chat.zalo.me/',
    html: `<main><section class="chat-scroll">${markedZaloMessage('historical-self', 'Synthetic sent history', true)}</section><div id="richInput" contenteditable="true"></div></main>`,
  });
  try {
    await page.waitForTimeout(1100);
    assert.equal(await page.evaluate(() => window.calls.length), 0);
    await page.evaluate(() => { window.hold = true; });
    await page.evaluate((html) => document.querySelector('.chat-scroll').insertAdjacentHTML('beforeend', html), markedZaloMessage('read-in', 'Synthetic received') + markedZaloMessage('read-out', 'Synthetic sent', true));
    await page.waitForFunction(() => window.calls.length === 2);
    assert.deepEqual(await page.evaluate(() => window.calls.map(({ mode, targetLang }) => ({ mode, targetLang }))), [{ mode: 'incoming', targetLang: 'vi' }, { mode: 'incoming', targetLang: 'vi' }]);
    await page.evaluate(() => window.changeSettings({ outgoingTargetLang: 'ko', autoTranslateOutgoing: false }));
    await page.evaluate(() => { window.hold = false; window.pending.splice(0).forEach((finish) => finish()); });
    await page.waitForFunction(() => document.querySelector('[id="mtc-read-out"]').closest('[data-component="message-text-content"]').nextElementSibling?.shadowRoot.querySelector('.translation').textContent === 'vi: Synthetic sent');
    assert.equal(await page.evaluate(() => window.calls.length), 2, 'draft settings do not invalidate pending message translations');
    await page.locator('.chat-translator-incoming').first().getByRole('button', { name: 'Dịch tin này', exact: true }).click();
    await page.waitForFunction(() => window.calls.length === 3);
    assert.equal(await page.evaluate(() => window.calls[2].targetLang), 'vi', 'manual sent history uses read language');
    await page.evaluate(() => window.changeSettings({ incomingTargetLang: 'en', autoTranslateOutgoing: true }));
    await page.locator('#richInput').fill('Synthetic draft');
    await page.waitForFunction(() => window.calls.length === 4);
    assert.deepEqual(await page.evaluate(() => ({ mode: window.calls[3].mode, targetLang: window.calls[3].targetLang })), { mode: 'outgoing', targetLang: 'ko' });
    await page.locator('#richInput').fill('');
    await page.evaluate(() => window.command({ action: 'translateAllIncoming' }));
    await page.waitForFunction(() => window.calls.length === 7);
    assert.ok(await page.evaluate(() => window.calls.slice(4).every((call) => call.targetLang === 'en' && call.mode === 'incoming' && call.manual === true)));
    await page.evaluate((html) => document.querySelector('.chat-scroll').insertAdjacentHTML('beforeend', html), markedZaloMessage('new-en', 'Synthetic new English target', true));
    await page.waitForFunction(() => window.calls.length === 8);
    assert.equal(await page.evaluate(() => window.calls[7].targetLang), 'en');
  } finally { await page.close(); }
});

test('WhatsApp Tab can use a controlled editor beforeinput handler when native insertion is refused', async () => {
  const page = await pageFor('whatsapp');
  try {
    const editor = page.locator('[contenteditable=true]');
    await editor.fill('Controlled draft');
    await page.waitForFunction(() => document.querySelector('.chat-translator-preview').shadowRoot.querySelector('.translation').textContent === 'en: Controlled draft');
    await page.evaluate(() => {
      document.execCommand = () => false;
      window.modelDraft = 'Controlled draft';
      document.querySelector('[contenteditable=true]').addEventListener('beforeinput', (event) => {
        if (event.inputType !== 'insertText') return;
        event.preventDefault();
        window.modelDraft = event.data;
        event.currentTarget.textContent = event.data;
        event.currentTarget.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: event.data }));
      });
    });
    await editor.press('Tab');
    await page.waitForFunction(() => window.modelDraft === 'en: Controlled draft', null, { timeout: 2000 });
    assert.equal(await editor.innerText(), 'en: Controlled draft');
    assert.equal(await page.evaluate(() => window.sent), 0);
    await page.waitForTimeout(700);
    assert.equal(await page.evaluate(() => window.calls.length), 1);
  } finally { await page.close(); }
});

test('a new WhatsApp bubble rerendered before translation retains its automatic request and result', async () => {
  const page = await pageFor('whatsapp');
  try {
    await page.waitForTimeout(1100);
    await page.evaluate(() => {
      window.hold = true;
      document.querySelector('#messages').insertAdjacentHTML('beforeend', '<div class="message-in" data-id="live-rerender"><span class="selectable-text">Live rerendered message</span></div>');
    });
    const bubble = page.locator('[data-id="live-rerender"]');
    await bubble.locator('.chat-translator-incoming').waitFor();
    await page.evaluate(() => {
      document.querySelector('[data-id="live-rerender"] .selectable-text').outerHTML = '<span class="selectable-text">Live rerendered message</span>';
    });
    await page.waitForFunction(() => window.calls.length === 1, null, { timeout: 2000 });
    await page.evaluate(() => {
      document.querySelector('[data-id="live-rerender"] .selectable-text').outerHTML = '<span class="selectable-text">Live rerendered message</span>';
    });
    await page.waitForTimeout(200);
    await page.evaluate(() => window.pending.splice(0).forEach((finish) => finish()));
    await page.waitForFunction(() => document.querySelector('[data-id="live-rerender"] .chat-translator-incoming').shadowRoot.querySelector('.translation').textContent === 'vi: Live rerendered message', null, { timeout: 2000 });
    assert.equal(await page.evaluate(() => window.calls.length), 1);
  } finally { await page.close(); }
});

// Zalo's custom text elements are used in ZaDark's public integration code:
// https://github.com/ncdai/zadark/blob/main/src/core/js/zadark-translate.js
function zaloBubble(id, text, own = false, container = true) {
  return `<article class="chat-message" id="${id}" data-id="div_ChatMessage"><div class="card${own ? ' me' : ''}" data-id="div_TextMessage">
    <div class="card-sender-name"><span-15>Synthetic sender</span-15></div>
    <div class="quote-base"><div class="text-message__container"><div><span-15>Quoted old text</span-15></div></div></div>
    <div${container ? ' class="text-message__container"' : ''}><div><span-15>${text}</span-15></div></div>
    <div class="card-send-time"><span-15>10:00</span-15></div><div class="message-reaction-container">3 reactions</div>
  </div></article>`;
}

for (const [name, rootAttributes, container] of [
  ['custom-text-container', 'id="messageViewContainer"', true],
  ['custom-text-legacy-root', 'id="messageView"', false],
  ['custom-text-class-root', 'class="message-view" data-id="div_MessageView"', true],
]) {
  test(`zalo ${name}: detects history and automatically translates received/sent custom text`, async () => {
    const page = await pageFor('zalo', {}, {
      url: 'https://chat.zalo.me/',
      html: `<aside><div class="card"><span-15>Sidebar text</span-15></div></aside><main${name === 'custom-text-class-root' ? '' : ' id="chatView"'}><header><div class="header-title">Synthetic room</div></header><section ${rootAttributes} data-test-list>
        ${zaloBubble('old-received', 'Hello <b>synthetic</b> friend<br>Second line', false, container)}
        ${zaloBubble('old-sent', 'Own historical text', true, container)}
        <div class="chat-message"><div class="card card--file"><div class="file-message__container"><div class="text">Synthetic filename.txt</div></div></div></div>
      </section><div id="richInput" contenteditable="true" role="textbox"></div></main>`,
    });
    try {
      const inspection = await page.evaluate(() => window.command({ action: 'inspectChat' }));
      assert.equal(inspection.messages, 2, 'custom text bodies must be recognized, with no sidebar, quote, or file labels');
      assert.equal(await page.locator('.chat-translator-incoming').count(), 2);
      assert.equal(await page.locator('.card .chat-translator-incoming').count(), 2, 'translations stay inside the bubble rather than beside a flex row');
      assert.equal(await page.evaluate(() => window.calls.length), 0, 'old received/sent messages stay manual');
      await page.locator('#old-received .chat-translator-incoming').getByRole('button', { name: 'Dịch tin này', exact: true }).click();
      await page.waitForFunction(() => window.calls.length === 1);
      assert.equal(await page.evaluate(() => window.calls[0].text), 'Hello synthetic friend\nSecond line');
      await page.waitForTimeout(1100);
      await page.evaluate((html) => document.querySelector('[data-test-list]').insertAdjacentHTML('beforeend', html),
        zaloBubble('new-received', 'New received text', false, container) + zaloBubble('new-sent', 'New sent text', true, container));
      await page.waitForFunction(() => window.calls.length === 3, null, { timeout: 2500 });
      assert.deepEqual(await page.evaluate(() => window.calls.slice(1).map(({ text, mode, targetLang, manual }) => ({ text, mode, targetLang, manual }))), [
        { text: 'New received text', mode: 'incoming', targetLang: 'vi', manual: false },
        { text: 'New sent text', mode: 'incoming', targetLang: 'vi', manual: false },
      ]);
      await page.waitForFunction(() => document.querySelector('#new-received .chat-translator-incoming').shadowRoot.querySelector('.translation').textContent === 'vi: New received text');
      assert.equal(await page.locator('.chat-translator-incoming').count(), 4);
      await page.waitForTimeout(250);
      assert.equal(await page.evaluate(() => window.calls.length), 3);
    } finally { await page.close(); }
  });
}

test('zalo custom blocks keep line breaks, emoji, and one translation per bubble', async () => {
  const page = await pageFor('zalo', {}, {
    url: 'https://chat.zalo.me/',
    html: '<style>div-15{display:block}</style><section class="message-view"><article class="chat-message" id="custom-block"><div class="card"><div class="text-message__container"><div-15><span-15>First <b>synthetic</b> line</span-15></div-15><div-15>Second <img alt="😊"></div-15></div><div class="card-send-time">10:00</div></div></article></section><div id="richInput" contenteditable="true"></div>',
  });
  try {
    assert.equal((await page.evaluate(() => window.command({ action: 'inspectChat' }))).messages, 1);
    await page.locator('.chat-translator-incoming').getByRole('button', { name: 'Dịch tin này', exact: true }).click();
    await page.waitForFunction(() => window.calls.length === 1);
    assert.equal(await page.evaluate(() => window.calls[0].text), 'First synthetic line\nSecond 😊');
    await page.waitForTimeout(250);
    assert.equal(await page.evaluate(() => window.calls.length), 1);
  } finally { await page.close(); }
});

test('unrecognized Zalo message can be selected for a text-free structural report without translation or page actions', async () => {
  const page = await pageFor('zalo', {}, {
    url: 'https://chat.zalo.me/?private-room=synthetic-room',
    html: '<main class="conversation-panel" id="private-user-id"><section class="chat-scroll"><article class="bubble-row sent"><div class="bubble-body" data-secret="private-attribute"><span class="bubble-text" title="Private title">Private synthetic message</span><img alt="Private attachment" src="private-photo.png"></div></article></section><div id="richInput" contenteditable="true">Private synthetic draft</div></main>',
  });
  try {
    assert.equal((await page.evaluate(() => window.command({ action: 'inspectChat' }))).messages, 0);
    await page.evaluate(() => {
      window.pageClicks = 0;
      document.querySelector('.bubble-text').addEventListener('click', () => window.pageClicks++);
      window.contentListener({ action: 'startMessageDiagnostic' }, {}, () => {});
    });
    const panel = page.locator('.chat-translator-diagnostic');
    await panel.waitFor({ timeout: 1500 });
    await page.locator('.bubble-text').click();
    const raw = await panel.locator('textarea').inputValue();
    const report = JSON.parse(raw);
    assert.equal(report.platform, 'zalo');
    assert.equal(report.recognizedMessages, 0);
    assert.equal(report.composers, 1);
    assert.deepEqual(report.selected.ancestors[0], { tag: 'span', classes: ['bubble-text'] });
    assert.ok(report.selected.ancestors.some((node) => node.classes.includes('chat-scroll')));
    for (const privateValue of ['Private', 'private-', 'synthetic-test-key', 'synthetic-room', 'data-secret', 'richInput']) {
      assert.equal(raw.includes(privateValue), false, `report must omit text, keys, IDs, URLs and attribute values: ${privateValue}`);
    }
    assert.equal(await page.evaluate(() => window.pageClicks), 0, 'selecting a message must intercept the site click');
    assert.equal(await page.evaluate(() => window.calls.length), 0, 'diagnostics must never call translation');
    assert.equal(await page.locator('#richInput').innerText(), 'Private synthetic draft');
    await panel.getByRole('button', { name: 'Đóng', exact: true }).click();
    assert.equal(await panel.count(), 0);
    await page.locator('.bubble-text').click();
    assert.equal(await page.evaluate(() => window.pageClicks), 1, 'normal page events resume after closing');
  } finally { await page.close(); }
});

test('diagnostic picker ignores the composer, cancels with Escape and can restart cleanly', async () => {
  const page = await pageFor('zalo', {}, { url: 'https://chat.zalo.me/', html: '<div class="bubble"><span class="bubble-text">Synthetic history</span></div><div id="richInput" contenteditable="true"></div>' });
  try {
    await page.evaluate(() => window.contentListener({ action: 'startMessageDiagnostic' }, {}, () => {}));
    const panel = page.locator('.chat-translator-diagnostic');
    await panel.waitFor({ timeout: 1500 });
    await page.locator('#richInput').click();
    assert.equal(await panel.locator('textarea').isVisible(), false);
    await page.keyboard.press('Escape');
    assert.equal(await panel.count(), 0);
    await page.evaluate(() => {
      window.contentListener({ action: 'startMessageDiagnostic' }, {}, () => {});
      window.contentListener({ action: 'startMessageDiagnostic' }, {}, () => {});
    });
    assert.equal(await panel.count(), 1);
    await page.locator('.bubble-text').click();
    await panel.locator('textarea').waitFor();
    assert.equal(await page.evaluate(() => window.calls.length), 0);
  } finally { await page.close(); }
});

test('Zalo data-component text bodies work without card wrappers and keep old messages manual', async () => {
  const bubble = (id, text, own = false) => `<article class="chat-message${own ? ' me' : ''}" id="${id}"><div class="overflow-hidden" data-component="message-text-content"><span-15 data-component="text-container"><span class="text">${text}</span></span-15></div></article>`;
  const page = await pageFor('zalo', {}, {
    url: 'https://chat.zalo.me/',
    html: `<section id="messageViewContainer">${bubble('old-marker', 'Synthetic historical text')}</section><div id="richInput" contenteditable="true"></div>`,
  });
  try {
    assert.equal((await page.evaluate(() => window.command({ action: 'inspectChat' }))).messages, 1);
    assert.equal(await page.locator('.chat-translator-incoming').count(), 1, 'one result per body, without translating each nested marker');
    assert.equal(await page.evaluate(() => window.calls.length), 0);
    await page.waitForTimeout(1100);
    await page.evaluate((html) => document.querySelector('#messageViewContainer').insertAdjacentHTML('beforeend', html), bubble('new-marker-in', 'Synthetic received marker') + bubble('new-marker-out', 'Synthetic sent marker', true));
    await page.waitForFunction(() => window.calls.length === 2, null, { timeout: 2000 });
    assert.deepEqual(await page.evaluate(() => window.calls.map(({ text, mode, targetLang }) => ({ text, mode, targetLang }))), [
      { text: 'Synthetic received marker', mode: 'incoming', targetLang: 'vi' },
      { text: 'Synthetic sent marker', mode: 'incoming', targetLang: 'vi' },
    ]);
    await page.locator('#old-marker .chat-translator-incoming').getByRole('button', { name: 'Dịch tin này', exact: true }).click();
    await page.waitForFunction(() => window.calls.length === 3);
    assert.equal(await page.evaluate(() => window.calls[2].text), 'Synthetic historical text');
  } finally { await page.close(); }
});

test('popup offers diagnostic selection when zero messages are recognized, without bulk translation or saving', async () => {
  const page = await popupFor({ openAiKey: 'synthetic-test-key' }, { success: true, platform: 'Zalo Web', messages: 0 });
  try {
    await page.getByRole('button', { name: 'Kiểm tra nhận diện', exact: true }).click({ timeout: 1500 });
    assert.deepEqual(await page.evaluate(() => window.commands.map(({ action }) => action)), ['inspectChat', 'startMessageDiagnostic']);
    assert.equal(await page.evaluate(() => window.saved.openAiKey), 'synthetic-test-key');
  } finally { await page.close(); }
});

function markedZaloMessage(id, text, own = false) {
  return `<article class="bubble-row" style="display:flex;justify-content:${own ? 'flex-end' : 'flex-start'}"><div class="bubble-body"><div class="overflow-hidden" data-component="message-text-content"><span-15 id="mtc-${id}" data-component="text-container"><span class="text">${text}</span></span-15></div></div></article>`;
}

test('Zalo component markers share a conversation scope when all legacy root and row classes are absent', async () => {
  const page = await pageFor('zalo', {}, {
    url: 'https://chat.zalo.me/',
    html: `<main style="width:600px"><header class="header-title">Synthetic room</header><section class="chat-scroll">${markedZaloMessage('old-marker', 'Synthetic old history')}</section><footer><div id="richInput" contenteditable="true"></div></footer></main>`,
  });
  try {
    assert.equal((await page.evaluate(() => window.command({ action: 'inspectChat' }))).messages, 1);
    assert.equal(await page.evaluate(() => window.calls.length), 0);
    await page.waitForTimeout(1100);
    await page.evaluate((html) => document.querySelector('.chat-scroll').insertAdjacentHTML('beforeend', html), markedZaloMessage('live-received', 'Synthetic live received') + markedZaloMessage('live-sent', 'Synthetic live sent', true));
    await page.waitForFunction(() => window.calls.length === 2, null, { timeout: 2000 });
    assert.deepEqual(await page.evaluate(() => window.calls.map(({ text, mode, targetLang }) => ({ text, mode, targetLang }))), [
      { text: 'Synthetic live received', mode: 'incoming', targetLang: 'vi' },
      { text: 'Synthetic live sent', mode: 'incoming', targetLang: 'vi' },
    ]);
    await page.evaluate((html) => { document.querySelector('.chat-scroll').innerHTML = html; }, markedZaloMessage('old-marker', 'Synthetic old history') + markedZaloMessage('live-received', 'Synthetic live received') + markedZaloMessage('live-sent', 'Synthetic live sent', true));
    await page.waitForTimeout(500);
    assert.equal(await page.evaluate(() => window.calls.length), 2, 'mtc IDs retain identity when unknown rows rerender');
    await page.evaluate((html) => document.querySelector('.chat-scroll').insertAdjacentHTML('afterbegin', html), markedZaloMessage('older-marker', 'Synthetic older history'));
    await page.waitForTimeout(500);
    assert.equal(await page.evaluate(() => window.calls.length), 2, 'prepending history must remain manual');
    await page.evaluate((html) => {
      document.querySelector('.header-title').textContent = 'Another synthetic room';
      document.querySelector('.chat-scroll').innerHTML = html;
    }, markedZaloMessage('other-history', 'Another room history'));
    await page.waitForTimeout(1100);
    assert.equal(await page.evaluate(() => window.calls.length), 2, 'switching conversations must remain manual');
    await page.evaluate((html) => document.querySelector('.chat-scroll').insertAdjacentHTML('beforeend', html), markedZaloMessage('other-new', 'New in another room'));
    await page.waitForFunction(() => window.calls.length === 3, null, { timeout: 2000 });
  } finally { await page.close(); }
});

test('Zalo empty conversation tracks its first new component message without requiring a legacy root', async () => {
  const page = await pageFor('zalo', {}, { url: 'https://chat.zalo.me/', html: '<main><section class="chat-scroll"></section><footer><div id="richInput" contenteditable="true"></div></footer></main>' });
  try {
    await page.waitForTimeout(1100);
    await page.evaluate((html) => document.querySelector('.chat-scroll').insertAdjacentHTML('beforeend', html), markedZaloMessage('first-live', 'Synthetic first live message'));
    await page.waitForFunction(() => window.calls.length === 1, null, { timeout: 2000 });
    assert.equal(await page.evaluate(() => window.calls[0].manual), false);
  } finally { await page.close(); }
});

test('Zalo component messages remain manual when a legacy list class disappears or returns', async () => {
  const page = await pageFor('zalo', {}, { url: 'https://chat.zalo.me/', html: `<main><section class="message-view">${markedZaloMessage('existing', 'Synthetic existing history')}</section><div id="richInput" contenteditable="true"></div></main>` });
  try {
    await page.waitForTimeout(1100);
    await page.evaluate(() => { document.querySelector('section').className = 'chat-scroll'; });
    await page.waitForTimeout(450);
    assert.equal(await page.evaluate(() => window.calls.length), 0);
    await page.evaluate(() => { document.querySelector('section').className = 'message-view'; });
    await page.waitForTimeout(450);
    assert.equal(await page.evaluate(() => window.calls.length), 0);
    await page.evaluate((html) => document.querySelector('section').insertAdjacentHTML('beforeend', html), markedZaloMessage('later', 'Synthetic later received'));
    await page.waitForFunction(() => window.calls.length === 1, null, { timeout: 2000 });
    assert.equal(await page.evaluate(() => window.calls[0].text), 'Synthetic later received');
  } finally { await page.close(); }
});

function messengerRow(id, text, marker = true) {
  return `<div role="row" data-message-id="${id}"><a role="link" href="https://www.facebook.com/synthetic-profile"><span dir="auto">Synthetic sender</span></a><div role="gridcell"${marker ? ' data-scope="messages_table"' : ''}>
    <div class="html-div" dir="auto" style="white-space:pre-wrap">${text}</div>
    <time dir="auto">12:00</time><div role="button"><span dir="auto">React</span></div></div></div>`;
}

for (const [site, url] of [['facebook', 'https://www.facebook.com/messages/t/synthetic/'], ['messenger', 'https://www.messenger.com/e2ee/t/synthetic/']]) {
  for (const marker of [true, false]) {
    test(`${site} modern ${marker ? 'cell-scope' : 'ARIA-grid'}: manual history, automatic received/sent, localized draft and Tab`, async () => {
      const page = await pageFor('messenger', { incomingTargetLang: 'vi', outgoingTargetLang: 'en' }, {
        url,
        html: `<aside role="navigation"><div role="grid" aria-label="Chats"><div role="row"><div role="gridcell"><a href="/t/sidebar"><div class="html-div" dir="auto">Sidebar preview</div></a></div></div></div><input type="search"></aside>
          <main role="main"><h2>Synthetic chat</h2><section role="grid" id="modern-messages">
            ${messengerRow('old-received', 'Old <span dir="auto">formatted</span> message<br>Second line <img alt="😊">', marker)}${messengerRow('old-sent', 'Old sent message', marker)}
          </section><div role="textbox" contenteditable="true" data-lexical-editor="true" aria-label="Schreibe eine Nachricht"></div></main>`,
      });
      try {
        const inspection = await page.evaluate(() => window.command({ action: 'inspectChat' }));
        assert.equal(inspection.messages, 2, 'only actual message bodies, without sender/time/buttons/sidebar');
        assert.equal(inspection.composers, 1, 'Lexical composer recognition must not depend on UI language');
        assert.equal(await page.evaluate(() => window.calls.length), 0);
        await page.locator('[data-message-id=old-received] .chat-translator-incoming').getByRole('button', { name: 'Dịch tin này', exact: true }).click();
        await page.waitForFunction(() => window.calls.length === 1);
        assert.equal(await page.evaluate(() => window.calls[0].text), 'Old formatted message\nSecond line 😊', 'retain all inline text rather than translating a nested span alone');
        await page.waitForTimeout(1100);
        await page.evaluate((html) => document.querySelector('#modern-messages').insertAdjacentHTML('beforeend', html), messengerRow('live-received', 'Synthetic live received', marker) + messengerRow('live-sent', 'Synthetic live sent', marker));
        await page.waitForFunction(() => window.calls.length === 3, null, { timeout: 2200 });
        assert.ok(await page.evaluate(() => window.calls.slice(1).every((call) => call.mode === 'incoming' && call.targetLang === 'vi' && call.manual === false)));
        const editor = page.locator('[data-lexical-editor=true]');
        await editor.fill('Synthetic localized draft');
        await page.waitForFunction(() => document.querySelector('.chat-translator-preview')?.shadowRoot.querySelector('.translation').textContent === 'en: Synthetic localized draft', null, { timeout: 2200 });
        await editor.press('Tab');
        assert.equal(await editor.innerText(), 'en: Synthetic localized draft');
        assert.equal(await page.evaluate(() => window.sent), 0);
        await page.evaluate((html) => document.querySelector('#modern-messages').insertAdjacentHTML('afterbegin', html), messengerRow('older-history', 'Synthetic older history', marker));
        await page.waitForTimeout(450);
        assert.equal(await page.evaluate(() => window.calls.length), 4, 'prepending history never triggers automatic translation');
        assert.equal(await page.locator('.chat-translator-incoming').count(), 5);
      } finally { await page.close(); }
    });
  }
}

test('Messenger empty thread recognizes a localized composer and translates its first message', async () => {
  const page = await pageFor('messenger', {}, { url: 'https://www.messenger.com/t/empty/', html: '<main role="main"><section role="grid" id="empty-grid"></section><div role="textbox" contenteditable="true" data-lexical-editor="true" aria-label="Écrire à Synthetic"></div></main>' });
  try {
    assert.equal((await page.evaluate(() => window.command({ action: 'inspectChat' }))).composers, 1);
    await page.waitForTimeout(1100);
    await page.evaluate((html) => document.querySelector('#empty-grid').insertAdjacentHTML('beforeend', html), messengerRow('first', 'Synthetic first Messenger message'));
    await page.waitForFunction(() => window.calls.length === 1, null, { timeout: 2200 });
  } finally { await page.close(); }
});

test('Messenger text bodies without table/grid hooks survive adding or removing a grid without retranslation', async () => {
  const page = await pageFor('messenger', {}, { url: 'https://www.messenger.com/t/fallback/', html: '<main role="main"><section id="fallback-list"><div class="html-div" dir="auto" style="white-space:pre-wrap">Synthetic old plaintext</div></section><div role="textbox" contenteditable="true" data-lexical-editor="true" aria-label="Aa"></div></main>' });
  try {
    assert.equal((await page.evaluate(() => window.command({ action: 'inspectChat' }))).messages, 1);
    await page.waitForTimeout(1100);
    await page.evaluate(() => document.querySelector('#fallback-list').setAttribute('role', 'grid'));
    await page.waitForTimeout(400);
    assert.equal(await page.evaluate(() => window.calls.length), 0);
    await page.evaluate(() => document.querySelector('#fallback-list').removeAttribute('role'));
    await page.waitForTimeout(400);
    assert.equal(await page.evaluate(() => window.calls.length), 0);
    await page.evaluate(() => document.querySelector('#fallback-list').insertAdjacentHTML('beforeend', '<div class="html-div" dir="auto" style="white-space:pre-wrap">Synthetic live plaintext</div>'));
    await page.waitForFunction(() => window.calls.length === 1, null, { timeout: 2200 });
  } finally { await page.close(); }
});

test('Facebook feed grids and localized comment editors never become chat messages or composers', async () => {
  const page = await pageFor('messenger', {}, { url: 'https://www.facebook.com/', html: '<main role="main"><section role="grid" aria-label="Photos"><div role="row"><div role="gridcell"><div class="html-div" dir="auto">Synthetic post</div></div></div></section><div role="dialog"><div role="textbox" contenteditable="true" data-lexical-editor="true" aria-label="Viết bình luận"></div></div></main>' });
  try {
    const inspection = await page.evaluate(() => window.command({ action: 'inspectChat' }));
    assert.equal(inspection.messages, 0);
    assert.equal(inspection.composers, 0);
    await page.locator('[contenteditable=true]').fill('Synthetic private comment');
    await page.waitForTimeout(700);
    assert.equal(await page.evaluate(() => window.calls.length), 0);
  } finally { await page.close(); }
});

test('Messenger header/status/sidebar text does not become a message when list markers are absent', async () => {
  const page = await pageFor('messenger', {}, { url: 'https://www.messenger.com/t/synthetic/', html: '<aside role="navigation"><div class="html-div" dir="auto" style="white-space:pre-wrap">Synthetic preview</div></aside><main role="main"><header><div class="html-div" dir="auto" style="white-space:pre-wrap">Synthetic peer</div></header><div class="html-div" dir="auto">Generic interface text</div><section id="plaintext"></section><div role="status"><div class="html-div" dir="auto" style="white-space:pre-wrap">Synthetic typing status</div></div><div role="textbox" contenteditable="true" data-lexical-editor="true" aria-label="Aa"></div></main>' });
  try {
    assert.equal((await page.evaluate(() => window.command({ action: 'inspectChat' }))).messages, 0);
    await page.waitForTimeout(1100);
    await page.evaluate(() => {
      document.querySelector('[role=status]').insertAdjacentHTML('beforeend', '<div class="html-div" dir="auto" style="white-space:pre-wrap">Synthetic delivery status</div>');
      document.querySelector('#plaintext').insertAdjacentHTML('beforeend', '<div class="html-div" dir="auto" style="white-space:pre-wrap">Synthetic actual plaintext</div>');
    });
    await page.waitForFunction(() => window.calls.length === 1, null, { timeout: 2200 });
    assert.equal(await page.evaluate(() => window.calls[0].text), 'Synthetic actual plaintext');
  } finally { await page.close(); }
});

test('Facebook floating Messenger recognizes its localized composer while an active feed stays untouched', async () => {
  const page = await pageFor('messenger', {}, { url: 'https://www.facebook.com/', html: `<main role="main"><section role="grid"><div role="row"><div role="gridcell"><div class="html-div" dir="auto">Synthetic feed post</div></div></div></section><div contenteditable="true" role="textbox" data-lexical-editor="true" aria-label="Write a comment"></div><section data-testid="mwchat-tab"><h2>Synthetic popup chat</h2><div id="popup-log">${messengerRow('old-popup', 'Synthetic popup history')}</div><div contenteditable="true" role="textbox" data-lexical-editor="true" aria-label="Aa"></div></section></main>` });
  try {
    const inspection = await page.evaluate(() => window.command({ action: 'inspectChat' }));
    assert.equal(inspection.messages, 1);
    assert.equal(inspection.composers, 1);
    await page.waitForTimeout(1100);
    await page.evaluate((html) => document.querySelector('#popup-log').insertAdjacentHTML('beforeend', html), messengerRow('live-popup', 'Synthetic live popup'));
    await page.waitForFunction(() => window.calls.length === 1, null, { timeout: 2200 });
    await page.locator('[aria-label="Write a comment"]').fill('Synthetic comment while chat open');
    await page.waitForTimeout(700);
    assert.equal(await page.evaluate(() => window.calls.length), 1);
    assert.equal(await page.locator('.chat-translator-preview').count(), 1);
  } finally { await page.close(); }
});

test('Messenger semantic hooks added after mount are detected without text or child mutations', async () => {
  const page = await pageFor('messenger', {}, { url: 'https://www.messenger.com/t/late-hooks/', html: '<main role="main"><section id="late-list"><div id="late-row" data-message-id="old" data-timestamp="1000000000000"><div id="late-cell"><span id="late-text" dir="ltr">Synthetic preexisting history</span></div></div></section><div id="late-editor" contenteditable="true" data-lexical-editor="true" aria-label="Aa"></div></main>' });
  try {
    const initial = await page.evaluate(() => window.command({ action: 'inspectChat' }));
    assert.equal(initial.messages, 0);
    assert.equal(initial.composers, 0);
    await page.waitForTimeout(1100);
    await page.evaluate(() => {
      document.querySelector('#late-list').setAttribute('role', 'grid');
      document.querySelector('#late-row').setAttribute('role', 'row');
      document.querySelector('#late-cell').setAttribute('role', 'gridcell');
      document.querySelector('#late-cell').setAttribute('data-scope', 'messages_table');
      document.querySelector('#late-text').setAttribute('dir', 'auto');
      document.querySelector('#late-editor').setAttribute('role', 'textbox');
    });
    await page.locator('.chat-translator-incoming').waitFor({ timeout: 1800 });
    assert.equal(await page.evaluate(() => window.calls.length), 0, 'a historical timestamp remains manual despite late rendering');
    assert.equal((await page.evaluate(() => window.command({ action: 'inspectChat' }))).composers, 1);
  } finally { await page.close(); }
});
