import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import ClubCampaignAdmin from "./ClubCampaignAdmin";
import "./clubEngagement.css";
import ClubAttachment from "./ClubAttachment";
import MediaCard from "../../club-portal/src/MediaCard";
import { clubFileKey, uploadClubFiles, ClubUploadProgress } from "./clubUploads";
import {
  ClubAdminClaim,
  ClubAdminConversation,
  ClubAdminMessage,
  ClubAdminReward,
  ClubAdminSubmission,
  archiveClubContent,
  clubAdminRequest,
  getClubAiSuggestion,
  uploadClubAdminImage,
} from "./api";

type ClubView = "inbox" | "content" | "rewards" | "claims" | "settings";
type Partner = {
  id: string;
  name: string;
  shortDescription: string;
  address: string;
  phone: string;
  websiteUrl: string;
  logoAttachmentId?: string | null;
  logoUrl?: string | null;
  active: boolean;
};
type ClubAdmin = {
  externalId: string;
  displayName: string;
  roles: string[];
  active: boolean;
};
type Template = {
  id: string;
  eventKey: string;
  body: string;
  enabled: boolean;
  transactional: boolean;
};
type ReplyRule = {
  id: string;
  name: string;
  enabled: boolean;
  matchMode: "contains" | "exact" | "starts_with";
  matchText: string;
  responseText: string;
  priority: number;
};

const fa = (value: string | number) =>
  String(value).replace(/\d/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]);
const when = (value?: string) =>
  value
    ? new Intl.DateTimeFormat("fa-IR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(value))
    : "—";
const roleLabels: Record<string, string> = {
  club_admin: "مدیر کامل",
  support: "پشتیبانی",
  content_moderator: "بررسی محتوا",
  reward_manager: "مدیریت جوایز",
};

export default function ClubAdmin({
  telegramInitData,
  onBack,
  onClassifiedsSelected,
}: {
  telegramInitData?: string;
  onBack: () => void;
  onClassifiedsSelected?: (ads: Array<{ category: "lost_found" | "hiring"; title: string; body: string; contact: string }>) => void;
}) {
  const shellRef = useRef<HTMLElement>(null);
  const footerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const footer = footerRef.current;
    if (!footer) return;
    const updateFooterHeight = () => shellRef.current?.style.setProperty(
      "--club-footer-height", `${Math.ceil(footer.getBoundingClientRect().height)}px`,
    );
    updateFooterHeight();
    const observer = new ResizeObserver(updateFooterHeight);
    observer.observe(footer);
    return () => observer.disconnect();
  }, []);
  const [view, setView] = useState<ClubView>("inbox");
  const [conversations, setConversations] = useState<ClubAdminConversation[]>(
    [],
  );
  const [selectedConversationId, setSelectedConversationId] = useState("");
  const [messages, setMessages] = useState<ClubAdminMessage[]>([]);
  const [archiveMessageIds, setArchiveMessageIds] = useState<string[]>([]);
  const [archiveSubmissionIds, setArchiveSubmissionIds] = useState<string[]>([]);
  const [reply, setReply] = useState("");
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const [replyCaptions, setReplyCaptions] = useState<Record<string, string>>({});
  const [replyProgress, setReplyProgress] = useState<ClubUploadProgress>({});
  const [submissions, setSubmissions] = useState<ClubAdminSubmission[]>([]);
  const [contentFilter, setContentFilter] = useState("all");
  const [rewards, setRewards] = useState<ClubAdminReward[]>([]);
  const [claims, setClaims] = useState<ClubAdminClaim[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [admins, setAdmins] = useState<ClubAdmin[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [rules, setRules] = useState<ReplyRule[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [rewardForm, setRewardForm] = useState({
    title: "",
    description: "",
    kind: "discount_code",
    fulfillment_mode: "manual",
    points_cost: "0",
    stock_total: "",
    code_expires_after_days: "30",
    partner_id: "",
    image_attachment_id: "",
  });
  const [partnerForm, setPartnerForm] = useState({
    name: "",
    short_description: "",
    address: "",
    phone: "",
    website_url: "",
    logo_attachment_id: "",
  });
  const [editingPartnerId, setEditingPartnerId] = useState("");
  const [editingRewardId, setEditingRewardId] = useState("");
  const [codeText, setCodeText] = useState<Record<string, string>>({});
  const [ruleForm, setRuleForm] = useState({
    name: "",
    match_mode: "contains",
    match_text: "",
    response_text: "",
    priority: "100",
  });
  const [snippets, setSnippets] = useState<
    Array<{ title: string; text: string }>
  >(() => {
    try {
      return JSON.parse(localStorage.getItem("kalam-club-snippets") ?? "[]");
    } catch {
      return [];
    }
  });

  const request = useCallback(
    <T,>(
      method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
      path: string,
      payload: Record<string, unknown> = {},
    ) => clubAdminRequest<T>(telegramInitData, method, path, payload),
    [telegramInitData],
  );
  const refresh = useCallback(async () => {
    setBusy(true);
    setNotice("");
    try {
      const [
        conversationData,
        contentData,
        rewardData,
        claimData,
        partnerData,
        adminData,
        templateData,
        ruleData,
      ] = await Promise.all([
        request<{ conversations: ClubAdminConversation[] }>(
          "GET",
          "/api/admin/conversations",
        ),
        request<{ submissions: ClubAdminSubmission[] }>(
          "GET",
          "/api/admin/content/submissions",
        ),
        request<{ rewards: ClubAdminReward[] }>("GET", "/api/admin/rewards"),
        request<{ claims: ClubAdminClaim[] }>(
          "GET",
          "/api/admin/reward-claims",
        ),
        request<{ partners: Partner[] }>("GET", "/api/admin/partners"),
        request<{ admins: ClubAdmin[] }>("GET", "/api/admin/admins"),
        request<{ templates: Template[] }>(
          "GET",
          "/api/admin/notification-templates",
        ),
        request<{ rules: ReplyRule[] }>("GET", "/api/admin/reply-rules"),
      ]);
      setConversations(conversationData?.conversations ?? []);
      setSubmissions(contentData?.submissions ?? []);
      setRewards(rewardData?.rewards ?? []);
      setClaims(claimData?.claims ?? []);
      setPartners(partnerData?.partners ?? []);
      setAdmins(adminData?.admins ?? []);
      setTemplates(templateData?.templates ?? []);
      setRules(ruleData?.rules ?? []);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "دریافت داده‌های باشگاه ناموفق بود.",
      );
    } finally {
      setBusy(false);
    }
  }, [request]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const selected = useMemo(
    () => conversations.find((item) => item.id === selectedConversationId),
    [conversations, selectedConversationId],
  );
  const openConversation = async (id: string) => {
    setSelectedConversationId(id);
    setMessages([]);
    setArchiveMessageIds([]);
    try {
      const data = await request<{ messages: ClubAdminMessage[] }>(
        "GET",
        `/api/admin/conversations/${id}/messages`,
      );
      setMessages(data?.messages ?? []);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "دریافت گفتگو ناموفق بود.",
      );
    }
  };
  const toggleArchiveSelection = (id: string, kind: "message" | "submission") => {
    const set = kind === "message" ? setArchiveMessageIds : setArchiveSubmissionIds;
    set(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  };
  const saveClubArchive = async (kind: "messages" | "submissions") => {
    const messageIds = kind === "messages" ? archiveMessageIds : [];
    const submissionIds = kind === "submissions" ? archiveSubmissionIds : [];
    if (!messageIds.length && !submissionIds.length) return;
    const category = window.confirm("این مورد محتوای مردمی است؟ «لغو» برای متفرقه.") ? "citizen" : "misc";
    setBusy(true);
    setNotice("");
    try {
      const result = await archiveClubContent(telegramInitData, { messageIds, submissionIds }, category);
      setArchiveMessageIds([]);
      setArchiveSubmissionIds([]);
      setNotice(`در آرشیو ذخیره شد${result?.mediaCount ? `؛ ${fa(result.mediaCount)} فایل هم منتقل شد.` : "."}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "ذخیره در آرشیو ناموفق بود.");
    } finally {
      setBusy(false);
    }
  };
  const sendReply = async () => {
    if (!selectedConversationId || (!reply.trim() && !replyFiles.length)) return;
    setBusy(true);
    try {
      const attachments = await uploadClubFiles(telegramInitData, replyFiles, setReplyProgress);
      const result = await request<{ message: ClubAdminMessage }>(
        "POST",
        `/api/admin/conversations/${selectedConversationId}/messages`,
        { text: reply, attachment_ids: attachments.map(a => a.id), attachment_captions: Object.fromEntries(attachments.map((a, index) => [a.id, replyCaptions[clubFileKey(replyFiles[index])] || ""])), ai_generated: false },
      );
      if (result?.message)
        setMessages((current) => [...current, result.message]);
      setReply("");
      setReplyFiles([]); setReplyCaptions({}); setReplyProgress({});
      await refresh();
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "ارسال پاسخ ناموفق بود.",
      );
    } finally {
      setBusy(false);
    }
  };
  const suggestReply = async () => {
    const incoming = [...messages]
      .reverse()
      .find((message) => message.sender === "member")?.text;
    if (!incoming) return;
    setBusy(true);
    try {
      const data = await getClubAiSuggestion(telegramInitData, incoming);
      if (data?.suggestion) setReply(data.suggestion);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "پیشنهاد AI ناموفق بود.",
      );
    } finally {
      setBusy(false);
    }
  };
  const saveSnippet = () => {
    const text = reply.trim();
    if (!text) return;
    const title =
      window.prompt("نام متن آماده")?.trim() ||
      `متن ${fa(snippets.length + 1)}`;
    const next = [{ title, text }, ...snippets].slice(0, 30);
    setSnippets(next);
    localStorage.setItem("kalam-club-snippets", JSON.stringify(next));
  };
  const reviewContent = async (id: string, target: "approved" | "rejected") => {
    const campaign = submissions.find(s => s.id === id)?.campaign;
    const score =
      target === "approved"
        ? campaign?.points ?? Number(window.prompt("امتیاز این محتوا", "0") ?? 0)
        : 0;
    const note =
      window.prompt(
        target === "approved"
          ? "یادداشت برای مخاطب (اختیاری)"
          : "دلیل رد یا اصلاح محتوا",
      ) ?? "";
    if (target === "rejected" && !note.trim()) return;
    setBusy(true);
    try {
      await request("POST", `/api/admin/content/submissions/${id}/review`, {
        status: target,
        score,
        note,
      });
      await refresh();
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "ثبت بررسی محتوا ناموفق بود.",
      );
    } finally {
      setBusy(false);
    }
  };
  const createPartner = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await request(
        editingPartnerId ? "PUT" : "POST",
        editingPartnerId
          ? `/api/admin/partners/${editingPartnerId}`
          : "/api/admin/partners",
        {
          ...partnerForm,
          active: true,
        },
      );
      setPartnerForm({
        name: "",
        short_description: "",
        address: "",
        phone: "",
        website_url: "",
        logo_attachment_id: "",
      });
      setEditingPartnerId("");
      await refresh();
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "ثبت کسب‌وکار ناموفق بود.",
      );
    } finally {
      setBusy(false);
    }
  };
  const createReward = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await request(
        editingRewardId ? "PUT" : "POST",
        editingRewardId
          ? `/api/admin/rewards/${editingRewardId}`
          : "/api/admin/rewards",
        {
          title: rewardForm.title,
          description: rewardForm.description,
          kind: rewardForm.kind,
          fulfillment_mode: rewardForm.fulfillment_mode,
          points_cost: Number(rewardForm.points_cost),
          stock_total: rewardForm.stock_total
            ? Number(rewardForm.stock_total)
            : null,
          code_expires_after_days:
            rewardForm.kind === "discount_code" &&
            rewardForm.code_expires_after_days
              ? Number(rewardForm.code_expires_after_days)
              : null,
          partner_id: rewardForm.partner_id || null,
          image_attachment_id: rewardForm.image_attachment_id || null,
          active: true,
        },
      );
      setRewardForm({
        title: "",
        description: "",
        kind: "discount_code",
        fulfillment_mode: "manual",
        points_cost: "0",
        stock_total: "",
        code_expires_after_days: "30",
        partner_id: "",
        image_attachment_id: "",
      });
      setEditingRewardId("");
      await refresh();
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "ثبت جایزه ناموفق بود.",
      );
    } finally {
      setBusy(false);
    }
  };
  const deactivateReward = async (id: string) => {
    if (!window.confirm("جایزه غیرفعال شود؟ تاریخچهٔ درخواست‌ها حفظ می‌شود."))
      return;
    setBusy(true);
    try {
      await request("DELETE", `/api/admin/rewards/${id}`);
      await refresh();
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "حذف جایزه ناموفق بود.",
      );
    } finally {
      setBusy(false);
    }
  };
  const editPartner = (partner: Partner) => {
    setEditingPartnerId(partner.id);
    setPartnerForm({
      name: partner.name,
      short_description: partner.shortDescription,
      address: partner.address,
      phone: partner.phone,
      website_url: partner.websiteUrl,
      logo_attachment_id: partner.logoAttachmentId || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const editReward = (reward: ClubAdminReward) => {
    setEditingRewardId(reward.id);
    setRewardForm({
      title: reward.title,
      description: reward.description,
      kind: reward.kind,
      fulfillment_mode: reward.fulfillmentMode,
      points_cost: String(reward.pointsCost),
      stock_total: reward.stockTotal == null ? "" : String(reward.stockTotal),
      code_expires_after_days:
        reward.codeExpiresAfterDays == null
          ? "30"
          : String(reward.codeExpiresAfterDays),
      partner_id: reward.partnerId || "",
      image_attachment_id: reward.imageAttachmentId || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const selectBrandImage = async (
    file: File | undefined,
    purpose: "partner_logo" | "reward_image",
  ) => {
    if (!file) return;
    setBusy(true);
    setNotice("");
    try {
      const uploaded = await uploadClubAdminImage(telegramInitData, file, purpose);
      const attachmentId = uploaded?.attachment.id;
      if (!attachmentId) throw new Error("ثبت تصویر ناموفق بود.");
      if (purpose === "partner_logo") {
        setPartnerForm((current) => ({
          ...current,
          logo_attachment_id: attachmentId,
        }));
      } else {
        setRewardForm((current) => ({
          ...current,
          image_attachment_id: attachmentId,
        }));
      }
      setNotice("تصویر ذخیره شد و پس از اسکن امنیتی در ویترین نمایش داده می‌شود.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "بارگذاری تصویر ناموفق بود.");
    } finally {
      setBusy(false);
    }
  };
  const importCodes = async (rewardId: string) => {
    const codes = (codeText[rewardId] ?? "")
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (!codes.length) return;
    setBusy(true);
    try {
      await request("POST", `/api/admin/rewards/${rewardId}/codes`, { codes });
      setCodeText((current) => ({ ...current, [rewardId]: "" }));
      await refresh();
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "ورود کدها ناموفق بود.",
      );
    } finally {
      setBusy(false);
    }
  };
  const reviewClaim = async (id: string, next: string) => {
    const note = window.prompt("یادداشت وضعیت برای مخاطب (اختیاری)") ?? "";
    setBusy(true);
    try {
      await request("POST", `/api/admin/reward-claims/${id}/review`, {
        status: next,
        note,
      });
      await refresh();
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "به‌روزرسانی جایزه ناموفق بود.",
      );
    } finally {
      setBusy(false);
    }
  };
  const updateRoles = async (target: ClubAdmin, roles: string[]) => {
    setBusy(true);
    try {
      await request(
        "PUT",
        `/api/admin/admins/${encodeURIComponent(target.externalId)}`,
        { display_name: target.displayName, roles, active: target.active },
      );
      await refresh();
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "به‌روزرسانی نقش ناموفق بود.",
      );
    } finally {
      setBusy(false);
    }
  };
  const saveTemplate = async (template: Template) => {
    setBusy(true);
    try {
      await request("PUT", `/api/admin/notification-templates/${template.id}`, {
        body: template.body,
        enabled: template.enabled,
      });
      await refresh();
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "ذخیرهٔ قالب اعلان ناموفق بود.",
      );
    } finally {
      setBusy(false);
    }
  };
  const createRule = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await request("POST", "/api/admin/reply-rules", {
        ...ruleForm,
        priority: Number(ruleForm.priority),
        enabled: true,
      });
      setRuleForm({
        name: "",
        match_mode: "contains",
        match_text: "",
        response_text: "",
        priority: "100",
      });
      await refresh();
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "ثبت قانون پاسخ ناموفق بود.",
      );
    } finally {
      setBusy(false);
    }
  };
  const updateRule = async (rule: ReplyRule, enabled: boolean) => {
    setBusy(true);
    try {
      await request("PUT", `/api/admin/reply-rules/${rule.id}`, {
        name: rule.name,
        enabled,
        match_mode: rule.matchMode,
        match_text: rule.matchText,
        response_text: rule.responseText,
        priority: rule.priority,
      });
      await refresh();
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "به‌روزرسانی قانون پاسخ ناموفق بود.",
      );
    } finally {
      setBusy(false);
    }
  };
  const deleteRule = async (rule: ReplyRule) => {
    if (!window.confirm(`قانون «${rule.name}» حذف شود؟`)) return;
    setBusy(true);
    try {
      await request("DELETE", `/api/admin/reply-rules/${rule.id}`);
      await refresh();
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "حذف قانون پاسخ ناموفق بود.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="club-admin" ref={shellRef}>
      <header className="club-admin-hero">
        <div>
          <span>Club · Community Desk</span>
          <h2>باشگاه مخاطبان</h2>
          <p>
            گفتگو، محتوا، جوایز و اعلان‌ها از یک منبع دادهٔ امن مدیریت می‌شوند.
          </p>
        </div>
        <button
          className="secondary"
          disabled={busy}
          onClick={() => void refresh()}
          type="button"
        >
          {busy ? "در حال دریافت…" : "به‌روزرسانی"}
        </button>
      </header>
      {notice && <p className="error club-notice">{notice}</p>}
      {view === "inbox" && (
        <div className="club-inbox">
          <aside>
            {conversations.length === 0 ? (
              <p className="hint">هنوز گفتگویی ندارید.</p>
            ) : (
              conversations.map((conversation) => (
                <button
                  className={
                    conversation.id === selectedConversationId ? "selected" : ""
                  }
                  key={conversation.id}
                  onClick={() => void openConversation(conversation.id)}
                  type="button"
                >
                  <span>
                    {conversation.member.fullName?.slice(0, 1) || "م"}
                  </span>
                  <div>
                    <b>
                      {conversation.member.fullName ||
                        conversation.member.phone}
                    </b>
                    <small>
                      {conversation.member.city || "بدون شهر"} ·{" "}
                      {fa(conversation.member.score)} امتیاز
                    </small>
                  </div>
                  <time>{when(conversation.lastMessageAt)}</time>
                </button>
              ))
            )}
          </aside>
          <main>
            {!selected ? (
              <div className="club-empty">
                <b>یک گفتگوی مخاطب را انتخاب کنید</b>
                <p>همهٔ ادمین‌های مجاز صندوق مشترک را می‌بینند.</p>
              </div>
            ) : (
              <>
                <header>
                  <button
                    aria-label="بازگشت به فهرست گفتگوها"
                    className="club-mobile-back"
                    onClick={() => setSelectedConversationId("")}
                    type="button"
                  >
                    ›
                  </button>
                  <b>{selected.member.fullName || selected.member.phone}</b>
                  <small>
                    {selected.member.phone} ·{" "}
                    {Object.entries(selected.member.platformHandles || {})
                      .map(([platform, handle]) => `${platform}: @${handle}`)
                      .join(" · ") || "بدون شناسهٔ پلتفرم"}
                  </small>
                </header>
                <div className="club-message-list">
                  {archiveMessageIds.length > 0 && (
                    <div className="club-archive-actions">
                      <b>{fa(archiveMessageIds.length)} پیام انتخاب شده</b>
                      <button className="secondary" disabled={busy} onClick={() => void saveClubArchive("messages")} type="button">ذخیره در آرشیو محتوا</button>
                    </div>
                  )}
                  {messages.map((message) => (
                    <article
                      className={
                        message.sender === "member" ? "incoming" : "outgoing"
                      }
                      key={message.id}
                    >
                      <b>
                        {message.sender === "member"
                          ? "مخاطب"
                          : message.sender === "system"
                            ? "سیستم"
                            : "ادمین"}
                      </b>
                      <label className="club-archive-select">
                        <input checked={archiveMessageIds.includes(message.id)} disabled={busy} onChange={() => toggleArchiveSelection(message.id, "message")} type="checkbox" />
                        انتخاب برای آرشیو
                      </label>
                      <p>{message.text}</p>
                      {message.attachmentIds.length > 0 && (
                        <div className="club-media-grid">{message.attachmentIds.map(id => <ClubAttachment key={id} id={id} initData={telegramInitData} caption={message.attachmentCaptions?.[id]} />)}</div>
                      )}
                      <time>{when(message.sentAt)}</time>
                    </article>
                  ))}
                </div>
                <div className="club-composer">
                  <div className="club-media-grid">{replyFiles.map(file => <MediaCard key={clubFileKey(file)} file={file} caption={replyCaptions[clubFileKey(file)]} onCaption={value => setReplyCaptions(previous => ({ ...previous, [clubFileKey(file)]: value }))} onRemove={() => setReplyFiles(previous => previous.filter(f => f !== file))} progress={replyProgress[clubFileKey(file)]?.percent} error={replyProgress[clubFileKey(file)]?.error} disabled={busy} />)}</div>
                  <div className="snippet-row">
                    {snippets.map((snippet, index) => (
                      <button
                        key={`${snippet.title}-${index}`}
                        onClick={() => setReply(snippet.text)}
                        type="button"
                      >
                        {snippet.title}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={reply}
                    onChange={(event) => setReply(event.target.value)}
                    placeholder="پاسخ انسانی را بنویسید…"
                    rows={4}
                  />
                  <div>
                    <label className="secondary club-file-select">＋ فایل<input type="file" multiple disabled={busy} onChange={event => { setReplyFiles(previous => [...previous, ...Array.from(event.target.files || [])].slice(0, 12)); event.target.value = ""; }} /></label>
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() => void suggestReply()}
                      type="button"
                    >
                      ✦ پیشنهاد AI
                    </button>
                    <button
                      className="secondary"
                      disabled={!reply.trim()}
                      onClick={saveSnippet}
                      type="button"
                    >
                      ذخیره متن آماده
                    </button>
                    <button
                      className="primary"
                      disabled={busy || (!reply.trim() && !replyFiles.length)}
                      onClick={() => void sendReply()}
                      type="button"
                    >
                      ارسال پاسخ
                    </button>
                  </div>
                </div>
              </>
            )}
          </main>
        </div>
      )}
      {view === "content" && (
        <section className="club-admin-list">
          <div className="section-heading">
            <div>
              <h3>همه محتواهای مخاطبان</h3>
              <p className="hint">
                با تأیید، امتیاز ثبت و اعلان پیامکی طبق تنظیمات ارسال می‌شود.
              </p>
            </div>
            <span>
              {fa(
                submissions.filter((item) => item.status === "pending").length,
              )}{" "}
              در انتظار
            </span>
          </div>
          <label>وضعیت محتوا<select value={contentFilter} onChange={e => setContentFilter(e.target.value)}><option value="all">همه محتواها</option><option value="pending">در انتظار بررسی</option><option value="approved">تأیید شده</option><option value="rejected">رد شده</option></select></label>
          {submissions.filter(s => contentFilter === "all" || s.status === contentFilter).length === 0 ? (
            <p className="hint">محتوایی برای بررسی نیست.</p>
          ) : (
            submissions.filter(s => contentFilter === "all" || s.status === contentFilter).map((submission) => (
              <article key={submission.id}>
                <header>
                  <b>{submission.anonymous ? "ارسال‌کننده ناشناس" : (submission.member.fullName || submission.member.phone)}</b>
                  <small>
                    {when(submission.createdAt)} ·{" "}
                    {submission.creditLabel || "طبق پروفایل"}
                  </small>
                  <span className={`club-status ${submission.status}`}>
                    {{ pending: "در انتظار بررسی", approved: "تأیید شده", rejected: "رد شده" }[submission.status]}
                  </span>
                </header>
                {submission.contentCategory === "classifieds" && <p className="notice">نیازمندی · نوع: {submission.classifiedDetails?.type === "hiring" ? "استخدامی" : "گمشده"} · ارتباط: {submission.classifiedDetails?.contact || "ثبت نشده"}</p>}
                {submission.campaign && <p className="notice">هدیه استوری · {submission.campaign.label} · {fa(submission.campaign.points)} امتیاز<br />زمان انتشار اعلام‌شده: {when(submission.campaign.publishedAt)} · شناسه مورد انتظار: <b dir="ltr">@{submission.campaign.handle}</b></p>}
                {submission.status !== "pending" && <div className="club-review-result"><b>{submission.status === "approved" ? "تأییدکننده" : "ردکننده"}: {submission.reviewedBy || "نام ثبت نشده"}</b><p>زمان بررسی: {when(submission.reviewedAt)} · امتیاز: {fa(submission.awardedScore)}</p>{(submission.rejectionReason || submission.adminNote) && <p>{submission.status === "rejected" ? "دلیل رد" : "یادداشت"}: {submission.rejectionReason || submission.adminNote}</p>}</div>}
                {submission.items.map((item) => (
                  <div className="club-content-item" key={item.id}>
                    {item.text && <p>{item.text}</p>}
                    {item.caption && !item.attachmentId && <small>{item.caption}</small>}
                    {item.attachmentId && <ClubAttachment id={item.attachmentId} initData={telegramInitData} caption={item.caption} />}
                  </div>
                ))}
                <label className="club-archive-select">
                  <input checked={archiveSubmissionIds.includes(submission.id)} disabled={busy} onChange={() => toggleArchiveSelection(submission.id, "submission")} type="checkbox" />
                  انتخاب برای آرشیو
                </label>
                {submission.status === "pending" && (
                  <footer>
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() =>
                        void reviewContent(submission.id, "rejected")
                      }
                      type="button"
                    >
                      رد / درخواست اصلاح
                    </button>
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={() =>
                        void reviewContent(submission.id, "approved")
                      }
                      type="button"
                    >
                      تأیید و امتیازدهی
                    </button>
                  </footer>
                )}
              </article>
            ))
          )}
          {archiveSubmissionIds.length > 0 && (
            <div className="club-archive-actions">
              <b>{fa(archiveSubmissionIds.length)} محتوای انتخاب شده</b>
              <button className="secondary" disabled={busy} onClick={() => void saveClubArchive("submissions")} type="button">ذخیره در آرشیو محتوا</button>
              {archiveSubmissionIds.length <= 4 && submissions.filter(item => archiveSubmissionIds.includes(item.id) && item.contentCategory === "classifieds").length === archiveSubmissionIds.length && onClassifiedsSelected && <button className="primary" disabled={busy} onClick={() => onClassifiedsSelected(submissions.filter(item => archiveSubmissionIds.includes(item.id)).map(item => ({ category: item.classifiedDetails?.type === "hiring" ? "hiring" : "lost_found", title: item.items.find(part => part.text)?.text?.slice(0, 80) || "", body: item.items.find(part => part.text)?.text || "", contact: item.classifiedDetails?.contact || "" })))}>ارسال ۴تایی به تصویرساز نیازمندی‌ها</button>}
            </div>
          )}
        </section>
      )}
      {view === "rewards" && (
        <section className="club-rewards-admin">
          <ClubCampaignAdmin initData={telegramInitData} />
          <div className="club-admin-forms">
            <form onSubmit={createPartner}>
              <h3>{editingPartnerId ? "ویرایش کسب‌وکار" : "کسب‌وکار جدید"}</h3>
              <input
                required
                value={partnerForm.name}
                onChange={(event) =>
                  setPartnerForm({ ...partnerForm, name: event.target.value })
                }
                placeholder="نام کسب‌وکار"
              />
              <textarea
                value={partnerForm.short_description}
                onChange={(event) =>
                  setPartnerForm({
                    ...partnerForm,
                    short_description: event.target.value,
                  })
                }
                placeholder="توضیح کوتاه"
                rows={3}
              />
              <input
                value={partnerForm.address}
                onChange={(event) =>
                  setPartnerForm({
                    ...partnerForm,
                    address: event.target.value,
                  })
                }
                placeholder="آدرس"
              />
              <input
                value={partnerForm.phone}
                onChange={(event) =>
                  setPartnerForm({ ...partnerForm, phone: event.target.value })
                }
                placeholder="تلفن"
              />
              <input
                value={partnerForm.website_url}
                onChange={(event) =>
                  setPartnerForm({
                    ...partnerForm,
                    website_url: event.target.value,
                  })
                }
                placeholder="وب‌سایت (اختیاری)"
              />
              <label className="club-image-input">
                لوگوی کسب‌وکار (JPG، PNG یا WebP تا ۴ مگابایت)
                <input
                  accept="image/jpeg,image/png,image/webp"
                  disabled={busy}
                  onChange={(event) =>
                    void selectBrandImage(
                      event.currentTarget.files?.[0],
                      "partner_logo",
                    )
                  }
                  type="file"
                />
              </label>
              {partnerForm.logo_attachment_id && (
                <small className="club-media-selected">
                  لوگو انتخاب شد؛ پس از اسکن امن نمایش داده می‌شود.
                </small>
              )}
              <button className="secondary" disabled={busy}>
                {editingPartnerId ? "ذخیرهٔ کسب‌وکار" : "افزودن کسب‌وکار"}
              </button>
              {editingPartnerId && (
                <button
                  className="link-button"
                  onClick={() => {
                    setEditingPartnerId("");
                    setPartnerForm({
                      name: "",
                      short_description: "",
                      address: "",
                      phone: "",
                      website_url: "",
                      logo_attachment_id: "",
                    });
                  }}
                  type="button"
                >
                  انصراف
                </button>
              )}
            </form>
            <form onSubmit={createReward}>
              <h3>{editingRewardId ? "ویرایش جایزه" : "جایزه جدید"}</h3>
              <input
                required
                value={rewardForm.title}
                onChange={(event) =>
                  setRewardForm({ ...rewardForm, title: event.target.value })
                }
                placeholder="عنوان جایزه"
              />
              <textarea
                value={rewardForm.description}
                onChange={(event) =>
                  setRewardForm({
                    ...rewardForm,
                    description: event.target.value,
                  })
                }
                placeholder="توضیح جایزه"
                rows={3}
              />
              <label className="club-image-input">
                تصویر ویترین جایزه (JPG، PNG یا WebP تا ۴ مگابایت)
                <input
                  accept="image/jpeg,image/png,image/webp"
                  disabled={busy}
                  onChange={(event) =>
                    void selectBrandImage(
                      event.currentTarget.files?.[0],
                      "reward_image",
                    )
                  }
                  type="file"
                />
              </label>
              {rewardForm.image_attachment_id && (
                <small className="club-media-selected">
                  تصویر انتخاب شد؛ پس از اسکن امن نمایش داده می‌شود.
                </small>
              )}
              <select
                value={rewardForm.partner_id}
                onChange={(event) =>
                  setRewardForm({
                    ...rewardForm,
                    partner_id: event.target.value,
                  })
                }
              >
                <option value="">بدون کسب‌وکار</option>
                {partners
                  .filter((item) => item.active)
                  .map((partner) => (
                    <option key={partner.id} value={partner.id}>
                      {partner.name}
                    </option>
                  ))}
              </select>
              <div className="form-row">
                <select
                  value={rewardForm.kind}
                  onChange={(event) =>
                    setRewardForm({ ...rewardForm, kind: event.target.value })
                  }
                >
                  <option value="discount_code">کد تخفیف</option>
                  <option value="cash">جایزه نقدی</option>
                  <option value="mobile_credit">شارژ سیم‌کارت</option>
                  <option value="internet_package">بسته اینترنت</option>
                  <option value="partner_benefit">مزیت کسب‌وکار</option>
                </select>
                <select
                  value={rewardForm.fulfillment_mode}
                  onChange={(event) =>
                    setRewardForm({
                      ...rewardForm,
                      fulfillment_mode: event.target.value,
                    })
                  }
                >
                  <option value="manual">تأیید دستی</option>
                  <option value="automatic">تحویل خودکار</option>
                </select>
              </div>
              <div className="form-row">
                <input
                  min="0"
                  value={rewardForm.points_cost}
                  onChange={(event) =>
                    setRewardForm({
                      ...rewardForm,
                      points_cost: event.target.value,
                    })
                  }
                  placeholder="امتیاز"
                  type="number"
                />
                <input
                  min="0"
                  value={rewardForm.stock_total}
                  onChange={(event) =>
                    setRewardForm({
                      ...rewardForm,
                      stock_total: event.target.value,
                    })
                  }
                  placeholder="موجودی (اختیاری)"
                  type="number"
                />
              </div>
              {rewardForm.kind === "discount_code" && (
                <input
                  min="1"
                  value={rewardForm.code_expires_after_days}
                  onChange={(event) =>
                    setRewardForm({
                      ...rewardForm,
                      code_expires_after_days: event.target.value,
                    })
                  }
                  placeholder="اعتبار کد پس از تخصیص (روز)"
                  type="number"
                />
              )}
              <button className="primary" disabled={busy}>
                {editingRewardId ? "ذخیرهٔ جایزه" : "افزودن جایزه"}
              </button>
              {editingRewardId && (
                <button
                  className="link-button"
                  onClick={() => {
                    setEditingRewardId("");
                    setRewardForm({
                      title: "",
                      description: "",
                      kind: "discount_code",
                      fulfillment_mode: "manual",
                      points_cost: "0",
                      stock_total: "",
                      code_expires_after_days: "30",
                      partner_id: "",
                      image_attachment_id: "",
                    });
                  }}
                  type="button"
                >
                  انصراف
                </button>
              )}
            </form>
          </div>
          <div className="club-admin-list partner-list">
            <h3>کسب‌وکارهای ویترین</h3>
            {partners.length === 0 ? (
              <p className="hint">هنوز کسب‌وکاری ثبت نشده است.</p>
            ) : (
              partners.map((partner) => (
                <article key={partner.id}>
                  <header>
                    <b>{partner.name}</b>
                    <span
                      className={`club-status ${partner.active ? "approved" : "rejected"}`}
                    >
                      {partner.active ? "فعال" : "غیرفعال"}
                    </span>
                  </header>
                  <small>
                    {partner.address || "بدون آدرس"}{" "}
                    {partner.phone ? `· ${partner.phone}` : ""}
                  </small>
                  <p>{partner.shortDescription}</p>
                  <footer>
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() => editPartner(partner)}
                      type="button"
                    >
                      ویرایش کسب‌وکار
                    </button>
                  </footer>
                </article>
              ))
            )}
          </div>
          <div className="club-admin-list">
            {rewards.map((reward) => (
              <article key={reward.id}>
                <header>
                  <b>{reward.title}</b>
                  <small>
                    {reward.partner?.name || "باشگاه کلام تازه"} ·{" "}
                    {fa(reward.pointsCost)} امتیاز
                  </small>
                  <span
                    className={`club-status ${reward.active ? "approved" : "rejected"}`}
                  >
                    {reward.active ? "فعال" : "غیرفعال"}
                  </span>
                </header>
                <p>{reward.description}</p>
                <small>
                  موجودی:{" "}
                  {reward.stockRemaining == null
                    ? "نامحدود"
                    : fa(reward.stockRemaining)}
                </small>
                {reward.kind === "discount_code" && (
                  <div className="code-import">
                    <textarea
                      value={codeText[reward.id] ?? ""}
                      onChange={(event) =>
                        setCodeText({
                          ...codeText,
                          [reward.id]: event.target.value,
                        })
                      }
                      placeholder="کدهای یکتا؛ هر خط یک کد"
                      rows={3}
                    />
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() => void importCodes(reward.id)}
                      type="button"
                    >
                      افزودن کدها
                    </button>
                  </div>
                )}
                <footer>
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() => editReward(reward)}
                    type="button"
                  >
                    ویرایش جایزه
                  </button>
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() => void deactivateReward(reward.id)}
                    type="button"
                  >
                    غیرفعال‌سازی امن
                  </button>
                </footer>
              </article>
            ))}
          </div>
        </section>
      )}
      {view === "claims" && (
        <section className="club-admin-list">
          <div className="section-heading">
            <div>
              <h3>درخواست‌های جوایز</h3>
              <p className="hint">
                امتیاز هنگام درخواست رزرو شده و در صورت رد خودکار بازمی‌گردد.
              </p>
            </div>
          </div>
          {claims.map((claim) => (
            <article key={claim.id}>
              <header>
                <b>{claim.reward.title}</b>
                <small>
                  {claim.member.fullName || claim.member.phone} ·{" "}
                  {fa(claim.pointsDebited)} امتیاز · {when(claim.createdAt)}
                </small>
                <span className={`club-status ${claim.status}`}>
                  {claim.status}
                </span>
              </header>
              {claim.fulfillmentNote && <p>{claim.fulfillmentNote}</p>}
              <footer>
                {claim.status === "pending" && (
                  <>
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() => void reviewClaim(claim.id, "rejected")}
                      type="button"
                    >
                      رد و بازگشت امتیاز
                    </button>
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={() => void reviewClaim(claim.id, "approved")}
                      type="button"
                    >
                      تأیید
                    </button>
                  </>
                )}
                {claim.status === "approved" && (
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() => void reviewClaim(claim.id, "delivered")}
                    type="button"
                  >
                    ثبت تحویل
                  </button>
                )}
                {claim.status === "delivered" && (
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() => void reviewClaim(claim.id, "redeemed")}
                    type="button"
                  >
                    ثبت استفاده‌شده
                  </button>
                )}
              </footer>
            </article>
          ))}
        </section>
      )}
      {view === "settings" && (
        <section className="club-settings">
          <div className="club-admin-list">
            <h3>دسترسی ادمین‌ها</h3>
            {admins.map((admin) => (
              <article key={admin.externalId}>
                <header>
                  <b>{admin.displayName || admin.externalId}</b>
                  <small>{admin.externalId}</small>
                </header>
                <div className="role-options">
                  {Object.entries(roleLabels).map(([role, label]) => (
                    <label key={role}>
                      <input
                        checked={admin.roles.includes(role)}
                        onChange={() =>
                          void updateRoles(
                            admin,
                            admin.roles.includes(role)
                              ? admin.roles.filter((item) => item !== role)
                              : [...admin.roles, role],
                          )
                        }
                        type="checkbox"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </article>
            ))}
          </div>
          <div className="club-admin-list">
            <h3>قالب‌های اعلان پیامکی</h3>
            {templates.map((template) => (
              <article key={template.id}>
                <header>
                  <b>{template.eventKey}</b>
                  <span
                    className={`club-status ${template.enabled ? "approved" : "rejected"}`}
                  >
                    {template.enabled ? "فعال" : "خاموش"}
                  </span>
                </header>
                <textarea
                  onChange={(event) =>
                    setTemplates((current) =>
                      current.map((item) =>
                        item.id === template.id
                          ? { ...item, body: event.target.value }
                          : item,
                      ),
                    )
                  }
                  rows={3}
                  value={template.body}
                />
                <footer>
                  <label className="checkbox-row">
                    <input
                      checked={template.enabled}
                      onChange={(event) =>
                        setTemplates((current) =>
                          current.map((item) =>
                            item.id === template.id
                              ? { ...item, enabled: event.target.checked }
                              : item,
                          ),
                        )
                      }
                      type="checkbox"
                    />
                    فعال
                  </label>
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() => void saveTemplate(template)}
                    type="button"
                  >
                    ذخیرهٔ قالب
                  </button>
                </footer>
              </article>
            ))}
          </div>
          <div className="club-admin-list club-rule-settings">
            <div>
              <h3>قوانین پاسخ خودکار</h3>
              <p className="hint">
                فقط متن‌های آمادهٔ شما ارسال می‌شوند؛ AI هرگز خودکار پیام
                نمی‌فرستد. هر قانون در هر گفتگو فقط یک‌بار اجرا می‌شود.
              </p>
            </div>
            <form className="club-rule-form" onSubmit={createRule}>
              <input
                required
                onChange={(event) =>
                  setRuleForm({ ...ruleForm, name: event.target.value })
                }
                placeholder="نام قانون"
                value={ruleForm.name}
              />
              <select
                onChange={(event) =>
                  setRuleForm({ ...ruleForm, match_mode: event.target.value })
                }
                value={ruleForm.match_mode}
              >
                <option value="contains">شامل این عبارت باشد</option>
                <option value="exact">دقیقاً برابر باشد</option>
                <option value="starts_with">با این عبارت شروع شود</option>
              </select>
              <input
                required
                onChange={(event) =>
                  setRuleForm({ ...ruleForm, match_text: event.target.value })
                }
                placeholder="عبارت ورودی مخاطب"
                value={ruleForm.match_text}
              />
              <textarea
                required
                onChange={(event) =>
                  setRuleForm({
                    ...ruleForm,
                    response_text: event.target.value,
                  })
                }
                placeholder="پاسخ ثابت خودکار"
                rows={3}
                value={ruleForm.response_text}
              />
              <input
                min="0"
                onChange={(event) =>
                  setRuleForm({ ...ruleForm, priority: event.target.value })
                }
                placeholder="اولویت (عدد کوچک‌تر زودتر)"
                type="number"
                value={ruleForm.priority}
              />
              <button className="primary" disabled={busy}>
                افزودن قانون
              </button>
            </form>
            {rules.map((rule) => (
              <article key={rule.id}>
                <header>
                  <b>{rule.name}</b>
                  <span
                    className={`club-status ${rule.enabled ? "approved" : "rejected"}`}
                  >
                    {rule.enabled ? "فعال" : "خاموش"}
                  </span>
                </header>
                <small>
                  {rule.matchMode === "exact"
                    ? "برابر"
                    : rule.matchMode === "starts_with"
                      ? "شروع با"
                      : "شامل"}
                  : {rule.matchText} · اولویت {fa(rule.priority)}
                </small>
                <p>{rule.responseText}</p>
                <footer>
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() => void updateRule(rule, !rule.enabled)}
                    type="button"
                  >
                    {rule.enabled ? "غیرفعال‌سازی" : "فعال‌سازی"}
                  </button>
                  <button
                    className="link-button"
                    disabled={busy}
                    onClick={() => void deleteRule(rule)}
                    type="button"
                  >
                    حذف قانون
                  </button>
                </footer>
              </article>
            ))}
          </div>
        </section>
      )}
      <footer className="club-admin-footer" ref={footerRef}>
        <nav>
          <button
            className={view === "inbox" ? "active" : ""}
            onClick={() => setView("inbox")}
            type="button"
          >
            <span aria-hidden="true">💬</span>
            <small>گفتگوها</small>
          </button>
          <button
            className={view === "content" ? "active" : ""}
            onClick={() => setView("content")}
            type="button"
          >
            <span aria-hidden="true">▣</span>
            <small>محتوا</small>
          </button>
          <button
            className={view === "rewards" ? "active" : ""}
            onClick={() => setView("rewards")}
            type="button"
          >
            <span aria-hidden="true">☆</span>
            <small>جوایز</small>
          </button>
          <button
            className={view === "claims" ? "active" : ""}
            onClick={() => setView("claims")}
            type="button"
          >
            <span aria-hidden="true">✓</span>
            <small>درخواست‌ها</small>
          </button>
          <button
            className={view === "settings" ? "active" : ""}
            onClick={() => setView("settings")}
            type="button"
          >
            <span aria-hidden="true">⚙</span>
            <small>تنظیمات</small>
          </button>
        </nav>
        <button onClick={onBack} type="button">
          بازگشت به استودیو
        </button>
      </footer>
    </section>
  );
}
