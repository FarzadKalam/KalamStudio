import type { VideoGenerationModel, VideoLine, VideoTimelineBeat } from "./api";
import { changeSceneDuration, sceneDuration, scopedTimeline, videoDurations } from "./video-scenes";

type Props = { lines: VideoLine[]; timeline: VideoTimelineBeat[]; defaultDuration: number; model: VideoGenerationModel; speechEnabled: boolean; presenterIds: string[]; presenters: Record<string, string>; shots: Record<VideoLine["shot"], string>; onLines: (lines: VideoLine[]) => void; onTimeline: (beats: VideoTimelineBeat[]) => void; onSpeech: (enabled: boolean) => void };
export function VideoSceneEditor(p: Props) {
  const beats = scopedTimeline(p.timeline, p.lines.length);
  const update = (id: string, changes: Partial<VideoLine>) => p.onLines(p.lines.map(line => line.id === id ? { ...line, ...changes } : line));
  const beatUpdate = (id: string, changes: Partial<VideoTimelineBeat>) => p.onTimeline(beats.map(beat => beat.id === id ? { ...beat, ...changes } : beat));
  function resize(count: number) {
    const lines = p.lines.slice(0, count);
    while (lines.length < count) lines.push({ id: crypto.randomUUID(), presenterId: p.presenterIds[0], text: "", shot: "medium", durationSeconds: p.defaultDuration, speechEnabled: false });
    p.onLines(lines); p.onTimeline(scopedTimeline(p.timeline, count));
  }
  return <section className="video-form-card video-lines video-scene-editor"><h3>سکانس‌ها و زمان‌بندی</h3>
    <label>تعداد سکانس‌ها<select value={p.lines.length} onChange={e => resize(Number(e.target.value))}>{Array.from({ length: 20 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}</select></label>
    <label><input type="checkbox" checked={p.speechEnabled} onChange={e => p.onSpeech(e.target.checked)} /> امکان گفتار در پروژه</label>
    <p className="hint">هر سکانس مستقل است؛ بدون گفتار هم می‌توانید چند سکانس بسازید. زمان‌ها نسبت به ابتدای همان سکانس هستند.</p>
    {p.lines.map((line, index) => { const duration = sceneDuration(line, p.defaultDuration); const speaking = line.speechEnabled ?? Boolean(line.text.trim()); return <article key={line.id}>
      <h4>سکانس {index + 1} · {duration} ثانیه</h4>
      <label>مدت سکانس<select value={duration} onChange={e => { const value = Number(e.target.value); update(line.id, changeSceneDuration(line, value)); p.onTimeline(beats.map(beat => beat.sceneIndex === index ? { ...beat, startSecond: Math.min(beat.startSecond, value - 1), endSecond: Math.max(Math.min(beat.startSecond, value - 1) + 1, Math.min(beat.endSecond, value)) } : beat)); }}>{videoDurations(p.model).map(d => <option key={d} value={d}>{d} ثانیه</option>)}</select></label>
      <label>مجری<select value={line.presenterId} onChange={e => update(line.id, { presenterId: e.target.value })}>{p.presenterIds.map(id => <option key={id} value={id}>{p.presenters[id]}</option>)}</select></label>
      <label>قاب / حالت چهره<select value={line.shot} onChange={e => update(line.id, { shot: e.target.value as VideoLine["shot"] })}>{Object.entries(p.shots).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      <label>اتفاق و حرکت این سکانس<textarea rows={3} maxLength={1200} value={line.description ?? ""} onChange={e => update(line.id, { description: e.target.value })} /></label>
      {p.speechEnabled && <><label><input type="checkbox" checked={speaking} onChange={e => update(line.id, { speechEnabled: e.target.checked })} /> گفتار این سکانس فعال باشد</label>{speaking && <>
        <label>متن دقیق گفتار (الزامی)<textarea maxLength={420} value={line.text} onChange={e => update(line.id, { text: e.target.value })} /></label>
        <label>شروع گفتار (ثانیه)<input type="number" min={0} max={duration - 1} value={line.dialogueStartSecond ?? 0} onChange={e => update(line.id, { dialogueStartSecond: Number(e.target.value) })} /></label>
        <label>پایان گفتار (ثانیه)<input type="number" min={1} max={duration} value={line.dialogueEndSecond ?? duration} onChange={e => update(line.id, { dialogueEndSecond: Number(e.target.value) })} /></label>
      </>}</>}
      <div className="video-timeline">{beats.filter(beat => beat.sceneIndex === index).map((beat, n) => <article key={beat.id}>
        <b>بازهٔ حرکت / متن {n + 1}</b>
        <label>از ثانیه<input type="number" min={0} max={duration - 1} value={beat.startSecond} onChange={e => beatUpdate(beat.id, { startSecond: Number(e.target.value) })} /></label>
        <label>تا ثانیه<input type="number" min={1} max={duration} value={beat.endSecond} onChange={e => beatUpdate(beat.id, { endSecond: Number(e.target.value) })} /></label>
        <label>کارگردانی بازه<textarea maxLength={600} value={beat.description} onChange={e => beatUpdate(beat.id, { description: e.target.value })} /></label>
        <label>متن دقیق موشن‌گرافی (اختیاری)<textarea maxLength={120} value={beat.motionText ?? ""} onChange={e => beatUpdate(beat.id, { motionText: e.target.value })} /></label>
        <label>نوع متن<select value={beat.motionStyle ?? "headline"} onChange={e => beatUpdate(beat.id, { motionStyle: e.target.value as VideoTimelineBeat["motionStyle"] })}><option value="headline">تیتر</option><option value="lower_third">نوار نام</option><option value="stat">عدد / داده</option><option value="label">برچسب</option></select></label>
        <label>جای متن<select value={beat.motionPosition ?? "bottom"} onChange={e => beatUpdate(beat.id, { motionPosition: e.target.value as VideoTimelineBeat["motionPosition"] })}>{[["top","بالا"],["center","وسط"],["bottom","پایین"],["left","چپ"],["right","راست"]].map(([id,name]) => <option key={id} value={id}>{name}</option>)}</select></label>
        <label>ورود متن<select value={beat.motionAnimation ?? "fade"} onChange={e => beatUpdate(beat.id, { motionAnimation: e.target.value as VideoTimelineBeat["motionAnimation"] })}>{[["fade","محو"],["slide_up","از پایین"],["slide_left","از کنار"],["type_on","تایپ"]].map(([id,name]) => <option key={id} value={id}>{name}</option>)}</select></label>
        <button type="button" className="danger-link" onClick={() => p.onTimeline(beats.filter(row => row.id !== beat.id))}>حذف بازه</button>
      </article>)}</div>
      <button className="secondary" type="button" disabled={beats.filter(beat => beat.sceneIndex === index).length >= duration} onClick={() => p.onTimeline([...beats, { id: crypto.randomUUID(), sceneIndex: index, startSecond: 0, endSecond: duration, description: "" }])}>+ بازهٔ حرکت / متن این سکانس</button>
    </article>; })}
  </section>;
}
