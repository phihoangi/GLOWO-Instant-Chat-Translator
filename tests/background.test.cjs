const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

function worker(options = {}) {
  const requests = [];
  const settings = { openAiKey: 'synthetic-test-key', ...options.settings };
  let listener;
  let storageListener;
  const context = vm.createContext({
    AbortController, setTimeout, clearTimeout,
    chrome: {
      storage: { local: { get: (_keys, callback) => callback(settings) }, onChanged: { addListener: (fn) => { storageListener = fn; } } },
      runtime: { onMessage: { addListener: (fn) => { listener = fn; } } },
    },
    fetch: async (_url, request) => {
      requests.push(JSON.parse(request.body));
      if (options.fetch) return options.fetch(request);
      return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(options.result || { translatedText: 'Synthetic translation', detectedLanguage: 'en' }) }, finish_reason: 'stop' }] }) };
    },
  });
  context.importScripts = (...files) => files.forEach((file) => vm.runInContext(readFileSync(join(__dirname, '../background', file), 'utf8'), context));
  vm.runInContext(readFileSync(join(__dirname, '../background/service-worker.js'), 'utf8'), context);
  return {
    requests,
    changeSettings(changes) {
      Object.assign(settings, changes);
      storageListener(Object.fromEntries(Object.entries(changes).map(([key, newValue]) => [key, { newValue }])), 'local');
    },
    translate: (payload) => new Promise((resolve) => listener({ action: 'translate', payload }, {}, resolve)),
  };
}

for (const [code, language] of [['vi', 'Vietnamese'], ['en', 'English']]) {
  test(`incoming target is ${language}`, async () => {
    const app = worker();
    assert.equal((await app.translate({ text: 'Synthetic message', mode: 'incoming', targetLang: code })).success, true);
    assert.match(app.requests[0].messages[0].content, new RegExp(`into ${language}`));
  });
}

test('outgoing detects source and supports Vietnamese as target', async () => {
  const app = worker();
  await app.translate({ text: 'Synthetic message', mode: 'outgoing', targetLang: 'vi' });
  assert.match(app.requests[0].messages[0].content, /into Vietnamese/);
  assert.doesNotMatch(app.requests[0].messages[0].content, /Translate the Vietnamese message/);
});

test('limits concurrent requests and prioritizes previews over queued history', async () => {
  const pending = [];
  const app = worker({ fetch: () => new Promise((resolve) => pending.push(() => resolve({ ok: true, json: async () => ({ choices: [{ message: { content: '{"translatedText":"Synthetic translation"}' }, finish_reason: 'stop' }] }) }))) });
  const jobs = ['First', 'Second', 'Third'].map((text) => app.translate({ text, targetLang: 'vi', mode: 'incoming' }));
  jobs.push(app.translate({ text: 'Draft', targetLang: 'en', mode: 'outgoing' }));
  await new Promise(setImmediate);
  assert.equal(app.requests.length, 2);
  pending.shift()();
  await new Promise(setImmediate);
  assert.equal(app.requests[2].messages[1].content, 'Draft');
  pending.shift()();
  await new Promise(setImmediate);
  pending.splice(0).forEach((finish) => finish());
  assert.ok((await Promise.all(jobs)).every((result) => result.success));
});

test('switching off prevents queued translations from reaching OpenAI', async () => {
  const pending = [];
  const app = worker({ fetch: () => new Promise((resolve) => pending.push(() => resolve({ ok: true, json: async () => ({ choices: [{ message: { content: '{"translatedText":"Synthetic translation"}' } }] }) }))) });
  const jobs = ['First', 'Second', 'Queued'].map((text) => app.translate({ text, targetLang: 'vi', mode: 'incoming' }));
  await new Promise(setImmediate);
  assert.equal(app.requests.length, 2);
  app.changeSettings({ enabled: false });
  pending.splice(0).forEach((finish) => finish());
  const results = await Promise.all(jobs);
  assert.equal(results[2].success, false);
  assert.equal(app.requests.length, 2);
});

test('API errors and truncated outputs never become usable translations', async () => {
  for (const response of [
    { ok: false, status: 401, json: async () => ({}) },
    { ok: false, status: 429, json: async () => ({}) },
    { ok: true, json: async () => ({ choices: [{ finish_reason: 'length', message: { content: '{"translatedText":"Partial"}' } }] }) },
    { ok: true, json: async () => ({ choices: [{ message: { content: 'Not JSON' } }] }) },
  ]) {
    const app = worker({ fetch: async () => response });
    const result = await app.translate({ text: 'Synthetic message', targetLang: 'vi', mode: 'incoming' });
    assert.equal(result.success, false);
    assert.equal(typeof result.error, 'string');
    assert.ok(result.error.length > 0);
  }
});

test('invalid targets fail before sending any request', async () => {
  const app = worker();
  assert.equal((await app.translate({ text: 'Synthetic message', targetLang: 'invalid', mode: 'incoming' })).success, false);
  assert.equal(app.requests.length, 0);
});

test('missing key and disabled translation make no API requests', async () => {
  for (const settings of [{ openAiKey: '' }, { enabled: false }, { autoTranslateIncoming: false }]) {
    const app = worker({ settings });
    assert.equal((await app.translate({ text: 'Synthetic message', mode: 'incoming', targetLang: 'vi' })).success, false);
    assert.equal(app.requests.length, 0);
  }
});

test('invalid translation output fails clearly', async () => {
  for (const translatedText of ['', 42, { text: 'invalid' }]) {
    const app = worker({ result: { translatedText } });
    assert.equal((await app.translate({ text: 'Synthetic message', mode: 'incoming', targetLang: 'vi' })).success, false);
  }
});

test('manual incoming translation works while auto incoming is off', async () => {
  const app = worker({ settings: { autoTranslateIncoming: false } });
  const payload = { text: 'Synthetic old message', mode: 'incoming', targetLang: 'vi' };
  assert.equal((await app.translate(payload)).success, false);
  assert.equal((await app.translate({ ...payload, manual: true })).success, true);
  assert.equal(app.requests.length, 1);
});

test('manual sent-message translation works while outgoing automation is off', async () => {
  const app = worker({ settings: { autoTranslateOutgoing: false } });
  const payload = { text: 'Synthetic sent message', mode: 'outgoing', targetLang: 'en' };
  assert.equal((await app.translate(payload)).success, false);
  assert.equal((await app.translate({ ...payload, manual: true })).success, true);
  assert.equal(app.requests.length, 1);
});

test('translate all explicitly bypasses cached results', async () => {
  const app = worker();
  const payload = { text: 'Synthetic old message', mode: 'incoming', targetLang: 'vi', manual: true };
  await app.translate(payload);
  await app.translate(payload);
  assert.equal(app.requests.length, 1);
  await app.translate({ ...payload, force: true });
  assert.equal(app.requests.length, 2);
});

test('identical in-flight requests and cached translations share one API call', async () => {
  const app = worker();
  const payload = { text: 'Synthetic message', mode: 'incoming', targetLang: 'vi' };
  const results = await Promise.all([app.translate(payload), app.translate(payload)]);
  assert.ok(results.every((result) => result.success));
  await app.translate(payload);
  assert.equal(app.requests.length, 1);
  await app.translate({ ...payload, targetLang: 'en' });
  assert.equal(app.requests.length, 2);
});
