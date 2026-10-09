import assert from 'node:assert/strict';
import { clipboard, ClipboardItem } from 'electron';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { copyFile, mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const LEFT_LINES = ['LEFT TARGET ONE', 'LEFT TARGET TWO', 'LEFT TARGET THREE'];
const RIGHT_LINES = ['RIGHT UNRELATED ONE', 'RIGHT UNRELATED TWO', 'RIGHT UNRELATED THREE'];
const CACHED_LEFT_PREFIXES = [
  '迫的主要形式之一。过去二十',
  '息时代最大的国家审查机制。中国庞大的在线监控',
  '与控制网络背后的逻辑和运作方式已得到广泛研',
];
const CACHED_RIGHT_PREFIXES = [
  '辩论。关于哪些话题',
  '入黑名单的各种相互矛盾的',
  '认为，社交媒体帖子中的集体',
];

export async function verifyTextSelection(window, recents) {
  const evaluate = async (code) => {
      try {
        return await window.webContents.executeJavaScript(code);
      } catch (error) {
        throw Error(
          `Text selection renderer script failed: ${code.slice(0, 220)} / ${error.message}`,
        );
      }
    },
    pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

  async function waitFor(code, label) {
    let last;
    for (let attempt = 0; attempt < 240; attempt++) {
      last = await evaluate(code);
      if (last) return;
      await pause(50);
    }
    throw Error(
      `Text selection smoke timed out waiting for ${label}: ${code}\n${JSON.stringify(
        await evaluate(
          `(()=>({diagnostics:window.previewRenderDiagnostics?.(),text:Array.from(document.querySelectorAll('.reading-text-layer span'),e=>e.textContent).slice(0,80),selection:window.getSelection()?.toString()||'',selectionEvents:(window.__textSelectionEventLog||[]).slice(-24)}))()`,
        ),
      )}`,
    );
  }

  const normalize = (value) =>
    String(value || '')
      .replace(/\s+/g, ' ')
      .trim();
  const cachedSource = process.env.PDFMATHREADER_TEXT_SELECTION_PDF || '';
  let leftLines = LEFT_LINES;
  let rightLines = RIGHT_LINES;
  let expected;
  const smokePreferences = {
    automatic: false,
    documentOpenMode: 'original',
    translationMode: 'reading',
    interactionMode: 'reading',
    reduceMotion: true,
    reduceResourceUsage: false,
    reduceBackgroundFrameRate: false,
    emphasizeTopicSentences: true,
    emphasizeInformation: true,
    fit: 'width',
    direction: 'vertical',
    columns: 1,
  };
  const folder = await mkdtemp(join(tmpdir(), 'text-selection-smoke-'));
  const path = join(folder, 'Portrait and landscape.pdf');
  const failureScreenshot = cachedSource
    ? '/tmp/pdfmathreader-text-selection-chinese-failure.png'
    : '/tmp/pdfmathreader-text-selection-failure.png';
  const savedClipboard = await Promise.all(
    (await clipboard.read()).map(
      async (item) =>
        new ClipboardItem(
          Object.fromEntries(
            await Promise.all(item.types.map(async (type) => [type, await item.getType(type)])),
          ),
        ),
    ),
  );

  try {
    window.show();
    window.focus();
    window.webContents.focus();
    await waitFor('window.previewReady===true', 'renderer ready');

    // Keep the smoke on the local source text layer. The smoke app has an isolated
    // user-data directory, so these settings cannot change the user's preferences.
    await evaluate(`window.previewPreferences.save(${JSON.stringify(smokePreferences)})`);

    if (cachedSource) {
      assert.equal(
        (await stat(cachedSource)).isFile(),
        true,
        `Cached PDF is not a file: ${cachedSource}`,
      );
      await copyFile(cachedSource, path);
    } else {
      const pdf = await PDFDocument.create();
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      const page = pdf.addPage([612, 792]);
      const leftX = 72;
      const rightX = 350;
      const ys = [710, 670, 630];

      // Keep the fixture in ordinary two-column reading order. Each target line is
      // short enough that the drag must cross blank space just past its ending.
      for (let index = 0; index < LEFT_LINES.length; index++)
        page.drawText(LEFT_LINES[index], { x: leftX, y: ys[index], size: 18, font });
      for (let index = 0; index < RIGHT_LINES.length; index++)
        page.drawText(RIGHT_LINES[index], { x: rightX, y: ys[index], size: 18, font });
      await writeFile(path, await pdf.save());
    }

    await recents.remember(path);
    const recent = recents.list().find((entry) => recents.path(entry.id) === path);
    assert.ok(recent, `Selection fixture was not added to recents: ${path}`);
    await recents.setView(recent.id, {
      page: 1,
      offsetX: 0,
      offsetY: 0,
      zoom: 1,
      fit: 'width',
      direction: 'vertical',
      columns: 1,
      sidebar: false,
      showTranslations: false,
    });

    await new Promise((resolve) => {
      window.webContents.once('did-finish-load', resolve);
      window.webContents.reload();
    });
    await waitFor('window.previewReady===true', 'renderer ready after preferences');
    await evaluate(`window.previewPreferences.save(${JSON.stringify(smokePreferences)})`);
    window.webContents.send('preferences:changed', smokePreferences);
    await waitFor(
      `(async()=>{const p=await window.previewPreferences.load();return p.automatic===false&&p.reduceResourceUsage===false&&p.reduceBackgroundFrameRate===false&&p.emphasizeTopicSentences===true&&p.emphasizeInformation===true;})()`,
      'post-reload smoke preferences',
    );
    const selector = `[data-recent-id="${recent.id}"]`;
    await evaluate(`document.querySelector(${JSON.stringify(selector)})?.click();true`);
    await waitFor(
      `(()=>{const d=window.previewRenderDiagnostics?.();return d?.totalPages===1&&!d.opening&&!!document.querySelector('.page[data-page="1"]');})()`,
      'fixture open',
    );
    if (cachedSource) {
      await waitFor(
        `document.querySelectorAll('.page[data-page="1"] .reading-text-layer span').length>=20`,
        'cached Chinese source text spans',
      );
      const cachedLines = await evaluate(
        `(()=>{const spans=[...document.querySelectorAll('.page[data-page="1"] .reading-text-layer span')].map(span=>{const r=span.getBoundingClientRect();return {text:span.textContent.trim(),left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};}).filter(item=>item.text&&item.width>0&&item.height>0);const pick=(prefix,side)=>{const matches=spans.filter(item=>item.text.startsWith(prefix));if(!matches.length)throw Error('Missing cached text prefix '+prefix);matches.sort((a,b)=>(side==='left'?a.left-b.left:b.left-a.left)||a.top-b.top);return matches[0];};return {left:${JSON.stringify(CACHED_LEFT_PREFIXES)}.map(prefix=>pick(prefix,'left')),right:${JSON.stringify(CACHED_RIGHT_PREFIXES)}.map(prefix=>pick(prefix,'right'))};})()`,
      );
      leftLines = cachedLines.left.map((line) => line.text);
      rightLines = cachedLines.right.map((line) => line.text);
    } else {
      await waitFor(
        `(()=>{const wanted=${JSON.stringify([...leftLines, ...rightLines])};const spans=[...document.querySelectorAll('.page[data-page="1"] .reading-text-layer span')];return wanted.every(text=>spans.some(span=>span.textContent.trim()===text));})()`,
        'all natural-order source text spans',
      );
    }
    expected = normalize(leftLines.join(' '));
    await waitFor(
      `(()=>{const spans=[...document.querySelectorAll('.page[data-page="1"] .reading-text-layer span')];return spans.every(span=>{const r=span.getBoundingClientRect();return !span.textContent.trim()||r.width>0&&r.height>0;});})()`,
      'source text geometry',
    );

    const geometry = await evaluate(
      `(()=>{const spans=[...document.querySelectorAll('.page[data-page="1"] .reading-text-layer span')];const find=(text)=>{const span=spans.find(item=>item.textContent.trim()===text);if(!span)throw Error('Missing text span '+text);const r=span.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};return {left:${JSON.stringify(leftLines)}.map(find),right:${JSON.stringify(rightLines)}.map(find),page:document.querySelector('.page[data-page="1"]').getBoundingClientRect()};})()`,
    );
    assert.ok(geometry.left.every((rect) => rect.width > 0 && rect.height > 0));
    assert.ok(geometry.right.every((rect) => rect.width > 0 && rect.height > 0));
    assert.ok(
      geometry.right[0].left > Math.max(...geometry.left.map((rect) => rect.right)) + 20,
      'fixture must leave a blank corridor between columns',
    );

    const corridorX = Math.round(Math.max(...geometry.left.map((rect) => rect.right)) + 8);
    const center = (rect) => Math.round((rect.top + rect.bottom) / 2);
    const point = (x, rect) => ({ x: Math.round(x), y: center(rect) });
    const at = (x, y) => ({ x: Math.round(x), y: Math.round(y) });
    const modifiers = process.platform === 'darwin' ? ['meta'] : ['control'];
    await evaluate(
      `(()=>{if(window.__textSelectionPointerLogInstalled)return true;window.__textSelectionPointerLog=[];window.__textSelectionEventLog=[];const record=(type,phase,event)=>{const selection=window.getSelection()?.toString()||'';window.__textSelectionEventLog.push({type,phase,button:event?.button??null,buttons:event?.buttons??null,target:String(event?.target?.className||event?.target?.nodeName||''),selection:selection.slice(0,240)});if(window.__textSelectionEventLog.length>120)window.__textSelectionEventLog.splice(0,window.__textSelectionEventLog.length-120);};for(const type of ['pointerdown','pointermove','pointerup','pointercancel','mousedown','mousemove','mouseup']){document.addEventListener(type,event=>{if(type.startsWith('pointer'))window.__textSelectionPointerLog.push({type,button:event.button,buttons:event.buttons,x:event.clientX,y:event.clientY});record(type,'capture',event)},true);document.addEventListener(type,event=>record(type,'bubble',event),false)}document.addEventListener('selectionchange',event=>record('selectionchange','bubble',event));window.__textSelectionPointerLogInstalled=true;return true;})()`,
    );

    async function drag(direction) {
      const startLine = direction === 'forward' ? geometry.left[0] : geometry.left[2];
      const endLine = direction === 'forward' ? geometry.left[2] : geometry.left[0];
      const start = point(direction === 'forward' ? startLine.left + 2 : corridorX, startLine);
      const end = point(direction === 'forward' ? corridorX : endLine.left + 2, endLine);
      const whitespace = [
        at(corridorX, geometry.left[0].bottom + 6),
        at(corridorX, geometry.left[1].top - 6),
        at(corridorX, geometry.left[1].bottom + 6),
        at(corridorX, geometry.left[2].top - 6),
      ];
      const pathPoints =
        direction === 'forward'
          ? [start, ...whitespace, end]
          : [start, ...whitespace.reverse(), end];

      await evaluate('window.__textSelectionPointerLog=[];window.__textSelectionEventLog=[];true');
      window.focus();
      window.webContents.focus();
      window.webContents.sendInputEvent({ type: 'mouseMove', ...start });
      await pause(60);
      window.webContents.sendInputEvent({
        type: 'mouseDown',
        button: 'left',
        clickCount: 1,
        ...start,
      });
      for (const next of pathPoints.slice(1)) {
        window.webContents.sendInputEvent({ type: 'mouseMove', button: 'left', ...next });
        await pause(35);
      }
      window.webContents.sendInputEvent({
        type: 'mouseUp',
        button: 'left',
        clickCount: 1,
        ...end,
      });
      await waitFor('!!window.getSelection()?.toString().trim()', `${direction} native selection`);
      return evaluate(
        `(()=>{const selection=window.getSelection();return {text:selection?.toString()||'',rangeCount:selection?.rangeCount||0,anchor:selection?.anchorNode?.parentElement?.textContent||'',focus:selection?.focusNode?.parentElement?.textContent||'',pointerLog:window.__textSelectionPointerLog||[],eventLog:(window.__textSelectionEventLog||[]).slice(-40)};})()`,
      );
    }

    async function copySelection(direction) {
      await clipboard.writeText(`text-selection-smoke-${direction}`);
      const selection = await drag(direction);
      const eventSummary = JSON.stringify(selection.eventLog.slice(-16));
      assert.ok(selection.rangeCount > 0, `${direction} drag created a native range`);
      assert.ok(
        selection.pointerLog.some((event) => event.type === 'pointerdown' && event.buttons & 1),
        `${direction} pointerdown carries left-button state: ${JSON.stringify(selection.pointerLog)}`,
      );
      assert.ok(
        selection.pointerLog.some((event) => event.type === 'pointerup' && event.buttons === 0),
        `${direction} pointerup clears button state: ${JSON.stringify(selection.pointerLog)}`,
      );
      assert.equal(
        normalize(selection.text),
        expected,
        `${direction} drag selected the three target lines continuously; events=${eventSummary}`,
      );
      assert.ok(
        !selection.text.includes('RIGHT UNRELATED'),
        `${direction} drag did not select unrelated right-column text; events=${eventSummary}`,
      );
      if (direction === 'forward') {
        window.webContents.send('preferences:changed', {
          emphasizeTopicSentences: false,
          emphasizeInformation: false,
        });
        await waitFor(
          `(()=>{const s=window.getSelection();return s?.toString()===${JSON.stringify(selection.text)}&&!!s.anchorNode?.isConnected;})()`,
          'selection after emphasis refresh',
        );
        const refreshed = await evaluate(
          `(()=>{const s=window.getSelection();return {text:s?.toString()||'',anchorConnected:!!s?.anchorNode?.isConnected};})()`,
        );
        assert.equal(refreshed.anchorConnected, true, 'selection anchor remains connected');
        assert.equal(
          refreshed.text,
          selection.text,
          'selection text survives the emphasis refresh',
        );
      }
      window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'C', modifiers });
      window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'C', modifiers });
      let copied = '';
      for (let attempt = 0; attempt < 40; attempt++) {
        copied = await clipboard.readText();
        if (normalize(copied) !== `text-selection-smoke-${direction}`) break;
        await pause(25);
      }
      assert.equal(
        normalize(copied),
        expected,
        `${direction} native Cmd/Ctrl+C copied the target lines in reading order`,
      );
      assert.ok(!copied.includes('RIGHT UNRELATED'));
      return {
        selection: normalize(selection.text),
        copied: normalize(copied),
        pointer: selection.pointerLog,
        events: selection.eventLog,
      };
    }

    const partial = await evaluate(
      `(()=>{const span=[...document.querySelectorAll('.reading-text-layer span')].find(e=>e.textContent.trim()===${JSON.stringify(leftLines[0])});const walker=document.createTreeWalker(span,NodeFilter.SHOW_TEXT),node=walker.nextNode();const end=Math.min(7,node.length-1),range=document.createRange();range.setStart(node,0);range.setEnd(node,1);const a=range.getBoundingClientRect();range.setStart(node,end-1);range.setEnd(node,end);const b=range.getBoundingClientRect();return {start:{x:Math.round(a.left+1),y:Math.round((a.top+a.bottom)/2)},end:{x:Math.round(b.right-1),y:Math.round((b.top+b.bottom)/2)},expected:node.textContent.slice(0,end)};})()`,
    );
    for (const reverse of [false, true]) {
      const start = reverse ? partial.end : partial.start,
        end = reverse ? partial.start : partial.end;
      window.webContents.sendInputEvent({
        type: 'mouseDown',
        button: 'left',
        clickCount: 1,
        ...start,
      });
      window.webContents.sendInputEvent({ type: 'mouseMove', button: 'left', ...end });
      window.webContents.sendInputEvent({ type: 'mouseUp', button: 'left', clickCount: 1, ...end });
      await pause(100);
      assert.equal(
        await evaluate('window.getSelection().toString()'),
        partial.expected,
        'Select characters within a line, reverse=' + reverse,
      );
      await clipboard.writeText('partial-selection-pending');
      window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'C', modifiers });
      window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'C', modifiers });
      for (let attempt = 0; attempt < 40; attempt++) {
        if ((await clipboard.readText()) === partial.expected) break;
        await pause(25);
      }
      assert.equal(await clipboard.readText(), partial.expected, 'Copy only selected characters');
    }
    await writeFile(
      cachedSource ? '/tmp/reader-partial-chinese.png' : '/tmp/reader-partial-english.png',
      (await window.webContents.capturePage()).toPNG(),
    );
    const forward = await copySelection('forward');
    const reverse = await copySelection('reverse');
    if (cachedSource) {
      await evaluate(
        `(()=>{const reader=document.querySelector('.reader'),range=window.getSelection()?.getRangeAt(0);if(reader&&range)reader.scrollTop+=range.getBoundingClientRect().top-reader.getBoundingClientRect().top-180;})()`,
      );
      await pause(150);
    }
    const screenshot = cachedSource
      ? '/tmp/pdfmathreader-text-selection-chinese.png'
      : '/tmp/pdfmathreader-text-selection.png';
    await writeFile(screenshot, (await window.webContents.capturePage()).toPNG());
    console.log(
      'Text selection smoke passed:',
      JSON.stringify({
        fixture: path,
        cachedSource: cachedSource || null,
        screenshot,
        forward,
        reverse,
        crossedBetweenLineWhitespace: true,
        blankPastShortLineEndings: true,
        excludedOtherColumn: true,
      }),
    );
  } catch (error) {
    if (!window.isDestroyed()) {
      try {
        await writeFile(failureScreenshot, (await window.webContents.capturePage()).toPNG());
        console.error(`Text selection smoke failure screenshot: ${failureScreenshot}`);
      } catch {}
    }
    throw error;
  } finally {
    if (savedClipboard.length) await clipboard.write(savedClipboard);
    else clipboard.clear();
    await rm(folder, { recursive: true, force: true });
    if (!window.isDestroyed()) window.close();
  }
}
