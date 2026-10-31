import test from 'node:test';
import assert from 'node:assert/strict';
import { videoDurations, videoSeconds, scopedTimeline, changeSceneDuration } from '../src/video-scenes.ts';

test('engine durations are distinct and scenes sum without speech', () => {
  assert.deepEqual(videoDurations('veo_3_1'), [4, 6, 8]);
  assert.deepEqual(videoDurations('gemini_omni_flash'), [3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(videoSeconds([{ text: '', durationSeconds: 10 }, { text: '', durationSeconds: 5 }], 8), 15);
});
test('legacy global beats migrate once, scoped beats remain isolated', () => {
  const migrated = scopedTimeline([{ id: 'old', startSecond: 0, endSecond: 8 }], 2);
  assert.deepEqual(migrated.map(row => row.sceneIndex), [0, 1]);
  assert.deepEqual(scopedTimeline(migrated, 2), migrated);
  assert.equal(scopedTimeline(migrated, 1).length, 1);
});
test('duration changes keep dialogue in the current scene', () => {
  const changed = changeSceneDuration({ dialogueStartSecond: 8, dialogueEndSecond: 10 }, 4);
  assert.equal(changed.dialogueStartSecond, 3);
  assert.equal(changed.dialogueEndSecond, 4);
});
