/* global Zotero */
Zotero.AutoTranslate = {
  PREF_PREFIX: "extensions.zotero-auto-translate.",
  observerID: null,
  // itemID -> annotation text we already translated (prevents loops/duplicates)
  processed: new Map(),

  init({ id, version, rootURI }) {
    this.id = id;
    this.version = version;
    this.rootURI = rootURI;
    this.observerID = Zotero.Notifier.registerObserver(
      { notify: (...args) => this.onNotify(...args) },
      ["item"],
      "zotero-auto-translate"
    );
    this.log(`started (v${version})`);
  },

  shutdown() {
    if (this.observerID) {
      Zotero.Notifier.unregisterObserver(this.observerID);
      this.observerID = null;
    }
    this.processed.clear();
  },

  log(msg) {
    Zotero.debug(`[Auto Translate] ${msg}`);
  },

  pref(name) {
    return Zotero.Prefs.get(this.PREF_PREFIX + name, true);
  },

  async onNotify(event, type, ids) {
    if (type !== "item" || (event !== "add" && event !== "modify")) return;
    if (!this.pref("enabled")) return;

    for (const id of ids) {
      try {
        const item = await Zotero.Items.getAsync(id);
        if (this.shouldTranslate(item)) {
          await this.translateAnnotation(item);
        }
      } catch (e) {
        Zotero.logError(e);
      }
    }
  },

  shouldTranslate(item) {
    if (!item || !item.isAnnotation()) return false;
    if (!["highlight", "underline"].includes(item.annotationType)) return false;
    if (item.annotationIsExternal) return false; // read-only, embedded in file
    if (!item.library || !item.library.editable) return false;

    const target = String(this.pref("color") || "").toLowerCase();
    if (String(item.annotationColor || "").toLowerCase() !== target) return false;

    const text = (item.annotationText || "").trim();
    if (!text) return false;
    if (this.processed.get(item.id) === text) return false;
    return true;
  },

  async translateAnnotation(item) {
    const text = item.annotationText.trim();
    // Mark before the request so our own save (a "modify" event) is ignored
    this.processed.set(item.id, text);

    let translation;
    try {
      translation = await this.translate(text);
    } catch (e) {
      this.processed.delete(item.id); // allow a retry on the next change
      this.log(`translation failed: ${e}`);
      Zotero.logError(e);
      return;
    }
    if (!translation) return;

    // Re-fetch in case the annotation changed while we were waiting
    item = await Zotero.Items.getAsync(item.id);
    if (!item || (item.annotationText || "").trim() !== text) return;

    const entry = (this.pref("prefix") || "") + translation;
    const existing = item.annotationComment || "";
    if (existing.includes(translation)) return;
    item.annotationComment = existing ? `${existing}\n\n${entry}` : entry;
    await item.saveTx();
    this.log(`translated annotation ${item.key}`);
  },

  async translate(text) {
    const provider = this.pref("provider") || "google";
    const source = this.pref("sourceLang") || "auto";
    const target = this.pref("targetLang") || "en";
    switch (provider) {
      case "mymemory":
        return this.translateMyMemory(text, source, target);
      case "deepl":
        return this.translateDeepL(text, source, target);
      default:
        return this.translateGoogle(text, source, target);
    }
  },

  // Google Translate public web endpoint: free, no key, auto-detect supported
  async translateGoogle(text, source, target) {
    const url =
      "https://translate.googleapis.com/translate_a/single?client=gtx&dt=t" +
      `&sl=${encodeURIComponent(source)}&tl=${encodeURIComponent(target)}` +
      `&q=${encodeURIComponent(text)}`;
    const xhr = await Zotero.HTTP.request("GET", url, { responseType: "json" });
    const data = xhr.response;
    if (!Array.isArray(data) || !Array.isArray(data[0])) {
      throw new Error("Unexpected Google Translate response");
    }
    return data[0].map((seg) => seg[0]).join("").trim();
  },

  // MyMemory: free, no key (5k chars/day; 50k with e-mail). Max 500 bytes/request.
  async translateMyMemory(text, source, target) {
    const src = source === "auto" ? "en" : source;
    const chunks = this.chunk(text, 450);
    const email = this.pref("mymemoryEmail");
    const parts = [];
    for (const chunk of chunks) {
      let url =
        "https://api.mymemory.translated.net/get" +
        `?q=${encodeURIComponent(chunk)}` +
        `&langpair=${encodeURIComponent(`${src}|${target}`)}`;
      if (email) url += `&de=${encodeURIComponent(email)}`;
      const xhr = await Zotero.HTTP.request("GET", url, { responseType: "json" });
      const data = xhr.response;
      if (!data || Number(data.responseStatus) !== 200) {
        throw new Error(`MyMemory error: ${data && data.responseDetails}`);
      }
      parts.push(data.responseData.translatedText);
    }
    return parts.join(" ").trim();
  },

  // DeepL API Free (requires a free API key)
  async translateDeepL(text, source, target) {
    const key = (this.pref("deeplKey") || "").trim();
    if (!key) throw new Error("DeepL API key is not set");
    const host = key.endsWith(":fx") ? "api-free.deepl.com" : "api.deepl.com";
    const body = { text: [text], target_lang: target.toUpperCase() };
    if (source !== "auto") body.source_lang = source.toUpperCase();
    const xhr = await Zotero.HTTP.request("POST", `https://${host}/v2/translate`, {
      headers: {
        Authorization: `DeepL-Auth-Key ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      responseType: "json",
    });
    return xhr.response.translations[0].text.trim();
  },

  // Split text into chunks of at most `max` bytes (UTF-8), preferring sentence/word boundaries
  chunk(text, max) {
    const bytes = (s) => new TextEncoder().encode(s).length;
    const chunks = [];
    let current = "";
    for (const word of text.split(/(?<=[.!?])\s+|\s+/)) {
      const candidate = current ? `${current} ${word}` : word;
      if (bytes(candidate) > max && current) {
        chunks.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) chunks.push(current);
    return chunks;
  },
};
