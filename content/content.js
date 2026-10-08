// Sourcing AI Copilot - Content Script (Injected into Web Messaging)

(function () {
  // Tránh inject trùng lặp khi SPA điều hướng hoặc reload content script
  if (window.__SOURCING_COPILOT_INJECTED__) return;
  window.__SOURCING_COPILOT_INJECTED__ = true;

  // 1. Tạo hoặc tái sử dụng Host Element #sourcing-copilot-host
  function getOrCreateHostElement() {
    let hostEl = document.getElementById("sourcing-copilot-host");
    if (!hostEl) {
      hostEl = document.createElement("div");
      hostEl.id = "sourcing-copilot-host";
      // Cách ly tuyệt đối: Chống rò rỉ CSS toàn cục từ trang mẹ (LinkedIn, Telegram, Zalo, WhatsApp)
      hostEl.style.cssText = "all: initial !important; position: static !important; z-index: 2147483640 !important;";
      const mountPoint = document.body || document.documentElement;
      mountPoint.appendChild(hostEl);
    }
    return hostEl;
  }

  const host = getOrCreateHostElement();
  const isWhatsAppWebPage = location.hostname === "web.whatsapp.com";
  const translationSource = isWhatsAppWebPage
    ? "whatsapp-web"
    : location.hostname.endsWith("linkedin.com")
      ? "linkedin"
      : undefined;

  // 2. Khởi tạo Shadow Root với mode: "open" để đóng gói toàn bộ HTML & CSS
  const shadow = host.shadowRoot || host.attachShadow({ mode: "open" });

  // 3. Đóng gói toàn bộ Stylesheet vào bên trong Shadow Root
  const style = document.createElement("style");
  style.textContent = `
    :host {
      all: initial !important;
      display: block !important;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    
    /* Floating Trigger Button & Wrapper */
    .copilot-trigger-wrapper {
      position: fixed;
      right: 24px;
      bottom: 24px;
      z-index: 2147483640;
      user-select: none;
      touch-action: none;
    }

    /* Pill Mode (Full Luxury Pill) */
    .copilot-trigger-pill {
      display: flex;
      align-items: center;
      gap: 8px;
      background: linear-gradient(135deg, rgba(15, 23, 42, 0.94), rgba(30, 41, 59, 0.92));
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(56, 189, 248, 0.35);
      border-radius: 9999px;
      padding: 6px 10px 6px 8px;
      color: #ffffff;
      box-shadow: 0 10px 25px -5px rgba(2, 132, 199, 0.4), 0 0 1px 1px rgba(56, 189, 248, 0.2);
      cursor: grab;
      transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s, border-color 0.2s;
    }
    .copilot-trigger-pill:hover {
      transform: translateY(-2px);
      border-color: rgba(56, 189, 248, 0.7);
      box-shadow: 0 14px 28px -5px rgba(2, 132, 199, 0.55), 0 0 12px rgba(56, 189, 248, 0.35);
    }
    .copilot-trigger-wrapper.panel-open .copilot-trigger-pill,
    .copilot-trigger-wrapper.panel-open .copilot-trigger-compact {
      border-color: #38bdf8;
      box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.35), 0 14px 28px -5px rgba(2, 132, 199, 0.5);
    }

    /* Drag Handle Grip */
    .drag-grip {
      display: flex;
      align-items: center;
      justify-content: center;
      color: #64748b;
      cursor: grab;
      padding: 2px;
      transition: color 0.15s;
    }
    .copilot-trigger-pill:hover .drag-grip {
      color: #94a3b8;
    }

    /* Pulse Status Dot */
    .copilot-status-dot {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 8px;
      height: 8px;
    }
    .copilot-status-dot .ping {
      position: absolute;
      width: 100%;
      height: 100%;
      border-radius: 50%;
      background-color: #10b981;
      opacity: 0.75;
      animation: copilotPing 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;
    }
    .copilot-status-dot .dot {
      position: relative;
      display: block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background-color: #10b981;
      box-shadow: 0 0 6px rgba(16, 185, 129, 0.8);
    }
    @keyframes copilotPing {
      75%, 100% {
        transform: scale(2.4);
        opacity: 0;
      }
    }

    /* Main Pill Button Content */
    .copilot-pill-btn {
      display: flex;
      align-items: center;
      gap: 7px;
      cursor: pointer;
    }
    .copilot-pill-btn .icon {
      font-size: 15px;
      line-height: 1;
    }
    .copilot-pill-btn .label {
      font-size: 13px;
      font-weight: 600;
      letter-spacing: -0.01em;
      color: #f8fafc;
      white-space: nowrap;
    }

    /* Collapse to mini circular button */
    .copilot-collapse-btn {
      background: transparent;
      border: none;
      color: #94a3b8;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      margin-left: 2px;
      transition: background 0.15s, color 0.15s;
    }
    .copilot-collapse-btn:hover {
      background: rgba(255, 255, 255, 0.12);
      color: #ffffff;
    }

    /* Compact Circular Mode */
    .copilot-trigger-compact {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: linear-gradient(135deg, rgba(15, 23, 42, 0.94), rgba(30, 41, 59, 0.92));
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(56, 189, 248, 0.35);
      box-shadow: 0 10px 25px -5px rgba(2, 132, 199, 0.4), 0 0 1px 1px rgba(56, 189, 248, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: grab;
      position: relative;
      transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
    }
    .copilot-trigger-compact:hover {
      transform: translateY(-2px) scale(1.04);
      border-color: rgba(56, 189, 248, 0.7);
      box-shadow: 0 14px 28px -5px rgba(2, 132, 199, 0.55), 0 0 12px rgba(56, 189, 248, 0.35);
    }
    .copilot-trigger-compact .icon {
      font-size: 20px;
      line-height: 1;
    }
    .copilot-trigger-compact .compact-dot {
      position: absolute;
      top: 4px;
      right: 4px;
    }

    /* While Dragging State */
    .copilot-trigger-wrapper.dragging .copilot-trigger-pill,
    .copilot-trigger-wrapper.dragging .copilot-trigger-compact {
      cursor: grabbing !important;
      transform: scale(1.04);
      box-shadow: 0 20px 35px -5px rgba(2, 132, 199, 0.6), 0 0 20px rgba(56, 189, 248, 0.5) !important;
      transition: none !important;
    }
    .copilot-trigger-wrapper.dragging .drag-grip {
      cursor: grabbing !important;
    }

    /* Floating Dock Panel (Width: 400px, Dark Slate #0f172a, #1e293b) */
    .copilot-panel {
      position: fixed;
      right: 24px;
      bottom: 76px;
      width: 360px;
      max-width: calc(100vw - 24px);
      height: min(540px, calc(100vh - 96px));
      max-height: calc(100vh - 80px);
      min-height: 0;
      background: rgba(15, 23, 42, 0.97);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(56, 189, 248, 0.28);
      border-radius: 16px;
      box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.05);
      color: #f8fafc;
      display: none;
      flex-direction: column;
      z-index: 2147483645;
      overflow: hidden;
      animation: slideUp 0.22s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .copilot-panel.active {
      display: flex;
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(14px) scale(0.98);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    /* Panel Header */
    .panel-header {
      padding: 12px 16px;
      background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%);
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #334155;
    }
    .panel-title {
      font-size: 13.5px;
      font-weight: 700;
      color: #38bdf8;
      display: flex;
      align-items: center;
      gap: 7px;
      letter-spacing: -0.01em;
    }
    .header-actions {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .crm-status-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 10.5px;
      padding: 3px 8px;
      border-radius: 9999px;
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.3);
      font-weight: 600;
      white-space: nowrap;
      cursor: default;
    }
    .crm-status-badge.offline {
      background: rgba(244, 63, 94, 0.15);
      color: #fb7185;
      border-color: rgba(244, 63, 94, 0.3);
    }
    .crm-status-badge.checking {
      background: rgba(245, 158, 11, 0.15);
      color: #fbbf24;
      border-color: rgba(245, 158, 11, 0.3);
    }
    .header-icon-btn {
      background: transparent;
      border: none;
      color: #94a3b8;
      width: 26px;
      height: 26px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 13px;
      transition: all 0.15s;
    }
    .header-icon-btn:hover {
      background: #334155;
      color: #f8fafc;
    }

    /* Tabs Bar */
    .tabs {
      display: flex;
      background: #0b1120;
      border-bottom: 1px solid #334155;
    }
    .tab {
      flex: 1;
      text-align: center;
      padding: 10px 4px;
      font-size: 11.5px;
      font-weight: 600;
      color: #94a3b8;
      cursor: pointer;
      border-bottom: 2px solid transparent;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      user-select: none;
    }
    .tab:hover {
      color: #e2e8f0;
      background: rgba(30, 41, 59, 0.4);
    }
    .tab.active {
      color: #38bdf8;
      border-bottom-color: #38bdf8;
      background: #0f172a;
    }
    .tab-badge {
      display: inline-block;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #10b981;
    }

    /* Panel Body & Custom Scrollbar */
    .panel-body {
      padding: 14px;
      overflow-y: auto;
      min-height: 0;
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .incoming-input-row, .outgoing-input-row {
      display: flex;
      align-items: stretch;
      gap: 8px;
      position: sticky;
      top: 0;
      z-index: 4;
      padding: 8px;
      margin: -8px -8px 0;
      background: #0f172a;
      border-bottom: 1px solid #334155;
    }
    .incoming-input-row textarea, .outgoing-input-row textarea {
      min-width: 0;
      flex: 1;
    }
    .incoming-input-row .action-btn, .outgoing-input-row .action-btn {
      width: auto;
      flex: 0 0 auto;
      align-self: flex-start;
      margin-top: 0 !important;
      padding: 9px 10px;
      white-space: nowrap;
    }
    .panel-body::-webkit-scrollbar {
      width: 6px;
    }
    .panel-body::-webkit-scrollbar-track {
      background: #0f172a;
    }
    .panel-body::-webkit-scrollbar-thumb {
      background: #334155;
      border-radius: 9999px;
    }
    .panel-body::-webkit-scrollbar-thumb:hover {
      background: #475569;
    }

    /* Cards, Labels, Form controls */
    .label-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 4px;
    }
    .field-label {
      font-size: 11px;
      font-weight: 600;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.02em;
    }
    .btn-group-sm {
      display: flex;
      gap: 4px;
    }
    textarea, select, input {
      width: 100%;
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 8px;
      color: #f8fafc;
      padding: 8px 10px;
      font-size: 12.5px;
      outline: none;
      resize: vertical;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    textarea:focus, select:focus, input:focus {
      border-color: #38bdf8;
      box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.2);
    }

    .action-btn {
      background: linear-gradient(135deg, #0284c7, #0369a1);
      color: #ffffff;
      border: none;
      padding: 9px 14px;
      border-radius: 8px;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      transition: all 0.2s;
    }
    .action-btn:hover {
      background: linear-gradient(135deg, #0369a1, #075985);
      box-shadow: 0 4px 12px rgba(2, 132, 199, 0.4);
    }
    .action-btn:disabled {
      background: #475569;
      cursor: not-allowed;
      box-shadow: none;
    }

    .secondary-btn {
      background: #334155;
      color: #f8fafc;
      border: none;
      padding: 4px 8px;
      border-radius: 5px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s;
    }
    .secondary-btn:hover {
      background: #475569;
    }

    /* Results section */
    .result-box {
      background: #1e293b80;
      border: 1px solid #334155;
      border-radius: 10px;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      font-size: 12.5px;
      line-height: 1.5;
    }
    .result-title {
      font-size: 11.5px;
      font-weight: 700;
      color: #38bdf8;
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .badge-tag {
      display: inline-block;
      font-size: 10px;
      padding: 2px 7px;
      background: rgba(2, 132, 199, 0.2);
      color: #38bdf8;
      border-radius: 9999px;
      border: 1px solid rgba(56, 189, 248, 0.3);
      margin-left: auto;
    }

    .back-translation {
      background: rgba(6, 78, 59, 0.3);
      border: 1px solid #065f46;
      border-radius: 8px;
      padding: 9px;
      font-size: 12px;
      color: #6ee7b7;
      line-height: 1.45;
    }

    .key-points {
      display: flex;
      flex-direction: column;
      gap: 5px;
      margin-top: 2px;
    }
    .key-item {
      font-size: 12px;
      color: #fde047;
      display: flex;
      align-items: flex-start;
      gap: 6px;
      line-height: 1.4;
    }

    .suggested-reply-btn {
      text-align: left;
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 8px;
      padding: 8px 10px;
      color: #cbd5e1;
      font-size: 11.5px;
      cursor: pointer;
      line-height: 1.4;
      transition: all 0.15s;
    }
    .suggested-reply-btn:hover {
      background: #334155;
      color: #38bdf8;
      border-color: #38bdf8;
      transform: translateX(2px);
    }

    /* Deal Highlights Grid (Task 8.1) */
    .deal-highlights-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      margin-top: 4px;
    }
    .deal-chip {
      background: rgba(15, 23, 42, 0.75);
      border: 1px solid #334155;
      border-radius: 6px;
      padding: 6px 8px;
      font-size: 11px;
      display: flex;
      align-items: center;
      gap: 5px;
      overflow: hidden;
      transition: all 0.15s;
    }
    .deal-chip.has-val {
      border-color: rgba(56, 189, 248, 0.45);
      background: rgba(2, 132, 199, 0.12);
    }
    .deal-chip .chip-icon {
      font-size: 13px;
      flex-shrink: 0;
    }
    .deal-chip .chip-key {
      color: #94a3b8;
      font-size: 10px;
      font-weight: 600;
      flex-shrink: 0;
    }
    .deal-chip .chip-val {
      color: #38bdf8;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .fill-notice {
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.4);
      color: #34d399;
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 11px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 4px;
      animation: fadeInScale 0.2s ease-out;
    }

    /* Candidate Profile Card & 1-Click CRM Bar (Tab 3) */
    .candidate-card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 10px;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .cand-header {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .cand-avatar {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: linear-gradient(135deg, #0284c7, #38bdf8);
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 14px;
      flex-shrink: 0;
    }
    .cand-meta {
      flex: 1;
      min-width: 0;
    }
    .cand-name-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
    }
    .cand-name {
      font-size: 13.5px;
      font-weight: 700;
      color: #f8fafc;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .cand-job {
      font-size: 11.5px;
      color: #94a3b8;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-top: 2px;
    }
    .cand-owner-row {
      font-size: 10.5px;
      color: #64748b;
      display: flex;
      align-items: center;
      gap: 4px;
      margin-top: 2px;
    }

    /* Stage Badges */
    .stage-pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 7px;
      border-radius: 9999px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.02em;
    }
    .stage-lead { background: rgba(148, 163, 184, 0.2); color: #cbd5e1; border: 1px solid #475569; }
    .stage-found { background: rgba(56, 189, 248, 0.2); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4); }
    .stage-contacted { background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4); }
    .stage-responded { background: rgba(52, 211, 153, 0.2); color: #34d399; border: 1px solid rgba(52, 211, 153, 0.4); }
    .stage-interested { background: rgba(14, 165, 233, 0.25); color: #38bdf8; border: 1px solid #0284c7; }
    .stage-declined { background: rgba(244, 63, 94, 0.2); color: #fb7185; border: 1px solid rgba(244, 63, 94, 0.4); }

    /* 1-Click Stage Transitions Grid */
    .actions-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6px;
    }
    .stage-btn {
      background: #0f172a;
      border: 1px solid #334155;
      color: #cbd5e1;
      padding: 7px 4px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      text-align: center;
      transition: all 0.15s;
    }
    .stage-btn:hover {
      border-color: #38bdf8;
      color: #38bdf8;
      background: #1e293b;
    }
    .stage-btn.active {
      background: rgba(56, 189, 248, 0.15);
      border-color: #38bdf8;
      color: #38bdf8;
    }

    /* Signal Chips */
    .signal-chips {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .signal-btn {
      background: #0f172a;
      border: 1px dashed #475569;
      color: #94a3b8;
      padding: 5px 8px;
      border-radius: 6px;
      font-size: 11px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
      transition: all 0.15s;
    }
    .signal-btn:hover {
      border-color: #fde047;
      color: #fde047;
    }
    .signal-btn.has-signal {
      border-style: solid;
      border-color: #eab308;
      background: rgba(234, 179, 8, 0.15);
      color: #fef08a;
    }

    /* Feedback Banner */
    .feedback-banner {
      padding: 8px 10px;
      border-radius: 6px;
      font-size: 11.5px;
      line-height: 1.4;
      display: none;
    }
    .feedback-banner.success {
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.3);
    }
    .feedback-banner.error {
      background: rgba(244, 63, 94, 0.15);
      color: #fb7185;
      border: 1px solid rgba(244, 63, 94, 0.3);
    }

    /* Floating Quick Selection Tooltip */
    .selection-tooltip {
      position: fixed;
      background: linear-gradient(135deg, rgba(15, 23, 42, 0.96), rgba(30, 41, 59, 0.94));
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      border: 1px solid rgba(56, 189, 248, 0.45);
      border-radius: 9999px;
      padding: 6px 12px;
      font-size: 11.5px;
      font-weight: 600;
      color: #f8fafc;
      cursor: pointer;
      box-shadow: 0 10px 25px -4px rgba(2, 132, 199, 0.45), 0 0 1px 1px rgba(56, 189, 248, 0.25);
      z-index: 2147483647;
      display: none;
      align-items: center;
      gap: 6px;
      user-select: none;
      animation: tooltipPop 0.16s cubic-bezier(0.16, 1, 0.3, 1);
      transition: transform 0.15s, border-color 0.15s, box-shadow 0.15s;
    }
    .selection-tooltip:hover {
      transform: translateY(-2px) scale(1.03);
      border-color: #38bdf8;
      box-shadow: 0 14px 28px -4px rgba(2, 132, 199, 0.6), 0 0 12px rgba(56, 189, 248, 0.4);
    }
    .selection-tooltip .lightning-icon {
      color: #fde047;
      font-size: 13px;
      line-height: 1;
      filter: drop-shadow(0 0 4px rgba(253, 224, 71, 0.6));
    }
    .selection-tooltip .tooltip-text {
      letter-spacing: -0.01em;
      white-space: nowrap;
    }
    @keyframes tooltipPop {
      from {
        opacity: 0;
        transform: translateY(6px) scale(0.95);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    /* Top-Right Quick Lead Saver Widget (Task 8.3) */
    .copilot-top-saver-wrapper {
      position: fixed;
      top: 16px;
      right: 20px;
      z-index: 2147483640;
      user-select: none;
      transition: right 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .copilot-top-saver-wrapper.panel-open {
      right: 420px;
    }

    .copilot-top-saver-btn {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 7px 14px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      box-sizing: border-box;
      outline: none;
    }
    .copilot-top-saver-btn.unsaved {
      background: linear-gradient(135deg, rgba(15, 23, 42, 0.94), rgba(30, 41, 59, 0.92));
      border: 1px solid rgba(56, 189, 248, 0.45);
      color: #f8fafc;
      box-shadow: 0 8px 20px -4px rgba(2, 132, 199, 0.4), 0 0 1px 1px rgba(56, 189, 248, 0.2);
    }
    .copilot-top-saver-btn.unsaved:hover {
      transform: translateY(-2px);
      border-color: #38bdf8;
      box-shadow: 0 12px 24px -4px rgba(2, 132, 199, 0.6), 0 0 12px rgba(56, 189, 248, 0.35);
    }
    .copilot-top-saver-btn.saved {
      background: linear-gradient(135deg, rgba(6, 78, 59, 0.95), rgba(15, 23, 42, 0.95));
      border: 1px solid rgba(52, 211, 153, 0.6);
      color: #34d399;
      box-shadow: 0 8px 20px -4px rgba(16, 185, 129, 0.4), 0 0 1px 1px rgba(16, 185, 129, 0.2);
    }
    .copilot-top-saver-btn.saved:hover {
      transform: translateY(-2px);
      border-color: #10b981;
      box-shadow: 0 12px 24px -4px rgba(16, 185, 129, 0.6), 0 0 12px rgba(16, 185, 129, 0.4);
    }
    .copilot-top-saver-btn .ext-link-icon {
      font-size: 11px;
      opacity: 0.85;
    }

    /* Popover Card */
    .copilot-top-saver-card {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      width: 330px;
      background: linear-gradient(145deg, #0f172a, #1e293b);
      border: 1px solid #334155;
      border-radius: 12px;
      box-shadow: 0 20px 40px -8px rgba(0, 0, 0, 0.7), 0 0 1px 1px rgba(56, 189, 248, 0.2);
      padding: 14px 16px;
      animation: saverPop 0.18s cubic-bezier(0.16, 1, 0.3, 1);
      box-sizing: border-box;
      z-index: 2147483647;
    }
    @keyframes saverPop {
      from { opacity: 0; transform: translateY(-6px) scale(0.97); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    .saver-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid #334155;
    }
    .saver-card-title {
      font-size: 13px;
      font-weight: 700;
      color: #38bdf8;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .saver-close-btn {
      background: none;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      font-size: 14px;
      padding: 2px 6px;
      border-radius: 4px;
      transition: all 0.15s;
    }
    .saver-close-btn:hover {
      background: #334155;
      color: #fff;
    }
    .saver-card-body {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .saver-submit-btn {
      margin-top: 4px;
      background: linear-gradient(135deg, #059669, #047857);
    }
    .saver-submit-btn:hover {
      background: linear-gradient(135deg, #047857, #065f46);
      box-shadow: 0 4px 12px rgba(5, 150, 105, 0.4);
    }
    .saver-inv-notice {
      font-size: 10px;
      color: #64748b;
      text-align: center;
      line-height: 1.4;
    }
    .saver-success-box {
      margin-top: 8px;
      background: rgba(6, 78, 59, 0.35);
      border: 1px solid #059669;
      border-radius: 8px;
      padding: 10px 12px;
      text-align: center;
      animation: saverPop 0.2s ease-out;
    }
    .saver-success-title {
      font-size: 12.5px;
      font-weight: 700;
      color: #34d399;
      margin-bottom: 2px;
    }
    .saver-success-desc {
      font-size: 11px;
      color: #94a3b8;
      margin-bottom: 8px;
    }
    .saver-crm-link-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      background: linear-gradient(135deg, #0284c7, #0369a1);
      color: #ffffff !important;
      padding: 8px 12px;
      border-radius: 7px;
      font-size: 12px;
      font-weight: 600;
      text-decoration: none !important;
      box-shadow: 0 4px 12px rgba(2, 132, 199, 0.35);
      transition: all 0.15s;
    }
    .saver-crm-link-btn:hover {
      background: linear-gradient(135deg, #0369a1, #075985);
      box-shadow: 0 6px 16px rgba(2, 132, 199, 0.5);
      transform: translateY(-1px);
    }
    .saver-existing-info {
      display: flex;
      align-items: center;
      gap: 10px;
      background: rgba(30, 41, 59, 0.5);
      border: 1px solid #334155;
      border-radius: 8px;
      padding: 10px;
    }
    .existing-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: linear-gradient(135deg, #059669, #0284c7);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 13px;
      color: #ffffff;
      flex-shrink: 0;
    }
    .existing-meta {
      flex: 1;
      min-width: 0;
    }
    .existing-name-row {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .existing-name {
      font-size: 13px;
      font-weight: 700;
      color: #f8fafc;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .existing-job {
      font-size: 11px;
      color: #94a3b8;
      margin-top: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `;
  shadow.appendChild(style);
  style.textContent += ".copilot-top-saver-wrapper, #tab-btn-crm, #tab-crm, #crm-status-badge, #refresh-panel-btn { display: none !important; }";

  // Render Elements
  const container = document.createElement("div");
  container.innerHTML = `
    <!-- Top-Right 1-Click Lead Saver Widget (Task 8.3) -->
    <div class="copilot-top-saver-wrapper" id="copilot-top-saver-wrapper">
      <!-- Small Trigger Button in Top-Right Corner -->
      <button class="copilot-top-saver-btn unsaved" id="tr-saver-btn" title="Lưu nhanh hồ sơ ứng viên vào CRM (1-Click)">
        <span class="icon" id="tr-saver-icon">👤</span>
        <span class="label" id="tr-saver-label">+ Lưu vào CRM</span>
        <span class="ext-link-icon" id="tr-saver-ext" style="display: none;">↗</span>
      </button>

      <!-- Floating Popover Card -->
      <div class="copilot-top-saver-card" id="tr-saver-card" style="display: none;">
        <div class="saver-card-header">
          <div class="saver-card-title">
            <span id="tr-card-icon">⚡</span>
            <span id="tr-card-title-text">Lưu hồ sơ vào CRM</span>
          </div>
          <button class="saver-close-btn" id="tr-saver-close" title="Đóng">✕</button>
        </div>

        <!-- Unsaved View: Form to save lead -->
        <div id="tr-view-unsaved" class="saver-card-body">
          <div class="form-group" style="display: flex; flex-direction: column; gap: 4px;">
            <label class="field-label">Tên hiển thị ứng viên:</label>
            <input type="text" id="tr-lead-name" placeholder="VD: Kim Min-soo">
          </div>

          <div class="form-group" style="display: flex; flex-direction: column; gap: 4px;">
            <label class="field-label">Link Profile ứng viên:</label>
            <input type="text" id="tr-lead-url" placeholder="https://www.linkedin.com/in/...">
          </div>

          <div class="form-group" style="display: flex; flex-direction: column; gap: 4px;">
            <label class="field-label">Vị trí tuyển dụng (CRM Job):</label>
            <select id="tr-lead-job">
              <option value="">-- Đang nạp danh sách vị trí... --</option>
            </select>
          </div>

          <div class="form-group" style="display: flex; flex-direction: column; gap: 4px;">
            <label class="field-label">Ghi chú ban đầu:</label>
            <textarea id="tr-lead-note" rows="2" placeholder="Ghi chú về kỳ vọng đãi ngộ, visa..."></textarea>
          </div>

          <button class="action-btn saver-submit-btn" id="tr-btn-save-lead">
            <span>💾</span> Lưu vào CRM (Lưu tạm - 30 ngày)
          </button>
          <div class="saver-inv-notice">
            Tuân thủ INV-3: Hạn lưu 30 ngày. Không lưu SĐT/Email ở Lead stage.
          </div>

          <!-- Success Notification with Link to CRM -->
          <div id="tr-saver-success-box" class="saver-success-box" style="display: none;">
            <div class="saver-success-title">🎉 Đã lưu thành công vào CRM!</div>
            <div class="saver-success-desc">Hạn lưu tạm: 30 ngày (Tuân thủ INV-3)</div>
            <a id="tr-saver-crm-link" href="#" target="_blank" class="saver-crm-link-btn">
              <span>🔗</span> Mở hồ sơ trong CRM web app ↗
            </a>
          </div>
        </div>

        <!-- Saved View: Already in CRM (Task 9.1) -->
        <div id="tr-view-saved" class="saver-card-body" style="display: none;">
          <div style="display: inline-flex; align-items: center; gap: 6px; background: rgba(6, 78, 59, 0.4); border: 1px solid #10b981; border-radius: 6px; padding: 4px 8px; font-size: 11px; font-weight: 700; color: #34d399;">
            <span style="color: #10b981; font-size: 10px;">●</span> ĐÃ CÓ TRONG CRM
          </div>
          <div class="saver-existing-info">
            <div class="existing-avatar" id="tr-saved-avatar">KS</div>
            <div class="existing-meta">
              <div class="existing-name-row">
                <span class="existing-name" id="tr-saved-name">Kim Min-soo</span>
                <span class="stage-pill stage-found" id="tr-saved-stage">ĐÃ LIÊN HỆ</span>
              </div>
              <div class="existing-job" id="tr-saved-job">Senior Backend Engineer</div>
            </div>
          </div>
          <a id="tr-view-existing-crm-link" href="#" target="_blank" class="saver-crm-link-btn" style="margin-top: 10px;">
            <span>🔗</span> Mở hồ sơ chi tiết trong CRM ↗
          </a>
          <button class="secondary-btn" id="tr-btn-open-dock" style="width: 100%; margin-top: 6px; padding: 7px;">
            <span>🤖</span> Mở Copilot Panel để quản lý (Alt + S)
          </button>
        </div>
      </div>
    </div>

    <!-- Floating Trigger Wrapper (Draggable & Collapsible) -->
    <div class="copilot-trigger-wrapper" id="copilot-trigger-wrapper">
      <!-- Full Luxury Pill Mode -->
      <div class="copilot-trigger-pill" id="copilot-trigger-pill" title="Kéo để di chuyển • Click để mở Copilot">
        <div class="drag-grip" title="Kéo để di chuyển">
          <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
            <circle cx="2" cy="2" r="1.5" />
            <circle cx="8" cy="2" r="1.5" />
            <circle cx="2" cy="7" r="1.5" />
            <circle cx="8" cy="7" r="1.5" />
            <circle cx="2" cy="12" r="1.5" />
            <circle cx="8" cy="12" r="1.5" />
          </svg>
        </div>

        <div class="copilot-status-dot" title="AI Copilot sẵn sàng">
          <span class="ping"></span>
          <span class="dot"></span>
        </div>

        <div class="copilot-pill-btn" id="copilot-pill-btn">
          <span class="icon">🌐</span>
          <span class="label">Sourcing AI Copilot</span>
        </div>

        <button class="copilot-collapse-btn" id="copilot-collapse-btn" title="Thu gọn thành nút tròn">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="4 14 10 14 10 20"></polyline>
            <polyline points="20 10 14 10 14 4"></polyline>
            <line x1="14" y1="10" x2="21" y2="3"></line>
            <line x1="3" y1="21" x2="10" y2="14"></line>
          </svg>
        </button>
      </div>

      <!-- Compact Circular Mode -->
      <div class="copilot-trigger-compact" id="copilot-trigger-compact" style="display: none;" title="Sourcing AI Copilot (Bấm để mở rộng)">
        <div class="copilot-status-dot compact-dot" title="AI Copilot sẵn sàng">
          <span class="ping"></span>
          <span class="dot"></span>
        </div>
        <span class="icon">🌐</span>
      </div>
    </div>

    <!-- Floating Dock (Width: 400px, Dark Slate #0f172a, #1e293b) -->
    <div class="copilot-panel" id="copilot-panel">
      <!-- Panel Header -->
      <div class="panel-header">
        <div class="panel-title">
          <span>🌐</span> Chat Translator
        </div>
        <div class="header-actions">
          <div class="crm-status-badge checking" id="crm-status-badge" title="Đang kiểm tra kết nối máy chủ CRM">
            <span class="dot">●</span> <span id="crm-status-text">Đang kết nối...</span>
          </div>
          <button class="header-icon-btn" id="refresh-panel-btn" title="Làm mới dữ liệu">🔄</button>
          <button class="header-icon-btn" id="close-panel" title="Đóng thanh Dock">✕</button>
        </div>
      </div>

      <!-- Tabs Bar -->
      <div class="tabs">
        <div class="tab active" data-tab="tab-incoming" id="tab-btn-incoming">
          <span>📥</span> Dịch tin nhắn
        </div>
        <div class="tab" data-tab="tab-outgoing" id="tab-btn-outgoing">
          <span>📤</span> Soạn phản hồi
        </div>
        <div class="tab" data-tab="tab-crm" id="tab-btn-crm">
          <span>👤</span> Quản lý CRM
          <span class="tab-badge" id="tab-crm-badge" style="display: none;"></span>
        </div>
      </div>

      <!-- Panel Body -->
      <div class="panel-body">
        <!-- TAB 1: INCOMING TRANSLATION & NEGOTIATION INTEL -->
        <div id="tab-incoming" class="tab-content">
          <div class="label-row">
            <span class="field-label">Tin nhắn ứng viên gửi (bất kỳ ngôn ngữ):</span>
            <div class="btn-group-sm">
              <button class="secondary-btn" id="paste-incoming-btn" title="Dán từ Clipboard">📋 Dán</button>
              <button class="secondary-btn" id="clear-incoming-btn" title="Xóa nội dung">🧹 Xóa</button>
            </div>
          </div>
          <textarea id="incoming-text" rows="3" placeholder="Dán hoặc bôi đen tin nhắn tiếng Hàn, Nhật, Anh, Trung, Đức, Pháp..."></textarea>
          
          <button class="action-btn" id="btn-translate-incoming" style="margin-top: 8px;">
            <span>⚡</span> Dịch sang tiếng Việt & Phân tích
          </button>

          <!-- Result Area -->
          <div id="incoming-result" style="display: none; margin-top: 10px;" class="result-box">
            <div class="result-title">
              <span>🇻🇳 Bản dịch tiếng Việt tự nhiên</span>
              <span id="detected-lang-badge" class="badge-tag">Đa ngôn ngữ</span>
            </div>
            <div id="incoming-translated-text" style="color: #f8fafc; font-weight: 500; font-size: 13px;"></div>

            <!-- Deal Highlights (Task 8.1: 4 Thỏa thuận cốt lõi) -->
            <div class="result-title" style="margin-top: 8px;">🤝 Thỏa thuận cốt lõi (Deal Highlights):</div>
            <div id="incoming-deal-highlights" class="deal-highlights-grid">
              <div class="deal-chip" id="chip-salary">
                <span class="chip-icon">💰</span>
                <span class="chip-key">Lương:</span>
                <span class="chip-val" id="val-salary">--</span>
              </div>
              <div class="deal-chip" id="chip-visa">
                <span class="chip-icon">🛂</span>
                <span class="chip-key">Visa:</span>
                <span class="chip-val" id="val-visa">--</span>
              </div>
              <div class="deal-chip" id="chip-workmode">
                <span class="chip-icon">🏠</span>
                <span class="chip-key">Hình thức:</span>
                <span class="chip-val" id="val-workmode">--</span>
              </div>
              <div class="deal-chip" id="chip-startdate">
                <span class="chip-icon">⏱️</span>
                <span class="chip-key">Bắt đầu:</span>
                <span class="chip-val" id="val-startdate">--</span>
              </div>
            </div>

            <div class="result-title" style="margin-top: 8px;">🎯 Ý đồ đàm phán chính của ứng viên:</div>
            <div id="incoming-key-points" class="key-points"></div>

            <div class="result-title" style="margin-top: 8px;">
              <span>💡 Kịch bản gợi ý (1-Chạm điền vào ô chat):</span>
            </div>
            <div id="incoming-suggested-replies" style="display: flex; flex-direction: column; gap: 6px;"></div>
            <div id="incoming-fill-notice" class="fill-notice" style="display: none;"></div>
          </div>
        </div>

        <!-- TAB 2: OUTGOING TRANSLATION & QUALITY GUARDRAIL -->
        <div id="tab-outgoing" class="tab-content" style="display: none;">
          <div class="label-row">
            <span class="field-label">Gõ ý của bạn bằng tiếng Việt:</span>
            <select id="outgoing-target-lang" style="width: auto; padding: 3px 6px; font-size: 11px;">
              <option value="ko">🇰🇷 Tiếng Hàn (존댓말 - Kính ngữ)</option>
              <option value="ja">🇯🇵 Tiếng Nhật (敬語 - Keigo chuẩn)</option>
              <option value="en">🇺🇸 Tiếng Anh (Business Pro)</option>
              <option value="zh">🇨🇳 Tiếng Trung (商务中文)</option>
              <option value="de">🇩🇪 Tiếng Đức (Formell / Sie)</option>
              <option value="fr">🇫🇷 Tiếng Pháp (Professionnel)</option>
              <option value="ru">🇷🇺 Tiếng Nga (Деловой стиль)</option>
              <option value="vi">🇻🇳 Tiếng Việt (Bản ngữ)</option>
            </select>
          </div>
          <textarea id="outgoing-text" rows="3" placeholder="VD: Bảo họ là cty hỗ trợ visa E-7 và vé máy bay, lương $4.5k net, hẹn phỏng vấn online 10h thứ 3 tuần sau..."></textarea>

          <button class="action-btn" id="btn-translate-outgoing" style="margin-top: 8px;">
            <span>✨</span> Dịch sang ngôn ngữ ứng viên
          </button>

          <!-- Outgoing Result Area -->
          <div id="outgoing-result" style="display: none; margin-top: 10px;" class="result-box">
            <div class="result-title">
              <span>📩 Bản dịch gửi ứng viên</span>
              <button class="secondary-btn" id="copy-outgoing-btn" style="margin-left: auto;">📋 Chép vào ô chat</button>
            </div>
            <div id="outgoing-translated-text" style="color: #38bdf8; font-weight: 500; font-size: 13px;"></div>

            <div class="result-title" style="margin-top: 8px;">🛡️ Bản dịch ngược kiểm tra (Bảo hiểm rủi ro - INV-5):</div>
            <div id="outgoing-back-translation" class="back-translation"></div>
          </div>
        </div>

        <!-- TAB 3: CANDIDATE PROFILE & LEAD SAVER (2-WAY CRM INTEGRATION) -->
        <div id="tab-crm" class="tab-content" style="display: none;">
          <!-- Status Banner for Feedback -->
          <div id="crm-feedback-banner" class="feedback-banner"></div>

          <!-- Loading State -->
          <div id="crm-loading-state" style="display: none; text-align: center; padding: 20px 0; color: #94a3b8; font-size: 12.5px;">
            <span>⏳ Đang kiểm tra hồ sơ ứng viên trên CRM...</span>
          </div>

          <!-- VIEW A: CANDIDATE FOUND (EXISTING IN CRM) -->
          <div id="crm-candidate-found" style="display: none; flex-direction: column; gap: 12px;">
            <div class="candidate-card">
              <div class="cand-header">
                <div class="cand-avatar" id="cand-avatar">CV</div>
                <div class="cand-meta">
                  <div class="cand-name-row">
                    <span class="cand-name" id="cand-name-display">Kim Min-soo</span>
                    <span class="stage-pill stage-found" id="cand-stage-badge">FOUND</span>
                  </div>
                  <div class="cand-job" id="cand-job-display">Frontend Developer (React/Next.js)</div>
                  <div class="cand-owner-row">
                    <span>👤 Phụ trách:</span> <strong id="cand-owner-display" style="color: #cbd5e1;">Recruiter A</strong>
                  </div>
                </div>
              </div>

              <!-- Market Signals -->
              <div style="border-top: 1px solid #334155; padding-top: 8px;">
                <div class="field-label" style="margin-bottom: 6px;">Tín hiệu sẵn sàng (Readiness Signals):</div>
                <div class="signal-chips" id="cand-signals-container">
                  <button class="signal-btn" id="btn-signal-recent" data-signal="recent_activity">
                    <span>⚡ Vừa hoạt động</span>
                  </button>
                  <button class="signal-btn" id="btn-signal-cv" data-signal="cv_recently_updated">
                    <span>📄 Vừa cập nhật CV</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- 1-Click Stage Transitions (INV-2 Enforced) -->
            <div class="result-box">
              <div class="field-label">Chuyển trạng thái 1-Click (Ghi nhận Audit):</div>
              <div class="actions-grid">
                <button class="stage-btn" id="btn-stage-responded" data-stage="responded">
                  💬 Đã phản hồi
                </button>
                <button class="stage-btn" id="btn-stage-interested" data-stage="interested">
                  🌟 Quan tâm
                </button>
                <button class="stage-btn" id="btn-stage-declined" data-stage="declined_job">
                  ✕ Từ chối
                </button>
              </div>
            </div>

            <!-- Quick Activity Note -->
            <div class="result-box">
              <div class="field-label">Ghi chú trao đổi nhanh (Activity Timeline):</div>
              <div class="note-row">
                <textarea id="cand-quick-note" rows="2" placeholder="Tóm tắt trao đổi (Lương, visa, ngày bắt đầu...)..."></textarea>
              </div>
              <button class="secondary-btn" id="btn-append-note" style="align-self: flex-end; padding: 6px 12px; margin-top: 4px;">
                📝 Lưu vào lịch sử
              </button>
            </div>

            <!-- Open In CRM Link -->
            <div style="text-align: center; margin-top: 2px;">
              <a id="cand-crm-link" href="http://localhost:3000/candidates" target="_blank" style="color: #38bdf8; font-size: 11.5px; text-decoration: none; display: inline-flex; align-items: center; gap: 4px;">
                <span>🔗</span> Mở hồ sơ chi tiết trong CRM
              </a>
            </div>
          </div>

          <!-- VIEW B: CANDIDATE NOT FOUND (1-CLICK LEAD SAVER) -->
          <div id="crm-candidate-notfound" style="display: none; flex-direction: column; gap: 10px;">
            <div style="background: rgba(148, 163, 184, 0.1); border: 1px dashed #475569; border-radius: 8px; padding: 10px; font-size: 12px; color: #94a3b8; display: flex; align-items: center; gap: 8px;">
              <span>⚪</span>
              <span>Ứng viên chưa có trong CRM. Bạn có thể lưu nhanh hồ sơ vào danh sách <strong>Lưu tạm (30 ngày)</strong>.</span>
            </div>

            <div class="form-group" style="display: flex; flex-direction: column; gap: 4px;">
              <label class="field-label">Tên hiển thị ứng viên:</label>
              <input type="text" id="lead-name" placeholder="VD: Kim Min-soo / John Doe">
            </div>

            <div class="form-group" style="display: flex; flex-direction: column; gap: 4px;">
              <label class="field-label">Link Profile ứng viên:</label>
              <input type="text" id="lead-url" placeholder="https://www.linkedin.com/in/...">
            </div>

            <div class="form-group" style="display: flex; flex-direction: column; gap: 4px;">
              <label class="field-label">Vị trí tuyển dụng (CRM Job):</label>
              <select id="lead-job-select">
                <option value="">-- Đang nạp danh sách vị trí... --</option>
              </select>
            </div>

            <div class="form-group" style="display: flex; flex-direction: column; gap: 4px;">
              <label class="field-label">Ghi chú trao đổi ban đầu:</label>
              <textarea id="lead-note" rows="2" placeholder="Ghi chú về kỳ vọng đãi ngộ, visa, ngoại ngữ..."></textarea>
            </div>

            <button class="action-btn" id="btn-save-lead" style="margin-top: 6px; background: linear-gradient(135deg, #059669, #047857);">
              <span>💾</span> Lưu vào CRM (Lưu tạm - 30 ngày)
            </button>
            <div style="font-size: 10.5px; color: #64748b; text-align: center;">
              Tuân thủ INV-3 & INV-4: Không thu thập SĐT/Email ở Lead stage.
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Quick Selection Tooltip (Dynamic CJK detection) -->
    <div class="selection-tooltip" id="selection-tooltip" title="Dịch ngay đoạn văn bản này bằng AI Copilot">
      <span class="lightning-icon">⚡</span>
      <span class="tooltip-text" id="selection-tooltip-text">Dịch Copilot</span>
    </div>
  `;
  shadow.appendChild(container);

  // Grab elements inside shadow DOM
  const triggerWrapper = shadow.getElementById("copilot-trigger-wrapper");
  const triggerPill = shadow.getElementById("copilot-trigger-pill");
  const triggerCompact = shadow.getElementById("copilot-trigger-compact");
  const collapseBtn = shadow.getElementById("copilot-collapse-btn");
  const panel = shadow.getElementById("copilot-panel");
  const closeBtn = shadow.getElementById("close-panel");
  const refreshPanelBtn = shadow.getElementById("refresh-panel-btn");
  const tabs = shadow.querySelectorAll(".tab");
  if (isWhatsAppWebPage) shadow.getElementById("tab-btn-crm").hidden = true;
  const tabContents = shadow.querySelectorAll(".tab-content");
  const tabCrmBadge = shadow.getElementById("tab-crm-badge");
  const selectionTooltip = shadow.getElementById("selection-tooltip");
  const selectionTooltipText = shadow.getElementById("selection-tooltip-text");

  // Tab 1 Elements (Incoming)
  const incomingText = shadow.getElementById("incoming-text");
  const btnTranslateIncoming = shadow.getElementById("btn-translate-incoming");
  const incomingInputRow = document.createElement("div");
  incomingInputRow.className = "incoming-input-row";
  incomingText.parentNode.insertBefore(incomingInputRow, incomingText);
  incomingInputRow.append(incomingText, btnTranslateIncoming);
  const incomingResult = shadow.getElementById("incoming-result");
  const incomingTranslatedText = shadow.getElementById("incoming-translated-text");
  const detectedLangBadge = shadow.getElementById("detected-lang-badge");
  const incomingKeyPoints = shadow.getElementById("incoming-key-points");
  const incomingSuggestedReplies = shadow.getElementById("incoming-suggested-replies");
  const pasteIncomingBtn = shadow.getElementById("paste-incoming-btn");
  const clearIncomingBtn = shadow.getElementById("clear-incoming-btn");

  const chipSalary = shadow.getElementById("chip-salary");
  const valSalary = shadow.getElementById("val-salary");
  const chipVisa = shadow.getElementById("chip-visa");
  const valVisa = shadow.getElementById("val-visa");
  const chipWorkmode = shadow.getElementById("chip-workmode");
  const valWorkmode = shadow.getElementById("val-workmode");
  const chipStartdate = shadow.getElementById("chip-startdate");
  const valStartdate = shadow.getElementById("val-startdate");
  const incomingFillNotice = shadow.getElementById("incoming-fill-notice");

  // Tab 2 Elements (Outgoing)
  const outgoingText = shadow.getElementById("outgoing-text");
  const outgoingTargetLang = shadow.getElementById("outgoing-target-lang");
  const btnTranslateOutgoing = shadow.getElementById("btn-translate-outgoing");
  const outgoingInputRow = document.createElement("div");
  outgoingInputRow.className = "outgoing-input-row";
  outgoingText.parentNode.insertBefore(outgoingInputRow, outgoingText);
  outgoingInputRow.append(outgoingText, btnTranslateOutgoing);
  const outgoingResult = shadow.getElementById("outgoing-result");
  const outgoingTranslatedText = shadow.getElementById("outgoing-translated-text");
  const outgoingBackTranslation = shadow.getElementById("outgoing-back-translation");
  const copyOutgoingBtn = shadow.getElementById("copy-outgoing-btn");

  // Tab 3 Elements (CRM Candidate & Lead)
  const crmFeedbackBanner = shadow.getElementById("crm-feedback-banner");
  const crmLoadingState = shadow.getElementById("crm-loading-state");
  const crmCandidateFound = shadow.getElementById("crm-candidate-found");
  const crmCandidateNotfound = shadow.getElementById("crm-candidate-notfound");
  const candAvatar = shadow.getElementById("cand-avatar");
  const candNameDisplay = shadow.getElementById("cand-name-display");
  const candStageBadge = shadow.getElementById("cand-stage-badge");
  const candJobDisplay = shadow.getElementById("cand-job-display");
  const candOwnerDisplay = shadow.getElementById("cand-owner-display");
  const btnSignalRecent = shadow.getElementById("btn-signal-recent");
  const btnSignalCv = shadow.getElementById("btn-signal-cv");
  const btnStageResponded = shadow.getElementById("btn-stage-responded");
  const btnStageInterested = shadow.getElementById("btn-stage-interested");
  const btnStageDeclined = shadow.getElementById("btn-stage-declined");
  const candQuickNote = shadow.getElementById("cand-quick-note");
  const btnAppendNote = shadow.getElementById("btn-append-note");
  const candCrmLink = shadow.getElementById("cand-crm-link");

  // Lead Form Elements
  const leadName = shadow.getElementById("lead-name");
  const leadUrl = shadow.getElementById("lead-url");
  const leadJobSelect = shadow.getElementById("lead-job-select");
  const leadNote = shadow.getElementById("lead-note");
  const btnSaveLead = shadow.getElementById("btn-save-lead");

  // Top-Right Quick Lead Saver Elements (Task 8.3)
  const topSaverWrapper = shadow.getElementById("copilot-top-saver-wrapper");
  const trSaverBtn = shadow.getElementById("tr-saver-btn");
  const trSaverIcon = shadow.getElementById("tr-saver-icon");
  const trSaverLabel = shadow.getElementById("tr-saver-label");
  const trSaverExt = shadow.getElementById("tr-saver-ext");
  const trSaverCard = shadow.getElementById("tr-saver-card");
  const trViewUnsaved = shadow.getElementById("tr-view-unsaved");
  const trViewSaved = shadow.getElementById("tr-view-saved");
  const trLeadName = shadow.getElementById("tr-lead-name");
  const trLeadUrl = shadow.getElementById("tr-lead-url");
  const trLeadJob = shadow.getElementById("tr-lead-job");
  const trSavedAvatar = shadow.getElementById("tr-saved-avatar");
  const trSavedName = shadow.getElementById("tr-saved-name");
  const trSavedStage = shadow.getElementById("tr-saved-stage");
  const trSavedJob = shadow.getElementById("tr-saved-job");
  const trViewExistingCrmLink = shadow.getElementById("tr-view-existing-crm-link");

  let activeCandidate = null;

  // Storage helpers (Chrome extension local storage with localStorage fallback)
  function getStorage(keys, callback) {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(keys, callback);
    } else {
      const res = {};
      keys.forEach((k) => {
        try {
          const val = localStorage.getItem(k);
          if (val) res[k] = JSON.parse(val);
        } catch {
          // ignore
        }
      });
      callback(res);
    }
  }

  function setStorage(items) {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set(items);
    } else {
      Object.entries(items).forEach(([k, v]) => {
        try {
          localStorage.setItem(k, JSON.stringify(v));
        } catch {
          // ignore
        }
      });
    }
  }

  // State Management for Trigger & Drag
  let triggerMode = "pill"; // 'pill' | 'compact'
  let isPointerDown = false;
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let initialLeft = 0;
  let initialTop = 0;
  const DRAG_THRESHOLD = 5;

  // Restore saved position & mode
  function restoreTriggerState() {
    getStorage(["copilot_trigger_pos", "copilot_trigger_mode"], (data) => {
      if (data && data.copilot_trigger_mode === "compact") {
        setTriggerMode("compact", false);
      } else {
        setTriggerMode("pill", false);
      }

      if (data && data.copilot_trigger_pos) {
        const { left, top } = data.copilot_trigger_pos;
        applyClampedPosition(left, top);
      }
    });
  }

  function setTriggerMode(mode, save = true) {
    triggerMode = mode;
    if (mode === "compact") {
      triggerPill.style.display = "none";
      triggerCompact.style.display = "flex";
    } else {
      triggerCompact.style.display = "none";
      triggerPill.style.display = "flex";
    }
    if (save) {
      setStorage({ copilot_trigger_mode: mode });
    }
    const rect = triggerWrapper.getBoundingClientRect();
    applyClampedPosition(rect.left, rect.top);
  }

  function applyClampedPosition(targetLeft, targetTop) {
    const rect = triggerWrapper.getBoundingClientRect();
    const width = rect.width || 210;
    const height = rect.height || 44;
    const minX = 12;
    const maxX = Math.max(minX, window.innerWidth - width - 12);
    const minY = 12;
    const maxY = Math.max(minY, window.innerHeight - height - 12);

    const clampedX = Math.max(minX, Math.min(maxX, targetLeft));
    const clampedY = Math.max(minY, Math.min(maxY, targetTop));

    triggerWrapper.style.left = `${clampedX}px`;
    triggerWrapper.style.top = `${clampedY}px`;
    triggerWrapper.style.right = "auto";
    triggerWrapper.style.bottom = "auto";

    if (panel.classList.contains("active")) {
      updatePanelPosition();
    }
    return { left: clampedX, top: clampedY };
  }

  // Smart Panel Positioning relative to trigger button
  function updatePanelPosition() {
    const triggerRect = triggerWrapper.getBoundingClientRect();
    const panelWidth = Math.min(400, window.innerWidth - 24);
    const panelHeight = Math.min(panel.offsetHeight || 520, window.innerHeight * 0.85);

    let panelTop = 0;
    if (triggerRect.top > window.innerHeight / 2) {
      panelTop = triggerRect.top - panelHeight - 12;
    } else {
      panelTop = triggerRect.bottom + 12;
    }
    panelTop = Math.max(12, Math.min(window.innerHeight - panelHeight - 12, panelTop));

    let panelLeft = 0;
    if (triggerRect.left > window.innerWidth / 2) {
      panelLeft = triggerRect.right - panelWidth;
    } else {
      panelLeft = triggerRect.left;
    }
    panelLeft = Math.max(12, Math.min(window.innerWidth - panelWidth - 12, panelLeft));

    panel.style.left = `${panelLeft}px`;
    panel.style.top = `${panelTop}px`;
    panel.style.right = "auto";
    panel.style.bottom = "auto";
  }

  // Pointer drag events on triggerWrapper
  triggerWrapper.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    if (e.target.closest("#copilot-collapse-btn")) return;

    isPointerDown = true;
    isDragging = false;
    startX = e.clientX;
    startY = e.clientY;

    const rect = triggerWrapper.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop = rect.top;

    try {
      triggerWrapper.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  });

  window.addEventListener("pointermove", (e) => {
    if (!isPointerDown) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    if (!isDragging && Math.hypot(dx, dy) >= DRAG_THRESHOLD) {
      isDragging = true;
      triggerWrapper.classList.add("dragging");
    }

    if (isDragging) {
      applyClampedPosition(initialLeft + dx, initialTop + dy);
    }
  });

  function handlePointerEnd(e) {
    if (!isPointerDown) return;
    isPointerDown = false;
    triggerWrapper.classList.remove("dragging");

    try {
      if (triggerWrapper.hasPointerCapture && triggerWrapper.hasPointerCapture(e.pointerId)) {
        triggerWrapper.releasePointerCapture(e.pointerId);
      }
    } catch {
      // ignore
    }

    if (isDragging) {
      const rect = triggerWrapper.getBoundingClientRect();
      setStorage({ copilot_trigger_pos: { left: rect.left, top: rect.top } });
      setTimeout(() => {
        isDragging = false;
      }, 50);
    } else {
      onTriggerClick();
    }
  }

  window.addEventListener("pointerup", handlePointerEnd);
  window.addEventListener("pointercancel", handlePointerEnd);

  function onTriggerClick() {
    if (triggerMode === "compact") {
      setTriggerMode("pill", true);
      openPanel();
    } else {
      togglePanel();
    }
  }

  function togglePanel() {
    if (panel.classList.contains("active")) {
      closePanel();
    } else {
      openPanel();
    }
  }

  function openPanel() {
    panel.classList.add("active");
    triggerWrapper.classList.add("panel-open");
    updatePanelPosition();
  }
  function closePanel() {
    panel.classList.remove("active");
    triggerWrapper.classList.remove("panel-open");
    if (topSaverWrapper) topSaverWrapper.classList.remove("panel-open");
  }

  collapseBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    closePanel();
    setTriggerMode("compact", true);
  });

  closeBtn.addEventListener("click", () => {
    closePanel();
  });

  refreshPanelBtn.addEventListener("click", () => {});

  window.addEventListener("resize", () => {
    const rect = triggerWrapper.getBoundingClientRect();
    applyClampedPosition(rect.left, rect.top);
  });

  window.addEventListener("keydown", (e) => {
    if (e.altKey && (e.key === "s" || e.key === "S" || e.code === "KeyS")) {
      e.preventDefault();
      if (triggerMode === "compact") {
        setTriggerMode("pill", true);
      }
      togglePanel();
    }
  });

  restoreTriggerState();

  // Tab Switching
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tabContents.forEach((c) => (c.style.display = "none"));
      tab.classList.add("active");
      const targetId = tab.getAttribute("data-tab");
      const targetContent = shadow.getElementById(targetId);
      if (targetContent) targetContent.style.display = "flex";

      if (targetId === "tab-crm") {
        lookupCurrentPageCandidate();
      }
    });
  });

  // Switch to specific tab helper
  function switchToTab(tabId) {
    const tabEl = shadow.querySelector(`.tab[data-tab="${tabId}"]`);
    if (tabEl) tabEl.click();
  }

  // Feedback banner helper for Tab 3
  function showCrmFeedback(message, type = "success") {
    crmFeedbackBanner.innerHTML = message;
    crmFeedbackBanner.className = `feedback-banner ${type}`;
    crmFeedbackBanner.style.display = "block";
    setTimeout(() => {
      crmFeedbackBanner.style.display = "none";
    }, 5000);
  }

  // Tab 1: Clear & Paste handlers
  clearIncomingBtn.addEventListener("click", () => {
    incomingText.value = "";
    incomingResult.style.display = "none";
    incomingText.focus();
  });

  // Universal helper: Điền văn bản vào ô chat của trang web mẹ (LinkedIn / Telegram / Zalo / Demo)
  function fillChatInput(text) {
    const input = document.querySelector(
      '#main footer [contenteditable="true"], #main footer textarea, #chat-input, .msg-form__contenteditable, div[contenteditable="true"], textarea, input[type="text"]'
    );
    if (!input) return false;
    if (input.tagName === "INPUT" || input.tagName === "TEXTAREA") {
      input.value = text;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    } else if (input.isContentEditable) {
      input.focus();
      document.execCommand("selectAll", false, null);
      document.execCommand("insertText", false, text);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
    input.focus();
    return true;
  }

  // Tab 1: Clear & Paste handlers
  clearIncomingBtn.addEventListener("click", () => {
    incomingText.value = "";
    incomingResult.style.display = "none";
    incomingText.focus();
  });

  pasteIncomingBtn.addEventListener("click", async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        incomingText.value = text;
        incomingText.focus();
      }
    } catch {
      incomingText.focus();
    }
  });

  // Handle Translate Incoming
  btnTranslateIncoming.addEventListener("click", async () => {
    const text = incomingText.value.trim();
    if (!text) return;

    btnTranslateIncoming.disabled = true;
    btnTranslateIncoming.textContent = "⏳ Đang bóc tách deal & dịch...";

    sendMessage({ action: "translate", payload: { text, mode: "incoming", source: translationSource } }, (res) => {
      btnTranslateIncoming.disabled = false;
      btnTranslateIncoming.innerHTML = "<span>⚡</span> Dịch sang tiếng Việt & Phân tích";

      if (res && res.success && res.data) {
        const d = res.data;
        incomingResult.style.display = "flex";
        incomingTranslatedText.textContent = d.translatedText;
        detectedLangBadge.textContent = d.detectedLanguage || "Đa ngôn ngữ";

        // 1. Render Deal Highlights (Task 8.1 - 4 Thỏa thuận cốt lõi)
        const dh = d.dealHighlights || {};
        valSalary.textContent = dh.salary || "Chưa đề cập";
        chipSalary.classList.toggle("has-val", !!dh.salary);

        valVisa.textContent = dh.visa || "Chưa đề cập";
        chipVisa.classList.toggle("has-val", !!dh.visa);

        valWorkmode.textContent = dh.workMode || "Chưa đề cập";
        chipWorkmode.classList.toggle("has-val", !!dh.workMode);

        valStartdate.textContent = dh.startDate || "Chưa đề cập";
        chipStartdate.classList.toggle("has-val", !!dh.startDate);

        // 2. Render Key points
        incomingKeyPoints.innerHTML = "";
        (d.keyPoints || []).forEach((kp) => {
          const div = document.createElement("div");
          div.className = "key-item";
          let icon = "🎯";
          const lower = kp.toLowerCase();
          if (lower.includes("lương") || lower.includes("salary") || lower.includes("won")) icon = "💰";
          else if (lower.includes("visa") || lower.includes("permit")) icon = "🛂";
          else if (lower.includes("phỏng vấn") || lower.includes("interview")) icon = "📅";
          else if (lower.includes("remote") || lower.includes("hybrid")) icon = "🏠";
          div.innerHTML = `<span>${icon}</span> <span>${kp}</span>`;
          incomingKeyPoints.appendChild(div);
        });

        // 3. Render Suggested Replies (1-Chạm tự dịch kính ngữ và điền vào ô chat)
        incomingSuggestedReplies.innerHTML = "";
        incomingFillNotice.style.display = "none";
        (d.suggestedReplies || []).forEach((rep, idx) => {
          const btn = document.createElement("button");
          btn.className = "suggested-reply-btn";
          btn.innerHTML = `<span style="color: #38bdf8; font-weight: 700;">Gợi ý ${idx + 1}:</span> <span>${rep}</span>`;
          btn.title = "Click 1-chạm: Tự động dịch sang kính ngữ và điền vào ô chat của trang web";

          btn.addEventListener("click", () => {
            let targetCode = "ko";
            const detectedLower = (d.detectedLanguage || "").toLowerCase();
            if (detectedLower.includes("nhật") || detectedLower.includes("japan")) targetCode = "ja";
            else if (detectedLower.includes("trung") || detectedLower.includes("chin")) targetCode = "zh";
            else if (detectedLower.includes("đức") || detectedLower.includes("german")) targetCode = "de";
            else if (detectedLower.includes("pháp") || detectedLower.includes("french")) targetCode = "fr";
            else if (detectedLower.includes("anh") || detectedLower.includes("english")) targetCode = "en";

            btn.disabled = true;
            btn.innerHTML = `<span>⏳ Đang dịch sang kính ngữ & điền ô chat...</span>`;

            sendMessage({ action: "translate", payload: { text: rep, targetLang: targetCode, mode: "outgoing", source: translationSource } }, (transRes) => {
              btn.disabled = false;
              btn.innerHTML = `<span style="color: #38bdf8; font-weight: 700;">Gợi ý ${idx + 1}:</span> <span>${rep}</span>`;

              const translated = (transRes && transRes.success && transRes.data)
                ? transRes.data.translatedText
                : rep;

              // Đồng bộ dữ liệu sang Tab 2 để TA verify bản dịch ngược (INV-5)
              outgoingText.value = rep;
              outgoingTargetLang.value = targetCode;
              if (transRes && transRes.success && transRes.data) {
                outgoingResult.style.display = "flex";
                outgoingTranslatedText.textContent = transRes.data.translatedText;
                outgoingBackTranslation.textContent = transRes.data.backTranslation || "Bản dịch tương đương.";
              }

              // Điền vào ô chat của trang web mẹ
              const ok = fillChatInput(translated);
              if (ok) {
                incomingFillNotice.style.display = "flex";
                incomingFillNotice.innerHTML = `<span>✓</span> Đã điền câu trả lời (${targetCode.toUpperCase()}) vào ô chat! Recruiter kiểm tra và bấm Gửi (INV-5).`;
                setTimeout(() => {
                  if (incomingFillNotice) incomingFillNotice.style.display = "none";
                }, 4000);
              }
            });
          });
          incomingSuggestedReplies.appendChild(btn);
        });
      } else {
        alert("Lỗi khi gọi dịch: " + (res?.error || "Không kết nối được CRM Backend"));
      }
    });
  });

  // Tab 2: Handle Translate Outgoing
  btnTranslateOutgoing.addEventListener("click", async () => {
    const text = outgoingText.value.trim();
    const targetLang = outgoingTargetLang.value;
    if (!text) return;

    btnTranslateOutgoing.disabled = true;
    btnTranslateOutgoing.textContent = "⏳ Đang dịch sang ngôn ngữ ứng viên...";

    sendMessage({ action: "translate", payload: { text, targetLang, mode: "outgoing", source: translationSource } }, (res) => {
      btnTranslateOutgoing.disabled = false;
      btnTranslateOutgoing.innerHTML = "<span>✨</span> Dịch sang ngôn ngữ ứng viên";

      if (res && res.success && res.data) {
        const d = res.data;
        outgoingResult.style.display = "flex";
        outgoingTranslatedText.textContent = d.translatedText;
        outgoingBackTranslation.textContent = d.backTranslation || "Bản dịch tương đương chuẩn ngữ cảnh.";
      } else {
        alert("Lỗi khi gọi dịch: " + (res?.error || "Không kết nối được CRM Backend"));
      }
    });
  });

  // Copy Outgoing Text
  copyOutgoingBtn.addEventListener("click", () => {
    const textToCopy = outgoingTranslatedText.textContent;
    if (!textToCopy) return;

    navigator.clipboard.writeText(textToCopy).then(() => {
      copyOutgoingBtn.textContent = "✓ Đã chép!";
      setTimeout(() => (copyOutgoingBtn.textContent = "📋 Chép vào ô chat"), 1500);

      const chatInput = document.querySelector('div[contenteditable="true"], textarea, input[type="text"]');
      if (chatInput) {
        chatInput.focus();
      }
    });
  });

  // Stage Labels Mapping (Tiếng Việt - Task 9.1)
  const STAGE_LABELS_VI = {
    lead: "Lưu tạm (30 ngày)",
    found: "Mới phát hiện",
    contacted: "Đã liên hệ",
    responded: "Đã phản hồi",
    interested: "Quan tâm",
    declined_job: "Từ chối",
    archived: "Đã lưu trữ",
  };

  function getStageLabelVi(stage) {
    if (!stage) return "Đã liên hệ";
    const key = String(stage).toLowerCase().replace("_job", "");
    return STAGE_LABELS_VI[key] || STAGE_LABELS_VI[stage] || String(stage).toUpperCase();
  }

  // -------------------------------------------------------------------------
  // INLINE CHAT HEADER CRM BADGE (TASK 9.1)
  // -------------------------------------------------------------------------

  function findChatHeaderElement() {
    const selectors = [
      ".mock-chat-card .chat-header",
      ".chat-header",
      ".msg-conversation-header",
      ".msg-thread__header",
      ".msg-entity-lockup",
      ".chat-info",
      "#chat-header",
      ".conversation-header",
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  function renderInlineChatCrmBadge(exists, candidate) {
    const header = findChatHeaderElement();
    if (!header) return;

    let hostEl = header.querySelector("#copilot-chat-crm-banner-host");
    if (!hostEl) {
      hostEl = document.createElement("div");
      hostEl.id = "copilot-chat-crm-banner-host";
      hostEl.style.cssText = "all: initial !important; display: block !important; width: 100% !important; margin-top: 8px !important; z-index: 99 !important;";
      header.appendChild(hostEl);
    }

    const shadowRoot = hostEl.shadowRoot || hostEl.attachShadow({ mode: "open" });
    shadowRoot.innerHTML = "";

    const styleEl = document.createElement("style");
    styleEl.textContent = `
      *, *::before, *::after {
        box-sizing: border-box;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      }
      .inline-crm-badge-bar {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
        background: linear-gradient(135deg, rgba(15, 23, 42, 0.96), rgba(30, 41, 59, 0.94));
        border: 1px solid rgba(16, 185, 129, 0.5);
        border-radius: 8px;
        padding: 7px 12px;
        box-shadow: 0 4px 14px -2px rgba(0, 0, 0, 0.4), 0 0 1px 1px rgba(16, 185, 129, 0.2);
        animation: badgeFadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        width: 100%;
      }
      @keyframes badgeFadeIn {
        from { opacity: 0; transform: translateY(-4px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .crm-badge-pill {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 3px 9px;
        border-radius: 9999px;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.03em;
        text-transform: uppercase;
      }
      .crm-badge-pill.in-crm {
        background: rgba(6, 78, 59, 0.8);
        border: 1px solid #10b981;
        color: #34d399;
      }
      .badge-dot {
        font-size: 10px;
        color: #10b981;
      }
      .badge-dot.pulse {
        animation: dotPulse 1.8s infinite;
      }
      @keyframes dotPulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.4; transform: scale(1.3); }
      }
      .crm-badge-meta {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 10px;
        font-size: 12px;
        color: #cbd5e1;
        flex: 1;
      }
      .meta-item {
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }
      .cand-name strong {
        color: #ffffff;
      }
      .cand-job {
        color: #94a3b8;
      }
      .cand-stage {
        padding: 2px 7px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 600;
        background: #0284c725;
        border: 1px solid #0284c750;
        color: #38bdf8;
      }
      .cand-stage.stage-contacted {
        background: rgba(59, 130, 246, 0.2);
        border-color: rgba(59, 130, 246, 0.5);
        color: #60a5fa;
      }
      .cand-stage.stage-responded {
        background: rgba(16, 185, 129, 0.2);
        border-color: rgba(16, 185, 129, 0.5);
        color: #34d399;
      }
      .cand-stage.stage-interested {
        background: rgba(245, 158, 11, 0.2);
        border-color: rgba(245, 158, 11, 0.5);
        color: #fbbf24;
      }
      .crm-badge-link {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 3px 9px;
        background: linear-gradient(135deg, #0284c7, #0369a1);
        color: #ffffff !important;
        border-radius: 5px;
        font-size: 11px;
        font-weight: 600;
        text-decoration: none !important;
        transition: all 0.15s;
        margin-left: auto;
      }
      .crm-badge-link:hover {
        background: linear-gradient(135deg, #0369a1, #075985);
        box-shadow: 0 2px 8px rgba(2, 132, 199, 0.4);
      }
      .inline-crm-badge-bar.not-found {
        border-color: rgba(71, 85, 105, 0.5);
      }
      .crm-badge-pill.not-in-crm {
        background: rgba(51, 65, 85, 0.5);
        border: 1px solid #475569;
        color: #94a3b8;
      }
      .crm-quick-save-btn {
        background: linear-gradient(135deg, #059669, #047857);
        border: none;
        color: #ffffff;
        padding: 4px 10px;
        border-radius: 5px;
        font-size: 11.5px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.15s;
      }
      .crm-quick-save-btn:hover {
        background: linear-gradient(135deg, #047857, #065f46);
      }
    `;
    shadowRoot.appendChild(styleEl);

    const bar = document.createElement("div");
    if (exists && candidate) {
      const stageVi = getStageLabelVi(candidate.currentStage);
      const stageClass = (candidate.currentStage || "lead").replace("_job", "");
      const crmUrl = candidate.id ? `http://localhost:3000/candidates/${candidate.id}` : "http://localhost:3000/candidates";

      bar.className = "inline-crm-badge-bar";
      bar.innerHTML = `
        <div class="crm-badge-pill in-crm">
          <span class="badge-dot pulse">●</span>
          <span class="badge-label">ĐÃ CÓ TRONG CRM</span>
        </div>
        <div class="crm-badge-meta">
          <span class="meta-item cand-name">👤 <strong>${candidate.displayName || "Ứng viên"}</strong></span>
          <span class="meta-item cand-job">💼 <span>${candidate.jobTitle || "Chưa gắn Job"}</span></span>
          <span class="meta-item cand-stage stage-${stageClass}">🏷️ <span>${stageVi}</span></span>
        </div>
        <a href="${crmUrl}" target="_blank" class="crm-badge-link" title="Mở hồ sơ chi tiết trong CRM web app">
          <span>🔗 Mở CRM ↗</span>
        </a>
      `;
    } else {
      bar.className = "inline-crm-badge-bar not-found";
      bar.innerHTML = `
        <div class="crm-badge-pill not-in-crm">
          <span class="badge-dot">○</span>
          <span class="badge-label">CHƯA CÓ TRONG CRM</span>
        </div>
        <span style="font-size: 11.5px; color: #94a3b8;">Hồ sơ này chưa được lưu vào hệ thống CRM.</span>
        <button class="crm-quick-save-btn" id="btn-inline-save-lead" style="margin-left: auto;">
          <span>➕ Lưu vào CRM (1-Click)</span>
        </button>
      `;

      const saveBtn = bar.querySelector("#btn-inline-save-lead");
      if (saveBtn) {
        saveBtn.addEventListener("click", () => {
          if (trSaverCard) {
            trSaverCard.style.display = "block";
            const info = extractCandidateProfileInfo();
            if (trLeadName) trLeadName.value = info.displayName;
            if (trLeadUrl) trLeadUrl.value = info.profileUrl;
            fetchJobsForDropdown();
          } else {
            openPanel();
            switchToTab("tab-crm");
          }
        });
      }
    }

    shadowRoot.appendChild(bar);
  }

  // Tab 3: Look up Candidate by Current URL / Chat Profile URL (Task 9.1)
  function lookupCurrentPageCandidate() {
    const info = extractCandidateProfileInfo();
    const currentUrl = info.profileUrl || window.location.href;
    crmLoadingState.style.display = "block";
    crmCandidateFound.style.display = "none";
    crmCandidateNotfound.style.display = "none";

    sendMessage({ action: "checkCandidate", payload: { url: currentUrl } }, (res) => {
      crmLoadingState.style.display = "none";

      if (res && res.success && res.data && res.data.exists && res.data.candidate) {
        activeCandidate = res.data.candidate;
        tabCrmBadge.style.display = "inline-block";
        crmCandidateFound.style.display = "flex";
        crmCandidateNotfound.style.display = "none";

        // Render Candidate info
        const name = activeCandidate.displayName || info.displayName || "Ứng viên";
        candNameDisplay.textContent = name;
        candAvatar.textContent = name.slice(0, 2).toUpperCase();
        candJobDisplay.textContent = activeCandidate.jobTitle ? `Vị trí: ${activeCandidate.jobTitle}` : "Chưa gắn Job tuyển dụng";
        candOwnerDisplay.textContent = activeCandidate.owner?.name || activeCandidate.ownerId || "Chưa gán";

        // Render Stage
        renderStageBadge(activeCandidate.currentStage || "contacted");

        // Render Signals
        const signals = activeCandidate.readinessSignals || [];
        btnSignalRecent.classList.toggle("has-signal", signals.includes("recent_activity"));
        btnSignalCv.classList.toggle("has-signal", signals.includes("cv_recently_updated"));

        candCrmLink.href = `http://localhost:3000/candidates/${activeCandidate.id}`;

        // Sync Top-Right Saver state (Task 9.1: ● ĐÃ CÓ TRONG CRM)
        updateTopRightSaverState(true, activeCandidate);

        // Sync Inline Chat Header Badge (Task 9.1)
        renderInlineChatCrmBadge(true, activeCandidate);
      } else {
        activeCandidate = null;
        tabCrmBadge.style.display = "none";
        crmCandidateFound.style.display = "none";
        crmCandidateNotfound.style.display = "flex";

        candCrmLink.href = `http://localhost:3000/candidates`;

        autoDetectPageLeadInfo();
        fetchJobsForDropdown();

        // Sync Top-Right Saver state
        updateTopRightSaverState(false, null);

        // Sync Inline Chat Header Badge
        renderInlineChatCrmBadge(false, null);
      }
    });
  }

  // Lắng nghe sự kiện chuyển đổi kịch bản giả lập từ Sandbox Demo
  window.addEventListener("copilot:switch-scenario", () => {
    lookupCurrentPageCandidate();
  });

  function renderStageBadge(stage) {
    const stageVi = getStageLabelVi(stage);
    candStageBadge.textContent = stageVi.toUpperCase();
    candStageBadge.className = `stage-pill stage-${(stage || "found").replace("_job", "")}`;

    // Highlight action buttons
    btnStageResponded.classList.toggle("active", stage === "responded");
    btnStageInterested.classList.toggle("active", stage === "interested");
    btnStageDeclined.classList.toggle("active", stage === "declined_job");
  }

  // -------------------------------------------------------------------------
  // AUTO-SYNC CONVERSATION SUMMARY TO CRM ACTIVITY (TASK 9.2 - ZERO-CLICK)
  // -------------------------------------------------------------------------
  let lastSyncedTextHash = "";
  let autoSyncDebounceTimer = null;

  function updateCrmSyncActivityStatus(text) {
    const bannerHost = document.querySelector("#copilot-chat-crm-banner-host");
    if (bannerHost && bannerHost.shadowRoot) {
      const el = bannerHost.shadowRoot.querySelector("#banner-auto-sync-text");
      if (el) el.textContent = text;
    }
  }

  function autoSyncConversationToCrmActivity(summaryText) {
    if (!summaryText) return;
    if (summaryText === lastSyncedTextHash) return;
    lastSyncedTextHash = summaryText;

    updateCrmSyncActivityStatus("⏳ Đang đồng bộ CRM Activity...");

    clearTimeout(autoSyncDebounceTimer);
    autoSyncDebounceTimer = setTimeout(() => {
      const candId = activeCandidate?.id || (typeof window !== "undefined" && window.__DEMO_LAST_SAVED_CANDIDATE__?.id) || "cand-kim-min-soo-01";
      sendMessage({
        action: "updateCandidate",
        payload: {
          candidateId: candId,
          action: "append_note",
          note: summaryText,
        },
      }, (res) => {
        if (res && res.success) {
          const nowStr = new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
          updateCrmSyncActivityStatus(`✓ Đã tự động lưu CRM Activity (${nowStr})`);
          if (candQuickNote) {
            candQuickNote.placeholder = `Tóm tắt gần nhất đã tự động lưu: "${summaryText.slice(0, 45)}..."`;
          }
        }
      });
    }, 1200);
  }

  // 1-Click Transition Stage Handler (INV-2 owner check - Task 9.2)
  function handleTransitionStage(toStage) {
    if (!activeCandidate) return;

    sendMessage({
      action: "updateCandidate",
      payload: {
        candidateId: activeCandidate.id,
        action: "transition_stage",
        toStage,
        jobId: activeCandidate.jobId,
      },
    }, (res) => {
      if (res && res.success) {
        activeCandidate.currentStage = toStage;
        renderStageBadge(toStage);
        updateTopRightSaverState(true, activeCandidate);
        renderInlineChatCrmBadge(true, activeCandidate);
        showCrmFeedback(`✓ Đã chuyển trạng thái sang "${getStageLabelVi(toStage)}" thành công!`, "success");
      } else {
        showCrmFeedback(`✕ ${res?.error || "Lỗi khi chuyển trạng thái (INV-2: Chỉ Owner được thao tác)"}`, "error");
      }
    });
  }

  btnStageResponded.addEventListener("click", () => handleTransitionStage("responded"));
  btnStageInterested.addEventListener("click", () => handleTransitionStage("interested"));
  btnStageDeclined.addEventListener("click", () => handleTransitionStage("declined_job"));

  // 1-Click Add Signal Handler (Task 9.2)
  function handleAddSignal(signal) {
    if (!activeCandidate) return;

    sendMessage({
      action: "updateCandidate",
      payload: {
        candidateId: activeCandidate.id,
        action: "add_signal",
        signal,
      },
    }, (res) => {
      if (res && res.success) {
        if (!activeCandidate.readinessSignals) activeCandidate.readinessSignals = [];
        if (!activeCandidate.readinessSignals.includes(signal)) {
          activeCandidate.readinessSignals.push(signal);
        }
        if (signal === "recent_activity") btnSignalRecent.classList.add("has-signal");
        if (signal === "cv_recently_updated") btnSignalCv.classList.add("has-signal");
        renderInlineChatCrmBadge(true, activeCandidate);
        showCrmFeedback("✓ Đã ghi nhận tín hiệu thị trường vào CRM!", "success");
      } else {
        showCrmFeedback(`✕ ${res?.error || "Lỗi ghi nhận tín hiệu"}`, "error");
      }
    });
  }

  btnSignalRecent.addEventListener("click", () => handleAddSignal("recent_activity"));
  btnSignalCv.addEventListener("click", () => handleAddSignal("cv_recently_updated"));

  // Quick Activity Note Handler
  btnAppendNote.addEventListener("click", () => {
    if (!activeCandidate) return;
    const note = candQuickNote.value.trim();
    if (!note) {
      alert("Vui lòng nhập nội dung ghi chú");
      return;
    }

    btnAppendNote.disabled = true;
    btnAppendNote.textContent = "⏳ Đang lưu...";

    sendMessage({
      action: "updateCandidate",
      payload: {
        candidateId: activeCandidate.id,
        action: "append_note",
        note,
      },
    }, (res) => {
      btnAppendNote.disabled = false;
      btnAppendNote.textContent = "📝 Lưu vào lịch sử";

      if (res && res.success) {
        candQuickNote.value = "";
        showCrmFeedback("✓ Đã thêm ghi chú vào dòng thời gian hoạt động!", "success");
      } else {
        showCrmFeedback(`✕ ${res?.error || "Lỗi lưu ghi chú"}`, "error");
      }
    });
  });

  // Robust Profile Info Extractor from DOM, Title, Chat Headers and URL (Task 8.3 & Task 9.1)
  function extractCandidateProfileInfo() {
    let url = window.location.href;
    let displayName = "";

    const isLocalDemo = url.includes("demo.html") || url.startsWith("file:") || url.includes("localhost");

    if (isLocalDemo) {
      if (typeof window !== "undefined" && window.__CURRENT_SIMULATED_PROFILE__) {
        return {
          displayName: window.__CURRENT_SIMULATED_PROFILE__.displayName,
          profileUrl: window.__CURRENT_SIMULATED_PROFILE__.profileUrl,
        };
      }
      const candEl = document.querySelector(".candidate-name");
      if (candEl && candEl.textContent) {
        displayName = candEl.textContent.replace(/\(.*?\)/g, "").replace(/[^\w\s-]/g, "").trim();
      }
      url = "https://www.linkedin.com/in/kim-min-soo";
      if (!displayName) displayName = "Kim Min-soo";
    } else {
      // 1. Kiểm tra link profile của ứng viên trong chat header (LinkedIn Messaging, Telegram Web)
      const chatProfileLink = document.querySelector(
        'a.msg-conversation-header__profile-link, .msg-entity-lockup__entity-title a, a[data-control-name="view_profile"], a.msg-thread__link-to-profile, .chat-info a[href*="t.me/"], a[href*="linkedin.com/in/"], a[href^="/in/"]'
      );
      if (chatProfileLink && chatProfileLink.href) {
        url = chatProfileLink.href;
        if (chatProfileLink.innerText && chatProfileLink.innerText.trim()) {
          displayName = chatProfileLink.innerText.trim().split("\n")[0].trim();
        }
      }

      try {
        const parsed = new URL(url);
        parsed.search = "";
        parsed.hash = "";
        url = parsed.toString().replace(/\/+$/, "");
      } catch {
        // keep url as is
      }

      if (!displayName) {
        const possibleSelectors = [
          ".candidate-name",
          ".msg-entity-lockup__entity-title",
          ".msg-conversation-header__profile-link",
          "h1.text-heading-xlarge",
          "h1[data-anonymize='person-name']",
          ".top-card-layout__title",
          ".pv-top-card--list h1",
          "h1.vcard-names",
          ".profile-info-name",
          ".chat-info .person .name",
        ];

        for (const sel of possibleSelectors) {
          const el = document.querySelector(sel);
          if (el && el.innerText && el.innerText.trim()) {
            displayName = el.innerText.trim().split("\n")[0].trim();
            break;
          }
        }
      }

      if (!displayName && document.title) {
        let t = document.title;
        t = t.split("|")[0].split("-")[0].replace("Sandbox Demo:", "").trim();
        if (t && !/linkedin|github|facebook|zalo|telegram/i.test(t)) {
          displayName = t;
        }
      }

      if (!displayName) displayName = "Ứng viên";
    }

    return { displayName, profileUrl: url };
  }

  // Auto Detect Profile Info from Page URL & DOM
  function autoDetectPageLeadInfo() {
    const info = extractCandidateProfileInfo();
    leadUrl.value = info.profileUrl;
    if (!leadName.value || leadName.value === "Ứng viên") {
      leadName.value = info.displayName;
    }
  }

  // Fetch Jobs for Dropdown (Tab 3 & Top-Right Saver)
  function fetchJobsForDropdown() {
    sendMessage({ action: "getJobs" }, (res) => {
      if (res && res.success && res.data && res.data.jobs) {
        const jobs = res.data.jobs;
        if (leadJobSelect) {
          leadJobSelect.innerHTML = '<option value="">-- Chọn vị trí tuyển dụng --</option>';
          jobs.forEach((j) => {
            const opt = document.createElement("option");
            opt.value = j.id;
            opt.textContent = `${j.title} (${j.department || "IT"})`;
            leadJobSelect.appendChild(opt);
          });
        }
        if (trLeadJob) {
          trLeadJob.innerHTML = '<option value="">-- Chọn vị trí tuyển dụng --</option>';
          jobs.forEach((j) => {
            const opt = document.createElement("option");
            opt.value = j.id;
            opt.textContent = `${j.title} (${j.department || "IT"})`;
            trLeadJob.appendChild(opt);
          });
        }
      }
    });
  }

  // Handle Save Lead in Tab 3
  btnSaveLead.addEventListener("click", () => {
    const displayName = leadName.value.trim();
    const profileUrl = leadUrl.value.trim();
    const jobId = leadJobSelect.value;
    const note = leadNote.value.trim();

    if (!displayName || !profileUrl) {
      alert("Vui lòng điền tên và link profile");
      return;
    }

    btnSaveLead.disabled = true;
    btnSaveLead.textContent = "⏳ Đang lưu vào CRM...";

    sendMessage({
      action: "createLead",
      payload: {
        displayName,
        profileUrl,
        platform: profileUrl.includes("linkedin") ? "linkedin" : "facebook",
        jobId: jobId || undefined,
        note: note ? `[Ghi nhận từ Copilot Extension] ${note}` : "[Ghi nhận từ Copilot Extension]",
      },
    }, (res) => {
      btnSaveLead.disabled = false;
      btnSaveLead.innerHTML = "<span>💾</span> Lưu vào CRM (Lưu tạm - 30 ngày)";

      if (res && res.success) {
        const candidateId = res.data?.data?.candidateId || res.data?.candidateId;
        const crmUrl = candidateId ? `http://localhost:3000/candidates/${candidateId}` : "http://localhost:3000/candidates";
        showCrmFeedback(
          `✓ Đã lưu thành công vào CRM! <a href="${crmUrl}" target="_blank" style="color: #38bdf8; text-decoration: underline; font-weight: 600; margin-left: 6px;">Mở hồ sơ ngay ↗</a>`,
          "success"
        );

        // Update Top-Right button state
        updateTopRightSaverState(true, {
          id: candidateId,
          displayName,
          jobTitle: leadJobSelect.options[leadJobSelect.selectedIndex]?.text || "",
          currentStage: "lead",
        });

        // Reload candidate status to switch into Candidate Found card
        setTimeout(() => {
          lookupCurrentPageCandidate();
        }, 800);
      } else {
        showCrmFeedback("Lỗi: " + (res?.error || "Không thể kết nối máy chủ"), "error");
      }
    });
  });

  // -------------------------------------------------------------------------
  // TOP-RIGHT 1-CLICK LEAD SAVER CONTROLLER (TASK 8.3 & TASK 9.1)
  // -------------------------------------------------------------------------

  function updateTopRightSaverState(isSaved, candidateData) {
    if (!trSaverBtn) return;

    if (isSaved && candidateData) {
      const stageVi = getStageLabelVi(candidateData.currentStage);
      const name = candidateData.displayName || "Ứng viên";
      const job = candidateData.jobTitle || "Chưa gắn Job tuyển dụng";

      trSaverBtn.className = "copilot-top-saver-btn saved";
      trSaverIcon.textContent = "●";
      trSaverLabel.textContent = "ĐÃ CÓ TRONG CRM";
      trSaverExt.style.display = "inline";
      trSaverBtn.title = `● ĐÃ CÓ TRONG CRM • ${name} • ${job} • ${stageVi}`;

      // Populate saved view
      trViewSaved.style.display = "flex";
      trViewUnsaved.style.display = "none";
      trSavedName.textContent = name;
      trSavedAvatar.textContent = name.slice(0, 2).toUpperCase();
      const stage = candidateData.currentStage || "lead";
      trSavedStage.textContent = stageVi.toUpperCase();
      trSavedStage.className = `stage-pill stage-${stage.replace("_job", "")}`;
      trSavedJob.textContent = `💼 ${job}`;

      const crmUrl = candidateData.id ? `http://localhost:3000/candidates/${candidateData.id}` : "http://localhost:3000/candidates";
      trViewExistingCrmLink.href = crmUrl;
    } else {
      trSaverBtn.className = "copilot-top-saver-btn unsaved";
      trSaverIcon.textContent = "👤";
      trSaverLabel.textContent = "+ Lưu vào CRM";
      trSaverExt.style.display = "none";
      trSaverBtn.title = "Lưu nhanh hồ sơ ứng viên vào CRM (1-Click)";

      trViewSaved.style.display = "none";
      trViewUnsaved.style.display = "flex";

      // Prefill un-saved fields
      const info = extractCandidateProfileInfo();
      if (!trLeadName.value || trLeadName.value === "Ứng viên") trLeadName.value = info.displayName;
      if (!trLeadUrl.value) trLeadUrl.value = info.profileUrl;
    }
  }

  // Smart text selection listener for Quick Translation Tooltip (Task 7.4)
  function detectSelectionLanguage(text) {
    if (/[\uAC00-\uD7AF\u1100-\u11FF]/.test(text)) {
      return { lang: "ko", label: "Dịch tiếng Hàn 🇰🇷" };
    }
    if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) {
      return { lang: "ja", label: "Dịch tiếng Nhật 🇯🇵" };
    }
    if (/[\u4E00-\u9FFF]/.test(text)) {
      return { lang: "zh", label: "Dịch tiếng Trung 🇨🇳" };
    }
    return { lang: "auto", label: "Dịch Copilot" };
  }

  let lastSelectedText = "";

  document.addEventListener("mouseup", (e) => {
    // If click inside our shadow host, ignore
    if (host.contains(e.target)) return;

    // Small delay to allow browser text selection to finalize
    setTimeout(() => {
      const selection = window.getSelection();
      const selectedText = selection ? selection.toString().trim() : "";

      if (selectedText && selectedText.length >= 2) {
        lastSelectedText = selectedText;
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        // Detect language & dynamic label
        const detected = detectSelectionLanguage(selectedText);
        if (selectionTooltipText) {
          selectionTooltipText.textContent = detected.label;
        }

        // Tooltip dimensions: width ~140px, height ~32px
        const tooltipWidth = 140;
        const tooltipHeight = 32;

        let top = rect.top - tooltipHeight - 8;
        if (top < 10) {
          // If too close to viewport top, show beneath selection
          top = Math.min(window.innerHeight - tooltipHeight - 10, rect.bottom + 8);
        }

        let left = rect.left + rect.width / 2 - tooltipWidth / 2;
        left = Math.max(12, Math.min(window.innerWidth - tooltipWidth - 12, left));

        selectionTooltip.style.top = `${top}px`;
        selectionTooltip.style.left = `${left}px`;
        selectionTooltip.style.display = "flex";

        selectionTooltip.onclick = (evt) => {
          evt.stopPropagation();
          selectionTooltip.style.display = "none";
          openPanel();
          switchToTab("tab-incoming");
          incomingText.value = lastSelectedText;
          btnTranslateIncoming.click();
        };
      } else {
        selectionTooltip.style.display = "none";
      }
    }, 20);
  });

  // Hide tooltip when clicking anywhere outside
  document.addEventListener("mousedown", (e) => {
    if (host.contains(e.target)) return;
    selectionTooltip.style.display = "none";
  });

  // Hide tooltip on scroll to prevent detached floating state
  window.addEventListener("scroll", () => {
    if (selectionTooltip.style.display === "flex") {
      selectionTooltip.style.display = "none";
    }
  }, { passive: true });

  // =========================================================================
  // TASK 8: SOURCING COPILOT TRỰC CHIẾN (SEAMLESS IN-CHAT EXPERIENCE)
  // 1. Quản lý ngôn ngữ tự động & lưu nhớ theo từng Thread Hội thoại
  // 2. Dịch tin nhắn đến khi người dùng bấm nút + Accordion Deal & Gợi ý
  // 3. Nút [✨ Dịch] & [↺ Hoàn tác] gắn trực tiếp cạnh Nút Gửi của trang web (INV-5)
  // =========================================================================

  const LANG_METADATA = {
    ko: { code: "ko", name: "Tiếng Hàn", flag: "🇰🇷", label: "한국어", polite: "존댓말" },
    ja: { code: "ja", name: "Tiếng Nhật", flag: "🇯🇵", label: "日本語", polite: "敬語" },
    en: { code: "en", name: "Tiếng Anh", flag: "🇺🇸", label: "English", polite: "Business" },
    zh: { code: "zh", name: "Tiếng Trung", flag: "🇨🇳", label: "中文", polite: "商务礼仪" },
    de: { code: "de", name: "Tiếng Đức", flag: "🇩🇪", label: "Deutsch", polite: "Sie-Form" },
    fr: { code: "fr", name: "Tiếng Pháp", flag: "🇫🇷", label: "Français", polite: "Vouvoyer" },
    ru: { code: "ru", name: "Tiếng Nga", flag: "🇷🇺", label: "Русский", polite: "Вы-форма" },
    hi: { code: "hi", name: "Tiếng Hindi", flag: "🇮🇳", label: "हिन्दी", polite: "आप-रूप" },
  };

  function getThreadId() {
    if (isWhatsAppWebPage) return "whatsapp_default";
    const url = window.location.href;
    const match = url.match(/messaging\/thread\/([a-zA-Z0-9_\-]+)/) || url.match(/\/im\?p=([a-zA-Z0-9_\-]+)/);
    if (match) return match[1];
    const candidateNameEl = document.querySelector("[data-testid='conversation-header'] span[title], #main header span[title], .candidate-name, .msg-entity-lockup__entity-title, .chat-title, .user-name");
    if (candidateNameEl && candidateNameEl.innerText.trim()) {
      return "thread_" + candidateNameEl.innerText.trim().replace(/[^\w\d]/g, "_");
    }
    return "thread_default";
  }

  function detectCandidateLanguageFromDOM() {
    const msgs = document.querySelectorAll(".msg-group.incoming .msg-bubble, .msg-bubble, .msg-s-event-listitem__body, .message-content, #main .message-in .copyable-text, #main .message-in [data-pre-plain-text]");
    for (let i = msgs.length - 1; i >= 0; i--) {
      const text = msgs[i].innerText || "";
      if (/[\uac00-\ud7af\u1100-\u11ff]/.test(text)) return "ko";
      if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) return "ja";
      if (/[\u4e00-\u9fff]/.test(text)) return "zh";
      if (/gehalt|arbeitsvisum|guten/i.test(text)) return "de";
      if (/bonjour|merci|salut/i.test(text)) return "fr";
      if (/[\u0400-\u04ff]/.test(text)) return "ru";
      if (/[\u0900-\u097f]/.test(text)) return "hi";
    }
    return "ko";
  }

  let currentThreadLang = "ko";
  const threadLangSubscribers = new Set();

  function subscribeThreadLang(callback) {
    threadLangSubscribers.add(callback);
    callback(currentThreadLang);
  }

  function notifyThreadLangChange() {
    threadLangSubscribers.forEach((cb) => cb(currentThreadLang));
  }

  function loadThreadLanguage(callback) {
    const threadId = getThreadId();
    getStorage(["copilot_lang_" + threadId], (res) => {
      const saved = res && res["copilot_lang_" + threadId];
      if (saved && LANG_METADATA[saved]) {
        currentThreadLang = saved;
      } else {
        currentThreadLang = detectCandidateLanguageFromDOM();
      }
      notifyThreadLangChange();
      if (callback) callback(currentThreadLang);
    });
  }

  function saveThreadLanguage(lang, callback) {
    const threadId = getThreadId();
    currentThreadLang = lang;
    notifyThreadLangChange();
    setStorage({ ["copilot_lang_" + threadId]: lang });
    if (callback) callback(lang);
  }

  // Khởi tạo ngôn ngữ thread ban đầu
  loadThreadLanguage();

  // -------------------------------------------------------------------------
  // INLINE MESSAGE TRANSLATOR (MANUAL TRANSLATION & ACCORDION DEAL)
  // -------------------------------------------------------------------------

  const INLINE_MESSAGE_STYLES = `
    :host {
      all: initial !important;
      display: block !important;
      width: 100% !important;
      margin-top: 6px !important;
      margin-bottom: 8px !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
    }
    *, *::before, *::after {
      box-sizing: border-box;
    }
    .auto-trans-container {
      background: linear-gradient(145deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.92));
      backdrop-filter: blur(8px);
      border: 1px solid rgba(56, 189, 248, 0.35);
      border-radius: 10px;
      padding: 9px 12px;
      box-shadow: 0 4px 16px -2px rgba(0, 0, 0, 0.4), 0 0 1px 1px rgba(56, 189, 248, 0.15);
      color: #f8fafc;
      animation: transFadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .message-translate-btn {
      border: 1px solid rgba(56, 189, 248, 0.4);
      border-radius: 7px;
      padding: 5px 9px;
      color: #7dd3fc;
      background: rgba(2, 132, 199, 0.16);
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
    }
    .message-translate-btn:disabled { opacity: 0.6; cursor: wait; }
    @keyframes transFadeIn {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .auto-trans-loading {
      display: flex;
      align-items: center;
      gap: 7px;
      font-size: 12px;
      color: #38bdf8;
      font-weight: 500;
    }
    .auto-trans-loading .spinner {
      animation: spin 1.2s linear infinite;
    }
    @keyframes spin {
      100% { transform: rotate(360deg); }
    }
    .trans-body {
      display: flex;
      align-items: flex-start;
      gap: 8px;
    }
    .vietnam-flag {
      font-size: 15px;
      line-height: 1.35;
      flex-shrink: 0;
    }
    .trans-text {
      font-size: 12.8px;
      font-weight: 500;
      color: #f1f5f9;
      line-height: 1.5;
      word-break: break-word;
    }
    .trans-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 8px;
      padding-top: 7px;
      border-top: 1px solid rgba(51, 65, 85, 0.6);
    }
    .btn-toggle-deal {
      background: rgba(2, 132, 199, 0.15);
      border: 1px solid rgba(56, 189, 248, 0.35);
      border-radius: 6px;
      padding: 3px 8px;
      color: #38bdf8;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      transition: all 0.15s;
    }
    .btn-toggle-deal:hover {
      background: rgba(2, 132, 199, 0.3);
      border-color: #38bdf8;
      color: #ffffff;
    }
    .btn-toggle-deal .arrow {
      font-size: 10px;
      transition: transform 0.2s;
    }
    .btn-toggle-deal.active .arrow {
      transform: rotate(180deg);
    }
    .detected-badge {
      font-size: 10px;
      padding: 2px 7px;
      border-radius: 9999px;
      background: rgba(56, 189, 248, 0.1);
      color: #94a3b8;
      border: 1px solid rgba(56, 189, 248, 0.2);
    }
    .deal-accordion {
      margin-top: 9px;
      padding-top: 9px;
      border-top: 1px dashed rgba(56, 189, 248, 0.25);
      animation: transFadeIn 0.2s;
    }
    .deal-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      margin-bottom: 9px;
    }
    .deal-chip {
      background: rgba(15, 23, 42, 0.7);
      border: 1px solid #334155;
      border-radius: 6px;
      padding: 5px 8px;
      font-size: 11px;
      display: flex;
      align-items: center;
      gap: 5px;
      overflow: hidden;
    }
    .deal-chip.has-val {
      border-color: rgba(56, 189, 248, 0.45);
      background: rgba(2, 132, 199, 0.12);
    }
    .deal-chip .icon {
      font-size: 12px;
      flex-shrink: 0;
    }
    .deal-chip .key {
      color: #94a3b8;
      font-size: 10px;
      font-weight: 600;
      flex-shrink: 0;
    }
    .deal-chip .val {
      color: #38bdf8;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .quick-replies-label {
      font-size: 10.5px;
      font-weight: 700;
      color: #94a3b8;
      letter-spacing: 0.02em;
      margin-bottom: 6px;
    }
    .replies-list {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    .quick-reply-btn {
      background: rgba(30, 41, 59, 0.85);
      border: 1px solid rgba(56, 189, 248, 0.25);
      border-radius: 7px;
      padding: 7px 10px;
      color: #cbd5e1;
      font-size: 11.5px;
      cursor: pointer;
      text-align: left;
      line-height: 1.4;
      display: flex;
      align-items: flex-start;
      gap: 6px;
      transition: all 0.15s;
    }
    .quick-reply-btn:hover {
      background: rgba(2, 132, 199, 0.22);
      border-color: #38bdf8;
      color: #ffffff;
      transform: translateX(2px);
    }
    .quick-reply-btn:disabled {
      opacity: 0.65;
      cursor: wait;
    }
    .inline-feedback {
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.4);
      color: #34d399;
      border-radius: 6px;
      padding: 6px 9px;
      font-size: 11px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 6px;
      animation: transFadeIn 0.2s;
    }
    .inline-feedback {
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.4);
      color: #34d399;
      border-radius: 6px;
      padding: 6px 9px;
      font-size: 11px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 6px;
      animation: transFadeIn 0.2s;
    }
  `;

  function setupInlineMessageObserver() {
    const SELECTORS = [
      "#chat-body .msg-group.incoming .msg-bubble",
      ".msg-bubble",
      ".msg-s-event-listitem__body",
      ".msg-s-message-list__event",
      ".message-content",
      "[data-message-bubble]",
      "#main .message-in .copyable-text",
      "#main .message-in [data-pre-plain-text]",
      "#main [data-testid='conversation-panel-messages'] [data-testid='selectable-text']",
      "#main [data-testid='msg-container'] [data-testid='selectable-text']",
      "[role='dialog'] [data-pre-plain-text]",
      "[role='alert'] [data-testid='selectable-text']",
      "[data-testid='toast'] [data-pre-plain-text]",
      "[role='alert'] .message-in .copyable-text",
      "[aria-live] .message-in .copyable-text"
    ];

    function isEligibleMessage(el) {
      if (!el || el.dataset.sourcingCopilotDecorated) return false;
      // Không can thiệp tin nhắn do chính recruiter gửi
      if (el.closest(".outgoing, .message-out, [data-testid='msg-container'].message-out") || el.closest(".msg-s-message-list__event--outgoing")) return false;
      if (el.closest("#sourcing-copilot-host, .sourcing-copilot-inline-host")) return false;
      const text = el.innerText ? el.innerText.trim() : "";
      if (text.length < 3) return false;
      // Nhận diện ký tự ngoại ngữ hoặc tin nhắn chat thông thường
      const hasForeign = /[\uac00-\ud7af\u1100-\u11ff\u3040-\u30ff\u4e00-\u9fff\u0400-\u04ff]|[a-zA-Z]{3,}/i.test(text);
      return hasForeign;
    }

    function decorateBubble(bubbleEl) {
      if (!isEligibleMessage(bubbleEl)) return;
      bubbleEl.dataset.sourcingCopilotDecorated = "true";

      const originalText = bubbleEl.innerText.trim();

      const inlineHost = document.createElement("div");
      inlineHost.className = "sourcing-copilot-inline-host";
      const inlineShadow = inlineHost.attachShadow({ mode: "open" });

      const styleEl = document.createElement("style");
      styleEl.textContent = INLINE_MESSAGE_STYLES;
      inlineShadow.appendChild(styleEl);

      const wrapper = document.createElement("div");
      wrapper.className = "auto-trans-container";
      wrapper.innerHTML = `
        <button class="message-translate-btn" id="translate-message-btn" type="button">🌐 Dịch tin này</button>
        <div class="auto-trans-loading" id="loading-state" style="display: none;">
          <span class="spinner">⏳</span> Đang dịch tin nhắn sang tiếng Việt...
        </div>
        <div id="content-state" style="display: none;">
          <div class="trans-body">
            <span class="vietnam-flag">🇻🇳</span>
            <span class="trans-text" id="trans-text"></span>
          </div>
          <div class="trans-footer">
            <button class="btn-toggle-deal" id="btn-toggle-deal" title="Bấm để xem bóc tách thỏa thuận & kịch bản gợi ý">
              <span>✨</span> Gợi ý & Bóc tách deal <span class="arrow">▾</span>
            </button>
            <span class="detected-badge" id="detected-badge">Đa ngôn ngữ</span>
          </div>
          <div class="deal-accordion" id="deal-accordion" style="display: none;">
            <div class="deal-grid" id="deal-grid"></div>
            <div class="quick-replies-label">⚡ PHẢN HỒI GỢI Ý 1-CHẠM (ĐIỀN VÀO Ô CHAT):</div>
            <div class="replies-list" id="replies-list"></div>
            <div class="inline-feedback" id="inline-feedback" style="display: none;"></div>
          </div>
        </div>
      `;
      inlineShadow.appendChild(wrapper);

      // Chèn host element ngay bên dưới bong bóng tin nhắn
      bubbleEl.insertAdjacentElement("afterend", inlineHost);

      const loadingState = inlineShadow.getElementById("loading-state");
      const translateButton = inlineShadow.getElementById("translate-message-btn");
      const contentState = inlineShadow.getElementById("content-state");
      const transText = inlineShadow.getElementById("trans-text");
      const detectedBadge = inlineShadow.getElementById("detected-badge");
      const btnToggleDeal = inlineShadow.getElementById("btn-toggle-deal");
      const dealAccordion = inlineShadow.getElementById("deal-accordion");
      const dealGrid = inlineShadow.getElementById("deal-grid");
      const repliesList = inlineShadow.getElementById("replies-list");
      const feedbackEl = inlineShadow.getElementById("inline-feedback");

      // Translate only after the recruiter clicks this message's button.
      function translateBubble() {
        translateButton.disabled = true;
        translateButton.textContent = "Đang dịch…";
        loadingState.style.display = "flex";
        sendMessage({ action: "translate", payload: { text: originalText, mode: "incoming", source: translationSource } }, (res) => {
        translateButton.disabled = false;
        translateButton.textContent = "🌐 Dịch lại";
        loadingState.style.display = "none";
        if (!res || !res.success || !res.data) {
          translateButton.textContent = "Try again";
          translateButton.title = res?.error || "Không dịch được tin nhắn. Hãy thử lại.";
          loadingState.innerHTML = `<span style="color: #ef4444;">⚠️ Không kết nối được bộ dịch</span>`;
          return;
        }

        const d = res.data;
        const dh = d.dealHighlights || {};

        // Tự động cập nhật ngôn ngữ thread nếu nhận diện được
        const detected = (d.detectedLanguage || "").toLowerCase();
        let targetCode = currentThreadLang;
        if (detected.includes("hàn") || detected.includes("korean")) targetCode = "ko";
        else if (detected.includes("nhật") || detected.includes("japanese")) targetCode = "ja";
        else if (detected.includes("trung") || detected.includes("chinese")) targetCode = "zh";
        else if (detected.includes("đức") || detected.includes("german")) targetCode = "de";
        else if (detected.includes("pháp") || detected.includes("french")) targetCode = "fr";
        else if (detected.includes("anh") || detected.includes("english")) targetCode = "en";

        if (targetCode !== currentThreadLang) {
          saveThreadLanguage(targetCode);
        }

        loadingState.style.display = "none";
        contentState.style.display = "block";
        transText.textContent = d.translatedText;
        detectedBadge.textContent = d.detectedLanguage || "Đa ngôn ngữ";

        // =========================================================================
        // HỆ THỐNG TỰ ĐỘNG ĐỒNG BỘ 100% VÀO CRM (KHÔNG CẦN BẤM NÚT GÌ CẢ - ZERO-CLICK)
        // =========================================================================

        // 1. Tự động ghi nhận tín hiệu hoạt động gần đây (recent_activity)
        if (!translationSource) {
        if (activeCandidate) {
          const signals = activeCandidate.readinessSignals || [];
          if (!signals.includes("recent_activity")) {
            handleAddSignal("recent_activity");
          }
        }

        // 2. Tự động phát hiện khi ứng viên đồng ý phỏng vấn -> Cập nhật sang "Quan tâm" (interested)
        const isInterviewAgreed = /미팅|면접|온라인|전화|zoom|meet|call|interview|phỏng vấn|trao đổi|thảo luận|gặp gỡ|lịch hẹn|thời gian trao đổi/i.test(originalText + " " + (d.translatedText || ""));
        if (isInterviewAgreed) {
          window.__LAST_INTERVIEW_DETECTED__ = true;
          if (activeCandidate && activeCandidate.currentStage !== "interested") {
            handleTransitionStage("interested");
          }
        } else if (activeCandidate && ["contacted", "lead", "found"].includes(activeCandidate.currentStage)) {
          // 3. Tự động cập nhật sang "Có phản hồi" (responded) khi ứng viên trả lời
          handleTransitionStage("responded");
        }

        // 4. Tự động lưu tóm tắt cuộc trò chuyện vào CRM Activity
        const salaryStr = dh.salary || "Thương lượng";
        const visaStr = dh.visa || "Chưa rõ";
        const workStr = dh.workMode || "Linh hoạt";
        const snippet = originalText.length > 90 ? originalText.slice(0, 90) + "..." : originalText;
        const summaryLog = `[Tự động lưu từ Extension] Ứng viên phản hồi: "${snippet}" | Ý định: ${d.intent || "Trao đổi cơ hội việc làm"} | Lương: ${salaryStr} | Visa: ${visaStr} | Hình thức: ${workStr}`;
        autoSyncConversationToCrmActivity(summaryLog);
        }

        // Render 4 Deal Badges
        dealGrid.innerHTML = `
          <div class="deal-chip ${dh.salary ? 'has-val' : ''}">
            <span class="icon">💰</span>
            <span class="key">Lương:</span>
            <span class="val" title="${dh.salary || 'Chưa đề cập'}">${dh.salary || 'Chưa đề cập'}</span>
          </div>
          <div class="deal-chip ${dh.visa ? 'has-val' : ''}">
            <span class="icon">🛂</span>
            <span class="key">Visa:</span>
            <span class="val" title="${dh.visa || 'Chưa đề cập'}">${dh.visa || 'Chưa đề cập'}</span>
          </div>
          <div class="deal-chip ${dh.workMode ? 'has-val' : ''}">
            <span class="icon">🏠</span>
            <span class="key">Hình thức:</span>
            <span class="val" title="${dh.workMode || 'Chưa đề cập'}">${dh.workMode || 'Chưa đề cập'}</span>
          </div>
          <div class="deal-chip ${dh.startDate ? 'has-val' : ''}">
            <span class="icon">⏱️</span>
            <span class="key">Bắt đầu:</span>
            <span class="val" title="${dh.startDate || 'Chưa đề cập'}">${dh.startDate || 'Chưa đề cập'}</span>
          </div>
        `;

        // Render Quick Replies
        let repliesHtml = "";
        (d.suggestedReplies || []).forEach((rep, idx) => {
          repliesHtml += `
            <button class="quick-reply-btn" data-reply-idx="${idx}">
              <span style="color: #38bdf8; font-weight: 700; flex-shrink: 0;">Gợi ý ${idx + 1}:</span>
              <span>${rep}</span>
            </button>
          `;
        });
        repliesList.innerHTML = repliesHtml;

        // Toggle Accordion
        btnToggleDeal.addEventListener("click", (evt) => {
          evt.stopPropagation();
          const isHidden = dealAccordion.style.display === "none";
          dealAccordion.style.display = isHidden ? "block" : "none";
          btnToggleDeal.classList.toggle("active", isHidden);
        });

        // Quick Reply 1-Click
        const replyBtns = repliesList.querySelectorAll(".quick-reply-btn");
        replyBtns.forEach((rBtn, idx) => {
          rBtn.addEventListener("click", (evt) => {
            evt.stopPropagation();
            const replyText = d.suggestedReplies[idx];
            if (!replyText) return;

            rBtn.disabled = true;
            const originalBtnHtml = rBtn.innerHTML;
            rBtn.innerHTML = `<span>⏳ Đang dịch kính ngữ & điền vào ô chat...</span>`;

            sendMessage({ action: "translate", payload: { text: replyText, targetLang: currentThreadLang, mode: "outgoing", source: translationSource } }, (transRes) => {
              rBtn.disabled = false;
              rBtn.innerHTML = originalBtnHtml;

              const translated = (transRes && transRes.success && transRes.data)
                ? transRes.data.translatedText
                : replyText;

              // Chèn vào ô chat mẹ
              const ok = fillChatInput(translated);
              if (ok) {
                // Kích hoạt trạng thái undo cho input
                notifyComposerTextTranslated(replyText, translated);

                if (feedbackEl) {
                  feedbackEl.style.display = "flex";
                  feedbackEl.innerHTML = `<span>✓</span> Đã điền câu trả lời (${currentThreadLang.toUpperCase()}) vào ô chat! Recruiter kiểm tra và bấm Gửi (INV-5).`;
                  setTimeout(() => {
                    if (feedbackEl) feedbackEl.style.display = "none";
                  }, 4000);
                }
              }
            });
          });
        });
        });
      }
      translateButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        translateBubble();
      });
    }

    function scanAllMessages() {
      SELECTORS.forEach((sel) => {
        const els = document.querySelectorAll(sel);
        els.forEach(decorateBubble);
      });
    }

    // Quét lần đầu ngay khi nạp
    setTimeout(scanAllMessages, 200);

    // Observer theo dõi tin nhắn mới xuất hiện trong khung chat real-time
    let scanTimer = null;
    const observer = new MutationObserver(() => {
      clearTimeout(scanTimer);
      scanTimer = setTimeout(scanAllMessages, 250);
    });

    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  // -------------------------------------------------------------------------
  // SEND-ADJACENT OUTGOING COMPOSER (NÚT DỊCH & NÚT HOÀN TÁC CẠNH NÚT GỬI)
  // -------------------------------------------------------------------------

  const SEND_ADJACENT_STYLES = `
    :host {
      all: initial !important;
      display: inline-flex !important;
      align-items: center !important;
      margin-right: 8px !important;
      position: relative !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
      z-index: 50 !important;
    }
    *, *::before, *::after {
      box-sizing: border-box;
    }
    .copilot-send-group {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      position: relative;
    }
    .copilot-undo-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: rgba(244, 63, 94, 0.15);
      border: 1px solid rgba(244, 63, 94, 0.5);
      color: #fb7185;
      border-radius: 8px;
      padding: 8px 12px;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(244, 63, 94, 0.2);
      transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
      animation: popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      white-space: nowrap;
    }
    @keyframes popIn {
      from { opacity: 0; transform: scale(0.92); }
      to { opacity: 1; transform: scale(1); }
    }
    .copilot-undo-btn:hover {
      background: rgba(244, 63, 94, 0.3);
      color: #ffffff;
      border-color: #f43f5e;
      transform: translateY(-1px);
    }
    .copilot-send-translate-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: linear-gradient(135deg, #0284c7, #0369a1);
      border: 1px solid rgba(56, 189, 248, 0.6);
      color: #ffffff;
      border-radius: 8px;
      padding: 8px 13px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 3px 12px rgba(2, 132, 199, 0.4);
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      white-space: nowrap;
      user-select: none;
    }
    .copilot-send-translate-btn:hover {
      background: linear-gradient(135deg, #0369a1, #075985);
      border-color: #38bdf8;
      transform: translateY(-1px);
      box-shadow: 0 5px 16px rgba(2, 132, 199, 0.55);
    }
    .copilot-send-translate-btn:disabled {
      background: #334155;
      border-color: #475569;
      color: #94a3b8;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }
    .lang-pill {
      font-size: 11px;
      background: rgba(15, 23, 42, 0.5);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 6px;
      padding: 1px 6px;
      margin-left: 2px;
      color: #e2e8f0;
      display: inline-flex;
      align-items: center;
      gap: 3px;
      cursor: pointer;
      transition: background 0.15s;
    }
    .lang-pill:hover {
      background: rgba(15, 23, 42, 0.85);
      border-color: #38bdf8;
      color: #38bdf8;
    }
    .copilot-lang-dropdown {
      position: absolute;
      bottom: calc(100% + 8px);
      right: 0;
      background: #0f172a;
      border: 1px solid rgba(56, 189, 248, 0.45);
      border-radius: 10px;
      padding: 6px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.75), 0 0 1px 1px rgba(56, 189, 248, 0.2);
      min-width: 195px;
      z-index: 2147483647;
      animation: popIn 0.18s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .dropdown-header {
      font-size: 10.5px;
      font-weight: 700;
      color: #94a3b8;
      padding: 4px 8px 6px;
      border-bottom: 1px solid #1e293b;
      margin-bottom: 4px;
    }
    .dropdown-list {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .dropdown-item {
      background: transparent;
      border: none;
      color: #f1f5f9;
      font-size: 11.5px;
      padding: 6px 10px;
      border-radius: 6px;
      cursor: pointer;
      text-align: left;
      display: flex;
      align-items: center;
      justify-content: space-between;
      transition: background 0.15s;
    }
    .dropdown-item:hover {
      background: rgba(2, 132, 199, 0.25);
      color: #38bdf8;
    }
    .dropdown-item.active {
      background: rgba(2, 132, 199, 0.35);
      color: #38bdf8;
      font-weight: 700;
    }
    .copilot-safety-toast {
      position: absolute;
      bottom: calc(100% + 10px);
      right: 0;
      background: linear-gradient(145deg, #064e3b, #0f172a);
      border: 1px solid #10b981;
      border-radius: 8px;
      padding: 8px 12px;
      color: #a7f3d0;
      font-size: 11.5px;
      font-weight: 500;
      white-space: nowrap;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.7);
      animation: popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      z-index: 2147483647;
      display: flex;
      align-items: center;
      gap: 6px;
    }
  `;

  // Registry theo dõi các controller cạnh nút Gửi
  const activeComposerControllers = new Set();

  function notifyComposerTextTranslated(originalVi, translatedText) {
    activeComposerControllers.forEach((ctrl) => {
      ctrl.setTranslatedState(originalVi, translatedText);
    });
  }

  function setupSendAdjacentComposer() {
    const CHAT_INPUT_SELECTORS = [
      "#main footer [data-testid='conversation-compose-box-input']",
      "#main footer [contenteditable='true'][role='textbox']",
      "#main footer [contenteditable='true']",
      "#chat-input",
      ".chat-input",
      ".msg-form__contenteditable",
      ".msg-form__message-texteditor",
      "div.input-message-input",
      "div#chat-input-content",
      "div[contenteditable='true'][data-tab='10']",
      "div[contenteditable='true']"
    ];

    function findSendButton(inputEl) {
      // 1. Tìm trong container cha gần nhất
      const container = inputEl.closest("footer, [data-testid='conversation-compose-box'], .chat-footer, form, .msg-form, .message-input-container, .chat-input-wrapper") || inputEl.parentElement;
      if (container) {
        const btn = container.querySelector("[data-testid='send'], button[aria-label*='Send' i], #send-btn, .send-btn, .msg-form__send-button, button[type='submit'], button.send-button, [data-send-button]");
        if (btn) return btn;
        const allBtns = container.querySelectorAll("button");
        for (const b of allBtns) {
          if (/gửi|send|보내기|送信/i.test(b.innerText || b.getAttribute("aria-label") || "")) return b;
        }
      }
      // 2. Tìm toàn trang
      return document.querySelector("#main footer [data-testid='send'], #main footer button[aria-label*='Send' i]") || document.getElementById("send-btn") || document.querySelector(".send-btn");
    }

    function attachComposerToInput(inputEl) {
      if (!inputEl || inputEl.dataset.sourcingCopilotComposerAttached) return;
      if (host.contains(inputEl)) return;
      if (location.hostname === "web.whatsapp.com" && !inputEl.closest("#main footer")) return;

      const sendBtn = findSendButton(inputEl);
      if (!sendBtn) return;

      inputEl.dataset.sourcingCopilotComposerAttached = "true";

      const composerHost = document.createElement("div");
      composerHost.className = "sourcing-copilot-send-adjacent-host";
      const composerShadow = composerHost.attachShadow({ mode: "open" });

      const styleEl = document.createElement("style");
      styleEl.textContent = SEND_ADJACENT_STYLES;
      composerShadow.appendChild(styleEl);

      const wrapper = document.createElement("div");
      wrapper.className = "copilot-send-group";
      wrapper.innerHTML = `
        <button class="copilot-undo-btn" id="btn-undo" style="display: none;" title="Khôi phục lại văn bản tiếng Việt ban đầu">
          <span class="icon">↺</span> Hoàn tác
        </button>
        <button class="copilot-send-translate-btn" id="btn-translate" title="Dịch tiếng Việt trong ô chat sang tiếng của ứng viên chuẩn kính ngữ">
          <span class="sparkle">✨</span>
          <span class="label">Dịch</span>
          <span class="lang-pill" id="lang-pill">🇰🇷 KO ▾</span>
        </button>
        <div class="copilot-lang-dropdown" id="lang-dropdown" style="display: none;">
          <div class="dropdown-header">Chọn ngôn ngữ ứng viên:</div>
          <div class="dropdown-list" id="dropdown-list"></div>
        </div>
        <div class="copilot-safety-toast" id="safety-toast" style="display: none;"></div>
      `;
      composerShadow.appendChild(wrapper);

      // Chèn trực tiếp ngay bên trái nút Gửi gốc
      sendBtn.insertAdjacentElement("beforebegin", composerHost);

      const btnUndo = composerShadow.getElementById("btn-undo");
      const btnTranslate = composerShadow.getElementById("btn-translate");
      const langPill = composerShadow.getElementById("lang-pill");
      const langDropdown = composerShadow.getElementById("lang-dropdown");
      const dropdownList = composerShadow.getElementById("dropdown-list");
      const safetyToast = composerShadow.getElementById("safety-toast");

      let lastOriginalVietnamese = "";
      let toastTimer = null;

      function showToast(html, duration = 4000) {
        clearTimeout(toastTimer);
        safetyToast.innerHTML = html;
        safetyToast.style.display = "flex";
        toastTimer = setTimeout(() => {
          safetyToast.style.display = "none";
        }, duration);
      }

      function updateLangDisplay() {
        const meta = LANG_METADATA[currentThreadLang] || LANG_METADATA["ko"];
        langPill.textContent = `${meta.flag} ${meta.code.toUpperCase()} ▾`;

        let listHtml = "";
        Object.values(LANG_METADATA).forEach((m) => {
          const isActive = m.code === currentThreadLang;
          listHtml += `
            <button class="dropdown-item ${isActive ? 'active' : ''}" data-lang="${m.code}">
              <span>${m.flag} ${m.name} (${m.label})</span>
              ${isActive ? '<span>✓</span>' : ''}
            </button>
          `;
        });
        dropdownList.innerHTML = listHtml;

        dropdownList.querySelectorAll(".dropdown-item").forEach((item) => {
          item.addEventListener("click", (e) => {
            e.stopPropagation();
            const chosen = item.dataset.lang;
            saveThreadLanguage(chosen);
            langDropdown.style.display = "none";
            showToast(`<span>🌐</span> Đã chọn: ${LANG_METADATA[chosen].name} (${LANG_METADATA[chosen].polite})`, 2500);
          });
        });
      }

      // Đăng ký nhận cập nhật khi ngôn ngữ thread đổi
      subscribeThreadLang(() => {
        updateLangDisplay();
      });

      langPill.addEventListener("click", (e) => {
        e.stopPropagation();
        const isHidden = langDropdown.style.display === "none";
        langDropdown.style.display = isHidden ? "block" : "none";
      });

      document.addEventListener("click", () => {
        if (langDropdown.style.display === "block") {
          langDropdown.style.display = "none";
        }
      });

      function getInputText() {
        if (inputEl.tagName === "INPUT" || inputEl.tagName === "TEXTAREA") {
          return inputEl.value.trim();
        }
        return inputEl.innerText ? inputEl.innerText.trim() : "";
      }

      function setInputText(newText) {
        if (inputEl.tagName === "INPUT" || inputEl.tagName === "TEXTAREA") {
          inputEl.value = newText;
          inputEl.dispatchEvent(new Event("input", { bubbles: true }));
          inputEl.dispatchEvent(new Event("change", { bubbles: true }));
        } else if (inputEl.isContentEditable) {
          inputEl.focus();
          document.execCommand("selectAll", false, null);
          document.execCommand("insertText", false, newText);
          inputEl.dispatchEvent(new Event("input", { bubbles: true }));
        }
        inputEl.focus();
      }

      function executeTranslate() {
        const text = getInputText();
        if (!text) {
          showToast("⚠️ Hãy gõ nội dung tiếng Việt vào ô chat!", 2500);
          inputEl.focus();
          return;
        }

        lastOriginalVietnamese = text;
        const meta = LANG_METADATA[currentThreadLang] || LANG_METADATA["ko"];

        btnTranslate.disabled = true;
        const oldHtml = btnTranslate.innerHTML;
        btnTranslate.innerHTML = `<span>⏳</span> Đang dịch...`;

        sendMessage({ action: "translate", payload: { text, targetLang: currentThreadLang, mode: "outgoing", source: translationSource } }, (res) => {
          btnTranslate.disabled = false;
          btnTranslate.innerHTML = oldHtml;

          if (res && res.success && res.data) {
            const translated = res.data.translatedText;
            setInputText(translated);

            btnUndo.style.display = "inline-flex";
            showToast(`<span>🛡️</span> Đã dịch sang ${meta.name} (${meta.polite}). Recruiter kiểm tra và bấm Gửi (INV-5).`, 4500);

            // Đồng bộ Tab 2 Dock Panel
            if (typeof outgoingText !== "undefined" && outgoingText) {
              outgoingText.value = text;
              outgoingTargetLang.value = currentThreadLang;
              outgoingResult.style.display = "flex";
              outgoingTranslatedText.textContent = translated;
              outgoingBackTranslation.textContent = res.data.backTranslation || "Bản dịch ngược đối chiếu.";
            }
          } else {
            alert("Lỗi khi dịch phản hồi: " + (res?.error || "Không kết nối được CRM Backend"));
          }
        });
      }

      // Nút [✨ Dịch] click
      btnTranslate.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        executeTranslate();
      });

      function recordOutgoingChatActivity() {
        const text = getInputText();
        if (!translationSource && text && text.length > 2) {
          const outSnippet = text.length > 100 ? text.slice(0, 100) + "..." : text;
          const outLog = `[Tự động lưu từ Extension - TA gửi tin] (${currentThreadLang.toUpperCase()}): "${outSnippet}"`;
          autoSyncConversationToCrmActivity(outLog);
        }
      }

      // Phím tắt Ctrl + Shift + Enter trong ô chat
      inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && e.ctrlKey && e.shiftKey) {
          e.preventDefault();
          executeTranslate();
        } else if (e.key === "Enter" && !e.shiftKey) {
          recordOutgoingChatActivity();
          // Khi nhấn Enter để gửi tin nhắn thông thường -> reset undo
          setTimeout(() => {
            btnUndo.style.display = "none";
            lastOriginalVietnamese = "";
            safetyToast.style.display = "none";
          }, 100);
        }
      });

      // Nút [↺ Hoàn tác]
      btnUndo.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (lastOriginalVietnamese) {
          setInputText(lastOriginalVietnamese);
          btnUndo.style.display = "none";
          showToast("<span>↺</span> Đã hoàn tác về tiếng Việt ban đầu.", 2500);
        }
      });

      // Bắt sự kiện khi Recruiter nhấn nút Gửi gốc
      sendBtn.addEventListener("click", () => {
        recordOutgoingChatActivity();
        btnUndo.style.display = "none";
        lastOriginalVietnamese = "";
        safetyToast.style.display = "none";
      });

      // Bộ điều khiển controller
      const controller = {
        setTranslatedState(originalVi) {
          lastOriginalVietnamese = originalVi;
          btnUndo.style.display = "inline-flex";
        }
      };
      activeComposerControllers.add(controller);
    }

    function scanChatInputs() {
      for (const sel of CHAT_INPUT_SELECTORS) {
        const els = document.querySelectorAll(sel);
        els.forEach(attachComposerToInput);
      }
    }

    setTimeout(scanChatInputs, 250);

    const composerObserver = new MutationObserver(() => {
      scanChatInputs();
    });
    composerObserver.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  // Start only the translation features in the standalone extension.
  setupInlineMessageObserver();
  setupSendAdjacentComposer();

  function sendMessage(msg, callback) {
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage(msg, callback);
      return;
    }
    callback({ success: false, error: "Hãy cài extension trong Chrome để sử dụng tính năng dịch." });
  }
})();
