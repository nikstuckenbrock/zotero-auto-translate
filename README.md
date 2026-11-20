# Zotero Auto Translate

A Zotero 7/8 plugin. When you highlight or underline text in the PDF/EPUB reader using
your chosen trigger color, the selected text is translated automatically and the
translation is written into the annotation's comment.

## Install

1. Run `./build.sh` (creates `dist/zotero-auto-translate-<version>.xpi`).
2. In Zotero: **Tools → Plugins → ⚙ → Install Plugin From File…** and pick the `.xpi`.
3. Configure in **Settings → Auto Translate**.

## Settings

| Setting | Description |
|---|---|
| Trigger color | Annotation color that triggers translation (default: yellow) |
| Translation service | Google Translate (free, no key; default), MyMemory (free, no key), DeepL API Free (free key) |
| Source / target language | Source can be auto-detected (not with MyMemory, which falls back to English) |
| Comment prefix | Optional text before the translation, e.g. `DE: ` |

## Behaviour

- Works for highlights and underlines that are new, or recolored to the trigger color.
- If the annotation already has a comment, the translation is appended to it.
- Each annotation text is translated only once per Zotero session. If you change the
  highlighted text, it is translated again.
- Errors (network, rate limits) go to **Help → Debug Output Logging** and the error console.

## Notes on the free services

- **Google Translate** uses the public `translate.googleapis.com` web endpoint. It is
  unofficial and may be rate-limited.
- **MyMemory** allows 5,000 characters a day anonymously, or 50,000 if you enter an e-mail.
- **DeepL API Free** needs a free account key (500,000 characters a month).

## Releases

Bump `version` in `manifest.json` and push to `main`. The workflow
`.github/workflows/release.yml` then creates the tag `v<version>`, builds the `.xpi` and
publishes it together with `updates.json` as a GitHub Release. Installed copies find the
update via `releases/latest/download/updates.json`.
