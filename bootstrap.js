/* global Zotero, Services */
var AutoTranslate;

function install() {}

async function startup({ id, version, rootURI }) {
  await Zotero.initializationPromise;
  Services.scriptloader.loadSubScript(rootURI + "auto-translate.js");
  AutoTranslate = Zotero.AutoTranslate;
  AutoTranslate.init({ id, version, rootURI });

  Zotero.PreferencePanes.register({
    pluginID: id,
    src: rootURI + "preferences.xhtml",
    label: "Auto Translate",
  });
}

function shutdown() {
  if (AutoTranslate) {
    AutoTranslate.shutdown();
    AutoTranslate = undefined;
  }
  delete Zotero.AutoTranslate;
}

function uninstall() {}
