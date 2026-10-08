# Chat Translator

Standalone Chrome extension for translating messages on LinkedIn and WhatsApp Web. It calls OpenAI directly using the user's own API key and does not require this repository's CRM app or a local server.

## Install from a downloaded folder

1. Download the repository from GitHub and extract it.
2. Open `chrome://extensions` in Chrome and turn on **Developer mode**.
3. Choose **Load unpacked** and select the repository's `extension/` folder.
4. Open the extension, add an OpenAI API key, and save the settings.
5. Reload any LinkedIn or WhatsApp Web tabs that were already open.

Click **Dịch tin này** beside a message to translate it. Messages are sent to OpenAI only after a translation action is requested. The API key is stored in Chrome local storage on that browser profile.
