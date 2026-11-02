# News image render direction

The renderer, not the editorial/news-writing models, owns these rules. `render_prompt` is shared by single news stories, feed posts and series; prompt-only exports use the same compiler.

## Regression found (2026-11-02)

- Magazine-cover and glass-card style still existed in the generic style prompt, but news templates emphasized prohibitions and old masthead coordinates. Those coordinates leaked into floating-profile and no-profile modes, narrowing the usable canvas unnecessarily.
- The floating-profile change (`587b6eb`) replaced the three scattered watermarks with an identity instruction that initially forbade them. Subsequent changes restored a vague watermark instruction and a deterministic bottom-right signature, not the original distributed design.
- Template-level Gemini coordinates coexisted with worker-level obsolete GPT dimensions, despite Flare now receiving native story/post sizes.

## Current modular contract

- News art direction: magazine-cover hierarchy, topic-specific composition, purposeful glass surfaces, visual depth, restrained brand accents, no mandatory yellow headline. Cards require real active content; empty/video areas and reference fidelity remain locked.
- Identity and watermark are separate: system header reserves its actual safe area; floating/no-profile uses the full canvas. News has three low-contrast scattered Latin media-name watermarks in every identity mode, not an extra fixed corner signature. Stickers remain excluded.
- Geometry lives only in the active worker module, not the editable news templates. Flare uses 1152×2048 / 1280×1600; safe text starts at 363 / 403 respectively for a 340px masthead at the editorial target size.
- Typography explicitly checks Persian glyph shape, joins, dot count/placement, spacing and sharp edges without modifying approved copy. This is a model instruction, not OCR validation or a guarantee that the image model cannot misspell.
- No model change, content rewrite, automatic repair render, image resize or pasted floating-profile badge is introduced.

Regression coverage includes story/post × single/cover/continuation × all three identity modes, native geometry, exact reference preservation, title-only behavior and absence of a fourth fixed watermark. Saved output images are not modified; a new generation receives the corrected prompt.
