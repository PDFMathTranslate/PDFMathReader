import test from 'node:test';
import assert from 'node:assert/strict';
import {
  topicSentenceParagraphs,
  topicSentenceRanges,
} from '../../src/features/translation/topic-sentences.mjs';

const firstSentence =
  'Although many scholars believe the issue is simple, careful evidence shows that the mechanism depends on context and institutions.';
const firstRemainder =
  'Later analysis compares institutions across regions and measures long-term outcomes. It tests whether the relationship remains visible after competing explanations are considered. Historical conditions, administrative capacity, local incentives, and public expectations can change the observed pattern. Additional evidence from surveys, archives, and repeated observations supports the same interpretation.';
const secondSentence =
  'A second group of readers may describe the pattern as inevitable, yet a closer comparison reveals that institutional choices matter.';
const secondRemainder =
  'Subsequent evidence draws on interviews, archival records, and repeated observations. It compares cases over time and distinguishes durable mechanisms from temporary responses. The broader analysis considers incentives, legal constraints, social expectations, and capacity. It tests alternative explanations against independent sources and related outcomes.';

function fixtureRuns() {
  const split = firstSentence.indexOf('careful');
  return [
    { text: firstSentence.slice(0, split), x: 48, y: 0, width: 220, height: 12 },
    {
      text: firstSentence.slice(split) + ' ' + firstRemainder,
      x: 48,
      y: 16,
      width: 520,
      height: 12,
    },
    {
      text: secondSentence + ' ' + secondRemainder,
      x: 48,
      y: 160,
      width: 520,
      height: 12,
    },
  ];
}

test('groups eligible long paragraphs and exposes their first sentence', () => {
  const runs = fixtureRuns();
  const boxes = [
    { id: 'first', x: 0, y: 0, width: 600, height: 60 },
    { id: 'second', x: 0, y: 140, width: 600, height: 60 },
  ];
  const paragraphs = topicSentenceParagraphs(runs, boxes);

  assert.deepEqual(
    paragraphs.map(({ text, firstSentence }) => ({ text, firstSentence })),
    [
      {
        text: firstSentence + ' ' + firstRemainder,
        firstSentence,
      },
      {
        text: secondSentence + ' ' + secondRemainder,
        firstSentence: secondSentence,
      },
    ],
  );
  assert.deepEqual(
    paragraphs[0].ranges.map(({ index, start, end }) => ({ index, start, end })),
    [
      { index: 0, start: 0, end: firstSentence.slice(0, splitAtCareful()).length },
      {
        index: 1,
        start: 0,
        end: 'careful evidence shows that the mechanism depends on context and institutions.'
          .length,
      },
    ],
  );
  assert.ok(paragraphs.every((paragraph) => paragraph.ranges.length > 0));
});

function splitAtCareful() {
  return firstSentence.indexOf('careful');
}

test('topicSentenceRanges remains the flattened legacy representation', () => {
  const runs = fixtureRuns();
  const boxes = [
    { id: 'first', x: 0, y: 0, width: 600, height: 60 },
    { id: 'second', x: 0, y: 140, width: 600, height: 60 },
  ];
  const paragraphs = topicSentenceParagraphs(runs, boxes);
  assert.deepEqual(
    topicSentenceRanges(runs, boxes),
    paragraphs.flatMap(({ ranges }) => ranges),
  );
});

test('ineligible geometry groups do not produce topic paragraphs', () => {
  const runs = fixtureRuns();
  const boxes = [
    { id: 'first', x: 0, y: 0, width: 600, height: 60 },
    { id: 'second', x: 0, y: 140, width: 600, height: 60, eligible: false },
  ];
  const paragraphs = topicSentenceParagraphs(runs, boxes);
  assert.equal(paragraphs.length, 1);
  assert.equal(paragraphs[0].firstSentence, firstSentence);
});
