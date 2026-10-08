document.addEventListener('DOMContentLoaded', () => {
  const { keys, normalize, languages } = ChatTranslatorSettings;
  const form = document.getElementById('settings-form');
  const master = document.getElementById('enabled');
  const incoming = document.getElementById('auto-incoming');
  const outgoing = document.getElementById('auto-outgoing');
  const incomingLang = document.getElementById('incoming-lang');
  const outgoingLang = document.getElementById('outgoing-lang');
  const keyInput = document.getElementById('openai-key');
  const keyStatus = document.getElementById('key-status');
  const keyBadge = document.getElementById('key-badge');
  const apiSettings = document.getElementById('api-settings');
  const save = document.getElementById('save-btn');
  const remove = document.getElementById('remove-key');
  const toast = document.getElementById('toast-msg');
  const status = document.getElementById('extension-status');
  const dot = document.getElementById('status-dot');
  const translateAll = document.getElementById('translate-all');
  const chatStatus = document.getElementById('chat-status');
  const diagnoseChat = document.getElementById('diagnose-chat');
  const extensionVersion = chrome.runtime.getManifest?.().version || '';
  let hasKey = false;
  let bulkBusy = false;
  let composerOnly = false;

  for (const [code, language] of Object.entries(languages)) {
    outgoingLang.add(new Option(language.label, code));
  }

  function feedback(message, error = false) {
    toast.textContent = message;
    toast.classList.toggle('error', error);
    toast.hidden = false;
  }

  function updateControls() {
    incoming.disabled = !master.checked;
    outgoing.disabled = !master.checked;
    incomingLang.disabled = !master.checked;
    outgoingLang.disabled = !master.checked || !outgoing.checked;
    translateAll.disabled = composerOnly || bulkBusy || !master.checked || !(hasKey || keyInput.value.trim());
    const active = master.checked && (incoming.checked || outgoing.checked);
    dot.className = `status-dot ${!active ? 'paused' : hasKey ? 'active' : ''}`;
    status.textContent = !active ? 'Tự dịch đang tắt' : hasKey ? 'Sẵn sàng dịch' : 'Thêm API key để bắt đầu';
  }

  function updateKeyState(saved) {
    hasKey = saved;
    keyBadge.textContent = saved ? 'Đã lưu key' : 'Chưa có key';
    keyBadge.classList.toggle('saved', saved);
    keyStatus.textContent = saved ? 'Nhập key mới để thay đổi. Key hiện tại được giữ nếu để trống.' : 'Key được lưu trong Chrome trên máy này.';
    remove.hidden = !saved;
    if (!saved) apiSettings.open = true;
    updateControls();
  }

  chrome.storage.local.get(keys, (raw) => {
    if (chrome.runtime.lastError) { feedback('Không đọc được cài đặt. Hãy mở lại extension.', true); return; }
    const settings = normalize(raw);
    master.checked = settings.enabled;
    incoming.checked = settings.autoTranslateIncoming;
    outgoing.checked = settings.autoTranslateOutgoing;
    incomingLang.value = settings.incomingTargetLang;
    outgoingLang.value = settings.outgoingTargetLang;
    updateKeyState(Boolean(settings.openAiKey));
    save.disabled = false;
  });

  [master, incoming, outgoing].forEach((control) => control.addEventListener('change', updateControls));
  form.addEventListener('input', () => { toast.hidden = true; updateControls(); });

  function saveSettings(done) {
    save.disabled = true;
    chrome.storage.local.get(['openAiKey'], (stored) => {
      if (chrome.runtime.lastError) { save.disabled = false; feedback('Không đọc được API key. Hãy thử lại.', true); done(false); return; }
      const newKey = keyInput.value.trim();
      const changes = {
        enabled: master.checked,
        autoTranslateIncoming: incoming.checked,
        autoTranslateOutgoing: outgoing.checked,
        incomingTargetLang: incomingLang.value,
        outgoingTargetLang: outgoingLang.value,
      };
      if (newKey) changes.openAiKey = newKey;
      chrome.storage.local.set(changes, () => {
        save.disabled = false;
        if (chrome.runtime.lastError) { feedback('Không lưu được cài đặt. Hãy thử lại.', true); done(false); return; }
        keyInput.value = '';
        updateKeyState(Boolean(newKey || stored.openAiKey));
        done(true);
      });
    });
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    saveSettings((success) => { if (success) feedback('Đã lưu. Cài đặt áp dụng ngay trong tab chat.'); });
  });

  function sendToActiveChat(action, done) {
    if (!chrome.tabs?.query || !chrome.tabs?.sendMessage) {
      done({ success: false, error: 'Mở extension từ tab chat để sử dụng thao tác này.' });
      return;
    }
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError || !tabs[0]?.id) { done({ success: false, error: 'Không tìm thấy tab chat đang mở.' }); return; }
      chrome.tabs.sendMessage(tabs[0].id, { action }, (response) => {
        const error = chrome.runtime.lastError;
        done(error || !response ? { success: false, error: 'Chưa kết nối được trang chat. Hãy tải lại tab sau khi Reload extension.' } : response);
      });
    });
  }

  translateAll.addEventListener('click', () => {
    if (bulkBusy) return;
    bulkBusy = true;
    updateControls();
    saveSettings((saved) => {
      if (!saved) { bulkBusy = false; updateControls(); return; }
      sendToActiveChat('translateAllIncoming', (response) => {
        bulkBusy = false;
        updateControls();
        if (!response.success) feedback(response.error, true);
        else if (!response.count) {
          diagnoseChat.hidden = false;
          feedback('Chưa nhận diện được tin nhắn. Bấm Kiểm tra nhận diện và chọn một tin trong hội thoại.', true);
        }
        else feedback(`Đang dịch lại ${response.count} tin đã tải trong tab ${response.platform}.`);
      });
    });
  });

  sendToActiveChat('inspectChat', (response) => {
    chatStatus.hidden = false;
    if (!response.success) {
      chatStatus.textContent = `Chưa kết nối tab chat${extensionVersion ? ` (extension v${extensionVersion})` : ''}. Tải lại tab sau khi Reload extension.`;
      return;
    }
    const counts = [response.messages && `${response.messages} tin nhắn`, response.composers && `${response.composers} ô soạn`].filter(Boolean);
    composerOnly = !response.messages && Boolean(response.commentComposers);
    translateAll.title = composerOnly ? 'Nút này chỉ dịch lịch sử chat. Gõ bình luận rồi nhấn Tab để thay bằng bản dịch.' : 'Dịch lại các tin đã tải trong tab chat';
    updateControls();
    diagnoseChat.hidden = Boolean(response.messages || response.commentComposers);
    const version = response.contentVersion ? ` · v${response.contentVersion}` : '';
    chatStatus.textContent = (counts.length ? `${response.platform}: nhận diện ${counts.join(', ')}` : `${response.platform}: chưa nhận diện được tin nhắn`) + version;
    if (extensionVersion && response.contentVersion !== extensionVersion) chatStatus.textContent += ` · Tải lại tab để dùng v${extensionVersion}.`;
  });

  diagnoseChat.addEventListener('click', () => {
    diagnoseChat.disabled = true;
    sendToActiveChat('startMessageDiagnostic', (response) => {
      diagnoseChat.disabled = false;
      feedback(response.success ? 'Bấm phần chữ của một tin trong trang chat, rồi sao chép báo cáo đang hiện.' : response.error, !response.success);
    });
  });

  remove.addEventListener('click', () => {
    remove.disabled = true;
    chrome.storage.local.remove('openAiKey', () => {
      remove.disabled = false;
      if (chrome.runtime.lastError) { feedback('Không xóa được key. Hãy thử lại.', true); return; }
      keyInput.value = '';
      updateKeyState(false);
      feedback('Đã xóa API key. Tự dịch dừng cho đến khi bạn thêm key.');
    });
  });
});
