(function () {
  // This is the version of the code injected into the tab, not the manifest of a
  // newly reloaded extension. It helps distinguish stale tabs from new layouts.
  const version = '1.3.10';
  let dismiss = null;
  const ownUI = '.chat-translator-diagnostic, .chat-translator-incoming, .chat-translator-preview';

  function describe(element) {
    const entry = {
      tag: element.localName,
      classes: [...element.classList]
        .filter((name) => /^[a-zA-Z_][a-zA-Z0-9_-]{0,69}$/.test(name))
        .map((name) => name.replace(/\d{4,}/g, '#')).slice(0, 12),
    };
    const component = element.getAttribute('data-component');
    if (component && /^[a-z]+(?:-[a-z]+)*$/.test(component) && component.length <= 70) entry.component = component;
    return entry;
  }

  function structure(element) {
    const ancestors = [];
    for (let node = element; node && ancestors.length < 10; node = ChatTranslatorPlatforms.dom.parent(node)) ancestors.push(describe(node));
    // Only DOM element structure and component names: no text, HTML, IDs,
    // arbitrary attribute values, URLs or images.
    let remaining = 80;
    function tree(node, depth) {
      if (remaining <= 0 || node.matches(`${ownUI}, script, style, noscript`)) return null;
      remaining--;
      const entry = describe(node);
      if (depth) entry.children = [...node.children].slice(0, 15).map((child) => tree(child, depth - 1)).filter(Boolean);
      return entry;
    }
    return { ancestors, nearby: tree(element.parentElement?.parentElement || element, 4) };
  }

  function start(summary, adapter) {
    dismiss?.();
    const host = document.createElement('div');
    host.className = 'chat-translator-diagnostic';
    host.style.cssText = 'all:initial;position:fixed;right:16px;bottom:16px;width:360px;max-width:calc(100vw - 32px);z-index:2147483647';
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
      :host{color-scheme:light}*{box-sizing:border-box}.panel{padding:16px;background:#fff;border:1px solid #d0ddd5;border-radius:12px;box-shadow:0 6px 32px #0003;color:#263c38;font:13px/1.5 system-ui,sans-serif}
      h2{margin:0 0 8px;font-size:15px}p{margin:8px 0}button{border:1px solid #ccdcd0;border-radius:6px;padding:5px 10px;background:#edf5ee;color:#236954;cursor:pointer;font:inherit}
      textarea{width:100%;height:190px;resize:vertical;font:11px/1.4 monospace}button:focus-visible,textarea:focus-visible{outline:2px solid #347b5f;outline-offset:2px}[hidden]{display:none}
    `;
    const panel = document.createElement('section');
    panel.className = 'panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Kiểm tra nhận diện tin nhắn');
    const heading = document.createElement('h2');
    heading.textContent = 'Kiểm tra nhận diện tin nhắn';
    const instruction = document.createElement('p');
    instruction.className = 'instruction';
    instruction.textContent = 'Bấm vào phần chữ của một tin đã gửi hoặc đã nhận. Nhấn Esc để hủy.';
    const privacy = document.createElement('p');
    privacy.className = 'privacy';
    privacy.textContent = 'Chỉ lấy tên thẻ, class và dấu hiệu thành phần giao diện. Không lấy nội dung tin, API key; không gọi API dịch.';
    const reportBox = document.createElement('textarea');
    reportBox.setAttribute('aria-label', 'Báo cáo nhận diện');
    reportBox.spellcheck = false;
    reportBox.readOnly = true;
    reportBox.hidden = true;
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = 'Đóng';
    panel.append(heading, instruction, privacy, reportBox, close);
    shadow.append(style, panel);
    document.body.append(host);
    let picking = true;
    const eventTargets = [window, ...ChatTranslatorPlatforms.dom.roots().filter((root) => root !== document)];
    const inside = (event) => event.composedPath().includes(host);
    // Outside a closed shadow tree the event target is its host. Let the root's
    // own capture listener select the actual message instead of reporting a div.
    const retargeted = (event, element) => eventTargets.some((root) => root.host === element && !event.composedPath().includes(root));
    const click = (event) => {
      if (inside(event) || !picking) return;
      event.preventDefault();
      const element = event.composedPath().find((node) => node instanceof Element);
      if (retargeted(event, element)) return;
      event.stopImmediatePropagation();
      if (!element || ChatTranslatorPlatforms.dom.closest(element, `${ownUI}, ${adapter.editors}, input, textarea, [contenteditable="true"]`)) return;
      picking = false;
      reportBox.value = JSON.stringify({ ...summary, contentVersion: version, selected: structure(element) }, null, 2);
      reportBox.hidden = false;
      instruction.textContent = 'Báo cáo đã được chọn. Nhấn Ctrl+C rồi dán vào cuộc trò chuyện hỗ trợ. Báo cáo chỉ nằm trong tab này đến khi bạn đóng.';
      reportBox.focus();
      reportBox.select();
    };
    const pointer = (event) => {
      if (inside(event) || !picking) return;
      event.preventDefault();
      if (retargeted(event, event.composedPath().find((node) => node instanceof Element))) return;
      event.stopImmediatePropagation();
    };
    const keydown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        dismiss?.();
      } else if (inside(event)) {
        // Keep copy/editing shortcuts in the report away from the chat hotkeys.
        event.stopImmediatePropagation();
      }
    };
    dismiss = () => {
      for (const target of eventTargets) {
        target.removeEventListener('click', click, true);
        for (const type of ['pointerdown', 'pointerup', 'mousedown', 'mouseup']) target.removeEventListener(type, pointer, true);
      }
      window.removeEventListener('keydown', keydown, true);
      host.remove();
      dismiss = null;
    };
    for (const target of eventTargets) {
      target.addEventListener('click', click, true);
      for (const type of ['pointerdown', 'pointerup', 'mousedown', 'mouseup']) target.addEventListener(type, pointer, true);
    }
    window.addEventListener('keydown', keydown, true);
    close.addEventListener('click', () => dismiss?.());
    return { success: true };
  }

  globalThis.ChatTranslatorDiagnostics = Object.freeze({ version, start });
})();
