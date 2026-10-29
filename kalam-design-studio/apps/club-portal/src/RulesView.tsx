import { useState } from "react";
import { MEDIA_LINKS, RULE_SECTIONS } from "./clubContent";

export default function RulesView({ name, onAccept }: { name?: string; onAccept?: () => Promise<void> }) {
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <section className="rules-page">
    <span className="eyebrow">{onAccept ? "مرحله ۱ از ۲ · قوانین و شرایط" : "راهنمای باشگاه"}</span>
    <h1>{onAccept ? `سلام ${name || "دوست عزیز"}، خوش آمدید 💐` : "قوانین باشگاه مخاطبان"}</h1>
    <p className="rules-alert">لطفاً حتماً پیش از ادامه، این متن را کامل بخوانید.</p>
    <p className="muted">با هم روایتگر شهرمان باشیم. این سه بخش به شما کمک می‌کند راحت‌تر محتوا بفرستید و امتیاز بگیرید.</p>
    {RULE_SECTIONS.map((section, index) => <article className="rule-card" key={section.title}>
      <h2><span>{section.icon}</span><small>{["۱", "۲", "۳"][index]}</small> {section.title}</h2>
      <ul>{section.items.map(item => <li key={item}>{item}</li>)}</ul>
    </article>)}
    {onAccept && <div className="rules-acceptance">
      <label className="checkbox-row"><input type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)} />همه قوانین و شرایط بالا را کامل خوانده‌ام و می‌پذیرم.</label>
      <button className="primary wide" disabled={!accepted || busy} onClick={async () => {
        setBusy(true); setError("");
        try { await onAccept(); } catch (reason) { setError(reason instanceof Error ? reason.message : "ثبت تأیید ناموفق بود؛ دوباره تلاش کنید."); } finally { setBusy(false); }
      }} type="button">{busy ? "در حال ثبت تأیید…" : "می‌پذیرم و ادامه می‌دهم"}</button>
      {error && <p className="notice error" role="alert">{error}</p>}
    </div>}
    <section className="media-directory"><h2>کلام تازه را دنبال کنید</h2><p className="muted">راه‌های همراهی با رسانه‌های کلام تازه</p><div className="media-links">
      {MEDIA_LINKS.map(link => <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer"><small>{link.group}</small><b>{link.label}</b><span aria-hidden="true">↗</span></a>)}
    </div></section>
  </section>;
}
