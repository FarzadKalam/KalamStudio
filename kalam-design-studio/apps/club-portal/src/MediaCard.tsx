import { useEffect, useRef, useState } from "react";
import "./media.css";
export type MediaInfo = { id: string; filename: string; contentType: string; bytes: number; status: string; url?: string };
export type MediaLoader = (id: string) => Promise<MediaInfo>;
const size = (bytes: number) => new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 }).format(bytes / (bytes >= 1048576 ? 1048576 : 1024)) + (bytes >= 1048576 ? " مگابایت" : " کیلوبایت");

/** Original files are retained; the card only crops their presentation. */
export default function MediaCard({ id, load, file, caption, onCaption, onRemove, progress, error, disabled }: {
  id?: string; load?: MediaLoader; file?: File; caption?: string; onCaption?: (value: string) => void; onRemove?: () => void; progress?: number; error?: string; disabled?: boolean;
}) {
  const [info, setInfo] = useState<MediaInfo>(); const [notice, setNotice] = useState(""); const [loaded, setLoaded] = useState(false); const [open, setOpen] = useState(false); const [retry, setRetry] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    let active = true; let timer: ReturnType<typeof setTimeout> | undefined; let objectUrl = "";
    setInfo(undefined); setNotice(""); setLoaded(false);
    if (file) { objectUrl = URL.createObjectURL(file); setInfo({ id: "local", filename: file.name, bytes: file.size, contentType: file.type, status: "available", url: objectUrl }); }
    else if (id && load) {
      const fetchInfo = async () => { try { const next = await load(id); if (!active) return; setInfo(next); if (next.status === "quarantined") timer = setTimeout(fetchInfo, 5000); } catch (e) { if (active) setNotice(e instanceof Error ? e.message : "دریافت فایل ناموفق بود."); } }; void fetchInfo();
    }
    return () => { active = false; clearTimeout(timer); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [file, id, load, retry]);
  useEffect(() => {
    if (!open) return;
    dialog.current?.showModal(); const previous = document.activeElement as HTMLElement | null; const overflow = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { dialog.current?.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, [open]);
  const type = info?.contentType.startsWith("image/") && info.contentType !== "image/svg+xml" ? "image" : info?.contentType.startsWith("video/") ? "video" : info?.contentType.startsWith("audio/") ? "audio" : "file";
  const label = { image: "تصویر", video: "ویدیو", audio: "صدا", file: "فایل" }[type];
  const ready = info?.status === "available" && info.url;
  return <div className="club-media-card">
    <div className="club-media-top"><button className="club-media-preview" type="button" disabled={!ready} aria-label={`باز کردن ${info?.filename || label}`} onClick={() => setOpen(true)}>
      {ready && type === "image" ? <img src={info.url} alt={info.filename} loading="lazy" onLoad={() => setLoaded(true)} onError={() => { setNotice("پیش‌نمایش دریافت نشد."); setLoaded(true); }} /> : ready && type === "video" ? <video src={info.url} preload="metadata" muted playsInline onLoadedMetadata={() => setLoaded(true)} /> : <svg viewBox="0 0 48 48" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">{type === "audio" ? <><path d="M22 34V10l18-4v25M22 13l18-4" /><ellipse cx="15" cy="35" rx="7" ry="5" /><ellipse cx="33" cy="32" rx="7" ry="5" /></> : <><path d="M10 4h18l10 10v30H10zM28 4v12h10M16 25h16M16 32h12" /></>}</svg>}
      {(!info || (ready && type === "image" && !loaded)) && !notice && <span className="club-media-spinner" />}{type === "video" && <span className="club-media-play">▶</span>}{type === "audio" && <span className="club-media-play">▶</span>}
    </button><div className="club-media-info"><b title={info?.filename || file?.name}>{info?.filename || file?.name || "در حال دریافت فایل…"}</b><small>{label}{info && ` · ${size(info.bytes)}`}</small>{info?.status === "quarantined" && <small role="status">در حال بررسی امنیتی…</small>}{info && !["available", "quarantined"].includes(info.status) && <small>فایل قابل نمایش نیست.</small>}{progress !== undefined && <><progress max="100" value={progress} aria-label="پیشرفت بارگذاری" /><small>{new Intl.NumberFormat("fa-IR").format(progress)}٪ {progress === 100 ? "بارگذاری شد" : "در حال ارسال"}</small></>}{(error || notice) && <small className="club-media-error" role="alert">{error || notice}{!file && <button type="button" onClick={() => { setRetry(r => r + 1); }}>تلاش دوباره</button>}</small>}</div>{onRemove && <button className="club-media-remove" type="button" aria-label="حذف فایل انتخاب‌شده" disabled={disabled} onClick={onRemove}>×</button>}</div>
    {onCaption ? <label className="club-media-caption">توضیح این {label} (اختیاری)<textarea rows={2} maxLength={4000} value={caption || ""} disabled={disabled} onChange={e => onCaption(e.target.value)} placeholder="توضیح مخصوص همین فایل…" /></label> : caption && <p className="club-media-caption-text">{caption}</p>}
    {open && info && <dialog ref={dialog} className="club-media-viewer" aria-label={info.filename} onCancel={event => { event.preventDefault(); setOpen(false); }}><header><b>{info.filename}</b><button type="button" aria-label="بستن پیش‌نمایش" onClick={() => setOpen(false)}>×</button></header><div className="club-media-stage">{type === "image" ? <img src={info.url} alt={caption || info.filename} /> : type === "video" ? <video src={info.url} controls playsInline autoPlay preload="metadata" /> : type === "audio" ? <audio src={info.url} controls autoPlay preload="metadata" /> : <p>برای مشاهده این فایل، نسخه اصلی را دریافت کنید.</p>}</div>{caption && <p>{caption}</p>}<a href={info.url} target="_blank" rel="noopener noreferrer" download={file ? info.filename : undefined}>باز کردن / دریافت فایل اصلی با کیفیت کامل</a></dialog>}
  </div>;
}
