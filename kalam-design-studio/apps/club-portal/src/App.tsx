import MediaCard from "./MediaCard";
import { fa, formatDate } from "./format";
import { uploadAnonymousFiles, uploadFiles, UploadProgress } from "./uploads";
import { UploadProgressView, AttachmentPill } from "./UploadViews";
import ClubIcon from "./ClubIcon";
import { HistoryView, PointsModal, GiftModal, useEngagement } from "./MemberEngagement";
import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ChatMessage,
  clubApi,
  Member,
  Reward,
  RewardClaim,
} from "./api";

import RulesView from "./RulesView";
import { CONTENT_CATEGORIES, RULES_VERSION } from "./clubContent";

const CONTENT_OPTIONS = [
  "حوادث",
  "طبیعت‌گردی",
  "تصاویر متفرقه از شهر",
  "مشکلات شهر/روستا",
  "دیگر موارد",
];
const SKILL_OPTIONS = [
  "عکاسی و فیلمبرداری حرفه‌ای با گوشی",
  "عکاسی و فیلمبرداری حرفه‌ای با دوربین",
  "مسلط به ادیت عکس",
  "مسلط به ادیت فیلم",
  "خبرنگاری",
  "نویسندگی",
  "شاعری",
  "گویندگی",
  "بازیگری",
  "هیچکدام",
  "سایر",
];
const CREDIT_OPTIONS = [
  "بدون نام",
  "نام و نام خانوادگی",
  "فقط نام خانوادگی",
  "آیدی اینستاگرام",
  "نام و نام خانوادگی و آیدی اینستاگرام",
];
const PLATFORMS = [
  { id: "instagram", label: "اینستاگرام", hint: "@username" },
  { id: "telegram", label: "تلگرام", hint: "@username" },
  { id: "eitaa", label: "ایتا", hint: "@username" },
  { id: "rubika", label: "روبیکا", hint: "@username" },
  { id: "bale", label: "بله", hint: "@username" },
];

type Tab = "history" | "chat" | "content" | "rewards" | "profile";
const displayPhone = (phone: string) => phone.replace("+98", "0");
const englishDigits = (value: string) =>
  value.replace(/[۰-۹٠-٩]/g, (digit) =>
    "۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩".indexOf(digit) % 10 + "",
  );

function ChoiceChips({
  choices,
  value,
  onChange,
}: {
  choices: string[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="choice-chips">
      {choices.map((choice) => (
        <button
          key={choice}
          className={value.includes(choice) ? "selected" : ""}
          onClick={() =>
            onChange(
              value.includes(choice)
                ? value.filter((item) => item !== choice)
                : [...value, choice],
            )
          }
          type="button"
        >
          {value.includes(choice) ? "✓ " : ""}
          {choice}
        </button>
      ))}
    </div>
  );
}

function BrandHeader({ member, onGift }: { member?: Member; onGift?: () => void }) {
  return (
    <header className="brand-header">
      <a className="brand" href="/" aria-label="باشگاه کلام تازه">
        <img
          src="/brand/club-logo.png"
          alt="باشگاه مخاطبان کلام تازه"
        />
        <span>
          <b>باشگاه کلام تازه</b>
          <small>
            {member
              ? `سلام ${member.fullName || "دوست خوب"}`
              : "همراه مخاطبان کلام تازه"}
          </small>
        </span>
      </a>
      {member && (
        <div className="header-points">{onGift && <button className="gift-trigger" type="button" aria-label="هدیه استوری" onClick={onGift}><ClubIcon name="gift" /></button>}<span className="score-chip">✦ {fa(member.score)} امتیاز</span></div>
      )}
    </header>
  );
}

function AuthView({
  onAuthenticated,
  onAnonymous,
}: {
  onAuthenticated: (member: Member) => void;
  onAnonymous: () => void;
}) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"phone" | "code">("phone");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const submitPhone = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      const result = await clubApi.requestOtp(phone);
      setStage("code");
      setNotice(
        result.deliveryStatus === "unconfirmed"
          ? "اگر کد را دریافت کرده‌اید، همین حالا واردش کنید. در غیر این صورت تا یک دقیقه صبر کنید و دوباره درخواست دهید."
          : "کد تأیید برای شما ارسال شد.",
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "خطا در ارسال کد");
    } finally {
      setBusy(false);
    }
  };
  const submitCode = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      const result = await clubApi.verifyOtp(phone, code);
      onAuthenticated(result.member);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "کد تأیید نادرست است.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="auth-page">
      <BrandHeader />
      <section className="auth-hero"><span>روایت شهر، از نگاه شما</span><h2>شما ببینید.<br />همه باخبر شوند.</h2><p>عکس و خبر بفرستید، امتیاز بگیرید و از جوایز باشگاه استفاده کنید.</p><div><b>ارسال آسان</b><b>ارتباط مستقیم</b><b>جوایز ویژه</b></div></section>
      <section className="auth-card">
          <span className="eyebrow">باشگاه مخاطبان کلام تازه</span>
          <h1>
            {stage === "phone"
              ? "ورود یا ثبت‌نام در باشگاه"
              : "کد تأیید را وارد کنید"}
          </h1>
          <p>
            {stage === "phone"
              ? "اگر قبلاً عضو هستید وارد حساب خود می‌شوید؛ اگر اولین بار است، پس از تأیید شماره، قوانین را می‌خوانید و اطلاعات عضویت را تکمیل می‌کنید."
              : `کد ۶ رقمی به شمارهٔ ${displayPhone(phone)} ارسال شد.`}
          </p>
          {stage === "phone" && (
            <div className="auth-flow-hint">
              <div>
                <b>ورود</b>
                <small>برای اعضای قبلی</small>
              </div>
              <div>
                <b>عضویت</b>
                <small>پذیرش قوانین و تکمیل اطلاعات</small>
              </div>
            </div>
          )}
        {stage === "phone" ? (
          <>
          <form onSubmit={submitPhone}>
            <label>
              شماره موبایل
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                inputMode="tel"
                autoComplete="tel"
                placeholder="۰۹۱۲۱۲۳۴۵۶۷"
                autoFocus
              />
            </label>
            <button
              className="primary wide"
              disabled={busy || phone.trim().length < 10}
            >
              {busy ? "در حال ارسال…" : "ادامه با شماره موبایل"}
            </button>
          </form>
          <button className="secondary wide anonymous-entry" onClick={onAnonymous} type="button">
            ارسال محتوا بصورت ناشناس
          </button>
          <small className="privacy-note">(فقط ویژه پیامهای مردمی که میخواهید با هویت ناشناس ارسال شود)</small>
          </>
        ) : (
          <form onSubmit={submitCode}>
            <label>
              کد تأیید
              <input
                className="otp-input"
                value={code}
                onChange={(event) =>
                  setCode(englishDigits(event.target.value).replace(/\D/g, "").slice(0, 6))
                }
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="• • • • • •"
                autoFocus
              />
            </label>
            <button
              className="primary wide"
              disabled={busy || code.length !== 6}
            >
              {busy ? "در حال بررسی…" : "ورود و ادامهٔ عضویت"}
            </button>
            <button
              className="text-button wide"
              onClick={() => {
                setStage("phone");
                setCode("");
              }}
              type="button"
            >
              ویرایش شماره موبایل
            </button>
          </form>
        )}
        {notice && (
          <p
            className={
              notice.includes("خطا") || notice.includes("ناموفق")
                ? "notice error"
                : "notice"
            }
          >
            {notice}
          </p>
        )}
        <small className="privacy-note">
          ورود با رمز یک‌بارمصرف است؛ اطلاعات عضویت در مرحلهٔ بعد تکمیل می‌شود.
        </small>
      </section>
    </main>
  );
}

function AnonymousView({ onBack }: { onBack: () => void }) {
  const [text, setText] = useState(""); const [caption, setCaption] = useState(""); const [files, setFiles] = useState<File[]>([]); const [fileCaptions, setFileCaptions] = useState<Record<string, string>>({}); const fileKey = (file: File) => `${file.name}:${file.size}:${file.lastModified}`;
  const [captcha, setCaptcha] = useState<{ token: string; question: string }>(); const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false); const [notice, setNotice] = useState(""); const [progress, setProgress] = useState<UploadProgress>({});
  const loadCaptcha = useCallback(async () => { try { setCaptcha(await clubApi.anonymousCaptcha()); } catch (error) { setNotice(error instanceof Error ? error.message : "دریافت کپچا ناموفق بود."); } }, []);
  useEffect(() => { void loadCaptcha(); }, [loadCaptcha]);
  const submit = async (event: FormEvent) => { event.preventDefault(); if (!text.trim() && !files.length) return; setBusy(true); setNotice(""); try { const authorization = await clubApi.authorizeAnonymousContent(captcha?.token || "", answer); const uploaded = files.length ? await uploadAnonymousFiles(files, authorization.authorizationToken, setProgress) : []; const items = [...uploaded.map((file, index) => ({ attachment_id: file.id, caption: fileCaptions[fileKey(files[index])] || "" })), ...((text.trim() || caption.trim()) ? [{ text: text.trim() || caption.trim(), caption: text.trim() ? caption.trim() : "" }] : [])]; await clubApi.submitAnonymousContent(authorization.authorizationToken, items); setText(""); setCaption(""); setFiles([]); setFileCaptions({}); setProgress({}); setAnswer(""); setNotice("پیام و فایل‌های شما بدون ثبت هویت برای تحریریه ارسال شد."); void loadCaptcha(); } catch (error) { setNotice(error instanceof Error ? error.message : "ارسال ناشناس ناموفق بود؛ کپچا را تازه کنید و دوباره بزنید."); void loadCaptcha(); } finally { setBusy(false); } };
  return <main className="content-page anonymous-content-page"><BrandHeader /><section className="auth-card"><button className="text-button" onClick={onBack} type="button">بازگشت به ورود</button><span className="eyebrow">ارسال ناشناس</span><h1>پیام مردمی</h1><div className="notice">شما در حال ارسال محتوا به صورت «ناشناس» هستید، در این حالت فقط ارسال محتوا از نوع «پیام مردمی» فعال است و بابت ارسال محتوا، امتیازی دریافت نمی‌کنید.<br />محتوای شما به تحریریه جهت بررسی و پیگیری ارجاع داده خواهد شد.</div><form className="content-form" onSubmit={submit}><label className="drop-zone"><input multiple disabled={busy} onChange={e => setFiles(previous => [...previous, ...Array.from(e.target.files || [])].slice(0, 12))} type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm,audio/mpeg,audio/mp4,audio/wav,audio/ogg" /><span className="upload-plus" aria-hidden="true">＋</span><b>فایل‌های پیام مردمی را انتخاب کنید</b><small>فقط عکس، ویدیو و صوت · حداکثر ۵۰MB برای هر فایل</small></label>{files.length > 0 && <div className="club-media-grid">{files.map(file => <MediaCard key={fileKey(file)} file={file} caption={fileCaptions[fileKey(file)]} onCaption={value => setFileCaptions(current => ({ ...current, [fileKey(file)]: value }))} onRemove={() => setFiles(current => current.filter(item => item !== file))} disabled={busy} progress={Object.values(progress).find(p => p.name === file.name)?.percent} error={Object.values(progress).find(p => p.name === file.name)?.error} />)}</div>}<label>متن پیام مردمی<textarea value={text} onChange={e => setText(e.target.value)} rows={8} placeholder="پیام، گزارش یا دغدغه‌تان را بنویسید…" /></label><label>توضیح کوتاه (اختیاری)<textarea value={caption} onChange={e => setCaption(e.target.value)} rows={3} /></label><label>{captcha?.question || "کپچا"}<input value={answer} onChange={e => setAnswer(e.target.value.replace(/\D/g, ""))} inputMode="numeric" required /></label><UploadProgressView progress={progress} /><button className="primary wide" disabled={busy || !captcha || (!text.trim() && !files.length) || !answer}>{busy ? "در حال ارسال…" : "ارسال ناشناس برای تحریریه"}</button>{notice && <p className="notice">{notice}</p>}</form></section></main>;
}

function ProfileForm({
  member,
  onSaved,
}: {
  member: Member;
  onSaved: (member: Member) => void;
}) {
  const [fullName, setFullName] = useState(member.fullName);
  const [city, setCity] = useState(member.city);
  const [contentTypes, setContentTypes] = useState(member.contentTypes);
  const [skills, setSkills] = useState(member.skills);
  const [creditLabel, setCreditLabel] = useState(member.creditLabel);
  const [platforms, setPlatforms] = useState<Record<string, string>>(
    member.platformHandles,
  );
  const [marketing, setMarketing] = useState(member.marketingSmsAllowed);
  const [agreement, setAgreement] = useState(Boolean(member.profileComplete));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const save = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      const result = await clubApi.updateProfile({
        fullName,
        city,
        contentTypes,
        skills,
        creditLabel,
        platformHandles: platforms,
        marketingSmsAllowed: marketing,
        agreementAccepted: agreement,
      });
      onSaved(result.member);
      setNotice("اطلاعات شما با موفقیت ذخیره شد.");
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "ذخیره‌سازی ناموفق بود.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="profile-form" onSubmit={save}>
      <section className="form-section">
        <div>
          <span className="eyebrow">پروفایل شما</span>
          <h2>
            {member.profileComplete ? "اطلاعات عضویت" : "مرحله ۲ از ۲ · اطلاعات شما"}
          </h2>
          <p>اطلاعات دقیق شما به بررسی محتوا و تحویل جایزه کمک می‌کند.</p>
        </div>
        <div className="form-grid">
          <label>
            نام و نام خانوادگی
            <input
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              required
            />
          </label>
          <label>
            شماره موبایل
            <input value={displayPhone(member.phone)} disabled />
          </label>
          <label>
            شهر محل سکونت
            <input
              value={city}
              onChange={(event) => setCity(event.target.value)}
              required
            />
          </label>
        </div>
      </section>
      <section className="form-section">
        <h3>در کدام پلتفرم‌ها همراه ما هستید؟</h3>
        <p>انتخاب هر پلتفرم اختیاری است؛ فقط آیدی همان پلتفرم را وارد کنید.</p>
        <div className="platform-grid">
          {PLATFORMS.map((platform) => (
            <label className="platform-field" key={platform.id}>
              <span>
                <input
                  checked={platform.id in platforms}
                  onChange={(event) =>
                    setPlatforms((current) => {
                      const next = { ...current };
                      if (event.target.checked)
                        next[platform.id] = next[platform.id] || "";
                      else delete next[platform.id];
                      return next;
                    })
                  }
                  type="checkbox"
                />
                {platform.label}
              </span>
              {platform.id in platforms && (
                <input
                  value={platforms[platform.id]}
                  onChange={(event) =>
                    setPlatforms({
                      ...platforms,
                      [platform.id]: event.target.value,
                    })
                  }
                  placeholder={platform.hint}
                />
              )}
            </label>
          ))}
        </div>
      </section>
      <section className="form-section">
        <h3>چه نوع محتوایی می‌توانید ارسال کنید؟</h3>
        <ChoiceChips
          choices={CONTENT_OPTIONS}
          value={contentTypes}
          onChange={setContentTypes}
        />
      </section>
      <section className="form-section">
        <h3>مهارت‌های شما</h3>
        <ChoiceChips
          choices={SKILL_OPTIONS}
          value={skills}
          onChange={setSkills}
        />
      </section>
      <section className="form-section">
        <h3>نام شما در انتشار محتوا چگونه درج شود؟</h3>
        <div className="radio-list">
          {CREDIT_OPTIONS.map((option) => (
            <label key={option}>
              <input
                checked={creditLabel === option}
                onChange={() => setCreditLabel(option)}
                type="radio"
                name="credit"
              />
              {option}
            </label>
          ))}
        </div>
      </section>
      <section className="form-section compact">
        <label className="checkbox-row">
          <input
            checked={agreement}
            onChange={(event) => setAgreement(event.target.checked)}
            type="checkbox"
          />
          قوانین و شرایط باشگاه را کامل خوانده‌ام و می‌پذیرم.
        </label>
        <label className="checkbox-row">
          <input
            checked={marketing}
            onChange={(event) => setMarketing(event.target.checked)}
            type="checkbox"
          />
          مایلم خبرها و پیشنهادهای غیرضروری باشگاه را هم پیامک دریافت کنم.
        </label>
      </section>
      <button className="primary wide" disabled={busy || !agreement}>
        {busy
          ? "در حال ذخیره…"
          : member.profileComplete
            ? "ذخیره تغییرات"
            : "تکمیل عضویت"}
      </button>
      {notice && <p className="notice">{notice}</p>}
    </form>
  );
}

function ChatView({ member }: { member: Member }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [progress, setProgress] = useState<UploadProgress>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const refresh = useCallback(async () => {
    try {
      const result = await clubApi.messages();
      setMessages(result.messages);
    } catch {
      /* session error is handled at shell level */
    }
  }, []);
  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(id);
  }, [refresh]);
  const [draftFiles, setDraftFiles] = useState<File[]>([]);
  const [fileCaptions, setFileCaptions] = useState<Record<string, string>>({});
  const fileKey = (file: File) => `${file.name}:${file.size}:${file.lastModified}`;
  const selectFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    setDraftFiles(current => [...current, ...selected].slice(0, 12));
    if (input.current) input.current.value = "";
  };
  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (!text.trim() && !draftFiles.length) return;
    setBusy(true);
    setNotice("");
    try {
      const attachments = draftFiles.length ? await uploadFiles(draftFiles, setProgress) : [];
      const result = await clubApi.sendMessage(
        text,
        attachments.map((item) => item.id),
        Object.fromEntries(attachments.map((item, index) => [item.id, fileCaptions[fileKey(draftFiles[index])] || ""])),
      );
      setMessages((current) => [...current, result.message]);
      setText("");
      setDraftFiles([]); setFileCaptions({});
      setProgress({});
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "ارسال پیام ناموفق بود.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="chat-page">
      <div className="section-heading">
        <div>
          <span className="eyebrow">گفتگوی مستقیم</span>
          <h2>پشتیبانی باشگاه</h2>
          <p>پیام و فایل شما مستقیم به تیم کلام تازه می‌رسد.</p>
        </div>
        <span className="online-status">● پاسخ انسانی</span>
      </div>
      <div className="message-list">
        {messages.length === 0 && (
          <div className="empty-state">
            <b>گفتگو را شروع کنید</b>
            <p>سؤال، پیشنهاد یا فایل خود را همین‌جا برای تیم باشگاه بفرستید.</p>
          </div>
        )}
        {messages.map((message) => (
          <article
            className={`message ${message.sender === "member" ? "mine" : "theirs"}`}
            key={message.id}
          >
            <small>
              {message.sender === "member" ? "شما" : "کلام تازه"}
              {message.aiGenerated ? " · پیشنهاد AI" : ""}
            </small>
            {message.text && <p>{message.text}</p>}
            {message.attachmentIds.length > 0 && (
              <div className="message-files">
                {message.attachmentIds.map((attachmentId) => (
                  <AttachmentPill
                    attachmentId={attachmentId}
                    caption={message.attachmentCaptions?.[attachmentId]}
                    key={attachmentId}
                  />
                ))}
              </div>
            )}
            <time>{formatDate(message.sentAt)}</time>
          </article>
        ))}
      </div>
      <form className="chat-composer" onSubmit={send}>
        <UploadProgressView progress={progress} />
        {draftFiles.length > 0 && <div className="club-media-grid">{draftFiles.map(file => <MediaCard key={fileKey(file)} file={file} caption={fileCaptions[fileKey(file)]} onCaption={value => setFileCaptions(previous => ({ ...previous, [fileKey(file)]: value }))} onRemove={() => setDraftFiles(previous => previous.filter(item => item !== file))} disabled={busy} progress={Object.values(progress).find(p => p.name === file.name)?.percent} error={Object.values(progress).find(p => p.name === file.name)?.error} />)}</div>}
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="پیام خود را بنویسید…"
          rows={2}
        />
        <div>
          <input
            ref={input}
            onChange={(event) => void selectFiles(event)}
            multiple
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm,audio/mpeg,audio/mp4,audio/wav,audio/ogg"
            hidden
          />
          <button
            className="attach-button"
            onClick={() => input.current?.click()}
            type="button"
            disabled={busy}
          >
            📎 فایل
          </button>
          <button
            className="primary send-button"
            disabled={busy || (!text.trim() && !draftFiles.length)}
          >
            {busy ? "…" : "ارسال"}
          </button>
        </div>
        {notice && <p className="notice error">{notice}</p>}
      </form>
    </section>
  );
}

function ContentView({ member, onScoreChange }: { member: Member; onScoreChange: () => void }) {
  const [category, setCategory] = useState("");
  const chosenCategory = CONTENT_CATEGORIES.find(item => item.id === category);
  const [files, setFiles] = useState<File[]>([]);
  const [fileCaptions, setFileCaptions] = useState<Record<string, string>>({});
  const fileKey = (file: File) => `${file.name}:${file.size}:${file.lastModified}`;
  const [text, setText] = useState("");
  const [caption, setCaption] = useState("");
  const [classifiedType, setClassifiedType] = useState("lost_found");
  const [classifiedContact, setClassifiedContact] = useState("");
  const [creditLabel, setCreditLabel] = useState("");
  const [progress, setProgress] = useState<UploadProgress>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!category || (!files.length && !text.trim() && !caption.trim())) return;
    setBusy(true);
    setNotice("");
    try {
      const uploaded = files.length
        ? await uploadFiles(files, setProgress)
        : [];
      const items = [
        ...uploaded.map((file, index) => ({ attachment_id: file.id, caption: fileCaptions[fileKey(files[index])] || "" })),
        ...((text.trim() || caption.trim()) ? [{ text: text.trim() || caption.trim(), caption: text.trim() ? caption : "" }] : []),
      ];
      await clubApi.submitContent(creditLabel, category, items, category === "classifieds" ? { type: classifiedType, contact: classifiedContact } : undefined);
      setFiles([]); setFileCaptions({});
      setText("");
      setCaption("");
      setProgress({});
      setNotice("محتوا برای بررسی ارسال شد.");
      onScoreChange();
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "ارسال محتوا ناموفق بود.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="content-page">
      <div className="section-heading">
        <div>
          <span className="eyebrow">ارسال برای بررسی</span>
          <h2>محتوای خود را بفرستید</h2>
          <p>
            چند فایل، متن یا ترکیبی از هر دو را تا سقف ۳۰۰ مگابایت برای هر فایل
            ارسال کنید.
          </p>
        </div>
      </div>
      <form className="content-form" onSubmit={submit}>
        <fieldset className="category-picker"><legend>نوع محتوا:</legend><div>{CONTENT_CATEGORIES.map(item => <button type="button" key={item.id} aria-pressed={category === item.id} className={category === item.id ? "selected" : ""} onClick={() => setCategory(item.id)}><span aria-hidden="true"><ClubIcon name={item.id} /></span>{item.label}</button>)}</div></fieldset>
        {chosenCategory && <div className="category-hint" aria-live="polite"><b>✦ {chosenCategory.points}</b><p>{chosenCategory.description}</p><small>تعلق امتیاز منوط به تأیید تحریریه و قابل انتشار بودن محتواست.</small></div>}
        {category === "classifieds" && <><label>نوع آگهی<select value={classifiedType} onChange={e => setClassifiedType(e.target.value)}><option value="lost_found">گمشده</option><option value="hiring">استخدامی</option></select></label><label>راه‌های ارتباطی<textarea value={classifiedContact} onChange={e => setClassifiedContact(e.target.value)} rows={2} placeholder="شماره تماس یا راه ارتباطی" /></label><p className="notice">(نکته: آگهی های رایگان نیازمندیها، در قالب های 4 تایی در کنار دیگر آگهی ها منتشر می شوند. اگر نیاز به تبلیغات اختصاصی دارید با شماره 05191010836 داخلی 1 تماس بگیرید.)</p></>}
        <label className="drop-zone">
          <input
            multiple
            onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm,audio/mpeg,audio/mp4,audio/wav,audio/ogg"
          />
          <span className="upload-plus" aria-hidden="true">＋</span>
          <b>فایل‌ها را انتخاب کنید</b>
          <small>
            فقط عکس، ویدیو و صوت · حداکثر ۳۰۰MB برای هر فایل
          </small>
        </label>
        {files.length > 0 && <div className="club-media-grid">{files.map(file => <MediaCard key={fileKey(file)} file={file} caption={fileCaptions[fileKey(file)]} onCaption={value => setFileCaptions(previous => ({ ...previous, [fileKey(file)]: value }))} onRemove={() => setFiles(previous => previous.filter(item => item !== file))} disabled={busy} progress={Object.values(progress).find(p => p.name === file.name)?.percent} error={Object.values(progress).find(p => p.name === file.name)?.error} />)}</div>}
        <label>
          {category === "classifieds" ? "متن آگهی" : "متن محتوا"}
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="اگر متن دارید اینجا بنویسید…"
            rows={5}
          />
        </label>
        <label>
          توضیح عمومی ارسال (اختیاری)
          <textarea
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            placeholder="توضیحی که به کل این ارسال مربوط است…"
            rows={3}
          />
        </label>
        <label>
          نحوه درج نام شما در کنار این محتوا
          <select
            value={creditLabel}
            onChange={(event) => setCreditLabel(event.target.value)}
          >
            <option value="">طبق تنظیمات پروفایل</option>
            {CREDIT_OPTIONS.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        {!creditLabel && <small className="credit-preview">تنظیم فعلی پروفایل: {member.creditLabel || "بدون نام"}{member.creditLabel.includes("نام") && member.creditLabel !== "بدون نام" && member.creditLabel !== "آیدی اینستاگرام" ? ` · ${member.creditLabel === "فقط نام خانوادگی" ? member.fullName.trim().split(/\s+/).slice(-1)[0] : member.fullName}` : ""}{member.creditLabel.includes("اینستاگرام") ? ` · ${member.platformHandles.instagram || "شناسه اینستاگرام در پروفایل ثبت نشده است"}` : ""}</small>}
        <UploadProgressView progress={progress} />
        <button
          className="primary wide"
          disabled={busy || !category || (!files.length && !text.trim() && !caption.trim()) || files.length + (text.trim() || caption.trim() ? 1 : 0) > 12}
        >
          {busy ? "در حال ارسال…" : "ارسال برای بررسی"}
        </button>
        {notice && <p className="notice">{notice}</p>}
      </form>

    </section>
  );
}

function RewardsView({
  member,
  onMemberChange,
}: {
  member: Member;
  onMemberChange: () => void;
}) {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [claims, setClaims] = useState<RewardClaim[]>([]);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [code, setCode] = useState<{ id: string; value: string }>();
  const refresh = useCallback(async () => {
    try {
      const [rewardResult, claimResult] = await Promise.all([
        clubApi.rewards(),
        clubApi.claims(),
      ]);
      setRewards(rewardResult.rewards);
      setClaims(claimResult.claims);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "دریافت جوایز ناموفق بود.",
      );
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const claim = async (reward: Reward) => {
    if (
      !window.confirm(
        `برای دریافت «${reward.title}» ${fa(reward.pointsCost)} امتیاز رزرو شود؟`,
      )
    )
      return;
    setBusy(reward.id);
    setNotice("");
    try {
      await clubApi.claimReward(reward.id);
      await refresh();
      onMemberChange();
      setNotice("درخواست جایزه ثبت شد.");
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "ثبت درخواست ناموفق بود.",
      );
    } finally {
      setBusy("");
    }
  };
  const showCode = async (claimId: string) => {
    try {
      const result = await clubApi.rewardCode(claimId);
      setCode({ id: claimId, value: result.code });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "کد در دسترس نیست.");
    }
  };
  return (
    <section className="rewards-page">
      <div className="section-heading">
        <div>
          <span className="eyebrow">ویترین جوایز</span>
          <h2>امتیازتان را به جایزه تبدیل کنید</h2>
          <p>موجودی، تاریخ و شیوهٔ تحویل هر جایزه شفاف است.</p>
        </div>
        <span className="score-card">
          {fa(member.score)}
          <small>امتیاز شما</small>
        </span>
      </div>
      {notice && <p className="notice">{notice}</p>}
      <div className="reward-grid">
        {rewards.map((reward) => (
          <article className="reward-card" key={reward.id}>
            {reward.imageUrl ? (
              <img
                alt={reward.title}
                className="reward-image"
                loading="lazy"
                src={reward.imageUrl}
              />
            ) : (
              <div className="reward-icon">
                {reward.kind === "discount_code"
                  ? "٪"
                  : reward.kind === "cash"
                    ? "ریال"
                    : "هدیه"}
              </div>
            )}
            {reward.partner && (
              <small className="partner-name">
                {reward.partner.logoUrl && (
                  <img
                    alt=""
                    className="partner-logo"
                    loading="lazy"
                    src={reward.partner.logoUrl}
                  />
                )}
                {reward.partner.name}
              </small>
            )}
            <h3>{reward.title}</h3>
            <p>
              {reward.description || "توضیحات این جایزه به‌زودی کامل می‌شود."}
            </p>
            {reward.partner && (
              <div className="partner-details">
                {reward.partner.address && (
                  <span>⌖ {reward.partner.address}</span>
                )}
                {reward.partner.phone && (
                  <a href={`tel:${reward.partner.phone}`}>
                    ☎ {reward.partner.phone}
                  </a>
                )}
              </div>
            )}
            <footer>
              <b>{fa(reward.pointsCost)} امتیاز</b>
              <button
                className="primary"
                disabled={
                  busy === reward.id || member.score < reward.pointsCost
                }
                onClick={() => void claim(reward)}
                type="button"
              >
                {busy === reward.id
                  ? "…"
                  : member.score < reward.pointsCost
                    ? "امتیاز ناکافی"
                    : "دریافت جایزه"}
              </button>
            </footer>
          </article>
        ))}
      </div>
      <section className="history reward-history">
        <h3>جوایز من</h3>
        {claims.length === 0 ? (
          <p className="muted">هنوز درخواستی برای جایزه ثبت نکرده‌اید.</p>
        ) : (
          claims.map((claim) => (
            <article key={claim.id}>
              <span className={`status ${claim.status}`}>{claim.status}</span>
              <b>{claim.reward.title}</b>
              <small>{formatDate(claim.createdAt)}</small>
              {claim.fulfillmentNote && <p>{claim.fulfillmentNote}</p>}
              {["approved", "delivered", "redeemed"].includes(claim.status) &&
                claim.reward.kind === "discount_code" && (
                  <button
                    className="secondary"
                    onClick={() => void showCode(claim.id)}
                    type="button"
                  >
                    نمایش کد
                  </button>
                )}
              {code?.id === claim.id && <code>{code.value}</code>}
            </article>
          ))
        )}
      </section>
    </section>
  );
}

function AppShell({ initialMember, onLoggedOut }: { initialMember: Member; onLoggedOut: () => void }) {
  const [member, setMember] = useState(initialMember);
  const [tab, setTab] = useState<Tab>(
    member.profileComplete ? "content" : "profile",
  );
  const [loading, setLoading] = useState(false);
  const refreshMember = useCallback(async () => {
    try {
      const result = await clubApi.me();
      setMember(result.member);
    } catch {
      /* session expiration refreshes on next full load */
    }
  }, []);
  const [logoutError, setLogoutError] = useState("");
  const needsRules = member.rulesVersion !== RULES_VERSION;
  const [profileTab, setProfileTab] = useState<"info" | "rules">("info");
  const engagement = useEngagement(member.profileComplete && !needsRules);
  const logout = async () => {
    setLoading(true); setLogoutError("");
    try {
      await clubApi.logout();
      onLoggedOut();
    } catch {
      setLogoutError("خروج انجام نشد؛ ارتباط را بررسی کنید و دوباره بزنید.");
    } finally {
      setLoading(false);
    }
  };
  return (
    <main className="app-shell">
      <BrandHeader member={member} onGift={engagement.campaigns.length ? () => engagement.setGiftOpen(true) : undefined} />
      <div className="page-content">
        {needsRules ? <RulesView name={member.fullName} onAccept={async () => { const result = await clubApi.acceptRules(RULES_VERSION); setMember(result.member); setTab(result.member.profileComplete ? "content" : "profile"); }} /> : <>
        {!member.profileComplete && (
          <div className="onboarding-banner">
            برای استفاده از گفتگو، ارسال محتوا و جوایز ابتدا ثبت‌نام را کامل
            کنید.
          </div>
        )}
        {tab === "chat" && member.profileComplete && (
          <ChatView member={member} />
        )}
        {tab === "content" && member.profileComplete && (
          <ContentView member={member} onScoreChange={() => void refreshMember()} />
        )}
        {tab === "rewards" && member.profileComplete && (
          <RewardsView
            member={member}
            onMemberChange={() => void refreshMember()}
          />
        )}
        {tab === "profile" && (<>
          {member.profileComplete && <div className="profile-tabs" role="tablist"><button role="tab" aria-selected={profileTab === "info"} onClick={() => setProfileTab("info")}>اطلاعات من</button><button role="tab" aria-selected={profileTab === "rules"} onClick={() => setProfileTab("rules")}>قوانین باشگاه</button></div>}
          {profileTab === "rules" ? <RulesView /> : <ProfileForm
            member={member}
            onSaved={(next) => {
              setMember(next);
              if (!next.profileComplete) return;
              setTab("content");
            }}
          />}
        </>)}
        {tab === "history" && member.profileComplete && <HistoryView onSend={() => setTab("content")} />}
        </>}
      </div>
      <nav className="bottom-nav" aria-label="بخش‌های باشگاه">
        <button type="button" disabled={needsRules || !member.profileComplete} className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}><ClubIcon name="history" />تاریخچه</button>
        <button
          className={tab === "chat" ? "active" : ""}
          disabled={needsRules || !member.profileComplete}
          onClick={() => setTab("chat")}
          type="button"
        >
          <ClubIcon name="people" />گفتگو
        </button>
        <button
          className={`content-nav-button ${tab === "content" ? "active" : ""}`}
          disabled={needsRules || !member.profileComplete}
          onClick={() => setTab("content")}
          type="button"
        >
          <span>＋</span>ارسال محتوا
        </button>
        <button
          className={tab === "rewards" ? "active" : ""}
          disabled={needsRules || !member.profileComplete}
          onClick={() => setTab("rewards")}
          type="button"
        >
          <ClubIcon name="gift" />جوایز
        </button>
        <button
          className={tab === "profile" ? "active" : ""}
          disabled={needsRules}
          onClick={() => setTab("profile")}
          type="button"
        >
          <ClubIcon name="profile" />پروفایل
        </button>
      </nav>
      <button
        className="logout"
        disabled={loading}
        onClick={() => void logout()}
        type="button"
      >
        {loading ? "در حال خروج…" : "خروج از حساب"}
      </button>
      {engagement.points.length > 0 && !engagement.pointsDismissed && <PointsModal points={engagement.points} onMember={setMember} onClose={() => { engagement.setPointsDismissed(true); void engagement.refresh(); }} onRewards={() => { engagement.setPointsDismissed(true); setTab("rewards"); void engagement.refresh(); }} />}
      {engagement.giftOpen && <GiftModal campaigns={engagement.campaigns} onClose={() => { engagement.setGiftOpen(false); void engagement.refresh(); }} onHistory={() => { engagement.setGiftOpen(false); setTab("history"); void engagement.refresh(); }} />}
      {logoutError && <p className="notice error" role="alert">{logoutError}</p>}
    </main>
  );
}

export default function App() {
  const [member, setMember] = useState<Member>();
  const [anonymous, setAnonymous] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    void clubApi
      .me()
      .then((result) => setMember(result.member))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);
  if (loading)
    return (
      <main className="splash">
        <div className="brand-mark">ک</div>
        <p>در حال ورود به باشگاه…</p>
      </main>
    );
  return member ? (
    <AppShell initialMember={member} onLoggedOut={() => setMember(undefined)} />
  ) : anonymous ? (
    <AnonymousView onBack={() => setAnonymous(false)} />
  ) : (
    <AuthView onAuthenticated={setMember} onAnonymous={() => setAnonymous(true)} />
  );
}
