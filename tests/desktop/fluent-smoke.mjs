import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

/*
 * The fluent smoke test runs in the real renderer with the preload platform
 * override supplied by the fluent smoke entry point. It deliberately drives
 * the DOM through the same events used by the Vue controls, while checking
 * the actual Fluent custom elements and their open shadow DOM.
 */
export async function verifyFluent(window) {
  window.show();
  window.focus();
  const evaluate = (code) => window.webContents.executeJavaScript(code);
  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  async function wait(name, code, timeout = 15000) {
    const started = Date.now();
    let last;
    while (Date.now() - started < timeout) {
      try {
        last = await evaluate(code);
        if (last) return last;
      } catch (error) {
        last = error.message;
      }
      await pause(50);
    }
    try {
      const diagnostic = await evaluate(
        `(()=>{const root=document.querySelector(':is(.settings,.settings-panel)');const controls=[...document.querySelectorAll('fluent-button,fluent-switch,fluent-slider,fluent-dropdown,fluent-listbox,fluent-option,fluent-tablist,fluent-tab,fluent-text-input')];const describe=element=>{if(!element)return null;const rect=element.getBoundingClientRect();return {tag:element.tagName,defined:customElements.get(element.localName)!=null,ariaLabel:element.getAttribute('aria-label'),ariaLabelledby:element.getAttribute('aria-labelledby'),value:element.value??null,checked:element.checked??null,disabled:element.disabled??null,open:element.open??null,displayValue:element.displayValue??null,rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},shadowInput:!!element.shadowRoot?.querySelector('input'),children:[...element.children].map(child=>child.tagName).slice(0,20)};};return {settings:!!root,settingsRect:root?(()=>{const r=root.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,scrollHeight:root.scrollHeight}})():null,platform:window.previewAppearance?.platform||null,registered:['fluent-button','fluent-switch','fluent-slider','fluent-dropdown','fluent-listbox','fluent-option','fluent-tablist','fluent-tab','fluent-text-input'].map(name=>[name,!!customElements.get(name)]),controls:controls.map(describe),selectors:{apiKey:!!root?.querySelector('fluent-text-input[aria-label="OpenAI API key"]'),language:!!root?.querySelector('fluent-dropdown[aria-label="Translation language"]'),tabs:!!root?.querySelector('fluent-tablist.fluent-kernel-modes'),sliders:root?.querySelectorAll('fluent-slider').length||0,autoHide:!!root?.querySelector('fluent-switch[aria-label="Auto-hide header"]')}}})()`,
      );
      const markup = await evaluate(
        `(()=>{const probe=[];for(const tag of ['fluent-switch','fluent-slider']){try{const element=document.createElement(tag);element.value=tag==='fluent-slider'?'4':element.value;element.setAttribute('data-smoke-probe','true');document.body.append(element);probe.push({tag,created:true,defined:element.constructor!==HTMLElement,rect:(()=>{const r=element.getBoundingClientRect();return {width:r.width,height:r.height}})()});}catch(error){probe.push({tag,created:false,error:error.message});}}return {parallelMarkup:[...document.querySelectorAll('.parallel-setting')].map(element=>element.innerHTML),autoHideMarkup:document.querySelector('[data-setting="auto-hide-header"]')?.innerHTML||null,probe}})()`,
      );
      diagnostic.parallelMarkup = markup.parallelMarkup;
      diagnostic.autoHideMarkup = markup.autoHideMarkup;
      await writeFile('/tmp/preview-fluent-dom.json', JSON.stringify(diagnostic, null, 2));
      console.error('Fluent smoke DOM diagnostic:', JSON.stringify(diagnostic));
    } catch (error) {
      console.error('Fluent smoke DOM diagnostic failed:', error.message);
    }
    try {
      await writeFile(
        '/tmp/preview-fluent-failure.png',
        (await window.webContents.capturePage()).toPNG(),
      );
    } catch {}
    throw Error(`Fluent smoke timed out waiting for ${name}: ${JSON.stringify(last)}`);
  }
  await wait('reader toolbar', `!!document.querySelector('.toolbar')`);
  await wait(
    'registered Fluent button',
    `!!customElements.get('fluent-button')&&!!document.querySelector('fluent-button[aria-label="Translation settings"]')`,
  );
  const startup = await evaluate(
    `(()=>{const button=document.querySelector('fluent-button[aria-label="Translation settings"]');return {platform:window.previewAppearance?.platform||null,buttonRegistered:!!customElements.get('fluent-button'),buttonTag:button?.tagName||null,buttonCount:document.querySelectorAll('fluent-button').length};})()`,
  );
  assert.equal(
    startup.platform,
    'win32',
    'fluent smoke must run with the Windows preload platform override',
  );
  assert.equal(startup.buttonRegistered, true, 'Fluent button custom element is not registered');
  assert.equal(startup.buttonTag, 'FLUENT-BUTTON');
  if (process.env.PDF_READER_CACHE_ONLY === '1') {
    window.show();
    window.focus();
    await evaluate(
      `document.querySelector('fluent-button[aria-label="Translation settings"]').click()`,
    );
    await wait(
      'native Fluent cache switch',
      `!!document.querySelector('fluent-switch[aria-labelledby="reuse-translations-label"]')`,
    );
    assert.equal(
      await evaluate(
        `document.querySelector('fluent-switch[aria-labelledby="reuse-translations-label"]').checked`,
      ),
      true,
    );
    for (const checked of [false, true]) {
      await evaluate(
        `(()=>{const control=document.querySelector('fluent-switch[aria-labelledby="reuse-translations-label"]');control.checked=${checked};control.dispatchEvent(new Event('change',{bubbles:true,composed:true}));})()`,
      );
      await wait(
        'cache preference persistence',
        `(async()=> (await window.previewPreferences.load()).reuseTranslations===${checked})()`,
      );
    }
    console.log(
      'Windows cache settings passed: Fluent switch rendered, default enabled, both preference changes saved.',
    );
    window.close();
    return;
  }

  await wait(
    'Windows custom menu',
    `!!document.querySelector('.windows-menu-trigger')&&typeof window.previewWindow.menu==='function'`,
  );
  await evaluate(`document.querySelector('.windows-menu-trigger').click();true`);
  await wait(
    'custom menu opened',
    `document.querySelectorAll('.windows-menu-panel [role="menuitem"]').length>2`,
  );
  await evaluate(
    `(()=>{const buttons=[...document.querySelectorAll('.windows-menu-panel button')];buttons.find(button=>button.textContent.includes('View')).click();return true;})()`,
  );
  await wait(
    'custom View submenu',
    `document.querySelectorAll('.windows-menu-cascade').length===2&&[...document.querySelectorAll('.windows-menu-item')].some(button=>button.textContent.includes('Fit Width'))`,
  );
  await evaluate(
    `document.querySelector('.windows-menu-trigger').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));true`,
  );
  await wait('custom menu dismissed', `!document.querySelector('.windows-menu-panel')`);
  await evaluate(`document.querySelector('.windows-menu-trigger').click();true`);
  await wait(
    'application menu root',
    `!!document.querySelector('.windows-menu-item')&&document.querySelectorAll('.windows-menu-cascade').length===1`,
  );
  await evaluate(`document.querySelector('.windows-menu-item').click();true`);
  await wait(
    'application Settings command',
    `[...document.querySelectorAll('.windows-menu-item')].some(button=>button.textContent.includes('Settings'))`,
  );
  await evaluate(
    `[...document.querySelectorAll('.windows-menu-item')].find(button=>button.textContent.includes('Settings')).click();true`,
  );
  await wait(
    'custom menu command delivered',
    `!!document.querySelector('.settings')&&!document.querySelector('.windows-menu-panel')`,
  );
  await evaluate(
    `document.querySelector('fluent-button[aria-label="Close settings"]').click();true`,
  );
  await wait('command settings closed', `!document.querySelector('.settings')`);
  const hiddenChrome = await evaluate(
    `(()=>{const root=document.querySelector('.app'),toolbar=document.querySelector('.toolbar'),workspace=document.querySelector('.workspace');const glass=root.classList.contains('content-glass');root.classList.remove('content-glass');const before=workspace.getBoundingClientRect();root.classList.add('immersive-header-hidden');const style=getComputedStyle(toolbar),after=workspace.getBoundingClientRect(),hit=document.elementFromPoint(innerWidth/2,20);const result={visibility:style.visibility,pointerEvents:style.pointerEvents,drag:style.getPropertyValue('-webkit-app-region'),stable:before.y===after.y&&before.height===after.height,overlap:before.y<56,blocked:!!hit?.closest('.toolbar')};root.classList.remove('immersive-header-hidden');if(glass)root.classList.add('content-glass');return result;})()`,
  );
  assert.equal(
    hiddenChrome.visibility,
    'hidden',
    'hidden Windows header must remove its hit and drag surface',
  );
  assert.equal(hiddenChrome.pointerEvents, 'none');
  assert.equal(hiddenChrome.drag, 'no-drag');
  assert.equal(
    hiddenChrome.stable,
    true,
    'hiding the header must keep the reading viewport stable',
  );
  assert.equal(
    hiddenChrome.overlap,
    true,
    'Windows reading area must extend underneath the header',
  );
  assert.equal(hiddenChrome.blocked, false, 'hidden header must not intercept reading-area clicks');
  await evaluate(
    `document.querySelector('fluent-button[aria-label="Translation settings"]').click();true`,
  );
  await wait('settings opened', `!!document.querySelector(':is(.settings,.settings-panel)')`);
  await wait('OpenAI provider', `!!document.querySelector('[data-provider-id="openai"]')`);
  await evaluate(
    `document.querySelector('[data-settings-category="providers"]').click();document.querySelector('[data-provider-id="openai"]').click();true`,
  );
  await wait(
    'Windows settings controls',
    `(()=>!!document.querySelector(':is(.settings,.settings-panel) fluent-text-input[aria-label="OpenAI API key"]')&&!!document.querySelector(':is(.settings,.settings-panel) fluent-dropdown[aria-label="Translation language"]')&&!!document.querySelector(':is(.settings,.settings-panel) fluent-tablist.fluent-kernel-modes')&&document.querySelectorAll(':is(.settings,.settings-panel) fluent-slider').length>=2&&!!document.querySelector(':is(.settings,.settings-panel) fluent-switch[aria-label="Auto-hide header"]'))()`,
  );

  const secure = await evaluate(
    `(()=>{const host=document.querySelector(':is(.settings,.settings-panel) fluent-text-input[aria-label="OpenAI API key"]'),input=host?.shadowRoot?.querySelector('input');return {hostTag:host?.tagName||null,inputType:input?.type||null,input:!!input,shadowMode:host?.shadowRoot?.mode||null};})()`,
  );
  assert.equal(secure.hostTag, 'FLUENT-TEXT-INPUT');
  assert.equal(secure.inputType, 'password', 'secure field must expose a password input');
  assert.equal(secure.input, true, 'Fluent text input shadow input is unavailable');
  assert.equal(
    secure.shadowMode,
    'open',
    'Fluent text input must retain the open shadow root needed by the adapter ref',
  );

  await evaluate(`document.querySelector('[data-settings-category="general"]').click();true`);
  const switchState = await evaluate(
    `(()=>{const control=document.querySelector(':is(.settings,.settings-panel) fluent-switch[aria-label="Auto-hide header"]');if(!control)return null;control.checked=!control.checked;control.dispatchEvent(new Event('change',{bubbles:true,composed:true}));return {checked:control.checked};})()`,
  );
  assert.ok(switchState, 'auto-hide Fluent switch is missing');
  await wait(
    'switch preference persistence',
    `(async()=>{const control=document.querySelector(':is(.settings,.settings-panel) fluent-switch[aria-label="Auto-hide header"]'),state=await window.previewPreferences.load();return !!control&&state.autoHideHeader===control.checked;})()`,
  );

  await evaluate(`document.querySelector('[data-settings-category="translation"]').click();true`);
  const pagesValue = await evaluate(
    `(()=>{const control=document.querySelector(':is(.settings,.settings-panel) fluent-slider[aria-labelledby="parallel-pages-label"]');if(!control)return null;control.value=4;control.dispatchEvent(new Event('change',{bubbles:true,composed:true}));return Number(control.value);})()`,
  );
  const translationsValue = await evaluate(
    `(()=>{const control=document.querySelector(':is(.settings,.settings-panel) fluent-slider[aria-labelledby="parallel-translations-label"]');if(!control)return null;control.value=8;control.dispatchEvent(new Event('change',{bubbles:true,composed:true}));return Number(control.value);})()`,
  );
  assert.equal(pagesValue, 4);
  assert.equal(translationsValue, 8);
  await wait(
    'slider preference persistence',
    `(async()=>{const state=await window.previewPreferences.load();return state.pageConcurrency===4&&state.concurrency===8;})()`,
  );

  await wait(
    'language options',
    `(()=>{const control=document.querySelector(':is(.settings,.settings-panel) fluent-dropdown[aria-label="Translation language"]');return !!control&&control.querySelectorAll('fluent-option').length>=8;})()`,
  );
  await evaluate(
    `(()=>{const control=document.querySelector(':is(.settings,.settings-panel) fluent-dropdown[aria-label="Translation language"]');control.open=true;return true;})()`,
  );
  await wait(
    'dropdown update:open binding',
    `(()=>{const control=document.querySelector(':is(.settings,.settings-panel) fluent-dropdown[aria-label="Translation language"]'),button=control?.querySelector('button[slot="control"]');return !!control&&control.open===true&&button?.getAttribute('aria-expanded')==='true';})()`,
  );
  await evaluate(
    `(()=>{const control=document.querySelector(':is(.settings,.settings-panel) fluent-dropdown[aria-label="Translation language"]');control.value='English';control.dispatchEvent(new Event('change',{bubbles:true,composed:true}));return true;})()`,
  );
  await wait(
    'dropdown value event and language persistence',
    `(async()=>{const control=document.querySelector(':is(.settings,.settings-panel) fluent-dropdown[aria-label="Translation language"]'),state=await window.previewPreferences.load();return !!control&&control.value==='English'&&state.language==='English';})()`,
  );
  await evaluate(
    `(()=>{const control=document.querySelector(':is(.settings,.settings-panel) fluent-dropdown[aria-label="Translation language"]');control.open=false;return true;})()`,
  );
  await wait(
    'dropdown close update:open binding',
    `(()=>{const control=document.querySelector(':is(.settings,.settings-panel) fluent-dropdown[aria-label="Translation language"]'),button=control?.querySelector('button[slot="control"]');return !!control&&control.open===false&&button?.getAttribute('aria-expanded')==='false';})()`,
  );

  await wait(
    'kernel Fluent tablist',
    `(()=>{const list=document.querySelector(':is(.settings,.settings-panel) fluent-tablist.fluent-kernel-modes');return !!list&&!list.disabled&&list.querySelectorAll('fluent-tab').length===3&&!!list.querySelector('fluent-tab[aria-selected="true"]');})()`,
  );
  await evaluate(`document.querySelector('[data-settings-category="general"]').click();true`);
  const initialEngine = await evaluate(
    `(async()=>({active:document.querySelector(':is(.settings,.settings-panel) fluent-tablist.fluent-kernel-modes')?.activeid,engine:(await window.previewPreferences.load()).engine}))()`,
  );
  const activeTab = await evaluate(
    `(()=>{const tab=document.querySelector(':is(.settings,.settings-panel) fluent-tablist.fluent-kernel-modes fluent-tab[aria-selected="true"]');tab?.focus();return !!tab;})()`,
  );
  assert.equal(activeTab, true, 'kernel active Fluent tab is missing');
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Right' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Right' });
  await wait(
    'kernel keyboard tab selection',
    `(()=>{const list=document.querySelector(':is(.settings,.settings-panel) fluent-tablist.fluent-kernel-modes');return !!list&&list.activeid!==${JSON.stringify(initialEngine.active)}&&list.querySelector('fluent-tab[aria-selected="true"]')?.dataset.segmentValue==='pdf_math_fast';})()`,
  );
  await wait(
    'kernel preference persistence',
    `(async()=>{const state=await window.previewPreferences.load();return state.engine==='pdf_math_fast';})()`,
  );

  const result = {
    platform: 'win32',
    fluentVersion: '3.1.3',
    buttonRegistered: true,
    settingsButtonClick: true,
    secureFieldPassword: true,
    shadowInputExposed: true,
    switchPersisted: true,
    slidersPersisted: true,
    dropdownValueEvent: true,
    dropdownOpenEvent: true,
    dropdownCloseEvent: true,
    kernelTabKeyboard: true,
    kernelPreferencePersisted: true,
    rendererSmoke: true,
  };
  await writeFile('/tmp/preview-fluent.json', JSON.stringify(result, null, 2));
  console.log('Fluent Windows adapter smoke passed:', JSON.stringify(result));
  window.close();
  return result;
}
