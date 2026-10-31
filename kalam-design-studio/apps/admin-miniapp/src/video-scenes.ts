import type { VideoGenerationModel, VideoLine, VideoTimelineBeat } from "./api";

export const videoDurations = (model: VideoGenerationModel): number[] => model === "gemini_omni_flash" ? [3, 4, 5, 6, 7, 8, 9, 10] : [4, 6, 8];
export const sceneDuration = (line: Pick<VideoLine, "durationSeconds">, fallback: number) => line.durationSeconds ?? fallback;
export const videoSeconds = (lines: VideoLine[], fallback: number) => lines.reduce((total, line) => total + sceneDuration(line, fallback), 0);
export function scopedTimeline(beats: VideoTimelineBeat[], count: number): VideoTimelineBeat[] {
  return beats.flatMap((beat) => beat.sceneIndex == null
    ? Array.from({ length: count }, (_, sceneIndex) => ({ ...beat, id: `${beat.id}-${sceneIndex}`, sceneIndex }))
    : beat.sceneIndex < count ? [beat] : []);
}
export function changeSceneDuration(line: VideoLine, durationSeconds: number): VideoLine {
  const start = Math.min(line.dialogueStartSecond ?? 0, durationSeconds - 1);
  return { ...line, durationSeconds, dialogueStartSecond: start, dialogueEndSecond: Math.max(start + 1, Math.min(line.dialogueEndSecond ?? durationSeconds, durationSeconds)) };
}
