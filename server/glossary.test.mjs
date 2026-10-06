import test from 'node:test';
import assert from 'node:assert/strict';
import { glossaryEntries, protectTerms, validGlossaries } from '../src/glossary.mjs';
test('enabled libraries use longest phrase and first duplicate definition', () => {
  const entries = glossaryEntries([
    {
      id: 'a',
      name: 'A',
      enabled: true,
      entries: [
        { source: 'effect', target: '效应' },
        { source: 'treatment effect', target: '处理效应' },
      ],
    },
    { id: 'b', name: 'B', enabled: false, entries: [{ source: 'effect', target: '错误' }] },
  ]);
  const protectedTerms = protectTerms('treatment effect and effect; Effect {{v0}}', entries);
  assert.equal(protectedTerms.restore(protectedTerms.text), '处理效应 and 效应; Effect {{v0}}');
  assert.throws(() => protectedTerms.restore('missing'), /required glossary/);
});
test('literal regex terms and target dollar sequences remain literal', () => {
  const protectedTerms = protectTerms('C++ PMRGLOSSARY0END', [{ source: 'C++', target: '$&术语' }]);
  assert.equal(protectedTerms.restore(protectedTerms.text), '$&术语 PMRGLOSSARY0END');
  assert.equal(
    validGlossaries([{ id: 'a', name: 'a', enabled: true, entries: [{ source: '', target: '' }] }]),
    true,
  );
  assert.equal(
    validGlossaries([{ id: 'a', name: 'a', enabled: true, entries: [{ source: 12, target: '' }] }]),
    false,
  );
});

test('both math kernel translator boundaries restore literal terms and reject lost tokens', async () => {
  const { execFileSync } = await import('node:child_process');
  execFileSync(
    'python3',
    [
      '-c',
      `
import ast, json, re, sys, types
source = open('electron/kernel-worker.py').read()
node = next(node for node in ast.parse(source).body if isinstance(node, ast.FunctionDef) and node.name == 'install_glossary')
namespace = {'json': json, 're': re}
exec(compile(ast.Module(body=[node], type_ignores=[]), '<glossary>', 'exec'), namespace)
for kind, module_name in [('pdf_math_fast', 'pdf2zh.translator'), ('pdf_math_precise', 'pdf2zh_next.translator.base_translator')]:
    class BaseTranslator:
        def translate(self, text, ignore_cache=False):
            return text
        def llm_translate(self, text, ignore_cache=False):
            return json.dumps({'translation': text})
    module = types.ModuleType(module_name)
    module.BaseTranslator = BaseTranslator
    sys.modules[module_name] = module
    namespace['install_glossary'](kind, [{'source': 'treatment effect', 'target': '处理"效应'}])
    translator = BaseTranslator()
    assert translator.translate('treatment effect {v0}') == '处理"效应 {v0}'
    assert json.loads(translator.llm_translate('treatment effect'))['translation'] == '处理"效应'
`,
    ],
    { cwd: process.cwd() },
  );
});

test('glossary preferences persist and load without exposing mutable state', async () => {
  const { createReaderPreferences } = await import('../electron/preferences.mjs');
  const { mkdtemp, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const directory = await mkdtemp(join(tmpdir(), 'pmr-glossary-'));
  try {
    const preferences = await createReaderPreferences(join(directory, 'preferences.json'));
    const libraries = [
      { id: 'a', name: 'Research', enabled: true, entries: [{ source: 'effect', target: '效应' }] },
    ];
    await preferences.save({ glossaries: libraries });
    libraries[0].entries[0].target = 'changed';
    assert.equal(preferences.load().glossaries[0].entries[0].target, '效应');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('Inspector API enforces terms and changing target invalidates paragraph cache', async () => {
  const { startServer } = await import('./index.mjs');
  const { mkdtemp, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const directory = await mkdtemp(join(tmpdir(), 'pmr-glossary-api-'));
  const backend = await startServer({
    port: 0,
    development: false,
    cacheDir: directory,
    providerFetch: async (url, options) => {
      if (url.endsWith('/check')) return Response.json({ status: 'ok' });
      return Response.json({
        content: JSON.parse(options.body).text.match(/PMRGLOSSARY\d+END/)[0],
      });
    },
  });
  try {
    const request = async (target) =>
      (
        await fetch(backend.origin + '/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: 'treatment effect',
            language: 'Simplified Chinese',
            glossary: [{ source: 'treatment effect', target }],
          }),
        })
      ).json();
    assert.equal((await request('处理效应')).translation, '处理效应');
    const changed = await request('治疗效果');
    assert.equal(changed.translation, '治疗效果');
    assert.notEqual(changed.cached, true);
  } finally {
    await backend.close();
    await rm(directory, { recursive: true, force: true });
  }
});
