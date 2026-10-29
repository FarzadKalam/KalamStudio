import MediaCard from "./MediaCard";
import { useCallback, useEffect, useRef, useState, FormEvent, ReactNode } from "react";
import { Member, Submission } from "./api";
import { ActivityEvent, engagementApi, PointAward, StoryCampaign } from "./engagementApi";
import { fa, formatDate } from "./format";
import { CONTENT_CATEGORIES } from "./clubContent";
import ClubIcon from "./ClubIcon";
import { AttachmentPill, UploadProgressView } from "./UploadViews";
import { uploadFiles, UploadProgress } from "./uploads";

export function useEngagement(enabled: boolean) {
  const [points, setPoints] = useState<PointAward[]>([]);
  const [campaigns, setCampaigns] = useState<StoryCampaign[]>([]);
  const [pointsDismissed, setPointsDismissed] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);
  const refresh = useCallback(async () => {
    if (!enabled) return;
    const results = await Promise.allSettled([engagementApi.pending(), engagementApi.campaigns()]);
    if (results[0].status === "fulfilled") setPoints(results[0].value.points);
    if (results[1].status === "fulfilled") setCampaigns(results[1].value.campaigns);
  }, [enabled]);
  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 45000);
    const focus = () => void refresh(); window.addEventListener("focus", focus);
    return () => { clearInterval(timer); window.removeEventListener("focus", focus); };
  }, [refresh]);
  return { points, campaigns, pointsDismissed, setPointsDismissed, giftOpen, setGiftOpen, refresh };
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current; const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow; document.body.style.overflow = "hidden";
    dialog?.showModal();
    return () => { dialog?.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  return <dialog ref={ref} className="engagement-modal" aria-label={title} onCancel={event => { event.preventDefault(); onClose(); }}><header><h2>{title}</h2><button type="button" className="modal-close" aria-label="بستن" onClick={onClose}>×</button></header>{children}</dialog>;
}

export function SubmissionDetails({ item }: { item: Submission }) {
  return <div className="submission-detail">
    <p><b>{item.campaign ? "اسکرین‌شات استوری" : CONTENT_CATEGORIES.find(c => c.id === item.contentCategory)?.label || "محتوای ارسالی"}</b> · {({ pending: "در انتظار بررسی", approved: "تأیید شده", rejected: "تأیید نشده" } as Record<string, string>)[item.status]}</p>
    <dl><div><dt>زمان ارسال</dt><dd>{formatDate(item.createdAt)}</dd></div><div><dt>زمان بررسی</dt><dd>{formatDate(item.reviewedAt)}</dd></div><div><dt>بررسی‌کننده</dt><dd>{item.reviewedBy || "—"}</dd></div><div><dt>امتیاز تأییدشده</dt><dd>{fa(item.awardedScore)} امتیاز</dd></div><div><dt>نحوه درج نام شما</dt><dd>{item.creditLabel || "بدون نام"}</dd></div></dl>
    {item.rejectionReason ? <p className="notice error">دلیل تأیید نشدن: {item.rejectionReason}</p> : item.adminNote && <p className="notice">پاسخ تحریریه: {item.adminNote}</p>}
    {item.campaign && <p className="notice">{item.campaign.label} · زمان انتشار استوری: {formatDate(item.campaign.publishedAt)}</p>}
    {item.items.map(child => <div className="submission-item" key={child.id}>{child.text && <p>{child.text}</p>}{child.caption && !child.attachmentId && <p className="muted">{child.caption}</p>}{child.attachmentId && <AttachmentPill attachmentId={child.attachmentId} caption={child.caption} />}</div>)}
    <small className="muted">شناسه پیگیری: <b dir="ltr">{item.id}</b></small>
  </div>;
}

export function HistoryView({ onSend }: { onSend: () => void }) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [filter, setFilter] = useState("all"); const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => { setLoading(true); setError(""); try { const data = await engagementApi.activity(); setEvents(data.events); setSubmissions(data.submissions); } catch (e) { setError(e instanceof Error ? e.message : "دریافت تاریخچه ناموفق بود."); } finally { setLoading(false); } }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  return <section className="activity-page"><div className="section-heading"><div><span className="eyebrow">قدم‌به‌قدم همراه شما</span><h2>تاریخچه من</h2><p>ارسال‌ها، نتیجه بررسی‌ها و گردش امتیازهای شما</p></div><button className="text-button" onClick={() => void refresh()} disabled={loading}>تازه‌سازی</button></div>
    <div className="activity-filters">{[["all", "همه"], ["content", "محتوا"], ["points", "امتیازها"], ["reward", "جوایز"]].map(([id, label]) => <button key={id} aria-pressed={filter === id} className={filter === id ? "selected" : ""} onClick={() => setFilter(id)}>{label}</button>)}</div>
    {loading && <p role="status">در حال دریافت تاریخچه…</p>}{error && <p className="notice error" role="alert">{error}</p>}
    {!loading && !error && events.filter(e => filter === "all" || filter === e.kind).length === 0 && <div className="empty-state"><p>هنوز رویدادی در این بخش ثبت نشده است.</p><button className="secondary" onClick={onSend}>ارسال اولین محتوا</button></div>}
    <div className="activity-timeline">{events.filter(e => filter === "all" || filter === e.kind).map(event => {
      const content = event.submission || submissions.find(s => s.id === event.submissionId);
      return <article className={`activity-card ${event.kind}`} key={event.id}><div className="activity-symbol"><ClubIcon name={event.kind === "points" ? "gift" : event.kind === "reward" ? "gift" : "news"} /></div><div className="activity-body"><b>{event.title}</b><time>{formatDate(event.createdAt)}</time>{event.description && <p>{event.description}</p>}{event.amount !== undefined && <p className={`point-amount ${event.amount < 0 ? "spent" : "earned"}`}>{event.amount >= 0 ? "+" : "−"}{fa(Math.abs(event.amount))} امتیاز <small>{!event.receivedAt ? "آماده دریافت" : event.amount < 0 ? "از موجودی کسر شد" : "به موجودی اضافه شد"}</small></p>}{event.receivedAt && event.amount !== undefined && event.amount > 0 && <small>زمان دریافت: {formatDate(event.receivedAt)}</small>}{content && <details><summary>مشاهده محتوا و نتیجه بررسی</summary><SubmissionDetails item={content} /></details>}</div></article>;
    })}</div>
  </section>;
}

export function PointsModal({ points, onMember, onClose, onRewards }: { points: PointAward[]; onMember: (member: Member) => void; onClose: () => void; onRewards: () => void }) {
  const [received, setReceived] = useState<string[]>([]); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  useEffect(() => { void engagementApi.activity().then(data => setSubmissions(data.submissions)).catch(() => undefined); }, []);
  const remaining = points.filter(p => !received.includes(p.id));
  const collect = async () => {
    setBusy(true); setError("");
    try { for (const point of remaining) { const result = await engagementApi.receive(point.id); onMember(result.member); setReceived(previous => [...previous, point.id]); } }
    catch (e) { setError(e instanceof Error ? e.message : "دریافت امتیاز انجام نشد؛ دوباره تلاش کنید."); }
    finally { setBusy(false); }
  };
  return <Modal title={remaining.length ? "امتیاز تازه داری!" : "امتیازها به حسابت رسید!"} onClose={busy ? () => undefined : onClose}><div className={`points-celebration ${received.length ? "collected" : ""}`}><div className="points-orb">✦</div><div className="point-sparks" aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <i key={i} style={{ "--i": i } as React.CSSProperties}>✦</i>)}</div><strong>{fa(points.reduce((sum, p) => sum + p.amount, 0))}</strong><span>امتیاز برای همراهی شما</span></div>
    <div className="award-list">{points.map(point => { const content = submissions.find(s => s.id === point.submissionId); return <div key={point.id}><b>{point.title}</b><span>{fa(point.amount)} امتیاز {received.includes(point.id) && "✓"}</span>{point.submissionId && (content ? <details><summary>بابت کدام محتوا؟</summary><SubmissionDetails item={content} /></details> : <small>شناسه محتوا: {point.submissionId}</small>)}</div>; })}</div>
    {error && <p role="alert" className="notice error">{error}</p>}
    {remaining.length > 0 && <button className="collect-points" disabled={busy} onClick={() => void collect()}>{busy ? "در حال دریافت…" : "دریافت امتیازها ✦"}</button>}
    <button className="secondary wide" disabled={busy} onClick={onRewards}><ClubIcon name="gift" /> ورود به تالار جوایز</button><p className="muted modal-hint">{remaining.length ? "با زدن دریافت، امتیازها به موجودی قابل استفاده شما اضافه می‌شوند." : "امتیازهایتان را برای دریافت جایزه استفاده کنید."}</p>
  </Modal>;
}

export function GiftModal({ campaigns, onClose, onHistory }: { campaigns: StoryCampaign[]; onClose: () => void; onHistory: () => void }) {
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id || ""); const campaign = campaigns.find(c => c.id === campaignId);
  const [mediaId, setMediaId] = useState(""); const media = campaign?.media.find(m => m.id === mediaId);
  const [published, setPublished] = useState(""); const [file, setFile] = useState<File>(); const [progress, setProgress] = useState<UploadProgress>({});
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [sent, setSent] = useState(false); const [copied, setCopied] = useState(false);
  const alreadySent = campaign?.submissionStatus && campaign.submissionStatus !== "rejected";
  const submit = async (event: FormEvent) => { event.preventDefault(); if (!file || !campaign || !media || !published) return; setBusy(true); setError(""); try { const date = new Date(published); if (date.getTime() > Date.now() - 20 * 3600000) throw new Error("هنوز ۲۰ ساعت از انتشار استوری نگذشته است."); const [attachment] = await uploadFiles([file], setProgress); await engagementApi.submitStory(campaign.id, media.id, date.toISOString(), attachment.id); setSent(true); } catch (e) { setError(e instanceof Error ? e.message : "ارسال اسکرین‌شات ناموفق بود."); } finally { setBusy(false); } };
  const download = async () => { if (!campaign || !media) return; setError(""); const popup = window.open("about:blank", "_blank"); if (popup) popup.opener = null; try { const result = await engagementApi.banner(campaign.id, media.id); if (popup) popup.location.href = result.url; else window.location.assign(result.url); } catch (e) { popup?.close(); setError(e instanceof Error ? e.message : "دریافت بنر ناموفق بود."); } };
  return <Modal title="هدیه برای همراهی شما" onClose={busy ? () => undefined : onClose}>
    {campaigns.length > 1 && <label>انتخاب هدیه<select value={campaignId} onChange={e => { setCampaignId(e.target.value); setMediaId(""); setSent(false); setFile(undefined); setPublished(""); }}>{campaigns.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>}
    <div className="gift-intro"><ClubIcon name="gift" /><b>{fa(campaign?.points || 15)} امتیاز هدیه بگیر!</b><p>شما می‌توانید با استوری کردن بنرهای کلام تازه در صفحه اینستاگرام خود، امتیاز هدیه دریافت کنید.</p></div>
    {sent || alreadySent ? <div className="notice"><p>{campaign?.submissionStatus === "approved" ? "اسکرین‌شات شما تأیید شده است. هدیه این کمپین برای شما ثبت شده است." : "اسکرین‌شات شما ثبت شد و در انتظار بررسی مدیر است."}</p><button className="primary wide" onClick={onHistory}>مشاهده در تاریخچه</button></div> : <form className="gift-form" onSubmit={submit}>
      <label>انتخاب رسانه<select required value={mediaId} disabled={busy} onChange={e => { setMediaId(e.target.value); setCopied(false); }}><option value="">رسانه را انتخاب کنید</option>{campaign?.media.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}</select></label>
      {media && <><button type="button" className="secondary wide" disabled={!media.ready || busy} onClick={() => void download()}>{media.ready ? "دانلود بنر استوری" : "بنر در حال آماده‌سازی است"}</button><p className="story-instructions">بنر را دانلود کنید و در صفحه خود با تگ شناسه زیر منتشر کنید. سپس حداقل ۲۰ ساعت پس از انتشار، اسکرین‌شات استوری را اینجا بارگذاری کنید. پس از تأیید مدیر، امتیاز هدیه برای شما ثبت می‌شود.</p><button type="button" className="copy-handle" aria-label="کپی شناسه رسانه" onClick={() => { void navigator.clipboard.writeText(`@${media.handle}`).then(() => setCopied(true)).catch(() => setError("کپی خودکار نشد؛ شناسه را انتخاب و کپی کنید.")); }}><b dir="ltr">@{media.handle}</b><span>{copied ? "کپی شد ✓" : "⧉ کپی"}</span></button><label>زمان انتشار استوری<input type="datetime-local" required value={published} disabled={busy} onChange={e => setPublished(e.target.value)} /><small>تاریخ و ساعت محلی گوشی شما؛ مدیر آن را با اسکرین‌شات بررسی می‌کند.</small></label><label className="drop-zone"><input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} required onChange={e => setFile(e.target.files?.[0])} /><span className="upload-plus">＋</span><b>{file ? file.name : "انتخاب اسکرین‌شات استوری"}</b><small>تصویر باید زمان استوری و تگ رسانه را نشان دهد.</small></label>{file && <MediaCard file={file} progress={Object.values(progress)[0]?.percent} error={Object.values(progress)[0]?.error} />}<UploadProgressView progress={progress} /><button className="primary wide" disabled={busy || !file || !published || !media.ready}>{busy ? "در حال ارسال…" : "ارسال اسکرین‌شات برای بررسی"}</button></>}
      <small className="muted">هدیه هر کمپین یک‌بار به هر عضو تعلق می‌گیرد. در صورت رد، می‌توانید اسکرین‌شات اصلاح‌شده بفرستید.</small>
    </form>}{error && <p className="notice error" role="alert">{error}</p>}
  </Modal>;
}
