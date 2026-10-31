# Video Studio timing contract

Verified against official documentation on 2026-11-01:

- Veo 3.1: 4, 6 or 8 seconds. Reference images and 1080p require 8 seconds. Studio's subsequent scenes attach continuity references and therefore also require 8 seconds. Existing stable `*-generate-001` provider model IDs are retained.
- Gemini Omni Flash: integer duration from 3 through 10 seconds. Resolutions: 360p, 720p, 1080p (upscaled), 4K (upscaled). Direct generation remains disabled until the configured provider supports it; these settings currently control exported prompts.
- Scene `lines[].durationSeconds` overrides the project default (the default is for new scenes). Blank scenes are silent by default; speech can be enabled explicitly and requires text. Global speech-off overrides all scenes. Dialogue windows and timeline `sceneIndex` use scene-local seconds, never cumulative video seconds.
- Unscoped legacy timeline entries retain their former meaning (apply to every scene); the editor expands them to scoped copies on restore. Scene deletion removes its timing entries.
- Opening a saved project is read-only: return the original normalized form plus every stored prompt and refreshed reference links. Never call a directing model on reopen. Legacy paid jobs fall back to their exact submitted segment prompts. Editing a restored project creates a new project ID rather than overwriting the original.

Sources:

- https://ai.google.dev/gemini-api/docs/veo
- https://ai.google.dev/gemini-api/docs/omni
- https://github.com/google-gemini/gemini-skills/blob/main/skills/gemini-omni-flash-api/scripts/video/generate_video.py (`parse_and_validate_duration`)
- https://docs.avalai.org/en/providers/gemini
