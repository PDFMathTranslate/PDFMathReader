import assert from 'node:assert/strict';
import test from 'node:test';
import {
  detectDoiRanges,
  detectEmails,
  detectLinks,
  linkLabel,
} from '../../shared/reader/link-detection.mjs';
import { menuLabel } from '../../shared/i18n/menu.mjs';

test('detects a link at the end of a selected reference', () => {
  const selection =
    'Fan, W., & Yeung, K. H. (2015). Similarity between community structures of different online social networks\n' +
    'and its impact on underlying community detection. Communications in Nonlinear Science and Nu-\n' +
    'merical Simulation, 20(3), 1015–1025. https://doi.org/10.1016/j.cnsns.2014.07.002';
  assert.deepEqual(detectLinks(selection), ['https://doi.org/10.1016/j.cnsns.2014.07.002']);
});

test('rejoins URLs that the PDF text layer wrapped across lines', () => {
  assert.deepEqual(detectLinks('15649–15653. https://doi.\norg/10.1073/pnas.0803685105\nCui, H.'), [
    'https://doi.org/10.1073/pnas.0803685105',
  ]);
  assert.deepEqual(detectLinks('326–343. https://doi.org/10.1017/\nS0003055413000014\nKing, G.'), [
    'https://doi.org/10.1017/S0003055413000014',
  ]);
  assert.deepEqual(detectLinks('Article e42671. https://\ndoi.org/10.2196/42671'), [
    'https://doi.org/10.2196/42671',
  ]);
  assert.deepEqual(detectLinks('https://doi.\norg/10.1111/j.1467-9523.2007.\n00430.x'), [
    'https://doi.org/10.1111/j.1467-9523.2007.00430.x',
  ]);
});

test('does not join a following sentence onto a URL', () => {
  assert.deepEqual(detectLinks('See https://example.org/data.\nThe next paragraph begins.'), [
    'https://example.org/data',
  ]);
});

test('trims surrounding punctuation but keeps balanced parentheses', () => {
  assert.deepEqual(detectLinks('(see https://example.org/a), or www.example.com/b.'), [
    'https://example.org/a',
    'https://www.example.com/b',
  ]);
  assert.deepEqual(detectLinks('https://en.wikipedia.org/wiki/Foo_(bar).'), [
    'https://en.wikipedia.org/wiki/Foo_(bar)',
  ]);
  assert.deepEqual(detectLinks('链接：https://example.org/x，见上文。'), ['https://example.org/x']);
});

test('turns DOI identifiers into resolver links and ignores non-web text', () => {
  assert.deepEqual(detectLinks('doi: 10.1126/sciadv.abl8198.'), [
    'https://doi.org/10.1126/sciadv.abl8198',
  ]);
  assert.deepEqual(
    detectLinks('Modern risk management: A history. javascript:alert(1) file:///etc'),
    [],
  );
  assert.deepEqual(detectLinks(''), []);
  assert.deepEqual(detectLinks(null), []);
});

test('deduplicates links and labels them compactly', () => {
  assert.deepEqual(detectLinks('https://a.org/x and https://a.org/x'), ['https://a.org/x']);
  assert.equal(linkLabel('https://www.example.org/'), 'example.org');
  assert.equal(linkLabel(`https://example.org/${'a'.repeat(80)}`).length, 48);
  assert.equal(menuLabel('Open Link', 'zh-CN'), '打开链接');
});

test('detects bare DOIs and deduplicates their resolver URLs', () => {
  const doi = '10.1002/9781118783665.ieicc0156';
  assert.deepEqual(detectLinks(`${doi}. https://doi.org/${doi}`), [`https://doi.org/${doi}`]);
  assert.deepEqual(detectLinks('10.1002/\n9781118783665.ieicc0156'), [`https://doi.org/${doi}`]);
});

test('DOI link ranges retain source offsets across PDF runs and punctuation', () => {
  for (const prefix of ['', 'https://doi.org/', 'doi: ']) {
    const text = `See (${prefix}10.1002/\n9781118783665.ieicc0156). Next reference.`;
    const [link] = detectDoiRanges(text);
    assert.equal(link.url, 'https://doi.org/10.1002/9781118783665.ieicc0156');
    assert.equal(text.slice(link.start, link.end), `${prefix}10.1002/\n9781118783665.ieicc0156`);
  }
  assert.deepEqual(detectDoiRanges('10.123/nope 10.12345/ 2026/10.1002'), []);
  assert.equal(
    detectDoiRanges('10.1002/first\nNext reference.')[0].url,
    'https://doi.org/10.1002/first',
  );
  assert.deepEqual(
    detectDoiRanges('https://doi.org/10.1002/first.\n10.1002/second').map((link) => link.url),
    ['https://doi.org/10.1002/first', 'https://doi.org/10.1002/second'],
  );
});

test('detects email addresses in a selection', () => {
  assert.deepEqual(
    detectEmails('Corresponding author: Jane.Doe+pdf@Example.EDU.cn; cc mailto:lab@uni.org.'),
    ['Jane.Doe+pdf@example.edu.cn', 'lab@uni.org'],
  );
  assert.deepEqual(detectEmails('邮箱：zhang_san@pku.edu.cn。'), ['zhang_san@pku.edu.cn']);
  assert.deepEqual(detectEmails('a@b.org and a@b.org'), ['a@b.org']);
});

test('ignores at-signs that are not email addresses', () => {
  assert.deepEqual(detectEmails('https://medium.com/@writer and @handle at 5 @ 10.2'), []);
  assert.deepEqual(detectEmails('name@localhost or x@y.c'), []);
  assert.deepEqual(detectEmails(null), []);
  assert.equal(menuLabel('Copy Email', 'zh-CN'), '拷贝电子邮件地址');
});
