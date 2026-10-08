document.addEventListener("DOMContentLoaded", () => {
  const keyInput = document.getElementById("openai-key");
  const keyStatus = document.getElementById("key-status");
  const targetLang = document.getElementById("target-lang");
  const saveButton = document.getElementById("save-btn");
  const removeButton = document.getElementById("remove-key");
  const toast = document.getElementById("toast-msg");

  function showToast(message, isError = false) {
    toast.textContent = message;
    toast.style.color = isError ? "#fca5a5" : "#6ee7b7";
    toast.style.display = "block";
    setTimeout(() => { toast.style.display = "none"; }, 2400);
  }

  chrome.storage.local.get(["openAiKey", "targetLang"], (settings) => {
    targetLang.value = settings.targetLang || "ko";
    keyStatus.textContent = settings.openAiKey
      ? "Đã lưu API key trong Chrome trên máy này. Nhập key mới nếu muốn thay đổi."
      : "Chưa có key. Hãy thêm OpenAI API key để bắt đầu dịch.";
  });

  saveButton.addEventListener("click", () => {
    const newKey = keyInput.value.trim();
    chrome.storage.local.get(["openAiKey"], (settings) => {
      const changes = { targetLang: targetLang.value };
      if (newKey) changes.openAiKey = newKey;
      else if (!settings.openAiKey) {
        showToast("Hãy nhập OpenAI API key trước.", true);
        return;
      }

      chrome.storage.local.set(changes, () => {
        keyInput.value = "";
        keyStatus.textContent = "Đã lưu API key trong Chrome trên máy này. Nhập key mới nếu muốn thay đổi.";
        showToast("Đã lưu cài đặt.");
      });
    });
  });

  removeButton.addEventListener("click", () => {
    chrome.storage.local.remove("openAiKey", () => {
      keyInput.value = "";
      keyStatus.textContent = "Đã xóa key. Hãy thêm OpenAI API key để dịch.";
      showToast("Đã xóa API key.");
    });
  });
});
