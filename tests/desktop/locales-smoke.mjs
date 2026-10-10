import assert from 'node:assert/strict';
import { Menu } from 'electron';
import { SUPPORTED_UI_LANGUAGES, uiLanguageDirection } from '../../shared/i18n/ui-language.mjs';
import { menuLabel } from '../../shared/i18n/menu.mjs';
export async function verifyLocales(window) {
  const evaluate = (code) => window.webContents.executeJavaScript(code);
  const wait = async (code) => {
    for (let i = 0; i < 400; i++) {
      if (await evaluate(code)) return;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw Error('Locale UI timed out: ' + code);
  };
  for (const locale of SUPPORTED_UI_LANGUAGES) {
    await evaluate(`window.previewPreferences.save({uiLanguage:${JSON.stringify(locale)}})`);
    await new Promise((resolve) => {
      window.webContents.once('did-finish-load', resolve);
      window.webContents.reload();
    });
    await wait(
      `document.documentElement.lang===${JSON.stringify(locale)}&&!!document.querySelector('[data-symbol="gearshape"]')`,
    );
    await evaluate(`document.querySelector('[data-symbol="gearshape"]').closest('button').click()`);
    await wait(`!!document.querySelector('.settings #settings-translation-language')`);
    assert.equal(await evaluate(`document.querySelectorAll('#source-language-label').length`), 1);
    assert.equal(
      await evaluate(`!!document.querySelector('#source-language-label').nextElementSibling`),
      true,
    );
    assert.equal(await evaluate(`document.documentElement.dir`), uiLanguageDirection(locale));
    assert.equal((await evaluate(`window.previewPreferences.load()`)).uiLanguage, locale);
    assert.ok(
      Menu.getApplicationMenu().items.some((item) => item.label === menuLabel('File', locale)),
    );
  }
  console.log('All supported locale UI/menu/reload/persistence checks passed.');
  window.close();
}
