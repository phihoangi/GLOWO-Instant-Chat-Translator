const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolve } = require('node:path');
const { readFileSync } = require('node:fs');
const { chromium } = require('@playwright/test');

test('packaged MV3 extension: native Chrome DOM API discovers a closed LinkedIn chat; real runtime translates and Tab replaces without sending', async () => {
  // A separate temporary Chrome profile; no access to the user's browser session.
  // The platform page and OpenAI response are both synthetic and served offline.
  const context = await chromium.launchPersistentContext('', {
    channel: 'chrome', headless: true,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: ['--enable-unsafe-extension-debugging'],
  });
  try {
    const session = await context.browser().newBrowserCDPSession();
    const { id } = await session.send('Extensions.loadUnpacked', { path: resolve(__dirname, '..') });
    assert.ok(id);
    const worker = context.serviceWorkers().find((worker) => worker.url().includes(id)) || await context.waitForEvent('serviceworker', { predicate: (worker) => worker.url().includes(id), timeout: 5000 });
    await worker.evaluate(async () => {
      globalThis.syntheticApiCalls = [];
      globalThis.fetch = async (_url, options) => {
        const request = JSON.parse(options.body);
        const text = request.messages.find((message) => message.role === 'user').content;
        const prompt = request.messages.find((message) => message.role === 'system').content;
        const language = prompt.includes('into Vietnamese') ? 'vi' : 'en';
        globalThis.syntheticApiCalls.push({ text, language });
        return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ translatedText: `${language}: ${text}`, detectedLanguage: 'en' }) } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      };
      await chrome.storage.local.set({ openAiKey: 'synthetic-extension-test-key', enabled: true, autoTranslateIncoming: true, autoTranslateOutgoing: true, incomingTargetLang: 'vi', outgoingTargetLang: 'en' });
    });
    const page = await context.newPage();
    await page.route('**/*', (route) => route.fulfill({
      contentType: 'text/html; charset=utf-8',
      headers: { 'Content-Security-Policy': "require-trusted-types-for 'script'; trusted-types 'none'" },
      body: '<!doctype html><html><head></head><body><main>Synthetic feed</main><div id="interop-outlet"></div></body></html>',
    }));
    await page.goto('https://www.linkedin.com/feed/synthetic-extension-test/');
    await page.evaluate(() => {
      const root = document.querySelector('#interop-outlet').attachShadow({ mode: 'closed' });
      window.syntheticRoot = root;
      const shell = document.createElement('section');
      shell.className = 'msg-overlay-conversation-bubble';
      const list = document.createElement('div');
      list.id = 'messages';
      list.className = 'msg-s-message-list';
      const old = document.createElement('p');
      old.className = 'msg-s-event-listitem__body';
      old.textContent = 'Synthetic closed-root history';
      list.append(old);
      const form = document.createElement('form');
      form.className = 'msg-form';
      const editor = document.createElement('div');
      editor.id = 'draft';
      editor.className = 'msg-form__contenteditable';
      editor.contentEditable = 'true';
      editor.setAttribute('aria-label', 'Write a message');
      editor.style.cssText = 'min-height:100px;width:400px';
      const send = document.createElement('button');
      send.type = 'submit';
      send.textContent = 'Send';
      window.sent = 0;
      form.addEventListener('submit', (event) => { event.preventDefault(); window.sent++; });
      form.append(editor, send);
      shell.append(list, form);
      root.append(shell);
    });
    await page.waitForFunction(() => window.syntheticRoot.querySelector('.chat-translator-incoming'), null, { timeout: 5000 });
    const inspection = await worker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ url: 'https://www.linkedin.com/*' });
      return chrome.tabs.sendMessage(tab.id, { action: 'inspectChat' });
    });
    assert.equal(inspection.messages, 1);
    assert.equal(inspection.composers, 1);
    assert.equal(inspection.shadowRoots, 1, 'real chrome.dom API, with no mock for closed-root access');
    assert.equal(inspection.contentVersion, JSON.parse(readFileSync(resolve(__dirname, '../manifest.json'), 'utf8')).version);
    await page.waitForTimeout(1100);
    assert.deepEqual(await worker.evaluate(() => globalThis.syntheticApiCalls), []);
    await page.evaluate(() => {
      const message = document.createElement('p');
      message.className = 'msg-s-event-listitem__body';
      message.textContent = 'Synthetic closed-root arrival';
      window.syntheticRoot.querySelector('#messages').append(message);
    });
    await page.waitForFunction(() => [...window.syntheticRoot.querySelectorAll('.chat-translator-incoming')].some((host) => host.shadowRoot.querySelector('.translation').textContent === 'vi: Synthetic closed-root arrival'), null, { timeout: 5000 });
    assert.deepEqual(await worker.evaluate(() => globalThis.syntheticApiCalls), [{ text: 'Synthetic closed-root arrival', language: 'vi' }]);
    await page.evaluate(() => window.syntheticRoot.querySelector('#draft').focus());
    await page.keyboard.insertText('Synthetic closed-root draft');
    await page.waitForFunction(() => document.querySelector('.chat-translator-preview')?.shadowRoot.querySelector('.translation').textContent === 'en: Synthetic closed-root draft', null, { timeout: 5000 });
    assert.equal(await page.locator('.chat-translator-preview').isVisible(), true);
    await page.keyboard.press('Tab');
    await page.waitForFunction(() => window.syntheticRoot.querySelector('#draft').innerText === 'en: Synthetic closed-root draft');
    assert.equal(await page.evaluate(() => window.sent), 0);
    await page.keyboard.press('Control+z');
    assert.equal(await page.evaluate(() => window.syntheticRoot.querySelector('#draft').innerText), 'Synthetic closed-root draft');
    assert.deepEqual(await worker.evaluate(() => globalThis.syntheticApiCalls), [
      { text: 'Synthetic closed-root arrival', language: 'vi' },
      { text: 'Synthetic closed-root draft', language: 'en' },
    ]);
    await worker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ url: 'https://www.linkedin.com/*' });
      return chrome.tabs.sendMessage(tab.id, { action: 'startMessageDiagnostic' });
    });
    await page.evaluate(() => window.syntheticRoot.querySelector('#messages p').click());
    const report = JSON.parse(await page.locator('.chat-translator-diagnostic').locator('textarea').inputValue());
    assert.equal(report.shadowRoots, 1);
    assert.equal(report.selected.ancestors[0].tag, 'p');
    assert.ok(!JSON.stringify(report).includes('Synthetic closed-root history'));
    assert.ok(!JSON.stringify(report).includes('synthetic-extension-test-key'));
    assert.equal((await worker.evaluate(() => globalThis.syntheticApiCalls)).length, 2);
  } finally { await context.close(); }
});
