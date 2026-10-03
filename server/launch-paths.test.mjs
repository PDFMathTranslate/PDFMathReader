import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {pdfLaunchPaths} from '../electron/documents.mjs';
test('external launch paths accept spaced filenames, Unicode, URLs and relative paths without interpreting flags',()=>{assert.deepEqual(pdfLaunchPaths(['--background','/tmp/A paper 中文.pdf','file:///tmp/A%20paper%20%E4%B8%AD%E6%96%87.pdf','attachment.PDF','--file=secret.pdf','/tmp/not.txt'],'/tmp'),['/tmp/A paper 中文.pdf',resolve('/tmp','attachment.PDF')]);assert.deepEqual(pdfLaunchPaths(['file://remote/paper.pdf','file:///tmp/bad%xx.pdf'],'/tmp'),process.platform==='win32'?[fileURLToPath('file://remote/paper.pdf')]:[]);});
