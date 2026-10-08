const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini";
const REQUEST_TIMEOUT_MS = 30000;

function getOpenAiKey() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["openAiKey"], (result) => {
      resolve(typeof result.openAiKey === "string" ? result.openAiKey.trim() : "");
    });
  });
}

function getTranslationPrompt(payload) {
  if (payload.mode === "outgoing") {
    const languages = { ko: "Korean", ja: "Japanese", en: "English", zh: "Chinese", de: "German", fr: "French", ru: "Russian", es: "Spanish" };
    const targetLanguage = languages[payload.targetLang] || "Korean";
    return `Translate the Vietnamese message into ${targetLanguage} using natural, respectful professional language. Preserve technical terms, names, numbers, and currency. Return only a JSON object with: translatedText (string), backTranslation (string, Vietnamese translation of the result), detectedLanguage (string).`;
  }

  return "You are a professional multilingual recruiting-message translator. Detect the source language and translate the message naturally into Vietnamese. Preserve technical terms, names, numbers, and currency. Extract only details explicitly present; do not infer candidate attributes. Suggest up to two concise professional replies in the original language. Return only a JSON object with: translatedText (string), backTranslation (string), detectedLanguage (string), intent (string), keyPoints (array of strings), dealHighlights (object with salary, visa, workMode, startDate as string or null), suggestedReplies (array of strings).";
}

async function handleTranslate(payload = {}) {
  const text = typeof payload.text === "string" ? payload.text.trim() : "";
  if (!text) throw new Error("Nhập nội dung cần dịch trước.");

  const apiKey = await getOpenAiKey();
  if (!apiKey) throw new Error("Hãy thêm OpenAI API key trong phần cài đặt extension.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: getTranslationPrompt(payload) },
          { role: "user", content: text },
        ],
        max_tokens: 900,
        temperature: 0.2,
      }),
      signal: controller.signal,
    });

    const result = await response.json().catch(() => null);
    if (!response.ok) {
      const apiError = result?.error?.message;
      if (response.status === 401) throw new Error("OpenAI API key không hợp lệ.");
      if (response.status === 429) throw new Error("OpenAI hết quota hoặc đang giới hạn yêu cầu. Hãy kiểm tra billing của API key.");
      throw new Error(apiError || `OpenAI trả lỗi (${response.status}).`);
    }

    const content = result?.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenAI không trả về nội dung dịch.");
    const parsed = JSON.parse(content);
    return {
      translatedText: parsed.translatedText || "",
      backTranslation: parsed.backTranslation || (payload.mode === "incoming" ? text : ""),
      detectedLanguage: parsed.detectedLanguage || "Không xác định",
      intent: parsed.intent || "",
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
      dealHighlights: parsed.dealHighlights || { salary: null, visa: null, workMode: null, startDate: null },
      suggestedReplies: Array.isArray(parsed.suggestedReplies) ? parsed.suggestedReplies : [],
    };
  } catch (error) {
    if (error.name === "AbortError") throw new Error("Yêu cầu dịch quá thời gian. Hãy thử lại.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request?.action !== "translate") {
    sendResponse({ success: false, error: "Tính năng này không thuộc extension dịch độc lập." });
    return false;
  }

  handleTranslate(request.payload)
    .then((data) => sendResponse({ success: true, data }))
    .catch((error) => sendResponse({ success: false, error: error.message || "Không dịch được tin nhắn." }));
  return true;
});
