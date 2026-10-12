import assert from 'node:assert/strict';
import { writeFile, mkdtemp, rm, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { app } from 'electron';

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const fixtureName = 'A quieter way to read.pdf';

async function writeTopicFixture(path) {
  const firstA = [
    'Although many scholars believe the issue is simple,',
    'careful evidence shows that the mechanism depends on context and institutions.',
    'Later analysis compares institutions across regions and measures long-term outcomes.',
    'It tests whether the relationship remains visible after competing explanations are considered.',
    'Historical conditions, administrative capacity, local incentives, and public expectations can change the observed pattern.',
    'Additional evidence from surveys, archives, and repeated observations supports the same interpretation.',
    'The comparison covers independent samples and periods and clarifies why similar settings diverge.',
    'These results guide a cautious account of the mechanisms behind the observed differences.',
  ];
  const firstB = [
    'A second group of readers may describe the pattern as inevitable,',
    'yet a closer comparison reveals that institutional choices matter.',
    'Subsequent evidence draws on interviews, archival records, and repeated observations.',
    'It compares cases over time and distinguishes durable mechanisms from temporary responses.',
    'The broader analysis considers incentives, legal constraints, social expectations, and capacity.',
    'It tests alternative explanations against independent sources and related outcomes.',
    'Taken together, these observations show why similar cases can produce different results.',
    'Different historical conditions can redirect the effects of otherwise similar institutions.',
  ];
  const document = await PDFDocument.create(),
    font = await document.embedFont(StandardFonts.Helvetica),
    page = document.addPage([612, 792]);
  for (const [lines, startY] of [
    [firstA, 750],
    [firstB, 590],
  ])
    for (let index = 0; index < lines.length; index++)
      page.drawText(lines[index], {
        font,
        size: 12,
        x: index === 0 ? 68 : 48,
        y: startY - index * 16,
      });
  await writeFile(path, await document.save());
  return { expected: [firstA.slice(0, 2), firstB.slice(0, 2)].flat().join('') };
}

export async function verifyTopicSentences(window, recents) {
  const evaluate = (code) => window.webContents.executeJavaScript(code);
  const focus = () => {
    window.show();
    app.focus({ steal: true });
    window.focus();
    window.webContents.focus();
  };
  const wait = async (code, label = code) => {
    for (let attempt = 0; attempt < 300; attempt++) {
      try {
        if (await evaluate(code)) return;
      } catch {}
      await pause(60);
    }
    let state = '';
    try {
      state = JSON.stringify(
        await evaluate(
          '({ready:window.previewReady,diagnostics:window.previewRenderDiagnostics?.(),body:document.body.innerText.slice(0,1200)})',
        ),
      );
    } catch {}
    throw Error(`Topic sentences smoke timed out: ${label}\n${state}`);
  };
  const reload = async () => {
    if (await evaluate('window.previewRenderDiagnostics?.().totalPages>0')) {
      window.webContents.send('reader:action', 'close-document');
      await wait(
        'window.previewRenderDiagnostics().totalPages===0',
        'fixture released before reload',
      );
    }
    await new Promise((resolve, reject) => {
      let timer;
      const cleanup = () => {
        clearTimeout(timer);
        window.webContents.removeListener('did-finish-load', done);
        window.webContents.removeListener('did-fail-load', failed);
      };
      const done = () => {
        cleanup();
        resolve();
      };
      const failed = (_event, code, description) => {
        if (code === -3) return;
        cleanup();
        reject(Error(`Renderer reload failed (${code}): ${description}`));
      };
      timer = setTimeout(() => {
        cleanup();
        reject(Error('Renderer reload timed out.'));
      }, 30000);
      window.webContents.once('did-finish-load', done);
      window.webContents.on('did-fail-load', failed);
      window.webContents.reload();
    });
    await wait('window.previewReady===true', 'renderer ready after reload');
    focus();
  };
  const openRecent = async (id) => {
    const selector = `[data-recent-id=${JSON.stringify(id)}]`;
    await wait(
      `!!document.querySelector(${JSON.stringify(selector)})`,
      'temporary fixture recent entry',
    );
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
    await wait(
      `(()=>{const d=window.previewRenderDiagnostics?.();return d?.recentId===${JSON.stringify(id)}&&d.totalPages===1&&!d.opening&&document.querySelector('.page canvas')?.width>0;})()`,
      'temporary fixture rendered',
    );
    focus();
    await wait(`!!document.querySelector('.reading-text-layer span')`, 'PDF text layer rendered');
  };
  const setting = 'document.querySelector("[data-setting=topic-sentences] input")';
  const detectionSetting =
    'document.querySelector("[data-setting=topic-sentence-detection] input")';
  const openSettings = async () => {
    await evaluate('document.querySelector("[aria-label=\\"Translation settings\\"]").click()');
    await wait(`!!${setting}`, 'topic sentence setting');
  };
  const openExperimentalSettings = async () => {
    await openSettings();
    await evaluate('document.querySelector("[data-settings-category=experimental]").click()');
    await wait(`!!${detectionSetting}`, 'experimental topic sentence setting');
  };
  const installTopicSentenceMock = async (mode) => {
    await evaluate(`(()=>{
      const originalFetch = window.fetch.bind(window);
      window.topicSentenceSmoke = {mode:${JSON.stringify(mode)}, calls:[]};
      window.fetch = async (input, options = {}) => {
        const url = new URL(String(input), location.href);
        if (url.pathname !== '/api/topic-sentence') return originalFetch(input, options);
        let body = {};
        try { body = JSON.parse(options.body || '{}'); } catch {}
        window.topicSentenceSmoke.calls.push(body);
        if (window.topicSentenceSmoke.mode === 'error')
          throw new Error('topic sentence smoke transport failure');
        return new Response(JSON.stringify({
          status: 'classified',
          isTopicSentence: window.topicSentenceSmoke.mode !== 'no'
        }), {status:200, headers:{'Content-Type':'application/json'}});
      };
      return true;
    })()`);
  };
  const markedText = () =>
    evaluate(
      'Array.from(document.querySelectorAll(".reader .reading-text-layer .pdf-topic-sentence"),node=>node.textContent).join("")',
    );
  const sourceText = () =>
    evaluate(
      'Array.from(document.querySelectorAll(".reader .reading-text-layer span"),node=>node.textContent).join("")',
    );

  const folder = await mkdtemp(join(tmpdir(), 'pdfmathreader-topic-')),
    generated = join(folder, fixtureName);
  try {
    const { expected } = await writeTopicFixture(generated);
    await wait('window.previewReady===true', 'initial renderer ready');
    focus();
    const initial = await evaluate('window.previewPreferences.load()');
    assert.equal(initial.emphasizeTopicSentences, false, 'topic sentence emphasis defaults off');
    await evaluate(
      'window.previewPreferences.save({automatic:false,documentOpenMode:"original",interactionMode:"reading",restoreDocuments:false,emphasizeTopicSentences:false})',
    );
    await recents.remember(generated);
    const generatedId = recents
      .list()
      .find((entry) => entry.name === fixtureName && recents.path(entry.id) === generated)?.id;
    assert.ok(generatedId, 'temporary fixture was added to recents');
    await reload();
    await openRecent(generatedId);
    const originalText = await sourceText();
    await openSettings();
    assert.equal(await evaluate(`${setting}.getAttribute('aria-valuetext')`), 'Off');
    await evaluate(`${setting}.click()`);
    await wait(
      'document.querySelectorAll(".reader .reading-text-layer .pdf-topic-sentence").length===4',
      'both wrapped first sentences emphasized',
    );
    assert.equal(
      await markedText(),
      expected,
      'emphasis includes each indented first line and its continuation',
    );
    assert.equal(await sourceText(), originalText, 'topic overlay preserves source text');
    assert.ok(
      await evaluate('!!document.querySelector(".topic-sentence-overlay")'),
      'topic overlay rendered',
    );
    await evaluate(`${setting}.click()`);
    await wait(
      'document.querySelectorAll(".reader .reading-text-layer .pdf-topic-sentence").length===0',
      'topic emphasis toggles off',
    );
    await evaluate(`${setting}.click()`);
    await wait(
      `(async()=> (await window.previewPreferences.load()).emphasizeTopicSentences===true)()`,
      'topic preference persisted before reload',
    );
    await reload();
    assert.equal(
      await evaluate('window.previewPreferences.load().then(p=>p.emphasizeTopicSentences)'),
      true,
      'topic preference survives reload',
    );
    await openRecent(generatedId);
    await wait(
      'document.querySelectorAll(".reader .reading-text-layer .pdf-topic-sentence").length===4',
      'persisted emphasis rendered after reopen',
    );
    assert.equal(await markedText(), expected, 'persisted emphasis retains both first sentences');

    const external = process.env.PDF_READER_TOPIC_FIXTURE;
    if (external) {
      const externalPath = join(folder, fixtureName);
      await copyFile(external, externalPath);
      await recents.remember(externalPath);
      const externalId = recents
        .list()
        .find((entry) => entry.name === fixtureName && recents.path(entry.id) === externalPath)?.id;
      assert.ok(externalId, 'real topic fixture was added to recents');
      await evaluate(
        'window.previewPreferences.save({automatic:false,documentOpenMode:"original",interactionMode:"reading",emphasizeTopicSentences:true})',
      );
      await reload();
      await openRecent(externalId);
      await wait(
        'window.previewRenderDiagnostics().readingView.showTranslations===false&&window.previewRenderDiagnostics().translationRequests.length===0',
        'real fixture opened in original mode without translation',
      );
      await openSettings();
      if (await evaluate(`${setting}.getAttribute('aria-valuetext')!=='On'`))
        await evaluate(`${setting}.click()`);
      await wait(
        'document.querySelectorAll(".reader .reading-text-layer .pdf-topic-sentence").length>0',
        'real topic fixture emphasis',
      );
      const realMarked = await markedText(),
        expectedReal = process.env.PDF_READER_TOPIC_EXPECTED;
      assert.ok(realMarked, 'real topic fixture has a marked first sentence');
      if (expectedReal)
        assert.equal(
          realMarked.normalize('NFKC'),
          expectedReal.normalize('NFKC'),
          'real fixture emphasizes exactly the complete first sentence',
        );
      await evaluate('document.querySelector(".settings-heading button").click()');
      await pause(350);
      await writeFile(
        '/tmp/pdfmathreader-topic-fixed.png',
        (await window.webContents.capturePage()).toPNG(),
      );
      console.log(
        'Topic sentence real fixture passed',
        JSON.stringify({
          expectedPrefix: expectedReal || null,
          markedPrefix: realMarked.slice(0, 120),
          noTranslationRequests: true,
          screenshot: '/tmp/pdfmathreader-topic-fixed.png',
        }),
      );
    }

    await recents.clear();
    await evaluate('window.previewCredentials.save("sk-topic-sentences-test-only")');
    await evaluate(
      'window.previewPreferences.save({automatic:true,documentOpenMode:"translation",interactionMode:"reading",restoreDocuments:false,emphasizeTopicSentences:true,translationServices:{pdf_inspector:{id:"openai",values:{}}}})',
    );
    await reload();
    await evaluate('document.querySelector(".sample-button")?.click()');
    await wait(
      '!!document.querySelector(".reading-paragraph .paragraph-text")',
      'mock translated paragraph',
    );
    await wait(
      'document.querySelector(".reading-paragraph .paragraph-text")?.textContent.includes("第二句保持普通字重。")',
      'mock translation content',
    );
    await wait(
      '!!document.querySelector(".reading-paragraph .topic-sentence-text")',
      'long mock translated first sentence',
    );
    assert.equal(
      await evaluate(
        'Array.from(document.querySelectorAll(".reading-paragraph .topic-sentence-text"),node=>node.textContent).join("")',
      ),
      '译文第一句。',
    );
    const translatedTopic = true;

    // Keep the Jev lane local to this renderer. Each scenario changes the
    // synthetic token before reload so the classifier cannot reuse a previous
    // decision, while the fetch shim handles only the topic-sentence endpoint.
    await recents.remember(generated);
    const classifierFixtureId = recents
      .list()
      .find((entry) => entry.name === fixtureName && recents.path(entry.id) === generated)?.id;
    assert.ok(classifierFixtureId, 'classifier fixture was added to recents');

    await evaluate(
      'window.previewPreferences.save({automatic:false,documentOpenMode:"original",interactionMode:"reading",restoreDocuments:false,emphasizeTopicSentences:true,topicSentenceDetection:false,jevApiToken:"topic-smoke-off"})',
    );
    await reload();
    await installTopicSentenceMock('off');
    await openRecent(classifierFixtureId);
    await pause(350);
    assert.equal(
      await evaluate('window.topicSentenceSmoke.calls.length'),
      0,
      'topic detection off makes no classifier requests',
    );
    assert.equal(
      await evaluate(
        'document.querySelectorAll(".reader .reading-text-layer .pdf-topic-sentence").length',
      ),
      4,
      'topic detection off keeps the heuristic emphasis',
    );

    await evaluate(
      'window.previewPreferences.save({topicSentenceDetection:true,jevApiToken:"topic-smoke-no"})',
    );
    await reload();
    await installTopicSentenceMock('no');
    await openRecent(classifierFixtureId);
    await wait('window.topicSentenceSmoke.calls.length>0', 'original classifier request');
    await wait(
      'document.querySelectorAll(".reader .reading-text-layer .pdf-topic-sentence").length===0',
      'classified non-topic original sentence removes emphasis',
    );
    const originalClassificationCalls = await evaluate('window.topicSentenceSmoke.calls');
    assert.ok(
      originalClassificationCalls.every(
        (call) =>
          typeof call.paragraph === 'string' &&
          typeof call.firstSentence === 'string' &&
          call.paragraph.startsWith(call.firstSentence),
      ),
      'original classifier requests carry paragraph and first sentence',
    );

    await evaluate(
      'window.previewPreferences.save({topicSentenceDetection:true,jevApiToken:"topic-smoke-error"})',
    );
    await reload();
    await installTopicSentenceMock('error');
    await openRecent(classifierFixtureId);
    await wait('window.topicSentenceSmoke.calls.length>0', 'original failure request');
    await wait(
      'document.querySelectorAll(".reader .reading-text-layer .pdf-topic-sentence").length===4',
      'failed original classifier request restores heuristic emphasis',
    );

    const openMockTranslation = async (mode) => {
      await reload();
      await installTopicSentenceMock(mode);
      await evaluate('document.querySelector(".sample-button")?.click()');
      await wait(
        '!!document.querySelector(".reading-paragraph .paragraph-text")',
        'mock translated paragraph after classifier reload',
      );
      await wait(
        'document.querySelector(".reading-paragraph .paragraph-text")?.textContent.includes("第二句保持普通字重。")',
        'mock translation content after classifier reload',
      );
      await wait(
        'window.topicSentenceSmoke.calls.some(call=>call.firstSentence==="译文第一句。")',
        'translated classifier request',
      );
    };

    await recents.clear();
    await evaluate(
      'window.previewPreferences.save({automatic:true,documentOpenMode:"translation",interactionMode:"reading",restoreDocuments:false,emphasizeTopicSentences:true,topicSentenceDetection:true,jevApiToken:"topic-smoke-translated-no",translationServices:{pdf_inspector:{id:"openai",values:{}}}})',
    );
    await openMockTranslation('no');
    await wait(
      '!document.querySelector(".reading-paragraph .topic-sentence-text")',
      'classified non-topic translated sentence removes emphasis',
    );

    await evaluate(
      'window.previewPreferences.save({topicSentenceDetection:true,jevApiToken:"topic-smoke-translated-error"})',
    );
    await openMockTranslation('error');
    await wait(
      '!!document.querySelector(".reading-paragraph .topic-sentence-text")',
      'failed translated classifier request restores emphasis',
    );

    await openExperimentalSettings();
    assert.equal(
      await evaluate(`${detectionSetting}.getAttribute('aria-valuetext')`),
      'On',
      'experimental topic detection control is on after translated checks',
    );
    await evaluate(`${detectionSetting}.click()`);
    await wait(
      `(async()=> (await window.previewPreferences.load()).topicSentenceDetection===false)()`,
      'experimental topic detection toggle saves off',
    );
    await reload();
    await openExperimentalSettings();
    assert.equal(
      await evaluate(`${detectionSetting}.getAttribute('aria-valuetext')`),
      'Off',
      'experimental topic detection toggle persists after reload',
    );

    console.log(
      'Topic sentence smoke passed',
      JSON.stringify({
        defaultOff: true,
        generatedFixture: true,
        wrappedIndentation: true,
        sourceTextUnchanged: true,
        toggleReversible: true,
        persisted: true,
        realFixture: !!external,
        translationMockTopic: translatedTopic,
        classifierOffNoCalls: true,
        classifierOriginalNo: true,
        classifierOriginalFailureFallback: true,
        classifierTranslatedNo: true,
        classifierTranslatedFailureFallback: true,
        classifierPreferencePersisted: true,
      }),
    );
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
  app.exit(0);
}
