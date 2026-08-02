(() => {
  "use strict";

  const ACTIVE_CHAT_KEY = "marinara-active-chat-id";
  const cache = new Map();
  const originalFetch = window.fetch.bind(window);

  function activeChatId() {
    try {
      const id = localStorage.getItem(ACTIVE_CHAT_KEY);
      return id && id.trim() ? id.trim() : null;
    } catch {
      return null;
    }
  }

  function findThoughtModal(root = document) {
    for (const brain of root.querySelectorAll(".lucide-brain")) {
      const title = brain.parentElement;
      const header = title?.parentElement;
      const panel = header?.parentElement;
      const pre = panel?.querySelector("pre");
      if (header && panel && pre) return { header, panel, pre };
    }
    return null;
  }

  function setStatus(ui, text, kind = "") {
    ui.status.textContent = text;
    ui.status.dataset.kind = kind;
  }

  async function readTranslationSettings() {
    const chatId = activeChatId();
    if (!chatId) throw new Error("활성 채팅을 찾지 못했습니다.");
    const response = await originalFetch(`/api/chats/${encodeURIComponent(chatId)}`, { headers: { Accept: "application/json" } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || "채팅 설정을 읽지 못했습니다.");
    let metadata = {};
    if (data?.metadata && typeof data.metadata === "object") {
      metadata = data.metadata;
    } else if (typeof data?.metadata === "string" && data.metadata.trim()) {
      try {
        const parsed = JSON.parse(data.metadata);
        if (parsed && typeof parsed === "object") metadata = parsed;
      } catch {
        throw new Error("채팅의 Translation 설정을 해석하지 못했습니다.");
      }
    }
    const connectionId = typeof metadata.translationConnectionId === "string" ? metadata.translationConnectionId.trim() : "";
    if (!connectionId) {
      throw new Error("Chat Settings → Translation에서 AI 연결을 먼저 선택해 주세요.");
    }
    return {
      connectionId,
      systemPrompt: typeof metadata.translationPrompt === "string" && metadata.translationPrompt.trim()
        ? metadata.translationPrompt
        : undefined,
    };
  }

  async function translate(text, force = false) {
    if (!force && cache.has(text)) return cache.get(text);
    const settings = await readTranslationSettings();
    const response = await originalFetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        text,
        provider: "ai",
        targetLanguage: "Korean",
        connectionId: settings.connectionId,
        systemPrompt: settings.systemPrompt,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || data?.message || `번역 요청 실패 (${response.status})`);
    const translated = typeof data?.translatedText === "string" ? data.translatedText.trim() : "";
    if (!translated) throw new Error("번역 연결이 빈 응답을 반환했습니다.");
    cache.set(text, translated);
    return translated;
  }

  function enhance() {
    const modal = findThoughtModal();
    if (!modal || modal.panel.dataset.mktEnhanced === "true") return;
    modal.panel.dataset.mktEnhanced = "true";

    const original = modal.pre.textContent || "";
    const toolbar = document.createElement("div");
    toolbar.className = "mkt-toolbar";
    toolbar.innerHTML = `
      <div class="mkt-actions">
        <button type="button" class="mkt-button mkt-translate" aria-label="한국어로 번역" title="한국어로 번역">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>
        </button>
        <button type="button" class="mkt-button mkt-original" aria-label="원문 보기" title="원문 보기" hidden>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h8"/></svg>
        </button>
        <button type="button" class="mkt-button mkt-retranslate" aria-label="다시 번역" title="다시 번역" hidden>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5"/><path d="M4 13a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5"/></svg>
        </button>
      </div>
      <span class="mkt-status" aria-live="polite"></span>
    `;
    modal.header.insertAdjacentElement("afterend", toolbar);

    const ui = {
      translate: toolbar.querySelector(".mkt-translate"),
      original: toolbar.querySelector(".mkt-original"),
      retranslate: toolbar.querySelector(".mkt-retranslate"),
      status: toolbar.querySelector(".mkt-status"),
    };
    let translated = cache.get(original) || "";
    let showingTranslation = false;

    function showOriginal() {
      modal.pre.textContent = original;
      showingTranslation = false;
      ui.original.hidden = true;
      ui.translate.hidden = false;
      const translateLabel = translated ? "번역 보기" : "한국어로 번역";
      ui.translate.setAttribute("aria-label", translateLabel);
      ui.translate.title = translateLabel;
      ui.retranslate.hidden = !translated;
      setStatus(ui, translated ? "번역이 캐시되어 있습니다." : "");
    }

    function showTranslation() {
      modal.pre.textContent = translated;
      showingTranslation = true;
      ui.original.hidden = false;
      ui.translate.hidden = true;
      ui.retranslate.hidden = false;
      setStatus(ui, "한국어 번역", "success");
    }

    async function run(force) {
      const buttons = [ui.translate, ui.original, ui.retranslate];
      buttons.forEach((button) => { button.disabled = true; });
      setStatus(ui, force ? "다시 번역하는 중…" : "번역하는 중…");
      try {
        translated = await translate(original, force);
        showTranslation();
      } catch (error) {
        if (showingTranslation && translated) modal.pre.textContent = translated;
        else modal.pre.textContent = original;
        setStatus(ui, error instanceof Error ? error.message : "번역에 실패했습니다.", "error");
      } finally {
        buttons.forEach((button) => { button.disabled = false; });
      }
    }

    ui.translate.addEventListener("click", () => translated ? showTranslation() : run(false));
    ui.original.addEventListener("click", showOriginal);
    ui.retranslate.addEventListener("click", () => run(true));

    if (translated) {
      ui.translate.setAttribute("aria-label", "번역 보기");
      ui.translate.title = "번역 보기";
      ui.retranslate.hidden = false;
      setStatus(ui, "이 추론의 번역이 캐시되어 있습니다.");
    }
  }

  const observer = new MutationObserver(enhance);
  observer.observe(document.body, { childList: true, subtree: true });
  enhance();
})();
