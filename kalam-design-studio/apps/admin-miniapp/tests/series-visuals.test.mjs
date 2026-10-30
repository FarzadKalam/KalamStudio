import test from 'node:test';
import assert from 'node:assert/strict';
import { slideVisualContract, slideNewsContract, seedNextSlide, slideVisualIssue } from '../src/series-visuals.ts';

const empty = () => ({ title: '', subtitle: '', body: '', footer: '', files: [], monitorFiles: [] });
test('general reference cannot satisfy a dedicated monitor requirement', () => {
  const slide = { ...empty(), imageMode: 'studio', studioMonitorMode: 'images', studioMonitorImageMode: 'preserve' };
  assert.notEqual(slideVisualIssue(slide, 1, 0), '');
  assert.equal(slideVisualIssue(slide, 0, 1), '');
  assert.equal(slideVisualIssue({ ...slide, studioMonitorMode: 'blank' }, 1, 0), '');
});
test('non-Studio slide discards stale Studio and presenter settings', () => {
  for (const imageMode of ['generate', 'preserve', 'reference', 'none']) {
    const contract = slideVisualContract({ ...empty(), imageMode, presenterIds: ['tara'], studioMonitorMode: 'images', studioLocationId: 'studio_main' });
    assert.equal(contract.studio, undefined);
    assert.deepEqual(contract.image.presenterIds, []);
    assert.deepEqual(contract.image.referenceSelection.presenters, {});
  }
});
test('Studio without a presenter stays without one; blank monitor is not inferred from files', () => {
  const contract = slideVisualContract({ ...empty(), imageMode: 'studio', presenterIds: [], files: ['map.jpg'], studioMonitorMode: 'blank' });
  assert.deepEqual(contract.studio.presenterIds, []);
  assert.equal(contract.studio.monitor.mode, 'blank');
  assert.equal(contract.studio.location.mode, 'catalog');
});
test('monitor and location consume only this slide and clean inactive fields', () => {
  const contract = slideVisualContract({ ...empty(), imageMode: 'studio', studioLocationMode: 'generated_prompt', studioLocationPrompt: 'metro station', studioLocationAssetIds: ['old'], studioMonitorMode: 'images', studioMonitorImageMode: 'preserve', studioMonitorBrief: 'map', studioMonitorImageCount: 2 });
  assert.deepEqual(contract.studio.location.assetIds, []);
  assert.equal(contract.studio.location.prompt, 'metro station');
  assert.equal(contract.studio.monitor.imageMode, 'preserve');
  assert.equal(contract.studio.monitor.imageCount, 2);
});
test('approval seeds visual identity once, preserves next copy and never copies previous content', () => {
  const previous = { ...empty(), imageMode: 'studio', imageEngine: 'flare', presenterIds: ['tara'], studioLocationId: 'studio_main', studioMonitorMode: 'images', studioMonitorText: 'OLD', studioMonitorBrief: 'OLD MAP', imagePrompt: 'OLD SUBJECT', additionalInstructions: 'OLD DIRECTION', files: ['old.jpg'], monitorFiles: ['map.jpg'] };
  const next = { ...empty(), title: 'NEXT', imagePrompt: 'NEXT SUBJECT', additionalInstructions: 'NEXT DIRECTION' };
  const seeded = seedNextSlide(previous, next);
  assert.equal(seeded.imageMode, 'studio');
  assert.equal(seeded.title, 'NEXT');
  assert.equal(seeded.imagePrompt, 'NEXT SUBJECT');
  assert.equal(seeded.additionalInstructions, 'NEXT DIRECTION');
  assert.equal(seeded.studioMonitorBrief, undefined);
  assert.deepEqual(seeded.files, []);
  assert.deepEqual(seeded.monitorFiles, []);
  assert.notEqual(seeded.presenterIds, previous.presenterIds);
  const edited = { ...seeded, imageMode: 'generate', presenterIds: [] };
  assert.equal(seedNextSlide(previous, edited), edited);
});
test('already edited next slide is never overwritten on approval', () => {
  const next = { ...empty(), imageMode: 'none', visualSettingsInitialized: true };
  assert.equal(seedNextSlide({ ...empty(), imageMode: 'studio' }, next), next);
});
test('news geometry and video behavior are slide-scoped', () => {
  assert.deepEqual(slideNewsContract({ ...empty(), imageMode: 'generate', newsPhotoFrame: 'square', titleLayout: 'bottom' }), { outputKind: 'title_photo', photoFrame: 'square', layout: 'bottom', videoOverlay: false, videoFrame: 'landscape', videoBackgroundBlur: false, siteLinkPlaceholder: false });
  assert.equal(slideNewsContract({ ...empty(), imageMode: 'none' }).outputKind, 'title_only');
});
