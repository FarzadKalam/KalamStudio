import {
  ChangeEvent,
  CSSProperties,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AccessView,
  AvalaiUsage,
  AudioTranscriptionJob,
  ContentArticle,
  ContentMedia,
  ContentProject,
  ContentSlide,
  DesignJob,
  DesignPromptPreview,
  EngagementAccount,
  EngagementBulkAnswer,
  EngagementConnection,
  EngagementInboxItem,
  EngagementLeadDraft,
  EngagementKnowledge,
  EngagementPersona,
  EngagementRule,
  EngagementShowcase,
  EngagementShowcaseCard,
  EngagementSalesIntegration,
  ImageModelSettings,
  JobIntermediate,
  TextModelSettings,
  TranscriptionModelSettings,
  UploadTransferProgress,
  VoiceEngine,
  VoiceModelSettings,
  VoiceProject,
  ForwardPlan,
  LibraryProject,
  MediaPublicationTarget,
  NewsSeekerCategory,
  NewsSeekerItem,
  NewsSeekerSnapshot,
  NewsroomQueueEntry,
  NewsroomSource,
  PromptItem,
  PublicationResult,
  PublicationTarget,
  ReporterProfile,
  ReferenceChoice,
  ReferenceSelection,
  SportCompetition,
  SportEvent,
  VideoPlatformTarget,
  VideoAsset,
  VideoAssetProfile,
  VideoAssetProfileOptions,
  VideoAssetRegistry,
  VideoLine,
  VideoTimelineBeat,
  VideoPromptPreview,
  VideoProject,
  VideoProjectInput,
  attachDesignToContentProject,
  archiveEngagementContent,
  bulkReplyEngagementComments,
  bulkMessageEngagementConversations as sendBulkEngagementMessages,
  compressContentVideo,
  createContentProject,
  deleteContentMedia,
  deleteContentProject,
  deliverDesignOutput,
  editDesignJob,
  editDesignJobWithForm,
  getAccessSession,
  getContentIdeas,
  getContentMediaOutput,
  getContentProject,
  getDesignJob,
  getDesignOutput,
  getDesignPublicationPackage,
  getDesignReferenceOutput,
  getDesignSeries,
  getDesignStorySummary,
  getDesignPromptAsset,
  getDesignPromptBundle,
  getEngagementAiSuggestion,
  getEngagementLeadDraft,
  getEngagementInbox,
  getEngagementThread,
  getMarketData,
  getMorningLocalData,
  getOccasionTool,
  getSitePublishSuggestion,
  getSitePublishTerms,
  getSportData,
  getStudioDraft,
  getStudioDraftOutput,
  getWebSession,
  getVideoProject,
  getVideoProjectOutput,
  getVoiceProjectOutput,
  getAudioTranscription,
  importDesignOutputToContentProject,
  listContentProjects,
  listNewsSeekerSnapshots,
  listProjects,
  listVideoProjects,
  listVoiceProjects,
  loginWeb,
  logoutWeb,
  requestWebLoginOtp,
  manageAccess,
  manageDesignJob,
  manageEngagementAccounts,
  manageEngagementKnowledge,
  manageEngagementPersonas,
  manageEngagementRules,
  manageEngagementShowcases,
  manageEngagementSalesIntegration,
  manageEngagementTagCatalog,
  createEngagementLead,
  manageImageModel,
  manageTextModels,
  manageVoiceModels,
  verifyWebLoginOtp,
  manageTranscriptionModels,
  manageNewsroomQueue,
  managePrompts,
  manageWebAccount,
  manageVideoAssets,
  manageVideoProject,
  markEngagementRead,
  previewDesignCaption,
  previewDesignPrompt,
  publishContentPhoto,
  publishContentSite,
  publishContentText,
  replyEngagementInbox,
  requestEngagementProfile,
  requestNewsSeekerRefresh,
  runContentReporter,
  setEngagementTags as assignEngagementTags,
  submitDesignRequest,
  createVideoProject,
  createVideoPrompt,
  createVoiceProject,
  getVideoPromptAsset,
  getVideoPromptBundle,
  updateContentProject,
  uploadEngagementRuleAttachment,
  uploadContentMedia,
  startAudioTranscription,
  manageBrowserNotifications,
  sendContentTeamSms,
  setEngagementStoryContext,
} from "./api";
import { initialiseTelegram, TelegramWebApp } from "./telegram";
import ClubAdmin from "./ClubAdmin";
import ClubShowcaseFields, { emptyClubShowcase, restoreClubShowcase } from "./ClubShowcaseFields";

type Brand = "kalametaze" | "golbahar" | "chenaran";
type Canvas = "story_1080x1920" | "post_1080x1350" | "sticker_1024x1024";
type ImageMode = "generate" | "preserve" | "reference" | "studio" | "none";
type LogoBehavior = "system_header" | "floating_profile" | "none";
type AppTab =
  | "settings"
  | "video"
  | "editorial"
  | "create"
  | "publish"
  | "library"
  | "engagement"
  | "news"
  | "club"
  | "subjects";
const ACTIVE_TAB_STORAGE_KEY = "kalam-studio-active-tab";
const STUDIO_THEME_STORAGE_KEY = "kalam-studio-theme";
const APP_TAB_VALUES: AppTab[] = [
  "settings",
  "video",
  "editorial",
  "create",
  "publish",
  "library",
  "engagement",
  "news",
  "club",
  "subjects",
];

function restoredActiveTab(): AppTab {
  try {
    const saved = window.localStorage.getItem(ACTIVE_TAB_STORAGE_KEY);
    return APP_TAB_VALUES.includes(saved as AppTab) ? (saved as AppTab) : "create";
  } catch {
    return "create";
  }
}
function restoredStudioTheme(): "light" | "dark" {
  try {
    return window.localStorage.getItem(STUDIO_THEME_STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}
type TemplateGroup = "news" | "non_news" | "studio";
type NewsOutputKind = "title_photo" | "title_photo_caption" | "title_only";
type NewsLayout = "top" | "right_column" | "center" | "bottom";
type NewsPhotoFrame = "full" | "landscape" | "square" | "portrait_3_4";
type VideoFrame = "landscape" | "square" | "portrait";
type CitizenMessageType = "text" | "photo" | "video";
type LibraryTab = "images" | "videos" | "texts" | "publications" | "archive";
type PublishUploadItem = {
  id: string;
  file: File;
  loaded: number;
  total: number;
  status: "preparing" | "uploading" | "securing" | "completed" | "failed";
  error?: string;
};
type VideoUploadItem = PublishUploadItem & { kind: "presenter" | "location" | "monitor"; entityId: string };
type DesignSlide = ContentSlide & { id: string; files: File[] };
type SlideSeriesSession = {
  seriesId: string;
  mode: "multi_story" | "carousel";
  currentIndex: number;
  requestIds: Array<string | undefined>;
};
type SlideSeriesOutput = {
  index: number;
  requestId: string;
  filename: string;
  noHeaderFilename?: string;
  url: string;
};
type DesignUploadItem = {
  id: string;
  slideId: string;
  file: File;
  loaded: number;
  total: number;
  status: "preparing" | "uploading" | "securing" | "completed" | "failed";
  error?: string;
};

const brands: Record<Brand, { label: string; color: string }> = {
  kalametaze: { label: "کلام تازه", color: "#b5121b" },
  golbahar: { label: "کلام تازه گلبهار", color: "#50b9eb" },
  chenaran: { label: "کلام تازه چناران", color: "#198754" },
};

const publishPlatforms: Array<{
  id: "telegram" | "eita" | "rubika" | "bale";
  label: string;
}> = [
  { id: "telegram", label: "تلگرام" },
  { id: "eita", label: "ایتا" },
  { id: "rubika", label: "روبیکا" },
  { id: "bale", label: "بله" },
];
const videoPlatforms: Array<{
  id: VideoPlatformTarget;
  label: string;
  icon: string;
}> = [
  { id: "youtube", label: "یوتیوب", icon: "▶" },
  { id: "aparat", label: "آپارات", icon: "◉" },
];
const publishCaptionLimits: Record<string, number> = {
  telegram: 1024,
  eita: 4096,
  rubika: 4096,
  bale: 4096,
};
const videoUploadLimits: Record<string, number> = {
  telegram: 50,
  eita: 50,
  bale: 20,
  rubika: 250,
};
const publishBrandSuffix: Record<Brand, "kalam" | "golbahar" | "chenaran"> = {
  kalametaze: "kalam",
  golbahar: "golbahar",
  chenaran: "chenaran",
};
const reporterProfileCards: Array<{
  id: ReporterProfile;
  label: string;
  description: string;
  icon: string;
  group: "خبر" | "پیام مردمی" | "ادمین";
}> = [
  {
    id: "site",
    label: "خبر سایت",
    description: "نسخهٔ کامل و ساختاریافته",
    icon: "▤",
    group: "خبر",
  },
  {
    id: "post",
    label: "کپشن پست",
    description: "تیتر کاور و کپشن اینستاگرام",
    icon: "◎",
    group: "خبر",
  },
  {
    id: "channel",
    label: "کانال",
    description: "متن مناسب پیام‌رسان",
    icon: "◌",
    group: "خبر",
  },
  {
    id: "story",
    label: "استوری",
    description: "خلاصهٔ کوتاه و تعاملی",
    icon: "▯",
    group: "خبر",
  },
  {
    id: "multi_story",
    label: "استوری خبری چنداسلایدی",
    description: "فیلدهای جدا برای هر اسلاید",
    icon: "▤",
    group: "خبر",
  },
  {
    id: "carousel",
    label: "کاروسل خبری",
    description: "اسلایدهای پست چندتایی",
    icon: "▦",
    group: "خبر",
  },
  {
    id: "reel",
    label: "ریل",
    description: "قلاب و کپشن ویدیو",
    icon: "▷",
    group: "خبر",
  },
  {
    id: "scenario",
    label: "سناریوی مجری",
    description: "متن اجرا و کپشن",
    icon: "◉",
    group: "خبر",
  },
  {
    id: "titles",
    label: "تیترهای پیشنهادی",
    description: "چند تیتر قابل انتخاب",
    icon: "✦",
    group: "خبر",
  },
  {
    id: "analysis",
    label: "تحلیل",
    description: "واقعیت‌ها، زمینه و پرسش‌های باز",
    icon: "◈",
    group: "خبر",
  },
  {
    id: "infographic_data",
    label: "آمار اینفوگرافی",
    description: "دادهٔ ساختاریافته برای طراحی",
    icon: "▥",
    group: "خبر",
  },
  {
    id: "channel_teaser",
    label: "تیزر عضویت کانال",
    description: "تیتر کوتاه و لینک عضویت",
    icon: "↗",
    group: "خبر",
  },
  {
    id: "citizen_clean",
    label: "ویرایش دستوری",
    description: "بدون تغییر در واقعیت پیام",
    icon: "✓",
    group: "پیام مردمی",
  },
  {
    id: "citizen_short",
    label: "تیتر و خبر کوتاه",
    description: "جمع‌وجور و بی‌طرف",
    icon: "▣",
    group: "پیام مردمی",
  },
  {
    id: "citizen_report",
    label: "گزارش",
    description: "تیتر، لید و بدنهٔ منظم",
    icon: "▤",
    group: "پیام مردمی",
  },
  {
    id: "citizen_multi_story",
    label: "پیام مردمی چنداسلایدی",
    description: "روایت مرحله‌ای و بی‌طرف",
    icon: "▤",
    group: "پیام مردمی",
  },
  {
    id: "admin_multi_story",
    label: "یادداشت ادمین چنداسلایدی",
    description: "توضیح/یادداشت قابل ویرایش",
    icon: "✦",
    group: "ادمین",
  },
];

const templateDefinitions = [
  { id: "club_news", label: "محتوای باشگاه مخاطبان", group: "news", fields: ["title", "subtitle", "caption", "source"], titleOnly: false },
  { id: "club_content", label: "محتوای باشگاه مخاطبان", group: "non_news", fields: ["title", "subtitle", "caption", "source"], titleOnly: false },
  { id: "club_studio", label: "محتوای باشگاه مخاطبان", group: "studio", fields: [], titleOnly: false },
  { id: "club_showcase", label: "ویترین باشگاه مخاطبان", group: "non_news", fields: [], titleOnly: false },
  { id: "club_promotion", label: "پوستر معرفی باشگاه مخاطبان", group: "non_news", fields: ["title", "subtitle", "caption", "source"], titleOnly: false },
  {
    id: "news_story",
    label: "استوری خبر",
    group: "news",
    fields: ["kicker", "title", "subtitle", "caption", "source"],
    titleOnly: true,
  },
  {
    id: "news_post",
    label: "پست خبر",
    group: "news",
    fields: ["kicker", "title", "subtitle", "caption", "source"],
    titleOnly: true,
  },
  {
    id: "photo_report",
    label: "گزارش تصویری",
    group: "news",
    fields: ["title", "caption", "source"],
    titleOnly: false,
  },
  {
    id: "video_placeholder",
    label: "استوری ویدیویی",
    group: "news",
    fields: ["kicker", "title", "subtitle", "caption", "source", "videoNote"],
    titleOnly: false,
  },
  {
    id: "citizen_message",
    label: "استوری پیام مردمی",
    group: "news",
    fields: [],
    titleOnly: false,
  },
  {
    id: "sport",
    label: "ورزشی",
    group: "news",
    fields: [],
    titleOnly: false,
  },
  {
    id: "morning_local",
    label: "صبح بخیر محلی",
    group: "non_news",
    fields: [],
    titleOnly: false,
  },
  {
    id: "morning_kalam",
    label: "صبح بخیر پیج کلام",
    group: "non_news",
    fields: [],
    titleOnly: false,
  },
  {
    id: "market",
    label: "قیمت روز طلا و ارز",
    group: "non_news",
    fields: [],
    titleOnly: false,
  },
  {
    id: "infographic",
    label: "اینفوگرافی",
    group: "non_news",
    fields: [],
    titleOnly: false,
  },
  {
    id: "poster",
    label: "پوستر حرفه‌ای",
    group: "non_news",
    fields: [],
    titleOnly: false,
  },
  {
    id: "sticker",
    label: "استیکر PNG شفاف",
    group: "non_news",
    fields: [],
    titleOnly: false,
  },
  {
    id: "classifieds",
    label: "آگهی نیازمندی‌ها",
    group: "non_news",
    fields: [],
    titleOnly: false,
  },
  {
    id: "occasion_greeting",
    label: "تبریک / تسلیت مناسبت‌ها",
    group: "non_news",
    fields: [],
    titleOnly: false,
  },
  {
    id: "editorial_note",
    label: "یادداشت سردبیر / ادمین",
    group: "non_news",
    fields: ["title", "caption", "source"],
    titleOnly: false,
  },
  {
    id: "night",
    label: "استوری شبانه",
    group: "non_news",
    fields: [],
    titleOnly: false,
  },
  {
    id: "home_tip",
    label: "ترفند خانه‌داری",
    group: "non_news",
    fields: [],
    titleOnly: false,
  },
  {
    id: "visual_riddle",
    label: "معمای تصویری",
    group: "non_news",
    fields: ["title", "caption"],
    titleOnly: false,
  },
  {
    id: "nature",
    label: "طبیعت‌گردی",
    group: "non_news",
    fields: ["title", "caption", "source"],
    titleOnly: false,
  },
  {
    id: "poll_story",
    label: "استوری نظرسنجی",
    group: "non_news",
    fields: ["title", "caption"],
    titleOnly: false,
  },
  {
    id: "poll_post",
    label: "پست نظرسنجی",
    group: "non_news",
    fields: ["title", "caption"],
    titleOnly: false,
  },
  {
    id: "studio",
    label: "تصویر استودیو",
    group: "studio",
    fields: [],
    titleOnly: false,
  },
] as const;

const brandHeaders: Record<Brand, string> = {
  kalametaze: "/studio/headers/kalametaze.png",
  golbahar: "/studio/headers/golbahar.png",
  chenaran: "/studio/headers/chenaran.png",
};

const initialContent = {
  kicker: "",
  title: "",
  subtitle: "",
  caption: "",
  source: "",
  dataPoints: "",
  videoNote: "",
  senderContext: "",
  interactionText: "",
  additionalInstructions: "",
  imagePrompt: "",
  referenceInstructions: "",
  prayerTimes: "",
  weather: "",
  riddle: "",
  occasions: "",
  marketRates: "",
  citizenMessageText: "",
  citizenHeadline: "",
  citizenResponse: "",
  citizenInteraction: "",
  morningCity: "golbahar",
  morningLocation: "",
  morningPhotoCredit: "",
  morningWeekday: "",
  morningPersianDate: "",
  morningGregorianDate: "",
  morningHijriDate: "",
  morningLocalOccasion: "",
  morningWeatherCondition: "",
  morningMinTemperature: "",
  morningMaxTemperature: "",
  morningWindSpeed: "",
  morningHumidity: "",
  morningAttire: "",
  morningFajr: "",
  morningSunrise: "",
  morningNoon: "",
  morningSunset: "",
  morningMaghrib: "",
  morningMidnight: "",
  morningGameName: "معمای امروز",
  morningRiddleQuestion: "",
  morningRiddleAnswer: "",
  morningRiddleHint: "چندتا می‌تونی حدس بزنی؟",
  morningVisualRiddleIdea: "",
  morningVisualRiddleAnswer: "",
  morningKalamWeekLabel: "",
  morningKalamDay1: "",
  morningKalamDay2: "",
  morningKalamDay3: "",
  morningKalamDay4: "",
  morningKalamDay5: "",
  morningKalamDay6: "",
  morningKalamDay7: "",
  morningKalamTodayIndex: "1",
  morningKalamOccasion: "",
  morningKalamLocation: "",
  morningKalamPhotoCredit: "",
  marketWeekday: "",
  marketPersianDate: "",
  marketGregorianDate: "",
  marketHijriDate: "",
  marketTime: "",
  marketSource: "",
  marketUsdPrice: "",
  marketUsdChange: "",
  marketEurPrice: "",
  marketEurChange: "",
  marketCoinPrice: "",
  marketCoinChange: "",
  marketGold18Price: "",
  marketGold18Change: "",
  marketBitcoinPrice: "",
  marketBitcoinChange: "",
  editorialNoteStyle: "auto",
  occasionTone: "congratulation",
  occasionCategory: "religious",
  occasionName: "",
  occasionDate: "",
  occasionHeadline: "",
  occasionMessage: "",
  occasionSignature: "نشریه و پایگاه خبری کلام تازه",
  nightKind: "book",
  nightFreshness: "classic",
  nightItem: "",
  nightPrompt: "",
  homeTipPrompt: "",
  infographicTopic: "",
  infographicSourceText: "",
  sportMode: "result",
  sportCompetition: "",
  sportEventIds: "[]",
  sportVisualAssets: "[]",
  sportTeam: "",
  sportResults: "",
  sportSource: "",
  posterPurpose: "promotion",
  posterHeadline: "",
  posterSubheadline: "",
  posterBody: "",
  posterCta: "",
  posterStyle: "modern",
  stickerKind: "news",
  stickerText: "",
  stickerSubtext: "",
  classifiedsJson: '[{"category":"lost_found","title":"","body":"","contact":""}]',
};

type ClassifiedAd = {
  category: "lost_found" | "job_seeker" | "hiring" | "services" | "housing" | "other";
  title: string;
  body: string;
  contact: string;
};

const classifiedCategories: Array<{
  id: ClassifiedAd["category"];
  label: string;
}> = [
  { id: "lost_found", label: "گمشده / پیدا شده" },
  { id: "job_seeker", label: "جویای کار" },
  { id: "hiring", label: "استخدام" },
  { id: "services", label: "خدمات" },
  { id: "housing", label: "مسکن" },
  { id: "other", label: "سایر" },
];

const emptyClassifiedAd = (): ClassifiedAd => ({
  category: "lost_found",
  title: "",
  body: "",
  contact: "",
});

const parseClassifiedAds = (value: string): ClassifiedAd[] => {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, 4).map((item): ClassifiedAd => {
      const raw = recordValue(item);
      const category = classifiedCategories.some((entry) => entry.id === raw.category)
        ? (raw.category as ClassifiedAd["category"])
        : "other";
      return {
        category,
        title: textValue(raw.title).slice(0, 56),
        body: textValue(raw.body).slice(0, 220),
        contact: textValue(raw.contact).slice(0, 96),
      };
    });
  } catch {
    return [];
  }
};

const toPersianDigits = (value: string) =>
  value.replace(
    /[0-9٠-٩]/g,
    (digit) => "۰۱۲۳۴۵۶۷۸۹"["0123456789٠١٢٣٤٥٦٧٨٩".indexOf(digit) % 10],
  );
const toLatinDigits = (value: string) =>
  value.replace(
    /[۰-۹٠-٩]/g,
    (digit) => "0123456789"["۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩".indexOf(digit) % 10],
  );
const utf8ByteLength = (value: string) => new TextEncoder().encode(value).length;
const formatUploadBytes = (bytes: number) => {
  if (bytes < 1024 * 1024)
    return `${toPersianDigits((bytes / 1024).toFixed(0))} کیلوبایت`;
  return `${toPersianDigits((bytes / 1024 / 1024).toFixed(1))} مگابایت`;
};

function UploadQueueRows({ items }: { items: PublishUploadItem[] }) {
  return <>{items.map((item) => {
    const percent = item.total > 0 ? Math.min(100, Math.round((item.loaded / item.total) * 100)) : 0;
    const statusLabel = item.status === "preparing"
      ? "در حال آماده‌سازی…"
      : item.status === "uploading"
        ? `در حال ارسال: ${formatUploadBytes(item.loaded)} از ${formatUploadBytes(item.total)}`
        : item.status === "securing"
          ? "۱۰۰٪ ارسال شد؛ در حال ذخیره و تأیید امن در سرور…"
          : item.status === "completed"
            ? "بارگذاری و ذخیرهٔ امن انجام شد"
            : (item.error ?? "بارگذاری ناموفق بود");
    return <article className={`upload-queue-item status-${item.status}`} key={item.id}>
      <span>{item.file.type.startsWith("video/") ? "🎬" : "🖼️"}</span>
      <div>
        <b>{item.file.name}</b>
        <small>{statusLabel}</small>
        <div aria-label={`${toPersianDigits(String(percent))} درصد`} aria-valuemax={100} aria-valuemin={0} aria-valuenow={percent} className="upload-progress" role="progressbar"><i style={{ width: `${percent}%` }} /></div>
      </div>
      <strong>{toPersianDigits(String(percent))}٪</strong>
    </article>;
  })}</>;
}
const formatEngagementTime = (timestamp: number) =>
  new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp * 1000));
const subjectSourceLabel = (source?: Record<string, string>) => ({ instagram: "دایرکت/کامنت اینستاگرام", club: "پیام باشگاه", manual: "ثبت دستی", ai_editor: "ویرایشگر متنی", news_seeker: "جستجوگر خبر" }[String(source?.kind || "")] || source?.label || "سوژهٔ خبری");

function BookmarkIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M6 3.75A1.75 1.75 0 0 1 7.75 2h8.5A1.75 1.75 0 0 1 18 3.75V22l-6-3.8L6 22V3.75Z" /></svg>;
}

const pushKeyBytes = (key: string) => {
  const padded = `${key}${"=".repeat((4 - key.length % 4) % 4)}`.replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(padded);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
};

function emptySlide(): ContentSlide {
  return {
    kicker: "",
    title: "",
    subtitle: "",
    body: "",
    footer: "",
    titleLayout: "top",
    imageMode: "generate",
    additionalInstructions: "",
    imagePrompt: "",
    referenceInstructions: "",
    presenterIds: [],
    presenterReferenceSelection: {},
    imageEngine: "",
    studioLocationId: "",
    studioLocationMode: undefined,
    studioLocationAssetIds: [],
    studioLocationPrompt: "",
    studioLocationReferenceInstructions: "",
    studioLocationReferences: automaticReferenceChoice(),
  };
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function textValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function imageModeValue(value: unknown): ImageMode {
  return value === "preserve" ||
    value === "reference" ||
    value === "studio" ||
    value === "none" ||
    value === "generate"
    ? value
    : "generate";
}

function slideFromDesignJob(job: DesignJob): DesignSlide {
  const request = recordValue(job.request);
  const format = recordValue(request.format);
  const content = recordValue(request.content);
  const image = recordValue(request.image);
  const studio = recordValue(format.studio);
  const studioLocation = recordValue(studio.location);
  const studioReferences = recordValue(studio.referenceSelection);
  const template = textValue(format.template);
  const citizen = template === "citizen_message";
  const editorial = template === "editorial_note";
  return {
    id: crypto.randomUUID(),
    kicker: textValue(content.kicker),
    title: citizen
      ? textValue(content.citizenHeadline)
      : textValue(content.title),
    subtitle: citizen
      ? textValue(content.citizenResponse)
      : textValue(content.subtitle),
    body: citizen
      ? textValue(content.citizenMessageText)
      : textValue(content.caption),
    footer: citizen
      ? textValue(content.citizenInteraction)
      : editorial
        ? textValue(content.source)
        : textValue(content.interactionText),
    titleLayout: ["right_column", "center", "bottom"].includes(
      textValue(recordValue(format.news).layout),
    )
      ? (textValue(recordValue(format.news).layout) as NewsLayout)
      : "top",
    imageMode: imageModeValue(image.mode),
    additionalInstructions: textValue(content.additionalInstructions),
    imagePrompt: textValue(image.prompt),
    referenceInstructions: textValue(image.referenceInstructions),
    presenterIds: Array.isArray(image.presenterIds)
      ? image.presenterIds.filter(
          (item): item is string =>
            typeof item === "string" && item in presenterLabels,
        )
      : [],
    presenterReferenceSelection: Object.fromEntries(
      Object.entries(recordValue(recordValue(image.referenceSelection).presenters))
        .filter(([id]) => id in presenterLabels)
        .map(([id, choice]) => [id, normaliseReferenceChoice(choice)]),
    ),
    imageEngine: [
      "gemini-3.1-flash-image",
      "gemini-3.1-flash-lite-image",
      "gpt-image-2",
      "gpt-image-2.5-flare",
      "gpt-image-2.5-sunburst",
    ].includes(textValue(image.engine))
      ? textValue(image.engine)
      : "",
    studioLocationId: textValue(studio.locationId),
    studioLocationMode: [
      "catalog",
      "generated_prompt",
      "exact_reference",
      "faithful_reference",
    ].includes(textValue(studioLocation.mode))
      ? (textValue(studioLocation.mode) as ContentSlide["studioLocationMode"])
      : undefined,
    studioLocationAssetIds: Array.isArray(studioLocation.assetIds)
      ? (studioLocation.assetIds as unknown[]).filter((item): item is string => typeof item === "string")
      : [],
    studioLocationPrompt: textValue(studioLocation.prompt),
    studioLocationReferenceInstructions: textValue(studioLocation.referenceInstructions),
    studioLocationReferences: normaliseReferenceChoice(studioReferences.location),
    files: [],
  };
}

function slideFromSavedDeck(value: unknown): DesignSlide {
  const slide = recordValue(value);
  return {
    id: crypto.randomUUID(),
    kicker: textValue(slide.kicker),
    title: textValue(slide.title),
    subtitle: textValue(slide.subtitle),
    body: textValue(slide.body),
    footer: textValue(slide.footer),
    titleLayout: ["right_column", "center", "bottom"].includes(
      textValue(slide.titleLayout),
    )
      ? (textValue(slide.titleLayout) as NewsLayout)
      : "top",
    imageMode: imageModeValue(slide.imageMode),
    additionalInstructions: textValue(slide.additionalInstructions),
    imagePrompt: textValue(slide.imagePrompt),
    referenceInstructions: textValue(slide.referenceInstructions),
    presenterIds: Array.isArray(slide.presenterIds)
      ? slide.presenterIds.filter(
          (item): item is string =>
            typeof item === "string" && item in presenterLabels,
        )
      : [],
    presenterReferenceSelection: Object.fromEntries(
      Object.entries(recordValue(slide.presenterReferenceSelection))
        .filter(([id]) => id in presenterLabels)
        .map(([id, choice]) => [id, normaliseReferenceChoice(choice)]),
    ),
    imageEngine: [
      "gemini-3.1-flash-image",
      "gemini-3.1-flash-lite-image",
      "gpt-image-2",
      "gpt-image-2.5-flare",
      "gpt-image-2.5-sunburst",
    ].includes(textValue(slide.imageEngine))
      ? textValue(slide.imageEngine)
      : "",
    studioLocationId: textValue(slide.studioLocationId),
    studioLocationMode: [
      "catalog",
      "generated_prompt",
      "exact_reference",
      "faithful_reference",
    ].includes(textValue(slide.studioLocationMode))
      ? (textValue(slide.studioLocationMode) as ContentSlide["studioLocationMode"])
      : undefined,
    studioLocationAssetIds: Array.isArray(slide.studioLocationAssetIds)
      ? slide.studioLocationAssetIds.filter((item): item is string => typeof item === "string")
      : [],
    studioLocationPrompt: textValue(slide.studioLocationPrompt),
    studioLocationReferenceInstructions: textValue(slide.studioLocationReferenceInstructions),
    studioLocationReferences: normaliseReferenceChoice(slide.studioLocationReferences),
    files: [],
  };
}

function seriesInfo(
  request: Record<string, unknown> | undefined,
):
  | {
      seriesId: string;
      mode: "multi_story" | "carousel";
      slideIndex: number;
      slideCount: number;
    }
  | undefined {
  const format = recordValue(request?.format);
  const declaredMode = format.slideMode;
  const declaredSlideCount = Number(format.slideCount);
  // Older carousel jobs did not always persist slideMode at the top level.
  // Their canvas/template and count are still an unambiguous series signal,
  // so Library must reopen the complete slide editor instead of single-image
  // form.
  const mode = declaredMode === "multi_story" || declaredMode === "carousel"
    ? declaredMode
    : declaredSlideCount > 1 && format.canvas === "post_1080x1350"
      ? "carousel"
      : declaredSlideCount > 1
        ? "multi_story"
        : undefined;
  const seriesId = textValue(format.seriesId);
  if (!seriesId || (mode !== "multi_story" && mode !== "carousel"))
    return undefined;
  const countValue = declaredSlideCount;
  const indexValue = Number(format.slideIndex);
  const slideCount = Number.isFinite(countValue)
    ? Math.max(2, Math.min(10, Math.trunc(countValue)))
    : 2;
  const slideIndex = Number.isFinite(indexValue)
    ? Math.max(1, Math.min(slideCount, Math.trunc(indexValue)))
    : 1;
  return { seriesId, mode, slideIndex, slideCount };
}

const visualTextLimits: Record<
  "title" | "subtitle" | "body" | "footer",
  number
> = { title: 240, subtitle: 280, body: 700, footer: 240 };

function VisualTextArea({
  label,
  value,
  onChange,
  field,
  rows,
  placeholder,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  field: "title" | "subtitle" | "body" | "footer";
  rows: number;
  placeholder?: string;
  required?: boolean;
}) {
  const limit = visualTextLimits[field];
  const overLimit = value.length > limit;
  return (
    <label
      className={
        overLimit
          ? "visual-text-field text-reserved-field"
          : "visual-text-field"
      }
    >
      {label}
      <textarea
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        rows={rows}
        value={value}
      />
      {overLimit && (
        <small className="visual-text-warning">
          این متن {toPersianDigits(String(value.length))} نویسه دارد. برای
          جلوگیری از خراب‌شدن متن، موتور آن را روی تصویر نمی‌نویسد و فقط فضای
          خالی متناسب می‌سازد.
          <button
            onClick={() => void navigator.clipboard?.writeText(value)}
            type="button"
          >
            ⧉ کپی متن
          </button>
        </small>
      )}
    </label>
  );
}

function ReferenceFileList({
  files,
  uploads = [],
  onRemove,
}: {
  files: File[];
  uploads?: DesignUploadItem[];
  onRemove: (index: number) => void;
}) {
  const [preview, setPreview] = useState<{ name: string; url: string }>();
  const urls = useMemo(
    () => files.map((file) => URL.createObjectURL(file)),
    [files],
  );
  useEffect(
    () => () => urls.forEach((url) => URL.revokeObjectURL(url)),
    [urls],
  );
  return (
    <>
      {files.length > 0 && (
        <div className="publish-media-list reference-file-list">
          {files.map((file, index) => {
            const upload = uploads.find((item) => item.file === file);
            const percent =
              upload?.status === "securing" || upload?.status === "completed"
                ? 100
                : upload?.total
                  ? Math.max(
                      0,
                      Math.min(
                        100,
                        Math.round((upload.loaded / upload.total) * 100),
                      ),
                    )
                  : 0;
            const label =
              upload?.status === "uploading"
                ? `در حال بارگذاری: ${formatUploadBytes(upload.loaded)} از ${formatUploadBytes(upload.total)}`
                : upload?.status === "securing"
                  ? "بارگذاری کامل شد؛ در حال ذخیرهٔ امن…"
                  : upload?.status === "completed"
                    ? "بارگذاری و ثبت پروژه انجام شد"
                    : upload?.status === "failed"
                      ? (upload.error ?? "بارگذاری ناموفق بود")
                      : `${formatUploadBytes(file.size)} · آمادهٔ ارسال`;
            return (
              <article
                className={`upload-queue-item status-${upload?.status ?? "preparing"}`}
                key={`${file.name}-${file.lastModified}-${index}`}
              >
                <button
                  aria-label={`نمایش ${file.name}`}
                  className="reference-preview"
                  onClick={() =>
                    setPreview({ name: file.name, url: urls[index] })
                  }
                  type="button"
                >
                  <img alt="" src={urls[index]} />
                </button>
                <div>
                  <b>{file.name}</b>
                  <small>{label}</small>
                  <div
                    aria-label={`${toPersianDigits(String(percent))} درصد`}
                    aria-valuemax={100}
                    aria-valuemin={0}
                    aria-valuenow={percent}
                    className="upload-progress"
                    role="progressbar"
                  >
                    <i style={{ width: `${percent}%` }} />
                  </div>
                </div>
                <strong>
                  {upload?.status === "failed"
                    ? "خطا"
                    : `${toPersianDigits(String(percent))}٪`}
                </strong>
                <button
                  aria-label={`حذف ${file.name}`}
                  className="reference-remove"
                  disabled={
                    upload?.status === "uploading" ||
                    upload?.status === "securing"
                  }
                  onClick={() => onRemove(index)}
                  title="حذف"
                  type="button"
                >
                  ×
                </button>
              </article>
            );
          })}
        </div>
      )}
      {preview && (
        <div
          className="file-preview-backdrop"
          role="presentation"
          onClick={() => setPreview(undefined)}
        >
          <figure onClick={(event) => event.stopPropagation()}>
            <button
              aria-label="بستن پیش‌نمایش"
              onClick={() => setPreview(undefined)}
              type="button"
            >
              ×
            </button>
            <img alt={preview.name} src={preview.url} />
            <figcaption>{preview.name}</figcaption>
          </figure>
        </div>
      )}
    </>
  );
}

function SlideDeckEditor({
  slides,
  onChange,
  withFiles = false,
  onBuildSlide,
  buildDisabled = () => false,
  activeSlide,
  onApproveSlide,
  onRetrySlide,
  onEditSlideForm,
  onEditSlideText,
  onEditSlideImage,
  onManualSlideReference,
  onViewSlideOutput,
  onDownloadSlide,
  presenterAssets = [],
  editInstruction = "",
  onEditInstruction,
  uploadQueue = [],
  isNewsSeries = false,
  imageModelSettings,
  isStudioSeries = false,
  studioAssetRegistry,
  studioDefaultLocationId = "newsroom",
}: {
  slides: DesignSlide[];
  onChange: (slides: DesignSlide[]) => void;
  withFiles?: boolean;
  onBuildSlide?: (index: number) => void;
  buildDisabled?: (index: number) => boolean;
  activeSlide?: {
    index: number;
    job?: DesignJob;
    outputUrl?: string;
    outputLoading?: boolean;
    elapsedSeconds?: number;
  };
  onApproveSlide?: () => void;
  onRetrySlide?: () => void;
  onEditSlideForm?: (index: number) => void;
  onEditSlideText?: (index: number) => void;
  onEditSlideImage?: () => void;
  onManualSlideReference?: (index: number, files: File[]) => void;
  onViewSlideOutput?: () => void;
  onDownloadSlide?: () => void;
  presenterAssets?: VideoAsset[];
  editInstruction?: string;
  onEditInstruction?: (value: string) => void;
  uploadQueue?: DesignUploadItem[];
  isNewsSeries?: boolean;
  imageModelSettings?: ImageModelSettings;
  isStudioSeries?: boolean;
  studioAssetRegistry?: VideoAssetRegistry;
  studioDefaultLocationId?: string;
}) {
  const [collapsedSlideIds, setCollapsedSlideIds] = useState<string[]>([]);
  const completedSlideId =
    activeSlide?.job?.state === "completed"
      ? slides[activeSlide.index]?.id
      : undefined;
  useEffect(() => {
    if (completedSlideId)
      setCollapsedSlideIds((current) =>
        current.includes(completedSlideId)
          ? current
          : [...current, completedSlideId],
      );
  }, [completedSlideId]);
  const update = <K extends keyof DesignSlide,>(
    id: string,
    field: K,
    value: DesignSlide[K],
  ) =>
    onChange(
      slides.map((slide) =>
        slide.id === id ? { ...slide, [field]: value } : slide,
      ),
    );
  const remove = (id: string) =>
    onChange(slides.filter((slide) => slide.id !== id));
  const addFiles = (id: string, incoming: File[]) =>
    onChange(
      slides.map((slide) =>
        slide.id === id
          ? { ...slide, files: [...slide.files, ...incoming] }
          : slide,
      ),
    );
  const add = () =>
    onChange([
      ...slides,
      { id: crypto.randomUUID(), ...emptySlide(), files: [] },
    ]);
  return (
    <section className="slide-deck-editor">
      <div className="section-heading">
        <div>
          <h3>اسلایدهای سری</h3>
          <p className="hint">
            هر اسلاید مستقل است؛ حداقل یکی از چهار فیلد را پر کنید. ترتیب
            کارت‌ها، ترتیب خروجی نهایی است.
          </p>
        </div>
      </div>
      {slides.map((slide, index) => {
        const reviewCollapsed = collapsedSlideIds.includes(slide.id);
        const slideLocationId = slide.studioLocationId || studioDefaultLocationId;
        const slideLocationMode = slide.studioLocationMode;
        return (
          <article
            className={reviewCollapsed ? "slide-review-collapsed" : ""}
            id={`series-slide-${slide.id}`}
            key={slide.id}
          >
            <header>
              <button
                className="slide-title-button"
                onClick={() => {
                  setCollapsedSlideIds((current) =>
                    current.filter((id) => id !== slide.id),
                  );
                  onEditSlideForm?.(index);
                }}
                type="button"
              >
                اسلاید {toPersianDigits(String(index + 1))}
              </button>
              <span>
                <button
                  disabled={index === 0}
                  onClick={() => {
                    const next = [...slides];
                    [next[index - 1], next[index]] = [
                      next[index],
                      next[index - 1],
                    ];
                    onChange(next);
                  }}
                  title="بالا"
                  type="button"
                >
                  ↑
                </button>
                <button
                  disabled={index === slides.length - 1}
                  onClick={() => {
                    const next = [...slides];
                    [next[index], next[index + 1]] = [
                      next[index + 1],
                      next[index],
                    ];
                    onChange(next);
                  }}
                  title="پایین"
                  type="button"
                >
                  ↓
                </button>
                <button
                  disabled={slides.length <= 1}
                  onClick={() => remove(slide.id)}
                  title="حذف اسلاید"
                  type="button"
                >
                  ×
                </button>
              </span>
            </header>
            {!reviewCollapsed && (
              <>
                {isNewsSeries && index === 0 && (
                  <>
                    <p className="hint">
                      کاور سری فقط روتیتر، تیتر، زیرتیتر و عبارت ثابت «ورق
                      بزنید» دارد. متن خبر را از اسلاید دوم وارد کنید.
                    </p>
                    <VisualTextArea
                      field="subtitle"
                      label="روتیتر"
                      onChange={(value) => update(slide.id, "kicker", value)}
                      rows={2}
                      value={slide.kicker ?? ""}
                    />
                  </>
                )}
                <VisualTextArea
                  field="title"
                  label={isNewsSeries && index === 0 ? "تیتر کاور" : "عنوان"}
                  onChange={(value) => update(slide.id, "title", value)}
                  rows={2}
                  value={slide.title}
                />
                <VisualTextArea
                  field="subtitle"
                  label={isNewsSeries && index === 0 ? "زیرتیتر کاور" : "زیرتیتر"}
                  onChange={(value) => update(slide.id, "subtitle", value)}
                  rows={2}
                  value={slide.subtitle}
                />
                {isNewsSeries && (
                  <label>
                    محل تیتر این اسلاید
                    <select
                      value={slide.titleLayout ?? "top"}
                      onChange={(event) =>
                        update(
                          slide.id,
                          "titleLayout",
                          event.target.value as NewsLayout,
                        )
                      }
                    >
                      <option value="top">بالای بدنه</option>
                      <option value="right_column">ستون سمت راست</option>
                      <option value="center">وسط تصویر</option>
                      <option value="bottom">پایین تصویر</option>
                    </select>
                  </label>
                )}
                {!(isNewsSeries && index === 0) && (
                  <>
                    <VisualTextArea
                      field="body"
                      label={isNewsSeries ? "متن کپشن این اسلاید" : "بدنه"}
                      onChange={(value) => update(slide.id, "body", value)}
                      rows={5}
                      value={slide.body}
                    />
                    <VisualTextArea
                      field="footer"
                      label="پاورقی / تعامل"
                      onChange={(value) => update(slide.id, "footer", value)}
                      rows={2}
                      value={slide.footer}
                    />
                  </>
                )}
                {withFiles && (
                  <div className="slide-file-field">
                    <label>
                      موتور تصویرساز این اسلاید
                      <select
                        value={slide.imageEngine ?? ""}
                        onChange={(event) =>
                          update(slide.id, "imageEngine", event.target.value)
                        }
                      >
                        <option value="">
                          پیش‌فرض درخواست ({imageModelLabel(imageModelSettings?.defaultModel || "gpt-image-2.5-flare")})
                        </option>
                        {(imageModelSettings?.models?.length
                          ? imageModelSettings.models
                          : imageEngineOptions
                        ).map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.label}
                          </option>
                        ))}
                      </select>
                      <small className="hint">
                        این انتخاب فقط روی همین اسلاید اعمال می‌شود.
                      </small>
                    </label>
                    <label>
                      نحوهٔ تصویر این اسلاید
                      <select
                        value={slide.imageMode ?? "generate"}
                        onChange={(event) =>
                          update(
                            slide.id,
                            "imageMode",
                            event.target.value as ContentSlide["imageMode"],
                          )
                        }
                      >
                        <option value="generate">ساخت تصویر جدید</option>
                        <option value="preserve">
                          استفادهٔ دقیق از تصویر مرجع
                        </option>
                        <option value="reference">
                          استفاده وفادار از تصویر مرجع
                        </option>
                        <option value="studio">تصویر استودیو</option>
                        <option value="none">بدون تصویر</option>
                      </select>
                    </label>
                    {(slide.imageMode ?? "generate") !== "none" && (
                      <label className="reference-upload">
                        افزودن تصاویر مرجع این اسلاید
                        <input
                          accept="image/jpeg,image/png,image/webp"
                          multiple
                          onChange={(event) => {
                            const incoming = Array.from(
                              event.target.files ?? [],
                            );
                            event.target.value = "";
                            if (incoming.length) addFiles(slide.id, incoming);
                          }}
                          type="file"
                        />
                        <span>＋ انتخاب یک یا چند تصویر</span>
                      </label>
                    )}
                    {(slide.imageMode ?? "generate") === "none" && (
                      <small className="hint">
                        این اسلاید فقط با گرید، رنگ و تایپوگرافی سری ساخته
                        می‌شود.
                      </small>
                    )}
                    {["generate", "studio"].includes(slide.imageMode ?? "generate") && (
                      <label>
                        پرامپت ساخت خودِ تصویر
                        <textarea
                          maxLength={1200}
                          onChange={(event) =>
                            update(slide.id, "imagePrompt", event.target.value)
                          }
                          placeholder="مثلاً یک نمای واقعی از جلسهٔ شورای شهر در نور روز؛ این متن فقط تصویر این اسلاید را هدایت می‌کند."
                          rows={3}
                          value={slide.imagePrompt ?? ""}
                        />
                      </label>
                    )}
                    {["preserve", "reference"].includes(
                      slide.imageMode ?? "generate",
                    ) && (
                      <label>
                        توضیحات اختصاصی تصاویر مرجع
                        <textarea
                          maxLength={1000}
                          onChange={(event) =>
                            update(
                              slide.id,
                              "referenceInstructions",
                              event.target.value,
                            )
                          }
                          placeholder="مثلاً شخص سمت راست حفظ شود و پس‌زمینه فقط از لبه‌ها گسترش پیدا کند؛ این توضیح فقط روی تصویر اثر دارد."
                          rows={3}
                          value={slide.referenceInstructions ?? ""}
                        />
                      </label>
                    )}
                    {(slide.imageMode ?? "generate") === "studio" && (
                      <section className="slide-studio-location-controls">
                        <b>لوکیشن تصویر استودیو در این اسلاید</b>
                        <label>
                          منطق لوکیشن
                          <select
                            value={slideLocationMode ?? ""}
                            onChange={(event) => {
                              const value = event.target.value;
                              update(
                                slide.id,
                                "studioLocationMode",
                                value ? (value as ContentSlide["studioLocationMode"]) : undefined,
                              );
                              if (value === "catalog" && !slide.studioLocationId) {
                                update(slide.id, "studioLocationId", studioDefaultLocationId);
                              }
                            }}
                          >
                            <option value="">استفاده از تنظیمات کلی استودیو</option>
                            <option value="catalog">لوکیشن ذخیره‌شده</option>
                            <option value="generated_prompt">ساخت لوکیشن با پرامپت</option>
                            <option value="exact_reference">استفاده مستقیم از مرجع لوکیشن</option>
                            <option value="faithful_reference">استفاده وفادار از مرجع لوکیشن</option>
                          </select>
                        </label>
                        {slideLocationMode && (
                          <>
                            {slideLocationMode !== "generated_prompt" && (
                              <label>
                                لوکیشن
                                <select
                                  value={slideLocationId}
                                  onChange={(event) => update(slide.id, "studioLocationId", event.target.value)}
                                >
                                  {Object.entries(locationLabels).map(([id, label]) => (
                                    <option key={id} value={id}>{label}</option>
                                  ))}
                                </select>
                              </label>
                            )}
                            {slideLocationMode === "catalog" && (
                              <ReferenceAssetPicker
                                assets={studioAssetRegistry?.assets.filter(
                                  (asset) => asset.kind === "location" && asset.entityId === slideLocationId && asset.scope !== "project",
                                ) ?? []}
                                choice={slide.studioLocationReferences ?? automaticReferenceChoice()}
                                limit={studioImageReferenceLimit}
                                onChange={(choice) => update(slide.id, "studioLocationReferences", choice)}
                                title="تصاویر ذخیره‌شدهٔ این لوکیشن"
                              />
                            )}
                            {slideLocationMode === "generated_prompt" && (
                              <label>
                                پرامپت ساخت لوکیشن این اسلاید
                                <textarea
                                  maxLength={1200}
                                  rows={3}
                                  value={slide.studioLocationPrompt ?? ""}
                                  onChange={(event) => update(slide.id, "studioLocationPrompt", event.target.value)}
                                  placeholder="معماری، نور، زمان روز، زاویهٔ دوربین و فضای لازم برای کاراکتر را بنویسید."
                                />
                              </label>
                            )}
                            {slideLocationMode === "faithful_reference" && (
                              <label>
                                توضیحات استفادهٔ وفادار از لوکیشن
                                <textarea
                                  maxLength={1000}
                                  rows={3}
                                  value={slide.studioLocationReferenceInstructions ?? ""}
                                  onChange={(event) => update(slide.id, "studioLocationReferenceInstructions", event.target.value)}
                                  placeholder="مثلاً هندسه و نور حفظ شود و فقط قاب برای حضور کاراکتر بازتر شود."
                                />
                              </label>
                            )}
                            {(slideLocationMode === "exact_reference" || slideLocationMode === "faithful_reference") && (
                              <ReferenceAssetPicker
                                assets={studioAssetRegistry?.assets.filter(
                                  (asset) => asset.kind === "location" && asset.entityId === slideLocationId && asset.scope === "project",
                                ) ?? []}
                                choice={{ mode: "manual", assetIds: slide.studioLocationAssetIds ?? [] }}
                                limit={studioImageReferenceLimit}
                                onChange={(choice) => update(slide.id, "studioLocationAssetIds", choice.assetIds)}
                                title="تصاویر مرجع اختصاصی این اسلاید"
                              />
                            )}
                          </>
                        )}
                        <small className="hint">در حالت پیش‌فرض، تنظیمات کلی استودیو حفظ می‌شود؛ اینجا فقط وقتی مقدار مستقل انتخاب کنید روی همین اسلاید override می‌شود.</small>
                      </section>
                    )}
                    {(slide.imageMode ?? "generate") === "studio" && (
                      <section className="slide-studio-monitor-controls">
                        <b>رفتار مانیتور در این اسلاید</b>
                        <label>حالت مانیتور<select value={slide.studioMonitorMode ?? "inherit"} onChange={(event) => { const value = event.target.value; update(slide.id, "studioMonitorMode", value === "inherit" ? undefined : value as ContentSlide["studioMonitorMode"]); }}><option value="inherit">استفاده از تنظیمات کلی استودیو</option><option value="disabled">بدون مانیتور</option><option value="text">تیتر متنی روی مانیتور</option><option value="images">تصویر داخل مانیتور</option><option value="blank">مانیتور خالی</option></select></label>
                        {(slide.studioMonitorMode ?? "") === "text" && <label>متن دقیق مانیتور این اسلاید<textarea maxLength={240} rows={2} value={slide.studioMonitorText ?? ""} onChange={(event) => update(slide.id, "studioMonitorText", event.target.value)} placeholder="تیتر کوتاه و دقیق فارسی" /></label>}
                        {(slide.studioMonitorMode ?? "") === "images" && <><label>رفتار تصویر مانیتور<select value={slide.studioMonitorImageMode ?? "preserve"} onChange={(event) => update(slide.id, "studioMonitorImageMode", event.target.value as ContentSlide["studioMonitorImageMode"])}><option value="preserve">حفظ کامل تصویر پیوست‌شده</option><option value="reference">استفاده وفادار از تصویر مرجع</option><option value="generate">ساخت تصویر جدید برای مانیتور</option></select></label><label>توضیح محتوای مانیتور<textarea maxLength={800} rows={2} value={slide.studioMonitorBrief ?? ""} onChange={(event) => update(slide.id, "studioMonitorBrief", event.target.value)} placeholder="مثلاً نقشه پیوست‌شده را بدون هیچ تغییر داخل مانیتور قرار بده" /></label><small className="hint">فایل‌های همین اسلاید، محتوای مانیتور محسوب می‌شوند؛ در حالت «حفظ کامل» متن، نقشه و پیکسل‌های تصویر نباید تغییر کند.</small></>}
                      </section>
                    )}
                    {(slide.imageMode ?? "generate") === "studio" && (
                      <section className="slide-presenter-picker">
                        <b>استفاده از تصویر مجری در همین اسلاید</b>
                        <p className="hint">
                          اختیاری؛ هویت مجری از تصاویر مرجع استودیو به‌صورت
                          هوشمند یا دستی وارد عکس این اسلاید می‌شود.
                        </p>
                        <div className="choices">
                          {Object.entries(presenterLabels).map(([id, label]) => {
                            const selected = (slide.presenterIds ?? []).includes(id);
                            return (
                              <button
                                className={selected ? "selected" : ""}
                                disabled={!selected && (slide.presenterIds ?? []).length >= 2}
                                key={id}
                                onClick={() => {
                                  const current = slide.presenterIds ?? [];
                                  update(
                                    slide.id,
                                    "presenterIds",
                                    selected
                                      ? current.filter((item) => item !== id)
                                      : [...current, id],
                                  );
                                }}
                                type="button"
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                        {(slide.presenterIds ?? []).map((id) => {
                          const selection =
                            slide.presenterReferenceSelection?.[id] ??
                            automaticReferenceChoice();
                          const otherCount = (slide.presenterIds ?? [])
                            .filter((item) => item !== id)
                            .reduce((total, item) => {
                              const choice =
                                slide.presenterReferenceSelection?.[item] ??
                                automaticReferenceChoice();
                              return total +
                                (choice.mode === "manual"
                                  ? new Set(choice.assetIds).size
                                  : 1);
                            }, slide.files.length);
                          return (
                            <ReferenceAssetPicker
                              assets={presenterAssets.filter(
                                (asset) =>
                                  asset.entityId === id &&
                                  asset.scope !== "project",
                              )}
                              choice={selection}
                              key={id}
                              limit={Math.max(0, 6 - otherCount)}
                              onChange={(choice) =>
                                update(slide.id, "presenterReferenceSelection", {
                                  ...(slide.presenterReferenceSelection ?? {}),
                                  [id]: choice,
                                })
                              }
                              title={`مشاهده و انتخاب تصاویر ${presenterLabels[id]}`}
                            />
                          );
                        })}
                      </section>
                    )}
                    <ReferenceFileList
                      files={slide.files}
                      onRemove={(fileIndex) =>
                        onChange(
                          slides.map((entry) =>
                            entry.id === slide.id
                              ? {
                                  ...entry,
                                  files: entry.files.filter(
                                    (_, current) => current !== fileIndex,
                                  ),
                                }
                              : entry,
                          ),
                        )
                      }
                      uploads={uploadQueue.filter(
                        (item) => item.slideId === slide.id,
                      )}
                    />
                  </div>
                )}
                <label className="slide-additional-instructions">
                  توضیحات تکمیلی این اسلاید
                  <textarea
                    maxLength={1200}
                    onChange={(event) =>
                      update(
                        slide.id,
                        "additionalInstructions",
                        event.target.value,
                      )
                    }
                    placeholder="مثلاً حس کلی، نور، چیدمان یا محدودیت‌های همین اسلاید"
                    rows={3}
                    value={slide.additionalInstructions ?? ""}
                  />
                </label>
                {withFiles && (
                  <div className="slide-card-actions">
                    {onBuildSlide ? (
                      <button
                        className="primary"
                        disabled={buildDisabled(index)}
                        onClick={() => onBuildSlide(index)}
                        type="button"
                      >
                        {activeSlide?.index === index &&
                        activeSlide.job?.state === "completed"
                          ? "ساخت مجدد همین اسلاید"
                          : `ساخت اسلاید ${toPersianDigits(String(index + 1))}`}
                      </button>
                    ) : (
                      <small>ساخت این اسلاید در این فرم فعال نیست.</small>
                    )}
                  </div>
                )}
              </>
            )}
            {activeSlide?.index === index && activeSlide.job && (
              <section
                className={`slide-build-card state-${activeSlide.job.state}`}
              >
                <div>
                  <b>
                    اسلاید {toPersianDigits(String(index + 1))} ·{" "}
                    {activeSlide.job.state === "completed"
                      ? "آمادهٔ بازبینی"
                      : activeSlide.job.state === "failed"
                        ? "ناموفق"
                        : "در حال ساخت"}
                  </b>
                  <small>
                    {activeSlide.job.lastEvent?.message ||
                      "در حال دریافت وضعیت از سرور…"}
                    {["queued", "processing"].includes(activeSlide.job.state) &&
                    activeSlide.elapsedSeconds !== undefined
                      ? ` · ${toPersianDigits(String(activeSlide.elapsedSeconds))} ثانیه`
                      : ""}
                  </small>
                  {activeSlide.job.outputs.at(-1)?.usage && (
                    <small className="usage-note">
                      {usageLabel(activeSlide.job.outputs.at(-1)?.usage) || "هزینهٔ تولید ثبت شد."}
                    </small>
                  )}
                </div>
                {["queued", "processing", "cancel_requested"].includes(
                  activeSlide.job.state,
                ) && (
                  <div className="slide-build-loading">
                    <span className="spinner" /> مدل در حال ساخت تصویر این
                    اسلاید است…
                  </div>
                )}
                {activeSlide.outputLoading && (
                  <p className="output-loading">در حال دریافت خروجی اسلاید…</p>
                )}
                {activeSlide.outputUrl && (
                  <img
                    className="slide-generated-output"
                    src={activeSlide.outputUrl}
                    alt={`خروجی اسلاید ${index + 1}`}
                  />
                )}
                {activeSlide.job.outputs.length > 0 &&
                  !activeSlide.outputUrl && (
                    <button
                      className="secondary"
                      onClick={onViewSlideOutput}
                      type="button"
                    >
                      نمایش خروجی اسلاید
                    </button>
                  )}
                {["failed", "cancelled"].includes(activeSlide.job.state) && (
                  <button
                    className="primary"
                    onClick={onRetrySlide}
                    type="button"
                  >
                    تلاش مجدد همین اسلاید
                  </button>
                )}
                {activeSlide.job.state === "completed" && (
                  <>
                    <div className="slide-output-actions">
                      <button
                        className="primary"
                        onClick={onApproveSlide}
                        type="button"
                      >
                        {index + 1 < slides.length
                          ? "تأیید و رفتن به اسلاید بعدی"
                          : "تأیید و پایان سری"}
                      </button>
                      <button
                        className="secondary"
                        onClick={onDownloadSlide}
                        type="button"
                      >
                        دانلود فایل اصلی باکیفیت
                      </button>
                      <label className="reference-upload compact">
                        افزودن فایل دستی برای مرجع اسلاید بعدی
                        <input
                          accept="image/jpeg,image/png,image/webp"
                          multiple
                          onChange={(event) => {
                            const incoming = Array.from(
                              event.target.files ?? [],
                            );
                            event.target.value = "";
                            if (incoming.length)
                              onManualSlideReference?.(index, incoming);
                          }}
                          type="file"
                        />
                        <span>＋ آپلود خروجی ویرایش‌شده</span>
                      </label>
                    </div>
                    <label className="slide-image-edit">
                      ویرایش متنی همین تصویر
                      <input
                        value={editInstruction}
                        onChange={(event) =>
                          onEditInstruction?.(event.target.value)
                        }
                        placeholder="مثلاً تیتر را بالاتر ببر یا نور تصویر را گرم‌تر کن"
                      />
                    </label>
                    <div className="choices">
                      <button
                        className="secondary"
                        onClick={() => {
                          setCollapsedSlideIds((current) =>
                            current.filter((id) => id !== slide.id),
                          );
                          onEditSlideText?.(index);
                        }}
                        type="button"
                      >
                        ویرایش متنی
                      </button>
                      <button
                        className="secondary"
                        onClick={() => {
                          setCollapsedSlideIds((current) =>
                            current.filter((id) => id !== slide.id),
                          );
                          onEditSlideForm?.(index);
                        }}
                        type="button"
                      >
                        ویرایش با فرم
                      </button>
                      <button
                        disabled={editInstruction.trim().length < 4}
                        onClick={onEditSlideImage}
                        type="button"
                      >
                        ثبت ویرایش تصویر
                      </button>
                      <button
                        className="link-button"
                        onClick={onRetrySlide}
                        type="button"
                      >
                        تلاش مجدد
                      </button>
                    </div>
                    {!reviewCollapsed && (
                      <button
                        className="primary"
                        onClick={onRetrySlide}
                        type="button"
                      >
                        ثبت تغییرات و ساخت مجدد اسلاید
                      </button>
                    )}
                  </>
                )}
              </section>
            )}
          </article>
        );
      })}
      <div className="slide-deck-add">
        <button
          className="secondary"
          disabled={slides.length >= 10}
          onClick={add}
          type="button"
        >
          + افزودن اسلاید
        </button>
      </div>
    </section>
  );
}

function EngagementKnowledgePanel({
  knowledge,
  articles,
  busy,
  onChange,
  onSave,
  onSync,
  onOptimize,
}: {
  knowledge: EngagementKnowledge;
  articles: Array<{ title: string; url: string }>;
  busy: boolean;
  onChange: (value: EngagementKnowledge) => void;
  onSave: () => void;
  onSync: () => void;
  onOptimize: () => void;
}) {
  const siteSource = knowledge.sources.find(
    (source) => source.kind === "website",
  ) ?? {
    sourceId: "kalam-site",
    kind: "website",
    label: "سایت کلام تازه",
    url: "https://kalametazenews.ir/",
    enabled: true,
  };
  const update = (key: "voice" | "safety" | "advertising" | "nonAdvertising" | "facts" | "faq", value: string) =>
    onChange({ ...knowledge, [key]: value });
  const updateSite = (
    field: "label" | "url" | "enabled",
    value: string | boolean,
  ) =>
    onChange({
      ...knowledge,
      sources: [
        ...knowledge.sources.filter((source) => source.kind !== "website"),
        { ...siteSource, [field]: value },
      ],
    });
  return (
    <section className="engagement-knowledge">
      <h3>لحن و دانش پاسخ‌گویی AI</h3>
      <p className="hint">
        AI فقط از این اطلاعات و منابع تأییدشده استفاده می‌کند؛ اگر پاسخ پیدا
        نشود، به ادمین ارجاع می‌دهد.
      </p>
      <label>
        لحن و شخصیت پاسخ
        <textarea
          rows={4}
          value={knowledge.voice}
          onChange={(event) => update("voice", event.target.value)}
        />
      </label>
      <label>
        خط قرمزها و سیاست پاسخ
        <textarea
          rows={4}
          value={knowledge.safety}
          onChange={(event) => update("safety", event.target.value)}
        />
      </label>
      <label>
        توضیحات تبلیغاتی
        <textarea
          rows={7}
          value={knowledge.advertising}
          onChange={(event) => update("advertising", event.target.value)}
          placeholder="قوانین، اطلاعات، تعرفه‌ها و پاسخ‌های قطعی مربوط به تبلیغات و سفارش‌ها"
        />
      </label>
      <label>
        توضیحات غیرتبلیغاتی
        <textarea
          rows={7}
          value={knowledge.nonAdvertising}
          onChange={(event) => update("nonAdvertising", event.target.value)}
          placeholder="پاسخ به پیام‌های مردمی، سوژه‌های خبری و گفتگوهای غیرتبلیغاتی"
        />
      </label>
      <label>
        اطلاعات ثابت تأییدشده
        <textarea
          rows={6}
          value={knowledge.facts}
          onChange={(event) => update("facts", event.target.value)}
          placeholder="تعرفه، شماره تماس، ساعات پاسخ‌گویی، آدرس‌ها و اطلاعات قطعی را هر مورد در یک خط بنویسید"
        />
      </label>
      <label>
        پرسش‌های پرتکرار و پاسخ مصوب
        <textarea
          rows={6}
          value={knowledge.faq}
          onChange={(event) => update("faq", event.target.value)}
          placeholder="سؤال: ...&#10;پاسخ: ..."
        />
      </label>
      <fieldset>
        <legend>منبع وب تأییدشده</legend>
        <label>
          نام منبع
          <input
            value={siteSource.label}
            onChange={(event) => updateSite("label", event.target.value)}
          />
        </label>
        <label>
          آدرس سایت
          <input
            dir="ltr"
            value={siteSource.url}
            onChange={(event) => updateSite("url", event.target.value)}
          />
        </label>
        <label className="switch-label">
          <input
            checked={siteSource.enabled}
            onChange={(event) => updateSite("enabled", event.target.checked)}
            type="checkbox"
          />
          در جست‌وجوی AI استفاده شود
        </label>
      </fieldset>
      <div className="choices">
        <button
          className="primary"
          disabled={busy}
          onClick={onSave}
          type="button"
        >
          ذخیرهٔ دانش
        </button>
        <button
          className="secondary"
          disabled={busy}
          onClick={onSync}
          type="button"
        >
          {busy ? "در حال دریافت…" : "به‌روزرسانی سایت"}
        </button>
        <button className="secondary" disabled={busy} onClick={onOptimize} type="button">
          {busy ? "در حال بهینه‌سازی…" : "بهینه‌سازی برای AI"}
        </button>
      </div>
      {articles.length > 0 && (
        <details>
          <summary>
            آخرین موارد ایندکس‌شدهٔ سایت (
            {toPersianDigits(String(articles.length))})
          </summary>
          <ul>
            {articles.slice(0, 8).map((article) => (
              <li key={article.url}>
                <a href={article.url} rel="noreferrer" target="_blank">
                  {article.title}
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}
      <p className="hint">
        کانال‌ها از طریق فوروارد پست به ورودی امن n8n ایندکس می‌شوند؛ این روش
        سریع‌تر از سایت است، اما فقط پست‌های تأییدشده وارد پاسخ AI می‌شوند.
      </p>
    </section>
  );
}

function engagementBrand(account?: EngagementAccount) {
  const name = (account?.username ?? "").toLowerCase();
  if (name.includes("golbahar"))
    return { label: "کلام تازه گلبهار", color: "#129dcc" };
  if (name.includes("chenaran"))
    return { label: "کلام تازه چناران", color: "#198754" };
  return { label: "کلام تازه", color: "#b5121b" };
}

const isInstagramComment = (item: EngagementInboxItem) =>
  ["comment", "comments"].includes(item.eventType.toLowerCase());
const engagementIdentity = (item: EngagementInboxItem) => {
  const username = (item.senderUsername ?? "").replace(/^@/, "").trim();
  const name = (item.senderName ?? "").trim();
  return {
    username,
    // Username is the stable, useful identity in Instagram. Name is only a fallback.
    label: username
      ? `@${username}`
      : name || "کاربر اینستاگرام",
    subtitle:
      username && name
        ? name
        : "نام کاربری در حال دریافت یا در دسترس نیست",
  };
};

function EngagementTagPicker({ value, knownTags, busy, onChange }: { value: string[]; knownTags: string[]; busy: boolean; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  // Historical inbox rows may not have a tags array. Keep the picker usable
  // while those rows are being normalised by the gateway.
  const selectedTags = Array.isArray(value) ? value : [];
  const catalogTags = Array.isArray(knownTags) ? knownTags : [];
  const normalise = (text: string) => text.replace(/\s+/g, " ").trim().slice(0, 40);
  const matches = catalogTags.filter((tag) => !selectedTags.includes(tag) && (!draft.trim() || tag.toLocaleLowerCase("fa").includes(draft.trim().toLocaleLowerCase("fa")))).slice(0, 12);
  const add = (raw: string) => {
    const tag = normalise(raw);
    if (tag && !selectedTags.includes(tag)) onChange([...selectedTags, tag].slice(0, 12));
    setDraft(""); setOpen(false);
  };
  return <div className="engagement-tag-picker">
    <div>{selectedTags.map((tag) => <span key={tag}>#{tag}<button aria-label={`حذف برچسب ${tag}`} disabled={busy} onClick={() => onChange(selectedTags.filter((item) => item !== tag))} type="button">×</button></span>)}</div>
    <div className="engagement-tag-input"><input disabled={busy} value={draft} onChange={(event) => { setDraft(event.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); add(matches[0] ?? draft); } }} placeholder="جست‌وجو یا افزودن برچسب…" />
      {open && <section className="engagement-tag-options">{matches.map((tag) => <button key={tag} onMouseDown={(event) => { event.preventDefault(); add(tag); }} type="button">#{tag}</button>)}{draft.trim() && !catalogTags.some((tag) => tag === normalise(draft)) && <button onMouseDown={(event) => { event.preventDefault(); add(draft); }} type="button">افزودن «{normalise(draft)}»</button>}</section>}
    </div>
  </div>;
}

function EngagementTagCatalog({ tags, busy, onCreate, onRename, onDelete }: { tags: string[]; busy: boolean; onCreate: (tag: string) => void; onRename: (tag: string, next: string) => void; onDelete: (tag: string) => void }) {
  const [draft, setDraft] = useState("");
  const catalogTags = Array.isArray(tags) ? tags : [];
  return <section className="engagement-tag-catalog">
    <header><div><b>برچسب‌های مشترک مخاطبان</b><small>این فهرست بین همهٔ پیج‌ها، دایرکت‌ها، کامنت‌ها و قانون‌ها مشترک است.</small></div></header>
    <div className="engagement-tag-catalog-add"><input value={draft} disabled={busy} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); if (draft.trim()) { onCreate(draft); setDraft(""); } } }} placeholder="برچسب تازه…" /><button className="secondary" disabled={busy || !draft.trim()} onClick={() => { onCreate(draft); setDraft(""); }} type="button">افزودن</button></div>
    <div className="engagement-tag-catalog-list">{catalogTags.length ? catalogTags.map((tag) => <span key={tag}>#{tag}<button disabled={busy} title="ویرایش" onClick={() => { const next = window.prompt("نام جدید برچسب", tag); if (next?.trim() && next.trim() !== tag) onRename(tag, next); }} type="button">✎</button><button disabled={busy} title="حذف" onClick={() => { if (window.confirm(`برچسب «${tag}» از همهٔ گفتگوها و قانون‌ها حذف شود؟`)) onDelete(tag); }} type="button">×</button></span>) : <small className="hint">هنوز برچسبی ساخته نشده است.</small>}</div>
  </section>;
}

const engagementAccountMatches = (left: string, right: string) =>
  left === right || left.split(":").at(-1) === right.split(":").at(-1);

/** Keep each comment's replies directly below it instead of globally sorting
 * every row by timestamp. Orphaned/cyclic historical rows are retained last
 * in chronological order, so a malformed provider relation cannot hide one. */
function orderCommentThread(items: EngagementInboxItem[]): EngagementInboxItem[] {
  const chronological = [...items].sort((left, right) => left.receivedAt - right.receivedAt);
  const byId = new Map(chronological.map((item) => [item.eventId, item]));
  const children = new Map<string, EngagementInboxItem[]>();
  for (const item of chronological) {
    const parentId = item.parentEventId ?? "";
    if (!parentId || parentId === item.eventId || !byId.has(parentId)) continue;
    const siblings = children.get(parentId) ?? [];
    siblings.push(item);
    children.set(parentId, siblings);
  }
  const ordered: EngagementInboxItem[] = [];
  const visited = new Set<string>();
  const append = (item: EngagementInboxItem) => {
    if (visited.has(item.eventId)) return;
    visited.add(item.eventId);
    ordered.push(item);
    for (const child of children.get(item.eventId) ?? []) append(child);
  };
  for (const item of chronological)
    if (!item.parentEventId || !byId.has(item.parentEventId) || item.parentEventId === item.eventId) append(item);
  for (const item of chronological) append(item);
  return ordered;
}

function EngagementComments({
  accounts,
  inbox,
  knownTags,
  activeAccounts,
  busy,
  onReply,
  onBulk,
  onArchive,
  onArchiveMany,
  onTags,
  onToggleAccount,
  onClearAccounts,
  hasMore,
  loadingMore,
  onLoadMore,
  onOpenPost,
}: {
  accounts: EngagementAccount[];
  inbox: EngagementInboxItem[];
  knownTags: string[];
  activeAccounts: string[];
  busy: boolean;
  onReply: (eventId: string, text: string) => void;
  onArchive: (eventId: string) => void;
  onArchiveMany: (eventIds: string[]) => void;
  onTags: (eventId: string, tags: string[]) => void;
  onBulk: (
    eventIds: string[],
    mode:
      | "thanks"
      | "emoji_thanks"
      | "emoji_laugh"
      | "emoji_sad"
      | "emoji_think"
      | "ai",
    instruction: string,
    answers?: EngagementBulkAnswer[],
  ) => Promise<EngagementBulkAnswer[] | undefined>;
  onToggleAccount: (id: string) => void;
  onClearAccounts: () => void;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onOpenPost: (eventId: string) => void;
}) {
  const [selectedMediaId, setSelectedMediaId] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [replyText, setReplyText] = useState("");
  const [selectedCommentIds, setSelectedCommentIds] = useState<string[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkMode, setBulkMode] = useState<
    | "thanks"
    | "emoji_thanks"
    | "emoji_laugh"
    | "emoji_sad"
    | "emoji_think"
    | "ai"
  >("thanks");
  const [bulkInstruction, setBulkInstruction] = useState("");
  const [bulkAnswers, setBulkAnswers] = useState<EngagementBulkAnswer[]>([]);
  const [commentSnippetsOpen, setCommentSnippetsOpen] = useState(false);
  const [commentSnippetName, setCommentSnippetName] = useState("");
  const [commentSnippetText, setCommentSnippetText] = useState("");
  const [commentEditingSnippet, setCommentEditingSnippet] = useState<number>();
  const [commentSnippets, setCommentSnippets] = useState<Array<{ name: string; text: string }>>(() => { try { const value = JSON.parse(window.localStorage.getItem("kalam-engagement-snippets") ?? "[]"); return Array.isArray(value) ? value : []; } catch { return []; } });
  const saveCommentSnippets = (next: Array<{ name: string; text: string }>) => { setCommentSnippets(next); window.localStorage.setItem("kalam-engagement-snippets", JSON.stringify(next)); };
  // Keep this UI-only progress state deliberately open; a render can move
  // from "ready" to "sending" while the confirmation branch is mounted.
  const [bulkStage, setBulkStage] = useState<any>("idle");
  const allComments = inbox.filter((item) => isInstagramComment(item));
  const comments = allComments.filter(
    (item) =>
      !activeAccounts.length || activeAccounts.some((accountId) => engagementAccountMatches(accountId, item.accountId)),
  );
  const posts = Array.from(
    comments
      .reduce((map, item) => {
        // The same numeric media id can theoretically exist on more than one
        // connected account.  A missing id must never combine unrelated
        // comments into one fake post either.
        const mediaId = item.mediaId || item.mediaPermalink || item.mediaUrl || "";
        // Comments are rendered per post/reel, never per comment.  A stable
        // permalink/media URL also keeps older rows together when one webhook
        // row is missing the provider media id.
        const groupId = `${item.accountId}:${mediaId || `unknown:${item.eventId}`}`;
        const current = map.get(groupId);
        if (!current)
          map.set(groupId, { groupId, mediaId, latest: item, items: [item] });
        else {
          current.items.push(item);
          if (
            item.receivedAt > current.latest.receivedAt ||
            ((!current.latest.mediaThumbnail && !current.latest.mediaCaption) &&
              Boolean(item.mediaThumbnail || item.mediaCaption))
          )
            current.latest = item;
        }
        return map;
      }, new Map<string, { groupId: string; mediaId: string; latest: EngagementInboxItem; items: EngagementInboxItem[] }>())
      .values(),
  ).sort((a, b) => b.latest.receivedAt - a.latest.receivedAt);
  const selected = posts.find((post) => post.groupId === selectedMediaId);
  const incomingCount = (post: { items: EngagementInboxItem[] }) =>
    Math.max(
      post.items.filter((item) => item.direction !== "outgoing").length,
      Number(post.items.find((item) => item.commentTotal !== undefined)?.commentTotal ?? 0),
    );
  const newCount = (post: { items: EngagementInboxItem[] }) =>
    Math.max(
      post.items.filter(
        (item) => item.direction !== "outgoing" && item.status === "new",
      ).length,
      Number(post.items.find((item) => item.commentNewTotal !== undefined)?.commentNewTotal ?? 0),
    );
  const reply = () => {
    if (replyTo && replyText.trim()) {
      onReply(replyTo, replyText.trim());
      setReplyText("");
    }
  };
  const toggleComment = (eventId: string) =>
    setSelectedCommentIds((current) =>
      current.includes(eventId)
        ? current.filter((item) => item !== eventId)
        : [...current, eventId],
    );
  const prepareBulk = async () => {
    setBulkStage("preparing");
    const answers = await onBulk(selectedCommentIds, bulkMode, bulkInstruction);
    if (answers) {
      setBulkAnswers(answers);
      setBulkStage("ready");
    } else setBulkStage("idle");
  };
  const sendBulk = async () => {
    setBulkStage("sending");
    const answers = await onBulk(
      selectedCommentIds,
      bulkMode,
      bulkInstruction,
      bulkAnswers,
    );
    if (answers) {
      setSelectedCommentIds([]);
      setBulkAnswers([]);
      setBulkOpen(false);
      setBulkStage("idle");
    } else setBulkStage("ready");
  };
  if (selected) {
    const postBrand = engagementBrand(
      accounts.find((account) => account.id === selected.latest.accountId),
    );
    const messages = orderCommentThread(selected.items);
    return (
      <section className="comment-thread">
        <header className="comment-thread-header">
          <button
            onClick={() => {
              setSelectedMediaId("");
              setReplyTo("");
              setSelectedCommentIds([]);
            }}
            type="button"
          >
            →
          </button>
          <div className="comment-post-cover">
            {selected.latest.mediaThumbnail ? (
              <img loading="lazy" src={selected.latest.mediaThumbnail} alt="پست اینستاگرام" />
            ) : (
              <span>
                {(selected.latest.mediaType ?? "")
                  .toUpperCase()
                  .includes("REEL")
                  ? "▶"
                  : "▧"}
              </span>
            )}
          </div>
          <div>
            <b>کامنت‌های پست</b>
            <small>
              {toPersianDigits(String(incomingCount(selected)))} کامنت ·{" "}
              {toPersianDigits(String(newCount(selected)))} بدون پاسخ ·{" "}
              {postBrand.label}
            </small>
          </div>
        </header>
        <article className="comment-post-preview">
          <div>
            {selected.latest.mediaThumbnail ? (
              <img loading="lazy" src={selected.latest.mediaThumbnail} alt="پیش‌نمایش پست" />
            ) : (
              <span>
                {(selected.latest.mediaType ?? "")
                  .toUpperCase()
                  .includes("REEL")
                  ? "▶ ویدیو / ریلز"
                  : "▧ پست اینستاگرام"}
              </span>
            )}
          </div>
          <section>
            <b>پیش‌نمایش پست</b>
            <p>
              {selected.latest.mediaCaption ||
                "کپشن این پست در payload وب‌هوک موجود نیست."}
            </p>
            {(selected.latest.mediaPermalink || selected.latest.mediaUrl) && (
              <a
                href={selected.latest.mediaPermalink || selected.latest.mediaUrl}
                target="_blank"
                rel="noreferrer"
              >
                مشاهده در اینستاگرام ↗
              </a>
            )}
          </section>
        </article>
        <div className="comment-thread-list">
          {messages.map((item) => {
            const identity = engagementIdentity(item);
            const parent = item.parentEventId
              ? messages.find((entry) => entry.eventId === item.parentEventId)
              : undefined;
            const automatic = Boolean(
              item.autoReply ||
              item.ruleId ||
              item.senderName === "پاسخ خودکار",
            );
            const selectable =
              item.direction !== "outgoing" && item.status === "new";
            return (
              <article
                className={`comment-bubble ${item.direction === "outgoing" ? "outgoing" : "incoming"}`}
                key={item.eventId}
              >
                <header>
                  {selectable && (
                    <input
                      aria-label="انتخاب کامنت"
                      checked={selectedCommentIds.includes(item.eventId)}
                      onChange={() => toggleComment(item.eventId)}
                      type="checkbox"
                    />
                  )}
                  {item.direction === "outgoing" ? <b>کلام تازه</b> : identity.username ? <a className="instagram-profile-link" href={`https://www.instagram.com/${encodeURIComponent(identity.username)}/`} rel="noreferrer" target="_blank">{identity.label}</a> : <b>{identity.label}</b>}
                  {item.direction === "outgoing" && (
                    <span className="outgoing-badge">از طرف ما</span>
                  )}
                  {automatic && (
                    <span className="auto-reply-badge">پاسخ خودکار</span>
                  )}
                </header>
                {parent && (
                  <small className="reply-context">
                    در پاسخ به {engagementIdentity(parent).label}:{" "}
                    {parent.text.slice(0, 70)}
                  </small>
                )}
                <p>{item.text || "کامنت بدون متن"}</p>
                {item.direction !== "outgoing" && <EngagementTagPicker value={item.tags ?? []} knownTags={knownTags} busy={busy} onChange={(tags) => onTags(item.eventId, tags)} />}
                <footer>
                  <time>{formatEngagementTime(item.receivedAt)}</time>
                  {item.direction !== "outgoing" && (
                    <>
                      <button
                        onClick={() => setReplyTo(item.eventId)}
                        type="button"
                      >
                        پاسخ
                      </button>
                      <button
                        className="comment-archive-button"
                        disabled={busy}
                        onClick={() => onArchive(item.eventId)}
                        title="ذخیره در آرشیو محتوا"
                        type="button"
                      >
                        <BookmarkIcon />
                      </button>
                    </>
                  )}
                </footer>
              </article>
            );
          })}
        </div>
        {selectedCommentIds.length > 0 && (
          <div className="bulk-comment-actions">
            <button
              className="bulk-reply-button"
              disabled={busy}
              onClick={() => {
                onArchiveMany(selectedCommentIds);
                setSelectedCommentIds([]);
              }}
              type="button"
            >
              <BookmarkIcon /> ذخیره در سوژه خبری ·{" "}
              {toPersianDigits(String(selectedCommentIds.length))}
            </button>
            <button
              className="bulk-reply-button"
              onClick={() => {
                setBulkOpen(true);
                setBulkAnswers([]);
                setBulkStage("idle");
              }}
              type="button"
            >
              پاسخ‌گویی گروهی ·{" "}
              {toPersianDigits(String(selectedCommentIds.length))}
            </button>
          </div>
        )}
        {replyTo && (
          <div className="comment-reply-composer">
            <small>در حال پاسخ به کامنت انتخاب‌شده</small>
            <textarea
              disabled={busy}
              value={replyText}
              onChange={(event) => setReplyText(event.target.value)}
              placeholder="پاسخ به کامنت…"
              rows={3}
            />
            <button className="secondary" onClick={() => { setCommentSnippetsOpen((open) => !open); setCommentSnippetName(""); setCommentSnippetText(replyText); setCommentEditingSnippet(undefined); }} type="button">⧉ متن‌های آماده</button>
            {commentSnippetsOpen && <div className="message-snippets comment-snippets"><div className="message-snippet-save"><input value={commentSnippetName} onChange={(event) => setCommentSnippetName(event.target.value)} placeholder="نام متن آماده" /><textarea value={commentSnippetText} onChange={(event) => setCommentSnippetText(event.target.value)} rows={3} placeholder="متن پاسخ آماده" /><button disabled={!commentSnippetText.trim()} onClick={() => { const next = { name: commentSnippetName.trim() || `متن ${toPersianDigits(String(commentSnippets.length + 1))}`, text: commentSnippetText }; saveCommentSnippets(commentEditingSnippet === undefined ? [next, ...commentSnippets].slice(0, 30) : commentSnippets.map((item, index) => index === commentEditingSnippet ? next : item)); setCommentSnippetName(""); setCommentSnippetText(""); setCommentEditingSnippet(undefined); }} type="button">{commentEditingSnippet === undefined ? "ذخیره" : "ذخیرهٔ ویرایش"}</button></div>{commentSnippets.map((snippet, index) => <article key={`${snippet.name}-${index}`}><button onClick={() => { setReplyText(snippet.text); setCommentSnippetsOpen(false); }} type="button">{snippet.name}</button><button title="ویرایش" onClick={() => { setCommentSnippetName(snippet.name); setCommentSnippetText(snippet.text); setCommentEditingSnippet(index); }} type="button">✎</button><button onClick={() => saveCommentSnippets(commentSnippets.filter((_, itemIndex) => itemIndex !== index))} type="button">×</button></article>)}</div>}
            <div>
              <button
                className="secondary"
                onClick={() => {
                  setReplyTo("");
                  setReplyText("");
                }}
                type="button"
              >
                لغو
              </button>
              <button
                className="primary"
                disabled={busy || !replyText.trim()}
                onClick={reply}
                type="button"
              >
                ارسال پاسخ
              </button>
            </div>
          </div>
        )}
        {bulkOpen && (
          <div className="bulk-modal-backdrop" role="presentation">
            <section className="bulk-modal" role="dialog" aria-modal="true">
              <header>
                <b>پاسخ‌گویی گروهی</b>
                <button
                  onClick={() =>
                    !["preparing", "sending"].includes(bulkStage) &&
                    setBulkOpen(false)
                  }
                  type="button"
                >
                  ×
                </button>
              </header>
              {bulkStage !== "ready" ? (
                <>
                  <p>
                    {toPersianDigits(String(selectedCommentIds.length))} کامنت
                    انتخاب شده‌اند. پاسخ‌ها پیش از ارسال قابل ویرایش خواهند بود.
                  </p>
                  <div className="bulk-mode-grid">
                    <button
                      className={bulkMode === "thanks" ? "selected" : ""}
                      onClick={() => setBulkMode("thanks")}
                      type="button"
                    >
                      تشکر کوتاه
                    </button>
                    <button
                      className={bulkMode === "emoji_thanks" ? "selected" : ""}
                      onClick={() => setBulkMode("emoji_thanks")}
                      type="button"
                    >
                      🙏 تشکر
                    </button>
                    <button
                      className={bulkMode === "emoji_laugh" ? "selected" : ""}
                      onClick={() => setBulkMode("emoji_laugh")}
                      type="button"
                    >
                      😊 خنده
                    </button>
                    <button
                      className={bulkMode === "emoji_sad" ? "selected" : ""}
                      onClick={() => setBulkMode("emoji_sad")}
                      type="button"
                    >
                      😔 ناراحتی
                    </button>
                    <button
                      className={bulkMode === "emoji_think" ? "selected" : ""}
                      onClick={() => setBulkMode("emoji_think")}
                      type="button"
                    >
                      🤔 تفکر
                    </button>
                    <button
                      className={bulkMode === "ai" ? "selected" : ""}
                      onClick={() => setBulkMode("ai")}
                      type="button"
                    >
                      ✦ پاسخ با AI
                    </button>
                  </div>
                  {bulkMode === "ai" && (
                    <textarea
                      value={bulkInstruction}
                      onChange={(event) =>
                        setBulkInstruction(event.target.value)
                      }
                      placeholder="دستور کوتاه برای لحن پاسخ‌ها (اختیاری)"
                      rows={3}
                    />
                  )}
                  {bulkStage === "preparing" ? (
                    <p className="bulk-loading">
                      در حال آماده‌سازی پاسخ‌ها با{" "}
                      {bulkMode === "ai"
                        ? "Gemini Flash Lite اقتصادی"
                        : "الگوی انتخاب‌شده"}
                      …
                    </p>
                  ) : (
                    <button
                      className="primary"
                      onClick={() => void prepareBulk()}
                      type="button"
                    >
                      ساخت فهرست پاسخ‌ها
                    </button>
                  )}
                </>
              ) : (
                <>
                  <p>پاسخ هر کامنت را پیش از ارسال بررسی یا ویرایش کنید.</p>
                  <div className="bulk-answer-list">
                    {bulkAnswers.map((answer) => (
                      <label key={answer.eventId}>
                        پاسخ کامنت
                        <textarea
                          value={answer.text}
                          onChange={(event) =>
                            setBulkAnswers((current) =>
                              current.map((item) =>
                                item.eventId === answer.eventId
                                  ? { ...item, text: event.target.value }
                                  : item,
                              ),
                            )
                          }
                          rows={2}
                        />
                      </label>
                    ))}
                  </div>
                  {bulkStage === "sending" ? (
                    <p className="bulk-loading">
                      در حال ارسال با فاصلهٔ ایمن ۳ ثانیه‌ای بین پاسخ‌ها؛ لطفاً
                      این صفحه را نبندید…
                    </p>
                  ) : (
                    <button
                      className="primary"
                      onClick={() => void sendBulk()}
                      type="button"
                    >
                      تأیید و ارسال پاسخ‌ها
                    </button>
                  )}
                </>
              )}
            </section>
          </div>
        )}
      </section>
    );
  }
  return (
    <section className="comment-post-list">
      <div className="conversation-filter">
        <button
          className={!activeAccounts.length ? "selected" : ""}
          onClick={onClearAccounts}
          type="button"
        >
          همه رسانه‌ها
        </button>
        {accounts.map((account) => {
          const brand = engagementBrand(account);
          return (
            <button
              className={activeAccounts.includes(account.id) ? "selected" : ""}
              key={account.id}
              onClick={() => onToggleAccount(account.id)}
              style={{ "--bubble-color": brand.color } as CSSProperties}
              type="button"
            >
              {brand.label}
            </button>
          );
        })}
      </div>
      <div className="section-heading">
        <div>
          <h3>کامنت‌های پست‌ها</h3>
          <p className="hint">
            هر پست یک گفت‌وگوی مستقل دارد؛ کامنت و پاسخ‌ها با هم نگه‌داری
            می‌شوند.
          </p>
        </div>
        <span>{toPersianDigits(String(posts.length))} پست</span>
      </div>
      {posts.length === 0 ? (
        <p className="hint">
          هنوز کامنتی از وب‌هوک دریافت نشده است. با رسیدن نخستین کامنت، پست
          اینجا ساخته می‌شود.
        </p>
      ) : (
        <>
          <div className="comment-post-grid">
            {posts.slice(0, 30).map((post) => {
              const media = post.latest;
              const brand = engagementBrand(
                accounts.find((account) => account.id === media.accountId),
              );
              return (
                <button
                  className="comment-post-card"
                  key={post.groupId}
                  onClick={() => {
                    setSelectedMediaId(post.groupId);
                    onOpenPost(post.latest.eventId);
                  }}
                  type="button"
                >
                  <span className="comment-post-thumb">
                    {media.mediaThumbnail ? (
                      <img loading="lazy" src={media.mediaThumbnail} alt="" />
                    ) : (
                      <i>
                        {(media.mediaType ?? "").toUpperCase().includes("REEL")
                          ? "▶"
                          : "▧"}
                      </i>
                    )}
                    {newCount(post) > 0 && (
                      <em>{toPersianDigits(String(newCount(post)))} جدید</em>
                    )}
                  </span>
                  <span className="comment-post-copy">
                    <b>
                      {(media.mediaType ?? "").toUpperCase().includes("REEL")
                        ? "ویدیو / ریلز"
                        : "پست اینستاگرام"}
                    </b>
                    <small>
                      {toPersianDigits(String(incomingCount(post)))} کامنت ·{" "}
                      {toPersianDigits(String(newCount(post)))} جدید
                    </small>
                    <span
                      className="media-badge"
                      style={{ "--media-color": brand.color } as CSSProperties}
                    >
                      {brand.label}
                    </span>
                  </span>
                  <time>{formatEngagementTime(post.latest.receivedAt)}</time>
                </button>
              );
            })}
          </div>
          {posts.length > 30 && (
            <button className="secondary comment-more" type="button" onClick={onLoadMore} disabled={loadingMore || busy}>
              {loadingMore ? "در حال دریافت پست‌های قدیمی‌تر…" : "مشاهدهٔ پست‌های قدیمی‌تر"}
            </button>
          )}
          {hasMore && posts.length <= 30 && <button className="secondary comment-more" type="button" onClick={onLoadMore} disabled={loadingMore || busy}>{loadingMore ? "در حال دریافت پست‌های قدیمی‌تر…" : "پست‌های قدیمی‌تر"}</button>}
        </>
      )}
    </section>
  );
}

function EngagementMessageMedia({ item }: { item: EngagementInboxItem }) {
  const type = (item.mediaType ?? "").toLowerCase();
  const permalink = item.mediaPermalink || "";
  const url = item.mediaUrl || item.mediaThumbnail;
  const mediaLink = item.mediaUrl || permalink || url;
  if (!type && !url && !permalink) return null;
  if (type === "story_reply")
    return <section className="story-reply-context">
      <small>↪ پاسخ به این استوری</small>
      {url ? <a href={mediaLink} rel="noreferrer" target="_blank"><img src={item.mediaThumbnail || url} alt="استوری‌ای که کاربر به آن پاسخ داده است" /></a> : permalink ? <a className="shared-media-link" href={permalink} rel="noreferrer" target="_blank">مشاهدهٔ این استوری</a> : <span className="story-reply-placeholder">▯</span>}
      <b>{item.mediaCaption || "استوری"}</b>
      <time>{formatEngagementTime(item.storyPublishedAt || item.receivedAt)}</time>
    </section>;
  if (type.includes("audio") || type.includes("voice"))
    return url ? <audio className="engagement-message-media audio" controls preload="metadata" src={url} /> : <small className="engagement-media-label">پیام صوتی</small>;
  if (type.includes("share")) {
    const sharedLink = permalink || item.mediaUrl || url;
    return <section className="shared-media-card">{url ? <a className="engagement-message-media-link" href={sharedLink} rel="noreferrer" target="_blank"><img className="engagement-message-media" src={item.mediaThumbnail || url} alt="محتوای اشتراک‌گذاری‌شده" /></a> : <span className="shared-media-placeholder" aria-hidden="true">{type.includes("reel") ? "▶" : "↗"}</span>}{sharedLink ? <a className="shared-media-link" href={sharedLink} rel="noreferrer" target="_blank">مشاهدهٔ پست یا استوری پیوست‌شده</a> : <small className="engagement-media-label">محتوای اشتراک‌گذاری‌شده</small>}{item.mediaCaption && <small>{item.mediaCaption}</small>}</section>;
  }
  if (type.includes("video") || type.includes("reel"))
    return url ? <video className="engagement-message-media" controls playsInline preload="metadata" poster={item.mediaThumbnail} src={url} /> : <small className="engagement-media-label">ویدئو / ریلز</small>;
  if (url && (type.includes("image") || type.includes("photo") || type.includes("sticker") || type.includes("story") || type.includes("share")))
    return <a className="engagement-message-media-link" href={item.mediaUrl || url} rel="noreferrer" target="_blank"><img className="engagement-message-media" src={item.mediaThumbnail || url} alt={type === "story_reply" ? "استوریِ پاسخ‌داده‌شده" : type === "share" ? "محتوای اشتراک‌گذاری‌شده" : "رسانهٔ پیام"} /></a>;
  return <small className="engagement-media-label">{type === "share" ? "پست یا استوری اشتراک‌گذاری‌شده" : type || "پیوست پیام"}{item.mediaUrl ? " · برای مشاهده لمس کنید" : ""}</small>;
}

function EngagementMessageButton({ item }: { item: EngagementInboxItem }) {
  if (!item.buttonLabel && !item.buttonPayload && !item.buttonUrl) return null;
  return (
    <div className="engagement-button-selection">
      <b>انتخاب دکمه: {item.buttonLabel || item.buttonPayload}</b>
      {item.buttonUrl && <a href={item.buttonUrl} rel="noreferrer" target="_blank">باز کردن لینک دکمه</a>}
      {item.buttonPayload && <small>مقدار: {item.buttonPayload}</small>}
    </div>
  );
}

function isEngagementSystemEvent(item: EngagementInboxItem) {
  const eventType = (item.eventType ?? "").toLowerCase();
  // Action callbacks and reaction receipts are delivery metadata from BoxAPI,
  // not a conversation created by an Instagram user.
  return eventType.startsWith("action.") || eventType === "message_reactions";
}

function engagementMessageSummary(item: EngagementInboxItem) {
  if (item.text?.trim()) return item.text;
  const type = (item.mediaType ?? "").toLowerCase();
  if (type === "story_reply") return item.mediaCaption?.trim() ? `پاسخ به استوری · ${item.mediaCaption.trim()}` : "پاسخ بدون متن به استوری";
  if (type.includes("image") || type.includes("photo")) return "پیام تصویری";
  if (type.includes("share")) return item.mediaCaption?.trim() ? `محتوای اشتراک‌گذاری‌شده · ${item.mediaCaption.trim()}` : "محتوای اشتراک‌گذاری‌شده";
  if (type.includes("video") || type.includes("reel")) return "پیام ویدیویی / ریلز";
  if (type.includes("audio") || type.includes("voice")) return "پیام صوتی";
  if (type.includes("sticker")) return "استیکر";
  if (item.eventType === "message_reactions") return "واکنش به پیام";
  if (item.mediaCaption?.trim()) return `محتوای پیوست‌شده · ${item.mediaCaption.trim()}`;
  if (item.mediaUrl || item.mediaThumbnail) return "پیوست رسانه‌ای";
  return "پیام فاقد متن یا رسانه";
}

function isStoryReplyItem(item: EngagementInboxItem) {
  const type = (item.mediaType ?? "").toLowerCase();
  return type === "story_reply" || type === "story_mention" || type.includes("story") || Boolean(item.storyPublishedAt);
}

function StoryPreviewMedia({ item }: { item: EngagementInboxItem }) {
  const source = item.mediaThumbnail || item.mediaUrl || "";
  const type = (item.mediaType ?? "").toLowerCase();
  const video = type.includes("video") || type.includes("reel") || /\.(mp4|mov|webm|m4v)(?:\?|$)/i.test(source);
  if (!source) return <span aria-hidden="true">▯</span>;
  return video ? <video muted playsInline preload="metadata" poster={item.mediaThumbnail && !/\.(mp4|mov|webm|m4v)(?:\?|$)/i.test(item.mediaThumbnail) ? item.mediaThumbnail : undefined} src={item.mediaUrl || item.mediaThumbnail} /> : <img loading="lazy" src={source} alt="استوری" />;
}

function EngagementMessenger({
  accounts,
  inbox,
  knownTags,
  selectedEventId,
  activeAccounts,
  activeTags,
  replyText,
  busy,
  loading,
  onSelect,
  onBack,
  onReplyText,
  onReply,
  onSuggest,
  showcases,
  onSendShowcase,
  onLead,
  onProfile,
  onArchive,
  onArchiveMany,
  onBulkMessage,
  onRefresh,
  hasMore,
  loadingMore,
  onLoadMore,
  onStoryRule,
  onStoryContext,
  onTags,
  onToggleAccount,
  onClearAccounts,
  onToggleTag,
  instagramPushAccounts,
  onToggleInstagramPush,
}: {
  accounts: EngagementAccount[];
  inbox: EngagementInboxItem[];
  knownTags: string[];
  selectedEventId: string;
  activeAccounts: string[];
  activeTags: string[];
  replyText: string;
  busy: boolean;
  loading: boolean;
  onSelect: (id: string) => void;
  onBack: () => void;
  onReplyText: (value: string) => void;
  onReply: () => void;
  onSuggest: (instruction: string, character: "none" | "kamran" | "tara") => void;
  showcases: EngagementShowcase[];
  onSendShowcase: (showcaseId: string) => void;
  onLead: () => void;
  onProfile: () => void;
  onArchive: (eventId: string) => void;
  onArchiveMany: (eventIds: string[]) => void;
  onBulkMessage: (eventIds: string[], text: string) => Promise<boolean>;
  onRefresh: () => void;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onStoryRule: (story: EngagementInboxItem) => void;
  onStoryContext: (story: EngagementInboxItem, context: string) => Promise<boolean>;
  onTags: (eventId: string, tags: string[]) => void;
  onToggleAccount: (id: string) => void;
  onClearAccounts: () => void;
  onToggleTag: (tag: string) => void;
  instagramPushAccounts: string[];
  onToggleInstagramPush: (accountId: string) => void;
}) {
  const composerRef = useRef<HTMLDivElement>(null);
  const [selectedArchiveIds, setSelectedArchiveIds] = useState<string[]>([]);
  const [selectedConversationIds, setSelectedConversationIds] = useState<string[]>([]);
  const [bulkMessageText, setBulkMessageText] = useState("");
  const [snippetsOpen, setSnippetsOpen] = useState(false);
  const [snippets, setSnippets] = useState<
    Array<{ name: string; text: string }>
  >(() => {
    try {
      return JSON.parse(
        window.localStorage.getItem("kalam-engagement-snippets") ?? "[]",
      );
    } catch {
      return [];
    }
  });
  const [snippetName, setSnippetName] = useState("");
  const [snippetText, setSnippetText] = useState("");
  const [editingSnippetIndex, setEditingSnippetIndex] = useState<number>();
  const [aiRequestText, setAiRequestText] = useState("به این گفتگو با توجه به اطلاعاتی که از رسانه کلام تازه داری، ادامه بده.");
  const [aiCharacter, setAiCharacter] = useState<"none" | "kamran" | "tara">("none");
  const [aiRequestOpen, setAiRequestOpen] = useState(false);
  const [selectedStory, setSelectedStory] = useState<EngagementInboxItem>();
  const [storyContextText, setStoryContextText] = useState("");
  const [selectedStoryReplyIds, setSelectedStoryReplyIds] = useState<string[]>([]);
  const [storyLimit, setStoryLimit] = useState(20);
  // Comments deliberately live in their own tab. The inbox is only direct and story messaging.
  const incoming = inbox.filter(
    (item) => item.direction !== "outgoing" && !isInstagramComment(item) && !isEngagementSystemEvent(item),
  );
  const tags = Array.isArray(knownTags) ? knownTags : [];
  const conversations = Array.from(
    inbox
      .filter((item) => !isInstagramComment(item) && !isEngagementSystemEvent(item))
      .reduce((map, item) => {
        // Store the latest event independently from the contact identity: a
        // sent reply must be visible as the card preview, yet tapping it must
        // still open the person's incoming message and composer.
        const userKey = item.senderId || item.senderUsername || item.senderName || item.eventId;
        const key = `${String(item.accountId || "").split(":").pop()}:${userKey}`;
        const current = map.get(key);
        const contact = item.direction !== "outgoing" ? item : current?.contact;
        map.set(key, {
          latest: !current || current.latest.receivedAt < item.receivedAt ? item : current.latest,
          contact: contact ?? current?.contact ?? item,
          tags: Array.from(new Set([...(current?.tags ?? []), ...(item.tags ?? [])])),
        });
        return map;
      }, new Map<string, { latest: EngagementInboxItem; contact: EngagementInboxItem; tags: string[] }>())
      .values(),
  )
    .filter(
      (entry) =>
        (!activeAccounts.length || activeAccounts.some((accountId) => engagementAccountMatches(accountId, entry.contact.accountId))) &&
        (!activeTags.length || activeTags.every((tag) => entry.tags.includes(tag))),
    )
    .sort((a, b) => b.latest.receivedAt - a.latest.receivedAt);
  const allStoryReplies = Array.from(
    incoming
      .filter((item) => isStoryReplyItem(item))
      .reduce((map, item) => {
        const accountKey = String(item.accountId || "").split(":").pop();
        const key = `${accountKey}:${item.mediaId || item.mediaUrl || item.mediaPermalink || `unknown:${item.eventId}`}`;
        const current = map.get(key);
        if (!current || current.receivedAt < item.receivedAt) map.set(key, item);
        return map;
      }, new Map<string, EngagementInboxItem>())
      .values(),
  )
    .filter(
      (item) =>
        (!activeAccounts.length || activeAccounts.some((accountId) => engagementAccountMatches(accountId, item.accountId))) &&
        (!activeTags.length || activeTags.every((tag) => (item.tags ?? []).includes(tag))),
    )
    .sort((a, b) => b.receivedAt - a.receivedAt);
  const storyReplies = allStoryReplies.slice(0, storyLimit);
  const storyConversation = selectedStory
    ? incoming
        .filter(
          (item) =>
            engagementAccountMatches(item.accountId, selectedStory.accountId) &&
            (item.mediaId || item.mediaUrl || item.mediaPermalink) ===
              (selectedStory.mediaId || selectedStory.mediaUrl || selectedStory.mediaPermalink),
        )
        .sort((a, b) => a.receivedAt - b.receivedAt)
    : [];
  const selected = incoming.find((item) => item.eventId === selectedEventId);
  const account = accounts.find((item) => item.id === selected?.accountId);
  const brand = engagementBrand(account);
  const conversation = selected
    ? inbox
        .filter(
          (item) =>
            item.accountId === selected.accountId &&
            item.senderId === selected.senderId &&
            !isEngagementSystemEvent(item),
        )
        .sort((a, b) => a.receivedAt - b.receivedAt)
    : [];
  useEffect(() => {
    if (selectedEventId && window.matchMedia("(max-width: 580px)").matches)
      window.setTimeout(
        () =>
          composerRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "end",
          }),
        240,
      );
  }, [selectedEventId]);
  const updateSnippets = (next: Array<{ name: string; text: string }>) => {
    setSnippets(next);
    window.localStorage.setItem(
      "kalam-engagement-snippets",
      JSON.stringify(next),
    );
  };
  const toggleSnippets = () => {
    setSnippetsOpen((opened) => {
      if (!opened) {
        setSnippetName("");
        setSnippetText(replyText);
        setEditingSnippetIndex(undefined);
      }
      return !opened;
    });
  };
  if (selected) {
    const identity = engagementIdentity(selected);
    const emojis = ["🙏", "🌹", "😊", "👍", "❤️", "🤔", "😔", "✨"];
    return (
      <section className="mobile-chat-screen">
        <header className="mobile-chat-header">
          <button onClick={onBack} type="button">
            →
          </button>
          <span className="inbox-avatar">
            {selected.senderProfilePhoto ? (
              <img src={selected.senderProfilePhoto} alt="" />
            ) : (
              identity.label.slice(0, 1)
            )}
          </span>
          <div>
            {identity.username ? <a className="instagram-profile-link" href={`https://www.instagram.com/${encodeURIComponent(identity.username)}/`} rel="noreferrer" target="_blank">{identity.label}</a> : <b>{identity.label}</b>}
            <small>{identity.subtitle}</small>
          </div>
          <span
            className="media-badge"
            style={{ "--media-color": brand.color } as CSSProperties}
          >
            {brand.label}
          </span>
          <button className="secondary" disabled={busy} onClick={() => onArchive(selected.eventId)} title="ذخیرهٔ این پیام در سوژه خبری" type="button"><BookmarkIcon /></button>
        </header>
        <EngagementTagPicker value={selected.tags ?? []} knownTags={knownTags} busy={busy} onChange={(next) => onTags(selected.eventId, next)} />
        <div className="chat-history mobile-history">
          {conversation.map((item) => {
            const automatic = Boolean(
              item.autoReply ||
              item.ruleId ||
              item.senderName === "پاسخ خودکار",
            );
            return (
              <article
                className={
                  item.direction === "outgoing" ? "outgoing" : "incoming"
                }
                key={item.eventId}
              >
                <input className="archive-message-checkbox" aria-label="انتخاب این پیام برای سوژه خبری" checked={selectedArchiveIds.includes(item.eventId)} onChange={() => setSelectedArchiveIds((current) => current.includes(item.eventId) ? current.filter((id) => id !== item.eventId) : [...current, item.eventId])} type="checkbox" />
                {item.parentEventId && (() => {
                  const parent = conversation.find((entry) => entry.eventId === item.parentEventId);
                  return parent ? <small className="reply-context">در پاسخ به: {parent.text?.slice(0, 90) || "رسانه"}</small> : null;
                })()}
                <p>{engagementMessageSummary(item)}</p>
                <EngagementMessageButton item={item} />
                <EngagementMessageMedia item={item} />
                <span className="message-meta">
                  {item.direction === "outgoing" && <b>از طرف ما</b>}
                  {automatic && <i>پاسخ خودکار</i>}
                  <time>{formatEngagementTime(item.receivedAt)}</time>
                </span>
              </article>
            );
          })}
        </div>
        <div className="mobile-composer" ref={composerRef}>
          <div className="emoji-strip" aria-label="ایموجی‌های پرکاربرد">
            {emojis.map((emoji) => (
              <button
                key={emoji}
                onClick={() => onReplyText(`${replyText}${emoji}`)}
                type="button"
              >
                {emoji}
              </button>
            ))}
          </div>
          <div className="composer-tools">
            <button onClick={onProfile} title="دریافت نام کاربری" type="button">
              ◉
            </button>
          </div>
          {snippetsOpen && (
            <div className="message-snippets">
              <div className="message-snippet-save">
                <input
                  value={snippetName}
                  onChange={(event) => setSnippetName(event.target.value)}
                  placeholder="نام متن آماده"
                />
                <textarea
                  value={snippetText}
                  onChange={(event) => setSnippetText(event.target.value)}
                  placeholder="متن آمادهٔ چندخطی"
                  rows={6}
                />
                <button
                  disabled={!snippetText.trim()}
                  onClick={() => {
                    const nextSnippet = { name: snippetName.trim() || `متن ${toPersianDigits(String(snippets.length + 1))}`, text: snippetText };
                    updateSnippets(editingSnippetIndex === undefined ? [nextSnippet, ...snippets].slice(0, 30) : snippets.map((item, index) => index === editingSnippetIndex ? nextSnippet : item));
                    setSnippetName("");
                    setSnippetText("");
                    setEditingSnippetIndex(undefined);
                  }}
                  type="button"
                >
                  {editingSnippetIndex === undefined ? "ذخیره" : "ذخیرهٔ ویرایش"}
                </button>
              </div>
              {snippets.length === 0 ? (
                <small>هنوز متنی ذخیره نشده است.</small>
              ) : (
                snippets.map((snippet, index) => (
                  <article key={`${snippet.name}-${index}`}>
                    <button
                      title="ویرایش متن آماده"
                      onClick={() => { setSnippetName(snippet.name); setSnippetText(snippet.text); setEditingSnippetIndex(index); }}
                      type="button"
                    >
                      ✎
                    </button>
                    <button
                      onClick={() => {
                        onReplyText(snippet.text);
                        setSnippetsOpen(false);
                      }}
                      type="button"
                    >
                      {snippet.name}
                    </button>
                    <button
                      onClick={() =>
                        updateSnippets(
                          snippets.filter(
                            (_, itemIndex) => itemIndex !== index,
                          ),
                        )
                      }
                      type="button"
                    >
                      ×
                    </button>
                  </article>
                ))
              )}
              <div className="showcase-snippets"><b>ارسال ویترین</b>{showcases.length === 0 ? <small>هنوز ویترینی در تنظیمات اینستاگرام ساخته نشده است.</small> : showcases.map((showcase) => <button disabled={busy} key={showcase.showcaseId} onClick={() => { onSendShowcase(showcase.showcaseId); setSnippetsOpen(false); }} type="button">▣ {showcase.name} · {toPersianDigits(String(showcase.cards.length))} کارت</button>)}</div>
            </div>
          )}
          <div className="reply-composer">
            <textarea
              disabled={busy}
              value={replyText}
              onChange={(event) => onReplyText(event.target.value)}
              placeholder="پاسخ خود را بنویسید…"
              rows={snippetsOpen ? 6 : 3}
            />
            <div className="reply-action-buttons">
              <button
                title="متن‌های آماده"
                onClick={toggleSnippets}
                type="button"
              >
                ⧉
              </button>
              <button
                title="پیشنهاد پاسخ با AI"
                disabled={busy}
                onClick={() => setAiRequestOpen((current) => !current)}
                type="button"
              >
                ✦
              </button>
              <button title="ساخت فرم لید از این گفتگو" disabled={busy} onClick={onLead} type="button">🛒</button>
              <button
                className="primary"
                disabled={busy || !replyText.trim()}
                onClick={onReply}
                type="button"
              >
                ➤
              </button>
            </div>
          </div>
          {aiRequestOpen && <div className="ai-request-panel"><label>دستور شما برای AI<textarea rows={3} value={aiRequestText} onChange={(event) => setAiRequestText(event.target.value)} placeholder="مثلاً قیمت‌ها را برایش بفرست یا از او شماره تماس بخواه" /></label><label>لحن پاسخ<select value={aiCharacter} onChange={(event) => setAiCharacter(event.target.value as typeof aiCharacter)}><option value="none">لحن ثابت رسانه</option><option value="tara">تارا</option><option value="kamran">کامران</option></select></label><button className="primary" disabled={busy || !aiRequestText.trim()} onClick={() => { onSuggest(aiRequestText.trim(), aiCharacter); setAiRequestOpen(false); }} type="button">ارسال درخواست به AI</button></div>}
        </div>
      </section>
    );
  }
  if (selectedStory) {
    const storyAccount = accounts.find((item) => item.id === selectedStory.accountId);
    const storyBrand = engagementBrand(storyAccount);
    const storyLink = selectedStory.mediaPermalink || selectedStory.mediaUrl || selectedStory.mediaThumbnail;
    return (
      <section className="conversation-list story-reply-chat">
        <header className="story-chat-header">
          <button className="secondary story-chat-back" onClick={() => { setSelectedStory(undefined); setSelectedStoryReplyIds([]); }} type="button"><span aria-hidden="true">←</span><span className="story-back-label">بازگشت</span></button>
          <button aria-label="باز کردن استوری" className="story-chat-thumb" disabled={!storyLink} onClick={() => { if (storyLink) window.open(storyLink, "_blank", "noopener,noreferrer"); }} style={{ "--story-color": storyBrand.color } as CSSProperties} title={storyLink ? "باز کردن استوری" : "رسانهٔ استوری در دسترس نیست"} type="button">
            <StoryPreviewMedia item={selectedStory} />
          </button>
          <div><b>پاسخ‌های این استوری</b><small>{storyBrand.label} · {storyConversation.length} پیام</small></div>
          <button className="secondary story-chat-rule" onClick={() => onStoryRule(selectedStory)} type="button">تنظیم قانون پاسخ</button>
        </header>
        <section className="story-context-editor">
          <label>
            توضیحات متنی استوری
            <textarea value={storyContextText} onChange={(event) => setStoryContextText(event.target.value)} maxLength={3000} rows={3} placeholder="موضوع استوری، متن‌های روی تصویر، دعوت به تعامل یا معما را کوتاه بنویسید…" />
          </label>
          <div><small>این توضیح برای پیشنهاد پاسخ AI و پاسخ خودکارِ همین استوری استفاده می‌شود.</small><button className="secondary" disabled={busy || !selectedStory.mediaId} onClick={() => void onStoryContext(selectedStory, storyContextText)} type="button">ذخیرهٔ توضیحات</button></div>
        </section>
        {selectedStoryReplyIds.length > 0 && <section className="story-bulk-composer">
          <b>پاسخ گروهی به {toPersianDigits(String(selectedStoryReplyIds.length))} مخاطب</b>
          <textarea disabled={busy} value={bulkMessageText} onChange={(event) => setBulkMessageText(event.target.value)} rows={3} placeholder="یک پیام مشترک برای مخاطبان منتخب…" />
          <div><button className="secondary" disabled={busy} onClick={() => setSelectedStoryReplyIds([])} type="button">لغو انتخاب</button><button className="primary" disabled={busy || !bulkMessageText.trim()} onClick={() => void onBulkMessage(selectedStoryReplyIds, bulkMessageText).then((sent) => { if (sent) { setBulkMessageText(""); setSelectedStoryReplyIds([]); } })} type="button">ارسال به منتخب‌ها</button></div>
        </section>}
        <div className="chat-history mobile-history">
          {storyConversation.length === 0 ? <p className="hint">پاسخی برای این استوری ثبت نشده است.</p> : storyConversation.map((item) => (
            <article className={item.direction === "outgoing" ? "outgoing" : "incoming"} key={item.eventId}>
              <header className="story-message-identity"><span className="inbox-avatar">{item.senderProfilePhoto ? <img loading="lazy" src={item.senderProfilePhoto} alt="" /> : engagementIdentity(item).label.slice(0, 1)}</span><div><b>{engagementIdentity(item).label}</b><small>{engagementIdentity(item).subtitle}</small></div></header>
              <p>{engagementMessageSummary(item)}</p>
              <EngagementMessageMedia item={item} />
              <footer className="story-reply-actions"><time>{formatEngagementTime(item.receivedAt)}</time><label><input checked={selectedStoryReplyIds.includes(item.eventId)} onChange={() => setSelectedStoryReplyIds((current) => current.includes(item.eventId) ? current.filter((id) => id !== item.eventId) : [...current, item.eventId])} type="checkbox" /> انتخاب گروهی</label><button className="secondary" disabled={busy} onClick={() => { setSelectedStory(undefined); setSelectedStoryReplyIds([]); onSelect(item.eventId); }} type="button">پاسخ تکی</button></footer>
            </article>
          ))}
        </div>
      </section>
    );
  }
  return (
    <section className="conversation-list">
      {storyReplies.length > 0 && (
        <section className="story-reply-strip" aria-label="استوری‌های دارای پاسخ">
          <header><b>استوری‌ها</b><small>استوری‌هایی که به آن‌ها پاسخ رسیده است</small></header>
          <div>{storyReplies.map((story) => {
            const storyBrand = engagementBrand(accounts.find((account) => account.id === story.accountId));
            const expired = Math.floor(Date.now() / 1000) - Number(story.storyPublishedAt || story.receivedAt || 0) > 24 * 60 * 60;
            return <button className={`story-reply-card${expired ? " story-expired" : ""}`} key={`${story.accountId}:${story.mediaId || story.eventId}`} onClick={() => { setSelectedStory(story); setStoryContextText(story.storyContext ?? ""); setSelectedStoryReplyIds([]); }} style={{ "--story-color": storyBrand.color } as CSSProperties} title={expired ? "استوری پایان‌یافته؛ پاسخ‌ها و تنظیمات آن همچنان در دسترس‌اند" : "مشاهده پاسخ‌های این استوری"} type="button"><span><StoryPreviewMedia item={story} /></span><b>{storyBrand.label}</b><small>{formatEngagementTime(story.storyPublishedAt || story.receivedAt)}</small></button>;
          })}</div>
          {(allStoryReplies.length > storyReplies.length || hasMore) && <button className="secondary story-more" disabled={loadingMore || busy} onClick={() => { setStoryLimit(current => current + 20); if (hasMore) onLoadMore(); }} type="button">{loadingMore ? "در حال دریافت استوری‌های قدیمی‌تر…" : "مشاهده استوری‌های بیشتر"}</button>}
        </section>
      )}
      <div className="conversation-filter">
        <button
          className={!activeAccounts.length ? "selected" : ""}
          onClick={onClearAccounts}
          type="button"
        >
          همه گفتگوها
        </button>
        {accounts.map((account) => {
          const item = engagementBrand(account);
          return (
            <span className="engagement-account-filter" key={account.id}><button
              className={activeAccounts.includes(account.id) ? "selected" : ""}
              onClick={() => onToggleAccount(account.id)}
              style={{ "--bubble-color": item.color } as CSSProperties}
              type="button"
            >{item.label}</button></span>
          );
        })}
        <details>
          <summary>🏷 فیلتر برچسب</summary>
          {tags.length === 0 ? (
            <small>هنوز برچسبی نیست.</small>
          ) : (
            tags.map((tag) => (
              <label key={tag}>
                <input
                  checked={activeTags.includes(tag)}
                  onChange={() => onToggleTag(tag)}
                  type="checkbox"
                />
                {tag}
              </label>
            ))
          )}
        </details>
      </div>
      <div className="conversation-list-header">
        <b>{toPersianDigits(String(conversations.length))} گفتگو</b>
        <span>
          <small>دایرکت و پاسخ استوری</small>
          <button className="secondary refresh-conversations" disabled={busy} onClick={onRefresh} title="به‌روزرسانی گفتگوها و استوری‌ها" type="button" aria-label="به‌روزرسانی گفتگوها و استوری‌ها">↻</button>
        </span>
      </div>
      {loading && conversations.length === 0 && <div className="conversation-loading" aria-live="polite"><span /> در حال بارگذاری گفت‌وگوها…</div>}
      {conversations.map((entry) => {
        const item = entry.contact;
        const latest = entry.latest;
        const itemAccount = accounts.find(
          (account) => account.id === item.accountId,
        );
        const itemBrand = engagementBrand(itemAccount);
        const identity = engagementIdentity(item);
        return (
          <div
            className="conversation-card"
            key={`${item.accountId}:${item.senderId || item.eventId}`}
          >
            <input
              className="conversation-archive-select"
              aria-label={`انتخاب گفت‌وگوی ${identity.label}`}
              checked={selectedConversationIds.includes(item.eventId)}
              onChange={() =>
                setSelectedConversationIds((current) =>
                  current.includes(item.eventId)
                    ? current.filter((id) => id !== item.eventId)
                    : [...current, item.eventId],
                )
              }
              type="checkbox"
            />
            <button
              className="conversation-card-open"
              onClick={() => onSelect(item.eventId)}
              type="button"
            >
            <span className="inbox-avatar">
              {item.senderProfilePhoto ? (
                <img loading="lazy" src={item.senderProfilePhoto} alt="" />
              ) : (
                identity.label.slice(0, 1)
              )}
            </span>
            <span className="conversation-copy">
              <b>{identity.label}</b>
              <small>{identity.subtitle}</small>
              <p>{latest.direction === "outgoing" ? "شما: " : ""}{engagementMessageSummary(latest)}</p>
              <div>
                {entry.tags.map((tag) => (
                  <i key={tag}>#{tag}</i>
                ))}
              </div>
            </span>
            <span className="conversation-meta">
              <span
                className="media-badge comment-account-bubble"
                style={{ "--media-color": itemBrand.color } as CSSProperties}
              >
                {itemBrand.label}
              </span>
              <time>{formatEngagementTime(latest.receivedAt)}</time>
              {item.status === "new" && <em>جدید</em>}
            </span>
            </button>
          </div>
        );
      })}
      {hasMore && <button className="secondary inbox-load-more" disabled={loadingMore || busy} onClick={onLoadMore} type="button">{loadingMore ? "در حال دریافت پیام‌های قدیمی‌تر…" : "پیام‌های قدیمی‌تر"}</button>}
      {selectedConversationIds.length > 0 && (
        <section className="conversation-bulk-message">
          <b>ارسال یک پیام به {toPersianDigits(String(selectedConversationIds.length))} گفت‌وگو</b>
          <textarea
            disabled={busy}
            onChange={(event) => setBulkMessageText(event.target.value)}
            placeholder="پیامی که برای همهٔ کاربران انتخاب‌شده ارسال می‌شود…"
            rows={3}
            value={bulkMessageText}
          />
          <div>
            <button className="secondary" disabled={busy} onClick={() => { setSelectedConversationIds([]); setBulkMessageText(""); }} type="button">لغو انتخاب</button>
            <button
              className="primary"
              disabled={busy || !bulkMessageText.trim()}
              onClick={() => {
                if (!window.confirm(`این پیام برای ${selectedConversationIds.length} گفت‌وگوی انتخاب‌شده ارسال شود؟`)) return;
                void onBulkMessage(selectedConversationIds, bulkMessageText.trim()).then((sent) => {
                  if (sent) { setSelectedConversationIds([]); setBulkMessageText(""); }
                });
              }}
              type="button"
            >
              {busy ? "در حال ارسال…" : "تأیید و ارسال گروهی"}
            </button>
          </div>
          <small>ارسال با فاصلهٔ ایمن دو ثانیه‌ای انجام می‌شود.</small>
        </section>
      )}
    </section>
  );
}
const normaliseContentValue = (field: string, value: string) =>
  [
    "morningGregorianDate",
    "marketGregorianDate",
    "morningKalamTodayIndex",
  ].includes(field)
    ? value
    : toPersianDigits(value);
const OCCASION_AI_WORD_LIMIT = 14;
const occasionNeedsManualTypesetting = (value: string) => {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return (
    lines.length > 1 ||
    (lines[0]?.split(/\s+/).filter(Boolean).length ?? 0) >
      OCCASION_AI_WORD_LIMIT
  );
};

function ModernSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <label className="modern-switch">
      <span>{label}</span>
      <input
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      <span className="switch-track" aria-hidden="true">
        <span />
      </span>
    </label>
  );
}

function SparkleButton({
  label,
  loading,
  onClick,
}: {
  label: string;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className="sparkle-button"
      disabled={loading}
      onClick={onClick}
      type="button"
    >
      <span className={loading ? "sparkle-spinner" : ""}>
        {loading ? "" : "✦"}
      </span>
      {loading ? "در حال دریافت…" : label}
    </button>
  );
}

function escapePublishHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Converts imported plain/Markdown output to a deliberately neutral editor
 * document. Only its first non-empty line is the headline and bold. */
function importedPublishRichText(value: string) {
  // Keep paragraph boundaries before removing HTML. Otherwise <br> is erased
  // and all imported content turns into a single (therefore bold) headline.
  const plain = value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|h[1-6])\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1")
    .replace(/\r/g, "")
    .replace(/^\n+|\n+$/g, "");
  const lines = plain.split("\n").map((line) => line.trim());
  const headlineIndex = lines.findIndex((line) => Boolean(line));
  return lines
    .map((line, index) => {
      if (!line) return "<p><br></p>";
      const headline = index === headlineIndex;
      return `<p>${headline ? "<strong>" : ""}${escapePublishHtml(line)}${headline ? "</strong>" : ""}</p>`;
    })
    .join("");
}

function publishInternalTitle(value: string) {
  const plain = value.replace(/<br\s*\/?\s*>/gi, "\n").replace(/<\/p\s*>/gi, "\n").replace(/<[^>]*>/g, "").replace(/&nbsp;/gi, " ").replace(/\r/g, "");
  const firstLine = plain.split("\n").map((line) => line.trim()).find(Boolean) ?? "";
  return firstLine.replace(/^#{1,6}\s+/, "").replace(/^[-*]\s+/, "").trim();
}

function selectedVideoCompressionLimit(targets: PublicationTarget[]) {
  const limits = targets
    .map((target) => videoUploadLimits[target.split("_", 1)[0]])
    .filter((limit): limit is number => Boolean(limit));
  return limits.length ? Math.min(...limits) : undefined;
}

function RichTextEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const editor = useRef<HTMLDivElement>(null);
  const savedSelection = useRef<Range | null>(null);
  const [showSnippets, setShowSnippets] = useState(false);
  const [activeFormats, setActiveFormats] = useState<Record<string, boolean>>(
    {},
  );
  const [snippetName, setSnippetName] = useState("");
  const [snippetText, setSnippetText] = useState("");
  const [snippets, setSnippets] = useState<
    Array<{ name: string; text: string }>
  >(() => {
    try {
      return JSON.parse(
        window.localStorage.getItem("kalam-studio-publish-snippets") ?? "[]",
      );
    } catch {
      return [];
    }
  });
  const saveSnippets = (next: Array<{ name: string; text: string }>) => {
    setSnippets(next);
    window.localStorage.setItem(
      "kalam-studio-publish-snippets",
      JSON.stringify(next),
    );
  };
  useEffect(() => {
    if (editor.current && editor.current.innerHTML !== value)
      editor.current.innerHTML = value.replace(/\n/g, "<br>");
  }, [value]);
  const rememberSelection = () => {
    const root = editor.current;
    const selection = window.getSelection();
    if (!root || !selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (root.contains(range.startContainer) && root.contains(range.endContainer))
      savedSelection.current = range.cloneRange();
  };
  const syncFormats = () =>
    setActiveFormats({
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      underline: document.queryCommandState("underline"),
      heading: /^h[1-6]$/i.test(
        document.queryCommandValue("formatBlock") || "",
      ),
      right: document.queryCommandState("justifyRight"),
      center: document.queryCommandState("justifyCenter"),
      left: document.queryCommandState("justifyLeft"),
    });
  const command = (name: string, argument?: string) => {
    editor.current?.focus();
    document.execCommand(name, false, argument);
    onChange(editor.current?.innerHTML ?? "");
    syncFormats();
  };
  const insertSnippet = (text: string) => {
    const root = editor.current;
    if (!root) return;
    const html = text.replace(/\n/g, "<br>");
    const range = savedSelection.current;
    const rangeIsInsideEditor =
      range && root.contains(range.startContainer) && root.contains(range.endContainer);
    root.focus();
    if (rangeIsInsideEditor && range) {
      const fragment = range.createContextualFragment(html);
      const lastNode = fragment.lastChild;
      range.deleteContents();
      range.insertNode(fragment);
      const nextRange = document.createRange();
      if (lastNode) nextRange.setStartAfter(lastNode);
      else nextRange.selectNodeContents(root);
      nextRange.collapse(true);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(nextRange);
      savedSelection.current = nextRange.cloneRange();
    } else {
      root.insertAdjacentHTML("beforeend", html);
      const nextRange = document.createRange();
      nextRange.selectNodeContents(root);
      nextRange.collapse(false);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(nextRange);
      savedSelection.current = nextRange.cloneRange();
    }
    onChange(root.innerHTML);
    setShowSnippets(false);
    window.setTimeout(syncFormats, 0);
  };
  return (
    <div className="rich-editor">
      <div
        className="rich-toolbar"
        aria-label="ابزارهای قالب‌بندی متن"
        onMouseDown={(event) => {
          if ((event.target as HTMLElement).closest("button"))
            event.preventDefault();
        }}
      >
        <button
          aria-pressed={Boolean(activeFormats.bold)}
          className={activeFormats.bold ? "active" : ""}
          onClick={() => command("bold")}
          title="بولد"
          type="button"
        >
          <b>B</b>
        </button>
        <button
          aria-pressed={Boolean(activeFormats.italic)}
          className={activeFormats.italic ? "active" : ""}
          onClick={() => command("italic")}
          title="ایتالیک"
          type="button"
        >
          <i>I</i>
        </button>
        <button
          aria-pressed={Boolean(activeFormats.underline)}
          className={activeFormats.underline ? "active" : ""}
          onClick={() => command("underline")}
          title="زیرخط"
          type="button"
        >
          <u>U</u>
        </button>
        <button
          aria-pressed={Boolean(activeFormats.heading)}
          className={activeFormats.heading ? "active" : ""}
          onClick={() => command("formatBlock", "H3")}
          title="عنوان"
          type="button"
        >
          H
        </button>
        <button
          aria-pressed={Boolean(activeFormats.right)}
          className={activeFormats.right ? "active" : ""}
          onClick={() => command("justifyRight")}
          title="راست‌چین"
          type="button"
        >
          ⇥
        </button>
        <button
          aria-pressed={Boolean(activeFormats.center)}
          className={activeFormats.center ? "active" : ""}
          onClick={() => command("justifyCenter")}
          title="وسط‌چین"
          type="button"
        >
          ≡
        </button>
        <button
          aria-pressed={Boolean(activeFormats.left)}
          className={activeFormats.left ? "active" : ""}
          onClick={() => command("justifyLeft")}
          title="چپ‌چین"
          type="button"
        >
          ⇤
        </button>
        <label title="رنگ نوشته">
          <input
            aria-label="رنگ نوشته"
            onChange={(event) => command("foreColor", event.target.value)}
            type="color"
          />
        </label>
        <button
          onClick={() =>
            setShowSnippets((current) => {
              const next = !current;
              if (next) {
                setSnippetText(value);
                setSnippetName("");
              }
              return next;
            })
          }
          title="متن‌های آماده"
          type="button"
        >
          ⧉
        </button>
      </div>
      <div
        className="rich-editor-input"
        contentEditable
        data-placeholder={placeholder}
        onFocus={() => {
          rememberSelection();
          syncFormats();
        }}
        onInput={() => {
          onChange(editor.current?.innerHTML ?? "");
          rememberSelection();
          syncFormats();
        }}
        onKeyUp={() => {
          rememberSelection();
          syncFormats();
        }}
        onMouseUp={() => {
          rememberSelection();
          syncFormats();
        }}
        ref={editor}
        role="textbox"
        suppressContentEditableWarning
      />
      {showSnippets && (
        <div
          className="rich-snippets"
          onMouseDown={(event) => {
            if ((event.target as HTMLElement).closest("button"))
              event.preventDefault();
          }}
        >
          <div className="snippet-save-fields">
            <input
              value={snippetName}
              onChange={(event) => setSnippetName(event.target.value)}
              placeholder="نام متن آماده"
            />
            <textarea
              value={snippetText}
              onChange={(event) => setSnippetText(event.target.value)}
              placeholder="متن آماده؛ متن چندخطی و قالب‌بندی‌شده پشتیبانی می‌شود"
              rows={6}
            />
            <button
              disabled={!snippetText.trim()}
              onClick={() => {
                const name =
                  snippetName.trim() ||
                  `متن ${toPersianDigits(String(snippets.length + 1))}`;
                saveSnippets(
                  [{ name, text: snippetText }, ...snippets].slice(0, 30),
                );
                setSnippetName("");
                setSnippetText("");
              }}
              type="button"
            >
              ذخیرهٔ متن آماده
            </button>
          </div>
          {snippets.length === 0 ? (
            <small>هنوز متن آماده‌ای ذخیره نشده است.</small>
          ) : (
            snippets.map((snippet, index) => (
              <article key={`${snippet.name}-${index}`}>
                <b>{snippet.name}</b>
                <span>
                  <button
                    onClick={() => insertSnippet(snippet.text)}
                    type="button"
                  >
                    درج
                  </button>
                  <button
                    onClick={() =>
                      void navigator.clipboard?.writeText(
                        snippet.text.replace(/<[^>]*>/g, ""),
                      )
                    }
                    type="button"
                  >
                    کپی
                  </button>
                  <button
                    onClick={() =>
                      saveSnippets(
                        snippets.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                    type="button"
                  >
                    ×
                  </button>
                </span>
              </article>
            ))
          )}
        </div>
      )}
    </div>
  );
}

const imageModelLabels: Record<string, string> = {
  "gemini-3.1-flash-image": "Gemini 3.1 Flash Image",
  "gemini-3.1-flash-lite-image": "Gemini 3.1 Flash Lite Image",
  "gpt-image-2": "GPT Image 2",
  "gpt-image-2.5-flare": "GPT Image 2.5 Flare — سریع",
  "gpt-image-2.5-sunburst": "GPT Image 2.5 Sunburst — دقیق‌تر",
};

function imageModelLabel(model?: unknown): string {
  return imageModelLabels[String(model ?? "")] ?? "مدل انتخاب‌شده";
}

function jobImageModelLabel(job?: DesignJob): string {
  const image = job?.request?.image;
  if (!image || typeof image !== "object" || Array.isArray(image)) {
    return "مدل ثبت‌شدهٔ پروژه";
  }
  return imageModelLabel((image as Record<string, unknown>).engine);
}

function usageLabel(usage?: AvalaiUsage): string | undefined {
  if (!usage || (!usage.totalTokens && usage.costIrt === undefined && !usage.model))
    return undefined;
  const model = usage.model ? `مدل: ${imageModelLabel(usage.model)} / ` : "";
  const tokens = usage.totalTokens
    ? `${Number(usage.totalTokens).toLocaleString("fa-IR")} توکن`
    : "توکن اعلام نشده";
  // AvalAI's `irt` and `paid_irt` values are already toman. A second
  // conversion would understate the actual charge tenfold.
  const cost =
    usage.costIrt == null
      ? "هزینه در حال محاسبه"
      : `${Math.round(Number(usage.costIrt)).toLocaleString("fa-IR")} تومان${usage.costVerified ? "" : " (تخمینی)"}`;
  const balance =
    usage.balanceIrt == null
      ? ""
      : ` / مانده اعتبار: ${Math.round(Number(usage.balanceIrt)).toLocaleString("fa-IR")} تومان`;
  return `${model}هزینه: ${tokens} / ${cost}${balance}`;
}

const newsSeekerTabs: Array<{
  id: "all" | NewsSeekerCategory;
  label: string;
  icon: string;
}> = [
  { id: "all", label: "پیشنهادهای ملی", icon: "◉" },
  { id: "google_trends", label: "ترند عمومی", icon: "⌁" },
  { id: "google_sports", label: "ترند ورزشی", icon: "⚽" },
  { id: "local", label: "گلبهار چناران", icon: "⌖" },
  { id: "khabarfarsi", label: "خبرفارسی", icon: "▤" },
  { id: "national", label: "خبر‌یاب ملی", icon: "★" },
  { id: "khorasan_razavi", label: "خراسان رضوی", icon: "⌖" },
];

function NewsSeekerWorkspace({
  snapshots,
  items,
  queue,
  sources,
  activeCategory,
  selectedSnapshotId,
  busy,
  error,
  notice,
  onCategory,
  onRefresh,
  onSelect,
  onEdit,
  onImage,
  onPublish,
  onArchive,
  onQueueSelect,
  onQueueDraft,
  onQueueProject,
  onBack,
}: {
  snapshots: NewsSeekerSnapshot[];
  items: NewsSeekerItem[];
  queue: NewsroomQueueEntry[];
  sources: NewsroomSource[];
  activeCategory: "all" | NewsSeekerCategory;
  selectedSnapshotId: string;
  busy: boolean;
  error: string;
  notice: string;
  onCategory: (category: "all" | NewsSeekerCategory) => void;
  onRefresh: (category: "all" | NewsSeekerCategory) => void;
  onSelect: (id: string) => void;
  onEdit: (item: NewsSeekerItem) => void;
  onImage: (item: NewsSeekerItem) => void;
  onPublish: (item: NewsSeekerItem) => void;
  onArchive: (item: NewsSeekerItem) => void;
  onQueueSelect: (item: NewsSeekerItem) => void;
  onQueueDraft: (entry: NewsroomQueueEntry) => void;
  onQueueProject: (entry: NewsroomQueueEntry) => void;
  onBack: () => void;
}) {
  const [deskView, setDeskView] = useState<"suggestions" | "all" | "queue" | "published" | "sources">("suggestions");
  const [footerMenuOpen, setFooterMenuOpen] = useState(false);
  const visible = snapshots.filter(
    (snapshot) =>
      activeCategory === "all" || snapshot.category === activeCategory,
  );
  const selected =
    visible.find((snapshot) => snapshot.snapshotId === selectedSnapshotId);
  const formatDate = (timestamp: number) =>
    new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Tehran",
    }).format(new Date(timestamp * 1000));
  const formatItemDate = (value?: string) => {
    if (!value) return "";
    const parsed = Date.parse(value);
    return Number.isNaN(parsed)
      ? value
      : new Intl.DateTimeFormat("fa-IR-u-ca-persian", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tehran" }).format(new Date(parsed));
  };
  const categoryLabel = (category: NewsSeekerCategory) =>
    newsSeekerTabs.find((tab) => tab.id === category)?.label ?? category;
  const rankedItems = [...items].sort((left, right) => (right.priorityScore ?? 0) - (left.priorityScore ?? 0));
  const renderDeskItem = (item: NewsSeekerItem) => (
    <article className="news-item" key={`${item.snapshotId ?? ""}-${item.id}`}>
      <div className="news-item-copy">
        {item.imageUrl && <img src={item.imageUrl} alt="" />}
        <div>
          <h4>{item.title}</h4>
          {item.summary && <p>{item.summary}</p>}
          <small>{item.source || "منبع نامشخص"}{item.publishedAt ? " · " + formatItemDate(item.publishedAt) : ""}</small>
          {item.priorityScore !== undefined && <span className={["news-priority-score", item.priorityScore >= 80 ? "high" : item.priorityScore >= 55 ? "medium" : "low"].join(" ")}>امتیاز انتشار {toPersianDigits(String(item.priorityScore))}<em>{item.priorityReason || "قابل بررسی"}</em></span>}
          {item.needsReview && <span className="news-priority-score medium">نیازمند بررسی حساسیت</span>}
        </div>
      </div>
      <div className="news-item-actions">
        <a href={item.url} rel="noreferrer" target="_blank">مشاهدهٔ منبع</a>
        <button className="primary" onClick={() => onQueueSelect(item)} type="button">افزودن به صف</button>
        <button onClick={() => onEdit(item)} type="button">✎ ویرایش متن</button>
        <button onClick={() => onImage(item)} type="button">✦ ساخت تصویر</button>
      </div>
    </article>
  );
  const renderSnapshotDetail = (snapshot: NewsSeekerSnapshot) => (
    <section className="news-detail" id={"news-snapshot-" + snapshot.snapshotId}>
      <div className="section-heading">
        <div>
          <h3>خبرهای این دریافت</h3>
          <p className="hint">
            {categoryLabel(snapshot.category)} · {formatDate(snapshot.createdAt)}
            {" · "}
            {toPersianDigits(String(snapshot.itemCount))} مورد
          </p>
        </div>
      </div>
      <div className="news-item-list">
        {snapshot.items.map((item) => (
          <article className="news-item" key={item.id}>
            <div className="news-item-copy">
              {item.imageUrl && <img src={item.imageUrl} alt="" />}
              <div>
                <h4>{item.title}</h4>
                {item.summary && <p>{item.summary}</p>}
                <small>
                  {item.source || "منبع نامشخص"}
                  {item.publishedAt ? " · " + formatItemDate(item.publishedAt) : ""}
                  {item.traffic ? " · " + item.traffic + " جست‌وجو" : ""}
                </small>
                {item.priorityScore !== undefined && (
                  <span className={["news-priority-score", item.priorityScore >= 80 ? "high" : item.priorityScore >= 55 ? "medium" : "low"].join(" ")}>
                    امتیاز انتشار {toPersianDigits(String(item.priorityScore))}
                    <em>{item.priorityReason || (item.priorityScore >= 80 ? "اولویت بالا" : item.priorityScore >= 55 ? "قابل بررسی" : "اولویت پایین")}</em>
                  </span>
                )}
                {item.related && item.related.length > 0 && (
                  <details className="news-related-items" open>
                    <summary>خبرهای این کلیدواژه ({toPersianDigits(String(item.related.length))})</summary>
                    {item.related.map((related) => {
                      const news: NewsSeekerItem = { ...item, ...related, related: [] };
                      return <article key={related.id || related.url}>
                        {related.imageUrl && <img src={related.imageUrl} alt="" />}
                        <div><b>{related.title}</b><small>{related.source || "منبع نامشخص"}{related.publishedAt ? ` · ${formatItemDate(related.publishedAt)}` : ""}</small>{related.summary && <p>{related.summary}</p>}</div>
                        <div className="news-item-actions"><a href={related.url} rel="noreferrer" target="_blank">مشاهدهٔ منبع</a><button onClick={() => onEdit(news)} type="button">✎ ویرایش با AI</button><button onClick={() => onImage(news)} type="button">✦ ساخت تصویر با AI</button><button onClick={() => onPublish(news)} type="button">↗ انتشار سریع</button><button onClick={() => onArchive(news)} type="button"><BookmarkIcon /> ذخیره در سوژه خبری</button></div>
                      </article>;
                    })}
                  </details>
                )}
              </div>
            </div>
            <div className="news-item-actions">
              <a href={item.url} rel="noreferrer" target="_blank">مشاهدهٔ منبع</a>
              {item.trendUrl && <a href={item.trendUrl} rel="noreferrer" target="_blank">مشاهدهٔ Google Trends{item.trendKeyword ? ` · ${item.trendKeyword}` : ""}</a>}
              <button onClick={() => onEdit(item)} type="button">✎ ویرایش با AI</button>
              <button onClick={() => onImage(item)} type="button">✦ ساخت تصویر با AI</button>
              <button onClick={() => onPublish(item)} type="button">↗ انتشار سریع</button>
              <button onClick={() => onArchive(item)} type="button"><BookmarkIcon /> ذخیره در سوژه خبری</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
  return (
    <section className="news-seeker-workspace">
      <div className="news-seeker-hero">
        <div>
          <span>News Desk · Shared Feed</span>
          <h2>جستجوگر خبر</h2>
          <p>
            هر دریافت برای همهٔ همکاران مشترک است؛ نتیجهٔ تازه بدون تکرار در
            آرشیو می‌ماند.
          </p>
        </div>
        <button className="secondary" onClick={onBack} type="button">
          بازگشت به استودیو
        </button>
      </div>
      <div className="news-seeker-body">
        <nav className="news-category-tabs" aria-label="منبع و حوزهٔ خبر">
          {newsSeekerTabs.map((tab) => <button className={activeCategory === tab.id ? "active" : ""} key={tab.id} onClick={() => { onCategory(tab.id); onSelect(""); setDeskView(tab.id === "all" ? "suggestions" : "all"); }} type="button"><span>{tab.icon}</span>{tab.label}</button>)}
        </nav>
        <div className="section-heading news-seeker-heading">
          <div>
            <h3>
              {deskView === "suggestions" ? "پنج پیشنهاد برتر این ساعت" : deskView === "queue" ? "صف انتشار آزمایشی" : deskView === "published" ? "آرشیو آمادهٔ انتشار" : deskView === "sources" ? "منابع و سلامت دریافت" : "همهٔ خبرهای دریافت‌شده"}
            </h3>
            <p className="hint">
              {deskView === "suggestions" ? "خبر فقط پس از انتخاب شما به صف می‌رود و انتشار خودکار نیست." : "دریافت و رتبه‌بندی بین همهٔ همکاران مشترک است."}
            </p>
          </div>
          <button
            className="primary news-refresh"
            disabled={busy}
            onClick={() => onRefresh(activeCategory)}
            type="button"
          >
            {busy
              ? "در حال درخواست…"
              : activeCategory === "all"
                ? "دریافت همهٔ منابع"
                : `دریافت ${categoryLabel(activeCategory)}`}
          </button>
        </div>
        {notice && <p className="success news-seeker-notice">{notice}</p>}
        {error && <p className="error news-seeker-notice">{error}</p>}
        {deskView === "suggestions" ? (
          <div className="news-item-list">{rankedItems.slice(0, 5).map(renderDeskItem)}{rankedItems.length === 0 && <div className="news-empty"><b>هنوز پیشنهاد تازه‌ای نیست.</b><p>با دریافت منابع، پنج خبر برتر اینجا دیده می‌شوند.</p></div>}</div>
        ) : deskView === "queue" ? (
          <div className="news-item-list">{queue.filter((entry) => entry.status !== "archived").map((entry) => <article className="news-item" key={entry.id}><div className="news-item-copy"><div><h4>{String(entry.draft.headline || entry.item.title)}</h4><p>{entry.status === "selected" ? "برای ساخت پیش‌نویس آماده است." : entry.status === "ready_to_publish" ? "سوژهٔ خبری ساخته شد؛ انتشار نهایی در بخش انتشار انجام می‌شود." : "پیش‌نویس AI آمادهٔ بازبینی است."}</p><small>{entry.item.source} · {entry.targets.includes("site") && entry.siteMediaStatus === "needs_media" ? "سایت نیازمند تصویر شاخص" : "مقصدها انتخاب شده‌اند"}</small></div></div><div className="news-item-actions">{entry.status === "selected" && <button className="primary" onClick={() => onQueueDraft(entry)} type="button">ساخت پیش‌نویس AI</button>}{entry.status === "draft_ready" && <button className="primary" onClick={() => onQueueProject(entry)} type="button">باز کردن در سوژه خبری</button>}{entry.contentProjectId && <button onClick={() => onQueueProject(entry)} type="button">مشاهدهٔ سوژه</button>}<a href={entry.item.url} rel="noreferrer" target="_blank">منبع</a></div></article>)}{queue.filter((entry) => entry.status !== "archived").length === 0 && <div className="news-empty"><b>صف انتشار خالی است.</b><p>از پیشنهادها یا همهٔ خبرها مورد دلخواه را انتخاب کنید.</p></div>}</div>
        ) : deskView === "published" ? (
          <div className="news-item-list">{queue.filter((entry) => ["published", "partial", "uncertain", "failed"].includes(entry.publicationState ?? "")).map((entry) => <article className="news-item" key={entry.id}><div className="news-item-copy"><div><h4>{String(entry.draft.headline || entry.item.title)}</h4><small>{entry.publicationState === "published" ? "انتشار کامل ثبت شده است." : `وضعیت انتشار: ${entry.publicationState}`}</small></div></div><div className="news-item-actions"><button onClick={() => onQueueProject(entry)} type="button">باز کردن سوژه</button></div></article>)}{queue.filter((entry) => ["published", "partial", "uncertain", "failed"].includes(entry.publicationState ?? "")).length === 0 && <div className="news-empty"><b>هنوز انتشار ثبت‌شده‌ای در این چرخه نیست.</b></div>}</div>
        ) : deskView === "sources" ? (
          <div className="news-item-list">{sources.map((source) => <article className="news-item" key={source.id}><div className="news-item-copy"><div><h4>{source.label}</h4><small>{source.domain} · حوزه: {source.scope === "golbahar" ? "گلبهار" : source.scope === "khorasan_razavi" ? "خراسان رضوی" : "ملی"}</small><p>اعتبار {toPersianDigits(String(source.credibility))} · {source.health === "healthy" ? "دریافت سالم" : source.health === "stale" ? "نیازمند بررسی دریافت" : "هنوز دریافت نشده"}</p></div></div><div className="news-item-actions"><a href={source.feedUrl} rel="noreferrer" target="_blank">بررسی خوراک</a></div></article>)}</div>
        ) : deskView === "all" && visible.length === 0 ? (
          <div className="news-empty">
            <b>هنوز کارتی در این بخش نیست.</b>
            <p>
              اولین دریافت از همین‌جا یا اجرای خودکار n8n، نتیجه را برای همهٔ
              کاربران ثبت می‌کند.
            </p>
          </div>
        ) : deskView === "all" ? (
          <div className="news-snapshot-grid">
            {visible.map((snapshot) => (
              <article
                className={`news-snapshot-entry ${selected?.snapshotId === snapshot.snapshotId ? "expanded" : ""}`}
                key={snapshot.snapshotId}
              >
              <button
                aria-controls={`news-snapshot-${snapshot.snapshotId}`}
                aria-expanded={selected?.snapshotId === snapshot.snapshotId}
                className={`news-snapshot-card ${selected?.snapshotId === snapshot.snapshotId ? "selected" : ""}`}
                onClick={() => onSelect(selected?.snapshotId === snapshot.snapshotId ? "" : snapshot.snapshotId)}
                type="button"
              >
                <span className="news-category-pill">
                  {categoryLabel(snapshot.category)}
                </span>
                <b>
                  {toPersianDigits(String(snapshot.itemCount))} خبر دریافت شد
                </b>
                <small>به‌روزرسانی: {formatDate(snapshot.createdAt)}</small>
                <small>
                  دریافت‌کننده:{" "}
                  {snapshot.requestedBy?.automated
                    ? "دریافت خودکار n8n"
                    : snapshot.requestedBy?.name ||
                      snapshot.requestedBy?.username ||
                      "ادمین استودیو"}
                </small>
                <i>
                  {snapshot.trigger === "automatic" ? "خودکار" : "درخواستی"}
                </i>
              </button>
              {selected?.snapshotId === snapshot.snapshotId && renderSnapshotDetail(snapshot)}
              </article>
            ))}
          </div>
        ) : null}
        {selected && (
          <section className="news-detail" hidden>
            <div className="section-heading">
              <div>
                <h3>خروجی دریافت‌شده</h3>
                <p className="hint">
                  {categoryLabel(selected.category)} ·{" "}
                  {formatDate(selected.createdAt)} ·{" "}
                  {toPersianDigits(String(selected.itemCount))} مورد
                </p>
              </div>
            </div>
            <div className="news-item-list">
              {selected.items.map((item) => (
                <article className="news-item" key={item.id}>
                  <div className="news-item-copy">
                    {item.imageUrl && <img src={item.imageUrl} alt="" />}
                    <div>
                      <h4>{item.title}</h4>
                      {item.summary && <p>{item.summary}</p>}
                      <small>
                        {item.source || "منبع نامشخص"}
                        {item.publishedAt ? ` · ${formatItemDate(item.publishedAt)}` : ""}
                        {item.traffic ? ` · ${item.traffic} جست‌وجو` : ""}
                      </small>
                      {item.priorityScore !== undefined && (
                        <span
                          className={`news-priority-score ${item.priorityScore >= 80 ? "high" : item.priorityScore >= 55 ? "medium" : "low"}`}
                        >
                          امتیاز انتشار{" "}
                          {toPersianDigits(String(item.priorityScore))}
                          <em>
                            {item.priorityReason ||
                              (item.priorityScore >= 80
                                ? "اولویت بالا"
                                : item.priorityScore >= 55
                                  ? "قابل بررسی"
                                  : "اولویت پایین")}
                          </em>
                        </span>
                      )}
                      {item.related && item.related.length > 0 && (
                        <details>
                          <summary>
                            خبرهای مرتبط (
                            {toPersianDigits(String(item.related.length))})
                          </summary>
                          {item.related.map((related) => (
                            <a
                              href={related.url}
                              key={related.url}
                              rel="noreferrer"
                              target="_blank"
                            >
                              {related.title}
                              {related.source ? ` — ${related.source}` : ""}
                            </a>
                          ))}
                        </details>
                      )}
                    </div>
                  </div>
                  <div className="news-item-actions">
                    <a href={item.url} rel="noreferrer" target="_blank">
                      مشاهدهٔ منبع
                    </a>
                    {item.trendUrl && <a href={item.trendUrl} rel="noreferrer" target="_blank">مشاهدهٔ Google Trends{item.trendKeyword ? ` · ${item.trendKeyword}` : ""}</a>}
                    <button onClick={() => onEdit(item)} type="button">
                      ✎ ویرایش با AI
                    </button>
                    <button onClick={() => onImage(item)} type="button">
                      ✦ ساخت تصویر با AI
                    </button>
                    <button onClick={() => onPublish(item)} type="button">
                      ↗ انتشار سریع
                    </button>
                    <button onClick={() => onArchive(item)} type="button"><BookmarkIcon /> ذخیره در سوژه خبری</button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
      <footer className="news-seeker-footer">
        <nav>
                    {[
            { id: "suggestions", label: "پیشنهادهای این ساعت", icon: "★" },
            { id: "all", label: "همهٔ خبرها", icon: "▤" },
            { id: "queue", label: "صف انتشار", icon: "↗" },
            { id: "published", label: "منتشرشده‌ها", icon: "✓" },
            { id: "sources", label: "منابع و سلامت", icon: "◉" },
          ].map((tab) => (
            <button
              className={`${deskView === tab.id ? "active" : ""}${tab.id === "sources" ? " news-footer-source" : ""}`}
              key={tab.id}
              onClick={() => {
                setDeskView(tab.id as typeof deskView);
                if (tab.id !== "all") onSelect("");
                setFooterMenuOpen(false);
              }}
              type="button"
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
        <button
          aria-expanded={footerMenuOpen}
          aria-label="گزینه‌های بیشتر جستجوگر خبر"
          className="news-footer-more"
          onClick={() => setFooterMenuOpen((open) => !open)}
          type="button"
        >
          <span>☰</span>
          بیشتر
        </button>
        {footerMenuOpen && (
          <div className="news-footer-menu" role="menu">
            <button
              className={deskView === "sources" ? "active" : ""}
              onClick={() => {
                setDeskView("sources");
                onSelect("");
                setFooterMenuOpen(false);
              }}
              role="menuitem"
              type="button"
            >
              <span>◉</span>
              منابع و سلامت
            </button>
          </div>
        )}
      </footer>
    </section>
  );
}

const presenterLabels: Record<string, string> = {
  kamran: "کامران", tara: "تارا", mojtaba_jafari: "مجتبی جعفری", hamidreza_jafari: "حمیدرضا جعفری",
};
const locationLabels: Record<string, string> = {
  newsroom: "فضای داخلی شبیه تحریریه", studio_main: "استودیو با مانیتور بزرگ", studio_2: "استودیو شمارهٔ ۲", terrace: "تراس", living_room: "اتاق نشیمن",
};
type StudioTextMode = "monitor" | "designed";
type StudioMonitorMode = "text" | "images" | "blank" | "disabled";
type StudioMonitorImageMode = "generate" | "reference" | "preserve";
type StudioLocationMode =
  | "catalog"
  | "generated_prompt"
  | "exact_reference"
  | "faithful_reference";
type StudioCopySpacePlacement = "auto" | "left" | "right" | "top" | "bottom";

function ShowcaseButtonsEditor({ card, onChange }: { card: EngagementShowcaseCard; onChange: (buttons: EngagementShowcaseCard["buttons"]) => void }) {
  return <details className="rule-buttons-editor showcase-buttons-editor">
    <summary>دکمه‌های این کارت</summary>
    {[0, 1, 2].map((index) => {
      const button = card.buttons?.[index] ?? { type: "postback" as const, title: "", payload: "" };
      const update = (patch: Partial<typeof button>) => {
        const buttons = [...(card.buttons ?? [])];
        buttons[index] = { ...button, ...patch };
        // Keep a row after its type changes even when its title is still
        // empty.  On touch devices people commonly choose «لینک» before
        // typing the title; removing that draft row immediately made React
        // render the select back as «انتخابی» and blocked the following rows.
        while (buttons.length) {
          const last = buttons[buttons.length - 1];
          const isUntouchedPostback = !last?.title?.trim()
            && (last?.type ?? "postback") === "postback"
            && !last?.payload?.trim()
            && !last?.url?.trim();
          if (!isUntouchedPostback) break;
          buttons.pop();
        }
        onChange(buttons);
      };
      return <div className="rule-button-row" key={index}>
        <select aria-label={`نوع دکمه کارت ${index + 1}`} value={button.type ?? "postback"} onChange={(event) => update({ type: event.target.value as "postback" | "web_url" })}><option value="postback">انتخابی</option><option value="web_url">لینک</option></select>
        <input aria-label={`عنوان دکمه کارت ${index + 1}`} value={button.title} onChange={(event) => update({ title: event.target.value })} placeholder={`عنوان دکمه ${index + 1}`} />
        {button.type === "web_url" ? <input dir="ltr" value={button.url ?? ""} onChange={(event) => update({ url: event.target.value, payload: undefined })} placeholder="https://…" /> : <input value={button.payload ?? ""} onChange={(event) => update({ payload: event.target.value, url: undefined })} placeholder="مقدار بازگشتی" />}
      </div>;
    })}
  </details>;
}
const studioImageReferenceLimit = 6;
const imageEngineOptions = [
  { id: "gemini-3.1-flash-image", label: "Gemini 3.1 Flash Image" },
  { id: "gemini-3.1-flash-lite-image", label: "Gemini 3.1 Flash Lite Image" },
  { id: "gpt-image-2", label: "GPT Image 2" },
  { id: "gpt-image-2.5-flare", label: "GPT Image 2.5 Flare — سریع" },
  { id: "gpt-image-2.5-sunburst", label: "GPT Image 2.5 Sunburst — دقیق‌تر" },
];
const videoReferenceLimits: Record<VideoProjectInput["generationModel"], number> = { veo_3_1: 3, gemini_omni_flash: 6 };
const automaticReferenceChoice = (): ReferenceChoice => ({ mode: "auto", assetIds: [] });
const normaliseReferenceChoice = (value: unknown): ReferenceChoice => {
  if (!value || typeof value !== "object") return automaticReferenceChoice();
  const record = value as Record<string, unknown>;
  if (record.mode !== "manual" || !Array.isArray(record.assetIds)) return automaticReferenceChoice();
  return { mode: "manual", assetIds: [...new Set(record.assetIds.filter((id): id is string => typeof id === "string"))] };
};
const studioCopySpaceLabels: Record<StudioCopySpacePlacement, string> = {
  auto: "انتخاب هوشمند",
  left: "سمت چپ تصویر",
  right: "سمت راست تصویر",
  top: "بالای تصویر",
  bottom: "پایین تصویر",
};
const fallbackAssetProfileOptions: VideoAssetProfileOptions = {
  roles: {
    presenter: { identity: "مرجع هویت اصلی", portrait: "پرترهٔ نزدیک", three_quarter: "نمای سه‌رخ", full_body: "تمام‌قد", expression: "حالت چهره / احساس" },
    location: { master: "نمای اصلی", single_presenter: "تک‌مجری", two_presenter: "دو‌مجری", title_space: "فضای خالی عنوان", screen_presenter: "مجری کنار نمایشگر", continuity: "تداوم / حرکت دوربین", alternate: "زاویهٔ مکمل" },
    monitor: { content: "محتوای تصویری مانیتور" },
  },
  aspectRatios: { portrait: "عمودی", landscape: "افقی", square: "مربعی", flexible: "انعطاف‌پذیر" },
  framings: { close: "نزدیک", medium: "نیم‌تنه", full: "تمام‌قد", wide: "نمای باز" },
  copySpaces: { none: "بدون فضای متن", left: "فضای متن چپ", right: "فضای متن راست", top: "فضای متن بالا", bottom: "فضای متن پایین" },
  placements: { auto: "انتخاب هوشمند", behind_desk: "پشت میز", beside_screen: "کنار نمایشگر", seated: "نشسته روی مبلمان", standing_floor: "ایستاده در فضای صحنه" },
  subjectPositions: { auto: "انتخاب هوشمند", left: "سمت چپ", center: "مرکز", right: "سمت راست" },
  foregroundOccluders: { auto: "تشخیص از صحنه", none: "بدون عنصر جلویی", desk: "میز جلوی بدن", seating: "مبل/صندلی جلوی بدن", podium: "تریبون جلوی بدن" },
  cameraAngles: { eye_level: "هم‌سطح چشم", slight_low: "کمی پایین‌تر", slight_high: "کمی بالاتر" },
};
function defaultVideoAssetProfile(kind: "presenter" | "location"): VideoAssetProfile {
  return {
    role: kind === "presenter" ? "identity" : "master",
    aspectRatio: "flexible",
    framing: "medium",
    presenterCapacity: kind === "presenter" ? 1 : 2,
    copySpace: "none",
    placement: "auto",
    subjectPosition: "auto",
    foregroundOccluder: "auto",
    cameraAngle: "eye_level",
    label: "",
  };
}
const shotLabels: Record<VideoLine["shot"], string> = {
  formal: "رسمی", semi_formal: "نیمه‌رسمی", close_up: "کلوزآپ", medium: "نیم‌تنه", full: "تمام‌قد", moving: "در حال حرکت", podium: "پشت تریبون", microphone: "پشت میکروفون", reference: "مطابق مرجع",
};

function ReferenceAssetPicker({ title, assets, choice, limit, onChange }: { title: string; assets: VideoAsset[]; choice: ReferenceChoice; limit: number; onChange: (choice: ReferenceChoice) => void }) {
  const [preview, setPreview] = useState<VideoAsset>();
  const selectedIds = Array.isArray(choice?.assetIds) ? choice.assetIds : [];
  const availableAssets = Array.isArray(assets) ? assets : [];
  const manual = choice.mode === "manual";
  return <section className="reference-asset-picker">
    <label className="reference-picker-toggle"><input checked={manual} onChange={(event) => onChange(event.target.checked ? { mode: "manual", assetIds: selectedIds } : automaticReferenceChoice())} type="checkbox" /><span><b>{title}</b><small>{manual ? `انتخاب دستی فعال · حداکثر ${toPersianDigits(String(limit))} تصویر` : "انتخاب هوشمند بر اساس نقش، قاب و مدل"}</small></span></label>
    {manual && <><div className="reference-picker-grid">{availableAssets.map((asset) => {
      const selected = selectedIds.includes(asset.assetId);
      const disabled = !selected && selectedIds.length >= limit;
      return <button className={selected ? "selected" : ""} disabled={disabled} key={asset.assetId} onClick={() => onChange({ mode: "manual", assetIds: selected ? selectedIds.filter((id) => id !== asset.assetId) : [...selectedIds, asset.assetId] })} type="button">
        <img loading="lazy" decoding="async" fetchPriority="low" alt={asset.filename} src={asset.url} /><span>{selected ? "✓ انتخاب‌شده" : asset.profile?.label || "انتخاب مرجع"}</span><i aria-label={`پیش‌نمایش ${asset.filename}`} onClick={(event) => { event.preventDefault(); event.stopPropagation(); setPreview(asset); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); setPreview(asset); } }} role="button" tabIndex={0}>⛶</i>
      </button>;
    })}</div>{!assets.length && <p className="hint">هنوز تصویر مرجعی برای این مورد ثبت نشده است.</p>}</>}
    {preview && <div className="image-lightbox" role="dialog" aria-modal="true" aria-label="پیش‌نمایش تصویر مرجع" onClick={() => setPreview(undefined)}><figure onClick={(event) => event.stopPropagation()}><button onClick={() => setPreview(undefined)} type="button">×</button><img src={preview.url} alt={preview.filename} /><figcaption>{preview.profile?.label || preview.filename}</figcaption></figure></div>}
  </section>;
}

function VideoAssetManager({ telegramInitData }: { telegramInitData?: string }) {
  const [registry, setRegistry] = useState<VideoAssetRegistry>();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [uploadQueue, setUploadQueue] = useState<VideoUploadItem[]>([]);
  const [uploadProfiles, setUploadProfiles] = useState<Record<string, VideoAssetProfile>>({});
  const [profileEdits, setProfileEdits] = useState<Record<string, VideoAssetProfile>>({});
  const [previewAsset, setPreviewAsset] = useState<VideoAsset>();
  const profileOptions = registry?.profileOptions ?? fallbackAssetProfileOptions;
  const profileKey = (kind: "presenter" | "location", entityId: string) => `${kind}:${entityId}`;
  const uploadProfile = (kind: "presenter" | "location", entityId: string) => uploadProfiles[profileKey(kind, entityId)] ?? defaultVideoAssetProfile(kind);
  const updateUploadProfile = (kind: "presenter" | "location", entityId: string, changes: Partial<VideoAssetProfile>) => setUploadProfiles((current) => {
    const key = profileKey(kind, entityId);
    return { ...current, [key]: { ...(current[key] ?? defaultVideoAssetProfile(kind)), ...changes } };
  });
  const refresh = async () => {
    try { setRegistry(await manageVideoAssets(telegramInitData, "list", { scope: "studio" })); } catch (reason) { setError(reason instanceof Error ? reason.message : "دریافت تصاویر ناموفق بود."); }
  };
  useEffect(() => { void refresh(); }, [telegramInitData]);
  async function upload(kind: "presenter" | "location", entityId: string, files: File[]) {
    if (!files.length) return;
    const queue: VideoUploadItem[] = files.map((file) => ({ id: crypto.randomUUID(), file, kind, entityId, loaded: 0, total: file.size, status: "preparing" }));
    setUploadQueue((current) => [...current.filter((item) => item.status === "failed"), ...queue]);
    setBusy(`${kind}:${entityId}`); setError("");
    let failed = 0;
    for (const item of queue) {
      setUploadQueue((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: "uploading", loaded: 0 } : entry));
      try {
        const next = await manageVideoAssets(telegramInitData, "add", { kind, entityId, image: item.file, scope: "studio", profile: uploadProfile(kind, entityId) }, (progress) => {
          setUploadQueue((current) => current.map((entry) => {
            if (entry.id !== item.id) return entry;
            if (progress.stage === "securing") return { ...entry, status: "securing", loaded: entry.total };
            const ratio = progress.total > 0 ? Math.min(1, progress.loaded / progress.total) : 0;
            return { ...entry, status: "uploading", loaded: Math.round(entry.total * ratio) };
          }));
        });
        setRegistry(next);
        setUploadQueue((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: "completed", loaded: entry.total } : entry));
      } catch (reason) {
        failed += 1;
        const message = reason instanceof Error ? reason.message : "بارگذاری ناموفق بود.";
        setUploadQueue((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: "failed", error: message } : entry));
      }
    }
    if (failed) setError(`${toPersianDigits(String(failed))} تصویر بارگذاری نشد؛ جزئیات در همان کارت دیده می‌شود.`);
    setBusy("");
  }
  async function assetAction(action: "delete" | "set_default" | "update_profile", assetId: string, profile?: VideoAssetProfile) {
    setBusy(assetId); setError("");
    try {
      setRegistry(await manageVideoAssets(telegramInitData, action, { assetId, scope: "studio", profile }));
      if (action === "update_profile") setProfileEdits((current) => { const next = { ...current }; delete next[assetId]; return next; });
    } catch (reason) { setError(reason instanceof Error ? reason.message : "عملیات ناموفق بود."); } finally { setBusy(""); }
  }
  return <><section className="video-assets-manager">
    <h2>تصاویر مرجع استودیو</h2>
    <p className="hint">هر تصویر یک ماژول مستقل است. برای لوکیشن، محل استقرار مجری، عنصر جلوی بدن و زاویهٔ دوربین را هم ثبت کنید تا شخصیت واقعاً داخل صحنه قرار بگیرد، نه به شکل لایه‌ای جلوی آن؛ «پیش‌فرض» فقط مسیر بازگشت امن برای پروژه‌های قدیمی است.</p>
    {error && <p className="error">{error}</p>}
    {(["presenter", "location"] as const).map((kind) => <div className="asset-kind" key={kind}>
      <h3>{kind === "presenter" ? "مجری‌ها" : "لوکیشن‌ها"}</h3>
      <div className="asset-entity-grid">
        {Object.entries(registry?.entities?.[kind] ?? (kind === "presenter" ? presenterLabels : locationLabels)).map(([entityId, label]) => {
          const items = registry?.assets.filter((item) => item.kind === kind && item.entityId === entityId) ?? [];
          const draft = uploadProfile(kind, entityId);
          return <article className="asset-entity" key={entityId}>
            <b>{label}</b>
            <div className="asset-thumbs">{items.map((item) => <figure className={item.isDefault ? "default" : ""} key={item.assetId}>
              <div className="asset-thumb-image"><img loading="lazy" decoding="async" fetchPriority="low" alt={item.filename} src={item.url} /><button className="asset-preview-button" aria-label={`پیش‌نمایش بزرگ ${item.filename}`} onClick={() => setPreviewAsset(item)} title="پیش‌نمایش بزرگ" type="button">⛶</button></div>
              <figcaption>{item.profile?.label || item.filename}</figcaption>
              <div className="asset-profile-badges"><small>{profileOptions.roles[kind][item.profile?.role] ?? item.profile?.role}</small><small>{profileOptions.aspectRatios[item.profile?.aspectRatio] ?? item.profile?.aspectRatio}</small><small>{profileOptions.framings[item.profile?.framing] ?? item.profile?.framing}</small>{kind === "location" && <small>{profileOptions.placements[item.profile?.placement] ?? item.profile?.placement}</small>}{item.isDefault && <small>پیش‌فرض</small>}</div>
              <div><button disabled={!!busy} onClick={() => void assetAction("set_default", item.assetId)} type="button">انتخاب</button><button disabled={!!busy} onClick={() => void assetAction("delete", item.assetId)} type="button">حذف</button></div>
              <details className="asset-profile-editor"><summary>ویرایش کاربرد</summary>{(() => {
                const edit = profileEdits[item.assetId] ?? item.profile ?? defaultVideoAssetProfile(kind);
                const change = (changes: Partial<VideoAssetProfile>) => setProfileEdits((current) => ({ ...current, [item.assetId]: { ...edit, ...changes } }));
                return <div className="asset-profile-fields">
                  <label>نام نما<input maxLength={80} value={edit.label} onChange={(event) => change({ label: event.target.value })} placeholder="مثلاً عمودی تک‌مجری" /></label>
                  <label>کاربرد<select value={edit.role} onChange={(event) => change({ role: event.target.value })}>{Object.entries(profileOptions.roles[kind]).map(([id, value]) => <option value={id} key={id}>{value}</option>)}</select></label>
                  <label>نسبت<select value={edit.aspectRatio} onChange={(event) => change({ aspectRatio: event.target.value as VideoAssetProfile["aspectRatio"] })}>{Object.entries(profileOptions.aspectRatios).map(([id, value]) => <option value={id} key={id}>{value}</option>)}</select></label>
                  <label>کادر<select value={edit.framing} onChange={(event) => change({ framing: event.target.value as VideoAssetProfile["framing"] })}>{Object.entries(profileOptions.framings).map(([id, value]) => <option value={id} key={id}>{value}</option>)}</select></label>
                  {kind === "location" && <><label>ظرفیت<select value={edit.presenterCapacity} onChange={(event) => change({ presenterCapacity: Number(event.target.value) })}>{[1, 2, 3, 4].map((count) => <option value={count} key={count}>{toPersianDigits(String(count))} کاراکتر</option>)}</select></label><label>فضای متن<select value={edit.copySpace} onChange={(event) => change({ copySpace: event.target.value as VideoAssetProfile["copySpace"] })}>{Object.entries(profileOptions.copySpaces).map(([id, value]) => <option value={id} key={id}>{value}</option>)}</select></label><label>محل استقرار مجری<select value={edit.placement} onChange={(event) => change({ placement: event.target.value as VideoAssetProfile["placement"] })}>{Object.entries(profileOptions.placements).map(([id, value]) => <option value={id} key={id}>{value}</option>)}</select></label><label>سمت استقرار<select value={edit.subjectPosition} onChange={(event) => change({ subjectPosition: event.target.value as VideoAssetProfile["subjectPosition"] })}>{Object.entries(profileOptions.subjectPositions).map(([id, value]) => <option value={id} key={id}>{value}</option>)}</select></label><label>عنصر جلوی بدن<select value={edit.foregroundOccluder} onChange={(event) => change({ foregroundOccluder: event.target.value as VideoAssetProfile["foregroundOccluder"] })}>{Object.entries(profileOptions.foregroundOccluders).map(([id, value]) => <option value={id} key={id}>{value}</option>)}</select></label><label>زاویهٔ دوربین<select value={edit.cameraAngle} onChange={(event) => change({ cameraAngle: event.target.value as VideoAssetProfile["cameraAngle"] })}>{Object.entries(profileOptions.cameraAngles).map(([id, value]) => <option value={id} key={id}>{value}</option>)}</select></label></>}
                  <button className="secondary" disabled={!!busy} onClick={() => void assetAction("update_profile", item.assetId, edit)} type="button">ذخیرهٔ مشخصات</button>
                </div>;
              })()}</details>
            </figure>)}</div>
            <details className="asset-new-upload">
              <summary>{busy === `${kind}:${entityId}` ? "در حال افزودن تصاویر…" : "+ افزودن تصویر جدید"}</summary>
              <div className="asset-upload-profile">
              <b>مشخصات تصاویر جدید</b>
              <label>نام نما<input maxLength={80} value={draft.label} onChange={(event) => updateUploadProfile(kind, entityId, { label: event.target.value })} placeholder={kind === "location" ? "مثلاً عمودی تک‌مجری" : "مثلاً تمام‌قد رسمی"} /></label>
              <label>کاربرد<select value={draft.role} onChange={(event) => updateUploadProfile(kind, entityId, { role: event.target.value })}>{Object.entries(profileOptions.roles[kind]).map(([id, value]) => <option value={id} key={id}>{value}</option>)}</select></label>
              <label>نسبت<select value={draft.aspectRatio} onChange={(event) => updateUploadProfile(kind, entityId, { aspectRatio: event.target.value as VideoAssetProfile["aspectRatio"] })}>{Object.entries(profileOptions.aspectRatios).map(([id, value]) => <option value={id} key={id}>{value}</option>)}</select></label>
              <label>کادر<select value={draft.framing} onChange={(event) => updateUploadProfile(kind, entityId, { framing: event.target.value as VideoAssetProfile["framing"] })}>{Object.entries(profileOptions.framings).map(([id, value]) => <option value={id} key={id}>{value}</option>)}</select></label>
              {kind === "location" && <><label>ظرفیت<select value={draft.presenterCapacity} onChange={(event) => updateUploadProfile(kind, entityId, { presenterCapacity: Number(event.target.value) })}>{[1, 2, 3, 4].map((count) => <option value={count} key={count}>{toPersianDigits(String(count))} کاراکتر</option>)}</select></label><label>فضای متن<select value={draft.copySpace} onChange={(event) => updateUploadProfile(kind, entityId, { copySpace: event.target.value as VideoAssetProfile["copySpace"] })}>{Object.entries(profileOptions.copySpaces).map(([id, value]) => <option value={id} key={id}>{value}</option>)}</select></label><label>محل استقرار مجری<select value={draft.placement} onChange={(event) => updateUploadProfile(kind, entityId, { placement: event.target.value as VideoAssetProfile["placement"] })}>{Object.entries(profileOptions.placements).map(([id, value]) => <option value={id} key={id}>{value}</option>)}</select></label><label>سمت استقرار<select value={draft.subjectPosition} onChange={(event) => updateUploadProfile(kind, entityId, { subjectPosition: event.target.value as VideoAssetProfile["subjectPosition"] })}>{Object.entries(profileOptions.subjectPositions).map(([id, value]) => <option value={id} key={id}>{value}</option>)}</select></label><label>عنصر جلوی بدن<select value={draft.foregroundOccluder} onChange={(event) => updateUploadProfile(kind, entityId, { foregroundOccluder: event.target.value as VideoAssetProfile["foregroundOccluder"] })}>{Object.entries(profileOptions.foregroundOccluders).map(([id, value]) => <option value={id} key={id}>{value}</option>)}</select></label><label>زاویهٔ دوربین<select value={draft.cameraAngle} onChange={(event) => updateUploadProfile(kind, entityId, { cameraAngle: event.target.value as VideoAssetProfile["cameraAngle"] })}>{Object.entries(profileOptions.cameraAngles).map(([id, value]) => <option value={id} key={id}>{value}</option>)}</select></label></>}
              </div>
              <label className="asset-add">انتخاب یک یا چند تصویر<input accept="image/jpeg,image/png,image/webp" disabled={!!busy} multiple onChange={(event) => { const files = Array.from(event.target.files ?? []); event.currentTarget.value = ""; void upload(kind, entityId, files); }} type="file" /></label>
            </details>
            <div className="publish-media-list"><UploadQueueRows items={uploadQueue.filter((item) => item.kind === kind && item.entityId === entityId && (busy === `${kind}:${entityId}` || item.status === "failed"))} /></div>
          </article>;
        })}
      </div>
    </div>)}
  </section>{previewAsset && <div className="image-lightbox" role="dialog" aria-modal="true" aria-label="پیش‌نمایش تصویر مرجع استودیو" onClick={() => setPreviewAsset(undefined)}><figure onClick={(event) => event.stopPropagation()}><button onClick={() => setPreviewAsset(undefined)} type="button">×</button><img src={previewAsset.url} alt={previewAsset.filename} /><figcaption>{previewAsset.profile?.label || previewAsset.filename}</figcaption></figure></div>}</>;
}

function VoiceMakerWorkspace({ telegramInitData }: { telegramInitData?: string }) {
  const [settings, setSettings] = useState<VoiceModelSettings>();
  const [engineId, setEngineId] = useState("");
  const [voice, setVoice] = useState("");
  const [text, setText] = useState("");
  const [instructions, setInstructions] = useState("روان، طبیعی، با تلفظ فارسی روشن و مکث‌های طبیعی بخوان.");
  const [projects, setProjects] = useState<VoiceProject[]>([]);
  const [activeProject, setActiveProject] = useState<VoiceProject>();
  const [audioUrl, setAudioUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const engine = useMemo<VoiceEngine | undefined>(() => settings?.engines.find((item) => item.id === engineId), [settings, engineId]);
  const refresh = async () => {
    const [voiceSettings, voiceProjects] = await Promise.all([
      manageVoiceModels(telegramInitData, "get"),
      listVoiceProjects(telegramInitData),
    ]);
    if (voiceSettings) {
      setSettings(voiceSettings);
      setEngineId((current) => current || voiceSettings.defaultVoiceEngine);
      setVoice((current) => current || voiceSettings.defaultVoice);
    }
    if (voiceProjects) setProjects(voiceProjects.projects);
  };
  useEffect(() => { void refresh().catch(() => undefined); }, [telegramInitData]);
  useEffect(() => {
    if (!engine) return;
    if (!engine.voices.some((item) => item.id === voice)) setVoice(engine.voices[0]?.id ?? "");
  }, [engineId, engine?.voices.map((item) => item.id).join("|"), voice]);
  useEffect(() => {
    if (audioUrl) { URL.revokeObjectURL(audioUrl); setAudioUrl(""); }
    if (!activeProject) return;
    let cancelled = false;
    void getVoiceProjectOutput(telegramInitData, activeProject.voiceId)
      .then((blob) => { if (!cancelled && blob) setAudioUrl(URL.createObjectURL(blob)); })
      .catch((reason) => !cancelled && setError(reason instanceof Error ? reason.message : "دریافت صدا ناموفق بود."));
    return () => { cancelled = true; };
  }, [activeProject?.voiceId, telegramInitData]);
  const estimatedCost = engine ? text.length / 1000 * engine.estimatedCostUsdPer1kCharacters : 0;
  async function generate() {
    if (!engine || !voice || !text.trim()) { setError("موتور، شخصیت صوتی و متن خوانش را کامل کنید."); return; }
    if (!engine.available) { setError("کلید AvalAI برای این موتور در Gateway در دسترس نیست."); return; }
    setBusy(true); setError("");
    try {
      const result = await createVoiceProject(telegramInitData, { voiceId: crypto.randomUUID(), engineId, voice, text: text.trim(), instructions: instructions.trim() });
      if (!result) throw new Error("خروجی صدا از Gateway دریافت نشد.");
      setActiveProject(result); setProjects((current) => [result, ...current.filter((item) => item.voiceId !== result.voiceId)]);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "تولید صدا ناموفق بود."); } finally { setBusy(false); }
  }
  async function download(project: VoiceProject) {
    try {
      const blob = await getVoiceProjectOutput(telegramInitData, project.voiceId);
      if (!blob) return;
      const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `kalam-voice-${project.voiceId}.${project.outputFilename.split(".").pop() || "mp3"}`; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "دانلود صدا ناموفق بود."); }
  }
  return <section className="voice-maker-workspace">
    <div className="video-form-grid">
      <section className="video-form-card"><h3>موتور و شخصیت صوتی</h3>
        <label>موتور خوانش<select value={engineId} onChange={(event) => setEngineId(event.target.value)}>{settings?.engines.map((item) => <option key={item.id} value={item.id} disabled={!item.available}>{item.label}{item.available ? "" : " · نیازمند تنظیم AvalAI"}</option>)}</select></label>
        {engine && <><p className="hint">{engine.description} · مدل: <span dir="ltr">{engine.model}</span></p><label>شخصیت صوتی<select value={voice} onChange={(event) => setVoice(event.target.value)}>{engine.voices.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label></>}
      </section>
      <section className="video-form-card"><h3>کارگردانی صدا</h3><textarea rows={5} maxLength={800} value={instructions} onChange={(event) => setInstructions(event.target.value)} placeholder="مثلاً رسمی اما گرم، سرعت متوسط، مکث کوتاه بعد از تیتر" /><small className="hint">دستور لحن جدا از متن نگه داشته می‌شود تا متن دقیقاً همان‌گونه که نوشته‌اید خوانده شود.</small></section>
      <section className="video-form-card video-lines"><h3>متن خوانش</h3><textarea rows={10} maxLength={4096} value={text} onChange={(event) => setText(event.target.value)} placeholder="متنی را که باید به فارسی خوانده شود اینجا بنویسید…" /><small className="hint">{toPersianDigits(String(text.length))} از ۴٬۰۹۶ نویسه · صدای تولیدشده با هوش مصنوعی است.</small></section>
    </div>
    <section className="video-cost"><b>هزینهٔ تقریبی این خوانش: ${estimatedCost.toFixed(3)}</b><small>این برآورد از طول متن و نرخ ثبت‌شدهٔ موتور است؛ هزینهٔ نهایی AvalAI معیار صورتحساب است.</small><div className="video-primary-actions"><button className="primary" disabled={busy || !text.trim() || !engine?.available} onClick={() => void generate()} type="button">{busy ? "در حال تولید صدا…" : "تولید صدا"}</button></div></section>
    {error && <p className="error">{error}</p>}
    {activeProject && <section className="video-progress"><h3>خروجی آماده</h3><p><b>{activeProject.model}</b> · {activeProject.voice} · ${activeProject.estimatedCostUsd.toFixed(3)}</p>{audioUrl && <audio controls preload="metadata" src={audioUrl} />}<div className="choices"><button onClick={() => void download(activeProject)} type="button">دانلود {activeProject.outputFilename.toUpperCase()}</button></div></section>}
    {!!projects.length && <section className="video-project-list"><h3>صداهای اخیر</h3>{projects.map((project) => <button onClick={() => setActiveProject(project)} type="button" key={project.voiceId}><span>{new Date(project.createdAt * 1000).toLocaleString("fa-IR")}</span><b>{project.model} · {project.voice}</b><small>${project.estimatedCostUsd.toFixed(3)} · {Math.max(1, Math.round(project.bytes / 1024))} KB</small></button>)}</section>}
  </section>;
}

function ProjectReferenceGrid({ assets, selectedIds, canSelect, onToggle, onDelete }: { assets: VideoAsset[]; selectedIds: string[]; canSelect: (assetId: string) => boolean; onToggle: (assetId: string) => void; onDelete: (assetId: string) => void }) {
  const [preview, setPreview] = useState<VideoAsset>();
  if (!assets.length) return null;
  return <><div className="project-reference-grid" aria-label="فایل‌های مرجع انتخاب‌شده">
    {assets.map((asset) => {
      const selected = selectedIds.includes(asset.assetId);
      return <article className={selected ? "selected" : ""} key={asset.assetId}>
        <button aria-label={`${selected ? "حذف از انتخاب" : "انتخاب"} ${asset.filename}`} className="project-reference-image" disabled={!selected && !canSelect(asset.assetId)} onClick={() => onToggle(asset.assetId)} title={asset.filename} type="button"><img loading="lazy" decoding="async" fetchPriority="low" alt={asset.filename} src={asset.url} /></button>
        <button aria-label={`پیش‌نمایش ${asset.filename}`} className="project-reference-preview" onClick={() => setPreview(asset)} title="پیش‌نمایش" type="button">⛶</button>
        {asset.scope === "project" && <button aria-label={`حذف دائمی ${asset.filename}`} className="project-reference-remove" onClick={() => onDelete(asset.assetId)} title="حذف فایل" type="button">×</button>}
        <small title={asset.filename}>{selected ? "✓ انتخاب‌شده" : asset.filename}</small>
      </article>;
    })}
  </div>
  {preview && <div className="image-lightbox" role="dialog" aria-modal="true" aria-label="پیش‌نمایش تصویر مرجع" onClick={() => setPreview(undefined)}><figure onClick={(event) => event.stopPropagation()}><button onClick={() => setPreview(undefined)} type="button">×</button><img src={preview.url} alt={preview.filename} /><figcaption>{preview.filename}</figcaption></figure></div>}
  </>;
}

function VideoMakerWorkspace({ brand, telegramInitData, openProjectId, onProjectOpened }: { brand: Brand; telegramInitData?: string; openProjectId?: string; onProjectOpened?: () => void }) {
  const [workspaceTab, setWorkspaceTab] = useState<"video" | "voice">("video");
  const [draftProjectId, setDraftProjectId] = useState<string>(() => crypto.randomUUID());
  const [continuityKey, setContinuityKey] = useState<string>(() => crypto.randomUUID());
  const [generationModel, setGenerationModel] = useState<VideoProjectInput["generationModel"]>("veo_3_1");
  const [qualityMode, setQualityMode] = useState<"fast" | "precise">("fast");
  const [directionMode, setDirectionMode] = useState<VideoProjectInput["directionMode"]>("news_bulletin");
  const [videoAdditionalInstructions, setVideoAdditionalInstructions] = useState("");
  const [videoCharacterInstructions, setVideoCharacterInstructions] = useState<Record<string, string>>({});
  const [canvas, setCanvas] = useState<"portrait" | "landscape">("portrait");
  const [durationSeconds, setDurationSeconds] = useState<4 | 6 | 8>(8);
  const [videoResolution, setVideoResolution] = useState<"720p" | "1080p">("1080p");
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const [presenterIds, setPresenterIds] = useState<string[]>(["kamran"]);
  const [locationId, setLocationId] = useState("newsroom");
  const [locationMode, setLocationMode] = useState<VideoProjectInput["location"]["mode"]>("catalog");
  const [locationAssetIds, setLocationAssetIds] = useState<string[]>([]);
  const [locationPrompt, setLocationPrompt] = useState("");
  const [locationReferenceInstructions, setLocationReferenceInstructions] = useState("");
  const [presenterReferenceSelection, setPresenterReferenceSelection] = useState<Record<string, ReferenceChoice>>({});
  const [locationReferenceSelection, setLocationReferenceSelection] = useState<ReferenceChoice>(automaticReferenceChoice());
  const [assetRegistry, setAssetRegistry] = useState<VideoAssetRegistry>();
  const [referenceUploadQueue, setReferenceUploadQueue] = useState<VideoUploadItem[]>([]);
  const [monitorEnabled, setMonitorEnabled] = useState(true);
  const [monitorMode, setMonitorMode] = useState<"text" | "images" | "blank">("text");
  const [monitorText, setMonitorText] = useState("");
  const [monitorImageMode, setMonitorImageMode] = useState<"generate" | "reference" | "preserve">("generate");
  const [monitorImageCount, setMonitorImageCount] = useState(1);
  const [monitorBrief, setMonitorBrief] = useState("");
  const [monitorAssetIds, setMonitorAssetIds] = useState<string[]>([]);
  const [musicMood, setMusicMood] = useState<VideoProjectInput["music"]["mood"]>("neutral");
  const [lines, setLines] = useState<VideoLine[]>([{ id: crypto.randomUUID(), presenterId: "kamran", text: "", shot: "medium" }]);
  const [timeline, setTimeline] = useState<VideoTimelineBeat[]>([{ id: crypto.randomUUID(), startSecond: 0, endSecond: 8, description: "", motionStyle: "headline", motionPosition: "bottom", motionAnimation: "fade" }]);
  const [projects, setProjects] = useState<VideoProject[]>([]);
  const [activeProject, setActiveProject] = useState<VideoProject>();
  const [activeVideoUrl, setActiveVideoUrl] = useState("");
  const [continuationParent, setContinuationParent] = useState("");
  const [busy, setBusy] = useState(false);
  const [promptBusy, setPromptBusy] = useState(false);
  const [videoPrompt, setVideoPrompt] = useState<VideoPromptPreview>();
  const [error, setError] = useState("");
  const refresh = async () => {
    const result = await listVideoProjects(telegramInitData);
    if (result) setProjects(result.projects);
    if (activeProject?.projectId) {
      const current = await getVideoProject(telegramInitData, activeProject.projectId);
      if (current) setActiveProject(current);
    }
  };
  useEffect(() => { void refresh(); void manageVideoAssets(telegramInitData, "list", { scope: "project" }).then(setAssetRegistry).catch(() => undefined); }, [telegramInitData]);
  useEffect(() => {
    if (!openProjectId) return;
    void getVideoProject(telegramInitData, openProjectId)
      .then((project) => {
        if (!project) throw new Error("پروژهٔ ویدیو پیدا نشد.");
        restoreProject(project);
        onProjectOpened?.();
      })
      .catch((reason) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "بازکردن پروژهٔ ویدیو ناموفق بود.",
        ),
      );
  }, [openProjectId, telegramInitData]);
  useEffect(() => {
    if (!activeProject || ["completed", "failed", "cancelled"].includes(activeProject.state)) return;
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(timer);
  }, [activeProject?.projectId, activeProject?.state]);
  useEffect(() => {
    if (activeVideoUrl) {
      URL.revokeObjectURL(activeVideoUrl);
      setActiveVideoUrl("");
    }
    if (!activeProject || activeProject.state !== "completed") return;
    let cancelled = false;
    void getVideoProjectOutput(telegramInitData, activeProject.projectId)
      .then((blob) => {
        if (!cancelled && blob) setActiveVideoUrl(URL.createObjectURL(blob));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [activeProject?.projectId, activeProject?.state]);
  useEffect(() => { setVideoPrompt(undefined); }, [brand, canvas, qualityMode, generationModel, directionMode, durationSeconds, videoResolution, speechEnabled, videoAdditionalInstructions, JSON.stringify(videoCharacterInstructions), presenterIds.join("|"), locationId, locationMode, locationAssetIds.join("|"), locationPrompt, locationReferenceInstructions, JSON.stringify(presenterReferenceSelection), JSON.stringify(locationReferenceSelection), monitorEnabled, monitorMode, monitorText, monitorImageMode, monitorImageCount, monitorBrief, monitorAssetIds.join("|"), musicMood, continuationParent, JSON.stringify(lines.map(({ presenterId, text, shot }) => ({ presenterId, text, shot }))), JSON.stringify(timeline)]);
  function togglePresenter(id: string) {
    setPresenterIds((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      if (!next.length) return current;
      setLines((rows) => rows.map((row) => next.includes(row.presenterId) ? row : { ...row, presenterId: next[0] }));
      return next;
    });
  }
  function updateLine(id: string, changes: Partial<VideoLine>) { setLines((current) => current.map((line) => line.id === id ? { ...line, ...changes } : line)); }
  const seconds = lines.length * durationSeconds;
  const estimated = seconds * (qualityMode === "fast" ? 0.15 : 0.40);
  const videoReferenceLimit = videoReferenceLimits[generationModel];
  const videoPresenterReferenceCount = presenterIds.reduce((count, id) => {
    const choice = presenterReferenceSelection[id] ?? automaticReferenceChoice();
    return count + (choice.mode === "manual" ? new Set(choice.assetIds).size : 1);
  }, 0);
  const videoLocationReferenceCount = locationMode === "catalog"
    ? (locationReferenceSelection.mode === "manual" ? new Set(locationReferenceSelection.assetIds).size : 1)
    : locationMode === "generated_prompt"
      ? 0
      : new Set(locationAssetIds).size;
  const videoMonitorReferenceCount = monitorEnabled && monitorMode === "images" && monitorImageMode !== "generate" ? new Set(monitorAssetIds).size : 0;
  const videoReferenceCount = videoPresenterReferenceCount + videoLocationReferenceCount + videoMonitorReferenceCount;
  const referenceChoiceLimit = (choice: ReferenceChoice) => {
    const contribution = choice.mode === "manual" ? new Set(choice.assetIds).size : 1;
    return Math.max(0, videoReferenceLimit - videoReferenceCount + contribution);
  };
  function videoInput(): VideoProjectInput {
    return { projectId: draftProjectId, brand, canvas, qualityMode, generationModel, directionMode, durationSeconds, resolution: videoResolution, speechEnabled, additionalInstructions: videoAdditionalInstructions.trim(), characterInstructions: Object.fromEntries(presenterIds.map((id) => [id, (videoCharacterInstructions[id] ?? "").trim()]).filter(([, value]) => value)), presenterIds, referenceSelection: { presenters: Object.fromEntries(presenterIds.map((id) => [id, presenterReferenceSelection[id] ?? automaticReferenceChoice()])), location: locationReferenceSelection }, location: { mode: locationMode, id: locationId, assetIds: ["exact_reference", "faithful_reference", "new_from_reference", "inspiration"].includes(locationMode) ? locationAssetIds : undefined, prompt: locationMode === "generated_prompt" ? locationPrompt.trim() : undefined, referenceInstructions: locationMode === "faithful_reference" ? locationReferenceInstructions.trim() : undefined }, monitorText: monitorEnabled && monitorMode === "text" ? monitorText.trim() : "", monitor: { enabled: monitorEnabled, mode: monitorEnabled ? monitorMode : "disabled", text: monitorEnabled && monitorMode === "text" ? monitorText.trim() : "", imageMode: monitorImageMode, imageCount: monitorImageCount, brief: monitorBrief.trim(), assetIds: monitorEnabled && monitorMode === "images" && monitorImageMode !== "generate" ? monitorAssetIds : undefined }, lines: lines.map(({ presenterId, text, shot }) => ({ presenterId, text: text.trim(), shot })), timeline: timeline.map(({ startSecond, endSecond, description, motionText, motionStyle, motionPosition, motionAnimation }) => ({ startSecond, endSecond, description: description.trim(), motionText: motionText?.trim() || "", motionStyle: motionStyle || "headline", motionPosition: motionPosition || "bottom", motionAnimation: motionAnimation || "fade" })), music: { mood: musicMood, continuityKey }, continuation: continuationParent ? { parentProjectId: continuationParent } : undefined };
  }
  function validateVideoInput() {
    if (speechEnabled && !lines.every((line) => line.text.trim())) { setError("متن همهٔ اجراها را کامل کنید یا «صحبت کاراکترها» را خاموش کنید."); return false; }
    if (locationMode === "generated_prompt" && locationPrompt.trim().length < 4) { setError("برای ساخت زمینه، توضیح لوکیشن را کامل کنید."); return false; }
    if (["exact_reference", "faithful_reference", "new_from_reference", "inspiration"].includes(locationMode) && !locationAssetIds.length) { setError("برای منطق انتخاب‌شدهٔ لوکیشن، دست‌کم یک عکس یا فیلم مرجع انتخاب کنید."); return false; }
    if (monitorEnabled && monitorMode === "images" && monitorImageMode !== "generate" && !monitorAssetIds.length) { setError("برای تصویر مانیتور در حالت مرجع یا وفادار، دست‌کم یک فایل انتخاب کنید."); return false; }
    const manualChoices = [...presenterIds.map((id) => presenterReferenceSelection[id]), locationMode === "catalog" ? locationReferenceSelection : undefined].filter((choice): choice is ReferenceChoice => Boolean(choice));
    if (manualChoices.some((choice) => choice.mode === "manual" && !choice.assetIds.length)) { setError("در حالت انتخاب دستی، دست‌کم یک تصویر مرجع را تیک بزنید."); return false; }
    if (videoReferenceCount > videoReferenceLimit) { setError(`مدل انتخاب‌شده حداکثر ${toPersianDigits(String(videoReferenceLimit))} تصویر مرجع در هر خروجی می‌پذیرد؛ مرجع‌های خودکار/دستی و فایل‌های آپلودی اکنون ${toPersianDigits(String(videoReferenceCount))} تصویر هستند.`); return false; }
    if (generationModel === "veo_3_1" && durationSeconds !== 8 && videoReferenceCount > 0) { setError("Veo 3.1 با هر تصویر مرجع فقط خروجی ۸ثانیه‌ای می‌پذیرد؛ برای ۴ یا ۶ ثانیه باید همهٔ مرجع‌های تصویری را بردارید."); return false; }
    if (generationModel === "veo_3_1" && videoResolution === "1080p" && durationSeconds !== 8) { setError("Veo 3.1 کیفیت ۱۰۸۰p را فقط برای خروجی ۸ثانیه‌ای می‌پذیرد؛ برای ۴ یا ۶ ثانیه کیفیت ۷۲۰p را انتخاب کنید."); return false; }
    if (timeline.some((beat) => !Number.isInteger(beat.startSecond) || !Number.isInteger(beat.endSecond) || beat.startSecond < 0 || beat.endSecond <= beat.startSecond || beat.endSecond > durationSeconds || beat.description.length > 600 || (beat.motionText?.length ?? 0) > 120)) { setError("بازه‌های زمان‌بندی باید معتبر باشند؛ توضیح هر بازه حداکثر ۶۰۰ و متن موشن‌گرافی حداکثر ۱۲۰ نویسه باشد."); return false; }
    return true;
  }
  async function addProjectReferences(kind: "location" | "monitor", files: File[]) {
    const selectedIds = kind === "location" ? locationAssetIds : monitorAssetIds;
    const currentContribution = kind === "location" ? videoLocationReferenceCount : videoMonitorReferenceCount;
    const available = Math.max(0, videoReferenceLimit - videoReferenceCount + currentContribution - selectedIds.length);
    const incoming = files.slice(0, available);
    if (!incoming.length) { setError(`ظرفیت ${toPersianDigits(String(videoReferenceLimit))} تصویر مرجع این مدل تکمیل است؛ ابتدا یک مرجع دیگر را حذف یا روی حالت خودکار تنظیم کنید.`); return; }
    const queue: VideoUploadItem[] = incoming.map((file) => ({ id: crypto.randomUUID(), file, kind, entityId: locationId, loaded: 0, total: file.size, status: "preparing" }));
    setReferenceUploadQueue((current) => [...current.filter((item) => item.status === "failed"), ...queue]);
    setError("");
    let knownIds = new Set(assetRegistry?.assets.map((item) => item.assetId) ?? []);
    let failures = 0;
    for (const item of queue) {
      setReferenceUploadQueue((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: "uploading" } : entry));
      try {
        const next = await manageVideoAssets(telegramInitData, "add", { kind, entityId: locationId, image: item.file, scope: "project" }, (progress) => {
          setReferenceUploadQueue((current) => current.map((entry) => {
            if (entry.id !== item.id) return entry;
            if (progress.stage === "securing") return { ...entry, status: "securing", loaded: entry.total };
            const ratio = progress.total > 0 ? Math.min(1, progress.loaded / progress.total) : 0;
            return { ...entry, status: "uploading", loaded: Math.round(entry.total * ratio) };
          }));
        });
        setAssetRegistry(next);
        const added = next?.assets.filter((asset) => !knownIds.has(asset.assetId)).sort((a, b) => b.createdAt - a.createdAt)[0];
        if (added) {
          knownIds.add(added.assetId);
          if (kind === "location") setLocationAssetIds((current) => [...current, added.assetId]);
          else setMonitorAssetIds((current) => [...current, added.assetId]);
        }
        setReferenceUploadQueue((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: "completed", loaded: entry.total } : entry));
      } catch (reason) {
        failures += 1;
        const message = reason instanceof Error ? reason.message : "افزودن مرجع ناموفق بود.";
        setReferenceUploadQueue((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: "failed", error: message } : entry));
      }
    }
    if (failures) setError(`${toPersianDigits(String(failures))} تصویر مرجع بارگذاری نشد.`);
  }
  async function deleteProjectReference(assetId: string) {
    try {
      const next = await manageVideoAssets(telegramInitData, "delete", { assetId, scope: "project" });
      setAssetRegistry(next);
      setLocationAssetIds((current) => current.filter((item) => item !== assetId));
      setMonitorAssetIds((current) => current.filter((item) => item !== assetId));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "حذف تصویر مرجع ناموفق بود."); }
  }
  async function buildPrompt() {
    if (!validateVideoInput()) return;
    setPromptBusy(true); setError("");
    try {
      const result = await createVideoPrompt(telegramInitData, videoInput());
      if (!result) throw new Error("پرامپت نهایی از سرور دریافت نشد.");
      setVideoPrompt(result);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "ساخت پرامپت ویدیو ناموفق بود."); } finally { setPromptBusy(false); }
  }
  function saveBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function downloadPromptReference(referenceId: string, filename: string) {
    if (!videoPrompt) return;
    try { const blob = await getVideoPromptAsset(telegramInitData, videoPrompt.projectId, referenceId); if (blob) saveBlob(blob, filename); } catch (reason) { setError(reason instanceof Error ? reason.message : "دریافت تصویر مرجع ناموفق بود."); }
  }
  async function downloadPromptBundle() {
    if (!videoPrompt) return;
    try { const blob = await getVideoPromptBundle(telegramInitData, videoPrompt.projectId); if (blob) saveBlob(blob, `kalam-video-prompt-${videoPrompt.projectId}.zip`); } catch (reason) { setError(reason instanceof Error ? reason.message : "دریافت بستهٔ پرامپت ناموفق بود."); }
  }
  async function submitVideo() {
    if (!validateVideoInput()) return;
    if (generationModel !== "veo_3_1") { setError("ساخت مستقیم Gemini Omni Flash هنوز در AvalAI پشتیبانی نمی‌شود؛ فعلاً از دکمهٔ ساخت پرامپت استفاده کنید."); return; }
    if (!window.confirm(`این پروژه حدود ${estimated.toFixed(2)} دلار هزینهٔ تخمینی دارد. ساخت آغاز شود؟`)) return;
    setBusy(true); setError("");
    const input = videoInput();
    try { const result = await createVideoProject(telegramInitData, input); if (result) { setActiveProject(result); setProjects((current) => [result, ...current.filter((item) => item.projectId !== result.projectId)]); setDraftProjectId(crypto.randomUUID()); } } catch (reason) { setError(reason instanceof Error ? reason.message : "ثبت پروژه ناموفق بود."); } finally { setBusy(false); }
  }
  async function download(project: VideoProject) {
    try { const blob = await getVideoProjectOutput(telegramInitData, project.projectId); if (!blob) return; const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `kalam-video-${project.projectId}.mp4`; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); } catch (reason) { setError(reason instanceof Error ? reason.message : "دریافت ویدیو ناموفق بود."); }
  }
  function continueProject(project: VideoProject) {
    const monitor = project.project.monitor ?? { enabled: true, mode: project.project.monitorText ? "text" as const : "blank" as const, text: project.project.monitorText, imageMode: "generate" as const, imageCount: 1, brief: "" };
    setDraftProjectId(crypto.randomUUID()); setContinuityKey(project.project.music.continuityKey); setVideoPrompt(undefined); setQualityMode(project.project.qualityMode); setGenerationModel(project.project.generationModel ?? "veo_3_1"); setDirectionMode(project.project.directionMode ?? "news_bulletin"); setDurationSeconds(project.project.durationSeconds ?? 8); setVideoResolution(project.project.resolution ?? "1080p"); setSpeechEnabled(project.project.speechEnabled !== false); setCanvas(project.project.canvas); setPresenterIds(project.project.presenterIds); setPresenterReferenceSelection(project.project.referenceSelection?.presenters ?? {}); setLocationReferenceSelection(project.project.referenceSelection?.location ?? automaticReferenceChoice()); setLocationId(project.project.location.id); setLocationMode(project.project.location.mode); setLocationAssetIds(project.project.location.assetIds ?? []); setLocationPrompt(project.project.location.prompt ?? ""); setLocationReferenceInstructions(project.project.location.referenceInstructions ?? ""); setMonitorEnabled(monitor.enabled !== false && monitor.mode !== "disabled"); setMonitorMode(monitor.mode === "images" || monitor.mode === "blank" ? monitor.mode : "text"); setMonitorText(monitor.text); setMonitorImageMode(monitor.imageMode); setMonitorImageCount(monitor.imageCount); setMonitorBrief(monitor.brief); setMonitorAssetIds(monitor.assetIds ?? []); setMusicMood(project.project.music.mood); setContinuationParent(project.projectId); setLines([{ id: crypto.randomUUID(), presenterId: project.project.presenterIds[0], text: "", shot: "medium" }]); setTimeline([{ id: crypto.randomUUID(), startSecond: 0, endSecond: project.project.durationSeconds ?? 8, description: "" }]); window.scrollTo({ top: 0, behavior: "smooth" });
    setVideoAdditionalInstructions(project.project.additionalInstructions ?? "");
    setVideoCharacterInstructions(project.project.characterInstructions ?? {});
  }
  function restoreProject(project: VideoProject) {
    const monitor = project.project.monitor ?? {
      enabled: true,
      mode: project.project.monitorText ? "text" as const : "blank" as const,
      text: project.project.monitorText,
      imageMode: "generate" as const,
      imageCount: 1,
      brief: "",
    };
    setDraftProjectId(project.projectId);
    setContinuityKey(project.project.music.continuityKey);
    setVideoPrompt(undefined);
    setQualityMode(project.project.qualityMode);
    setGenerationModel(project.project.generationModel ?? "veo_3_1");
    setDirectionMode(project.project.directionMode ?? "news_bulletin");
    setDurationSeconds(project.project.durationSeconds ?? 8);
    setVideoResolution(project.project.resolution ?? "1080p");
    setSpeechEnabled(project.project.speechEnabled !== false);
    setVideoAdditionalInstructions(project.project.additionalInstructions ?? "");
    setVideoCharacterInstructions(project.project.characterInstructions ?? {});
    setCanvas(project.project.canvas);
    setPresenterIds(project.project.presenterIds);
    setPresenterReferenceSelection(
      project.project.referenceSelection?.presenters ?? {},
    );
    setLocationReferenceSelection(
      project.project.referenceSelection?.location ?? automaticReferenceChoice(),
    );
    setLocationId(project.project.location.id);
    setLocationMode(project.project.location.mode);
    setLocationAssetIds(project.project.location.assetIds ?? []);
    setLocationPrompt(project.project.location.prompt ?? "");
    setLocationReferenceInstructions(
      project.project.location.referenceInstructions ?? "",
    );
    setMonitorEnabled(monitor.enabled !== false && monitor.mode !== "disabled");
    setMonitorMode(monitor.mode === "images" || monitor.mode === "blank" ? monitor.mode : "text");
    setMonitorText(monitor.text);
    setMonitorImageMode(monitor.imageMode);
    setMonitorImageCount(monitor.imageCount);
    setMonitorBrief(monitor.brief);
    setMonitorAssetIds(monitor.assetIds ?? []);
    setMusicMood(project.project.music.mood);
    setContinuationParent(project.project.continuation?.parentProjectId ?? "");
    setLines(
      project.project.lines.map((line) => ({
        id: crypto.randomUUID(),
        ...line,
      })),
    );
    setTimeline((project.project.timeline?.length ? project.project.timeline : [{ startSecond: 0, endSecond: project.project.durationSeconds ?? 8, description: "" }]).map((beat) => ({ id: crypto.randomUUID(), ...beat })));
    setActiveProject(project);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  return <section className="video-maker-workspace">
    <header className="video-maker-hero"><div><span>VEO 3.1 · GEMINI OMNI FLASH · TTS</span><h2>ویدیوساز استودیو</h2><p>اجرای رسمی و موثق با مجری‌های ثابت، لوکیشن کنترل‌شده و زنجیرهٔ پیوستهٔ سکانس‌ها.</p></div><div className="choices"><button className={workspaceTab === "video" ? "selected" : ""} onClick={() => setWorkspaceTab("video")} type="button">تولید ویدیو</button><button className={workspaceTab === "voice" ? "selected" : ""} onClick={() => setWorkspaceTab("voice")} type="button">تولید صدا</button></div></header>
    {workspaceTab === "voice" ? <VoiceMakerWorkspace telegramInitData={telegramInitData} /> : <>
    <div className="video-form-grid">
      <section className="video-model-selector video-model-selector-first"><div><h3>۱. مدل خروجی</h3><p>مدل را پیش از تنظیم مرجع‌ها انتخاب کنید؛ ظرفیت تصاویر و امکان ساخت مستقیم از همین انتخاب پیروی می‌کند.</p></div><div className="choices"><button className={generationModel === "veo_3_1" ? "selected" : ""} onClick={() => setGenerationModel("veo_3_1")} type="button"><b>Veo 3.1</b><small>حداکثر ۳ تصویر مرجع · ساخت پرامپت و ویدیو</small></button><button className={generationModel === "gemini_omni_flash" ? "selected" : ""} onClick={() => setGenerationModel("gemini_omni_flash")} type="button"><b>Gemini Omni Flash</b><small>سقف محصول ۶ تصویر مرجع · فعلاً فقط ساخت پرامپت</small></button></div><p className={`reference-budget ${videoReferenceCount > videoReferenceLimit ? "over-limit" : ""}`}>بودجهٔ فعلی مرجع‌ها: {toPersianDigits(String(videoReferenceCount))} از {toPersianDigits(String(videoReferenceLimit))} تصویر؛ شامل انتخاب خودکار، انتخاب دستی، لوکیشن آپلودی و تصاویر مانیتور.</p></section>
      <section className="video-form-card"><h3>کیفیت و قاب</h3><div className="choices"><button className={qualityMode === "fast" ? "selected" : ""} disabled={generationModel !== "veo_3_1"} onClick={() => setQualityMode("fast")} type="button"><b>ساخت سریع</b><small>Veo Fast</small></button><button className={qualityMode === "precise" ? "selected" : ""} disabled={generationModel !== "veo_3_1"} onClick={() => setQualityMode("precise")} type="button"><b>ساخت دقیق</b><small>Veo</small></button></div>{generationModel !== "veo_3_1" && <p className="hint">کیفیت تولید پس از پشتیبانی AvalAI از Gemini Omni فعال می‌شود.</p>}<div className="choices"><button className={canvas === "portrait" ? "selected" : ""} onClick={() => setCanvas("portrait")} type="button">عمودی ۹:۱۶</button><button className={canvas === "landscape" ? "selected" : ""} onClick={() => setCanvas("landscape")} type="button">افقی ۱۶:۹</button></div><label>مدت هر سکانس<select value={durationSeconds} onChange={(event) => { const value = Number(event.target.value) as 4 | 6 | 8; setDurationSeconds(value); setTimeline((current) => current.map((beat, index) => index === 0 ? { ...beat, startSecond: 0, endSecond: value } : beat)); }}><option value={4}>۴ ثانیه</option><option value={6}>۶ ثانیه</option><option value={8}>۸ ثانیه</option></select></label><label>کیفیت واقعی خروجی<select value={videoResolution} onChange={(event) => setVideoResolution(event.target.value as "720p" | "1080p")}><option value="720p">720p · سبک‌تر و سریع‌تر</option><option value="1080p">1080p · کیفیت کامل</option></select></label>{generationModel === "veo_3_1" && videoReferenceCount > 0 && <p className="hint">به‌دلیل وجود تصویر مرجع، Veo فقط با مدت ۸ ثانیه قابل اجراست.</p>}</section>
      <section className="video-form-card"><h3>نوع کارگردانی خروجی</h3><div className="choices video-direction-choices"><button className={directionMode === "news_bulletin" ? "selected" : ""} onClick={() => setDirectionMode("news_bulletin")} type="button"><b>خبر رسمی</b><small>معتبر، کنترل‌شده و متین</small></button><button className={directionMode === "explainer" ? "selected" : ""} onClick={() => setDirectionMode("explainer")} type="button"><b>توضیحی</b><small>روایت روشن و میزانسن آموزشی</small></button><button className={directionMode === "social_reel" ? "selected" : ""} onClick={() => setDirectionMode("social_reel")} type="button"><b>ریلز پویا</b><small>قلاب سریع و تغییر قاب هدفمند</small></button><button className={directionMode === "cinematic_report" ? "selected" : ""} onClick={() => setDirectionMode("cinematic_report")} type="button"><b>گزارش سینمایی</b><small>محیط‌محور و چندزاویه‌ای</small></button></div></section>
      <section className="video-form-card"><h3>مجری‌ها</h3><div className="choices">{Object.entries(presenterLabels).map(([id, label]) => <button className={presenterIds.includes(id) ? "selected" : ""} onClick={() => togglePresenter(id)} type="button" key={id}>{label}</button>)}</div>{presenterIds.map((id) => { const choice = presenterReferenceSelection[id] ?? automaticReferenceChoice(); return <article className="video-presenter-contract" key={id}><label>توضیحات اختصاصی {presenterLabels[id]}<textarea maxLength={600} rows={3} value={videoCharacterInstructions[id] ?? ""} onChange={(event) => setVideoCharacterInstructions((current) => ({ ...current, [id]: event.target.value }))} placeholder="مثلاً تغییر لباس، حالت چهره، ژست، جهت نگاه یا حرکت؛ هویت شخصیت همیشه ثابت می‌ماند" /></label><ReferenceAssetPicker assets={assetRegistry?.assets.filter((asset) => asset.kind === "presenter" && asset.entityId === id && asset.scope !== "project") ?? []} choice={choice} limit={referenceChoiceLimit(choice)} onChange={(next) => setPresenterReferenceSelection((current) => ({ ...current, [id]: next }))} title={`تصاویر مرجع ${presenterLabels[id]}`} /></article>; })}</section>
      <section className="video-form-card">
        <h3>لوکیشن</h3>
        <select value={locationId} onChange={(event) => { setLocationId(event.target.value); setLocationAssetIds([]); setMonitorAssetIds([]); setLocationReferenceSelection(automaticReferenceChoice()); }}>
          {Object.entries(locationLabels).map(([id, label]) => <option value={id} key={id}>{label}</option>)}
        </select>
        {locationMode === "catalog" && <ReferenceAssetPicker assets={assetRegistry?.assets.filter((asset) => asset.kind === "location" && asset.entityId === locationId && asset.scope !== "project") ?? []} choice={locationReferenceSelection} limit={referenceChoiceLimit(locationReferenceSelection)} onChange={setLocationReferenceSelection} title="مشاهده و انتخاب تصاویر این لوکیشن" />}
        <label>منطق لوکیشن<select value={locationMode} onChange={(event) => setLocationMode(event.target.value as typeof locationMode)}><option value="catalog">لوکیشن ذخیره‌شده</option><option value="generated_prompt">ساخت تصویر زمینه با پرامپت</option><option value="exact_reference">استفاده مستقیم از عکس/فیلم مرجع</option><option value="faithful_reference">استفاده وفادار از عکس/فیلم مرجع</option></select></label>
        {locationMode === "generated_prompt" && <label>پرامپت اختصاصی ساخت لوکیشن<textarea maxLength={1200} rows={4} value={locationPrompt} onChange={(event) => setLocationPrompt(event.target.value)} placeholder="فضا، معماری، زمان روز، نور، مسیر حرکت دوربین و ناحیه‌های موردنیاز مجری را توصیف کنید" /></label>}
        {locationMode === "faithful_reference" && <label>توضیحات استفادهٔ وفادار از مرجع<textarea maxLength={1000} rows={4} value={locationReferenceInstructions} onChange={(event) => setLocationReferenceInstructions(event.target.value)} placeholder="مثلاً هندسه و نور حفظ شود، فقط قاب برای حرکت مجری بازتر شود؛ این متن فقط روی لوکیشن اثر دارد" /></label>}
        {["exact_reference", "faithful_reference", "new_from_reference", "inspiration"].includes(locationMode) && <div className="video-location-assets">
          <span>عکس/فیلم مرجع · مطابق سقف مدل</span>
          <ProjectReferenceGrid assets={assetRegistry?.assets.filter((item) => item.scope === "project" && item.kind === "location" && item.entityId === locationId) ?? []} selectedIds={locationAssetIds} canSelect={(assetId) => locationAssetIds.includes(assetId) || videoReferenceCount < videoReferenceLimit} onToggle={(assetId) => setLocationAssetIds((current) => current.includes(assetId) ? current.filter((id) => id !== assetId) : [...current, assetId])} onDelete={(assetId) => void deleteProjectReference(assetId)} />
          <label className="media-upload">+ افزودن عکس یا فیلم مرجع<input accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" multiple onChange={(event) => { const files = Array.from(event.target.files ?? []); event.currentTarget.value = ""; void addProjectReferences("location", files); }} type="file" /></label>
          <small className="hint">برای سازگاری با سقف ورودی مدل، از هر فیلم یک فریم مرجع امن و قابل‌پیش‌نمایش استخراج می‌شود.</small>
          <div className="publish-media-list"><UploadQueueRows items={referenceUploadQueue.filter((item) => item.entityId === locationId && item.status !== "completed")} /></div>
        </div>}
        <fieldset className="video-monitor-controls">
          <legend>محتوای مانیتور(ها)</legend>
          <ModernSwitch checked={monitorEnabled} onChange={(enabled) => { setMonitorEnabled(enabled); if (!enabled) setMonitorAssetIds([]); }} label="مانیتور فعال باشد" />
          {monitorEnabled && <>
          <div className="choices"><button className={monitorMode === "text" ? "selected" : ""} onClick={() => setMonitorMode("text")} type="button">نوشتن تیتر</button><button className={monitorMode === "images" ? "selected" : ""} onClick={() => setMonitorMode("images")} type="button">عکس داخل مانیتور</button><button className={monitorMode === "blank" ? "selected" : ""} onClick={() => setMonitorMode("blank")} type="button">مانیتور خالی</button></div>
          {monitorMode === "text" && <label>متن دقیق مانیتور<input value={monitorText} onChange={(event) => setMonitorText(event.target.value)} maxLength={240} placeholder="متن کوتاه و دقیق فارسی" /></label>}
          {monitorMode === "images" && <>
            <div className="choices"><button className={monitorImageMode === "generate" ? "selected" : ""} onClick={() => setMonitorImageMode("generate")} type="button"><b>ساخت عکس جدید</b><small>از محتوای خبر</small></button><button className={monitorImageMode === "reference" ? "selected" : ""} onClick={() => setMonitorImageMode("reference")} type="button"><b>استفاده از مرجع</b><small>بازترکیب کنترل‌شده</small></button><button className={monitorImageMode === "preserve" ? "selected" : ""} onClick={() => setMonitorImageMode("preserve")} type="button"><b>استفادهٔ وفادار</b><small>حفظ دقیق تصویر</small></button></div>
            <label>موضوع خبر / توضیح تصویر<textarea value={monitorBrief} onChange={(event) => setMonitorBrief(event.target.value)} maxLength={800} placeholder="موضوع و جزئیات ضروری تصویرهای روی مانیتور" /></label>
            <label>تعداد تصویر یا نمایشگر<select value={monitorImageCount} onChange={(event) => setMonitorImageCount(Number(event.target.value))}>{[1, 2, 3, 4].map((count) => <option key={count} value={count}>{toPersianDigits(String(count))}</option>)}</select></label>
            {monitorImageMode !== "generate" && <div className="video-location-assets">
              <span>تصاویر اختصاصی مانیتور · {generationModel === "veo_3_1" ? "یک فایل برای حفظ سهم مرجع کاراکتر و تداوم Veo" : "حداکثر ۳ فایل برای بستهٔ Omni"}</span>
              <ProjectReferenceGrid assets={assetRegistry?.assets.filter((item) => item.scope === "project" && item.kind === "monitor" && item.entityId === locationId) ?? []} selectedIds={monitorAssetIds} canSelect={(assetId) => monitorAssetIds.includes(assetId) || videoReferenceCount < videoReferenceLimit} onToggle={(assetId) => setMonitorAssetIds((current) => current.includes(assetId) ? current.filter((id) => id !== assetId) : [...current, assetId])} onDelete={(assetId) => void deleteProjectReference(assetId)} />
              <label className="media-upload">+ افزودن چند تصویر مانیتور<input accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => { const files = Array.from(event.target.files ?? []); event.currentTarget.value = ""; void addProjectReferences("monitor", files); }} type="file" /></label>
              <div className="publish-media-list"><UploadQueueRows items={referenceUploadQueue.filter((item) => item.kind === "monitor" && item.entityId === locationId && item.status !== "completed")} /></div>
            </div>}
          </>}
          </>}
        </fieldset>
        <label>حال‌وهوای موسیقی<select value={musicMood} onChange={(event) => setMusicMood(event.target.value as typeof musicMood)}><option value="neutral">خنثی و رسمی</option><option value="calm">آرام</option><option value="serious">جدی</option><option value="uplifting">امیدبخش</option></select></label>
      </section>
      <section className="video-form-card video-lines"><h3>کاراکتر و گفت‌وگو</h3>{continuationParent && <p className="notice">ادامهٔ پروژهٔ قبلی؛ فریم، فضا و موسیقی قبلی به‌عنوان لنگر تداوم استفاده می‌شود.</p>}<ModernSwitch checked={speechEnabled} onChange={setSpeechEnabled} label="صحبت کاراکترها فعال باشد" />{speechEnabled ? <>{lines.map((line, index) => <article key={line.id}><b>سکانس {index + 1} · {toPersianDigits(String(durationSeconds))} ثانیه</b><div><select value={line.presenterId} onChange={(event) => updateLine(line.id, { presenterId: event.target.value })}>{presenterIds.map((id) => <option value={id} key={id}>{presenterLabels[id]}</option>)}</select><select value={line.shot} onChange={(event) => updateLine(line.id, { shot: event.target.value as VideoLine["shot"] })}>{Object.entries(shotLabels).map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select></div><textarea value={line.text} onChange={(event) => updateLine(line.id, { text: event.target.value })} maxLength={420} placeholder="جمله‌ای که مجری باید دقیقاً به فارسی اجرا کند" />{lines.length > 1 && <button className="danger-link" onClick={() => setLines((current) => current.filter((item) => item.id !== line.id))} type="button">حذف سکانس</button>}</article>)}<button className="secondary" onClick={() => setLines((current) => [...current, { id: crypto.randomUUID(), presenterId: presenterIds[0], text: "", shot: "medium" }])} disabled={lines.length >= 20} type="button">+ افزودن سکانس گفت‌وگو</button></> : <p className="hint">کاراکترها حرکت، بازی و تعامل طبیعی دارند اما هیچ گفت‌وگو، نریشن یا لب‌خوانی تولید نمی‌شود.</p>}</section>
  <section className="video-form-card"><h3>تنظیمات پیشرفتهٔ زمان‌بندی</h3><p className="hint">برای هر بازه از سکانس توضیح دقیق بدهید؛ یا فقط یک بازهٔ صفر تا پایان برای یک برداشت پیوسته بگذارید. در صورت نیاز، متن کوتاهِ روی تصویر را هم به همان بازه وصل کنید.</p><div className="video-timeline">{timeline.map((beat, index) => <article key={beat.id}><b>بازه {index + 1}</b><label>از ثانیه<select value={beat.startSecond} onChange={(event) => setTimeline((current) => current.map((row) => row.id === beat.id ? { ...row, startSecond: Number(event.target.value) } : row))}>{Array.from({ length: durationSeconds }, (_, second) => <option value={second} key={second}>{toPersianDigits(String(second))}</option>)}</select></label><label>تا ثانیه<select value={beat.endSecond} onChange={(event) => setTimeline((current) => current.map((row) => row.id === beat.id ? { ...row, endSecond: Number(event.target.value) } : row))}>{Array.from({ length: durationSeconds }, (_, number) => number + 1).map((second) => <option value={second} key={second}>{toPersianDigits(String(second))}</option>)}</select></label><textarea maxLength={600} rows={3} value={beat.description} onChange={(event) => setTimeline((current) => current.map((row) => row.id === beat.id ? { ...row, description: event.target.value } : row))} placeholder="مثلاً ثانیه ۰ تا ۳: نمای باز و قدم اول؛ ثانیه ۳ تا ۸: دوربین آرام نزدیک شود." /><div className="video-motion-copy"><strong>متن موشن‌گرافی / روی تصویر (اختیاری)</strong><textarea maxLength={120} rows={2} value={beat.motionText ?? ""} onChange={(event) => setTimeline((current) => current.map((row) => row.id === beat.id ? { ...row, motionText: event.target.value } : row))} placeholder="مثلاً: افزایش قیمت نان در خراسان" /><label>نوع متن<select value={beat.motionStyle ?? "headline"} onChange={(event) => setTimeline((current) => current.map((row) => row.id === beat.id ? { ...row, motionStyle: event.target.value as VideoTimelineBeat["motionStyle"] } : row))}><option value="headline">تیتر کوتاه</option><option value="lower_third">نوار پایینی / نام</option><option value="stat">عدد یا داده</option><option value="label">برچسب گوشه‌ای</option></select></label><label>جای متن<select value={beat.motionPosition ?? "bottom"} onChange={(event) => setTimeline((current) => current.map((row) => row.id === beat.id ? { ...row, motionPosition: event.target.value as VideoTimelineBeat["motionPosition"] } : row))}><option value="top">بالا</option><option value="center">مرکز</option><option value="bottom">پایین</option><option value="left">چپ</option><option value="right">راست</option></select></label><label>ورود متن<select value={beat.motionAnimation ?? "fade"} onChange={(event) => setTimeline((current) => current.map((row) => row.id === beat.id ? { ...row, motionAnimation: event.target.value as VideoTimelineBeat["motionAnimation"] } : row))}><option value="fade">محو و ظاهر شدن</option><option value="slide_up">حرکت از پایین</option><option value="slide_left">حرکت از کنار</option><option value="type_on">تایپ تدریجی</option></select></label></div>{timeline.length > 1 && <button className="danger-link" onClick={() => setTimeline((current) => current.filter((row) => row.id !== beat.id))} type="button">حذف بازه</button>}</article>)}</div><button className="secondary" disabled={timeline.length >= durationSeconds} onClick={() => setTimeline((current) => [...current, { id: crypto.randomUUID(), startSecond: 0, endSecond: durationSeconds, description: "", motionStyle: "headline", motionPosition: "bottom", motionAnimation: "fade" }])} type="button">+ افزودن بازه</button></section>
      <section className="video-form-card"><h3>توضیحات تکمیلی کل ویدیو</h3><textarea maxLength={1200} rows={4} value={videoAdditionalInstructions} onChange={(event) => setVideoAdditionalInstructions(event.target.value)} placeholder="لباس، میزانسن، حرکت دوربین، حس نور، ریتم اجرا یا محدودیت‌های ضروری کل پروژه" /><small className="hint">ژست، لباس و اجرا قابل هدایت است؛ هویت چهره و شخصیت از تصاویر مرجع قفل می‌ماند.</small></section>
    </div>
    <section className="video-cost"><b>{generationModel === "veo_3_1" ? `${seconds} ثانیه · هزینهٔ تخمینی ${estimated.toFixed(2)} دلار` : "Gemini Omni Flash · تولید مستقیم هنوز غیرفعال است"}</b><small>{generationModel === "veo_3_1" ? "ساخت پرامپت با GPT-6 هزینهٔ تولید ویدیو ندارد. هنگام ساخت ویدیو، همین نسخهٔ کارگردانی‌شده استفاده می‌شود." : "AvalAI هنوز این مدل را ارائه نمی‌کند؛ پرامپت و تصاویر نام‌گذاری‌شده را دانلود و در موتور پشتیبان Gemini استفاده کنید."}</small><div className="video-primary-actions"><button className="secondary" disabled={busy || promptBusy} onClick={() => void buildPrompt()} type="button">{promptBusy ? "GPT در حال کارگردانی…" : "ساخت پرامپت"}</button><button className="primary" disabled={busy || promptBusy || generationModel !== "veo_3_1"} onClick={() => void submitVideo()} title={generationModel !== "veo_3_1" ? "ساخت Gemini Omni پس از پشتیبانی AvalAI فعال می‌شود" : undefined} type="button">{busy ? "در حال ثبت…" : generationModel === "veo_3_1" ? "ساخت ویدیو" : "ساخت ویدیو · فعلاً غیرفعال"}</button></div></section>
    {error && <p className="error">{error}</p>}
    {videoPrompt && <section className="video-prompt-result">
      <header><div><span>نگارش کارگردانی با {videoPrompt.model}</span><h3>پکیج تخصصی {videoPrompt.targetModel === "gemini_omni_flash" ? "Gemini Omni Flash" : "Veo 3.1"}</h3></div><div className="choices"><button onClick={() => void navigator.clipboard.writeText(videoPrompt.fullPrompt)} type="button">کپی همهٔ پرامپت‌ها</button><button className="primary" onClick={() => void downloadPromptBundle()} type="button">دانلود ZIP کامل</button></div></header>
      {videoPrompt.usage && <p className="usage-note">{usageLabel(videoPrompt.usage) || "مصرف مدل ثبت شد."}</p>}
      {videoPrompt.projectSummary && <p>{videoPrompt.projectSummary}</p>}
      {videoPrompt.directorialStrategy && <p className="video-directorial-strategy"><b>استراتژی دوربین:</b> {videoPrompt.directorialStrategy}</p>}
      <div className="video-prompt-segments">{videoPrompt.segments.map((segment) => <article key={segment.index}>
        <h4>{segment.title}</h4>
        <div className="video-target-prompt"><b>{videoPrompt.targetModel === "gemini_omni_flash" ? "Gemini Omni Flash" : "Veo 3.1"}</b><small>{videoPrompt.targetModel === "gemini_omni_flash" ? "بهینه برای ثبات کاراکتر، ورودی چندرسانه‌ای و تغییر پرسپکتیو" : "بهینه برای خروجی ۸ثانیه‌ای، تک‌برداشت و حداکثر سه مرجع"}</small><pre dir="ltr">{segment.prompt}</pre>{segment.negativePrompt && <details><summary>Negative Prompt</summary><pre dir="ltr">{segment.negativePrompt}</pre></details>}<button className="secondary" onClick={() => void navigator.clipboard.writeText(`${segment.prompt}${segment.negativePrompt ? `\n\nNEGATIVE PROMPT:\n${segment.negativePrompt}` : ""}`)} type="button">کپی پرامپت این بخش</button></div>
        <div className="video-prompt-references">{segment.referenceIds.map((referenceId) => {
          const reference = videoPrompt.references.find((item) => item.referenceId === referenceId);
          if (!reference) return null;
          return <button onClick={() => void downloadPromptReference(reference.referenceId, reference.downloadName)} type="button" key={reference.referenceId}><img alt={reference.label} src={reference.url} /><span><b dir="ltr">{reference.downloadName}</b><small>دانلود با نام دقیق داخل پرامپت</small></span></button>;
        })}</div>
      </article>)}</div>
    </section>}
    {activeProject && <section className="video-progress"><h3>وضعیت پروژهٔ فعال</h3><b>{activeProject.state}</b>{activeVideoUrl && <video className="video-project-preview" controls playsInline preload="metadata" src={activeVideoUrl} />}{(Array.isArray(activeProject.segments) ? activeProject.segments : []).map((segment) => <div key={segment.index}><span>بخش {segment.index + 1} · {presenterLabels[segment.presenterId]}</span><progress max="100" value={segment.progress || 0} /><small>{segment.state}{segment.error ? ` · ${segment.error}` : ""}</small></div>)}{(activeProject.events?.length ?? 0) > 0 && <details className="video-attempt-history" open><summary>تاریخچهٔ کامل تلاش‌ها ({toPersianDigits(String(activeProject.events?.length ?? 0))})</summary>{activeProject.events?.slice().reverse().map((event, index) => <article key={`${event.at}-${index}`}><b>{event.attempt ? `تلاش ${toPersianDigits(String(event.attempt))} · ` : ""}{event.state}</b><span>{new Date(event.at * 1000).toLocaleString("fa-IR")}</span><small>{event.message}</small></article>)}</details>}<div className="choices">{activeProject.state === "completed" && <><button onClick={() => void download(activeProject)} type="button">دانلود MP4</button><button onClick={() => continueProject(activeProject)} type="button">ادامهٔ همین ویدیو</button></>}{activeProject.state === "failed" && <button onClick={async () => { const result = await manageVideoProject(telegramInitData, activeProject.projectId, "retry"); if (result) setActiveProject(result); }} type="button">تلاش مجدد امن</button>}{["queued", "processing"].includes(activeProject.state) && <button onClick={() => void manageVideoProject(telegramInitData, activeProject.projectId, "cancel")} type="button">توقف پس از درخواست جاری</button>}</div></section>}
    {!!projects.length && <section className="video-project-list"><h3>پروژه‌های اخیر</h3>{projects.map((project) => <button onClick={() => setActiveProject(project)} type="button" key={project.projectId}><span>{new Date(project.createdAt * 1000).toLocaleString("fa-IR")}</span><b>{project.state}</b><small>{Number(project.estimatedSeconds ?? 0)} ثانیه · ${Number(project.estimatedCostUsd ?? 0).toFixed(2)}</small></button>)}</section>}
    </>}
  </section>;
}

function RuleTermsInput({
  terms,
  onChange,
}: {
  terms: string[];
  onChange: (terms: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const additions = draft
      .split(/[\n,،]+/)
      .map((item) => item.replace(/\s+/g, " ").trim())
      .filter(Boolean);
    if (additions.length)
      onChange(Array.from(new Set([...terms, ...additions])).slice(0, 24));
    setDraft("");
  };
  return (
    <div className="rule-terms-input">
      <div aria-label="عبارت‌های شرط">
        {terms.map((term) => (
          <span key={term}>
            {term}
            <button
              aria-label={`حذف عبارت ${term}`}
              onClick={() => onChange(terms.filter((item) => item !== term))}
              type="button"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        onBlur={add}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === ",") {
            event.preventDefault();
            add();
          }
        }}
        placeholder="عبارت را بنویسید و Enter بزنید"
        value={draft}
      />
      <button className="secondary" disabled={!draft.trim()} onClick={add} type="button">افزودن عبارت</button>
    </div>
  );
}

// Vite replaces this compile-time marker in production. Keep a safe fallback
// for the constrained/manual esbuild deployment path so the whole app cannot
// white-screen if the define is accidentally omitted.
const STUDIO_RELEASE =
  typeof __STUDIO_RELEASE__ === "undefined" ? "local" : __STUDIO_RELEASE__;

function App() {
  const [telegram, setTelegram] = useState<TelegramWebApp | undefined>();
  const [requestId, setRequestId] = useState<string>(() => crypto.randomUUID());
  const [draftId, setDraftId] = useState(
    () => new URLSearchParams(window.location.search).get("draft") ?? "",
  );
  const [draftReferenceNames, setDraftReferenceNames] = useState<string[]>([]);
  const [excludedDraftReferences, setExcludedDraftReferences] = useState<
    string[]
  >([]);
  const [brand, setBrand] = useState<Brand>("kalametaze");
  const [activeTab, setActiveTab] = useState<AppTab>(restoredActiveTab);
  const [studioTheme, setStudioTheme] = useState<"light" | "dark">(restoredStudioTheme);
  useEffect(() => {
    try {
      window.localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, activeTab);
    } catch {
      // Private browsing or a storage policy must not block navigation.
    }
  }, [activeTab]);
  useEffect(() => {
    try {
      window.localStorage.setItem(STUDIO_THEME_STORAGE_KEY, studioTheme);
    } catch {
      // A storage policy must not prevent changing the visual theme.
    }
  }, [studioTheme]);
  const [newsSnapshots, setNewsSnapshots] = useState<NewsSeekerSnapshot[]>([]);
  const [newsItems, setNewsItems] = useState<NewsSeekerItem[]>([]);
  const [newsQueue, setNewsQueue] = useState<NewsroomQueueEntry[]>([]);
  const [newsSources, setNewsSources] = useState<NewsroomSource[]>([]);
  const [newsCategory, setNewsCategory] = useState<"all" | NewsSeekerCategory>(
    "all",
  );
  const [selectedNewsSnapshotId, setSelectedNewsSnapshotId] = useState("");
  const [newsBusy, setNewsBusy] = useState(false);
  const [newsError, setNewsError] = useState("");
  const [newsNotice, setNewsNotice] = useState("");
  const [templateGroup, setTemplateGroup] = useState<TemplateGroup>("news");
  const [clubShowcase, setClubShowcase] = useState(emptyClubShowcase);
  const showcaseImageNames = useRef<string[]>([]);
  const replaceShowcaseImages = (incoming: File[]) => {
    const previous = new Set(showcaseImageNames.current);
    showcaseImageNames.current = incoming.map(file => file.name);
    setFiles(current => [...current.filter(file => !previous.has(file.name)), ...incoming]);
    if (incoming.length) setImageMode("reference");
  };
  const [canvas, setCanvas] = useState<Canvas>("story_1080x1920");
  const [template, setTemplate] = useState("news_story");
  const [newsOutputKind, setNewsOutputKind] =
    useState<NewsOutputKind>("title_photo");
  const [newsLayout, setNewsLayout] = useState<NewsLayout>("top");
  const [newsPhotoFrame, setNewsPhotoFrame] = useState<NewsPhotoFrame>("full");
  const [citizenMessageType, setCitizenMessageType] =
    useState<CitizenMessageType>("text");
  const [videoOverlay, setVideoOverlay] = useState(false);
  const [videoFrame, setVideoFrame] = useState<VideoFrame>("landscape");
  const [videoBackgroundBlur, setVideoBackgroundBlur] = useState(false);
  const [siteLinkPlaceholder, setSiteLinkPlaceholder] = useState(false);
  const [logoBehavior, setLogoBehavior] = useState<LogoBehavior>("floating_profile");
  const [studioPresenterIds, setStudioPresenterIds] = useState<string[]>(["kamran"]);
  const [studioLocationId, setStudioLocationId] = useState("newsroom");
  const [studioLocationMode, setStudioLocationMode] =
    useState<StudioLocationMode>("catalog");
  const [studioLocationAssetIds, setStudioLocationAssetIds] = useState<string[]>([]);
  const [studioLocationPrompt, setStudioLocationPrompt] = useState("");
  const [studioLocationReferenceInstructions, setStudioLocationReferenceInstructions] = useState("");
  const [studioLocationUploadQueue, setStudioLocationUploadQueue] = useState<VideoUploadItem[]>([]);
  const [studioAssetRegistry, setStudioAssetRegistry] = useState<VideoAssetRegistry>();
  const [studioPresenterReferences, setStudioPresenterReferences] = useState<Record<string, ReferenceChoice>>({});
  const [studioLocationReferences, setStudioLocationReferences] = useState<ReferenceChoice>(automaticReferenceChoice());
  const [studioTextMode, setStudioTextMode] = useState<StudioTextMode>("monitor");
  const [studioText, setStudioText] = useState("");
  const [studioMonitorEnabled, setStudioMonitorEnabled] = useState(true);
  const [studioMonitorMode, setStudioMonitorMode] = useState<StudioMonitorMode>("text");
  const [studioMonitorText, setStudioMonitorText] = useState("");
  const [studioMonitorImageMode, setStudioMonitorImageMode] = useState<StudioMonitorImageMode>("generate");
  const [studioMonitorImageCount, setStudioMonitorImageCount] = useState(1);
  const [studioMonitorBrief, setStudioMonitorBrief] = useState("");
  const [studioMonitorFiles, setStudioMonitorFiles] = useState<File[]>([]);
  const [studioTitleSpaceEnabled, setStudioTitleSpaceEnabled] = useState(false);
  const [studioTitleSpaceText, setStudioTitleSpaceText] = useState("");
  const [studioCopySpacePlacement, setStudioCopySpacePlacement] = useState<StudioCopySpacePlacement>("auto");
  const [studioExpressions, setStudioExpressions] = useState<Record<string, string>>({ kamran: "آرام و مطمئن" });
  const [studioCharacterInstructions, setStudioCharacterInstructions] = useState<Record<string, string>>({});
  const [studioSpeechBubbles, setStudioSpeechBubbles] = useState<Record<string, string[]>>({});
  const [advertisingEnabled, setAdvertisingEnabled] = useState(false);
  const [advertisingMode, setAdvertisingMode] = useState<"card" | "subtitle" | "embedded">("card");
  const [advertisingTitle, setAdvertisingTitle] = useState("");
  const [advertisingSubtitle, setAdvertisingSubtitle] = useState("");
  const [advertisingDescription, setAdvertisingDescription] = useState("");
  const [advertisingContact, setAdvertisingContact] = useState("");
  const [advertisingFiles, setAdvertisingFiles] = useState<File[]>([]);
  const [imageMode, setImageMode] = useState<ImageMode>("generate");
  const [imageEngineOverride, setImageEngineOverride] = useState("");
  const [imageQuality, setImageQuality] = useState<"low" | "medium" | "high">("medium");
  const [imageEnginePickerOpen, setImageEnginePickerOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [puzzleFiles, setPuzzleFiles] = useState<File[]>([]);
  const [morningKalamHolidays, setMorningKalamHolidays] = useState<boolean[]>([
    false,
    false,
    false,
    false,
    false,
    false,
    false,
  ]);
  const [previewFile, setPreviewFile] = useState<
    { name: string; url: string } | undefined
  >();
  const [submissionState, setSubmissionState] = useState<
    "idle" | "uploading" | "submitted" | "error"
  >("idle");
  const [submissionError, setSubmissionError] = useState("");
  const [designUploadQueue, setDesignUploadQueue] = useState<
    DesignUploadItem[]
  >([]);
  const [promptPreview, setPromptPreview] = useState<
    DesignPromptPreview | undefined
  >();
  const [promptPreviewBusy, setPromptPreviewBusy] = useState(false);
  const [promptPreviewError, setPromptPreviewError] = useState("");
  const [designCaptionDraft, setDesignCaptionDraft] = useState("");
  const [designCaptionBusy, setDesignCaptionBusy] = useState(false);
  const [designCaptionError, setDesignCaptionError] = useState("");
  const [designCaptionEditing, setDesignCaptionEditing] = useState(false);
  const [storySummary, setStorySummary] = useState("");
  const [storySummaryBusy, setStorySummaryBusy] = useState(false);
  const [storySummaryError, setStorySummaryError] = useState("");
  const [activeJobId, setActiveJobId] = useState(
    () => window.localStorage.getItem("kalam-design-active-job") ?? "",
  );
  const [activeJob, setActiveJob] = useState<DesignJob | undefined>();
  const [activeOutputUrl, setActiveOutputUrl] = useState("");
  const [outputLoading, setOutputLoading] = useState(false);
  const [editInstruction, setEditInstruction] = useState("");
  const [morningLoading, setMorningLoading] = useState<
    | "date"
    | "weather"
    | "prayer"
    | "riddle"
    | "visual_riddle"
    | "local_occasions"
    | "kalam_calendar"
    | "kalam_occasions"
    | undefined
  >();
  const [morningDataError, setMorningDataError] = useState("");
  const [marketLoading, setMarketLoading] = useState<
    "date" | "rates" | undefined
  >();
  const [marketDataError, setMarketDataError] = useState("");
  const [marketDataNote, setMarketDataNote] = useState("");
  const [occasionOptions, setOccasionOptions] = useState<string[]>([]);
  const [ideaOptions, setIdeaOptions] = useState<string[]>([]);
  const [contentToolLoading, setContentToolLoading] = useState<
    string | undefined
  >();
  const [contentToolError, setContentToolError] = useState("");
  const [sportCompetitions, setSportCompetitions] = useState<SportCompetition[]>([]);
  const [sportEvents, setSportEvents] = useState<SportEvent[]>([]);
  const [sportLoading, setSportLoading] = useState<"catalog" | "events" | "">("");
  const [sportDataSource, setSportDataSource] = useState("");
  const [showRawAiResponse, setShowRawAiResponse] = useState(false);
  const [formCollapsed, setFormCollapsed] = useState(false);
  const [formEditMode, setFormEditMode] = useState(false);
  const [jobStartedAt, setJobStartedAt] = useState<number | undefined>();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [accessView, setAccessView] = useState<AccessView>({
    ownerId: "605598559",
    users: [{ chatId: "605598559", status: "owner" }],
  });
  const [accessState, setAccessState] = useState<
    "unknown" | "owner" | "active" | "pending" | "revoked" | "rejected"
  >("unknown");
  const [webSessionChecked, setWebSessionChecked] = useState(false);
  const [webLoginMode, setWebLoginMode] = useState<"phone" | "username">("phone");
  const [webLoginPhone, setWebLoginPhone] = useState("");
  const [webLoginOtp, setWebLoginOtp] = useState("");
  const [webLoginOtpSent, setWebLoginOtpSent] = useState(false);
  const [webLoginUsername, setWebLoginUsername] = useState("");
  const [webLoginPassword, setWebLoginPassword] = useState("");
  const [showWebLoginPassword, setShowWebLoginPassword] = useState(false);
  const [rememberWebLogin, setRememberWebLogin] = useState(false);
  const [webLoginError, setWebLoginError] = useState("");
  const [webLoginBusy, setWebLoginBusy] = useState(false);
  const [webAccountChatId, setWebAccountChatId] = useState("605598559");
  const [webAccountUsername, setWebAccountUsername] = useState("");
  const [webAccountPassword, setWebAccountPassword] = useState("");
  const [showWebAccountPassword, setShowWebAccountPassword] = useState(false);
  const [chatIdToAdd, setChatIdToAdd] = useState("");
  const [projects, setProjects] = useState<LibraryProject[]>([]);
  const [libraryTab, setLibraryTab] = useState<LibraryTab>("images");
  const [videoLibraryProjects, setVideoLibraryProjects] = useState<
    VideoProject[]
  >([]);
  const [videoProjectToOpen, setVideoProjectToOpen] = useState("");
  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  const [imageModelSettings, setImageModelSettings] = useState<ImageModelSettings>();
  const [imageModelSaving, setImageModelSaving] = useState(false);
  const [textModelSettings, setTextModelSettings] = useState<TextModelSettings>();
  const [textModelSaving, setTextModelSaving] = useState(false);
  const [voiceModelSettings, setVoiceModelSettings] = useState<VoiceModelSettings>();
  const [voiceModelSaving, setVoiceModelSaving] = useState(false);
  const [promptTab, setPromptTab] = useState<"text" | "image">("image");
  const [editingPromptId, setEditingPromptId] = useState<string | undefined>();
  const [promptDraft, setPromptDraft] = useState("");
  const [content, setContent] = useState({ ...initialContent });
  const [contentProjects, setContentProjects] = useState<ContentProject[]>([]);
  const [archiveCategory, setArchiveCategory] = useState<"all" | ContentProject["category"]>("all");
  const [archiveState, setArchiveState] = useState<"all" | ContentProject["state"]>("all");
  const [archiveNote, setArchiveNote] = useState("");
  const [subjectOpenId, setSubjectOpenId] = useState("");
  const [subjectNote, setSubjectNote] = useState("");
  const [subjectReplyTo, setSubjectReplyTo] = useState("");
  const [manualSubjectOpen, setManualSubjectOpen] = useState(false);
  const [manualSubjectTitle, setManualSubjectTitle] = useState("");
  const [manualSubjectText, setManualSubjectText] = useState("");
  const [manualSubjectNote, setManualSubjectNote] = useState("");
  const [manualSubjectFiles, setManualSubjectFiles] = useState<File[]>([]);
  const [manualSubjectBusy, setManualSubjectBusy] = useState(false);
  const [subjectError, setSubjectError] = useState("");
  const [subjectNotice, setSubjectNotice] = useState("");
  const [subjectSmsRecipientIds, setSubjectSmsRecipientIds] = useState<string[]>([]);
  const [subjectSmsText, setSubjectSmsText] = useState("");
  const [subjectSmsOpenId, setSubjectSmsOpenId] = useState("");
  const [manualSubjectUploadQueue, setManualSubjectUploadQueue] = useState<PublishUploadItem[]>([]);
  const [subjectMediaUrls, setSubjectMediaUrls] = useState<Record<string, string>>({});
  const [browserPushState, setBrowserPushState] = useState<"idle" | "enabled" | "unavailable">("idle");
  const automaticPushPromptAttempted = useRef(false);
  const [instagramPushAccounts, setInstagramPushAccounts] = useState<string[]>([]);
  const [activeContentProject, setActiveContentProject] = useState<
    ContentProject | undefined
  >();
  const [editorialRawText, setEditorialRawText] = useState("");
  const [editorialArticle, setEditorialArticle] = useState<ContentArticle>({});
  const [editorialSlides, setEditorialSlides] = useState<DesignSlide[]>([]);
  const [designSlides, setDesignSlides] = useState<DesignSlide[]>([]);
  const [slideSeries, setSlideSeries] = useState<
    SlideSeriesSession | undefined
  >();
  const [slideSeriesOutputs, setSlideSeriesOutputs] = useState<
    SlideSeriesOutput[]
  >([]);
  const [editorialAdditionalInstructions, setEditorialAdditionalInstructions] =
    useState("");
  const [editorialExtractedText, setEditorialExtractedText] = useState("");
  const [editorialSaving, setEditorialSaving] = useState(false);
  const [editorialError, setEditorialError] = useState("");
  const [editorialNotice, setEditorialNotice] = useState("");
  const [transcriptionModelSettings, setTranscriptionModelSettings] = useState<TranscriptionModelSettings>();
  const [transcriptionModelSaving, setTranscriptionModelSaving] = useState(false);
  const [editorialTranscriptionJobs, setEditorialTranscriptionJobs] = useState<AudioTranscriptionJob[]>([]);
  const [editorialAudioBusy, setEditorialAudioBusy] = useState(false);
  const [editorialAudioProgress, setEditorialAudioProgress] = useState<UploadTransferProgress>();
  const [reporterProfile, setReporterProfile] =
    useState<ReporterProfile>("site");
  const [reporterWebResearch, setReporterWebResearch] = useState(false);
  const [channelJoinUrl, setChannelJoinUrl] = useState("");
  const [reporterBusy, setReporterBusy] = useState(false);
  const [reporterOutput, setReporterOutput] = useState("");
  const [reporterUsage, setReporterUsage] = useState<AvalaiUsage>();
  const [reporterOutputEditing, setReporterOutputEditing] = useState(false);
  const [publishDraftText, setPublishDraftText] = useState("");
  const [publishSiteArticle, setPublishSiteArticle] = useState<ContentArticle>(
    {},
  );
  const [publishSiteCategories, setPublishSiteCategories] = useState("");
  const [publishSiteTags, setPublishSiteTags] = useState("");
  const [publishSiteCategoryIds, setPublishSiteCategoryIds] = useState<
    number[]
  >([]);
  const [publishSiteTagIds, setPublishSiteTagIds] = useState<number[]>([]);
  const [publishSiteNewTags, setPublishSiteNewTags] = useState<string[]>([]);
  const [publishSiteBusy, setPublishSiteBusy] = useState(false);
  const [siteTermSearch, setSiteTermSearch] = useState({
    categories: "",
    tags: "",
  });
  const [siteTermResults, setSiteTermResults] = useState<{
    categories: Array<{ id: number; name: string }>;
    tags: Array<{ id: number; name: string }>;
  }>({ categories: [], tags: [] });
  const [siteTermBusy, setSiteTermBusy] = useState<"categories" | "tags" | "">(
    "",
  );
  const [publishTargets, setPublishTargets] = useState<PublicationTarget[]>([]);
  const [videoPublishTargets, setVideoPublishTargets] = useState<
    VideoPlatformTarget[]
  >([]);
  const [publishBusy, setPublishBusy] = useState(false);
  const [publishResult, setPublishResult] = useState<
    PublicationResult | undefined
  >();
  const [publishActivityLog, setPublishActivityLog] = useState<
    Array<{
      target: string;
      status: "pending" | "published" | "failed" | "uncertain";
      error?: string;
      url?: string;
    }>
  >([]);
  const [publishError, setPublishError] = useState("");
  const [publishNotice, setPublishNotice] = useState("");
  const [publishRequestKey, setPublishRequestKey] = useState<string>(() =>
    crypto.randomUUID(),
  );
  const [publishPhotoRequestId, setPublishPhotoRequestId] = useState("");
  const [publishMediaIds, setPublishMediaIds] = useState<string[]>([]);
  const [siteFeaturedMediaId, setSiteFeaturedMediaId] = useState("");
  const [publishMediaBusy, setPublishMediaBusy] = useState(false);
  const [publishUploadQueue, setPublishUploadQueue] = useState<
    PublishUploadItem[]
  >([]);
  const [publishPreviewMedia, setPublishPreviewMedia] = useState<
    Array<{
      mediaId: string;
      kind: ContentMedia["kind"];
      url: string;
      filename: string;
    }>
  >([]);
  const [publishReviewMode, setPublishReviewMode] = useState<
    "text" | "media" | "site" | "unified" | undefined
  >();
  const [publishSiteTarget, setPublishSiteTarget] = useState(false);
  const [publishForwardPlan, setPublishForwardPlan] = useState<ForwardPlan>({});
  const openedOutputRequestRef = useRef("");
  const publishCaptionWarnings = useMemo(() => {
    const count = publishDraftText
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .trim().length;
    if (!(publishPhotoRequestId || publishMediaIds.length) || !count)
      return [] as Array<{ platform: string; limit: number }>;
    return Array.from(
      new Set(publishTargets.map((target) => target.split("_", 1)[0])),
    )
      .map((platform) => ({
        platform,
        limit: publishCaptionLimits[platform] ?? 1024,
      }))
      .filter((item) => count > item.limit);
  }, [
    publishDraftText,
    publishTargets,
    publishPhotoRequestId,
    publishMediaIds,
  ]);

  useEffect(() => {
    let disposed = false;
    const urls: string[] = [];
    if (
      !publishReviewMode ||
      !activeContentProject ||
      !publishMediaIds.length
    ) {
      setPublishPreviewMedia([]);
      return undefined;
    }
    const selectedMedia = (activeContentProject.media ?? []).filter((media) =>
      publishMediaIds.includes(media.mediaId),
    );
    if (!selectedMedia.length) {
      setPublishPreviewMedia([]);
      return undefined;
    }
    void Promise.all(
      selectedMedia.map(async (media) => {
        const blob = await getContentMediaOutput(
          telegram?.initData,
          activeContentProject.contentProjectId,
          media.mediaId,
        );
        if (!blob) throw new Error("فایل پیش‌نمایش در دسترس نیست.");
        const url = URL.createObjectURL(blob);
        urls.push(url);
        return {
          mediaId: media.mediaId,
          kind: media.kind,
          url,
          filename: media.filename,
        };
      }),
    )
      .then((items) => {
        if (!disposed) setPublishPreviewMedia(items);
      })
      .catch(() => {
        if (!disposed) setPublishPreviewMedia([]);
      });
    return () => {
      disposed = true;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [
    publishReviewMode,
    activeContentProject?.contentProjectId,
    activeContentProject?.media?.map((media) => media.mediaId).join(","),
    publishMediaIds.join(","),
    telegram?.initData,
  ]);
  const [engagementAccounts, setEngagementAccounts] = useState<
    EngagementAccount[]
  >([]);
  const [engagementConnections, setEngagementConnections] = useState<
    EngagementConnection[]
  >([]);
  const [engagementInbox, setEngagementInbox] = useState<EngagementInboxItem[]>(
    () => {
      try {
        const cached = JSON.parse(window.sessionStorage.getItem("kalam-engagement-inbox-cache") ?? "[]");
        return Array.isArray(cached) ? cached.slice(0, 60) : [];
      } catch {
        return [];
      }
    },
  );
  const [engagementRules, setEngagementRules] = useState<EngagementRule[]>([]);
  const [engagementShowcases, setEngagementShowcases] = useState<EngagementShowcase[]>([]);
  const [engagementTags, setEngagementTags] = useState<string[]>([]);
  const [editingShowcase, setEditingShowcase] = useState<EngagementShowcase | undefined>();
  const [engagementFilters, setEngagementFilters] = useState<string[]>([]);
  const [engagementTagFilters, setEngagementTagFilters] = useState<string[]>(
    [],
  );
  const [engagementConfigured, setEngagementConfigured] = useState(false);
  const [engagementBusy, setEngagementBusy] = useState(false);
  const [engagementInboxHasMore, setEngagementInboxHasMore] = useState(false);
  const [engagementInboxCursor, setEngagementInboxCursor] = useState(0);
  const [engagementInboxLoadingMore, setEngagementInboxLoadingMore] = useState(false);
  const [engagementError, setEngagementError] = useState("");
  const [engagementView, setEngagementView] = useState<
    "inbox" | "comments" | "rules" | "settings"
  >("inbox");
  const [selectedEngagementConnection, setSelectedEngagementConnection] =
    useState("");
  const [connectionName, setConnectionName] = useState("");
  const [connectionApiKey, setConnectionApiKey] = useState("");
  const [connectionBaseUrl, setConnectionBaseUrl] = useState(
    "https://api.sendbox.chat/api/v1",
  );
  const [editingEngagementRule, setEditingEngagementRule] = useState<
    EngagementRule | undefined
  >();
  const [ruleAttachmentUploads, setRuleAttachmentUploads] = useState<PublishUploadItem[]>([]);
  const [selectedInboxEventId, setSelectedInboxEventId] = useState("");
  const [engagementReplyText, setEngagementReplyText] = useState("");
  const [engagementReplyBusy, setEngagementReplyBusy] = useState(false);
  const [engagementKnowledge, setEngagementKnowledge] =
    useState<EngagementKnowledge>({
      voice: "",
      safety: "",
      advertising: "",
      nonAdvertising: "",
      facts: "",
      faq: "",
      sources: [],
    });
  const [engagementSiteArticles, setEngagementSiteArticles] = useState<
    Array<{ title: string; url: string }>
  >([]);
  const [engagementKnowledgeBusy, setEngagementKnowledgeBusy] = useState(false);
  const [engagementPersonas, setEngagementPersonas] = useState<EngagementPersona[]>([]);
  const [leadDraft, setLeadDraft] = useState<EngagementLeadDraft>();
  const [leadDraftEventId, setLeadDraftEventId] = useState("");
  const [leadDraftBusy, setLeadDraftBusy] = useState(false);
  const [leadDraftSaving, setLeadDraftSaving] = useState(false);
  const [leadDraftNotice, setLeadDraftNotice] = useState("");

  // Telegram's WebApp bridge can be injected just after the JavaScript bundle
  // starts. Bind lazily so a brief load delay never leaves the app unauthenticated.
  useEffect(() => {
    let attempts = 0;
    const bindTelegram = () => {
      const app = initialiseTelegram();
      if (!app?.initData) return false;
      setTelegram(app);
      return true;
    };

    if (bindTelegram()) return undefined;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (bindTelegram() || attempts >= 50) window.clearInterval(timer);
    }, 100);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    getWebSession()
      .then((session) => {
        if (!session) return;
        setAccessState(session.access as typeof accessState);
      })
      .finally(() => setWebSessionChecked(true));
  }, []);

  useEffect(() => {
    // Temporary, non-sensitive telemetry for this launch issue. It records
    // bridge availability only — never the signed initData or user identity.
    const timer = window.setTimeout(() => {
      const bridge = window.Telegram?.WebApp;
      const url = `${window.location.search}&${window.location.hash}`;
      void fetch("/miniapp/api/diagnostics/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bridge: Boolean(bridge),
          initDataLength: bridge?.initData?.length ?? 0,
          unsafeUserPresent: Boolean(bridge?.initDataUnsafe?.user?.id),
          platform: bridge?.platform ?? "",
          version: bridge?.version ?? "",
          urlHasTelegramParams: /tgWebApp(?:Data|Version|Platform)/.test(url),
        }),
      });
    }, 1500);
    return () => window.clearTimeout(timer);
  }, []);

  const selectedTemplate =
    templateDefinitions.find((item) => item.id === template) ??
    templateDefinitions[0];
  const visibleTemplates = templateDefinitions.filter(
    (item) => item.group === templateGroup,
  );
  const hasField = (field: string) =>
    template === "citizen_message" ||
    template === "morning_kalam" ||
    template === "sport"
      ? false
      : templateGroup === "news"
        ? ["kicker", "title", "subtitle", "caption", "source"].includes(field)
        : (selectedTemplate.fields as readonly string[]).includes(field);
  const visiblePrompts = prompts.filter(
    (prompt) => (prompt.category ?? "text") === promptTab,
  );
  const visibleDraftReferences = draftReferenceNames.filter(
    (name) => !excludedDraftReferences.includes(name),
  );
  const libraryPublications = useMemo(
    () =>
      contentProjects
        .flatMap((project) =>
          (project.publicationRequests ?? []).map((publication) => ({
            project,
            publication,
          })),
        )
        .sort(
          (left, right) =>
            right.publication.createdAt - left.publication.createdAt,
        ),
    [contentProjects],
  );
  const [salesIntegration, setSalesIntegration] = useState<EngagementSalesIntegration>({ enabled: false, configured: false });
  const [salesApiToken, setSalesApiToken] = useState("");
  const archivedContentProjects = useMemo(
    () =>
      contentProjects.filter(
        (project) =>
          (archiveCategory === "all" || project.category === archiveCategory) &&
          (archiveState === "all" || project.state === archiveState),
      ),
    [archiveCategory, archiveState, contentProjects],
  );
  const filePreviews = useMemo(
    () => files.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [files],
  );
  const studioMonitorFilePreviews = useMemo(
    () => studioMonitorFiles.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [studioMonitorFiles],
  );

  useEffect(() => {
    void manageVideoAssets(telegram?.initData, "list", { scope: "project" }).then(setStudioAssetRegistry).catch(() => undefined);
  }, [telegram?.initData]);

  useEffect(
    () => () => filePreviews.forEach((item) => URL.revokeObjectURL(item.url)),
    [filePreviews],
  );
  useEffect(
    () => () => studioMonitorFilePreviews.forEach((item) => URL.revokeObjectURL(item.url)),
    [studioMonitorFilePreviews],
  );

  useEffect(() => {
    if (!["owner", "active"].includes(accessState)) return;
    void manageBrowserNotifications(telegram?.initData, "status").then((result) => {
      if (!result) return;
      const permission = "Notification" in window ? Notification.permission : "denied";
      setBrowserPushState(result.subscribed && permission === "granted" ? "enabled" : "idle");
      setInstagramPushAccounts(result.preferences?.instagramAccounts ?? []);
      // Permission can only be requested while the browser still marks it as
      // "default". Never repeatedly prompt a person who deliberately denied
      // it; browsers would reject that request anyway. The ref also absorbs
      // React StrictMode's development double-effect execution.
      if (permission === "default" && !automaticPushPromptAttempted.current) {
        automaticPushPromptAttempted.current = true;
        void enableBrowserPush();
      }
    }).catch(() => setBrowserPushState("unavailable"));
  }, [accessState, telegram?.initData]);

  useEffect(() => {
    if (newsOutputKind === "title_only" && newsLayout === "right_column")
      setNewsLayout("top");
    if (newsOutputKind === "title_only" && videoOverlay) setVideoOverlay(false);
  }, [template, newsOutputKind, newsLayout, newsPhotoFrame, videoOverlay]);

  const isCitizenMessage = template === "citizen_message";
  const classifiedAds =
    template === "classifieds" ? parseClassifiedAds(content.classifiedsJson) : [];
  const classifiedsReady =
    classifiedAds.length > 0 &&
    classifiedAds.every(
      (ad) => ad.title.trim() && ad.body.trim() && ad.contact.trim(),
    );
  const newsHasPhoto =
    templateGroup === "news" &&
    !isCitizenMessage &&
    newsOutputKind !== "title_only";
  const selectedImageMode: ImageMode =
    templateGroup === "studio"
      ? "generate"
      : (templateGroup === "news" && newsOutputKind === "title_only") ||
    (isCitizenMessage && citizenMessageType === "text")
      ? "none"
      : imageMode;
  const requiresReferenceImage = ["preserve", "reference"].includes(
    selectedImageMode,
  );
  const needsNativeTransparentImage = template === "sticker" || videoOverlay;
  const manualStudioReferenceIds = new Set([
    ...studioPresenterIds.flatMap((id) => studioPresenterReferences[id]?.mode === "manual" ? studioPresenterReferences[id].assetIds : []),
    ...(studioLocationMode === "catalog" && studioLocationReferences.mode === "manual" ? studioLocationReferences.assetIds : []),
    ...(["exact_reference", "faithful_reference"].includes(studioLocationMode) ? studioLocationAssetIds : []),
  ]);
  const studioUploadedReferenceCount = files.length + advertisingFiles.length + puzzleFiles.length + studioMonitorFiles.length + visibleDraftReferences.length;
  const studioAutoReferenceCount = studioPresenterIds.filter((id) => (studioPresenterReferences[id]?.mode ?? "auto") === "auto").length + (studioLocationMode === "catalog" && studioLocationReferences.mode === "auto" ? 1 : 0);
  const studioReferenceCount = manualStudioReferenceIds.size + studioUploadedReferenceCount + studioAutoReferenceCount;
  const studioReferenceChoiceLimit = (choice: ReferenceChoice) => {
    const contribution = choice.mode === "manual" ? new Set(choice.assetIds).size : 1;
    return Math.max(0, studioImageReferenceLimit - studioReferenceCount + contribution);
  };
  const slideHasContent = (slide?: DesignSlide, index = 1) =>
    Boolean(
      (index === 0 && slide?.kicker?.trim()) ||
      slide?.title.trim() ||
      slide?.subtitle.trim() ||
      (index !== 0 && (slide?.body.trim() || slide?.footer.trim())),
    );
  const slideReferencesReady = (slide?: DesignSlide) =>
    !slide || (
      (!["preserve", "reference"].includes(slide.imageMode ?? "generate") || slide.files.length > 0) &&
      (slide.imageMode !== "studio" || !["exact_reference", "faithful_reference"].includes(slide.studioLocationMode ?? "") || (slide.studioLocationAssetIds ?? []).length > 0)
    );
  const slideReferenceCount = (slide?: DesignSlide) =>
    !slide
      ? 0
      : slide.files.length +
        (slide.presenterIds ?? []).reduce((total, id) => {
          const choice =
            slide.presenterReferenceSelection?.[id] ??
            automaticReferenceChoice();
          return (
            total +
            (choice.mode === "manual" ? new Set(choice.assetIds).size : 1)
          );
        }, 0) +
        (slide.imageMode === "studio"
          ? slide.studioLocationMode === "catalog"
            ? (slide.studioLocationReferences?.mode === "manual"
                ? new Set(slide.studioLocationReferences.assetIds).size
                : 1)
            : ["exact_reference", "faithful_reference"].includes(slide.studioLocationMode ?? "")
              ? new Set(slide.studioLocationAssetIds ?? []).size
              : 0
          : 0);
  const slideReferencesWithinLimit = (slide?: DesignSlide) =>
    slideReferenceCount(slide) <= studioImageReferenceLimit;
  const seriesFirstSlideReady =
    designSlides.length > 1 &&
    slideHasContent(designSlides[0], 0) &&
    slideReferencesReady(designSlides[0]);
  const supportsDataCaption = [
    "morning_local",
    "morning_kalam",
    "market",
    "classifieds",
    "sport",
  ].includes(template);
  // Series content belongs exclusively to individual slides.  Do not require
  // the hidden single-design fields when the editor is in series mode.
  const hasRequiredDesignContent =
    designSlides.length > 1
      ? seriesFirstSlideReady
      : templateGroup === "studio"
        ? studioPresenterIds.length > 0 &&
          Boolean(studioLocationId) &&
          (studioLocationMode === "catalog" ||
            (studioLocationMode === "generated_prompt"
              ? studioLocationPrompt.trim().length >= 4
              : studioLocationAssetIds.length > 0))
      : template === "club_showcase"
        ? Boolean(clubShowcase.title.trim() && clubShowcase.store.trim())
      : template === "morning_local"
        ? Boolean(
            content.morningWeekday.trim() &&
            content.morningPersianDate.trim() &&
            content.morningGregorianDate.trim() &&
            content.morningHijriDate.trim() &&
            content.morningFajr.trim() &&
            content.morningSunrise.trim() &&
            content.morningNoon.trim() &&
            content.morningSunset.trim() &&
            content.morningMaghrib.trim() &&
            content.morningMidnight.trim() &&
            content.morningRiddleQuestion.trim(),
          )
        : template === "morning_kalam"
          ? Boolean(
              content.morningKalamWeekLabel.trim() &&
              content.morningKalamDay1.trim() &&
              content.morningKalamDay2.trim() &&
              content.morningKalamDay3.trim() &&
              content.morningKalamDay4.trim() &&
              content.morningKalamDay5.trim() &&
              content.morningKalamDay6.trim() &&
              content.morningKalamDay7.trim(),
            )
          : template === "market"
            ? Boolean(
                content.marketWeekday.trim() &&
                content.marketPersianDate.trim() &&
                content.marketGregorianDate.trim() &&
                content.marketHijriDate.trim() &&
                content.marketTime.trim() &&
                content.marketSource.trim() &&
                content.marketUsdPrice.trim() &&
                content.marketEurPrice.trim() &&
                content.marketCoinPrice.trim() &&
                content.marketGold18Price.trim() &&
                content.marketBitcoinPrice.trim(),
              )
            : template === "sport"
              ? Boolean(content.title.trim() || content.sportResults.trim())
              : template === "occasion_greeting"
                ? Boolean(
                    content.occasionName.trim() ||
                    content.occasionHeadline.trim() ||
                    content.occasionMessage.trim(),
                  )
                : template === "poster"
                  ? Boolean(content.posterHeadline.trim())
                  : template === "sticker"
                    ? Boolean(content.stickerText.trim())
                  : template === "classifieds"
                    ? classifiedsReady
                    : template === "editorial_note"
                  ? Boolean(content.title.trim() || content.caption.trim())
                  : isCitizenMessage
                    ? Boolean(content.citizenMessageText.trim())
                    : Boolean(content.title.trim());
  const normalisedContent = Object.fromEntries(
    Object.entries(content).map(([field, value]) => [
      field,
      normaliseContentValue(field, value),
    ]),
  ) as typeof content;
  const payload = {
    requestId,
    draftId: draftId || undefined,
    draftOmitFilenames: excludedDraftReferences,
    platform: "telegram",
    adminUserId: "pending_server_verification",
    brand,
    format: {
      family: templateGroup === "news" ? "news" : templateGroup === "studio" ? "studio" : "fixed",
      template,
      canvas,
      logoBehavior,
      slideMode:
        designSlides.length > 1
          ? canvas === "post_1080x1350"
            ? "carousel"
            : "multi_story"
          : "single",
      slideCount: designSlides.length || 1,
      news:
        templateGroup === "news" && !isCitizenMessage
          ? {
              outputKind: newsOutputKind,
              layout: newsLayout,
              photoFrame: newsHasPhoto ? newsPhotoFrame : undefined,
              videoOverlay,
              videoFrame: videoOverlay ? videoFrame : undefined,
              videoBackgroundBlur,
              siteLinkPlaceholder,
            }
          : undefined,
      citizen: isCitizenMessage
        ? {
            messageType: citizenMessageType,
            photoFrame:
              citizenMessageType === "photo" ? newsPhotoFrame : undefined,
            videoFrame: citizenMessageType === "video" ? videoFrame : undefined,
          }
        : undefined,
      morningKalam:
        template === "morning_kalam"
          ? {
              todayIndex: Number(toLatinDigits(content.morningKalamTodayIndex)),
              holidayIndexes: morningKalamHolidays.flatMap((holiday, index) =>
                holiday ? [index + 1] : [],
              ),
            }
          : undefined,
      studio:
        templateGroup === "studio"
          ? {
              presenterIds: studioPresenterIds,
              locationId: studioLocationId,
              location: {
                mode: studioLocationMode,
                id: studioLocationId,
                assetIds: ["exact_reference", "faithful_reference"].includes(studioLocationMode) ? studioLocationAssetIds : undefined,
                prompt: studioLocationMode === "generated_prompt" ? studioLocationPrompt.trim() : undefined,
                referenceInstructions: studioLocationMode === "faithful_reference" ? studioLocationReferenceInstructions.trim() : undefined,
              },
              textMode: studioTextMode,
              text: studioText.trim(),
              // Keep the legacy field for old workers and saved projects.
              monitorText: studioMonitorEnabled && studioMonitorMode === "text" ? studioMonitorText.trim() : "",
              monitor: {
                enabled: studioMonitorEnabled,
                mode: studioMonitorEnabled ? studioMonitorMode : "disabled",
                text: studioMonitorEnabled && studioMonitorMode === "text" ? studioMonitorText.trim() : "",
                imageMode: studioMonitorImageMode,
                imageCount: studioMonitorImageCount,
                brief: studioMonitorBrief.trim(),
              },
              titleSpace: {
                enabled: studioTitleSpaceEnabled,
                placement: studioCopySpacePlacement,
                textHint: studioTitleSpaceText.trim(),
              },
              headerEnabled: logoBehavior === "system_header",
              copySpacePlacement: studioCopySpacePlacement,
              expressions: studioExpressions,
              characterInstructions: studioCharacterInstructions,
              speechBubbles: Object.fromEntries(studioPresenterIds.map((id) => [id, (studioSpeechBubbles[id] ?? []).filter((item) => item.trim()).slice(0, 3)])),
              referenceSelection: {
                presenters: Object.fromEntries(studioPresenterIds.map((id) => [id, studioPresenterReferences[id] ?? automaticReferenceChoice()])),
                location: studioLocationReferences,
              } satisfies ReferenceSelection,
            }
          : undefined,
    },
    content: {
      ...normalisedContent,
      publicationCaption: supportsDataCaption ? designCaptionDraft.trim() : "",
      clubShowcase: template === "club_showcase" ? clubShowcase : undefined,
      // These two schemas use specialised fields, yet keeping a meaningful
      // title preserves normal Studio jobs, library cards and restore flows.
      title:
        template === "club_showcase" ? clubShowcase.title.trim() :
        template === "poster"
          ? normalisedContent.posterHeadline
          : template === "sticker"
            ? normalisedContent.stickerText
          : template === "classifieds"
            ? "آگهی نیازمندی‌ها"
            : normalisedContent.title,
    },
    image: {
      mode: selectedImageMode,
      prompt: content.imagePrompt.trim(),
      referenceInstructions: content.referenceInstructions.trim(),
      engine: needsNativeTransparentImage ? "gpt-image-2.5-flare" : imageEngineOverride,
      quality: needsNativeTransparentImage ? "auto" : imageQuality,
      aiEnabled: true,
      aiWritesText: true,
      useAllUploadedImages: selectedImageMode !== "none",
      // On form edits this is compared with the parent job's real file list,
      // so adding/removing a reference image is a meaningful edit by itself.
      referenceManifest: formEditMode
        ? [
            ...(activeJob?.uploadedImages ?? [])
              .filter(
                (item) => !excludedDraftReferences.includes(item.filename),
              )
              .map((item) => item.filename),
            ...files.map((file) => file.name),
          ]
        : undefined,
    },
    advertising: advertisingEnabled ? {
      enabled: true,
      mode: advertisingMode,
      title: advertisingTitle.trim(),
      subtitle: advertisingSubtitle.trim(),
      description: advertisingDescription.trim(),
      contact: advertisingContact.trim(),
    } : { enabled: false },
    assets: {
      headerAssetId: `header-${brand}`,
      presenterAssetIds: templateGroup === "studio" ? studioPresenterIds : undefined,
      studioAssetIds: templateGroup === "studio" ? [studioLocationId] : undefined,
    },
    uploadedImageCount:
      files.length + advertisingFiles.length + puzzleFiles.length + studioMonitorFiles.length + visibleDraftReferences.length,
    production: {
      kind: "image",
      futureVideoDefaults: {
        segmentDurationSec: 8,
        continuity: "locked_brand_and_assets",
      },
    },
    modelProfile: "ai_design_professional",
  };
  const seriesContentForSlide = (slide: DesignSlide, index: number) => {
    const value = (field: keyof ContentSlide) =>
      normaliseContentValue(field, String(slide[field] ?? "").trim());
    const core =
      template === "citizen_message"
        ? {
            citizenMessageText: value("body"),
            citizenHeadline: value("title"),
            citizenResponse: value("subtitle"),
            citizenInteraction: value("footer"),
          }
        : template === "editorial_note"
          ? {
              title: value("title"),
              subtitle: value("subtitle"),
              caption: value("body"),
              source: value("footer"),
              editorialNoteStyle: normalisedContent.editorialNoteStyle,
            }
          : index === 0
            ? {
                kicker: value("kicker"),
                title: value("title"),
                subtitle: value("subtitle"),
                interactionText: "ورق بزنید",
              }
            : {
                title: value("title"),
                subtitle: value("subtitle"),
                caption: value("body"),
                interactionText: value("footer"),
              };
    // Only values entered in this particular card are part of its request.
    // Empty/stale values from the general form cannot reach the prompt.
    return Object.fromEntries(
      Object.entries({
        ...core,
        clubShowcase: template === "club_showcase" ? { ...clubShowcase, title: value("title") || clubShowcase.title } : undefined,
        additionalInstructions: (slide.additionalInstructions ?? "").trim(),
        seriesId: slideSeries?.seriesId,
        seriesSlideIndex: index + 1,
        seriesSlideCount: designSlides.length,
      }).filter(([, item]) => item !== ""),
    );
  };

  function beginDesignUpload(slideId: string, attachments: File[]) {
    const queue = attachments.map((file) => ({
      id: crypto.randomUUID(),
      slideId,
      file,
      loaded: 0,
      total: file.size,
      status: "preparing" as const,
    }));
    setDesignUploadQueue(queue);
    return (progress: {
      loaded: number;
      total: number;
      stage: "uploading" | "securing";
    }) => {
      setDesignUploadQueue((current) =>
        current.map((item) => {
          if (item.slideId !== slideId) return item;
          if (progress.stage === "securing")
            return { ...item, status: "securing", loaded: item.total };
          // Browser multipart upload is one stream.  Distributing its exact
          // total across files gives every row a truthful byte-based progress.
          const transmitted =
            progress.total > 0
              ? Math.max(0, Math.min(1, progress.loaded / progress.total)) *
                attachments.reduce((sum, file) => sum + file.size, 0)
              : 0;
          const before = attachments
            .slice(
              0,
              queue.findIndex((entry) => entry.file === item.file),
            )
            .reduce((sum, file) => sum + file.size, 0);
          return {
            ...item,
            status: "uploading",
            loaded: Math.max(
              0,
              Math.min(item.total, Math.round(transmitted - before)),
            ),
          };
        }),
      );
    };
  }

  function finishDesignUpload(slideId: string, failedMessage = "") {
    setDesignUploadQueue((current) =>
      current.map((item) =>
        item.slideId !== slideId
          ? item
          : failedMessage
            ? { ...item, status: "failed", error: failedMessage }
            : { ...item, status: "completed", loaded: item.total },
      ),
    );
  }

  function chooseImageMode(nextMode: ImageMode) {
    setImageMode(nextMode);
  }

  function chooseTemplateGroup(nextGroup: TemplateGroup) {
    setTemplateGroup(nextGroup);
    chooseTemplate(
      ({ news: "news_story", non_news: "morning_local", studio: "studio" } as const)[nextGroup] ??
        "news_story",
    );
  }

  function chooseTemplate(nextTemplate: string) {
    setTemplate(nextTemplate);
    setDesignCaptionDraft("");
    setDesignCaptionError("");
    setDesignCaptionEditing(false);
    // Every template is now a finished AI design, not a renderer composition.
    if (["morning_local", "morning_kalam", "market"].includes(nextTemplate)) {
      setImageMode("generate");
    }
    if (nextTemplate === "sticker") {
      setCanvas("sticker_1024x1024");
      setImageMode("none");
    } else if (canvas === "sticker_1024x1024") {
      setCanvas("story_1080x1920");
    }
  }

  function chooseCanvas(nextCanvas: Canvas) {
    setCanvas(nextCanvas);
  }

  // A series is a presentation mode of the selected template, never a
  // separate template.  This keeps the header, brand prompt and all the
  // shared design rules identical to a single story/post.
  function chooseSlideSeries(nextCanvas: Canvas) {
    setCanvas(nextCanvas);
    setFormCollapsed(false);
    setFormEditMode(false);
    setSlideSeries(undefined);
    setSlideSeriesOutputs([]);
    setDesignSlides((current) =>
      current.length >= 2
        ? current
        : [
            { id: crypto.randomUUID(), ...emptySlide(), files: [] },
            { id: crypto.randomUUID(), ...emptySlide(), files: [] },
          ],
    );
    setSubmissionError("");
  }

  function setSeriesSlideCount(rawValue: string) {
    const requested = Number.parseInt(rawValue, 10);
    const count = Number.isFinite(requested)
      ? Math.max(2, Math.min(10, requested))
      : 2;
    setDesignSlides((current) => {
      if (current.length === count) return current;
      if (current.length > count) return current.slice(0, count);
      return [
        ...current,
        ...Array.from({ length: count - current.length }, () => ({
          id: crypto.randomUUID(),
          ...emptySlide(),
          files: [],
        })),
      ];
    });
    setSubmissionError("");
  }

  function chooseSingleDesign() {
    setDesignSlides([]);
    setSlideSeries(undefined);
    setSlideSeriesOutputs([]);
    setSubmissionError("");
  }

  function toggleAsset(
    assetId: string,
    current: string[],
    setCurrent: (value: string[]) => void,
  ) {
    setCurrent(
      current.includes(assetId)
        ? current.filter((id) => id !== assetId)
        : [...current, assetId],
    );
  }

  useEffect(() => {
    if (!telegram?.initData) return;
    getAccessSession(telegram?.initData)
      .then((session) => {
        if (session) {
          setAccessState(session.access as typeof accessState);
          if (["owner", "active"].includes(session.access)) {
            manageAccess(telegram?.initData, "list").then((view) => {
              if (view) setAccessView(view);
            });
          }
        }
      })
      .catch(() => setAccessState("unknown"));
  }, [telegram?.initData]);

  useEffect(() => {
    if (!telegram?.initData || !draftId) return;
    getStudioDraft(telegram.initData, draftId)
      .then((result) => {
        const draft = result?.draft;
        if (!draft) return;
        setBrand(draft.brand);
        setTemplateGroup(draft.format.family === "news" ? "news" : draft.format.family === "studio" ? "studio" : "non_news");
        setTemplate(draft.format.template ?? "news_story");
        setClubShowcase(restoreClubShowcase((draft.content as unknown as Record<string, unknown>).clubShowcase));
        setCanvas(draft.format.canvas ?? "story_1080x1920");
        setNewsOutputKind(
          draft.content.titleOnly ? "title_only" : "title_photo_caption",
        );
        setContent((current) => ({
          ...current,
          title: draft.content.title ?? "",
          caption: draft.content.caption ?? "",
          source: draft.content.source ?? "",
        }));
        const count = draft.uploadedImages?.length ?? 0;
        setDraftReferenceNames(
          (draft.uploadedImages ?? []).map((item) => item.filename),
        );
        setExcludedDraftReferences([]);
        if (count) setImageMode("reference");
        setSubmissionError("");
      })
      .catch((error) =>
        setSubmissionError(
          error instanceof Error
            ? error.message
            : "باز کردن پیش‌نویس خبر ناموفق بود.",
        ),
      );
  }, [telegram?.initData, draftId]);

  async function refreshAccess(
    action: "list" | "add" | "approve" | "reject" | "revoke" | "set_contact",
    chatId = "",
    workPhone = "",
  ) {
    try {
      const view = await manageAccess(telegram?.initData, action, chatId, workPhone);
      if (view) setAccessView(view);
      if (action === "add") setChatIdToAdd("");
    } catch {
      setSubmissionState("error");
    }
  }

  async function refreshProjects() {
    try {
      const library = await listProjects(telegram?.initData);
      if (library) setProjects(library.projects);
    } catch {
      setSubmissionState("error");
    }
  }

  async function refreshVideoLibrary() {
    try {
      const result = await listVideoProjects(telegram?.initData);
      setVideoLibraryProjects(result?.projects ?? []);
    } catch (error) {
      setSubmissionError(
        error instanceof Error
          ? error.message
          : "دریافت کتابخانهٔ ویدیو ناموفق بود.",
      );
    }
  }

  async function refreshContentProjects() {
    try {
      const result = await listContentProjects(telegram?.initData);
      if (result) setContentProjects(result.projects);
    } catch (error) {
      setEditorialError(
        error instanceof Error
          ? error.message
          : "فهرست پروژه‌های متنی دریافت نشد.",
      );
    }
  }

  async function openContentProject(
    contentProjectId: string,
    destination?: "editorial" | "publish",
    publicationId?: string,
  ) {
    try {
      const result = await getContentProject(
        telegram?.initData,
        contentProjectId,
      );
      if (!result?.project) throw new Error("پروژهٔ محتوا پیدا نشد.");
      setActiveContentProject(result.project);
      const selectedPublication = publicationId
        ? result.project.publicationRequests?.find(
            (item) => item.publicationId === publicationId,
          )
        : result.project.publicationRequests?.at(-1);
      if (selectedPublication) {
        setPublishResult(selectedPublication);
        const targets =
          selectedPublication.targets ??
          Array.from(
            new Set(selectedPublication.results.map((item) => item.target)),
          );
        setPublishActivityLog(
          targets.map((target) => {
            const targetResult = selectedPublication.results.find(
              (item) => item.target === target,
            );
            return {
              target,
              status: targetResult?.status ?? "pending",
              error: targetResult?.error,
            };
          }),
        );
        const selectedTargets = selectedPublication.targets ?? [];
        setPublishTargets(
          selectedTargets.filter((target): target is PublicationTarget =>
            publishPlatforms.some((platform) =>
              target.startsWith(`${platform.id}_`),
            ),
          ) as PublicationTarget[],
        );
        setVideoPublishTargets(
          selectedTargets.filter(
            (target): target is VideoPlatformTarget =>
              target === "youtube" || target === "aparat",
          ),
        );
        setPublishForwardPlan(selectedPublication.forwardPlan ?? {});
        setPublishDraftText(
          selectedPublication.text ??
            result.project.article?.caption ??
            result.project.article?.body ??
            "",
        );
        setPublishPhotoRequestId(selectedPublication.designRequestId ?? "");
        setPublishMediaIds(selectedPublication.mediaIds ?? []);
        setSiteFeaturedMediaId(selectedPublication.featuredMediaId ?? "");
        setPublishSiteArticle(
          selectedPublication.article ?? result.project.article ?? {},
        );
        setPublishSiteCategoryIds(selectedPublication.categoryIds ?? []);
        setPublishSiteTagIds(selectedPublication.tagIds ?? []);
        setPublishSiteNewTags(selectedPublication.newTags ?? []);
        setPublishSiteCategories(selectedPublication.categoryNames ?? "");
        setPublishSiteTags(
          selectedPublication.tagNames ??
            selectedPublication.newTags?.join("، ") ??
            result.project.article?.tags ??
            "",
        );
        setPublishSiteTarget(selectedPublication.kind === "site");
        setPublishRequestKey(selectedPublication.idempotencyKey);
      } else {
        setPublishResult(undefined);
        setPublishActivityLog([]);
      }
      setPublishNotice("");
      setPublishError("");
      setPublishReviewMode(undefined);
      setPublishUploadQueue([]);
      setEditorialRawText(result.project.rawText ?? "");
      setEditorialArticle(result.project.article ?? {});
      setEditorialSlides(
        (result.project.slides ?? []).map((slide) => ({
          id: crypto.randomUUID(),
          ...slide,
          files: [],
        })),
      );
      const latestReporterRun = result.project.reporterRuns?.at(-1);
      if (latestReporterRun) {
        setReporterProfile(latestReporterRun.profile);
        setReporterOutput(latestReporterRun.text);
        setChannelJoinUrl(latestReporterRun.channelJoinUrl ?? "");
        setEditorialAdditionalInstructions(
          latestReporterRun.additionalInstructions ?? "",
        );
      } else {
        setReporterProfile("site");
        setReporterOutput("");
        setChannelJoinUrl("");
        setEditorialAdditionalInstructions("");
      }
      setReporterOutputEditing(false);
      if (!selectedPublication) {
        setPublishDraftText(result.project.article?.caption ?? "");
        setPublishSiteArticle(result.project.article ?? {});
        setPublishSiteCategories("");
        setPublishSiteTags(result.project.article?.tags ?? "");
        setPublishTargets([]);
        setVideoPublishTargets([]);
        setPublishForwardPlan({});
        setPublishPhotoRequestId("");
        setPublishMediaIds([]);
        setSiteFeaturedMediaId("");
        setPublishSiteTarget(false);
        setPublishSiteCategoryIds([]);
        setPublishSiteTagIds([]);
        setPublishSiteNewTags([]);
        setPublishRequestKey(crypto.randomUUID());
      }
      setEditorialExtractedText(
        result.project.article?.title ? (result.project.rawText ?? "") : "",
      );
      setBrand(result.project.brand);
      setEditorialError("");
      setEditorialNotice(
        `نسخهٔ ${toPersianDigits(String(result.project.revision))} پروژه باز شد.`,
      );
      if (destination) setActiveTab(destination);
    } catch (error) {
      setEditorialError(
        error instanceof Error
          ? error.message
          : "بازکردن پروژهٔ محتوا ناموفق بود.",
      );
    }
  }

  async function refreshPublicationResult() {
    if (!activeContentProject) return;
    setPublishNotice("در حال دریافت دوبارهٔ وضعیت ارسال…");
    await openContentProject(
      activeContentProject.contentProjectId,
      "publish",
      publishResult?.publicationId && !publishResult.publicationId.includes(",")
        ? publishResult.publicationId
        : undefined,
    );
    setPublishNotice("وضعیت ارسال به‌روزرسانی شد.");
  }

  async function enableBrowserPush() {
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setBrowserPushState("unavailable");
      return;
    }
    try {
      const status = await manageBrowserNotifications(telegram?.initData, "status");
      if (!status?.supported || !status.publicKey) {
        setBrowserPushState("unavailable");
        setSubjectError("کلید امن اعلان مرورگر هنوز روی سرور تنظیم نشده است.");
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setBrowserPushState("unavailable"); return; }
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      // The browser can retain a subscription after FCM/WebPush has expired
      // it. The server status is authoritative; recreate the stale browser
      // subscription instead of repeatedly saving a dead endpoint.
      if (subscription && !status.subscribed) {
        await subscription.unsubscribe().catch(() => undefined);
        subscription = null;
      }
      subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: pushKeyBytes(status.publicKey) });
      await manageBrowserNotifications(telegram?.initData, "subscribe", { subscription: subscription.toJSON(), preferences: { clubContent: true, clubMessage: true, designComplete: true, newsSubject: true, instagramAccounts: status.preferences?.instagramAccounts ?? [] } });
      setInstagramPushAccounts(status.preferences?.instagramAccounts ?? []);
      setBrowserPushState("enabled");
    } catch (error) {
      setBrowserPushState("unavailable");
      setSubjectError(error instanceof Error ? error.message : "فعال‌سازی اعلان مرورگر ناموفق بود.");
    }
  }

  async function toggleInstagramBrowserPush(accountId: string) {
    const next = instagramPushAccounts.includes(accountId) ? instagramPushAccounts.filter((id) => id !== accountId) : [...instagramPushAccounts, accountId];
    setInstagramPushAccounts(next);
    try {
      await manageBrowserNotifications(telegram?.initData, "preferences", { preferences: { clubContent: true, clubMessage: true, designComplete: true, newsSubject: true, instagramAccounts: next } });
    } catch (error) {
      setInstagramPushAccounts(instagramPushAccounts);
      setEngagementError(error instanceof Error ? error.message : "ثبت تنظیم اعلان اینستاگرام ناموفق بود.");
    }
  }

  async function toggleSubjectProject(contentProjectId: string) {
    if (subjectOpenId === contentProjectId) {
      setSubjectOpenId("");
      setSubjectReplyTo("");
      return;
    }
    setSubjectError("");
    try {
      const result = await getContentProject(telegram?.initData, contentProjectId);
      if (!result?.project) throw new Error("سوژه پیدا نشد.");
      setActiveContentProject(result.project);
      const previews = await Promise.all((result.project.media ?? []).filter((media) => media.kind === "image").map(async (media) => {
        const blob = await getContentMediaOutput(telegram?.initData, result.project.contentProjectId, media.mediaId);
        return blob ? [media.mediaId, URL.createObjectURL(blob)] as const : undefined;
      }));
      setSubjectMediaUrls((current) => ({ ...current, ...Object.fromEntries(previews.filter((item): item is readonly [string, string] => Boolean(item)) ) }));
      setContentProjects((items) => items.map((item) => item.contentProjectId === contentProjectId ? result.project : item));
      setSubjectOpenId(contentProjectId);
      setSubjectReplyTo("");
    } catch (error) {
      setSubjectError(error instanceof Error ? error.message : "باز کردن سوژه ناموفق بود.");
    }
  }

  async function addSubjectNote(project: ContentProject) {
    const text = subjectNote.trim();
    if (!text) return;
    const mentionIds = accessView.users.filter((person) => text.includes(`@${person.chatId}`) || (person.username && text.includes(`@${person.username}`))).map((person) => person.chatId);
    try {
      const result = await updateContentProject(telegram?.initData, project.contentProjectId, { note: { text, parentNoteId: subjectReplyTo || undefined, mentions: mentionIds } });
      if (!result?.project) return;
      setActiveContentProject(result.project);
      setContentProjects((items) => items.map((item) => item.contentProjectId === project.contentProjectId ? result.project : item));
      setSubjectNote("");
      setSubjectReplyTo("");
    } catch (error) {
      setSubjectError(error instanceof Error ? error.message : "ثبت یادداشت ناموفق بود.");
    }
  }

  async function createManualSubject() {
    if (!manualSubjectTitle.trim() && !manualSubjectText.trim()) return;
    setManualSubjectBusy(true);
    setSubjectError("");
    try {
      const created = await createContentProject(telegram?.initData, { brand, category: "news", rawText: manualSubjectText, article: { title: manualSubjectTitle }, source: { kind: "manual", label: "ثبت دستی سوژه" } });
      if (!created?.project) throw new Error("ثبت سوژهٔ دستی انجام نشد.");
      let project = created.project;
      if (manualSubjectNote.trim()) {
        const noted = await updateContentProject(telegram?.initData, project.contentProjectId, { note: { text: manualSubjectNote.trim() } });
        if (noted?.project) project = noted.project;
      }
      if (manualSubjectFiles.length) {
        for (const file of manualSubjectFiles) {
          const queueId = `${file.name}-${file.lastModified}`;
          setManualSubjectUploadQueue((items) => items.map((item) => item.id === queueId ? { ...item, status: "uploading", loaded: 0 } : item));
          const uploaded = await uploadContentMedia(telegram?.initData, project.contentProjectId, [file], (progress) => setManualSubjectUploadQueue((items) => items.map((item) => item.id !== queueId ? item : { ...item, status: progress.stage === "securing" ? "securing" : "uploading", loaded: progress.stage === "securing" ? item.total : Math.round(item.total * (progress.total ? progress.loaded / progress.total : 0)) })));
          if (!uploaded?.project) throw new Error(`بارگذاری ${file.name} ناموفق بود.`);
          project = uploaded.project;
          setManualSubjectUploadQueue((items) => items.map((item) => item.id === queueId ? { ...item, status: "completed", loaded: item.total } : item));
        }
      }
      setContentProjects((items) => [project, ...items.filter((item) => item.contentProjectId !== project.contentProjectId)]);
      setActiveContentProject(project);
      setSubjectOpenId(project.contentProjectId);
      setManualSubjectOpen(false); setManualSubjectTitle(""); setManualSubjectText(""); setManualSubjectNote(""); setManualSubjectFiles([]);
    } catch (error) {
      setSubjectError(error instanceof Error ? error.message : "ثبت سوژهٔ دستی ناموفق بود.");
    } finally {
      setManualSubjectBusy(false);
    }
  }

  async function deleteSubjectProject(project: ContentProject) {
    if (!window.confirm(`سوژهٔ «${project.title || project.article?.title || "بدون تیتر"}» حذف شود؟ فایل‌های S3 برای بازیابی مدیر نگه‌داری می‌شوند.`)) return;
    try {
      const result = await deleteContentProject(telegram?.initData, project.contentProjectId);
      if (!result) throw new Error("حذف سوژه تأیید نشد.");
      setContentProjects((items) => items.filter((item) => item.contentProjectId !== project.contentProjectId));
      if (subjectOpenId === project.contentProjectId) { setSubjectOpenId(""); setActiveContentProject(undefined); }
    } catch (error) { setSubjectError(error instanceof Error ? error.message : "حذف سوژه ناموفق بود."); }
  }

  async function sendSubjectTeamSms(project: ContentProject) {
    try {
      const result = await sendContentTeamSms(telegram?.initData, project.contentProjectId, subjectSmsRecipientIds, subjectSmsText);
      if (!result) throw new Error("ارسال پیامک پاسخ مشخصی نداشت.");
      setSubjectSmsText(""); setSubjectSmsRecipientIds([]);
      const refreshed = await getContentProject(telegram?.initData, project.contentProjectId);
      if (refreshed?.project) {
        setActiveContentProject(refreshed.project);
        setContentProjects((items) => items.map((item) => item.contentProjectId === project.contentProjectId ? refreshed.project : item));
      }
    } catch (error) {
      setSubjectError(error instanceof Error ? error.message : "ارسال پیامک ناموفق بود.");
    }
  }

  async function saveEditorialProject(forceNew = false): Promise<ContentProject | undefined> {
    setEditorialSaving(true);
    setEditorialError("");
    setEditorialNotice("");
    try {
      const payload = {
        brand,
        rawText: editorialRawText,
        article: editorialArticle,
        slides: editorialSlides.map(
          ({ title, subtitle, body, footer, imageMode }) => ({
            title,
            subtitle,
            body,
            footer,
            imageMode: imageMode ?? "generate",
          }),
        ),
      };
      const result = activeContentProject && !forceNew
        ? await updateContentProject(
            telegram?.initData,
            activeContentProject.contentProjectId,
            payload,
          )
        : await createContentProject(telegram?.initData, payload);
      if (!result?.project) throw new Error("ذخیرهٔ پروژهٔ محتوا انجام نشد.");
      setActiveContentProject(result.project);
      setEditorialRawText(result.project.rawText ?? editorialRawText);
      setEditorialArticle(result.project.article ?? editorialArticle);
      setEditorialSlides(
        (result.project.slides ?? editorialSlides).map((slide) => ({
          id: crypto.randomUUID(),
          ...slide,
          files: [],
        })),
      );
      setPublishSiteArticle(result.project.article ?? editorialArticle);
      setPublishSiteTags(
        result.project.article?.tags ?? editorialArticle.tags ?? "",
      );
      setEditorialExtractedText("");
      setEditorialNotice(
        activeContentProject && !forceNew
          ? "changed" in result && result.changed
            ? "نسخهٔ جدید ذخیره شد."
            : "تغییری برای ذخیره وجود نداشت."
          : "پروژهٔ محتوا ایجاد و ذخیره شد.",
      );
      await refreshContentProjects();
      return result.project;
    } catch (error) {
      setEditorialError(
        error instanceof Error
          ? error.message
          : "ذخیرهٔ پروژهٔ محتوا ناموفق بود.",
      );
      return undefined;
    } finally {
      setEditorialSaving(false);
    }
  }

  async function saveEditorialToArchive() {
    const project = await saveEditorialProject();
    if (!project) return;
    setActiveTab("subjects");
  }

  async function runReporter() {
    if (!editorialRawText.trim()) {
      setEditorialError("ابتدا متن یا پیام خبر را وارد کنید.");
      return;
    }
    if (reporterProfile === "channel_teaser" && !/^https:\/\/(?:t\.me|telegram\.me|www\.telegram\.me)\/.+/i.test(channelJoinUrl.trim())) {
      setEditorialError("برای تیزر عضویت، لینک معتبر HTTPS کانال تلگرام را وارد کنید.");
      return;
    }
    setReporterBusy(true);
    setEditorialError("");
    setReporterOutput("");
    try {
      // The editorial workspace deliberately accepts one raw message.  Before
      // producing any format, extract the structured facts once in the
      // background so later image/site/publish hand-offs use the same facts.
      let project = activeContentProject;
      if (
        !project ||
        project.rawText !== editorialRawText ||
        project.brand !== brand
      ) {
        const payload = {
          brand,
          rawText: editorialRawText,
          article: project?.article ?? editorialArticle,
          slides: editorialSlides.map(
            ({ title, subtitle, body, footer, imageMode }) => ({
              title,
              subtitle,
              body,
              footer,
              imageMode: imageMode ?? "generate",
            }),
          ),
        };
        const saved = project
          ? await updateContentProject(
              telegram?.initData,
              project.contentProjectId,
              payload,
            )
          : await createContentProject(telegram?.initData, payload);
        if (!saved?.project) throw new Error("پروژهٔ خبر ذخیره نشد.");
        project = saved.project;
        setActiveContentProject(project);
      }
      if (editorialExtractedText !== editorialRawText) {
        const extracted = await runContentReporter(
          telegram?.initData,
          project.contentProjectId,
          "extract",
          editorialRawText,
        );
        if (!extracted?.article || !extracted?.project)
          throw new Error("تشخیص خودکار ساختار خبر ناموفق بود.");
        project = extracted.project;
        setEditorialArticle(extracted.article);
        setEditorialExtractedText(editorialRawText);
        setActiveContentProject(project);
      }
      const result = await runContentReporter(
        telegram?.initData,
        project.contentProjectId,
        reporterProfile,
        editorialRawText,
        editorialAdditionalInstructions,
        channelJoinUrl,
        reporterWebResearch,
      );
      if (!result?.text) throw new Error("خروجی Reporter دریافت نشد.");
      setReporterOutput(result.text);
      setReporterUsage(result.usage);
      setEditorialSlides(
        (result.slides ?? []).map((slide) => ({
          id: crypto.randomUUID(),
          ...slide,
          files: [],
        })),
      );
      setActiveContentProject(result.project);
      setEditorialNotice(
        "پیام به‌صورت خودکار تحلیل شد و خروجی انتخاب‌شده به تاریخچهٔ پروژه افزوده شد.",
      );
      await refreshContentProjects();
    } catch (error) {
      setEditorialError(
        error instanceof Error ? error.message : "اجرای Reporter ناموفق بود.",
      );
    } finally {
      setReporterBusy(false);
    }
  }

  function startNewEditorialProject() {
    setActiveContentProject(undefined);
    setEditorialRawText("");
    setEditorialArticle({});
    setEditorialSlides([]);
    setDesignSlides([]);
    setEditorialAdditionalInstructions("");
    setChannelJoinUrl("");
    setEditorialExtractedText("");
    setEditorialError("");
    setEditorialNotice("پروژهٔ متنی جدید آماده است.");
  }

  function sendEditorialToStudio() {
    setBrand(brand);
    const carousel = reporterProfile === "carousel";
    const citizenSeries = reporterProfile === "citizen_multi_story";
    const adminSeries = reporterProfile === "admin_multi_story";
    setTemplateGroup(adminSeries ? "non_news" : "news");
    setCanvas(carousel ? "post_1080x1350" : "story_1080x1920");
    setTemplate(
      citizenSeries
        ? "citizen_message"
        : adminSeries
          ? "editorial_note"
          : carousel
            ? "news_post"
            : "news_story",
    );
    // The article body is useful visual context and determines empty caption
    // space; it must not be hidden among free-form design instructions.
    const series = editorialSlides.map((slide) => ({ ...slide, files: [] }));
    setDesignSlides(series);
    const first = series[0];
    setContent((current) => ({
      ...current,
      kicker: editorialArticle.kicker ?? "",
      title: first?.title || editorialArticle.title || "",
      subtitle: first?.subtitle || editorialArticle.subtitle || "",
      caption:
        first?.body ||
        editorialArticle.body ||
        editorialArticle.caption ||
        editorialRawText,
      interactionText: first?.footer || "",
      source: editorialArticle.source ?? "",
      additionalInstructions:
        editorialAdditionalInstructions || editorialArticle.lead || "",
    }));
    setSubmissionError("");
    setActiveTab("create");
  }

  function reporterImageFields(output: string): {
    kicker: string;
    title: string;
    subtitle: string;
    source: string;
  } {
    const getField = (labels: string[]) => {
      for (const label of labels) {
        const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const match = output.match(
          new RegExp(
            `(?:^|\\n)\\s*(?:[-•*]\\s*)?(?:\\*{1,2})?${escaped}(?:\\*{1,2})?\\s*[:：-]\\s*(.+)`,
            "im",
          ),
        );
        if (match?.[1]?.trim()) return match[1].replace(/\*+/g, "").trim();
      }
      return "";
    };
    const firstUsefulLine =
      output
        .split("\n")
        .map((line) => line.replace(/^\s*(?:[#>*-]+|\d+[.)])\s*/, "").trim())
        .find(
          (line) =>
            line &&
            !/^(روتیتر|تیتر|زیرتیتر|منبع|لید|متن خبر)\s*[:：]/.test(line),
        ) ?? "";
    return {
      kicker: getField(["روتیتر", "کیکر"]),
      title: getField(["تیتر اصلی", "تیتر"]) || firstUsefulLine,
      subtitle: getField(["زیرتیتر"]),
      source: getField(["منبع"]),
    };
  }

  function sendReporterOutputToStudio() {
    if (!reporterOutput) return;
    const fields = reporterImageFields(reporterOutput);
    const isPostOutput = ["post", "carousel"].includes(reporterProfile);
    const citizenSeries = reporterProfile === "citizen_multi_story";
    const adminSeries = reporterProfile === "admin_multi_story";
    setEditorialRawText(reporterOutput);
    setTemplateGroup(adminSeries ? "non_news" : "news");
    setCanvas(isPostOutput ? "post_1080x1350" : "story_1080x1920");
    setTemplate(
      citizenSeries
        ? "citizen_message"
        : adminSeries
          ? "editorial_note"
          : isPostOutput
            ? "news_post"
            : "news_story",
    );
    // The approved Reporter output is the caption context in its entirety;
    // never replace it with only the final extracted caption line.
    const series = editorialSlides.map((slide) => ({ ...slide, files: [] }));
    setDesignSlides(series);
    const first = series[0];
    setContent((current) => ({
      ...current,
      kicker: fields.kicker,
      title: first?.title || fields.title,
      subtitle: first?.subtitle || fields.subtitle,
      caption: first?.body || reporterOutput,
      interactionText: first?.footer || "",
      source: fields.source,
      additionalInstructions: editorialAdditionalInstructions,
    }));
    setReporterOutputEditing(false);
    setActiveTab("create");
  }

  function sendReporterOutputToPublish() {
    if (!reporterOutput) return;
    setPublishDraftText(importedPublishRichText(reporterOutput));
    const articleForSite =
      reporterProfile === "site"
        ? { ...editorialArticle, body: reporterOutput }
        : editorialArticle;
    setPublishSiteArticle(articleForSite);
    setPublishSiteTags(articleForSite.tags ?? "");
    const suffix = publishBrandSuffix[brand];
    setPublishTargets([
      `telegram_${suffix}` as PublicationTarget,
      `eita_${suffix}` as PublicationTarget,
      `rubika_${suffix}` as PublicationTarget,
      `bale_${suffix}` as PublicationTarget,
    ]);
    setPublishResult(undefined);
    setPublishError("");
    setPublishRequestKey(crypto.randomUUID());
    setEditorialNotice(
      "خروجی به پیش‌نویس انتشار سریع منتقل شد؛ پیش از انتشار مقصدها و متن را بررسی کنید.",
    );
    setActiveTab("publish");
  }

  async function sendCompletedDesignToPublish(openPublish = true) {
    if (!activeJob || activeJob.state !== "completed") return;
    setSubmissionError("");
    setPublishMediaBusy(true);
    try {
      const packageData = await getDesignPublicationPackage(
        telegram?.initData,
        activeJob.requestId,
      );
      if (!packageData) throw new Error("کپشن آمادهٔ این طرح دریافت نشد.");
      let project = activeContentProject;
      if (!project) {
        const created = await createContentProject(telegram?.initData, {
          brand: packageData.brand,
          rawText: packageData.caption,
          article: packageData.article,
        });
        if (!created?.project)
          throw new Error("پروژهٔ انتشار برای این طرح ساخته نشد.");
        project = created.project;
      } else {
        const updated = await updateContentProject(
          telegram?.initData,
          project.contentProjectId,
          {
            brand: packageData.brand,
            article: { ...project.article, ...packageData.article },
          },
        );
        if (updated?.project) project = updated.project;
      }
      if (
        !(project.designProjects ?? []).some(
          (design) => design.requestId === activeJob.requestId,
        )
      ) {
        const linked = await attachDesignToContentProject(
          telegram?.initData,
          project.contentProjectId,
          activeJob.requestId,
        );
        if (linked?.project) project = linked.project;
      }
      const imported = await importDesignOutputToContentProject(
        telegram?.initData,
        project.contentProjectId,
        activeJob.requestId,
      );
      if (!imported?.project || !imported.media)
        throw new Error("فایل نهایی تصویر برای انتشار آماده نشد.");
      project = imported.project;
      setActiveContentProject(project);
      setEditorialNotice("تصویر و متن آن در آرشیو محتوا ذخیره شد.");
      if (!openPublish) {
        await refreshContentProjects();
        return;
      }
      setPublishDraftText(importedPublishRichText(packageData.caption));
      setPublishSiteArticle(packageData.article);
      setPublishSiteTags(packageData.article.tags ?? "");
      // Publication always works from the ordinary media tray. This prevents a
      // text-only submission when a completed studio image has just been sent.
      setPublishPhotoRequestId("");
      setPublishMediaIds([imported.media.mediaId]);
      setSiteFeaturedMediaId(
        imported.media.kind === "image" ? imported.media.mediaId : "",
      );
      const suffix = publishBrandSuffix[packageData.brand];
      setPublishTargets([
        `telegram_${suffix}` as PublicationTarget,
        `eita_${suffix}` as PublicationTarget,
        `rubika_${suffix}` as PublicationTarget,
        `bale_${suffix}` as PublicationTarget,
      ]);
      setPublishResult(undefined);
      setPublishError("");
      setPublishRequestKey(crypto.randomUUID());
      await refreshContentProjects();
      setActiveTab("publish");
    } catch (error) {
      setSubmissionError(
        error instanceof Error
          ? error.message
          : "انتقال طرح به بستهٔ انتشار ناموفق بود.",
      );
    } finally {
      setPublishMediaBusy(false);
    }
  }

  function togglePublishTarget(target: PublicationTarget) {
    setPublishTargets((current) =>
      current.includes(target)
        ? current.filter((item) => item !== target)
        : [...current, target],
    );
    setPublishResult(undefined);
    setPublishError("");
    setPublishRequestKey(crypto.randomUUID());
  }
  function setPlatformForwardMode(
    platform: "telegram" | "eita" | "rubika" | "bale",
    mode: "separate" | "forward",
  ) {
    const platformTargets = publishTargets.filter((target) =>
      target.startsWith(`${platform}_`),
    );
    setPublishForwardPlan((current) => ({
      ...current,
      [platform]: {
        mode,
        sourceTarget:
          mode === "forward"
            ? current[platform]?.sourceTarget &&
              platformTargets.includes(current[platform]!.sourceTarget!)
              ? current[platform]?.sourceTarget
              : platformTargets[0]
            : undefined,
      },
    }));
  }
  function setPlatformForwardSource(
    platform: "telegram" | "eita" | "rubika" | "bale",
    sourceTarget: PublicationTarget,
  ) {
    setPublishForwardPlan((current) => ({
      ...current,
      [platform]: { mode: "forward", sourceTarget },
    }));
  }
  function toggleVideoPublishTarget(target: VideoPlatformTarget) {
    setVideoPublishTargets((current) =>
      current.includes(target)
        ? current.filter((item) => item !== target)
        : [...current, target],
    );
    setPublishResult(undefined);
    setPublishError("");
    setPublishRequestKey(crypto.randomUUID());
  }
  async function ensurePublishDraftForMedia(): Promise<
    ContentProject | undefined
  > {
    if (activeContentProject) return activeContentProject;
    const title = publishInternalTitle(publishDraftText);
    if (!title) {
      setPublishError(
        "خط اول متن آمادهٔ انتشار برای تیتر داخلی خالی است.",
      );
      return undefined;
    }
    const visibleText = publishDraftText
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ")
      .trim();
    const result = await createContentProject(telegram?.initData, {
      brand,
      rawText: visibleText || title,
      article: { title, body: visibleText, caption: publishDraftText },
    });
    if (!result?.project) throw new Error("ساخت پیش‌نویس خبر تأیید نشد.");
    setActiveContentProject(result.project);
    setPublishSiteArticle(
      result.project.article ?? {
        title,
        body: visibleText,
        caption: publishDraftText,
      },
    );
    setPublishSiteTags(result.project.article?.tags ?? "");
    await refreshContentProjects();
    return result.project;
  }
  async function addPublishFiles(event: ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!incoming.length) return;
    const queue = incoming.map((file) => ({
      id: crypto.randomUUID(),
      file,
      loaded: 0,
      total: file.size,
      status: "preparing" as const,
    }));
    setPublishUploadQueue(queue);
    setPublishMediaBusy(true);
    setPublishError("");
    try {
      const project = await ensurePublishDraftForMedia();
      if (!project) {
        setPublishUploadQueue((current) =>
          current.map((item) => ({
            ...item,
            status: "failed",
            error: "پیش‌نویس خبر ساخته نشد.",
          })),
        );
        return;
      }
      let lastProject = project;
      let failedCount = 0;
      // A single request per file is intentional. It gives the user an exact
      // progress row and means a failed large video never loses other files in
      // the same selection.
      for (const item of queue) {
        setPublishUploadQueue((current) =>
          current.map((entry) =>
            entry.id === item.id
              ? { ...entry, status: "uploading", loaded: 0 }
              : entry,
          ),
        );
        try {
          const result = await uploadContentMedia(
            telegram?.initData,
            lastProject.contentProjectId,
            [item.file],
            (progress) => {
              setPublishUploadQueue((current) =>
                current.map((entry) => {
                  if (entry.id !== item.id) return entry;
                  if (progress.stage === "securing")
                    return {
                      ...entry,
                      status: "securing",
                      loaded: entry.total,
                    };
                  // XMLHttpRequest reports multipart bytes. Map them to the real
                  // file size so the displayed transferred size remains accurate.
                  const ratio =
                    progress.total > 0
                      ? Math.min(1, progress.loaded / progress.total)
                      : 0;
                  return {
                    ...entry,
                    status: "uploading",
                    loaded: Math.round(entry.total * ratio),
                  };
                }),
              );
            },
          );
          if (!result?.project) throw new Error("فایل روی سرور تأیید نشد.");
          lastProject = result.project;
          setActiveContentProject(result.project);
          setPublishUploadQueue((current) =>
            current.map((entry) =>
              entry.id === item.id
                ? { ...entry, status: "completed", loaded: entry.total }
                : entry,
            ),
          );
        } catch (error) {
          failedCount += 1;
          const message =
            error instanceof Error ? error.message : "بارگذاری ناموفق بود.";
          setPublishUploadQueue((current) =>
            current.map((entry) =>
              entry.id === item.id
                ? { ...entry, status: "failed", error: message }
                : entry,
            ),
          );
        }
      }
      if (failedCount)
        setPublishError(
          `${toPersianDigits(String(failedCount))} فایل بارگذاری نشد. جزئیات هر فایل در فهرست زیر دیده می‌شود.`,
        );
      setPublishResult(undefined);
      setPublishRequestKey(crypto.randomUUID());
      await refreshContentProjects();
    } catch (error) {
      setPublishError(
        error instanceof Error
          ? error.message
          : "افزودن فایل‌های انتشار ناموفق بود.",
      );
    } finally {
      setPublishMediaBusy(false);
    }
  }

  async function previewPublishMedia(media: ContentMedia) {
    if (!activeContentProject) return;
    try {
      const blob = await getContentMediaOutput(
        telegram?.initData,
        activeContentProject.contentProjectId,
        media.mediaId,
      );
      if (!blob) throw new Error("فایل در دسترس نیست.");
      const url = URL.createObjectURL(blob);
      if (media.kind === "video")
        window.open(url, "_blank", "noopener,noreferrer");
      else setPreviewFile({ name: media.filename, url });
    } catch (error) {
      setPublishError(
        error instanceof Error ? error.message : "نمایش فایل ممکن نشد.",
      );
    }
  }

  async function removePublishMedia(media: ContentMedia) {
    if (
      !activeContentProject ||
      !window.confirm(`فایل «${media.filename}» حذف شود؟`)
    )
      return;
    setPublishMediaBusy(true);
    setPublishError("");
    try {
      const result = await deleteContentMedia(
        telegram?.initData,
        activeContentProject.contentProjectId,
        media.mediaId,
      );
      if (!result?.project) throw new Error("حذف فایل تأیید نشد.");
      setActiveContentProject(result.project);
      setPublishMediaIds((current) =>
        current.filter((mediaId) => mediaId !== media.mediaId),
      );
      setPublishResult(undefined);
      setPublishRequestKey(crypto.randomUUID());
      await refreshContentProjects();
    } catch (error) {
      setPublishError(
        error instanceof Error ? error.message : "حذف فایل ناموفق بود.",
      );
    } finally {
      setPublishMediaBusy(false);
    }
  }

  async function compressPublishVideo(media: ContentMedia) {
    if (!activeContentProject) return;
    if (!publishTargets.length) {
      setPublishError(
        "ابتدا دست‌کم یک پیام‌رسان را انتخاب کنید تا کیفیت فشرده‌سازی متناسب با محدودترین مقصد تعیین شود.",
      );
      return;
    }
    setPublishMediaBusy(true);
    setPublishError("");
    try {
      const result = await compressContentVideo(
        telegram?.initData,
        activeContentProject.contentProjectId,
        media.mediaId,
        publishTargets,
      );
      if (!result?.project || !result.media)
        throw new Error("ساخت نسخهٔ فشرده تأیید نشد.");
      setActiveContentProject(result.project);
      if (!result.alreadyCompatible)
        setPublishMediaIds((current) => [
          ...current.filter((mediaId) => mediaId !== media.mediaId),
          result.media.mediaId,
        ]);
      setPublishResult(undefined);
      setPublishRequestKey(crypto.randomUUID());
      await refreshContentProjects();
    } catch (error) {
      setPublishError(
        error instanceof Error ? error.message : "فشرده‌سازی ویدیو ناموفق بود.",
      );
    } finally {
      setPublishMediaBusy(false);
    }
  }

  function startPublicationLog(targets: string[]) {
    setPublishActivityLog(
      Array.from(new Set(targets)).map((target) => ({
        target,
        status: "pending",
      })),
    );
  }
  function applyPublicationLog(result: PublicationResult) {
    setPublishActivityLog((current) => {
      const known = new Map(current.map((item) => [item.target, item]));
      result.results.forEach((item) =>
        known.set(item.target, {
          target: item.target,
          status: item.status,
          error: item.error,
          url: item.url,
        }),
      );
      return Array.from(known.values());
    });
  }

  async function copyPublicationLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setPublishNotice("لینک انتشار کپی شد.");
    } catch {
      setPublishError("کپی لینک در این مرورگر انجام نشد.");
    }
  }

  async function recoverPublicationAfterTransportError(
    contentProjectId: string,
    idempotencyKey: string,
  ): Promise<boolean> {
    // The request may have reached Gateway even if its HTTP response was lost.
    // Read the durable project record before presenting an error to an admin.
    for (const delay of [0, 2500, 5000]) {
      if (delay)
        await new Promise((resolve) => window.setTimeout(resolve, delay));
      try {
        const response = await getContentProject(
          telegram?.initData,
          contentProjectId,
        );
        const publication = response?.project.publicationRequests?.find(
          (item) => item.idempotencyKey === idempotencyKey,
        );
        if (!response || !publication) continue;
        setActiveContentProject(response.project);
        setPublishResult(publication);
        applyPublicationLog(publication);
        if (publication.status !== "processing") return true;
      } catch {
        // Preserve the original transport detail. A later manual refresh also
        // reads this same durable record.
      }
    }
    return false;
  }

  async function runFastPublish(confirmed = false) {
    if (!activeContentProject) {
      setPublishError(
        "این پیش‌نویس باید از یک پروژهٔ ذخیره‌شدهٔ خبر ساخته شود.",
      );
      return;
    }
    if (!publishDraftText.trim()) {
      setPublishError("متن آمادهٔ انتشار را وارد کنید.");
      return;
    }
    if (publishTargets.length === 0) {
      setPublishError("دست‌کم یک مقصد انتشار انتخاب کنید.");
      return;
    }
    if (!confirmed) {
      setPublishReviewMode("text");
      return;
    }
    startPublicationLog(publishTargets);
    setPublishBusy(true);
    setPublishError("");
    setPublishNotice("");
    try {
      const result = await publishContentText(
        telegram?.initData,
        activeContentProject.contentProjectId,
        publishDraftText,
        publishTargets,
        publishRequestKey,
        publishForwardPlan,
      );
      if (!result?.publication) throw new Error("پاسخ انتشار سریع دریافت نشد.");
      setPublishResult(result.publication);
      applyPublicationLog(result.publication);
      setActiveContentProject(result.project);
      setPublishRequestKey(crypto.randomUUID());
      await refreshContentProjects();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "پاسخ انتشار سریع دریافت نشد.";
      const recovered = await recoverPublicationAfterTransportError(
        activeContentProject.contentProjectId,
        publishRequestKey,
      );
      if (!recovered) {
        setPublishResult({
          publicationId: "",
          idempotencyKey: publishRequestKey,
          status: "uncertain",
          results: [],
        });
        setPublishNotice(
          "پاسخ نهایی در مسیر ارتباطی قطع شد؛ وضعیت مقصدها نیازمند بررسی است و خطای قطعی محسوب نمی‌شود.",
        );
        setPublishActivityLog((current) =>
          current.map((item) =>
            item.status === "pending"
              ? { ...item, status: "uncertain", error: message }
              : item,
          ),
        );
      }
    } finally {
      setPublishBusy(false);
    }
  }

  async function runFastPhotoPublish(confirmed = false) {
    if (
      !activeContentProject ||
      (!publishPhotoRequestId && publishMediaIds.length === 0)
    ) {
      setPublishError(
        "حداقل یک تصویر آماده، تصویر یا ویدیوی آپلودشده را برای انتشار انتخاب کنید.",
      );
      return;
    }
    const mediaTargets: MediaPublicationTarget[] = [
      ...publishTargets,
      ...videoPublishTargets,
    ];
    if (mediaTargets.length === 0) {
      setPublishError("دست‌کم یک مقصد انتشار انتخاب کنید.");
      return;
    }
    const selectedVideo = (activeContentProject.media ?? []).some(
      (media) =>
        media.kind === "video" && publishMediaIds.includes(media.mediaId),
    );
    if (videoPublishTargets.length > 0 && !selectedVideo) {
      setPublishError(
        "برای آپارات یا یوتیوب، حداقل یک ویدیوی آپلودشده را انتخاب کنید.",
      );
      return;
    }
    if (!confirmed) {
      setPublishReviewMode("media");
      return;
    }
    startPublicationLog(mediaTargets);
    setPublishBusy(true);
    setPublishError("");
    setPublishNotice("");
    try {
      const result = await publishContentPhoto(
        telegram?.initData,
        activeContentProject.contentProjectId,
        publishPhotoRequestId,
        publishMediaIds,
        publishDraftText,
        mediaTargets,
        publishRequestKey,
        publishForwardPlan,
      );
      if (!result?.publication) throw new Error("پاسخ انتشار فایل دریافت نشد.");
      setPublishResult(result.publication);
      applyPublicationLog(result.publication);
      setActiveContentProject(result.project);
      setPublishRequestKey(crypto.randomUUID());
      await refreshContentProjects();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "پاسخ انتشار فایل دریافت نشد.";
      const recovered = await recoverPublicationAfterTransportError(
        activeContentProject.contentProjectId,
        publishRequestKey,
      );
      if (!recovered) {
        setPublishResult({
          publicationId: "",
          idempotencyKey: publishRequestKey,
          status: "uncertain",
          results: [],
        });
        setPublishNotice(
          "پاسخ نهایی در مسیر ارتباطی قطع شد؛ وضعیت مقصدها نیازمند بررسی است و خطای قطعی محسوب نمی‌شود.",
        );
        setPublishActivityLog((current) =>
          current.map((item) =>
            item.status === "pending"
              ? { ...item, status: "uncertain", error: message }
              : item,
          ),
        );
      }
    } finally {
      setPublishBusy(false);
    }
  }
  async function fillSitePublishFields() {
    if (!activeContentProject) {
      setPublishError("ابتدا پروژهٔ محتوا را ذخیره کنید.");
      return;
    }
    setPublishSiteBusy(true);
    setPublishError("");
    try {
      const result = await getSitePublishSuggestion(
        telegram?.initData,
        activeContentProject.contentProjectId,
        editorialRawText || publishSiteArticle.body || publishDraftText,
      );
      if (!result) throw new Error("پاسخ تکمیل هوشمند سایت دریافت نشد.");
      setPublishSiteArticle(result.article);
      setPublishSiteCategoryIds(result.categories.map((item) => item.id));
      setPublishSiteTags(
        [...result.tags.map((item) => item.name), ...result.newTags].join("، "),
      );
      setPublishSiteCategories(
        result.categories.map((item) => item.name).join("، "),
      );
      setPublishSiteTagIds(result.tags.map((item) => item.id));
      setPublishSiteNewTags(result.newTags);
    } catch (error) {
      setPublishError(
        error instanceof Error
          ? error.message
          : "تکمیل هوشمند سایت ناموفق بود.",
      );
    } finally {
      setPublishSiteBusy(false);
    }
  }
  async function searchSiteTerms(taxonomy: "categories" | "tags") {
    setSiteTermBusy(taxonomy);
    setPublishError("");
    try {
      const result = await getSitePublishTerms(
        telegram?.initData,
        taxonomy,
        siteTermSearch[taxonomy],
      );
      if (!result) throw new Error("فهرست سایت در دسترس نیست.");
      setSiteTermResults((current) => ({
        ...current,
        [taxonomy]: result.items,
      }));
    } catch (error) {
      setPublishError(
        error instanceof Error
          ? error.message
          : "جست‌وجوی فهرست سایت ناموفق بود.",
      );
    } finally {
      setSiteTermBusy("");
    }
  }
  function selectSiteTerm(
    taxonomy: "categories" | "tags",
    item: { id: number; name: string },
  ) {
    if (taxonomy === "categories") {
      if (!publishSiteCategoryIds.includes(item.id))
        setPublishSiteCategoryIds((current) => [...current, item.id]);
      setPublishSiteCategories((current) =>
        Array.from(
          new Set([
            ...current
              .split(/[,،]/)
              .map((value) => value.trim())
              .filter(Boolean),
            item.name,
          ]),
        ).join("، "),
      );
      return;
    }
    if (!publishSiteTagIds.includes(item.id))
      setPublishSiteTagIds((current) => [...current, item.id]);
    setPublishSiteNewTags((current) =>
      current.filter((value) => value !== item.name),
    );
    setPublishSiteTags((current) =>
      Array.from(
        new Set([
          ...current
            .split(/[,،]/)
            .map((value) => value.trim())
            .filter(Boolean),
          item.name,
        ]),
      ).join("، "),
    );
  }
  function addNewSiteTag() {
    const name = siteTermSearch.tags.trim();
    if (!name) return;
    setPublishSiteNewTags((current) =>
      current.includes(name) ? current : [...current, name],
    );
    setPublishSiteTags((current) =>
      Array.from(
        new Set([
          ...current
            .split(/[,،]/)
            .map((value) => value.trim())
            .filter(Boolean),
          name,
        ]),
      ).join("، "),
    );
  }
  async function runSitePublish(confirmed = false) {
    if (
      !activeContentProject ||
      (!publishPhotoRequestId && !siteFeaturedMediaId)
    ) {
      setPublishError(
        "برای انتشار سایت، یک تصویر را به‌عنوان عکس شاخص انتخاب کنید.",
      );
      return;
    }
    if (!publishSiteArticle.title?.trim() || !publishSiteArticle.body?.trim()) {
      setPublishError("تیتر و متن نهایی سایت را وارد کنید.");
      return;
    }
    if (!confirmed) {
      setPublishReviewMode("site");
      return;
    }
    startPublicationLog(["site"]);
    setPublishBusy(true);
    setPublishError("");
    setPublishNotice("");
    try {
      const result = await publishContentSite(
        telegram?.initData,
        activeContentProject.contentProjectId,
        publishPhotoRequestId,
        siteFeaturedMediaId,
        publishSiteArticle,
        publishSiteCategoryIds,
        publishSiteTagIds,
        publishSiteNewTags,
        publishRequestKey,
        (activeContentProject.media ?? []).filter((media) => media.kind === "image" && publishMediaIds.includes(media.mediaId) && media.mediaId !== siteFeaturedMediaId).map((media) => media.mediaId),
        publishSiteCategories,
        publishSiteTags,
      );
      if (!result?.publication) throw new Error("پاسخ انتشار سایت دریافت نشد.");
      setPublishResult(result.publication);
      applyPublicationLog(result.publication);
      setActiveContentProject(result.project);
      setPublishRequestKey(crypto.randomUUID());
      await refreshContentProjects();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "پاسخ انتشار سایت دریافت نشد.";
      const recovered = await recoverPublicationAfterTransportError(
        activeContentProject.contentProjectId,
        publishRequestKey,
      );
      if (!recovered) {
        setPublishResult({
          publicationId: "",
          idempotencyKey: publishRequestKey,
          status: "uncertain",
          results: [],
        });
        setPublishNotice(
          "پاسخ نهایی در مسیر ارتباطی قطع شد؛ وضعیت سایت نیازمند بررسی است و خطای قطعی محسوب نمی‌شود.",
        );
        setPublishActivityLog((current) =>
          current.map((item) => ({
            ...item,
            status: "uncertain",
            error: message,
          })),
        );
      }
    } finally {
      setPublishBusy(false);
    }
  }

  async function runUnifiedPublish(confirmed = false) {
    if (!activeContentProject) {
      setPublishError("ابتدا پروژهٔ محتوا را ذخیره کنید.");
      return;
    }
    const hasMedia = Boolean(publishPhotoRequestId || publishMediaIds.length);
    const mediaTargets: MediaPublicationTarget[] = [
      ...publishTargets,
      ...videoPublishTargets,
    ];
    if (
      !publishSiteTarget &&
      (hasMedia ? mediaTargets.length === 0 : publishTargets.length === 0)
    ) {
      setPublishError("دست‌کم یک مقصد انتشار انتخاب کنید.");
      return;
    }
    if (!publishDraftText.trim()) {
      setPublishError("متن آمادهٔ انتشار را وارد کنید.");
      return;
    }
    const selectedVideo = (activeContentProject.media ?? []).some(
      (media) =>
        media.kind === "video" && publishMediaIds.includes(media.mediaId),
    );
    if (videoPublishTargets.length && !selectedVideo) {
      setPublishError(
        "برای یوتیوب یا آپارات، حداقل یک فایل ویدیو انتخاب کنید.",
      );
      return;
    }
    if (publishSiteTarget && !siteFeaturedMediaId && !publishPhotoRequestId) {
      setPublishError(
        "برای سایت، یک تصویر را با ستارهٔ طلایی به‌عنوان عکس شاخص انتخاب کنید.",
      );
      return;
    }
    if (
      publishSiteTarget &&
      (!publishSiteArticle.title?.trim() || !publishSiteArticle.body?.trim())
    ) {
      setPublishError("فیلدهای تیتر و متن خبر سایت را کامل کنید.");
      return;
    }
    if (!confirmed) {
      setPublishReviewMode("unified");
      return;
    }
    startPublicationLog([
      ...mediaTargets,
      ...(publishSiteTarget ? ["site"] : []),
    ]);
    setPublishBusy(true);
    setPublishError("");
    setPublishNotice("");
    try {
      const responses: PublicationResult[] = [];
      let project = activeContentProject;
      if (hasMedia && mediaTargets.length) {
        const result = await publishContentPhoto(
          telegram?.initData,
          project.contentProjectId,
          publishPhotoRequestId,
          publishMediaIds,
          publishDraftText,
          mediaTargets,
          publishRequestKey,
          publishForwardPlan,
        );
        if (!result?.publication)
          throw new Error("پاسخ انتشار فایل دریافت نشد.");
        responses.push(result.publication);
        applyPublicationLog(result.publication);
        project = result.project;
      } else if (publishTargets.length) {
        const result = await publishContentText(
          telegram?.initData,
          project.contentProjectId,
          publishDraftText,
          publishTargets,
          publishRequestKey,
          publishForwardPlan,
        );
        if (!result?.publication)
          throw new Error("پاسخ انتشار متن دریافت نشد.");
        responses.push(result.publication);
        applyPublicationLog(result.publication);
        project = result.project;
      }
      if (publishSiteTarget) {
        const result = await publishContentSite(
          telegram?.initData,
          project.contentProjectId,
          publishPhotoRequestId,
          siteFeaturedMediaId,
          publishSiteArticle,
          publishSiteCategoryIds,
          publishSiteTagIds,
          publishSiteNewTags,
          publishRequestKey,
          (project.media ?? []).filter((media) => media.kind === "image" && publishMediaIds.includes(media.mediaId) && media.mediaId !== siteFeaturedMediaId).map((media) => media.mediaId),
          publishSiteCategories,
          publishSiteTags,
        );
        if (!result?.publication)
          throw new Error("پاسخ انتشار سایت دریافت نشد.");
        responses.push(result.publication);
        applyPublicationLog(result.publication);
        project = result.project;
      }
      const mergedResults = responses.flatMap((item) => item.results);
      const status = mergedResults.some((item) => item.status === "uncertain")
        ? "uncertain"
        : mergedResults.every((item) => item.status === "published")
          ? "published"
          : mergedResults.some((item) => item.status === "published")
            ? "partial"
            : "failed";
      setPublishResult({
        publicationId: responses.map((item) => item.publicationId).join(","),
        idempotencyKey: publishRequestKey,
        status,
        results: mergedResults,
      });
      setActiveContentProject(project);
      setPublishRequestKey(crypto.randomUUID());
      await refreshContentProjects();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "پاسخ انتشار انتخاب‌شده دریافت نشد.";
      const recovered = await recoverPublicationAfterTransportError(
        activeContentProject.contentProjectId,
        publishRequestKey,
      );
      if (!recovered) {
        setPublishResult({
          publicationId: "",
          idempotencyKey: publishRequestKey,
          status: "uncertain",
          results: [],
        });
        setPublishNotice(
          "پاسخ نهایی در مسیر ارتباطی قطع شد؛ وضعیت مقصدها نیازمند بررسی است و خطای قطعی محسوب نمی‌شود.",
        );
        setPublishActivityLog((current) =>
          current.map((item) =>
            item.status === "pending"
              ? { ...item, status: "uncertain", error: message }
              : item,
          ),
        );
      }
    } finally {
      setPublishBusy(false);
    }
  }
  function editSelectedPublishImage() {
    if (!publishPhotoRequestId) return;
    setActiveJobId(publishPhotoRequestId);
    setFormCollapsed(false);
    setFormEditMode(true);
    setActiveTab("create");
  }

  function startNewDesign() {
    if (activeOutputUrl) URL.revokeObjectURL(activeOutputUrl);
    openedOutputRequestRef.current = "";
    setRequestId(crypto.randomUUID());
    setDraftId("");
    setDraftReferenceNames([]);
    setExcludedDraftReferences([]);
    setPreviewFile(undefined);
    setPromptPreview(undefined);
    setPromptPreviewError("");
    setDesignCaptionDraft("");
    setDesignCaptionError("");
    setDesignCaptionEditing(false);
    setBrand("kalametaze");
    setTemplateGroup("news");
    setCanvas("story_1080x1920");
    setTemplate("news_story");
    setNewsOutputKind("title_photo");
    setNewsLayout("top");
    setNewsPhotoFrame("full");
    setCitizenMessageType("text");
    setVideoOverlay(false);
    setVideoFrame("landscape");
    setSiteLinkPlaceholder(false);
    setImageMode("generate");
    setImageEngineOverride("");
    setImageQuality("medium");
    setImageEnginePickerOpen(false);
    setFiles([]);
    setPuzzleFiles([]);
    setStudioTextMode("monitor");
    setStudioText("");
    setStudioMonitorMode("text");
    setStudioMonitorText("");
    setStudioMonitorImageMode("generate");
    setStudioMonitorImageCount(1);
    setStudioMonitorBrief("");
    setStudioMonitorFiles([]);
    setStudioTitleSpaceEnabled(false);
    setStudioTitleSpaceText("");
    setStudioCopySpacePlacement("auto");
    setMorningKalamHolidays([false, false, false, false, false, false, false]);
    setDesignSlides([]);
    setSlideSeries(undefined);
    slideSeriesOutputs.forEach((item) => URL.revokeObjectURL(item.url));
    setSlideSeriesOutputs([]);
    setContent({ ...initialContent });
    setClubShowcase(emptyClubShowcase());
    showcaseImageNames.current = [];
    setActiveJob(undefined);
    setActiveJobId("");
    setActiveOutputUrl("");
    setEditInstruction("");
    setShowRawAiResponse(false);
    setFormCollapsed(false);
    setFormEditMode(false);
    setJobStartedAt(undefined);
    setElapsedSeconds(0);
    setSubmissionState("idle");
    setSubmissionError("");
    window.localStorage.removeItem("kalam-design-active-job");
    setActiveTab("create");
  }

  async function openProject(requestIdToOpen: string) {
    try {
      const result = await getDesignJob(telegram?.initData, requestIdToOpen);
      if (!result?.job) throw new Error("پروژه پیدا نشد.");
      const selectedJob = result.job;
      const request = recordValue(selectedJob.request);
      const selectedSeries = seriesInfo(request);
      // During a rolling deployment an older gateway may not yet expose the
      // grouping route.  The selected job still opens safely in that window.
      const seriesResult = selectedSeries
        ? await getDesignSeries(
            telegram?.initData,
            selectedJob.requestId,
          ).catch(() => undefined)
        : undefined;
      const seriesJobs = seriesResult?.jobs?.length
        ? seriesResult.jobs
        : [selectedJob];
      const formJob = selectedSeries
        ? (seriesJobs.find(
            (job) => seriesInfo(recordValue(job.request))?.slideIndex === 1,
          ) ?? selectedJob)
        : selectedJob;
      const formRequest = recordValue(formJob.request);
      const format = recordValue(formRequest.format);
      const news = recordValue(format.news);
      const citizen = recordValue(format.citizen);
      const morningKalam = recordValue(format.morningKalam);
      const studio = recordValue(format.studio);
      const image = recordValue(formRequest.image);
      const restoredTemplate = textValue(format.template, "news_story");
      const templateExists = templateDefinitions.some(
        (item) => item.id === restoredTemplate,
      );
      const restoredBrand = textValue(
        formRequest.brand,
        selectedJob.brand,
      ) as Brand;
      const restoredContent = Object.fromEntries(
        Object.keys(initialContent).map((field) => [
          field,
          textValue(
            recordValue(formRequest.content)[field],
            initialContent[field as keyof typeof initialContent],
          ),
        ]),
      ) as typeof initialContent;
      setClubShowcase(restoreClubShowcase(recordValue(formRequest.content).clubShowcase));
      const todayIndex = Number(morningKalam.todayIndex);
      const holidayIndexes = Array.isArray(morningKalam.holidayIndexes)
        ? morningKalam.holidayIndexes.map(Number)
        : [];

      if (activeOutputUrl) URL.revokeObjectURL(activeOutputUrl);
      openedOutputRequestRef.current = selectedJob.requestId;
      slideSeriesOutputs.forEach((item) => URL.revokeObjectURL(item.url));
      setActiveOutputUrl("");
      setEditInstruction("");
      setShowRawAiResponse(false);
      setFiles([]);
      setPuzzleFiles([]);
      setStudioMonitorFiles([]);
      setDesignUploadQueue([]);
      setDraftId(textValue(formRequest.draftId));
      setExcludedDraftReferences(
        Array.isArray(formRequest.draftOmitFilenames)
          ? formRequest.draftOmitFilenames.filter(
              (item): item is string => typeof item === "string",
            )
          : [],
      );
      setDraftReferenceNames([]);
      setBrand(brands[restoredBrand] ? restoredBrand : "kalametaze");
      setTemplate(templateExists ? restoredTemplate : "news_story");
      setTemplateGroup(
        format.family === "fixed"
          ? "non_news"
          : format.family === "studio"
            ? "studio"
          : (templateDefinitions.find((item) => item.id === restoredTemplate)
              ?.group ?? "news"),
      );
      const restoredLogoBehavior = textValue(
        format.logoBehavior,
        studio.headerEnabled ? "system_header" : "floating_profile",
      );
      setLogoBehavior(
        ["system_header", "floating_profile", "none"].includes(restoredLogoBehavior)
          ? restoredLogoBehavior as LogoBehavior
          : "floating_profile",
      );
      if (format.family === "studio") {
        const presenterIds = Array.isArray(studio.presenterIds) ? studio.presenterIds.filter((item): item is string => typeof item === "string" && item in presenterLabels) : ["kamran"];
        setStudioPresenterIds(presenterIds.length ? presenterIds : ["kamran"]);
        setStudioLocationId(typeof studio.locationId === "string" && studio.locationId in locationLabels ? studio.locationId : "newsroom");
        const referenceSelection = recordValue(studio.referenceSelection);
        const presenterReferences = recordValue(referenceSelection.presenters);
        setStudioPresenterReferences(Object.fromEntries(presenterIds.map((id) => [id, normaliseReferenceChoice(presenterReferences[id])])));
        setStudioLocationReferences(normaliseReferenceChoice(referenceSelection.location));
        const restoredLocation = recordValue(studio.location);
        const restoredLocationMode = textValue(restoredLocation.mode, "catalog");
        setStudioLocationMode(["catalog", "generated_prompt", "exact_reference", "faithful_reference"].includes(restoredLocationMode) ? restoredLocationMode as StudioLocationMode : "catalog");
        setStudioLocationAssetIds(Array.isArray(restoredLocation.assetIds) ? restoredLocation.assetIds.filter((item): item is string => typeof item === "string") : []);
        setStudioLocationPrompt(textValue(restoredLocation.prompt));
        setStudioLocationReferenceInstructions(textValue(restoredLocation.referenceInstructions));
        const legacyBlank = String(studio.textMode) === "blank";
        setStudioTextMode(String(studio.textMode) === "designed" ? "designed" : "monitor");
        setStudioText(String(studio.textMode) === "designed" ? textValue(studio.text) : "");
        const monitor = recordValue(studio.monitor);
        setStudioMonitorEnabled(monitor.enabled !== false && monitor.mode !== "disabled");
        setStudioMonitorMode(["text", "images", "blank", "disabled"].includes(String(monitor.mode)) ? monitor.mode as StudioMonitorMode : legacyBlank ? "blank" : "text");
        setStudioMonitorText(textValue(monitor.text) || (!legacyBlank ? textValue(studio.monitorText) : ""));
        setStudioMonitorImageMode(["generate", "reference", "preserve"].includes(String(monitor.imageMode)) ? monitor.imageMode as StudioMonitorImageMode : "generate");
        setStudioMonitorImageCount(Math.max(1, Math.min(4, Number(monitor.imageCount) || 1)));
        setStudioMonitorBrief(textValue(monitor.brief));
        const titleSpace = recordValue(studio.titleSpace);
        setStudioTitleSpaceEnabled(Boolean(titleSpace.enabled) || legacyBlank);
        setStudioTitleSpaceText(textValue(titleSpace.textHint) || (legacyBlank ? textValue(studio.text) : ""));
        const restoredPlacement = textValue(titleSpace.placement, textValue(studio.copySpacePlacement, "auto"));
        setStudioCopySpacePlacement(["auto", "left", "right", "top", "bottom"].includes(restoredPlacement) ? restoredPlacement as StudioCopySpacePlacement : "auto");
        const expressions = recordValue(studio.expressions);
        setStudioExpressions(Object.fromEntries(Object.entries(expressions).filter((entry): entry is [string, string] => typeof entry[1] === "string")));
        const characterInstructions = recordValue(studio.characterInstructions);
        setStudioCharacterInstructions(Object.fromEntries(Object.entries(characterInstructions).filter((entry): entry is [string, string] => typeof entry[1] === "string")));
        const speechBubbles = recordValue(studio.speechBubbles);
        setStudioSpeechBubbles(Object.fromEntries(Object.entries(speechBubbles).map(([id, values]) => [id, Array.isArray(values) ? values.filter((item): item is string => typeof item === "string").slice(0, 3) : []])));
      }
      setCanvas(
        format.canvas === "post_1080x1350"
          ? "post_1080x1350"
          : "story_1080x1920",
      );
      setNewsOutputKind(
        news.outputKind === "title_only" ||
          news.outputKind === "title_photo_caption"
          ? news.outputKind
          : "title_photo",
      );
      setNewsLayout(
        news.layout === "right_column" ||
          news.layout === "center" ||
          news.layout === "bottom"
          ? news.layout
          : "top",
      );
      setNewsPhotoFrame(
        news.photoFrame === "landscape" ||
          news.photoFrame === "square" ||
          news.photoFrame === "portrait_3_4"
          ? news.photoFrame
          : "full",
      );
      setVideoOverlay(Boolean(news.videoOverlay));
      setVideoFrame(
        news.videoFrame === "square" || news.videoFrame === "portrait"
          ? news.videoFrame
          : "landscape",
      );
      setVideoBackgroundBlur(Boolean(news.videoBackgroundBlur));
      setSiteLinkPlaceholder(Boolean(news.siteLinkPlaceholder));
      setCitizenMessageType(
        citizen.messageType === "photo" || citizen.messageType === "video"
          ? citizen.messageType
          : "text",
      );
      setImageMode(imageModeValue(image.mode));
      setImageEngineOverride(
        ["gemini-3.1-flash-image", "gemini-3.1-flash-lite-image", "gpt-image-2", "gpt-image-2.5-flare", "gpt-image-2.5-sunburst"].includes(textValue(image.engine))
          ? textValue(image.engine)
          : "",
      );
      setImageQuality(["low", "medium", "high"].includes(textValue(image.quality)) ? textValue(image.quality) as "low" | "medium" | "high" : "medium");
      setMorningKalamHolidays(
        Array.from({ length: 7 }, (_, index) =>
          holidayIndexes.includes(index + 1),
        ),
      );
      setContent({
        ...restoredContent,
        morningKalamTodayIndex: Number.isFinite(todayIndex)
          ? String(todayIndex)
          : restoredContent.morningKalamTodayIndex,
      });
      setDesignCaptionDraft(textValue(recordValue(formRequest.content).publicationCaption));
      setDesignCaptionError("");
      setDesignCaptionEditing(false);
      setRequestId(textValue(formRequest.requestId, selectedJob.requestId));
      if (selectedSeries) {
        const byIndex = new Map(
          seriesJobs.map((job) => [
            seriesInfo(recordValue(job.request))?.slideIndex,
            job,
          ]),
        );
        const latestDeckRequest = seriesJobs.reduce(
          (latest, job) => {
            const latestAt = latest
              ? Date.parse(latest.updatedAt ?? "")
              : Number.NEGATIVE_INFINITY;
            const jobAt = Date.parse(job.updatedAt ?? "");
            return !latest || jobAt >= latestAt ? job : latest;
          },
          undefined as DesignJob | undefined,
        );
        const savedDeck = Array.isArray(
          recordValue(latestDeckRequest?.request).seriesDeck,
        )
          ? (recordValue(latestDeckRequest?.request).seriesDeck as unknown[])
          : [];
        const slides = Array.from(
          { length: selectedSeries.slideCount },
          (_, index) => {
            const job = byIndex.get(index + 1);
            const savedSlide = savedDeck[index]
              ? slideFromSavedDeck(savedDeck[index])
              : undefined;
            return job
              ? {
                  ...(savedSlide ?? {
                    id: crypto.randomUUID(),
                    ...emptySlide(),
                    files: [],
                  }),
                  ...slideFromDesignJob(job),
                }
              : (savedSlide ?? {
                  id: crypto.randomUUID(),
                  ...emptySlide(),
                  files: [],
                });
          },
        );
        const requestIds = Array.from(
          { length: selectedSeries.slideCount },
          (_, index) => byIndex.get(index + 1)?.requestId,
        );
        setDesignSlides(slides);
        setSlideSeries({
          seriesId: selectedSeries.seriesId,
          mode: selectedSeries.mode,
          currentIndex: selectedSeries.slideIndex - 1,
          requestIds,
        });
        const restoredSeriesOutputs = (
          await Promise.all(
            seriesJobs.map(async (job) => {
              if (job.state !== "completed") return undefined;
              const output = job.outputs.at(-1);
              const index = seriesInfo(recordValue(job.request))?.slideIndex;
              if (!output || !index) return undefined;
              try {
                const file = await getDesignOutput(
                  telegram?.initData,
                  job.requestId,
                  output.filename,
                );
                if (!file) return undefined;
                const noHeaderFilename = latestNoHeaderOutput(job)?.filename;
                return {
                  index: index - 1,
                  requestId: job.requestId,
                  filename: output.filename,
                  url: URL.createObjectURL(file),
                  ...(noHeaderFilename ? { noHeaderFilename } : {}),
                } as SlideSeriesOutput;
              } catch {
                return undefined;
              }
            }),
          )
        ).filter((item): item is SlideSeriesOutput => Boolean(item));
        setSlideSeriesOutputs(restoredSeriesOutputs);
      } else {
        setDesignSlides([]);
        setSlideSeries(undefined);
        setSlideSeriesOutputs([]);
      }
      setActiveJob(selectedJob);
      setActiveJobId(selectedJob.requestId);
      setFormCollapsed(
        selectedSeries ? false : selectedJob.state === "completed",
      );
      setFormEditMode(false);
      setJobStartedAt(Date.now());
      setElapsedSeconds(0);
      setSubmissionState(
        selectedJob.state === "failed"
          ? "error"
          : selectedJob.state === "queued" || selectedJob.state === "processing"
            ? "submitted"
            : "idle",
      );
      setSubmissionError(
        selectedJob.state === "failed"
          ? selectedJob.failureReason ||
              selectedJob.rawError ||
              "ساخت این تصویر ناموفق بوده است."
          : "",
      );
      window.localStorage.setItem(
        "kalam-design-active-job",
        selectedJob.requestId,
      );
      setActiveTab("create");
      const selectedOutput = selectedJob.outputs.at(-1);
      if (selectedJob.state === "completed" && selectedOutput) {
        setOutputLoading(true);
        void getDesignOutput(
          telegram?.initData,
          selectedJob.requestId,
          selectedOutput.filename,
        )
          .then((file) => {
            if (!file) return;
            const url = URL.createObjectURL(file);
            if (openedOutputRequestRef.current === selectedJob.requestId)
              setActiveOutputUrl(url);
            else URL.revokeObjectURL(url);
          })
          .catch((error) => {
            if (openedOutputRequestRef.current === selectedJob.requestId)
              setSubmissionError(
                error instanceof Error
                  ? error.message
                  : "نمایش خروجی پروژه ممکن نشد.",
              );
          })
          .finally(() => {
            if (openedOutputRequestRef.current === selectedJob.requestId)
              setOutputLoading(false);
          });
      }
    } catch (error) {
      setSubmissionError(
        error instanceof Error ? error.message : "بازکردن پروژه انجام نشد.",
      );
    }
  }

  async function refreshPrompts() {
    try {
      const result = await managePrompts(telegram?.initData, "list");
      if (result) setPrompts(result.prompts);
    } catch {
      setSubmissionState("error");
    }
  }

  async function savePrompt() {
    if (!editingPromptId) return;
    try {
      const result = await managePrompts(
        telegram?.initData,
        "update",
        editingPromptId,
        promptDraft,
      );
      if (result) setPrompts(result.prompts);
      setEditingPromptId(undefined);
      setPromptDraft("");
    } catch {
      setSubmissionState("error");
    }
  }

  async function refreshEngagement(sync = false) {
    setEngagementBusy(true);
    setEngagementError("");
    try {
      const accountRequest = manageEngagementAccounts(
        telegram?.initData,
        sync ? "sync" : "list",
        sync ? { connectionId: selectedEngagementConnection } : {},
      );
      // Ordinary refreshes do not need the account response before inbox/rules.
      // Starting all three requests together removes an unnecessary serial
      // wait from the first visit to the Instagram desk.
      // Only request the first page here. Older pages are fetched explicitly
      // by the user, so opening the Instagram desk cannot flood the browser
      // with thousands of media records and thumbnails.
      const inboxRequest = getEngagementInbox(telegram?.initData, engagementFilters, [], "all", 80, 0, engagementTagFilters);
      const rulesRequest = manageEngagementRules(telegram?.initData, "list");
      const showcasesRequest = manageEngagementShowcases(telegram?.initData, "list");
      const tagsRequest = manageEngagementTagCatalog(telegram?.initData, "catalog");
      const salesIntegrationRequest = manageEngagementSalesIntegration(telegram?.initData, "list");
      // Apply each response as soon as it arrives. In particular, a slow
      // BoxAPI account lookup must never keep an already-fetched inbox blank.
      const accountsReady = accountRequest.then((accounts) => {
        if (!accounts) return;
        setEngagementAccounts(accounts.accounts);
        setEngagementConnections(accounts.connections ?? []);
        setEngagementConfigured(accounts.configured);
        if (!selectedEngagementConnection && accounts.connections?.[0])
          setSelectedEngagementConnection(accounts.connections[0].connectionId);
      });
      const inboxReady = inboxRequest.then((inbox) => {
        if (!inbox) return;
        // Refreshing returns only the newest page. Keep any older pages the
        // operator explicitly loaded instead of replacing them.
        mergeEngagementInboxItems(inbox.items, Number(inbox.nextCursor ?? 0));
        setEngagementInboxHasMore(Boolean(inbox.hasMore));
        window.sessionStorage.setItem(
          "kalam-engagement-inbox-cache",
          JSON.stringify(inbox.items.slice(0, 60)),
        );
      });
      const salesReady = salesIntegrationRequest.then((integration) => {
        if (!integration) return;
        setSalesIntegration(integration);
      });
      const rulesReady = rulesRequest.then((rules) => {
        if (rules) setEngagementRules(rules.rules);
      });
      const showcasesReady = showcasesRequest.then((result) => { if (result?.showcases) setEngagementShowcases(result.showcases); });
      const tagsReady = tagsRequest.then((result) => { if (result?.tags) setEngagementTags(result.tags); });
      await Promise.all([accountsReady, inboxReady, rulesReady, salesReady, showcasesReady, tagsReady]);
    } catch (error) {
      setEngagementError(
        error instanceof Error ? error.message : "دریافت اینباکس ناموفق بود.",
      );
    } finally {
      setEngagementBusy(false);
    }
  }

  // The inbox, comments and story replies use one paged event feed.  Several
  // actions receive a fresh first page from the API; merging it here is vital:
  // replacing state would make already loaded history visibly disappear.
  function mergeEngagementInboxItems(items: EngagementInboxItem[], nextCursor?: number) {
    setEngagementInbox((current) =>
      Array.from(new Map([...current, ...items].map((item) => [item.eventId, item])).values())
        .sort((left, right) => right.receivedAt - left.receivedAt),
    );
    if (nextCursor) {
      setEngagementInboxCursor((current) => current ? Math.min(current, nextCursor) : nextCursor);
    }
  }

  async function loadEngagementThread(eventId: string, kind: "conversation" | "post") {
    if (!eventId) return;
    setEngagementBusy(true);
    setEngagementError("");
    try {
      let before = 0;
      // A detail view is allowed to read its whole history, but stays paged on
      // the wire so one large post/conversation cannot freeze a phone.
      for (let pageNumber = 0; pageNumber < 100; pageNumber += 1) {
        const page = await getEngagementThread(telegram?.initData, eventId, kind, 200, before);
        if (!page) break;
        mergeEngagementInboxItems(page.items, Number(page.nextCursor ?? 0));
        if (!page.hasMore || !page.nextCursor) break;
        before = Number(page.nextCursor);
      }
    } catch (error) {
      setEngagementError(error instanceof Error ? error.message : "دریافت تاریخچهٔ کامل ناموفق بود.");
    } finally {
      setEngagementBusy(false);
    }
  }

  async function loadMoreEngagementInbox() {
    if (engagementInboxLoadingMore || !engagementInboxHasMore || !engagementInboxCursor) return;
    setEngagementInboxLoadingMore(true);
    try {
      const page = await getEngagementInbox(telegram?.initData, engagementFilters, [], "all", 80, engagementInboxCursor, engagementTagFilters);
      if (!page) return;
      mergeEngagementInboxItems(page.items, Number(page.nextCursor ?? 0));
      setEngagementInboxHasMore(Boolean(page.hasMore));
    } catch (error) {
      setEngagementError(error instanceof Error ? error.message : "دریافت پیام‌های قدیمی‌تر ناموفق بود.");
    } finally {
      setEngagementInboxLoadingMore(false);
    }
  }

  async function refreshEngagementKnowledge() {
    try {
      const result = await manageEngagementKnowledge(
        telegram?.initData,
        "list",
      );
      if (result) {
        setEngagementKnowledge(result.knowledge);
        setEngagementSiteArticles(result.siteCache.articles ?? []);
        if (result.personas?.personas) setEngagementPersonas(result.personas.personas);
      }
    } catch (error) {
      setEngagementError(
        error instanceof Error
          ? error.message
          : "دریافت دانش پاسخ‌گویی ناموفق بود.",
      );
    }
  }

  async function saveEngagementKnowledge(syncSite = false) {
    setEngagementKnowledgeBusy(true);
    setEngagementError("");
    try {
      const save = await manageEngagementKnowledge(
        telegram?.initData,
        "save",
        engagementKnowledge,
      );
      if (save) {
        setEngagementKnowledge(save.knowledge);
        setEngagementSiteArticles(save.siteCache.articles ?? []);
      }
      if (syncSite) {
        const synced = await manageEngagementKnowledge(
          telegram?.initData,
          "sync-site",
        );
        if (synced) {
          setEngagementKnowledge(synced.knowledge);
          setEngagementSiteArticles(synced.siteCache.articles ?? []);
        }
      }
    } catch (error) {
      setEngagementError(
        error instanceof Error
          ? error.message
          : "ذخیرهٔ دانش پاسخ‌گویی ناموفق بود.",
      );
    } finally {
      setEngagementKnowledgeBusy(false);
    }
  }

  async function suggestEngagementReply(instruction = "به این گفتگو با توجه به اطلاعاتی که از رسانه کلام تازه داری، ادامه بده.", character: "none" | "kamran" | "tara" = "none") {
    if (!selectedInboxEventId) return;
    setEngagementReplyBusy(true);
    setEngagementError("");
    try {
      const result = await getEngagementAiSuggestion(
        telegram?.initData,
        selectedInboxEventId,
        instruction,
        character,
      );
      if (result) {
        setEngagementReplyText(result.suggestion);
        setEngagementInbox((current) =>
          current.map((item) =>
            item.eventId === result.eventId
              ? { ...item, aiSuggestion: result.suggestion }
              : item,
          ),
        );
      }
    } catch (error) {
      setEngagementError(
        error instanceof Error ? error.message : "ساخت پیشنهاد AI ناموفق بود.",
      );
    } finally {
      setEngagementReplyBusy(false);
    }
  }

  async function openBoxConnect() {
    // Browsers only permit a new tab when it is created synchronously from the
    // click.  Keep this placeholder while the server obtains the OAuth URL.
    const popup = telegram?.openLink
      ? null
      : window.open("about:blank", "_blank", "noopener,noreferrer");
    setEngagementBusy(true);
    setEngagementError("");
    try {
      if (!selectedEngagementConnection)
        throw new Error("ابتدا اتصال BoxAPI را انتخاب کنید.");
      const result = await manageEngagementAccounts(
        telegram?.initData,
        "connect-url",
        { connectionId: selectedEngagementConnection },
      );
      if (!result?.connectUrl)
        throw new Error(
          "لینک اتصال BoxAPI دریافت نشد. ابتدا کلید API را در سرور ثبت کنید.",
        );
      if (telegram?.openLink) telegram.openLink(result.connectUrl);
      else if (popup) popup.location.replace(result.connectUrl);
      else window.location.assign(result.connectUrl);
    } catch (error) {
      popup?.close();
      setEngagementError(
        error instanceof Error
          ? error.message
          : "بازکردن اتصال حساب ناموفق بود.",
      );
    } finally {
      setEngagementBusy(false);
    }
  }

  async function createStarterEngagementRule() {
    setEditingEngagementRule({
      ruleId: "",
      name: "قانون پاسخ‌گویی جدید",
      enabled: false,
      accountIds: engagementFilters,
      eventTypes: ["messaging"],
      match: { mode: "contains", text: "" },
      action: { mode: "auto_reply", text: "", character: "none" },
      actions: [{ mode: "auto_reply", text: "", character: "none" }],
      priority: 100,
      cooldownSeconds: 0,
    });
  }

  async function saveEngagementConnection() {
    setEngagementBusy(true);
    setEngagementError("");
    try {
      const result = await manageEngagementAccounts(
        telegram?.initData,
        "save-connection",
        {
          name: connectionName,
          apiKey: connectionApiKey,
          baseUrl: connectionBaseUrl,
        },
      );
      if (!result) return;
      setEngagementConnections(result.connections);
      setEngagementAccounts(result.accounts);
      setEngagementConfigured(result.configured);
      setConnectionName("");
      setConnectionApiKey("");
      if (result.connections.at(-1))
        setSelectedEngagementConnection(
          result.connections.at(-1)?.connectionId ?? "",
        );
    } catch (error) {
      setEngagementError(
        error instanceof Error ? error.message : "ذخیرهٔ اتصال ناموفق بود.",
      );
    } finally {
      setEngagementBusy(false);
    }
  }

  async function deleteEngagementConnection(connectionId: string) {
    if (
      !window.confirm(
        "این اتصال و فهرست حساب‌های زیرمجموعه‌اش حذف شود؟ کلید فقط از سرور پاک می‌شود.",
      )
    )
      return;
    setEngagementBusy(true);
    setEngagementError("");
    try {
      const result = await manageEngagementAccounts(
        telegram?.initData,
        "delete-connection",
        { connectionId },
      );
      if (!result) return;
      setEngagementConnections(result.connections);
      setEngagementAccounts(result.accounts);
      setSelectedEngagementConnection((current) =>
        current === connectionId
          ? (result.connections[0]?.connectionId ?? "")
          : current,
      );
    } catch (error) {
      setEngagementError(
        error instanceof Error ? error.message : "حذف اتصال ناموفق بود.",
      );
    } finally {
      setEngagementBusy(false);
    }
  }

  async function saveEngagementRule() {
    if (!editingEngagementRule) return;
    try {
      const actions = (editingEngagementRule.actions?.length
        ? editingEngagementRule.actions
        : [editingEngagementRule.action]
      ).filter((action) => action.mode && !["approval", "ai_suggestion"].includes(action.mode) && (action.text.trim() || (action.attachments?.length ?? 0) > 0 || (action.showcaseCards?.length ?? 0) > 0 || ["tag_admin", "conversation_tag"].includes(action.mode)));
      if (!actions.length) throw new Error("حداقل یک اقدام معتبر برای قانون وارد کنید.");
      const result = await manageEngagementRules(
        telegram?.initData,
        "save",
        { ...editingEngagementRule, action: actions[0], actions },
      );
      if (result) {
        setEngagementRules(result.rules);
        setEditingEngagementRule(undefined);
      }
    } catch (error) {
      setEngagementError(
        error instanceof Error ? error.message : "ذخیرهٔ قانون ناموفق بود.",
      );
    }
  }

  async function replyToEngagementMessage(
    eventId = selectedInboxEventId,
    text = engagementReplyText,
  ) {
    if (!eventId || !text.trim()) return;
    setEngagementReplyBusy(true);
    setEngagementError("");
    try {
      const result = await replyEngagementInbox(
        telegram?.initData,
        eventId,
        text.trim(),
      );
      if (!result) return;
      setEngagementInbox((current) =>
        current
          .map((item) =>
            item.eventId === result.source.eventId ? result.source : item,
          )
          .concat(result.item),
      );
      setEngagementReplyText("");
    } catch (error) {
      setEngagementError(
        error instanceof Error ? error.message : "ارسال پاسخ ناموفق بود.",
      );
    } finally {
      setEngagementReplyBusy(false);
    }
  }

  async function bulkReplyToEngagementComments(
    eventIds: string[],
    mode:
      | "thanks"
      | "emoji_thanks"
      | "emoji_laugh"
      | "emoji_sad"
      | "emoji_think"
      | "ai",
    instruction: string,
    answers?: EngagementBulkAnswer[],
  ) {
    setEngagementReplyBusy(true);
    setEngagementError("");
    try {
      const result = await bulkReplyEngagementComments(telegram?.initData, {
        action: answers ? "send" : "prepare",
        eventIds,
        mode,
        instruction,
        answers,
      });
      if (!result) return undefined;
      if (!answers) return result.answers ?? [];
      // Re-read the authoritative history so status, outgoing reply and any
      // provider-side enrichment stay in the same post thread.
      const inbox = await getEngagementInbox(
        telegram?.initData,
        engagementFilters,
      );
      if (inbox) mergeEngagementInboxItems(inbox.items, Number(inbox.nextCursor ?? 0));
      if (result.failed?.length)
        setEngagementError(
          `${toPersianDigits(String(result.sent?.length ?? 0))} پاسخ ارسال شد؛ ${toPersianDigits(String(result.failed.length))} مورد ناموفق بود.`,
        );
      // The non-empty result is a concrete acknowledgement for the modal.
      // It prevents a WebView render from treating a successful send as an
      // untouched first step and reopening the emoji/mode chooser.
      return answers;
    } catch (error) {
      setEngagementError(
        error instanceof Error ? error.message : "پاسخ‌گویی گروهی ناموفق بود.",
      );
      return undefined;
    } finally {
      setEngagementReplyBusy(false);
    }
  }

  async function prepareEngagementLead() {
    if (!selectedInboxEventId) return;
    setLeadDraftBusy(true);
    setLeadDraftNotice("");
    setEngagementError("");
    try {
      const result = await getEngagementLeadDraft(telegram?.initData, selectedInboxEventId);
      if (result?.draft) {
        setLeadDraft(result.draft);
        setLeadDraftEventId(selectedInboxEventId);
      }
    } catch (error) {
      setEngagementError(error instanceof Error ? error.message : "تحلیل گفتگو برای ساخت لید ناموفق بود.");
    } finally {
      setLeadDraftBusy(false);
    }
  }

  async function saveEngagementLead() {
    if (!leadDraft || !leadDraftEventId) return;
    setLeadDraftSaving(true);
    setLeadDraftNotice("");
    try {
      const result = await createEngagementLead(telegram?.initData, leadDraftEventId, leadDraft);
      if (result?.leadId) {
        setLeadDraftNotice(`لید با شناسهٔ ${result.leadId} ثبت شد.`);
        setLeadDraft(undefined);
        setLeadDraftEventId("");
      }
    } catch (error) {
      setEngagementError(error instanceof Error ? error.message : "ثبت لید ناموفق بود.");
    } finally {
      setLeadDraftSaving(false);
    }
  }

  async function saveSalesIntegration(testOnly = false) {
    setEngagementBusy(true);
    setEngagementError("");
    try {
      const result = await manageEngagementSalesIntegration(
        telegram?.initData,
        testOnly ? "test" : "save",
        testOnly ? {} : { apiToken: salesApiToken, enabled: true },
      );
      if (!result) return;
      setSalesIntegration(result);
      if (!testOnly) setSalesApiToken("");
    } catch (error) {
      setEngagementError(error instanceof Error ? error.message : "ذخیرهٔ اتصال تازه‌سیستم ناموفق بود.");
    } finally {
      setEngagementBusy(false);
    }
  }

  async function optimizeEngagementKnowledge() {
    setEngagementKnowledgeBusy(true);
    setEngagementError("");
    try {
      const result = await manageEngagementKnowledge(telegram?.initData, "optimize", engagementKnowledge);
      if (result) { setEngagementKnowledge(result.knowledge); setEngagementSiteArticles(result.siteCache.articles ?? []); }
    } catch (error) {
      setEngagementError(error instanceof Error ? error.message : "بهینه‌سازی دانش AI ناموفق بود.");
    } finally { setEngagementKnowledgeBusy(false); }
  }

  async function sendBulkEngagementConversations(
    eventIds: string[],
    text: string,
  ) {
    setEngagementReplyBusy(true);
    setEngagementError("");
    try {
      const result = await sendBulkEngagementMessages(
        telegram?.initData,
        eventIds,
        text,
      );
      if (!result) return false;
      await refreshEngagement();
      if (result.failed.length) {
        setEngagementError(
          `${toPersianDigits(String(result.sent.length))} پیام ارسال شد؛ ${toPersianDigits(String(result.failed.length))} مورد ناموفق بود.`,
        );
      }
      return result.sent.length > 0;
    } catch (error) {
      setEngagementError(
        error instanceof Error ? error.message : "ارسال گروهی پیام ناموفق بود.",
      );
      return false;
    } finally {
      setEngagementReplyBusy(false);
    }
  }

  async function saveEngagementStoryContext(story: EngagementInboxItem, context: string) {
    if (!story.mediaId) {
      setEngagementError("شناسهٔ استوری برای ذخیرهٔ توضیح موجود نیست.");
      return false;
    }
    setEngagementReplyBusy(true);
    setEngagementError("");
    try {
      const result = await setEngagementStoryContext(telegram?.initData, story.accountId, story.mediaId, context.trim());
      if (!result) return false;
      setEngagementInbox((current) => current.map((item) =>
        engagementAccountMatches(item.accountId, story.accountId) && item.mediaId === story.mediaId
          ? { ...item, storyContext: result.context }
          : item,
      ));
      return true;
    } catch (error) {
      setEngagementError(error instanceof Error ? error.message : "ذخیرهٔ توضیحات استوری ناموفق بود.");
      return false;
    } finally {
      setEngagementReplyBusy(false);
    }
  }

  async function addEngagementRuleAttachments(actionIndex: number, files: File[]) {
    if (!editingEngagementRule || !files.length) return;
    const accountId = editingEngagementRule.scope?.accountId ?? editingEngagementRule.accountIds[0];
    if (!accountId) {
      setEngagementError("برای فایل همراه، ابتدا یک حساب اینستاگرام را در دامنهٔ قانون انتخاب کنید.");
      return;
    }
    setEngagementBusy(true);
    setEngagementError("");
    try {
      const uploaded: NonNullable<EngagementRule["action"]["attachments"]> = [];
      for (const file of files.slice(0, 5)) {
        const uploadId = `${actionIndex}:${file.name}:${file.lastModified}:${crypto.randomUUID()}`;
        setRuleAttachmentUploads((current) => [...current, { id: uploadId, file, loaded: 0, total: file.size, status: "uploading" }]);
        const result = await uploadEngagementRuleAttachment(telegram?.initData, accountId, file, (loaded, total) => setRuleAttachmentUploads((current) => current.map((item) => item.id === uploadId ? { ...item, loaded, total, status: "uploading" } : item)));
        setRuleAttachmentUploads((current) => current.map((item) => item.id === uploadId ? { ...item, loaded: file.size, total: file.size, status: "completed" } : item));
        if (result?.attachment) uploaded.push(result.attachment);
      }
      const actions = editingEngagementRule.actions?.length ? editingEngagementRule.actions : [editingEngagementRule.action];
      const next = actions.map((action, index) => index === actionIndex ? { ...action, attachments: [...(action.attachments ?? []), ...uploaded].slice(0, 5) } : action);
      setEditingEngagementRule({ ...editingEngagementRule, action: next[0], actions: next });
    } catch (error) {
      setRuleAttachmentUploads((current) => current.map((item) => item.status === "uploading" ? { ...item, status: "failed", error: error instanceof Error ? error.message : "بارگذاری ناموفق بود." } : item));
      setEngagementError(error instanceof Error ? error.message : "بارگذاری فایل همراه ناموفق بود.");
    } finally {
      setEngagementBusy(false);
    }
  }

  async function uploadShowcaseCardImage(cardIndex: number, file: File) {
    if (!editingShowcase) return;
    const accountId = editingEngagementRule?.scope?.accountId ?? engagementAccounts[0]?.id;
    if (!accountId) { setEngagementError("ابتدا یک حساب اینستاگرام را همگام کنید."); return; }
    setEngagementBusy(true); setEngagementError("");
    try {
      const result = await uploadEngagementRuleAttachment(telegram?.initData, accountId, file, () => undefined);
      if (result?.attachment) {
        const cards = editingShowcase.cards.map((card, index) => index === cardIndex ? { ...card, image: { ...result.attachment!, kind: "image" as const } } : card);
        setEditingShowcase({ ...editingShowcase, cards });
      }
    } catch (error) { setEngagementError(error instanceof Error ? error.message : "بارگذاری تصویر کارت ناموفق بود."); }
    finally { setEngagementBusy(false); }
  }

  async function saveShowcaseEditor() {
    if (!editingShowcase) return;
    setEngagementBusy(true); setEngagementError("");
    try {
      const result = await manageEngagementShowcases(telegram?.initData, "save", editingShowcase);
      if (result?.showcases) setEngagementShowcases(result.showcases);
      setEditingShowcase(undefined);
    } catch (error) { setEngagementError(error instanceof Error ? error.message : "ذخیرهٔ ویترین ناموفق بود."); }
    finally { setEngagementBusy(false); }
  }

  async function sendSelectedShowcase(showcaseId: string) {
    if (!selectedInboxEventId) return;
    setEngagementReplyBusy(true); setEngagementError("");
    try {
      const result = await manageEngagementShowcases(telegram?.initData, "send", { showcaseId } as Partial<EngagementShowcase>, selectedInboxEventId);
      if (result?.item) setEngagementInbox((current) => [...current, result.item!]);
    } catch (error) { setEngagementError(error instanceof Error ? error.message : "ارسال ویترین ناموفق بود."); }
    finally { setEngagementReplyBusy(false); }
  }

  async function saveEngagementPersonas() {
    setEngagementKnowledgeBusy(true);
    setEngagementError("");
    try {
      const result = await manageEngagementPersonas(telegram?.initData, "save", engagementPersonas);
      if (result) setEngagementPersonas(result.personas);
    } catch (error) {
      setEngagementError(error instanceof Error ? error.message : "ذخیرهٔ شخصیت‌ها ناموفق بود.");
    } finally {
      setEngagementKnowledgeBusy(false);
    }
  }

  async function markEngagementConversationRead(eventId: string) {
    const selected = engagementInbox.find((item) => item.eventId === eventId);
    if (!selected) return;
    const eventIds = engagementInbox
      .filter(
        (item) =>
          item.accountId === selected.accountId &&
          item.senderId === selected.senderId &&
          item.direction !== "outgoing" &&
          item.status === "new",
      )
      .map((item) => item.eventId);
    if (!eventIds.length) return;
    setEngagementInbox((items) =>
      items.map((item) =>
        eventIds.includes(item.eventId) ? { ...item, status: "read" } : item,
      ),
    );
    try {
      await markEngagementRead(telegram?.initData, eventIds);
    } catch {
      // The local state is already correct; the next refresh retries the sync.
    }
  }

  async function refreshImageModelSettings() {
    try {
      const result = await manageImageModel(telegram?.initData, "get");
      if (result) setImageModelSettings(result);
    } catch {
      setSubmissionState("error");
    }
  }

  async function saveImageModel(defaultModel: string) {
    setImageModelSaving(true);
    try {
      const result = await manageImageModel(telegram?.initData, "save", defaultModel);
      if (result) setImageModelSettings(result);
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : "ذخیرهٔ مدل تصویر ناموفق بود.");
    } finally {
      setImageModelSaving(false);
    }
  }

  async function refreshTextModelSettings() {
    try {
      const result = await manageTextModels(telegram?.initData, "get");
      if (result) setTextModelSettings(result);
    } catch {
      setSubmissionState("error");
    }
  }

  async function saveTextModels(editorialModel: string, replyModel: string, analysisModel: string, videoPromptModel = textModelSettings?.videoPromptModel ?? "") {
    setTextModelSaving(true);
    try {
      const result = await manageTextModels(telegram?.initData, "save", editorialModel, replyModel, analysisModel, videoPromptModel);
      if (result) setTextModelSettings(result);
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : "ذخیرهٔ مدل‌های متنی ناموفق بود.");
    } finally {
      setTextModelSaving(false);
    }
  }

  async function refreshVoiceModelSettings() {
    try {
      const result = await manageVoiceModels(telegram?.initData, "get");
      if (result) setVoiceModelSettings(result);
    } catch {
      setSubmissionState("error");
    }
  }

  async function saveVoiceModels(defaultVoiceEngine: string, defaultVoice: string) {
    setVoiceModelSaving(true);
    try {
      const result = await manageVoiceModels(telegram?.initData, "save", defaultVoiceEngine, defaultVoice);
      if (result) setVoiceModelSettings(result);
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : "ذخیرهٔ موتور صوتی ناموفق بود.");
    } finally {
      setVoiceModelSaving(false);
    }
  }

  async function refreshTranscriptionModelSettings() {
    try {
      const result = await manageTranscriptionModels(telegram?.initData, "get");
      if (result) setTranscriptionModelSettings(result);
    } catch {
      setSubmissionState("error");
    }
  }

  async function saveTranscriptionModel(defaultTranscriptionModel: string) {
    setTranscriptionModelSaving(true);
    try {
      const result = await manageTranscriptionModels(telegram?.initData, "save", defaultTranscriptionModel);
      if (result) setTranscriptionModelSettings(result);
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : "ذخیرهٔ مدل تبدیل صوت ناموفق بود.");
    } finally { setTranscriptionModelSaving(false); }
  }

  async function addEditorialAudio(files: File[]) {
    if (!files.length) return;
    const project = await saveEditorialProject();
    if (!project) return;
    const model = transcriptionModelSettings?.defaultTranscriptionModel;
    if (!model) { setEditorialError("مدل تبدیل صوت هنوز آماده نیست."); return; }
    setEditorialAudioBusy(true); setEditorialAudioProgress(undefined); setEditorialError("");
    try {
      const result = await startAudioTranscription(telegram?.initData, project.contentProjectId, model, files, setEditorialAudioProgress);
      if (!result) throw new Error("کار تبدیل صوت ثبت نشد.");
      setEditorialTranscriptionJobs((current) => [result.job, ...current]);
      setActiveContentProject(result.project);
      setEditorialNotice("فایل صوتی ایمن ذخیره شد؛ پیاده‌سازی در پس‌زمینه ادامه دارد.");
    } catch (error) { setEditorialError(error instanceof Error ? error.message : "ارسال فایل صوتی ناموفق بود."); }
    finally { setEditorialAudioBusy(false); setEditorialAudioProgress(undefined); }
  }

  async function saveEngagementToArchive(eventId: string) {
    setEngagementReplyBusy(true);
    setEngagementError("");
    try {
      const result = await archiveEngagementContent(
        telegram?.initData,
        eventId,
        "citizen",
      );
      if (!result?.project)
        throw new Error("ذخیره‌سازی پیام در آرشیو انجام نشد.");
      setActiveContentProject(result.project);
      setContentProjects((items) => [
        result.project,
        ...items.filter(
          (item) => item.contentProjectId !== result.project.contentProjectId,
        ),
      ]);
      setSubjectNotice(result.duplicate ? "این پیام پیش‌تر در سوژه خبری ذخیره شده بود." : "پیام با موفقیت در سوژه خبری ذخیره شد.");
      setActiveTab("subjects");
    } catch (error) {
      setSubjectError(error instanceof Error ? error.message : "ذخیره‌سازی پیام در سوژه خبری ناموفق بود.");
      setEngagementError(
        error instanceof Error
          ? error.message
          : "ذخیره‌سازی پیام در آرشیو ناموفق بود.",
      );
    } finally {
      setEngagementReplyBusy(false);
    }
  }

  async function saveEngagementManyToArchive(eventIds: string[]) {
    const distinctIds = Array.from(new Set(eventIds)).filter(Boolean);
    if (!distinctIds.length) return;
    setEngagementReplyBusy(true);
    setEngagementError("");
    try {
      const result = await archiveEngagementContent(telegram?.initData, distinctIds, "citizen");
      if (!result?.project)
        throw new Error("ذخیره‌سازی گروهی انجام نشد.");
      const projects = [result.project];
      setActiveContentProject(result.project);
      setContentProjects((items) => [
        ...projects,
        ...items.filter(
          (item) =>
            !projects.some(
              (project) => project.contentProjectId === item.contentProjectId,
            ),
        ),
      ]);
      setSubjectNotice(result.duplicate ? "پیام‌های انتخاب‌شده پیش‌تر ذخیره شده بودند." : "پیام‌های انتخاب‌شده با موفقیت در سوژه خبری ذخیره شدند.");
      setActiveTab("subjects");
    } catch (error) {
      setSubjectError(error instanceof Error ? error.message : "ذخیره‌سازی گروهی در سوژه خبری ناموفق بود.");
      setEngagementError(
        error instanceof Error
          ? error.message
          : "ذخیره‌سازی گروهی در آرشیو ناموفق بود.",
      );
    } finally {
      setEngagementReplyBusy(false);
    }
  }

  async function resolveEngagementProfile() {
    if (!selectedInboxEventId) return;
    setEngagementReplyBusy(true);
    setEngagementError("");
    try {
      const result = await requestEngagementProfile(
        telegram?.initData,
        selectedInboxEventId,
      );
      if (result?.requested)
        setEngagementError(
          "درخواست مشخصات کاربر ثبت شد؛ چند ثانیه بعد صندوق ورودی را به‌روزرسانی کنید.",
        );
    } catch (error) {
      setEngagementError(
        error instanceof Error
          ? error.message
          : "دریافت مشخصات کاربر ناموفق بود.",
      );
    } finally {
      setEngagementReplyBusy(false);
    }
  }

  async function updateEngagementTags(tags: string[], eventId = selectedInboxEventId) {
    if (!eventId) return;
    setEngagementReplyBusy(true);
    setEngagementError("");
    try {
      const result = await assignEngagementTags(
        telegram?.initData,
        eventId,
        tags,
      );
      if (result) {
        mergeEngagementInboxItems(result.items);
        if (result.catalog) setEngagementTags(result.catalog);
      }
    } catch (error) {
      setEngagementError(
        error instanceof Error ? error.message : "ذخیرهٔ برچسب ناموفق بود.",
      );
    } finally {
      setEngagementReplyBusy(false);
    }
  }

  async function manageSharedEngagementTag(action: "create" | "rename" | "delete", tag: string, newTag = "") {
    setEngagementBusy(true);
    setEngagementError("");
    try {
      const result = await manageEngagementTagCatalog(telegram?.initData, action, tag, newTag);
      if (result?.tags) {
        setEngagementTags(result.tags);
        // Rename/delete changes historical contact chips too; reload only the
        // local inbox, without a slow BoxAPI account sync.
        const inbox = await getEngagementInbox(telegram?.initData, engagementFilters);
        if (inbox) mergeEngagementInboxItems(inbox.items, Number(inbox.nextCursor ?? 0));
      }
    } catch (error) {
      setEngagementError(error instanceof Error ? error.message : "ذخیرهٔ برچسب ناموفق بود.");
    } finally {
      setEngagementBusy(false);
    }
  }

  async function submitWebLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWebLoginBusy(true);
    setWebLoginError("");
    try {
      const session = await loginWeb(
        webLoginUsername,
        webLoginPassword,
        rememberWebLogin,
      );
      if (!session || !["owner", "active"].includes(session.access))
        throw new Error("این حساب دسترسی فعال به استودیو ندارد.");
      setAccessState(session.access as typeof accessState);
      setWebLoginPassword("");
    } catch (error) {
      setWebLoginError(
        error instanceof Error ? error.message : "ورود انجام نشد.",
      );
    } finally {
      setWebLoginBusy(false);
    }
  }

  async function submitWebSmsLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWebLoginBusy(true);
    setWebLoginError("");
    try {
      if (!webLoginOtpSent) {
        const result = await requestWebLoginOtp(webLoginPhone);
        if (!result?.sent) throw new Error("ارسال کد ورود انجام نشد.");
        setWebLoginOtpSent(true);
        return;
      }
      const session = await verifyWebLoginOtp(webLoginPhone, webLoginOtp, rememberWebLogin);
      if (!session || !["owner", "active"].includes(session.access))
        throw new Error("این حساب دسترسی فعال به استودیو ندارد.");
      setAccessState(session.access as typeof accessState);
      setWebLoginOtp("");
    } catch (error) {
      setWebLoginError(error instanceof Error ? error.message : "ورود انجام نشد.");
    } finally {
      setWebLoginBusy(false);
    }
  }

  async function signOutWeb() {
    try {
      await logoutWeb();
    } finally {
      window.location.reload();
    }
  }

  async function provisionWebAccount() {
    try {
      const result = await manageWebAccount(
        telegram?.initData,
        "provision",
        webAccountChatId,
        webAccountUsername,
        webAccountPassword,
      );
      if (!result) throw new Error("ساخت حساب وب انجام نشد.");
      setAccessView(result.access);
      setWebAccountPassword("");
    } catch (error) {
      setSubmissionError(
        error instanceof Error ? error.message : "ساخت حساب وب انجام نشد.",
      );
    }
  }

  async function disableWebAccount(chatId: string) {
    try {
      const result = await manageWebAccount(
        telegram?.initData,
        "disable",
        chatId,
      );
      if (result) setAccessView(result.access);
    } catch (error) {
      setSubmissionError(
        error instanceof Error
          ? error.message
          : "غیرفعال‌سازی ورود وب انجام نشد.",
      );
    }
  }

  async function refreshNewsSnapshots() {
    try {
      const result = await listNewsSeekerSnapshots(telegram?.initData);
      if (!result) return [];
      setNewsSnapshots(result.snapshots);
      setNewsItems(result.items ?? []);
      setNewsQueue(result.queue ?? []);
      setNewsSources(result.sources ?? []);
      setSelectedNewsSnapshotId((current) =>
        current &&
        result.snapshots.some((snapshot) => snapshot.snapshotId === current)
          ? current
          : (result.snapshots[0]?.snapshotId ?? ""),
      );
      return result.snapshots;
    } catch (error) {
      setNewsError(
        error instanceof Error ? error.message : "دریافت آرشیو خبر انجام نشد.",
      );
      return [];
    }
  }

  async function requestNewsRefresh(category: "all" | NewsSeekerCategory) {
    setNewsBusy(true);
    setNewsError("");
    setNewsNotice("");
    try {
      const knownSnapshotIds = new Set(
        newsSnapshots.map((snapshot) => snapshot.snapshotId),
      );
      const result = await requestNewsSeekerRefresh(
        telegram?.initData,
        category,
      );
      if (!result) throw new Error("ارتباط با جستجوگر خبر برقرار نشد.");
      if (result.snapshot) {
        setNewsSnapshots((current) => [
          result.snapshot!,
          ...current.filter(
            (snapshot) => snapshot.snapshotId !== result.snapshot!.snapshotId,
          ),
        ]);
        setSelectedNewsSnapshotId(result.snapshot.snapshotId);
      }
      setNewsNotice(result.message);
      if (result.accepted && !result.reused) {
        // The manual webhook starts the workflow immediately. Keep the action
        // in its live state and open the new shared card as soon as n8n writes
        // it, rather than asking the editor to wait for the scheduled run.
        for (let attempt = 0; attempt < 36; attempt += 1) {
          await new Promise<void>((resolve) =>
            window.setTimeout(resolve, 1000),
          );
          const snapshots = await refreshNewsSnapshots();
          const fresh = snapshots.find(
            (snapshot) =>
              !knownSnapshotIds.has(snapshot.snapshotId) &&
              (category === "all" || snapshot.category === category),
          );
          if (fresh) {
            setSelectedNewsSnapshotId(fresh.snapshotId);
            setNewsNotice(
              "دریافت مستقیم انجام شد و کارت تازه برای همهٔ کاربران ثبت شد.",
            );
            return;
          }
        }
        setNewsNotice(
          "دریافت مستقیم آغاز شده است؛ با تکمیل پردازش منبع، کارت تازه خودکار در همین صفحه ظاهر می‌شود.",
        );
      }
    } catch (error) {
      setNewsError(
        error instanceof Error
          ? error.message
          : "درخواست دریافت خبر ناموفق بود.",
      );
    } finally {
      setNewsBusy(false);
    }
  }

  async function addNewsToQueue(item: NewsSeekerItem) {
    setNewsBusy(true); setNewsError(""); setNewsNotice("");
    try {
      const result = await manageNewsroomQueue(telegram?.initData, { action: "select", item });
      if (!result) throw new Error("افزودن خبر به صف انجام نشد.");
      setNewsQueue(result.queue);
      setNewsNotice(result.duplicate ? "این خبر از قبل در صف انتشار است." : "خبر به صف آزمایشی اضافه شد؛ انتشار هنوز انجام نشده است.");
    } catch (error) {
      setNewsError(error instanceof Error ? error.message : "افزودن خبر به صف ناموفق بود.");
    } finally { setNewsBusy(false); }
  }

  async function draftNewsQueueItem(entry: NewsroomQueueEntry) {
    setNewsBusy(true); setNewsError(""); setNewsNotice("");
    try {
      const result = await manageNewsroomQueue(telegram?.initData, { action: "draft", entryId: entry.id });
      if (!result) throw new Error("ساخت پیش‌نویس انجام نشد.");
      setNewsQueue(result.queue);
      setNewsNotice("پیش‌نویس AI ساخته شد. پیش از انتشار، آن را در سوژهٔ خبری بازبینی کنید.");
    } catch (error) {
      setNewsError(error instanceof Error ? error.message : "ساخت پیش‌نویس AI ناموفق بود.");
    } finally { setNewsBusy(false); }
  }

  async function openNewsQueueProject(entry: NewsroomQueueEntry) {
    try {
      if (entry.contentProjectId) {
        await openContentProject(entry.contentProjectId, "publish");
        return;
      }
      const draft = entry.draft as Record<string, unknown>;
      const site = (draft.site ?? {}) as Record<string, unknown>;
      const socialText = String(draft.socialText ?? entry.item.summary ?? entry.item.title);
      const project = await createContentProject(telegram?.initData, {
        brand: "kalametaze",
        category: "news",
        rawText: [entry.item.title, entry.item.summary, entry.item.source ? `منبع: ${entry.item.source}` : "", entry.item.url].filter(Boolean).join("\n\n"),
        source: { kind: "newsroom_pilot", url: entry.item.url, publisher: entry.item.source ?? "" },
        article: {
          title: String(draft.headline ?? entry.item.title),
          lead: String(draft.socialLead ?? ""),
          body: String(site.body ?? draft.socialBody ?? entry.item.summary ?? ""),
          source: String(draft.sourceLine ?? entry.item.source ?? ""),
          caption: socialText,
          tags: Array.isArray(draft.hashtags) ? draft.hashtags.map(String).join("، ") : "",
          kicker: String(site.kicker ?? ""),
        },
      });
      if (!project?.project) throw new Error("سوژهٔ خبری ساخته نشد.");
      const linked = await manageNewsroomQueue(telegram?.initData, { action: "link_project", entryId: entry.id, contentProjectId: project.project.contentProjectId });
      if (linked) setNewsQueue(linked.queue);
      setActiveContentProject(project.project);
      setPublishDraftText(socialText);
      setPublishSiteArticle(project.project.article ?? {});
      setPublishError("");
      setActiveTab("publish");
    } catch (error) {
      setNewsError(error instanceof Error ? error.message : "باز کردن سوژهٔ خبری ناموفق بود.");
    }
  }

  function sendNewsToEditorial(item: NewsSeekerItem) {
    const text = [
      item.title,
      item.summary,
      item.source ? `منبع: ${item.source}` : "",
      item.url,
    ]
      .filter(Boolean)
      .join("\n\n");
    setEditorialRawText(text);
    setEditorialArticle({
      title: item.title,
      body: item.summary,
      source: item.source,
      caption: item.summary,
      tags: item.tags,
    });
    setReporterOutput("");
    setEditorialError("");
    setEditorialNotice("خبر از جستجوگر خبر برای ویرایش آماده شد.");
    setActiveContentProject(undefined);
    setActiveTab("editorial");
  }

  function sendNewsToImage(item: NewsSeekerItem) {
    startNewDesign();
    setTemplateGroup("news");
    setTemplate("news_story");
    setCanvas("story_1080x1920");
    setImageMode("none");
    setContent((current) => ({
      ...current,
      title: item.title,
      caption: item.summary || item.title,
      source: item.source,
      additionalInstructions: `منبع اصلی: ${item.url}`,
    }));
    setActiveTab("create");
  }

  async function sendNewsToPublish(item: NewsSeekerItem) {
    const text = [
      item.title,
      "",
      item.summary,
      "",
      item.source ? `منبع: ${item.source}` : "",
      item.url,
    ]
      .filter(Boolean)
      .join("\n");
    try {
      const result = await createContentProject(telegram?.initData, {
        brand,
        rawText: text,
        category: "news",
        source: {
          kind: "news_seeker",
          url: item.url,
          publisher: item.source ?? "",
        },
        article: {
          title: item.title,
          body: item.summary,
          source: item.source,
          caption: text,
          tags: item.tags,
        },
      });
      if (!result?.project) throw new Error("پروژهٔ انتشار خبر ساخته نشد.");
      setActiveContentProject(result.project);
      setPublishDraftText(text);
      setPublishSiteArticle(result.project.article ?? {});
      setPublishSiteTags(item.tags ?? "");
      setPublishError("");
      setActiveTab("publish");
    } catch (error) {
      setNewsError(
        error instanceof Error
          ? error.message
          : "انتقال خبر به انتشار سریع ناموفق بود.",
      );
    }
  }

  async function saveNewsToArchive(item: NewsSeekerItem) {
    const text = [item.title, item.summary, item.source ? `منبع: ${item.source}` : "", item.url]
      .filter(Boolean)
      .join("\n\n");
    try {
      const result = await createContentProject(telegram?.initData, {
        brand,
        rawText: text,
        category: "news",
        source: {
          kind: "news_seeker",
          itemId: item.id,
          url: item.url,
          publisher: item.source ?? "",
        },
        article: {
          title: item.title,
          body: item.summary,
          source: item.source,
          caption: text,
          tags: item.tags,
        },
      });
      if (!result?.project) throw new Error("خبر در آرشیو ذخیره نشد.");
      setActiveContentProject(result.project);
      setContentProjects((items) => [
        result.project,
        ...items.filter(
          (project) => project.contentProjectId !== result.project.contentProjectId,
        ),
      ]);
      setLibraryTab("archive");
      setActiveTab("library");
    } catch (error) {
      setNewsError(
        error instanceof Error ? error.message : "ذخیرهٔ خبر در آرشیو ناموفق بود.",
      );
    }
  }

  useEffect(() => {
    if (activeTab === "library" || activeTab === "subjects") {
      void refreshProjects();
      void refreshContentProjects();
      void refreshVideoLibrary();
    }
    if (activeTab === "settings" && accessState === "owner") {
      void refreshPrompts();
      void refreshImageModelSettings();
      void refreshTextModelSettings();
      void refreshVoiceModelSettings();
      void refreshTranscriptionModelSettings();
    }
    if (activeTab === "engagement") {
      void refreshEngagement();
      if (accessState === "owner") void refreshEngagementKnowledge();
    }
    if (activeTab === "editorial") void refreshTranscriptionModelSettings();
    if (activeTab === "news") void refreshNewsSnapshots();
  }, [activeTab, accessState]);

  // A filter is evaluated by the API over the durable archive, not only over
  // the currently rendered page. Clear the old scope before reading its first
  // cursor page so results from another account/tag never bleed into it.
  useEffect(() => {
    if (activeTab !== "engagement") return;
    setEngagementInbox([]);
    setEngagementInboxCursor(0);
    setEngagementInboxHasMore(false);
    void refreshEngagement();
  }, [activeTab, engagementFilters.join(","), engagementTagFilters.join(",")]);

  useEffect(() => {
    const pending = editorialTranscriptionJobs.filter((job) => job.state === "queued" || job.state === "processing");
    if (!pending.length) return;
    const poll = async () => {
      const results = await Promise.all(pending.map((job) => getAudioTranscription(telegram?.initData, job.jobId).catch(() => undefined)));
      results.filter(Boolean).forEach((result) => {
        if (!result) return;
        setEditorialTranscriptionJobs((current) => current.map((job) => job.jobId === result.job.jobId ? result.job : job));
        if (result.job.state === "completed" && activeContentProject?.contentProjectId === result.project.contentProjectId) {
          setActiveContentProject(result.project); setEditorialRawText(result.project.rawText ?? "");
          setEditorialNotice("پیاده‌سازی صوت به متن به متن خام و کتابخانه افزوده شد.");
        }
      });
    };
    const timer = window.setInterval(() => void poll(), 4500);
    void poll();
    return () => window.clearInterval(timer);
  }, [editorialTranscriptionJobs.map((job) => `${job.jobId}:${job.state}`).join("|"), activeContentProject?.contentProjectId, telegram?.initData]);

  // Media is mirrored to the durable cache/S3 by the Gateway. Do not poll the
  // first inbox page while it is pending: that used to replace paged history
  // shortly after it had appeared and made the desk needlessly heavy.

  async function refreshActiveJob() {
    // A standalone web session is authorised by its secure cookie, whereas a
    // Telegram session carries initData. Both must receive the same live job
    // updates; gating this on Telegram left completed web jobs invisible.
    if (!activeJobId) return;
    try {
      const result = await getDesignJob(telegram?.initData, activeJobId);
      if (result?.job) setActiveJob(result.job);
    } catch {
      setSubmissionError(
        "وضعیت پروژه دریافت نشد؛ پروژه در سرور محفوظ است و دوباره بررسی خواهد شد.",
      );
    }
  }

  useEffect(() => {
    void refreshActiveJob();
    if (!activeJobId) return undefined;
    const timer = window.setInterval(() => void refreshActiveJob(), 3000);
    return () => window.clearInterval(timer);
  }, [activeJobId]);

  async function updateActiveJob(action: "cancel" | "retry") {
    if (!activeJobId) return;
    try {
      const result = await manageDesignJob(
        telegram?.initData,
        action,
        activeJobId,
      );
      if (result?.job) setActiveJob(result.job);
    } catch (error) {
      setSubmissionError(
        error instanceof Error ? error.message : "عملیات پروژه انجام نشد.",
      );
    }
  }

  async function showLatestOutput() {
    const output = activeJob?.outputs.at(-1);
    if (!activeJob || !output) return;
    setOutputLoading(true);
    try {
      const file = await getDesignOutput(
        telegram?.initData,
        activeJob.requestId,
        output.filename,
      );
      if (!file) return;
      if (activeOutputUrl) URL.revokeObjectURL(activeOutputUrl);
      setActiveOutputUrl(URL.createObjectURL(file));
    } catch (error) {
      setSubmissionError(
        error instanceof Error ? error.message : "نمایش خروجی ممکن نشد.",
      );
    } finally {
      setOutputLoading(false);
    }
  }

  useEffect(() => {
    if (
      activeJob?.state === "completed" &&
      activeJob.outputs.length > 0 &&
      !activeOutputUrl &&
      !outputLoading
    )
      void showLatestOutput();
  }, [activeJob?.requestId, activeJob?.state, activeJob?.outputs.length]);

  useEffect(() => {
    setStorySummary("");
    setStorySummaryError("");
  }, [activeJob?.requestId]);

  useEffect(() => {
    // A serial deck owns its own review card. Do not collapse the complete
    // studio form when an individual slide becomes ready.
    if (activeJob?.state === "completed" && !slideSeries) {
      setFormCollapsed(true);
      setFormEditMode(false);
      // Collapsing the long form changes document height.  Without restoring
      // the viewport, mobile browsers preserve the old anchor near the
      // removed form and show an apparently blank area at the bottom.
      window.setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 380);
    }
  }, [activeJob?.requestId, activeJob?.state, slideSeries]);

  useEffect(() => {
    const isRunning =
      activeJob?.state === "queued" || activeJob?.state === "processing";
    if (!isRunning || !jobStartedAt) return undefined;
    const refreshElapsed = () =>
      setElapsedSeconds(
        Math.max(0, Math.floor((Date.now() - jobStartedAt) / 1000)),
      );
    refreshElapsed();
    const timer = window.setInterval(refreshElapsed, 1000);
    return () => window.clearInterval(timer);
  }, [activeJob?.state, jobStartedAt]);

  async function downloadJobOutput(
    requestId: string,
    filename: string,
  ) {
    try {
      // A standalone web session is already authenticated with its secure
      // session cookie. Download the immutable original straight from the
      // project archive instead of bouncing the file through Telegram.
      if (!telegram?.initData) {
        const file = await getDesignOutput(
          undefined,
          requestId,
          filename,
        );
        if (!file) throw new Error("فایل اصلی برای دانلود از سرور دریافت نشد.");
        const url = URL.createObjectURL(file);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.style.display = "none";
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
        setSubmissionError("");
        return;
      }
      const result = await deliverDesignOutput(
        telegram?.initData,
        requestId,
        filename,
      );
      if (!result?.delivered)
        throw new Error("ارسال فایل باکیفیت به چت انجام نشد.");
      setSubmissionError("");
      setSubmissionState("idle");
      window.alert("فایل اصلی و باکیفیت در چت بات برای شما ارسال شد.");
    } catch (error) {
      setSubmissionError(
        error instanceof Error
          ? error.message
          : "دریافت فایل باکیفیت انجام نشد.",
      );
    }
  }

  function latestNoHeaderOutput(job: DesignJob | undefined): JobIntermediate | undefined {
    return [...(job?.intermediates ?? [])]
      .reverse()
      .find((item) => item.kind === "generated_background" || item.kind === "ai_background");
  }

  async function downloadOutput(filename: string) {
    if (!activeJob) return;
    await downloadJobOutput(activeJob.requestId, filename);
  }

  async function submitImageEdit() {
    if (!activeJob || editInstruction.trim().length < 4) return;
    setSubmissionError("");
    try {
      const result = await editDesignJob(
        telegram?.initData,
        activeJob.requestId,
        editInstruction.trim(),
      );
      if (!result?.job) throw new Error("ثبت ویرایش تصویر انجام نشد.");
      if (activeOutputUrl) URL.revokeObjectURL(activeOutputUrl);
      setActiveOutputUrl("");
      setEditInstruction("");
      setActiveJob(result.job);
      setActiveJobId(result.job.requestId);
      setFormCollapsed(false);
      setFormEditMode(false);
      setJobStartedAt(Date.now());
      setElapsedSeconds(0);
      window.localStorage.setItem(
        "kalam-design-active-job",
        result.job.requestId,
      );
    } catch (error) {
      setSubmissionError(
        error instanceof Error ? error.message : "ثبت ویرایش تصویر انجام نشد.",
      );
    }
  }

  function recreateSameContent() {
    if (activeOutputUrl) URL.revokeObjectURL(activeOutputUrl);
    setActiveOutputUrl("");
    setActiveJob(undefined);
    setActiveJobId("");
    setRequestId(crypto.randomUUID());
    setSubmissionState("idle");
    setSubmissionError("");
    setEditInstruction("");
    setFormEditMode(false);
    setFormCollapsed(false);
    window.localStorage.removeItem("kalam-design-active-job");
  }

  function updateContent(field: keyof typeof content) {
    return (
      event: ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) => {
      setContent((current) => ({
        ...current,
        [field]: normaliseContentValue(field, event.target.value),
      }));
    };
  }

  function updateClassifiedAds(
    transform: (current: ClassifiedAd[]) => ClassifiedAd[],
  ) {
    setContent((current) => {
      const existing = parseClassifiedAds(current.classifiedsJson);
      const next = transform(existing)
        .slice(0, 4)
        .map((ad) => ({
          category: ad.category,
          title: normaliseContentValue("title", ad.title).slice(0, 56),
          body: normaliseContentValue("caption", ad.body).slice(0, 220),
          contact: normaliseContentValue("source", ad.contact).slice(0, 96),
        }));
      return { ...current, classifiedsJson: JSON.stringify(next) };
    });
  }

  function restoreFormFromJob(job: DesignJob): boolean {
    const request = job.request;
    if (!request || typeof request !== "object") return false;
    const format = (
      request.format && typeof request.format === "object" ? request.format : {}
    ) as Record<string, unknown>;
    const restoredContent = (
      request.content && typeof request.content === "object"
        ? request.content
        : {}
    ) as Record<string, unknown>;
    const restoredImage = (
      request.image && typeof request.image === "object" ? request.image : {}
    ) as Record<string, unknown>;
    const restoredAdvertising = recordValue(request.advertising);
    setAdvertisingEnabled(Boolean(restoredAdvertising.enabled));
    setAdvertisingMode(["card", "subtitle", "embedded"].includes(String(restoredAdvertising.mode)) ? restoredAdvertising.mode as typeof advertisingMode : "card");
    setAdvertisingTitle(textValue(restoredAdvertising.title));
    setAdvertisingSubtitle(textValue(restoredAdvertising.subtitle));
    setAdvertisingDescription(textValue(restoredAdvertising.description));
    setAdvertisingContact(textValue(restoredAdvertising.contact));
    setClubShowcase(restoreClubShowcase(restoredContent.clubShowcase));
    const restoredNews = (
      format.news && typeof format.news === "object" ? format.news : {}
    ) as Record<string, unknown>;
    const restoredStudio = recordValue(format.studio);
    const restoredLogoBehavior = textValue(
      format.logoBehavior,
      restoredStudio.headerEnabled ? "system_header" : "floating_profile",
    );
    setLogoBehavior(
      ["system_header", "floating_profile", "none"].includes(restoredLogoBehavior)
        ? restoredLogoBehavior as LogoBehavior
        : "floating_profile",
    );
    const restored = Object.fromEntries(
      Object.entries(restoredContent)
        .filter(([, value]) => typeof value === "string")
        .map(([field, value]) => [
          field,
          normaliseContentValue(field, String(value)),
        ]),
    ) as Partial<typeof content>;
    setBrand(
      request.brand === "golbahar" || request.brand === "chenaran"
        ? request.brand
        : "kalametaze",
    );
    setTemplateGroup(format.family === "news" ? "news" : format.family === "studio" ? "studio" : "non_news");
    setTemplate(
      typeof format.template === "string" ? format.template : "news_story",
    );
    if (format.family === "studio") {
      const presenterIds = Array.isArray(restoredStudio.presenterIds) ? restoredStudio.presenterIds.filter((item): item is string => typeof item === "string" && item in presenterLabels) : ["kamran"];
      setStudioPresenterIds(presenterIds.length ? presenterIds : ["kamran"]);
      setStudioLocationId(typeof restoredStudio.locationId === "string" && restoredStudio.locationId in locationLabels ? restoredStudio.locationId : "newsroom");
      const referenceSelection = recordValue(restoredStudio.referenceSelection);
      const presenterReferences = recordValue(referenceSelection.presenters);
      setStudioPresenterReferences(Object.fromEntries(presenterIds.map((id) => [id, normaliseReferenceChoice(presenterReferences[id])])));
      setStudioLocationReferences(normaliseReferenceChoice(referenceSelection.location));
      const restoredLocation = recordValue(restoredStudio.location);
      const restoredLocationMode = textValue(restoredLocation.mode, "catalog");
      setStudioLocationMode(["catalog", "generated_prompt", "exact_reference", "faithful_reference"].includes(restoredLocationMode) ? restoredLocationMode as StudioLocationMode : "catalog");
      setStudioLocationAssetIds(Array.isArray(restoredLocation.assetIds) ? restoredLocation.assetIds.filter((item): item is string => typeof item === "string") : []);
      setStudioLocationPrompt(textValue(restoredLocation.prompt));
      setStudioLocationReferenceInstructions(textValue(restoredLocation.referenceInstructions));
      const legacyBlank = String(restoredStudio.textMode) === "blank";
      setStudioTextMode(String(restoredStudio.textMode) === "designed" ? "designed" : "monitor");
      setStudioText(String(restoredStudio.textMode) === "designed" ? textValue(restoredStudio.text) : "");
      const monitor = recordValue(restoredStudio.monitor);
      setStudioMonitorEnabled(monitor.enabled !== false && monitor.mode !== "disabled");
      setStudioMonitorMode(["text", "images", "blank", "disabled"].includes(String(monitor.mode)) ? monitor.mode as StudioMonitorMode : legacyBlank ? "blank" : "text");
      setStudioMonitorText(textValue(monitor.text) || (!legacyBlank ? textValue(restoredStudio.monitorText) : ""));
      setStudioMonitorImageMode(["generate", "reference", "preserve"].includes(String(monitor.imageMode)) ? monitor.imageMode as StudioMonitorImageMode : "generate");
      setStudioMonitorImageCount(Math.max(1, Math.min(4, Number(monitor.imageCount) || 1)));
      setStudioMonitorBrief(textValue(monitor.brief));
      const titleSpace = recordValue(restoredStudio.titleSpace);
      setStudioTitleSpaceEnabled(Boolean(titleSpace.enabled) || legacyBlank);
      setStudioTitleSpaceText(textValue(titleSpace.textHint) || (legacyBlank ? textValue(restoredStudio.text) : ""));
      const restoredPlacement = textValue(titleSpace.placement, textValue(restoredStudio.copySpacePlacement, "auto"));
      setStudioCopySpacePlacement(["auto", "left", "right", "top", "bottom"].includes(restoredPlacement) ? restoredPlacement as StudioCopySpacePlacement : "auto");
      const expressions = recordValue(restoredStudio.expressions);
      setStudioExpressions(Object.fromEntries(Object.entries(expressions).filter((entry): entry is [string, string] => typeof entry[1] === "string")));
      const characterInstructions = recordValue(restoredStudio.characterInstructions);
      setStudioCharacterInstructions(Object.fromEntries(Object.entries(characterInstructions).filter((entry): entry is [string, string] => typeof entry[1] === "string")));
      const speechBubbles = recordValue(restoredStudio.speechBubbles);
      setStudioSpeechBubbles(Object.fromEntries(Object.entries(speechBubbles).map(([id, values]) => [id, Array.isArray(values) ? values.filter((item): item is string => typeof item === "string").slice(0, 3) : []])));
    }
    setCanvas(
      format.canvas === "post_1080x1350" ? "post_1080x1350" : "story_1080x1920",
    );
    setNewsOutputKind(
      restoredNews.outputKind === "title_only" ||
        restoredNews.outputKind === "title_photo_caption"
        ? restoredNews.outputKind
        : "title_photo",
    );
    setNewsLayout(
      ["right_column", "center", "bottom"].includes(String(restoredNews.layout))
        ? (restoredNews.layout as NewsLayout)
        : "top",
    );
    setNewsPhotoFrame(
      ["landscape", "square", "portrait_3_4"].includes(
        String(restoredNews.photoFrame),
      )
        ? (restoredNews.photoFrame as NewsPhotoFrame)
        : "full",
    );
    setVideoOverlay(Boolean(restoredNews.videoOverlay));
    setVideoFrame(
      ["square", "portrait"].includes(String(restoredNews.videoFrame))
        ? (restoredNews.videoFrame as VideoFrame)
        : "landscape",
    );
    setVideoBackgroundBlur(Boolean(restoredNews.videoBackgroundBlur));
    setSiteLinkPlaceholder(Boolean(restoredNews.siteLinkPlaceholder));
    setCitizenMessageType(
      ["photo", "video"].includes(
        String(
          (format.citizen as Record<string, unknown> | undefined)?.messageType,
        ),
      )
        ? (String(
            (format.citizen as Record<string, unknown>).messageType,
          ) as CitizenMessageType)
        : "text",
    );
    setImageMode(
      ["preserve", "reference", "none"].includes(String(restoredImage.mode))
        ? (restoredImage.mode as ImageMode)
        : "generate",
    );
    setImageEngineOverride(
      ["gemini-3.1-flash-image", "gemini-3.1-flash-lite-image", "gpt-image-2", "gpt-image-2.5-flare", "gpt-image-2.5-sunburst"].includes(textValue(restoredImage.engine))
        ? textValue(restoredImage.engine)
        : "",
    );
    setImageQuality(["low", "medium", "high"].includes(textValue(restoredImage.quality)) ? textValue(restoredImage.quality) as "low" | "medium" | "high" : "medium");
    setContent((current) => ({
      ...initialContent,
      ...current,
      ...restored,
      imagePrompt: textValue(restoredImage.prompt),
      referenceInstructions: textValue(restoredImage.referenceInstructions),
    }));
    setDesignCaptionDraft(textValue(restoredContent.publicationCaption));
    setDesignCaptionError("");
    setDesignCaptionEditing(false);
    setFiles([]);
    setPuzzleFiles([]);
    setStudioMonitorFiles([]);
    setExcludedDraftReferences([]);
    return true;
  }

  async function openCurrentJobFormEdit() {
    if (!activeJob) return;
    try {
      const result = activeJob.request
        ? { job: activeJob }
        : await getDesignJob(telegram?.initData, activeJob.requestId);
      const job = result?.job;
      if (!job || !restoreFormFromJob(job))
        throw new Error("فرم اصلی این تصویر در آرشیو پروژه پیدا نشد.");
      setActiveJob(job);
      setFormCollapsed(false);
      setFormEditMode(true);
      setSubmissionError("");
    } catch (error) {
      setSubmissionError(
        error instanceof Error
          ? error.message
          : "بازکردن فرم اصلی تصویر ممکن نشد.",
      );
    }
  }

  async function fillMorningSection(
    action:
      | "date"
      | "weather"
      | "prayer"
      | "riddle"
      | "visual_riddle"
      | "local_occasions"
      | "kalam_calendar"
      | "kalam_occasions",
  ) {
    setMorningLoading(action);
    setMorningDataError("");
    try {
      const result = await getMorningLocalData(
        telegram?.initData,
        action,
        content.morningCity as "golbahar" | "chenaran",
      );
      if (!result?.values) throw new Error("دادهٔ قابل‌استفاده‌ای دریافت نشد.");
      setContent(
        (current) =>
          Object.fromEntries(
            Object.entries({ ...current, ...result.values }).map(
              ([field, value]) => [
                field,
                normaliseContentValue(field, String(value)),
              ],
            ),
          ) as typeof content,
      );
      if (action === "kalam_calendar" && result.meta) {
        setMorningKalamHolidays(
          Array.from(
            { length: 7 },
            (_, index) =>
              result.meta?.holidayIndexes?.includes(index + 1) ?? false,
          ),
        );
      }
    } catch (error) {
      setMorningDataError(
        error instanceof Error
          ? error.message
          : "دریافت دادهٔ به‌روز ناموفق بود.",
      );
    } finally {
      setMorningLoading(undefined);
    }
  }

  async function fillMarketSection(action: "date" | "rates") {
    setMarketLoading(action);
    setMarketDataError("");
    setMarketDataNote("");
    try {
      const result = await getMarketData(telegram?.initData, action);
      if (!result?.values) throw new Error("دادهٔ قابل‌استفاده‌ای دریافت نشد.");
      setContent(
        (current) =>
          Object.fromEntries(
            Object.entries({ ...current, ...result.values }).map(
              ([field, value]) => [
                field,
                normaliseContentValue(field, String(value)),
              ],
            ),
          ) as typeof content,
      );
      if (action === "rates" && result.changeStatus === "baseline_pending")
        setMarketDataNote(
          "نرخ‌ها ثبت شد. درصد ۲۴ساعته پس از ایجاد مبنای زمانی معتبر، خودکار نمایش داده می‌شود.",
        );
      if (result.upstreamUpdatedAt)
        setMarketDataNote(
          (current) =>
            `${current ? `${current} ` : ""}آخرین زمان اعلام‌شدهٔ منبع: ${result.upstreamUpdatedAt}`,
        );
    } catch (error) {
      setMarketDataError(
        error instanceof Error
          ? error.message
          : "دریافت نرخ‌های به‌روز ناموفق بود.",
      );
    } finally {
      setMarketLoading(undefined);
    }
  }

  async function fillOccasion(action: "calendar" | "copy") {
    setContentToolLoading(`occasion-${action}`);
    setContentToolError("");
    try {
      const result = await getOccasionTool(telegram?.initData, action, {
        tone: content.occasionTone,
        category: content.occasionCategory,
        occasions: content.occasionName,
      });
      if (!result) throw new Error("پاسخ قابل‌استفاده‌ای دریافت نشد.");
      if (result.values)
        setContent((current) => ({ ...current, ...result.values }));
      if (result.options) setOccasionOptions(result.options);
    } catch (error) {
      setContentToolError(
        error instanceof Error
          ? error.message
          : "دریافت پیشنهاد مناسبت ناموفق بود.",
      );
    } finally {
      setContentToolLoading(undefined);
    }
  }

  async function requestContentIdeas(
    action: "night" | "home_tip" | "infographic" | "sport",
  ) {
    setContentToolLoading(action);
    setContentToolError("");
    setIdeaOptions([]);
    const values: Record<string, string> =
      action === "night"
        ? {
            kind: content.nightKind,
            freshness: content.nightFreshness,
            prompt: content.nightPrompt,
          }
        : action === "home_tip"
          ? { prompt: content.homeTipPrompt }
          : action === "infographic"
            ? {
                topic: content.infographicTopic,
                sourceText: content.infographicSourceText,
              }
            : { mode: content.sportMode, team: content.sportTeam };
    try {
      const result = await getContentIdeas(telegram?.initData, action, values);
      if (!result) throw new Error("پاسخ قابل‌استفاده‌ای دریافت نشد.");
      if (result.values)
        setContent((current) => ({ ...current, ...result.values }));
      if (result.options) setIdeaOptions(result.options);
    } catch (error) {
      setContentToolError(
        error instanceof Error ? error.message : "دریافت پیشنهاد ناموفق بود.",
      );
    } finally {
      setContentToolLoading(undefined);
    }
  }

  async function previewDraftReference(name: string) {
    if (!draftId) return;
    try {
      const blob = await getStudioDraftOutput(
        telegram?.initData,
        draftId,
        name,
      );
      if (blob) setPreviewFile({ name, url: URL.createObjectURL(blob) });
    } catch (error) {
      setSubmissionError(
        error instanceof Error ? error.message : "نمایش تصویر مرجع ممکن نشد.",
      );
    }
  }

  async function previewActiveReference(name: string) {
    if (!activeJob) return;
    try {
      const blob = await getDesignReferenceOutput(
        telegram?.initData,
        activeJob.requestId,
        name,
      );
      if (blob) setPreviewFile({ name, url: URL.createObjectURL(blob) });
    } catch (error) {
      setSubmissionError(
        error instanceof Error ? error.message : "نمایش تصویر مرجع ممکن نشد.",
      );
    }
  }

  async function addStudioLocationReferences(incoming: File[]) {
    const available = Math.max(
      0,
      studioImageReferenceLimit - studioReferenceCount,
    );
    const selected = incoming.slice(0, available);
    if (!selected.length) {
      setSubmissionError(
        `ظرفیت ${toPersianDigits(String(studioImageReferenceLimit))} ورودی تصویری تکمیل است؛ ابتدا یک مرجع دیگر را حذف کنید.`,
      );
      return;
    }
    const queue: VideoUploadItem[] = selected.map((file) => ({
      id: crypto.randomUUID(),
      file,
      kind: "location",
      entityId: studioLocationId,
      loaded: 0,
      total: file.size,
      status: "preparing",
    }));
    setStudioLocationUploadQueue(queue);
    let known = new Set(
      studioAssetRegistry?.assets.map((asset) => asset.assetId) ?? [],
    );
    for (const item of queue) {
      setStudioLocationUploadQueue((current) =>
        current.map((entry) =>
          entry.id === item.id ? { ...entry, status: "uploading" } : entry,
        ),
      );
      try {
        const registry = await manageVideoAssets(
          telegram?.initData,
          "add",
          {
            kind: "location",
            entityId: studioLocationId,
            image: item.file,
            scope: "project",
          },
          (progress) =>
            setStudioLocationUploadQueue((current) =>
              current.map((entry) =>
                entry.id !== item.id
                  ? entry
                  : progress.stage === "securing"
                    ? { ...entry, status: "securing", loaded: entry.total }
                    : {
                        ...entry,
                        status: "uploading",
                        loaded: Math.round(
                          entry.total *
                            (progress.total > 0
                              ? progress.loaded / progress.total
                              : 0),
                        ),
                      },
              ),
            ),
        );
        if (!registry) {
          throw new Error("پاسخ ثبت فایل مرجع معتبر نبود.");
        }
        setStudioAssetRegistry(registry);
        const added = registry.assets
          .filter((asset) => !known.has(asset.assetId))
          .sort((a, b) => b.createdAt - a.createdAt)[0];
        if (added) {
          known.add(added.assetId);
          setStudioLocationAssetIds((current) => [
            ...new Set([...current, added.assetId]),
          ]);
        }
        setStudioLocationUploadQueue((current) =>
          current.map((entry) =>
            entry.id === item.id
              ? { ...entry, status: "completed", loaded: entry.total }
              : entry,
          ),
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "افزودن مرجع ناموفق بود.";
        setStudioLocationUploadQueue((current) =>
          current.map((entry) =>
            entry.id === item.id
              ? { ...entry, status: "failed", error: message }
              : entry,
          ),
        );
        setSubmissionError(message);
      }
    }
  }

  async function deleteStudioLocationReference(assetId: string) {
    try {
      const registry = await manageVideoAssets(telegram?.initData, "delete", { assetId, scope: "project" });
      setStudioAssetRegistry(registry);
      setStudioLocationAssetIds((current) => current.filter((id) => id !== assetId));
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : "حذف فایل مرجع ناموفق بود.");
    }
  }

  async function submitSeriesSlideAt(index: number) {
    if (submissionState === "uploading") return;
    if (
      activeJob &&
      ["queued", "processing", "cancel_requested"].includes(activeJob.state)
    ) {
      setSubmissionError(
        "تا پایان ساخت اسلاید فعلی، یک درخواست دیگر ثبت نکنید.",
      );
      return;
    }
    const slide = designSlides[index];
    if (!slide) return;
    if (!slideHasContent(slide, index)) {
      setSubmissionError(
        `اسلاید ${toPersianDigits(String(index + 1))} خالی است؛ ابتدا دست‌کم یکی از فیلدهای آن را پر کنید.`,
      );
      focusSeriesSlide(index);
      return;
    }
    if (!slideReferencesReady(slide)) {
      setSubmissionError(
        `برای اسلاید ${toPersianDigits(String(index + 1))} در حالت «استفادهٔ دقیق» یا «استفادهٔ وفادار»، دست‌کم یک تصویر مرجع مخصوص همان اسلاید اضافه کنید.`,
      );
      focusSeriesSlide(index);
      return;
    }
    if (!slideReferencesWithinLimit(slide)) {
      setSubmissionError(
        `تصویرساز برای هر اسلاید حداکثر ${toPersianDigits(String(studioImageReferenceLimit))} ورودی تصویری می‌پذیرد؛ این اسلاید در مجموع ${toPersianDigits(String(slideReferenceCount(slide)))} تصویر دارد.`,
      );
      focusSeriesSlide(index);
      return;
    }
    const seriesId = slideSeries?.seriesId ?? crypto.randomUUID();
    const mode =
      slideSeries?.mode ??
      (canvas === "post_1080x1350" ? "carousel" : "multi_story");
    const globalStudio = recordValue(payload.format.studio);
    const globalStudioLocation = recordValue(globalStudio.location);
    const globalStudioReferences = recordValue(globalStudio.referenceSelection);
    const slideUsesStudio = slide.imageMode === "studio" || templateGroup === "studio";
    const slideHasAttachedImage = slide.files.length > 0;
    const inheritedMonitor = recordValue(globalStudio.monitor);
    const effectiveSlideMonitorMode = slide.studioMonitorMode ?? (inheritedMonitor.mode as string | undefined) ?? "blank";
    const effectiveSlideMonitorImageMode = slide.studioMonitorImageMode ?? (inheritedMonitor.imageMode as string | undefined) ?? "generate";
    const slideLocationId = slide.studioLocationId?.trim() || studioLocationId;
    const slideStudio = slideUsesStudio
      ? {
          ...globalStudio,
          presenterIds: slide.presenterIds?.length ? slide.presenterIds : studioPresenterIds,
          locationId: slideLocationId,
          monitor: {
            ...inheritedMonitor,
            mode: effectiveSlideMonitorMode,
            text: slide.studioMonitorText ?? inheritedMonitor.text ?? "",
            imageMode: effectiveSlideMonitorImageMode,
            brief: slide.studioMonitorBrief ?? inheritedMonitor.brief ?? "",
            ...(slideHasAttachedImage && effectiveSlideMonitorMode === "blank"
              ? { mode: "images", imageMode: "preserve", imageCount: 1 }
              : {}),
          },
          location: slide.studioLocationMode
            ? {
                ...globalStudioLocation,
                mode: slide.studioLocationMode,
                id: slideLocationId,
                assetIds: ["exact_reference", "faithful_reference"].includes(slide.studioLocationMode)
                  ? slide.studioLocationAssetIds ?? []
                  : undefined,
                prompt: slide.studioLocationMode === "generated_prompt" ? (slide.studioLocationPrompt ?? "").trim() : undefined,
                referenceInstructions: slide.studioLocationMode === "faithful_reference" ? (slide.studioLocationReferenceInstructions ?? "").trim() : undefined,
              }
            : {
                ...globalStudioLocation,
                id: slideLocationId,
              },
          referenceSelection: {
            ...globalStudioReferences,
            presenters: Object.fromEntries(
              (slide.presenterIds?.length ? slide.presenterIds : studioPresenterIds).map((id) => [
                id,
                slide.presenterReferenceSelection?.[id] ??
                  recordValue(globalStudioReferences.presenters)[id] ??
                  automaticReferenceChoice(),
              ]),
            ),
            location: slide.studioLocationMode === "catalog"
              ? slide.studioLocationReferences ?? automaticReferenceChoice()
              : slide.studioLocationMode
                ? automaticReferenceChoice()
                : globalStudioReferences.location ?? automaticReferenceChoice(),
          },
        }
      : payload.format.studio;
    setSubmissionState("uploading");
    setSubmissionError("");
    try {
      const slideRequest = {
        ...payload,
        requestId: crypto.randomUUID(),
        format: {
          ...payload.format,
          family: slideUsesStudio ? "studio" : payload.format.family,
          baseFamily: slideUsesStudio && payload.format.family !== "studio" ? payload.format.family : undefined,
          studio: slideStudio,
          slideMode: mode,
          slideCount: designSlides.length,
          slideIndex: index + 1,
          seriesId,
          news:
            templateGroup === "news" && !isCitizenMessage
              ? {
                  ...recordValue(payload.format.news),
                  layout: slide.titleLayout ?? "top",
                }
              : payload.format.news,
        },
        content: {
          ...seriesContentForSlide(slide, index),
          seriesId,
          seriesSlideIndex: index + 1,
          seriesSlideCount: designSlides.length,
        },
        // Persist the entire editable deck beside each isolated job.  The
        // worker consumes only `content`, while Library can rebuild cards that
        // have not been rendered yet instead of opening a misleading blank
        // series after a reload.
        seriesDeck: designSlides.map(
          ({
            kicker,
            title,
            subtitle,
            body,
            footer,
            titleLayout,
            imageMode,
            additionalInstructions,
            imagePrompt,
            referenceInstructions,
            presenterIds,
            presenterReferenceSelection,
            imageEngine,
            studioLocationId,
            studioLocationMode,
            studioLocationAssetIds,
            studioLocationPrompt,
            studioLocationReferenceInstructions,
            studioLocationReferences,
            studioMonitorMode,
            studioMonitorText,
            studioMonitorImageMode,
            studioMonitorBrief,
          }) => ({
            kicker,
            title,
            subtitle,
            body,
            footer,
            titleLayout,
            imageMode: imageMode ?? "generate",
            additionalInstructions: additionalInstructions ?? "",
            imagePrompt: imagePrompt ?? "",
            referenceInstructions: referenceInstructions ?? "",
            presenterIds: presenterIds ?? [],
            presenterReferenceSelection: presenterReferenceSelection ?? {},
            imageEngine: imageEngine ?? "",
            studioLocationId: studioLocationId ?? "",
            studioLocationMode,
            studioLocationAssetIds: studioLocationAssetIds ?? [],
            studioLocationPrompt: studioLocationPrompt ?? "",
            studioLocationReferenceInstructions: studioLocationReferenceInstructions ?? "",
            studioLocationReferences: studioLocationReferences ?? automaticReferenceChoice(),
            studioMonitorMode,
            studioMonitorText: studioMonitorText ?? "",
            studioMonitorImageMode: studioMonitorImageMode ?? "preserve",
            studioMonitorBrief: studioMonitorBrief ?? "",
          }),
        ),
        image: {
          ...payload.image,
          engine: slide.imageEngine || payload.image.engine,
          mode: slide.imageMode ?? "generate",
          prompt: (slide.imagePrompt ?? "").trim(),
          referenceInstructions: (slide.referenceInstructions ?? "").trim(),
          presenterIds: slide.presenterIds ?? [],
          referenceSelection: {
            presenters: Object.fromEntries(
              (slide.presenterIds ?? []).map((id) => [
                id,
                slide.presenterReferenceSelection?.[id] ??
                  automaticReferenceChoice(),
              ]),
            ),
          },
        },
      };
      const progress = beginDesignUpload(slide.id, [
        ...slide.files,
        ...puzzleFiles,
      ]);
      const monitorReferenceFiles =
        slideUsesStudio && slideHasAttachedImage && effectiveSlideMonitorMode === "images" && effectiveSlideMonitorImageMode !== "generate"
          ? slide.files
          : [];
      const primarySlideFiles = monitorReferenceFiles.length ? [] : slide.files;
      const result = await submitDesignRequest(
        slideRequest,
        telegram?.initData,
        primarySlideFiles,
        puzzleFiles,
        monitorReferenceFiles,
        progress,
      );
      finishDesignUpload(slide.id);
      if (result.mode !== "submitted")
        throw new Error(
          `اسلاید ${toPersianDigits(String(index + 1))} به صف ساخت وارد نشد.`,
        );
      if (activeOutputUrl) URL.revokeObjectURL(activeOutputUrl);
      setActiveOutputUrl("");
      setSlideSeries((current) => {
        const requestIds = Array.from(
          { length: designSlides.length },
          (_, slideIndex) => current?.requestIds[slideIndex],
        );
        requestIds[index] = result.requestId;
        return { seriesId, mode, currentIndex: index, requestIds };
      });
      setActiveJob({
        requestId: result.requestId,
        title: slide.title || slide.subtitle || `اسلاید ${index + 1}`,
        brand,
        state: "queued",
        attempt: 1,
        outputs: [],
        lastEvent: {
          message: `اسلاید ${toPersianDigits(String(index + 1))} در صف ساخت است.`,
        },
      });
      setActiveJobId(result.requestId);
      setFormCollapsed(false);
      setFormEditMode(false);
      setJobStartedAt(Date.now());
      setElapsedSeconds(0);
      setSubmissionState("submitted");
      window.localStorage.setItem("kalam-design-active-job", result.requestId);
      if (activeContentProject) {
        try {
          const linked = await attachDesignToContentProject(
            telegram?.initData,
            activeContentProject.contentProjectId,
            result.requestId,
          );
          if (linked?.project) setActiveContentProject(linked.project);
        } catch {
          // The series slide remains durable even if its optional content
          // project link is temporarily unavailable.
        }
      }
      setEditorialNotice(
        `اسلاید ${toPersianDigits(String(index + 1))} از ${toPersianDigits(String(designSlides.length))} ثبت شد.`,
      );
      void refreshProjects();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "ثبت اسلاید ناموفق بود.";
      finishDesignUpload(slide.id, message);
      setSubmissionState("error");
      setSubmissionError(message);
    }
  }

  async function submit() {
    if (designSlides.length > 1 && !formEditMode) {
      await submitSeriesSlideAt(0);
      return;
    }
    if (submissionState === "uploading") return;
    const studioManualChoices = [
      ...studioPresenterIds.map((id) => studioPresenterReferences[id]),
      studioLocationMode === "catalog" ? studioLocationReferences : undefined,
    ].filter((choice): choice is ReferenceChoice => Boolean(choice));
    if (templateGroup === "studio" && studioManualChoices.some((choice) => choice.mode === "manual" && !choice.assetIds.length)) {
      setSubmissionError("در حالت انتخاب دستی، دست‌کم یک تصویر مرجع را تیک بزنید.");
      return;
    }
    if (templateGroup === "studio" && studioReferenceCount > studioImageReferenceLimit) {
      setSubmissionError(`تصویرساز حداکثر ${toPersianDigits(String(studioImageReferenceLimit))} ورودی تصویری می‌پذیرد. انتخاب خودکار/دستی، فایل‌های کاربر و تصاویر مانیتور در مجموع ${toPersianDigits(String(studioReferenceCount))} تصویر شده‌اند.`);
      return;
    }
    const hasSavedMonitorReference = Boolean(activeJob?.uploadedImages?.some((item) => item.role === "monitor_reference" && !excludedDraftReferences.includes(item.filename)));
    if (templateGroup === "studio" && studioMonitorMode === "images" && studioMonitorImageMode !== "generate" && !studioMonitorFiles.length && !hasSavedMonitorReference) {
      setSubmissionError("برای «استفاده از مرجع» یا «استفادهٔ وفادار» در مانیتور، دست‌کم یک تصویر اختصاصی مانیتور اضافه کنید.");
      return;
    }
    setSubmissionState("uploading");
    setSubmissionError("");
    const singleAttachments = [...files, ...advertisingFiles, ...puzzleFiles, ...studioMonitorFiles];
    const uploadProgress = beginDesignUpload("single", singleAttachments);
    try {
      let nextRequestId: string | undefined;
      let nextJob: DesignJob | undefined;
      let seriesRequestIds: string[] = [];
      if (formEditMode && activeJob) {
        const result = await editDesignJobWithForm(
          telegram?.initData,
          activeJob.requestId,
          payload,
          [...files, ...advertisingFiles],
          puzzleFiles,
          studioMonitorFiles,
        );
        nextRequestId = result?.job?.requestId;
        nextJob = result?.job;
      } else {
        const result = await submitDesignRequest(
          payload,
          telegram?.initData,
          [...files, ...advertisingFiles],
          puzzleFiles,
          studioMonitorFiles,
          uploadProgress,
        );
        nextRequestId =
          result.mode === "submitted" ? result.requestId : undefined;
      }
      if (!nextRequestId) throw new Error("درخواست به صف ساخت تصویر وارد نشد.");
      finishDesignUpload("single");
      setSubmissionState("submitted");
      if (activeOutputUrl) URL.revokeObjectURL(activeOutputUrl);
      setActiveOutputUrl("");
      setActiveJob(
        nextJob ?? {
          requestId: nextRequestId,
          title: content.title,
          brand,
          state: "queued",
          attempt: 1,
          outputs: [],
          lastEvent: {
            message: "درخواست ثبت شد و در انتظار دریافت وضعیت از سرور است.",
          },
        },
      );
      setActiveJobId(nextRequestId);
      setFormCollapsed(false);
      setFormEditMode(false);
      setJobStartedAt(Date.now());
      setElapsedSeconds(0);
      window.localStorage.setItem("kalam-design-active-job", nextRequestId);
      if (activeContentProject) {
        try {
          let linkedProject: ContentProject | undefined;
          for (const designRequestId of seriesRequestIds.length
            ? seriesRequestIds
            : [nextRequestId]) {
            const linked = await attachDesignToContentProject(
              telegram?.initData,
              activeContentProject.contentProjectId,
              designRequestId,
            );
            if (linked?.project) linkedProject = linked.project;
          }
          if (linkedProject) {
            setActiveContentProject(linkedProject);
            setPublishPhotoRequestId(nextRequestId);
          }
        } catch {
          // The image job is durable even if its optional content-project link
          // is temporarily unavailable; the user can still publish it later.
        }
      }
      void refreshProjects();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "ارسال درخواست انجام نشد.";
      finishDesignUpload("single", message);
      setSubmissionState("error");
      setDesignUploadQueue((current) =>
        current.map((item) =>
          ["uploading", "securing", "preparing"].includes(item.status)
            ? { ...item, status: "failed", error: message }
            : item,
        ),
      );
      setSubmissionError(message);
    }
  }

  async function approveSeriesSlide() {
    if (!slideSeries || !activeJob || activeJob.state !== "completed") return;
    const nextIndex = slideSeries.currentIndex + 1;
    if (
      activeOutputUrl &&
      !slideSeriesOutputs.some((item) => item.requestId === activeJob.requestId)
    ) {
      setSlideSeriesOutputs((current) => [
        ...current,
        {
          index: slideSeries.currentIndex,
          requestId: activeJob.requestId,
          filename: activeJob.outputs.at(-1)?.filename ?? "output.png",
          noHeaderFilename: latestNoHeaderOutput(activeJob)?.filename,
          url: activeOutputUrl,
        },
      ]);
    }
    if (nextIndex >= designSlides.length) {
      setEditorialNotice(
        "همهٔ اسلایدهای این سری تأیید شدند. خروجی‌ها در کتابخانه قابل مشاهده‌اند.",
      );
      return;
    }
    if (activeOutputUrl) URL.revokeObjectURL(activeOutputUrl);
    setActiveOutputUrl("");
    setActiveJob(undefined);
    setActiveJobId("");
    setSlideSeries((current) =>
      current ? { ...current, currentIndex: nextIndex } : current,
    );
    setSubmissionState("idle");
    setSubmissionError("");
    setFormCollapsed(false);
    setFormEditMode(false);
    setJobStartedAt(undefined);
    setElapsedSeconds(0);
    window.localStorage.removeItem("kalam-design-active-job");
    setEditorialNotice("اسلاید بعدی برای بررسی و ساخت آماده شد؛ اسلاید تأییدشدهٔ قبلی به‌عنوان مرجع پیوست می‌شود.");
    window.setTimeout(() => focusSeriesSlide(nextIndex), 0);
    return;
    /* legacy auto-open path retained below for reference only
    const nextRequestId = slideSeries.requestIds[nextIndex];
    if (nextRequestId) {
      try {
        const result = await getDesignJob(telegram?.initData, nextRequestId);
        if (!result?.job) throw new Error("خروجی اسلاید بعدی پیدا نشد.");
        if (activeOutputUrl) URL.revokeObjectURL(activeOutputUrl);
        setActiveOutputUrl("");
        setActiveJob(result.job);
        setActiveJobId(result.job.requestId);
        setSlideSeries((current) =>
          current ? { ...current, currentIndex: nextIndex } : current,
        );
        setJobStartedAt(Date.now());
        setElapsedSeconds(0);
        window.localStorage.setItem(
          "kalam-design-active-job",
          result.job.requestId,
        );
        setEditorialNotice(
          `اسلاید ${toPersianDigits(String(nextIndex + 1))} از قبل ساخته شده و برای بازبینی باز شد.`,
        );
      } catch (error) {
        setSubmissionError(
          error instanceof Error
            ? error.message
            : "بازکردن اسلاید بعدی ناموفق بود.",
        );
      }
      return;
    }
    await submitSeriesSlideAt(nextIndex); */
  }

  async function retrySeriesSlide() {
    if (!slideSeries || !activeJob) {
      await updateActiveJob("retry");
      return;
    }
    // A server-side retry retains the original per-slide reference files.
    // Browsers cannot repopulate File inputs after reopening Library, so this
    // path is both safer and more faithful than constructing a new upload.
    await updateActiveJob("retry");
  }

  async function openSeriesSlide(index: number, textField = false) {
    const slide = designSlides[index];
    if (!slide) return;
    const requestId = slideSeries?.requestIds[index];
    if (requestId) {
      try {
        const result = await getDesignJob(telegram?.initData, requestId);
        if (!result?.job) throw new Error("نسخهٔ ذخیره‌شدهٔ اسلاید پیدا نشد.");
        const job = result.job;
        if (activeOutputUrl) URL.revokeObjectURL(activeOutputUrl);
        setActiveOutputUrl("");
        setActiveJob(job);
        setActiveJobId(job.requestId);
        setSlideSeries((current) =>
          current ? { ...current, currentIndex: index } : current,
        );
        const output = job.outputs.at(-1);
        if (output) {
          setOutputLoading(true);
          const blob = await getDesignOutput(
            telegram?.initData,
            job.requestId,
            output.filename,
          );
          if (blob) setActiveOutputUrl(URL.createObjectURL(blob));
          setOutputLoading(false);
        }
        window.localStorage.setItem("kalam-design-active-job", job.requestId);
      } catch (error) {
        setOutputLoading(false);
        setSubmissionError(
          error instanceof Error
            ? error.message
            : "بازکردن اسلاید ذخیره‌شده ممکن نشد.",
        );
      }
    }
    focusSeriesSlide(index, textField);
  }

  function focusSeriesSlide(index: number, textField = false) {
    const slide = designSlides[index];
    if (!slide) return;
    window.setTimeout(() => {
      const card = document.getElementById(`series-slide-${slide.id}`);
      card?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (textField)
        card?.querySelector<HTMLTextAreaElement>("textarea")?.focus();
    }, 40);
  }

  function addManualSeriesReference(index: number, incoming: File[]) {
    const nextIndex = index + 1;
    if (!incoming.length) return;
    if (nextIndex >= designSlides.length) {
      setSubmissionError(
        "این اسلاید، آخرین اسلاید سری است و اسلاید بعدی برای دریافت مرجع ندارد.",
      );
      return;
    }
    setDesignSlides((current) =>
      current.map((slide, currentIndex) =>
        currentIndex === nextIndex
          ? {
              ...slide,
              imageMode: "reference",
              files: [...slide.files, ...incoming],
            }
          : slide,
      ),
    );
    setEditorialNotice(
      `فایل دستی به‌عنوان مرجع اسلاید ${toPersianDigits(String(nextIndex + 1))} افزوده شد.`,
    );
    focusSeriesSlide(nextIndex);
  }

  function saveDesignPromptBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function downloadDesignPromptAsset(filename: string) {
    if (!promptPreview?.packageId) return;
    try {
      const blob = await getDesignPromptAsset(telegram?.initData, promptPreview.packageId, filename);
      if (blob) saveDesignPromptBlob(blob, filename);
    } catch (error) {
      setPromptPreviewError(error instanceof Error ? error.message : "دریافت تصویر مرجع ناموفق بود.");
    }
  }

  async function downloadDesignPromptBundle() {
    if (!promptPreview?.packageId) return;
    try {
      const blob = await getDesignPromptBundle(telegram?.initData, promptPreview.packageId);
      if (blob) saveDesignPromptBlob(blob, promptPreview.bundleFilename || `kalam-image-prompt-${promptPreview.packageId}.zip`);
    } catch (error) {
      setPromptPreviewError(error instanceof Error ? error.message : "دریافت بستهٔ پرامپت ناموفق بود.");
    }
  }

  async function createPromptOnly() {
    if (promptPreviewBusy || !hasRequiredDesignContent) return;
    setPromptPreviewBusy(true);
    setPromptPreviewError("");
    try {
      const result = await previewDesignPrompt(
        telegram?.initData,
        payload,
        [...files, ...advertisingFiles],
        puzzleFiles,
        studioMonitorFiles,
      );
      if (!result?.prompt) throw new Error("پرامپت نهایی از سرور دریافت نشد.");
      setPromptPreview(result);
    } catch (error) {
      setPromptPreviewError(
        error instanceof Error ? error.message : "ساخت پرامپت انجام نشد.",
      );
    } finally {
      setPromptPreviewBusy(false);
    }
  }

  async function createStorySummary() {
    if (!activeJob || activeJob.state !== "completed") return;
    setStorySummaryBusy(true);
    setStorySummaryError("");
    try {
      const result = await getDesignStorySummary(
        telegram?.initData,
        activeJob.requestId,
      );
      if (!result?.summary) throw new Error("خلاصهٔ توضیح از سرور دریافت نشد.");
      setStorySummary(result.summary);
    } catch (error) {
      setStorySummaryError(
        error instanceof Error ? error.message : "ساخت خلاصهٔ توضیح ناموفق بود.",
      );
    } finally {
      setStorySummaryBusy(false);
    }
  }

  async function loadSportCatalog() {
    if (sportLoading) return;
    setSportLoading("catalog");
    setContentToolError("");
    try {
      const result = await getSportData(telegram?.initData, "catalog");
      if (!result?.competitions?.length)
        throw new Error("فهرست رقابت‌های ورزشی دریافت نشد.");
      setSportCompetitions(result.competitions);
    } catch (error) {
      setContentToolError(
        error instanceof Error ? error.message : "دریافت فهرست رقابت‌ها ناموفق بود.",
      );
    } finally {
      setSportLoading("");
    }
  }

  async function loadSportEvents() {
    if (sportLoading || !content.sportCompetition) return;
    setSportLoading("events");
    setContentToolError("");
    try {
      const result = await getSportData(telegram?.initData, "events", {
        competitionId: content.sportCompetition,
        mode: content.sportMode,
      });
      if (!result?.events?.length)
        throw new Error("مسابقهٔ قابل‌استفاده‌ای برای این رقابت پیدا نشد.");
      const receivedEvents = result.events;
      setSportEvents(receivedEvents);
      setSportDataSource(result.source ?? "");
      setContent((current) => ({
        ...current,
        title: result.competition?.label ?? current.title,
        sportSource: result.source ?? current.sportSource,
        sportEventIds: "[]",
        sportVisualAssets: JSON.stringify({
          leagueBadge: result.competition?.badge ?? "",
          events: receivedEvents.map((event) => ({
            eventId: event.eventId,
            homeBadge: event.homeBadge ?? "",
            awayBadge: event.awayBadge ?? "",
          })),
        }),
      }));
    } catch (error) {
      setContentToolError(
        error instanceof Error ? error.message : "دریافت دادهٔ ورزشی ناموفق بود.",
      );
    } finally {
      setSportLoading("");
    }
  }

  function toggleSportEvent(event: SportEvent) {
    let selected: string[] = [];
    try {
      const saved = JSON.parse(content.sportEventIds);
      if (Array.isArray(saved)) selected = saved.filter((item): item is string => typeof item === "string");
    } catch {
      selected = [];
    }
    const next = selected.includes(event.eventId)
      ? selected.filter((id) => id !== event.eventId)
      : [...selected, event.eventId];
    const chosen = sportEvents.filter((item) => next.includes(item.eventId));
    const lines = chosen.map((item) =>
      item.played
        ? `${item.home} ${item.score} ${item.away}${item.round ? ` | هفته/مرحله ${item.round}` : ""}`
        : `${item.home} — ${item.away} | ${item.date}${item.time ? `، ساعت ${item.time}` : ""}`,
    );
    setContent((current) => ({
      ...current,
      sportEventIds: JSON.stringify(next),
      sportResults: lines.join("\n"),
    }));
  }

  async function createDesignCaption() {
    if (designCaptionBusy || !supportsDataCaption || !hasRequiredDesignContent)
      return;
    setDesignCaptionBusy(true);
    setDesignCaptionError("");
    try {
      const result = await previewDesignCaption(telegram?.initData, payload);
      if (!result?.caption)
        throw new Error("کپشن آماده از داده‌های فرم دریافت نشد.");
      setDesignCaptionDraft(result.caption);
      setDesignCaptionEditing(false);
    } catch (error) {
      setDesignCaptionError(
        error instanceof Error ? error.message : "ساخت کپشن انجام نشد.",
      );
    } finally {
      setDesignCaptionBusy(false);
    }
  }

  if (
    webSessionChecked &&
    !telegram?.initData &&
    !["owner", "active"].includes(accessState)
  )
    return (
      <main className="web-login-page" dir="rtl">
        <section className="web-login-card">
          <img
            className="web-login-header"
            src={brandHeaders.kalametaze}
            alt="کلام تازه"
          />
          <h1>ورود به Kalam Studio</h1>
          <div className="choices" role="tablist" aria-label="روش ورود">
            <button
              className={webLoginMode === "phone" ? "selected" : ""}
              onClick={() => { setWebLoginMode("phone"); setWebLoginError(""); }}
              type="button"
            >
              ورود با موبایل
            </button>
            <button
              className={webLoginMode === "username" ? "selected" : ""}
              onClick={() => { setWebLoginMode("username"); setWebLoginError(""); }}
              type="button"
            >
              ورود با نام کاربری
            </button>
          </div>
          {webLoginMode === "phone" ? (
          <form onSubmit={submitWebSmsLogin}>
            <label>
              شمارهٔ موبایلِ ثبت‌شده
              <input
                dir="ltr"
                inputMode="tel"
                autoComplete="tel"
                value={webLoginPhone}
                onChange={(event) => { setWebLoginPhone(event.target.value); setWebLoginOtpSent(false); }}
                placeholder="09121234567"
                required
              />
            </label>
            {webLoginOtpSent && (
              <label>
                کد ۶ رقمی پیامک‌شده
                <input
                  dir="ltr"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={webLoginOtp}
                  onChange={(event) => setWebLoginOtp(event.target.value)}
                  required
                />
              </label>
            )}
            <label className="remember-login">
              <input
                checked={rememberWebLogin}
                onChange={(event) => setRememberWebLogin(event.target.checked)}
                type="checkbox"
              />
              <span>مرا به خاطر بسپار</span>
              <small>فقط روی دستگاه شخصی فعال کنید.</small>
            </label>
            {webLoginError && <p className="error">{webLoginError}</p>}
            <button className="primary web-login-submit" disabled={webLoginBusy} type="submit">
              {webLoginBusy ? "در حال بررسی…" : webLoginOtpSent ? "ورود به استودیو" : "دریافت کد ورود"}
            </button>
            {webLoginOtpSent && (
              <button className="link-button" disabled={webLoginBusy} onClick={() => { setWebLoginOtpSent(false); setWebLoginOtp(""); }} type="button">
                تغییر شمارهٔ موبایل
              </button>
            )}
          </form>
          ) : (
          <form onSubmit={submitWebLogin}>
            <label>
              نام کاربری
              <input
                dir="ltr"
                autoComplete="username"
                value={webLoginUsername}
                onChange={(event) => setWebLoginUsername(event.target.value)}
                required
              />
            </label>
            <label>
              رمز عبور
              <div className="password-input">
                <input
                  dir="ltr"
                  autoComplete="current-password"
                  type={showWebLoginPassword ? "text" : "password"}
                  value={webLoginPassword}
                  onChange={(event) => setWebLoginPassword(event.target.value)}
                  required
                />
                <button
                  aria-label={
                    showWebLoginPassword ? "مخفی‌کردن رمز" : "نمایش رمز"
                  }
                  onClick={() => setShowWebLoginPassword((current) => !current)}
                  type="button"
                >
                  {showWebLoginPassword ? "🙈" : "👁"}
                </button>
              </div>
            </label>
            <label className="remember-login">
              <input
                checked={rememberWebLogin}
                onChange={(event) => setRememberWebLogin(event.target.checked)}
                type="checkbox"
              />
              <span>مرا به خاطر بسپار</span>
              <small>فقط روی دستگاه شخصی فعال کنید.</small>
            </label>
            {webLoginError && <p className="error">{webLoginError}</p>}
            <button
              className="primary web-login-submit"
              disabled={webLoginBusy}
              type="submit"
            >
              {webLoginBusy ? "در حال ورود…" : "ورود به استودیو"}
            </button>
          </form>
          )}
          <small>
            ورود با موبایل با شمارهٔ کاریِ ثبت‌شده توسط مدیر اصلی فعال می‌شود.
          </small>
        </section>
      </main>
    );

  return (
    <main
      className={`app theme-${studioTheme}`}
      style={{ "--brand": brands[brand].color } as CSSProperties}
    >
      <header>
        <img
          className="brand-logo"
          src={brandHeaders[brand]}
          alt={`سربرگ ${brands[brand].label}`}
        />
        <div className="studio-title-actions">
          <h1>استودیو کلام تازه</h1>
          <div>
            {!telegram?.initData && (
              <button aria-label="خروج از حساب وب" className="web-logout" onClick={() => void signOutWeb()} title="خروج از حساب وب" type="button">↪</button>
            )}
            <button aria-label="سوژه خبری" className={`saved-archive-icon ${activeTab === "subjects" ? "active" : ""}`} onClick={() => setActiveTab(activeTab === "subjects" ? "create" : "subjects")} title="سوژه خبری" type="button"><BookmarkIcon /></button>
            <button aria-label="تغییر حالت نمایش" className="theme-toggle" onClick={() => setStudioTheme((current) => current === "dark" ? "light" : "dark")} title={studioTheme === "dark" ? "حالت روشن" : "حالت شب"} type="button">{studioTheme === "dark" ? "☀" : "☾"}</button>
            {["owner", "active"].includes(accessState) && <button aria-label="تنظیمات" className={`settings-gear ${activeTab === "settings" ? "active" : ""}`} onClick={() => setActiveTab(activeTab === "settings" ? "create" : "settings")} title={accessState === "owner" ? "تنظیمات" : "فهرست کاربران"} type="button">⚙</button>}
          </div>
        </div>
        <div className="header-action-stack">
          <button
            className={`engagement-header-link ${activeTab === "engagement" ? "active" : ""}`}
            onClick={() =>
              setActiveTab(activeTab === "engagement" ? "create" : "engagement")
            }
            type="button"
          >
            {activeTab === "engagement"
              ? "بازگشت به استودیو"
              : "پنل اینستاگرام"}
          </button>
          <button
            className={`news-header-link ${activeTab === "news" ? "active" : ""}`}
            onClick={() =>
              setActiveTab(activeTab === "news" ? "create" : "news")
            }
            type="button"
          >
            {activeTab === "news" ? "بازگشت به استودیو" : "جستجوگر خبر"}
          </button>
          <button
            className={`club-header-link ${activeTab === "club" ? "active" : ""}`}
            onClick={() =>
              setActiveTab(activeTab === "club" ? "create" : "club")
            }
            type="button"
          >
            {activeTab === "club" ? "بازگشت به استودیو" : "باشگاه مخاطبان"}
          </button>
        </div>
      </header>

      {formCollapsed && activeTab === "create" && (
        <section className="collapsed-form-card">
          <button onClick={() => setFormCollapsed(false)} type="button">
            نمایش فرم پروژهٔ آماده‌شده
          </button>
          <small>برای مشاهدهٔ تنظیمات قبلی، فرم را باز کنید.</small>
        </section>
      )}
      {formEditMode && activeTab === "create" && (
        <section className="editing-banner">
          <div>
            <b>در حال ویرایش تصویر</b>
            <small>
              فقط فیلدهای تغییرکرده روی نسخهٔ فعلی اعمال می‌شوند؛ بقیهٔ تصویر
              حفظ می‌شود.
            </small>
          </div>
          {activeOutputUrl && (
            <button
              className="editing-thumbnail"
              onClick={() =>
                setPreviewFile({
                  name: "خروجی در حال ویرایش",
                  url: activeOutputUrl,
                })
              }
              type="button"
            >
              <img src={activeOutputUrl} alt="تصویر در حال ویرایش" />
            </button>
          )}
          <button
            className="editing-close"
            onClick={() => {
              setFormEditMode(false);
              setFormCollapsed(true);
            }}
            type="button"
            aria-label="لغو ویرایش با فرم"
          >
            ×
          </button>
        </section>
      )}

      <section
        className={`card editorial-workspace ${activeTab === "editorial" ? "" : "tab-hidden"}`}
      >
        <div className="section-heading">
          <div>
            <h2>ویرایش متن خبر</h2>
            <p className="hint">
              فقط متن یا پیام خام را وارد کنید؛ ساختار خبر خودکار تشخیص داده
              می‌شود و خروجی انتخابی آمادهٔ کپی خواهد بود.
            </p>
          </div>
          <span className="revision-badge">
            {activeContentProject
              ? `نسخهٔ ${toPersianDigits(String(activeContentProject.revision))}`
              : "پروژهٔ جدید"}
          </span>
        </div>
        <div className="choices">
          <button
            className="secondary"
            onClick={startNewEditorialProject}
            type="button"
          >
            خبر جدید
          </button>
        </div>
        <label>
          رسانه
          <select
            value={brand}
            onChange={(event) => setBrand(event.target.value as Brand)}
          >
            {Object.entries(brands).map(([id, item]) => (
              <option key={id} value={id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <section className="video-form-card editorial-audio-upload">
          <h3>افزودن از فایل‌(های) صوتی</h3>
          <p className="hint">فایل ابتدا به‌صورت پایدار در پروژه و S3 ذخیره می‌شود؛ حتی برای فایل بلند، با بستن مرورگر یا رفرش گم نخواهد شد. متن نهایی به متن خام و کتابخانه اضافه می‌شود.</p>
          <label className="media-upload">+ انتخاب فایل صوتی<input accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/ogg,audio/aac,audio/flac,audio/webm,video/webm,video/mp4" multiple disabled={editorialAudioBusy || !transcriptionModelSettings?.available} onChange={(event) => { const files = Array.from(event.target.files ?? []); event.currentTarget.value = ""; void addEditorialAudio(files); }} type="file" /></label>
          {transcriptionModelSettings && <small className="hint">موتور: {transcriptionModelSettings.models.find((model) => model.id === transcriptionModelSettings.defaultTranscriptionModel)?.label ?? "—"} · سقف مصنوعی کوتاه برای طول متن اعمال نمی‌شود؛ ظرفیت واقعی سرویس و فضای فایل معیار است.</small>}
          {editorialAudioProgress && <progress max={editorialAudioProgress.total || 1} value={editorialAudioProgress.loaded} />}
          {editorialAudioBusy && <small>در حال ذخیرهٔ امن فایل صوتی…</small>}
          {editorialTranscriptionJobs.map((job) => <article className="video-presenter-contract" key={job.jobId}><b>{job.state === "completed" ? "پیاده‌سازی آماده" : job.state === "failed" ? "ناموفق" : "در حال پیاده‌سازی"}</b><small>{job.files.map((file) => file.filename).join("، ")} · {job.model}</small>{job.error && <small className="error">{job.error}</small>}</article>)}
        </section>
        <label>
          متن خام خبر
          <span className="choices"><button className="secondary" onClick={() => void navigator.clipboard.writeText(editorialRawText)} disabled={!editorialRawText} type="button">کپی متن خام</button></span>
          <textarea
            value={editorialRawText}
            onChange={(event) => {
              setEditorialRawText(event.target.value);
              setEditorialExtractedText("");
            }}
            placeholder="کل پیام تلگرامی، متن سایت یا متن خبر را اینجا وارد کنید"
            rows={10}
          />
        </label>
        <label>
          توضیحات تکمیلی برای موتور متن
          <textarea
            value={editorialAdditionalInstructions}
            onChange={(event) =>
              setEditorialAdditionalInstructions(event.target.value)
            }
            placeholder="اختیاری؛ مثل لحن، مخاطب، طول یا نکته‌ای که باید در خروجی رعایت شود"
            rows={3}
          />
        </label>
        {reporterProfile === "channel_teaser" && (
          <label>
            لینک عضویت کانال
            <input
              dir="ltr"
              value={channelJoinUrl}
              onChange={(event) => setChannelJoinUrl(event.target.value)}
              placeholder="https://t.me/your_channel"
              type="url"
            />
            <small>خروجی دقیقاً یک تیتر، جملهٔ دعوت و همین لینک را خواهد داشت.</small>
          </label>
        )}
        <section className="reporter-actions">
          <h3>نوع خروجی</h3>
          <p className="hint">
            در خروجی‌های اسلایدی، مدل اسلایدها را در فیلدهای جدا برمی‌گرداند تا
            قابل ویرایش و ارسال به استودیو باشند.
          </p>
          <div className="reporter-profile-groups">
            {(["خبر", "پیام مردمی", "ادمین"] as const).map((group) => (
              <div key={group}>
                <small>{group}</small>
                <div className="reporter-profile-cards">
                  {reporterProfileCards
                    .filter((profile) => profile.group === group)
                    .map((profile) => (
                      <button
                        aria-pressed={reporterProfile === profile.id}
                        className={
                          reporterProfile === profile.id ? "selected" : ""
                        }
                        key={profile.id}
                        onClick={() => {
                          setReporterProfile(profile.id);
                          if (profile.id !== "analysis") setReporterWebResearch(false);
                          setReporterOutput("");
                          setReporterOutputEditing(false);
                          setEditorialSlides([]);
                        }}
                        type="button"
                      >
                        <span className="reporter-profile-icon">
                          {profile.icon}
                        </span>
                        <span>
                          <b>{profile.label}</b>
                          <small>{profile.description}</small>
                        </span>
                        {reporterProfile === profile.id && (
                          <i aria-hidden="true">✓</i>
                        )}
                      </button>
                    ))}
                </div>
              </div>
            ))}
          </div>
          {reporterProfile === "analysis" && (
            <label className="modern-switch reporter-web-research-switch">
              <input
                checked={reporterWebResearch}
                onChange={(event) => setReporterWebResearch(event.target.checked)}
                type="checkbox"
              />
              <span className="switch-track" aria-hidden="true"><span /></span>
              <span>
                <b>جست‌وجوی وب به‌روز</b>
                <small>
                  خبرهای تازه و مرتبط جست‌وجو می‌شوند، منبع‌ها به مدل داده و همراه تاریخچهٔ تحلیل نگه‌داری می‌شوند.
                </small>
              </span>
            </label>
          )}
          <div className="choices">
            <button
              className="primary"
              disabled={reporterBusy || !editorialRawText.trim() || (reporterProfile === "channel_teaser" && !channelJoinUrl.trim())}
              onClick={() => void runReporter()}
              type="button"
            >
              {reporterBusy
                ? "در حال تحلیل و تولید خروجی…"
                : reporterOutput
                  ? "تلاش مجدد همین خروجی"
                  : "تولید خروجی"}
            </button>
          </div>
          {reporterOutput && (
            <article className="reporter-output">
              <div className="reporter-output-heading">
                <b>
                  {editorialSlides.length
                    ? "اسلایدهای قابل ویرایش"
                    : reporterProfile === "titles"
                      ? "تیترهای پیشنهادی"
                      : reporterProfile === "analysis"
                        ? "تحلیل"
                        : reporterProfile === "infographic_data"
                          ? "دادهٔ اینفوگرافی"
                          : reporterProfile === "channel_teaser"
                            ? "تیزر عضویت کانال"
                      : "خروجی پردازش‌شده"}
                </b>
                {reporterUsage && <small className="usage-note">{usageLabel(reporterUsage)}</small>}
                <span>
                  <button
                    aria-label="ویرایش خروجی"
                    className={
                      reporterOutputEditing ? "selected" : "link-button"
                    }
                    onClick={() =>
                      setReporterOutputEditing((current) => !current)
                    }
                    title="ویرایش خروجی"
                    type="button"
                  >
                    ✎
                  </button>
                  <button
                    aria-label="کپی خروجی"
                    className="link-button"
                    onClick={() =>
                      void navigator.clipboard?.writeText(reporterOutput)
                    }
                    title="کپی خروجی"
                    type="button"
                  >
                    ⧉
                  </button>
                </span>
              </div>
              {editorialSlides.length ? (
                <SlideDeckEditor
                  slides={editorialSlides}
                  onChange={setEditorialSlides}
                />
              ) : (
                <textarea
                  readOnly={!reporterOutputEditing}
                  value={reporterOutput}
                  onChange={(event) => setReporterOutput(event.target.value)}
                  rows={10}
                />
              )}
              <div className="choices">
                {!editorialSlides.length && (
                  <button
                    className="secondary"
                    onClick={() => {
                      setEditorialRawText(reporterOutput);
                      setEditorialExtractedText("");
                    }}
                    type="button"
                  >
                    جایگزینی متن خام با خروجی
                  </button>
                )}
                <button
                  className="secondary"
                  onClick={sendReporterOutputToStudio}
                  type="button"
                >
                  ساخت تصویر از خروجی ویرایش‌شده
                </button>
                <button
                  className="selected"
                  onClick={sendReporterOutputToPublish}
                  type="button"
                >
                  انتشار سریع
                </button>
                <button
                  className="secondary"
                  disabled={editorialSaving}
                  onClick={() => void saveEditorialToArchive()}
                  type="button"
                >
                  <BookmarkIcon /> ذخیره در سوژه خبری
                </button>
              </div>
              {(activeContentProject?.revisions?.length ?? 0) > 0 && (
                <details className="content-version-history">
                  <summary>نسخه‌های قبلی این متن ({toPersianDigits(String(activeContentProject?.revisions?.length ?? 0))})</summary>
                  {activeContentProject?.revisions?.slice().reverse().map((version) => (
                    <article key={`${version.revision}-${version.at}`}>
                      <b>نسخهٔ {toPersianDigits(String(version.revision))}</b>
                      <small>{new Date(version.at * 1000).toLocaleString("fa-IR")} · {version.message}</small>
                      <p>{version.article?.title || version.rawText?.slice(0, 220) || "بدون متن"}</p>
                    </article>
                  ))}
                </details>
              )}
            </article>
          )}
        </section>
        {editorialError && <p className="error">{editorialError}</p>}
        {editorialNotice && <p className="success">{editorialNotice}</p>}
        <div className="choices">
          <button
            className="primary"
            disabled={editorialSaving}
            onClick={() => void saveEditorialProject()}
            type="button"
          >
            {editorialSaving
              ? "در حال ذخیره…"
              : activeContentProject
                ? "ذخیرهٔ نسخهٔ جدید"
                : "ایجاد پروژهٔ محتوا"}
          </button>
          <button
            className="secondary"
            disabled={
              !activeContentProject &&
              !editorialArticle.title &&
              !editorialRawText
            }
            onClick={sendEditorialToStudio}
            type="button"
          >
            بازکردن در استودیو تصویر
          </button>
        </div>
        <div className="content-project-list">
          {contentProjects.length === 0 ? (
            <p className="hint">
              برای دیدن پروژه‌های قبلی، فهرست را به‌روزرسانی کنید.
            </p>
          ) : (
            contentProjects.map((project) => (
              <article
                className={`project-card ${activeContentProject?.contentProjectId === project.contentProjectId ? "active-project" : ""}`}
                key={project.contentProjectId}
              >
                <b>{project.title || "بدون تیتر"}</b>
                <small>
                  {brands[project.brand].label} · نسخهٔ{" "}
                  {toPersianDigits(String(project.revision))} ·{" "}
                  {new Date(project.updatedAt).toLocaleString("fa-IR")}
                </small>
                <button
                  onClick={() =>
                    void openContentProject(project.contentProjectId)
                  }
                  type="button"
                >
                  بازکردن
                </button>
              </article>
            ))
          )}
        </div>
      </section>

      <section
        className={`card publish-workspace ${activeTab === "publish" ? "" : "tab-hidden"}`}
      >
        <div className="section-heading">
          <div>
            <h2>انتشار سریع</h2>
            <p className="hint">
              خروجی را بازبینی و مقصد انتشار را انتخاب کنید. اجرای نهایی فقط پس
              از تأیید شما انجام می‌شود.
            </p>
          </div>
        </div>
        <label
          className={`publish-caption-field ${publishCaptionWarnings.length ? "publish-caption-overflow" : ""}`}
        >
          <span>متن آمادهٔ انتشار</span>
          <small className="hint">تیتر داخلی خودکار از خط اول متن برداشته و ذخیره می‌شود.</small>
          <RichTextEditor
            onChange={setPublishDraftText}
            placeholder="خروجی Reporter یا متن آمادهٔ انتشار"
            value={publishDraftText}
          />
          {publishCaptionWarnings.map((warning) => (
            <small className="caption-limit-warning" key={warning.platform}>
              این تعداد کاراکتر برای پلتفرم «
              {publishPlatforms.find((item) => item.id === warning.platform)
                ?.label ?? warning.platform}
              » در حالت کپشن مدیا غیرمجاز است. در صورت نپذیرفتن مقصد، ابتدا مدیا
              منتشر و سپس متن خبر به آخرین مدیا ریپلای می‌شود.
            </small>
          ))}
        </label>
        <section className="publish-unified-destinations">
          <h3>مقصدهای تکمیلی انتشار</h3>
          <p className="hint">
            سایت، یوتیوب و آپارات نیز هم‌زمان با پیام‌رسان‌ها از همین بسته منتشر
            می‌شوند.
          </p>
          <div className="choices">
            <button
              className={publishSiteTarget ? "selected" : ""}
              onClick={() => setPublishSiteTarget((current) => !current)}
              type="button"
            >
              🌐 سایت کلام تازه
            </button>
            {videoPlatforms.map((platform) => (
              <button
                className={
                  videoPublishTargets.includes(platform.id) ? "selected" : ""
                }
                key={platform.id}
                onClick={() => toggleVideoPublishTarget(platform.id)}
                type="button"
              >
                {platform.icon} {platform.label}
              </button>
            ))}
          </div>
          <small>
            برای سایت، یک تصویر ستاره‌دار لازم است؛ برای یوتیوب و آپارات، دست‌کم
            یک ویدیو.
          </small>
          <div className="choices">
            <button
              className="primary draft-unified-publish-button"
              disabled={
                publishBusy || !activeContentProject || !publishDraftText.trim()
              }
              onClick={() => void runUnifiedPublish()}
              type="button"
            >
              {publishBusy
                ? "در حال انتشار بسته…"
                : "بازبینی و انتشار انتخاب‌شده"}
            </button>
          </div>
        </section>
        {publishSiteTarget && (
          <section className="publish-site-fields">
            <div className="section-heading">
              <div>
                <h3>اطلاعات اختصاصی سایت</h3>
                <p className="hint">
                  تکمیل هوشمند اختیاری است؛ دسته و برچسب را می‌توانید مستقیماً
                  از خود سایت جست‌وجو و انتخاب کنید.
                </p>
              </div>
              <button
                className="sparkle-button"
                disabled={publishSiteBusy || !activeContentProject}
                onClick={() => void fillSitePublishFields()}
                type="button"
              >
                {publishSiteBusy ? "در حال تکمیل…" : "✦ تکمیل هوشمند"}
              </button>
            </div>
            <section className="site-media-picker">
              <b>عکس شاخص سایت</b>
              <p className="hint">
                از فهرست فایل‌های همین پروژه یک تصویر را با ستاره انتخاب کنید؛
                انتخاب سایت مستقل از فایل‌های کانال است.
              </p>
              {siteFeaturedMediaId || publishPhotoRequestId ? (
                <small>عکس شاخص انتخاب شده است.</small>
              ) : (
                <small className="error">یک عکس شاخص انتخاب کنید.</small>
              )}
            </section>
            <label>
              روتیتر
              <textarea
                rows={2}
                value={publishSiteArticle.kicker ?? ""}
                onChange={(event) =>
                  setPublishSiteArticle((current) => ({
                    ...current,
                    kicker: event.target.value,
                  }))
                }
              />
            </label>
            <label className="title-field">
              تیتر
              <textarea
                rows={3}
                value={publishSiteArticle.title ?? ""}
                onChange={(event) =>
                  setPublishSiteArticle((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              لید
              <textarea
                rows={3}
                value={publishSiteArticle.lead ?? ""}
                onChange={(event) =>
                  setPublishSiteArticle((current) => ({
                    ...current,
                    lead: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              متن خبر
              <textarea
                rows={10}
                value={publishSiteArticle.body ?? ""}
                onChange={(event) =>
                  setPublishSiteArticle((current) => ({
                    ...current,
                    body: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              منبع
              <input
                value={publishSiteArticle.source ?? ""}
                onChange={(event) =>
                  setPublishSiteArticle((current) => ({
                    ...current,
                    source: event.target.value,
                  }))
                }
              />
            </label>
            <section className="site-term-picker">
              <b>دسته‌بندی‌های سایت</b>
              <div>
                <input
                  value={siteTermSearch.categories}
                  onChange={(event) =>
                    setSiteTermSearch((current) => ({
                      ...current,
                      categories: event.target.value,
                    }))
                  }
                  placeholder="جست‌وجو در دسته‌بندی‌های سایت"
                />
                <button
                  disabled={siteTermBusy === "categories"}
                  onClick={() => void searchSiteTerms("categories")}
                  type="button"
                >
                  {siteTermBusy === "categories" ? "…" : "جست‌وجو"}
                </button>
              </div>
              <div className="site-term-options">
                {siteTermResults.categories.map((item) => (
                  <button
                    className={
                      publishSiteCategoryIds.includes(item.id) ? "selected" : ""
                    }
                    key={item.id}
                    onClick={() => selectSiteTerm("categories", item)}
                    type="button"
                  >
                    {item.name}
                  </button>
                ))}
              </div>
              <small>
                {publishSiteCategories || "هنوز دسته‌ای انتخاب نشده است."}
              </small>
            </section>
            <section className="site-term-picker">
              <b>برچسب‌های سایت</b>
              <div>
                <input
                  value={siteTermSearch.tags}
                  onChange={(event) =>
                    setSiteTermSearch((current) => ({
                      ...current,
                      tags: event.target.value,
                    }))
                  }
                  placeholder="جست‌وجو در برچسب‌های موجود"
                />
                <button
                  disabled={siteTermBusy === "tags"}
                  onClick={() => void searchSiteTerms("tags")}
                  type="button"
                >
                  {siteTermBusy === "tags" ? "…" : "جست‌وجو"}
                </button>
              </div>
              <div className="site-term-options">
                {siteTermResults.tags.map((item) => (
                  <button
                    className={
                      publishSiteTagIds.includes(item.id) ? "selected" : ""
                    }
                    key={item.id}
                    onClick={() => selectSiteTerm("tags", item)}
                    type="button"
                  >
                    {item.name}
                  </button>
                ))}
              </div>
              {siteTermSearch.tags.trim() &&
                !siteTermResults.tags.some(
                  (item) => item.name === siteTermSearch.tags.trim(),
                ) && (
                  <button
                    className="new-site-tag"
                    onClick={addNewSiteTag}
                    type="button"
                  >
                    + ثبت «{siteTermSearch.tags.trim()}» به‌عنوان برچسب جدید
                  </button>
                )}
              <small>{publishSiteTags || "هنوز برچسبی انتخاب نشده است."}</small>
            </section>
          </section>
        )}
        <section className="publish-targets">
          <h3>مقصدهای انتشار متن</h3>
          <p className="hint">
            فقط مقصدهای انتخاب‌شده منتشر می‌شوند. هر مقصد جداگانه نتیجهٔ موفق یا
            خطا دارد.
          </p>
          <div className="publish-target-grid">
            {publishPlatforms.map((platform) => (
              <article key={platform.id}>
                <b>{platform.label}</b>
                <div className="choices">
                  {(
                    Object.entries(brands) as [Brand, (typeof brands)[Brand]][]
                  ).map(([brandId, item]) => {
                    const target =
                      `${platform.id}_${publishBrandSuffix[brandId]}` as PublicationTarget;
                    return (
                      <button
                        className={
                          publishTargets.includes(target) ? "selected" : ""
                        }
                        key={target}
                        onClick={() => togglePublishTarget(target)}
                        type="button"
                      >
                        <span
                          className="dot"
                          style={{ background: item.color }}
                        />
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        </section>
        <section className="publish-forward-settings">
          <h3>روش انتشار چندرسانه‌ای</h3>
          <p className="hint">
            وقتی برای یک پیام‌رسان بیش از یک رسانه انتخاب شود، می‌توانید هر
            کانال را جداگانه منتشر کنید یا نخست در یک کانال منتشر و سپس به بقیه
            فوروارد کنید.
          </p>
          {publishPlatforms.map((platform) => {
            const platformTargets = publishTargets.filter((target) =>
              target.startsWith(`${platform.id}_`),
            );
            const plan = publishForwardPlan[platform.id];
            if (platformTargets.length < 2) return null;
            return (
              <article key={platform.id}>
                <b>{platform.label}</b>
                <div className="choices">
                  <button
                    className={
                      (plan?.mode ?? "separate") === "separate"
                        ? "selected"
                        : ""
                    }
                    onClick={() =>
                      setPlatformForwardMode(platform.id, "separate")
                    }
                    type="button"
                  >
                    هر کانال جدا
                  </button>
                  <button
                    className={plan?.mode === "forward" ? "selected" : ""}
                    onClick={() =>
                      setPlatformForwardMode(platform.id, "forward")
                    }
                    type="button"
                  >
                    فوروارد از یک کانال
                  </button>
                </div>
                {plan?.mode === "forward" && (
                  <div className="forward-source">
                    <small>رسانهٔ مرجع فوروارد را انتخاب کنید</small>
                    {platformTargets.map((target) => (
                      <button
                        className={
                          plan.sourceTarget === target ? "selected" : ""
                        }
                        key={target}
                        onClick={() =>
                          setPlatformForwardSource(platform.id, target)
                        }
                        type="button"
                      >
                        <span className="star">★</span>
                        {target.replace(`${platform.id}_`, "")}
                      </button>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </section>
        {(activeContentProject?.designProjects?.length ?? 0) > 0 && (
          <section className="publish-photo-picker">
            <h3>انتشار با تصویر آماده</h3>
            <p className="hint">
              آخرین خروجی AI هر پروژهٔ تصویر، با کیفیت اصلی ارسال می‌شود. برای
              سایت، همین تصویر یا فایل ستاره‌دارِ پایین عکس شاخص خواهد بود.
            </p>
            <div className="choices">
              {activeContentProject?.designProjects?.map((design) => (
                <button
                  className={
                    publishPhotoRequestId === design.requestId ? "selected" : ""
                  }
                  key={design.requestId}
                  onClick={() => {
                    setPublishPhotoRequestId(design.requestId);
                    setSiteFeaturedMediaId("");
                    setPublishResult(undefined);
                    setPublishError("");
                    setPublishRequestKey(crypto.randomUUID());
                  }}
                  type="button"
                >
                  {design.title || "تصویر خبر"} · {design.requestId.slice(0, 8)}
                </button>
              ))}
            </div>
            {publishPhotoRequestId && (
              <div className="choices">
                <button
                  className="secondary"
                  onClick={editSelectedPublishImage}
                  type="button"
                >
                  ویرایش/تغییر تصویر در استودیو
                </button>
                <button
                  className="link-button"
                  onClick={() => {
                    setPublishPhotoRequestId("");
                    setPublishResult(undefined);
                    setPublishRequestKey(crypto.randomUUID());
                  }}
                  type="button"
                >
                  حذف تصویر از انتشار
                </button>
              </div>
            )}
          </section>
        )}
        <section className="publish-media-tray">
          <h3>فایل‌های انتشار</h3>
          <p className="hint">
            تصویر یا ویدیوی تک/چندتایی را به همین خبر متصل کنید. فایل‌ها ذخیره
            می‌شوند و با تغییر تب یا رفرش از بین نمی‌روند. ستارهٔ طلایی، عکس
            شاخص سایت است.
          </p>
          <label className="media-upload">
            {publishMediaBusy
              ? "در حال بارگذاری فایل‌ها…"
              : "افزودن تصویر یا ویدیو"}
            <input
              accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
              disabled={publishMediaBusy}
              multiple
              onChange={(event) => void addPublishFiles(event)}
              type="file"
            />
          </label>
          {!activeContentProject && (
            <small className="media-help">
              با واردکردن تیتر پیش‌نویس، هنگام انتخاب فایل پیش‌نویس خبر به‌صورت
              خودکار ساخته می‌شود.
            </small>
          )}
          <div className="publish-media-list">
            <UploadQueueRows items={publishUploadQueue.filter((item) => publishMediaBusy || item.status === "failed")} />
            {(activeContentProject?.media ?? []).length === 0 ? (
              <small className="media-help">
                هنوز فایل مستقلی به این انتشار افزوده نشده است.
              </small>
            ) : (
              activeContentProject?.media?.map((media) => {
                const compressionLimit =
                  media.kind === "video"
                    ? selectedVideoCompressionLimit(publishTargets)
                    : undefined;
                const needsCompression =
                  compressionLimit !== undefined &&
                  media.bytes > compressionLimit * 1024 * 1024 * 0.92;
                return (
                  <article
                    className={
                      publishMediaIds.includes(media.mediaId)
                        ? "selected-media"
                        : ""
                    }
                    key={media.mediaId}
                  >
                    <span>{media.kind === "video" ? "🎬" : "🖼️"}</span>
                    <div>
                      <b>{media.filename}</b>
                      <small>
                        {Math.max(
                          1,
                          Math.ceil(media.bytes / 1024 / 1024),
                        ).toLocaleString("fa-IR")}{" "}
                        مگابایت · {media.kind === "video" ? "ویدیو" : "تصویر"}
                      </small>
                    </div>
                    <button
                      aria-label={`نمایش ${media.filename}`}
                      disabled={publishMediaBusy}
                      onClick={() => void previewPublishMedia(media)}
                      title="نمایش"
                      type="button"
                    >
                      ◉
                    </button>
                    {media.kind === "image" && (
                      <button
                        aria-label={`انتخاب ${media.filename} به‌عنوان عکس شاخص سایت`}
                        aria-pressed={siteFeaturedMediaId === media.mediaId}
                        className={
                          siteFeaturedMediaId === media.mediaId
                            ? "selected"
                            : ""
                        }
                        disabled={publishMediaBusy}
                        onClick={() => {
                          const isSelected =
                            siteFeaturedMediaId === media.mediaId;
                          setSiteFeaturedMediaId(
                            isSelected ? "" : media.mediaId,
                          );
                          if (!isSelected) setPublishPhotoRequestId("");
                          setPublishResult(undefined);
                          setPublishError("");
                          setPublishRequestKey(crypto.randomUUID());
                        }}
                        title="عکس شاخص سایت"
                        type="button"
                      >
                        ★
                      </button>
                    )}
                    {needsCompression && (
                      <button
                        aria-label={`فشرده‌سازی ${media.filename}`}
                        className="media-compress"
                        disabled={publishMediaBusy}
                        onClick={() => void compressPublishVideo(media)}
                        title="نسخهٔ اصلی حفظ می‌شود و نسخهٔ سازگار خودکار انتخاب خواهد شد"
                        type="button"
                      >
                        فشرده‌سازی ≤ {compressionLimit!.toLocaleString("fa-IR")}
                        MB
                      </button>
                    )}
                    <button
                      aria-label={`انتخاب ${media.filename} برای انتشار`}
                      aria-pressed={publishMediaIds.includes(media.mediaId)}
                      className="media-select"
                      disabled={publishMediaBusy}
                      onClick={() => {
                        setPublishMediaIds((current) =>
                          current.includes(media.mediaId)
                            ? current.filter((id) => id !== media.mediaId)
                            : [...current, media.mediaId],
                        );
                        setPublishResult(undefined);
                        setPublishError("");
                        setPublishRequestKey(crypto.randomUUID());
                      }}
                      title="انتخاب برای انتشار"
                      type="button"
                    >
                      ✓
                    </button>
                    <button
                      aria-label={`حذف ${media.filename}`}
                      disabled={publishMediaBusy}
                      onClick={() => void removePublishMedia(media)}
                      title="حذف"
                      type="button"
                    >
                      ×
                    </button>
                  </article>
                );
              })
            )}
          </div>
        </section>
        <section className="publish-targets video-platform-targets">
          <h3>انتشار ویدیو در پلتفرم‌ها</h3>
          <p className="hint">
            برای آپارات و یوتیوب، حداقل یک فایل ویدیو را از فهرست بالا انتخاب
            کنید. تصویرهای کناری به این دو پلتفرم ارسال نمی‌شوند.
          </p>
          <div className="choices">
            {videoPlatforms.map((platform) => (
              <button
                className={
                  videoPublishTargets.includes(platform.id) ? "selected" : ""
                }
                key={platform.id}
                onClick={() => toggleVideoPublishTarget(platform.id)}
                type="button"
              >
                <span aria-hidden="true">{platform.icon}</span>
                {platform.label}
              </button>
            ))}
          </div>
        </section>
        {publishError && <p className="error">{publishError}</p>}
        {publishNotice && <p className="publication-notice">{publishNotice}</p>}
        {publishActivityLog.length > 0 && (
          <section
            className={`publication-result publication-activity ${publishBusy ? "state-processing" : publishResult ? `state-${publishResult.status}` : ""}`}
          >
            <b>
              {publishBusy
                ? "در حال ارسال بستهٔ انتشار…"
                : publishResult?.status === "published"
                  ? "انتشار در همهٔ مقصدهای انتخاب‌شده موفق بود."
                  : publishResult?.status === "partial"
                    ? "بخشی از مقصدها منتشر شدند."
                    : publishResult?.status === "failed"
                      ? "انتشار ناموفق بود."
                      : publishResult?.status === "uncertain"
                        ? "نتیجهٔ یک یا چند مقصد هنوز نیازمند بررسی است."
                        : "گزارش انتشار"}
            </b>
            {(publishBusy || publishActivityLog.some((item) => item.status === "pending" || item.status === "uncertain")) && activeContentProject && (
              <button
                className="icon-button publication-refresh"
                type="button"
                aria-label="به‌روزرسانی نتیجهٔ ارسال"
                title="به‌روزرسانی نتیجهٔ ارسال"
                onClick={() => void refreshPublicationResult()}
                disabled={publishBusy}
              >
                ⟳
              </button>
            )}
            <div className="publication-lines">
              {publishActivityLog.map((item) => (
                <div
                  className={`publication-line state-${item.status}`}
                  key={item.target}
                >
                  <span aria-hidden="true">
                    {item.status === "pending"
                      ? "◌"
                      : item.status === "published"
                        ? "✓"
                        : item.status === "uncertain"
                          ? "?"
                          : "!"}
                  </span>
                  {item.status === "published" && item.url ? (
                    <span className="publication-link-actions">
                      <a
                        href={item.url}
                        rel="noreferrer"
                        target="_blank"
                        title="بازکردن پست منتشرشده"
                      >
                        {item.target === "site"
                          ? "سایت کلام تازه"
                          : item.target.replace("_", " · ")}
                      </a>
                      <button
                        aria-label="کپی لینک پست منتشرشده"
                        onClick={() => void copyPublicationLink(item.url!)}
                        title="کپی لینک"
                        type="button"
                      >
                        ⧉
                      </button>
                    </span>
                  ) : (
                    <b>
                      {item.target === "site"
                        ? "سایت کلام تازه"
                        : item.target.replace("_", " · ")}
                    </b>
                  )}
                  <small>
                    {item.status === "pending"
                      ? "در صف ارسال"
                      : item.status === "published"
                        ? "منتشر شد"
                        : item.status === "uncertain"
                          ? `نیازمند بررسی${item.error ? `؛ ${item.error}` : ""}`
                          : `ناموفق${item.error ? `؛ ${item.error}` : ""}`}
                  </small>
                </div>
              ))}
            </div>
          </section>
        )}
        {(publishResult?.events?.length ?? 0) > 0 && (
          <details className="publication-events">
            <summary>لاگ فنی همین انتشار</summary>
            <div>
              {publishResult!
                .events!.slice(-20)
                .reverse()
                .map((event, index) => (
                  <p
                    key={`${event.at}-${event.event}-${event.target ?? ""}-${index}`}
                  >
                    <time>
                      {new Date(event.at * 1000).toLocaleTimeString("fa-IR")}
                    </time>
                    <b>
                      {event.event === "publication_started"
                        ? "شروع انتشار"
                        : event.event === "destination_finished"
                          ? "پاسخ مقصد"
                          : "پایان انتشار"}
                    </b>
                    {event.target && (
                      <span>{event.target.replace("_", " · ")}</span>
                    )}
                    {event.status && (
                      <i>
                        {event.status === "uncertain"
                          ? "نیازمند بررسی"
                          : event.status === "published"
                            ? "موفق"
                            : event.status === "failed"
                              ? "ناموفق"
                              : event.status}
                      </i>
                    )}
                    {event.error && <small>{event.error}</small>}
                  </p>
                ))}
            </div>
          </details>
        )}
        <div className="choices publish-final-actions">
          <button
            className="primary unified-publish-button"
            disabled={
              publishBusy ||
              !activeContentProject ||
              !publishDraftText.trim() ||
              (!publishSiteTarget && publishTargets.length === 0)
            }
            onClick={() => void runUnifiedPublish()}
            type="button"
          >
            {publishBusy
              ? "در حال آماده‌سازی و انتشار…"
              : "نمایش پیش‌نمایش نهایی"}
          </button>
          <button
            className="secondary"
            onClick={() => setActiveTab("editorial")}
            type="button"
          >
            بازگشت به ویرایش متن
          </button>
        </div>
        <p className="hint">
          انتشار متن، فایل، سایت و ویدیو هرکدام ثبت جداگانه و نتیجهٔ مقصدبه‌مقصد
          دارند.
        </p>
      </section>

      <section
        className={`card ${activeTab === "create" ? "" : "tab-hidden"} ${formCollapsed && designSlides.length <= 1 ? "form-hidden" : ""} ${activeJob?.state === "completed" && !formEditMode && designSlides.length <= 1 ? "form-readonly" : ""}`}
      >
        <h2>۱. رسانه و قالب</h2>
        <div className="choices brand-grid">
          {(Object.entries(brands) as [Brand, (typeof brands)[Brand]][]).map(
            ([id, item]) => (
              <button
                className={brand === id ? "selected" : ""}
                key={id}
                onClick={() => setBrand(id)}
                type="button"
              >
                <span className="dot" style={{ background: item.color }} />
                {item.label}
              </button>
            ),
          )}
        </div>
        <div className="choices">
          {template === "sticker" ? (
            <button className="selected" type="button">استیکر مربع ۱۰۲۴×۱۰۲۴</button>
          ) : (
            <>
              <button
                className={canvas === "story_1080x1920" ? "selected" : ""}
                onClick={() => chooseCanvas("story_1080x1920")}
                type="button"
              >
                استوری ۱۰۸۰×۱۹۲۰
              </button>
              <button
                className={canvas === "post_1080x1350" ? "selected" : ""}
                onClick={() => chooseCanvas("post_1080x1350")}
                type="button"
              >
                پست ۱۰۸۰×۱۳۵۰
              </button>
            </>
          )}
        </div>
        <div className="choices">
          <button
            className={templateGroup === "news" ? "selected" : ""}
            onClick={() => chooseTemplateGroup("news")}
            type="button"
          >
            قالب خبری
          </button>
          <button
            className={templateGroup === "non_news" ? "selected" : ""}
            onClick={() => chooseTemplateGroup("non_news")}
            type="button"
          >
            قالب غیرخبری
          </button>
          <button className={templateGroup === "studio" ? "selected" : ""} onClick={() => chooseTemplateGroup("studio")} type="button">تصویر استودیو</button>
        </div>
        <label>
          نوع قالب
          <select
            value={template}
            onChange={(event) => chooseTemplate(event.target.value)}
          >
            {visibleTemplates.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        {template === "club_showcase" && <ClubShowcaseFields initData={telegram?.initData} value={clubShowcase} onChange={setClubShowcase} onImages={replaceShowcaseImages} />}
        {template === "club_promotion" && <p className="hint">پوستر دعوت به عضویت؛ لوگوی رسمی باشگاه خودکار روی خروجی قرار می‌گیرد. تیتر دعوت، مزیت عضویت و راه ورود را در فیلدها بنویسید. فقط امتیازها و هدیه‌های واقعی را ذکر کنید.</p>}
        {template.startsWith("club_") && !["club_showcase", "club_promotion"].includes(template) && <p className="hint">محتوای ارسالی اعضای باشگاه؛ نام مخاطب را فقط با اجازه او درج کنید. عکس‌های ارسالی را در بخش تصاویر مرجع اضافه کنید.</p>}
        {templateGroup === "studio" && <section className="studio-image-controls">
          <h3>کاراکتر و صحنه</h3>
          <p className="hint">حالت خودکار مناسب‌ترین تصویر را بر اساس قاب برمی‌گزیند؛ برای کنترل دقیق‌تر می‌توانید انتخاب دستی را برای هر کاراکتر یا لوکیشن فعال کنید.</p>
          <p className={`reference-budget ${studioReferenceCount > studioImageReferenceLimit ? "over-limit" : ""}`}>بودجهٔ تصویرساز: {toPersianDigits(String(studioReferenceCount))} از {toPersianDigits(String(studioImageReferenceLimit))} ورودی؛ شامل مرجع‌های خودکار/دستی، تصاویر آپلودی کاربر و تصاویر مانیتور.</p>
          <div className="choices">{Object.entries(presenterLabels).map(([id, label]) => <button className={studioPresenterIds.includes(id) ? "selected" : ""} key={id} onClick={() => setStudioPresenterIds((current) => current.includes(id) ? (current.length > 1 ? current.filter((item) => item !== id) : current) : [...current, id])} type="button">{label}</button>)}</div>
          <div className="studio-character-grid">{studioPresenterIds.map((id) => <article className="studio-character-card" key={id}>
            <b>{presenterLabels[id]}</b>
            <label>حالت چهره<input maxLength={120} value={studioExpressions[id] ?? ""} onChange={(event) => setStudioExpressions((current) => ({ ...current, [id]: event.target.value }))} placeholder="مثلاً آرام، مطمئن، لبخند ملایم، متفکر" /></label>
            <label>توضیحات تکمیلی این کاراکتر<textarea maxLength={600} value={studioCharacterInstructions[id] ?? ""} onChange={(event) => setStudioCharacterInstructions((current) => ({ ...current, [id]: event.target.value }))} placeholder="مثلاً سمت راست قاب بایستد، با دست چپ به عنوان اشاره کند، پوشش رسمی و حالت بدن رو به دوربین باشد" /></label>
            <div className="studio-speech-bubbles"><b>حباب گفت‌وگو (حداکثر ۳ مورد)</b><small className="hint">متن هر حباب دقیقاً از زبان همین کاراکتر، با ظاهر شیشه‌ای و دنبالهٔ رو به او در تصویر نوشته می‌شود.</small>{(studioSpeechBubbles[id] ?? []).map((bubble, index) => <div className="studio-speech-bubble-row" key={`${id}-${index}`}><textarea maxLength={220} rows={2} value={bubble} onChange={(event) => setStudioSpeechBubbles((current) => ({ ...current, [id]: (current[id] ?? []).map((item, itemIndex) => itemIndex === index ? event.target.value : item) }))} placeholder="مثلاً: خبرهای مهم امروز را با ما دنبال کنید" /><button className="danger-link" onClick={() => setStudioSpeechBubbles((current) => ({ ...current, [id]: (current[id] ?? []).filter((_, itemIndex) => itemIndex !== index) }))} type="button">حذف حباب</button></div>)}{(studioSpeechBubbles[id] ?? []).length < 3 && <button className="secondary" onClick={() => setStudioSpeechBubbles((current) => ({ ...current, [id]: [...(current[id] ?? []), ""] }))} type="button">＋ افزودن حباب گفت‌وگو</button>}</div>
            {(() => { const choice = studioPresenterReferences[id] ?? automaticReferenceChoice(); return <ReferenceAssetPicker assets={studioAssetRegistry?.assets.filter((asset) => asset.kind === "presenter" && asset.entityId === id && asset.scope !== "project") ?? []} choice={choice} limit={studioReferenceChoiceLimit(choice)} onChange={(next) => setStudioPresenterReferences((current) => ({ ...current, [id]: next }))} title={`مشاهده و انتخاب تصاویر ${presenterLabels[id]}`} />; })()}
          </article>)}</div>
          <label>منطق لوکیشن<select value={studioLocationMode} onChange={(event) => setStudioLocationMode(event.target.value as StudioLocationMode)}><option value="catalog">لوکیشن ذخیره‌شده</option><option value="generated_prompt">ساخت تصویر زمینه با پرامپت</option><option value="exact_reference">استفاده مستقیم از عکس/فیلم مرجع</option><option value="faithful_reference">استفاده وفادار از عکس/فیلم مرجع</option></select></label>
          {studioLocationMode === "catalog" && <label>لوکیشن<select value={studioLocationId} onChange={(event) => { setStudioLocationId(event.target.value); setStudioLocationReferences(automaticReferenceChoice()); setStudioLocationAssetIds([]); }}>{Object.entries(locationLabels).map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select></label>}
          {studioLocationMode === "catalog" && <ReferenceAssetPicker assets={studioAssetRegistry?.assets.filter((asset) => asset.kind === "location" && asset.entityId === studioLocationId && asset.scope !== "project") ?? []} choice={studioLocationReferences} limit={studioReferenceChoiceLimit(studioLocationReferences)} onChange={setStudioLocationReferences} title="مشاهده و انتخاب تصاویر این لوکیشن" />}
          {studioLocationMode === "generated_prompt" && <label>پرامپت اختصاصی ساخت زمینه<textarea maxLength={1200} rows={4} value={studioLocationPrompt} onChange={(event) => setStudioLocationPrompt(event.target.value)} placeholder="معماری، محیط، نور، زاویهٔ دوربین، مسیر حرکت و فضای لازم برای کاراکتر را توصیف کنید" /></label>}
          {studioLocationMode === "faithful_reference" && <label>توضیحات استفادهٔ وفادار از مرجع<textarea maxLength={1000} rows={4} value={studioLocationReferenceInstructions} onChange={(event) => setStudioLocationReferenceInstructions(event.target.value)} placeholder="مثلاً هندسه و نور حفظ شود، فقط قاب برای حضور مجری بازتر شود؛ این متن فقط روی لوکیشن اثر می‌گذارد" /></label>}
          {["exact_reference", "faithful_reference"].includes(studioLocationMode) && <section className="video-location-assets"><span>عکس/فیلم مرجع لوکیشن</span><ProjectReferenceGrid assets={studioAssetRegistry?.assets.filter((asset) => asset.kind === "location" && asset.entityId === studioLocationId && asset.scope === "project") ?? []} selectedIds={studioLocationAssetIds} canSelect={(assetId) => studioLocationAssetIds.includes(assetId) || studioReferenceCount < studioImageReferenceLimit} onToggle={(assetId) => setStudioLocationAssetIds((current) => current.includes(assetId) ? current.filter((id) => id !== assetId) : [...current, assetId])} onDelete={(assetId) => void deleteStudioLocationReference(assetId)} /><label className="media-upload">+ افزودن عکس یا فیلم مرجع<input accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" multiple onChange={(event) => { const incoming = Array.from(event.target.files ?? []); event.currentTarget.value = ""; void addStudioLocationReferences(incoming); }} type="file" /></label><small className="hint">از فیلم یک فریم مرجع امن استخراج می‌شود تا سقف ورودی تصویرساز رعایت شود.</small><div className="publish-media-list"><UploadQueueRows items={studioLocationUploadQueue.filter((item) => item.status !== "completed")} /></div></section>}
          <fieldset className="studio-text-controls">
            <legend>متن اصلی و محتوای مانیتور</legend>
            <div className="studio-text-mode-grid">
              <button className={studioTextMode === "monitor" ? "selected" : ""} onClick={() => setStudioTextMode("monitor")} type="button"><b>بدون تیتر پوستری</b><small>فقط تنظیم مستقل نمایشگرها اجرا می‌شود.</small></button>
              <button className={studioTextMode === "designed" ? "selected" : ""} onClick={() => setStudioTextMode("designed")} type="button"><b>طراحی متن با هوش مصنوعی</b><small>خروجی پوستر حرفه‌ای با تایپوگرافی و تعامل کاراکتر ساخته می‌شود.</small></button>
            </div>
            {studioTextMode === "designed" && <label>عنوان یا متن پوستر<textarea maxLength={240} value={studioText} onChange={(event) => setStudioText(event.target.value)} placeholder="متن فارسی را دقیقاً همان‌طور که باید طراحی شود وارد کنید." /></label>}
            <div className="studio-monitor-panel">
              <b>محتوای مانیتور(ها)</b>
              <ModernSwitch checked={studioMonitorEnabled} onChange={(enabled) => { setStudioMonitorEnabled(enabled); if (!enabled) { setStudioMonitorFiles([]); setStudioMonitorMode("disabled"); } else if (studioMonitorMode === "disabled") setStudioMonitorMode("text"); }} label="مانیتور فعال باشد" />
              {studioMonitorEnabled && <>
              <div className="studio-text-mode-grid">
                <button className={studioMonitorMode === "text" ? "selected" : ""} onClick={() => setStudioMonitorMode("text")} type="button"><b>نوشتن تیتر</b><small>متن دقیق روی مانیتور نمایش داده می‌شود.</small></button>
                <button className={studioMonitorMode === "images" ? "selected" : ""} onClick={() => setStudioMonitorMode("images")} type="button"><b>عکس داخل مانیتور</b><small>فقط داخل نمایشگرهای واقعیِ لوکیشن قرار می‌گیرد.</small></button>
                <button className={studioMonitorMode === "blank" ? "selected" : ""} onClick={() => setStudioMonitorMode("blank")} type="button"><b>مانیتور خالی</b><small>نمایشگر روشن اما بدون متن و تصویر محتوایی.</small></button>
              </div>
              {studioMonitorMode === "text" && <label>متن دقیق مانیتور<textarea maxLength={240} value={studioMonitorText} onChange={(event) => setStudioMonitorText(event.target.value)} placeholder="تیتر کوتاه فارسی" /></label>}
              {studioMonitorMode === "images" && <>
                <div className="studio-text-mode-grid">
                  <button className={studioMonitorImageMode === "generate" ? "selected" : ""} onClick={() => setStudioMonitorImageMode("generate")} type="button"><b>ساخت عکس جدید</b><small>بر اساس موضوع خبر</small></button>
                  <button className={studioMonitorImageMode === "reference" ? "selected" : ""} onClick={() => setStudioMonitorImageMode("reference")} type="button"><b>استفاده از مرجع</b><small>بازترکیب هماهنگ با صحنه</small></button>
                  <button className={studioMonitorImageMode === "preserve" ? "selected" : ""} onClick={() => setStudioMonitorImageMode("preserve")} type="button"><b>استفادهٔ وفادار</b><small>حفظ دقیق محتوای تصویر</small></button>
                </div>
                <label>موضوع خبر / توضیح تصویر مانیتور<textarea maxLength={800} value={studioMonitorBrief} onChange={(event) => setStudioMonitorBrief(event.target.value)} placeholder="موضوع، رویداد، فضای بصری و جزئیات ضروری تصویر خبری" /></label>
                <label>حداکثر نمایشگرهای موجود برای محتوا<select value={studioMonitorImageCount} onChange={(event) => setStudioMonitorImageCount(Number(event.target.value))}>{[1, 2, 3, 4].map((count) => <option key={count} value={count}>{toPersianDigits(String(count))}</option>)}</select><small>اگر عکس لوکیشن نمایشگر نداشته باشد، هیچ نمایشگر تازه‌ای ساخته نمی‌شود.</small></label>
                {studioMonitorImageMode !== "generate" && <>
                  <label className="reference-upload">تصاویر اختصاصی مانیتور<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => { const incoming = Array.from(event.target.files ?? []); event.currentTarget.value = ""; setStudioMonitorFiles((current) => [...current, ...incoming].slice(0, 8)); }} /><span>＋ افزودن یک یا چند تصویر</span></label>
                  {!!studioMonitorFilePreviews.length && <div className="reference-grid">{studioMonitorFilePreviews.map(({ file, url }) => <figure key={`${file.name}-${file.lastModified}`}><img src={url} alt={file.name} /><figcaption>{file.name}</figcaption><div><button aria-label={`نمایش ${file.name}`} onClick={() => setPreviewFile({ name: file.name, url })} type="button">◉</button><button aria-label={`حذف ${file.name}`} onClick={() => setStudioMonitorFiles((current) => current.filter((item) => item !== file))} type="button">×</button></div></figure>)}</div>}
                </>}
              </>}
              </>}
            </div>
            <label className="studio-title-space-toggle"><input checked={studioTitleSpaceEnabled} onChange={(event) => setStudioTitleSpaceEnabled(event.target.checked)} type="checkbox" /><span><b>فضای طبیعی برای کپشن یا عنوان</b><small>یک خلوت واقعی از خودِ صحنه رزرو می‌شود؛ بدون باکس، کارت، کادر یا متن. کاراکترها و اجزای مهم بیرون آن می‌مانند و در صورت طبیعی‌بودن می‌توانند به آن اشاره کنند.</small></span></label>
            {studioTitleSpaceEnabled && <div className="studio-title-space-options"><label>محل فضای طبیعی<select value={studioCopySpacePlacement} onChange={(event) => setStudioCopySpacePlacement(event.target.value as StudioCopySpacePlacement)}>{Object.entries(studioCopySpaceLabels).map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select></label><label>متن هدف برای محاسبهٔ اندازه (اختیاری)<textarea maxLength={240} value={studioTitleSpaceText} onChange={(event) => setStudioTitleSpaceText(event.target.value)} placeholder="این متن روی تصویر نوشته نمی‌شود؛ فقط اندازهٔ فضای طبیعی لازم را مشخص می‌کند." /></label></div>}
          </fieldset>
          <label>توضیحات تکمیلی کل تصویر<textarea maxLength={1200} value={content.additionalInstructions} onChange={updateContent("additionalInstructions")} placeholder="مثلاً نوع کادر، حس صحنه، پوشش، نور، تعامل میان کاراکترها یا محدودیت‌های ضروری" /></label>
        </section>}
        {(template === "news_story" ||
          template === "news_post" ||
          template === "citizen_message" ||
          template === "editorial_note") && (
          <section className="series-mode-picker">
            <h3>نوع خروجی</h3>
            <div className="choices">
              <button
                className={designSlides.length === 0 ? "selected" : ""}
                onClick={chooseSingleDesign}
                type="button"
              >
                طرح تکی
              </button>
              {template !== "news_post" && (
                <button
                  className={
                    designSlides.length > 1 && canvas === "story_1080x1920"
                      ? "selected"
                      : ""
                  }
                  onClick={() => chooseSlideSeries("story_1080x1920")}
                  type="button"
                >
                  استوری اسلایدی
                </button>
              )}
              {template !== "news_story" && (
                <button
                  className={
                    designSlides.length > 1 && canvas === "post_1080x1350"
                      ? "selected"
                      : ""
                  }
                  onClick={() => chooseSlideSeries("post_1080x1350")}
                  type="button"
                >
                  پست اسلایدی
                </button>
              )}
            </div>
            <p className="hint">
              این حالت، همان قالب انتخاب‌شده را به یک سریِ هم‌تم تبدیل می‌کند؛
              سربرگ، رنگ و قواعد پرامپت مشترک می‌مانند.
            </p>
          </section>
        )}
        {templateGroup === "news" && !isCitizenMessage && (
          <section className="news-controls">
            <h3>ساختار استوری/پست خبری</h3>
            <label>
              نوع خبر
              <select
                value={newsOutputKind}
                onChange={(event) =>
                  setNewsOutputKind(event.target.value as NewsOutputKind)
                }
              >
                <option value="title_photo">تیتر + عکس</option>
                <option value="title_photo_caption">
                  تیتر + عکس + فضای کپشن
                </option>
                <option value="title_only">فقط تیتر، بدون عکس</option>
              </select>
            </label>
            {designSlides.length <= 1 && <label>
              صفحه‌بندی
              <select
                value={newsLayout}
                onChange={(event) =>
                  setNewsLayout(event.target.value as NewsLayout)
                }
              >
                <option value="top">پیش‌فرض؛ تیتر بالا</option>
                <option value="right_column">ستون سمت راست؛ تیتر چندخطی</option>
                <option value="center">تیتر وسط تصویر</option>
                <option value="bottom">تیتر پایین تصویر</option>
              </select>
            </label>}
            {newsHasPhoto && !videoOverlay && (
              <label>
                ابعاد عکس خبر
                <select
                  value={newsPhotoFrame}
                  onChange={(event) =>
                    setNewsPhotoFrame(event.target.value as NewsPhotoFrame)
                  }
                >
                  <option value="full">تمام‌صفحه</option>
                  <option value="landscape">عکس افقی ۱۶:۹</option>
                  <option value="square">عکس مربعی ۱:۱</option>
                  <option value="portrait_3_4">عکس مستطیل ۳:۴</option>
                </select>
              </label>
            )}
            {newsOutputKind !== "title_only" && (
              <ModernSwitch
                checked={videoOverlay}
                onChange={setVideoOverlay}
                label="استفاده برای قالب ویدیو؛ فضای ویدیو خالی بماند"
              />
            )}
            {videoOverlay && (
              <>
                <label>
                  نسبت فضای خالی ویدیو
                  <select
                    value={videoFrame}
                    onChange={(event) =>
                      setVideoFrame(event.target.value as VideoFrame)
                    }
                  >
                    <option value="landscape">افقی ۱۶:۹</option>
                    <option value="square">مربع ۱:۱</option>
                    <option value="portrait">عمودی ۹:۱۶</option>
                  </select>
                </label>
                <ModernSwitch
                  checked={videoBackgroundBlur}
                  onChange={setVideoBackgroundBlur}
                  label="عکس زمینه محو شود"
                />
              </>
            )}
            <ModernSwitch
              checked={siteLinkPlaceholder}
              onChange={setSiteLinkPlaceholder}
              label="محل لینک سایت در طراحی اضافه شود"
            />
          </section>
        )}
        {isCitizenMessage && (
          <section className="citizen-controls">
            <h3>ساختار پیام مردمی</h3>
            <label>
              نوع پیام مردمی
              <select
                value={citizenMessageType}
                onChange={(event) =>
                  setCitizenMessageType(
                    event.target.value as CitizenMessageType,
                  )
                }
              >
                <option value="text">فقط متن</option>
                <option value="photo">متن و عکس</option>
                <option value="video">متن و فیلم</option>
              </select>
            </label>
            {citizenMessageType === "photo" && (
              <label>
                قاب عکس/عکس‌ها
                <select
                  value={newsPhotoFrame}
                  onChange={(event) =>
                    setNewsPhotoFrame(event.target.value as NewsPhotoFrame)
                  }
                >
                  <option value="full">تمام‌صفحه</option>
                  <option value="landscape">افقی ۱۶:۹</option>
                  <option value="square">مربعی ۱:۱</option>
                  <option value="portrait_3_4">مستطیل ۳:۴</option>
                </select>
              </label>
            )}
            {citizenMessageType === "video" && (
              <label>
                نسبت فضای خالی فیلم
                <select
                  value={videoFrame}
                  onChange={(event) =>
                    setVideoFrame(event.target.value as VideoFrame)
                  }
                >
                  <option value="landscape">افقی ۱۶:۹</option>
                  <option value="square">مربع ۱:۱</option>
                  <option value="portrait">عمودی ۹:۱۶</option>
                </select>
              </label>
            )}
          </section>
        )}
        <section className="studio-header-controls">
          <h3>رفتار لوگو و سربرگ</h3>
          <label>
            حالت هویت بصری
            <select value={logoBehavior} onChange={(event) => setLogoBehavior(event.target.value as LogoBehavior)}>
              <option value="system_header">سربرگ سیستمی</option>
              <option value="floating_profile">پروفایل شناور</option>
              <option value="none">بدون پروفایل</option>
            </select>
          </label>
          <p className="hint">در حالت پروفایل شناور، عکس پروفایل رسانه به‌صورت دایره‌ای و خلاقانه داخل تصویر قرار می‌گیرد و کیفیت و نوشته‌های خودش حفظ می‌شود.</p>
        </section>
        <section className="advertising-controls">
          <h3>تبلیغات</h3>
          <ModernSwitch checked={advertisingEnabled} onChange={setAdvertisingEnabled} label="تبلیغات فعال باشد" />
          {advertisingEnabled && <>
            <label>نوع تبلیغ<select value={advertisingMode} onChange={(event) => setAdvertisingMode(event.target.value as typeof advertisingMode)}><option value="card">کارت تبلیغات</option><option value="subtitle">زیرنویس تبلیغاتی</option><option value="embedded">طراحی در بطن تصویر</option></select></label>
            <label>عنوان تبلیغ<input maxLength={180} value={advertisingTitle} onChange={(event) => setAdvertisingTitle(event.target.value)} placeholder="عنوان دقیق تبلیغ" /></label>
            <label>زیرعنوان تبلیغ<input maxLength={240} value={advertisingSubtitle} onChange={(event) => setAdvertisingSubtitle(event.target.value)} placeholder="زیرعنوان یا پیشنهاد اصلی" /></label>
            <label>توضیحات تبلیغ<textarea maxLength={900} rows={4} value={advertisingDescription} onChange={(event) => setAdvertisingDescription(event.target.value)} placeholder="جزئیات، ویژگی‌ها یا متن تکمیلی؛ فقط همین اطلاعات استفاده می‌شود." /></label>
            <label>راه‌های ارتباطی<input maxLength={240} value={advertisingContact} onChange={(event) => setAdvertisingContact(event.target.value)} placeholder="تلفن، آیدی، نشانی یا لینک دقیق" /></label>
            <label className="reference-upload">فایل‌های تبلیغ (اختیاری)<input type="file" accept="image/*,video/*,audio/*" multiple onChange={(event) => { setAdvertisingFiles((current) => [...current, ...Array.from(event.target.files ?? [])].slice(0, 8)); event.currentTarget.value = ""; }} /><span>＋ افزودن فایل‌های تبلیغ</span></label>
            {advertisingFiles.length > 0 && <div className="reference-files">{advertisingFiles.map((file) => <span key={`${file.name}-${file.lastModified}`}>✓ {file.name}<button aria-label={`حذف ${file.name}`} onClick={() => setAdvertisingFiles((current) => current.filter((item) => item !== file))} type="button">×</button></span>)}</div>}
          </>}
        </section>
        {designSlides.length > 1 && (
          <section className="design-series-panel" id="series-slides">
            <div className="section-heading">
              <div>
                <h3>
                  {canvas === "post_1080x1350"
                    ? "پست اسلایدی"
                    : "استوری اسلایدی"}{" "}
                  {template === "citizen_message"
                    ? "پیام مردمی"
                    : template === "editorial_note"
                      ? "یادداشت ادمین"
                      : "خبری"}
                </h3>
                <p className="hint">
                  هر اسلاید درخواست مستقل خودش را دارد؛ بنابراین می‌توانید پس از
                  کامل‌کردن همان کارت، ساخت آن را مستقیم شروع کنید و نتیجهٔ هر
                  اسلاید جداگانه حفظ می‌شود.
                </p>
              </div>
              <button
                className="link-button"
                onClick={chooseSingleDesign}
                type="button"
              >
                تبدیل به طرح تکی
              </button>
            </div>
            <label className="series-count-control">
              تعداد کل اسلایدها
              <input
                disabled={Boolean(slideSeries)}
                inputMode="numeric"
                max={10}
                min={2}
                onChange={(event) => setSeriesSlideCount(event.target.value)}
                type="number"
                value={designSlides.length}
              />
              <small>
                {slideSeries
                  ? "پس از ثبت نخستین اسلاید، تعداد سری برای حفظ ترتیب خروجی ثابت است."
                  : "بین ۲ تا ۱۰ اسلاید؛ به همان تعداد، فرم اسلاید ساخته می‌شود."}
              </small>
            </label>
            <SlideDeckEditor
              activeSlide={
                slideSeries
                  ? {
                      index: slideSeries.currentIndex,
                      job: activeJob,
                      outputUrl: activeOutputUrl,
                      outputLoading,
                      elapsedSeconds,
                    }
                  : undefined
              }
              buildDisabled={(index) =>
                submissionState === "uploading" ||
                Boolean(
                  activeJob &&
                  ["queued", "processing", "cancel_requested"].includes(
                    activeJob.state,
                  ),
                ) ||
                !slideHasContent(designSlides[index], index) ||
                !slideReferencesReady(designSlides[index]) ||
                !slideReferencesWithinLimit(designSlides[index])
              }
              editInstruction={editInstruction}
              onApproveSlide={() => void approveSeriesSlide()}
              onBuildSlide={(index) => void submitSeriesSlideAt(index)}
              onChange={setDesignSlides}
              onEditInstruction={setEditInstruction}
              onDownloadSlide={() => {
                const output = activeJob?.outputs.at(-1);
                if (activeJob && output)
                  void downloadJobOutput(activeJob.requestId, output.filename);
              }}
              onEditSlideForm={(index) => void openSeriesSlide(index)}
              onEditSlideImage={() => void submitImageEdit()}
              onEditSlideText={(index) => void openSeriesSlide(index, true)}
              onManualSlideReference={addManualSeriesReference}
              onRetrySlide={() => void retrySeriesSlide()}
              onViewSlideOutput={() => void showLatestOutput()}
              presenterAssets={studioAssetRegistry?.assets.filter(
                (asset) => asset.kind === "presenter",
              )}
              imageModelSettings={imageModelSettings}
              isStudioSeries={templateGroup === "studio"}
              studioAssetRegistry={studioAssetRegistry}
              studioDefaultLocationId={studioLocationId}
              isNewsSeries={templateGroup === "news" && !isCitizenMessage}
              slides={designSlides}
              uploadQueue={designUploadQueue}
              withFiles
            />
            <div className="series-new-design">
              <button
                className="secondary"
                onClick={startNewDesign}
                type="button"
              >
                ساخت تصویر کاملاً جدید
              </button>
            </div>
          </section>
        )}
      </section>

      <section
        className={`card ${activeTab !== "create" || designSlides.length > 1 || templateGroup === "studio" ? "tab-hidden" : ""} ${formCollapsed ? "form-hidden" : ""} ${activeJob?.state === "completed" && !formEditMode ? "form-readonly" : ""}`}
      >
        <h2>۲. متن دقیق روی طرح</h2>
        {isCitizenMessage && (
          <section className="citizen-message-fields">
            <h3>متن و اطلاعات پیام</h3>
            <label>
              متن پیام مردمی
              <textarea
                value={content.citizenMessageText}
                onChange={updateContent("citizenMessageText")}
                placeholder="پیام کامل مخاطب را وارد کنید؛ مدل آن را روی تصویر نمی‌نویسد و فقط فضای خالی متناسب ایجاد می‌کند."
                required
              />
            </label>
            <label>
              تیتر مستقل
              <input
                value={content.citizenHeadline}
                onChange={updateContent("citizenHeadline")}
                placeholder="اختیاری؛ فقط در صورت نیاز روی طرح نوشته می‌شود"
              />
            </label>
            <label>
              پاسخ کلام تازه
              <textarea
                value={content.citizenResponse}
                onChange={updateContent("citizenResponse")}
                placeholder="اختیاری؛ در یک حباب پاسخ جدا نوشته می‌شود"
              />
            </label>
            <label>
              متن تعامل با مخاطب
              <input
                value={content.citizenInteraction}
                onChange={updateContent("citizenInteraction")}
                placeholder="اختیاری؛ در کارت تعامل پایین طرح"
              />
            </label>
            <label>
              توضیحات تکمیلی برای طراح / مدل
              <textarea
                value={content.additionalInstructions}
                onChange={updateContent("additionalInstructions")}
                placeholder="اختیاری؛ توضیح بصری جدا از متن پیام"
              />
            </label>
          </section>
        )}
        {template === "morning_local" && (
          <section className="morning-local-fields">
            <div className="morning-section-heading">
              <h3>عکس و مکان</h3>
            </div>
            <label>
              شهر دریافت داده‌های محلی
              <select
                value={content.morningCity}
                onChange={updateContent("morningCity")}
              >
                <option value="golbahar">گلبهار</option>
                <option value="chenaran">چناران</option>
              </select>
            </label>
            <label>
              عنوان قطعی طرح
              <input
                readOnly
                value={`اوقات شرعی و آب و هوای امروز شهرستان ${content.morningCity === "chenaran" ? "چناران" : "گلبهار"}`}
              />
            </label>

            <div className="morning-section-heading">
              <h3>تاریخ امروز</h3>
              <SparkleButton
                label="دریافت تاریخ"
                loading={morningLoading === "date"}
                onClick={() => void fillMorningSection("date")}
              />
            </div>
            <label>
              روز هفته
              <input
                value={content.morningWeekday}
                onChange={updateContent("morningWeekday")}
                placeholder="مثلاً دوشنبه"
                required
              />
            </label>
            <label>
              تاریخ شمسی
              <input
                value={content.morningPersianDate}
                onChange={updateContent("morningPersianDate")}
                placeholder="مثلاً ۱۹ مرداد ۱۴۰۵"
                required
              />
            </label>
            <label>
              تاریخ میلادی
              <input
                dir="ltr"
                value={content.morningGregorianDate}
                onChange={updateContent("morningGregorianDate")}
                placeholder="مثلاً 9 August 2026"
                required
              />
            </label>
            <label>
              تاریخ قمری
              <input
                value={content.morningHijriDate}
                onChange={updateContent("morningHijriDate")}
                placeholder="مثلاً ۲۵ صفر ۱۴۴۸"
                required
              />
            </label>

            <div className="morning-section-heading">
              <h3>مناسبت‌های امروز</h3>
              <SparkleButton
                label="دریافت مناسبت‌ها"
                loading={morningLoading === "local_occasions"}
                onClick={() => void fillMorningSection("local_occasions")}
              />
            </div>
            <label>
              مناسبت‌های ملی، مذهبی و جهانی
              <textarea
                className={
                  occasionNeedsManualTypesetting(content.morningLocalOccasion)
                    ? "occasion-manual-input"
                    : ""
                }
                value={content.morningLocalOccasion}
                onChange={updateContent("morningLocalOccasion")}
                placeholder="از استعلام دریافت می‌شود؛ هر مناسبت در یک خط"
              />
            </label>
            {content.morningLocalOccasion.trim() &&
              occasionNeedsManualTypesetting(content.morningLocalOccasion) && (
                <div className="occasion-manual-warning">
                  <span>
                    به‌علت زیاد شدن متن مناسبت‌ها، متن توسط هوش مصنوعی نوشته
                    نخواهد شد؛ متن را کپی کنید و جداگانه به تصویر اضافه کنید.
                  </span>
                  <button
                    aria-label="کپی مناسبت‌ها"
                    onClick={() =>
                      void navigator.clipboard.writeText(
                        content.morningLocalOccasion,
                      )
                    }
                    title="کپی مناسبت‌ها"
                    type="button"
                  >
                    ⧉ کپی
                  </button>
                </div>
              )}

            <div className="morning-section-heading">
              <h3>ویجت آب‌وهوا</h3>
              <SparkleButton
                label="دریافت آب‌وهوا"
                loading={morningLoading === "weather"}
                onClick={() => void fillMorningSection("weather")}
              />
            </div>
            <label>
              وضعیت هوا
              <input
                value={content.morningWeatherCondition}
                onChange={updateContent("morningWeatherCondition")}
                placeholder="مثلاً نیمه‌ابری"
              />
            </label>
            <div className="field-pair">
              <label>
                کمینه (°C)
                <input
                  value={content.morningMinTemperature}
                  onChange={updateContent("morningMinTemperature")}
                  placeholder="۲۰"
                />
              </label>
              <label>
                بیشینه (°C)
                <input
                  value={content.morningMaxTemperature}
                  onChange={updateContent("morningMaxTemperature")}
                  placeholder="۳۵"
                />
              </label>
            </div>
            <div className="field-pair">
              <label>
                سرعت باد
                <input
                  value={content.morningWindSpeed}
                  onChange={updateContent("morningWindSpeed")}
                  placeholder="۴ km/h"
                />
              </label>
              <label>
                رطوبت
                <input
                  value={content.morningHumidity}
                  onChange={updateContent("morningHumidity")}
                  placeholder="۳۳٪"
                />
              </label>
            </div>
            <label>
              پوشاک پیشنهادی
              <input
                value={content.morningAttire}
                onChange={updateContent("morningAttire")}
                placeholder="مثلاً تی‌شرت؛ برای نمایش با آیکون"
              />
            </label>

            <div className="morning-section-heading">
              <h3>اوقات شرعی</h3>
              <SparkleButton
                label="دریافت اوقات"
                loading={morningLoading === "prayer"}
                onClick={() => void fillMorningSection("prayer")}
              />
            </div>
            <div className="field-pair">
              <label>
                اذان صبح
                <input
                  value={content.morningFajr}
                  onChange={updateContent("morningFajr")}
                  placeholder="۰۵:۳۰"
                  required
                />
              </label>
              <label>
                طلوع
                <input
                  value={content.morningSunrise}
                  onChange={updateContent("morningSunrise")}
                  placeholder="۰۶:۲۲"
                  required
                />
              </label>
            </div>
            <div className="field-pair">
              <label>
                اذان ظهر
                <input
                  value={content.morningNoon}
                  onChange={updateContent("morningNoon")}
                  placeholder="۱۲:۴۴"
                  required
                />
              </label>
              <label>
                غروب
                <input
                  value={content.morningSunset}
                  onChange={updateContent("morningSunset")}
                  placeholder="۱۹:۱۲"
                  required
                />
              </label>
            </div>
            <div className="field-pair">
              <label>
                اذان مغرب
                <input
                  value={content.morningMaghrib}
                  onChange={updateContent("morningMaghrib")}
                  placeholder="۱۹:۳۲"
                  required
                />
              </label>
              <label>
                نیمه‌شب
                <input
                  value={content.morningMidnight}
                  onChange={updateContent("morningMidnight")}
                  placeholder="۰۰:۳۲"
                  required
                />
              </label>
            </div>

            <div className="morning-section-heading">
              <h3>کارت تعامل پایین طرح</h3>
              <SparkleButton
                label="پیشنهاد معما"
                loading={morningLoading === "riddle"}
                onClick={() => void fillMorningSection("riddle")}
              />
            </div>
            <label>
              پرسش تعامل
              <input
                value={content.morningRiddleQuestion}
                onChange={updateContent("morningRiddleQuestion")}
                placeholder="مثلاً اسم فیلم ایرانی با «ب» 👇🏻"
                required
              />
            </label>
            <label>
              پاسخ معما (فقط برای ادمین)
              <input
                readOnly
                value={content.morningRiddleAnswer}
                placeholder="با دکمهٔ پیشنهاد معما نمایش داده می‌شود و به تصویرساز ارسال نمی‌شود."
              />
            </label>
            <label>
              متن کوچک تعامل
              <input
                value={content.morningRiddleHint}
                onChange={updateContent("morningRiddleHint")}
                placeholder="مثلاً چندتا می‌تونی حدس بزنی؟"
              />
            </label>
            <div className="morning-section-heading">
              <h3>معمای تصویری (اختیاری)</h3>
              <SparkleButton
                label="پیشنهاد ایدهٔ تصویری"
                loading={morningLoading === "visual_riddle"}
                onClick={() => void fillMorningSection("visual_riddle")}
              />
            </div>
            <label>
              ایدهٔ معمای تصویری
              <textarea
                value={content.morningVisualRiddleIdea}
                onChange={updateContent("morningVisualRiddleIdea")}
                placeholder="می‌توانید ایده را دریافت یا دستی بنویسید؛ با وجود فایل مرجع، فایل اولویت دارد."
              />
            </label>
            <label>
              پاسخ معمای تصویری (فقط برای ادمین)
              <input
                readOnly
                value={content.morningVisualRiddleAnswer}
                placeholder="با دکمهٔ پیشنهاد ایدهٔ تصویری نمایش داده می‌شود و به تصویرساز ارسال نمی‌شود."
              />
            </label>
            <label className="reference-upload">
              تصویر یا تصاویر ایموجی معما
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(event) =>
                  setPuzzleFiles(Array.from(event.target.files ?? []))
                }
              />
              <span>＋ انتخاب یک یا چند تصویر</span>
            </label>
            {puzzleFiles.length > 0 && (
              <div className="asset-summary">
                {puzzleFiles.map((file) => (
                  <span key={`${file.name}-${file.lastModified}`}>
                    {file.name}
                    <button
                      aria-label={`حذف ${file.name}`}
                      onClick={() =>
                        setPuzzleFiles((current) =>
                          current.filter((item) => item !== file),
                        )
                      }
                      type="button"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            {morningDataError && (
              <p className="error morning-data-error">{morningDataError}</p>
            )}
          </section>
        )}
        {template === "morning_kalam" && (
          <section className="morning-kalam-fields">
            <div className="morning-section-heading">
              <h3>تقویم هفتگی</h3>
              <SparkleButton
                label="دریافت تقویم"
                loading={morningLoading === "kalam_calendar"}
                onClick={() => void fillMorningSection("kalam_calendar")}
              />
            </div>
            <label>
              نام ماه و سال
              <input
                value={content.morningKalamWeekLabel}
                onChange={updateContent("morningKalamWeekLabel")}
                placeholder="مثلاً مرداد ۱۴۰۵"
                required
              />
            </label>
            <div className="week-days-grid">
              {(
                [
                  "شنبه",
                  "یکشنبه",
                  "دوشنبه",
                  "سه‌شنبه",
                  "چهارشنبه",
                  "پنج‌شنبه",
                  "جمعه",
                ] as const
              ).map((weekday, index) => {
                const dayKey =
                  `morningKalamDay${index + 1}` as keyof typeof content;
                return (
                  <div className="week-day-row" key={dayKey}>
                    <label>
                      {weekday}
                      <input
                        value={content[dayKey]}
                        onChange={updateContent(dayKey)}
                        placeholder={toPersianDigits(String(17 + index))}
                        required
                      />
                    </label>
                    <div className="week-day-options">
                      <label>
                        امروز
                        <input
                          checked={
                            content.morningKalamTodayIndex === String(index + 1)
                          }
                          onChange={() =>
                            setContent((current) => ({
                              ...current,
                              morningKalamTodayIndex: String(index + 1),
                            }))
                          }
                          type="radio"
                          name="morning-kalam-today"
                        />
                      </label>
                      <ModernSwitch
                        checked={morningKalamHolidays[index]}
                        onChange={(checked) =>
                          setMorningKalamHolidays((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index ? checked : item,
                            ),
                          )
                        }
                        label="تعطیل"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="morning-section-heading">
              <h3>مناسبت‌های امروز</h3>
              <SparkleButton
                label="دریافت مناسبت‌ها"
                loading={morningLoading === "kalam_occasions"}
                onClick={() => void fillMorningSection("kalam_occasions")}
              />
            </div>
            <label>
              مناسبت‌های ملی، مذهبی و جهانی
              <textarea
                className={
                  occasionNeedsManualTypesetting(content.morningKalamOccasion)
                    ? "occasion-manual-input"
                    : ""
                }
                value={content.morningKalamOccasion}
                onChange={updateContent("morningKalamOccasion")}
                placeholder="از استعلام دریافت می‌شود؛ هر مناسبت در یک خط"
              />
            </label>
            {content.morningKalamOccasion.trim() &&
              occasionNeedsManualTypesetting(content.morningKalamOccasion) && (
                <div className="occasion-manual-warning">
                  <span>
                    به‌علت زیاد شدن متن مناسبت‌ها، متن توسط هوش مصنوعی نوشته
                    نخواهد شد؛ متن را کپی کنید و جداگانه به تصویر اضافه کنید.
                  </span>
                  <button
                    aria-label="کپی مناسبت‌ها"
                    onClick={() =>
                      void navigator.clipboard.writeText(
                        content.morningKalamOccasion,
                      )
                    }
                    title="کپی مناسبت‌ها"
                    type="button"
                  >
                    ⧉ کپی
                  </button>
                </div>
              )}
            <div className="morning-section-heading">
              <h3>معمای تصویری</h3>
              <SparkleButton
                label="پیشنهاد ایدهٔ تصویری"
                loading={morningLoading === "visual_riddle"}
                onClick={() => void fillMorningSection("visual_riddle")}
              />
            </div>
            <label>
              ایدهٔ معمای تصویری
              <textarea
                value={content.morningVisualRiddleIdea}
                onChange={updateContent("morningVisualRiddleIdea")}
                placeholder="می‌توانید ایده را دریافت یا دستی بنویسید؛ با وجود فایل مرجع، فایل اولویت دارد."
              />
            </label>
            <label>
              پاسخ معمای تصویری (فقط برای ادمین)
              <input
                readOnly
                value={content.morningVisualRiddleAnswer}
                placeholder="با دکمهٔ پیشنهاد ایدهٔ تصویری نمایش داده می‌شود و به تصویرساز ارسال نمی‌شود."
              />
            </label>
            <label className="reference-upload">
              تصویر یا تصاویر ایموجی معما
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(event) =>
                  setPuzzleFiles(Array.from(event.target.files ?? []))
                }
              />
              <span>＋ انتخاب یک یا چند تصویر</span>
            </label>
            {puzzleFiles.length > 0 && (
              <div className="asset-summary">
                {puzzleFiles.map((file) => (
                  <span key={`${file.name}-${file.lastModified}`}>
                    {file.name}
                    <button
                      aria-label={`حذف ${file.name}`}
                      onClick={() =>
                        setPuzzleFiles((current) =>
                          current.filter((item) => item !== file),
                        )
                      }
                      type="button"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <p className="hint">
              روی طرح فقط «معمای تصویری» و زیرنویس ثابتِ «پاسخ معمای امروز را
              برامون بفرستین.» می‌آید؛ مدل ایموجی‌های فایل را بدون زمینه و بدون
              تغییر می‌چیند.
            </p>
          </section>
        )}
        {template === "market" && (
          <section className="market-fields">
            <div className="morning-section-heading">
              <h3>تاریخ و ساعت انتشار</h3>
              <SparkleButton
                label="دریافت تاریخ و ساعت"
                loading={marketLoading === "date"}
                onClick={() => void fillMarketSection("date")}
              />
            </div>
            <div className="market-date-grid">
              <label>
                روز هفته
                <input
                  value={content.marketWeekday}
                  onChange={updateContent("marketWeekday")}
                  placeholder="مثلاً دوشنبه"
                  required
                />
              </label>
              <label>
                تاریخ شمسی
                <input
                  value={content.marketPersianDate}
                  onChange={updateContent("marketPersianDate")}
                  placeholder="۱۹ مرداد ۱۴۰۵"
                  required
                />
              </label>
              <label>
                تاریخ میلادی
                <input
                  dir="ltr"
                  value={content.marketGregorianDate}
                  onChange={updateContent("marketGregorianDate")}
                  placeholder="10 August 2026"
                  required
                />
              </label>
              <label>
                تاریخ قمری
                <input
                  value={content.marketHijriDate}
                  onChange={updateContent("marketHijriDate")}
                  placeholder="۲۵ صفر ۱۴۴۸"
                  required
                />
              </label>
              <label>
                ساعت دریافت (ایران)
                <input
                  value={content.marketTime}
                  onChange={updateContent("marketTime")}
                  placeholder="۰۹:۳۰"
                  required
                />
              </label>
              <label>
                منبع نرخ‌ها
                <input
                  value={content.marketSource}
                  onChange={updateContent("marketSource")}
                  placeholder="نام منبع و روش اعلام نرخ"
                  required
                />
              </label>
            </div>
            <div className="morning-section-heading">
              <h3>نرخ‌های به‌روز</h3>
              <SparkleButton
                label="دریافت نرخ‌ها"
                loading={marketLoading === "rates"}
                onClick={() => void fillMarketSection("rates")}
              />
            </div>
            <p className="hint">
              دلار، یورو، تمام سکه و طلای ۱۸ عیار به تومان‌اند؛ بیت‌کوین به دلار
              آمریکا. درصد تغییر نسبت به ۲۴ ساعت قبل است و هر مقدار پیش از ساخت
              طرح قابل اصلاح است.
            </p>
            <div className="market-rates-grid">
              {(
                [
                  ["دلار", "marketUsdPrice", "marketUsdChange", "تومان"],
                  ["یورو", "marketEurPrice", "marketEurChange", "تومان"],
                  ["تمام سکه", "marketCoinPrice", "marketCoinChange", "تومان"],
                  [
                    "طلای ۱۸ عیار",
                    "marketGold18Price",
                    "marketGold18Change",
                    "تومان",
                  ],
                  [
                    "بیت‌کوین",
                    "marketBitcoinPrice",
                    "marketBitcoinChange",
                    "دلار آمریکا",
                  ],
                ] as const
              ).map(([label, priceKey, changeKey, unit]) => (
                <div className="market-rate-row" key={priceKey}>
                  <label>
                    {label} ({unit})
                    <input
                      inputMode="decimal"
                      value={content[priceKey]}
                      onChange={updateContent(priceKey)}
                      placeholder="۰"
                      required
                    />
                  </label>
                  <label>
                    تغییر ۲۴ساعته (%)
                    <input
                      dir="ltr"
                      inputMode="decimal"
                      value={content[changeKey]}
                      onChange={updateContent(changeKey)}
                      placeholder="مثلاً +۱٫۲۵ یا -۰٫۷۰"
                    />
                  </label>
                </div>
              ))}
            </div>
            {marketDataNote && (
              <p className="hint market-data-note">{marketDataNote}</p>
            )}
            {marketDataError && (
              <p className="error morning-data-error">{marketDataError}</p>
            )}
          </section>
        )}
        {template === "occasion_greeting" && (
          <section className="occasion-template-fields">
            <div className="morning-section-heading">
              <h3>مناسبت و متن</h3>
              <SparkleButton
                label="دریافت مناسبت‌ها"
                loading={contentToolLoading === "occasion-calendar"}
                onClick={() => void fillOccasion("calendar")}
              />
            </div>
            <div className="field-pair">
              <label>
                نوع پیام
                <select
                  value={content.occasionTone}
                  onChange={updateContent("occasionTone")}
                >
                  <option value="congratulation">تبریک</option>
                  <option value="condolence">تسلیت</option>
                </select>
              </label>
              <label>
                دستهٔ مناسبت
                <select
                  value={content.occasionCategory}
                  onChange={updateContent("occasionCategory")}
                >
                  <option value="religious">مذهبی</option>
                  <option value="national">ملی</option>
                  <option value="global">جهانی</option>
                  <option value="public">عمومی / اجتماعی</option>
                  <option value="cultural">فرهنگی / هنری</option>
                  <option value="custom">سایر</option>
                </select>
              </label>
            </div>
            {occasionOptions.length > 0 && (
              <div className="idea-options">
                {occasionOptions.map((option) => (
                  <button
                    className={
                      content.occasionName.split("\n").includes(option)
                        ? "selected"
                        : ""
                    }
                    key={option}
                    onClick={() =>
                      setContent((current) => ({
                        ...current,
                        occasionName: current.occasionName
                          .split("\n")
                          .filter(Boolean)
                          .includes(option)
                          ? current.occasionName
                              .split("\n")
                              .filter((item) => item !== option)
                              .join("\n")
                          : [current.occasionName, option]
                              .filter(Boolean)
                              .join("\n"),
                      }))
                    }
                    type="button"
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
            <label className="title-field">
              مناسبت یا مناسبت‌های انتخاب‌شده (اختیاری)
              <textarea
                value={content.occasionName}
                onChange={updateContent("occasionName")}
                placeholder="یک یا چند مناسبت؛ هر مورد در یک خط"
                rows={3}
              />
            </label>
            <label>
              تاریخ یا عبارت تکمیلی کوتاه
              <textarea
                value={content.occasionDate}
                onChange={updateContent("occasionDate")}
                placeholder="اختیاری؛ مثلاً ۱۷ مرداد، روز خبرنگار"
                rows={2}
              />
            </label>
            <div className="morning-section-heading">
              <h3>پیشنهاد متن</h3>
              <SparkleButton
                label="پیشنهاد عنوان و پیام"
                loading={contentToolLoading === "occasion-copy"}
                onClick={() => void fillOccasion("copy")}
              />
            </div>
            <label className="title-field">
              عنوان روی طرح (اختیاری)
              <textarea
                value={content.occasionHeadline}
                onChange={updateContent("occasionHeadline")}
                placeholder="خودتان بنویسید یا از پیشنهاد هوش مصنوعی استفاده کنید"
                rows={3}
              />
            </label>
            <label>
              پیام روی طرح
              <textarea
                value={content.occasionMessage}
                onChange={updateContent("occasionMessage")}
                placeholder="اختیاری؛ اگر کوتاه باشد عیناً روی طرح می‌آید، برای پیام بلند فضای نوشتن خالی ساخته می‌شود."
                rows={4}
              />
            </label>
            <label>
              امضا / نام تبریک
              <input
                value={content.occasionSignature}
                onChange={updateContent("occasionSignature")}
                placeholder="نشریه و پایگاه خبری کلام تازه"
              />
            </label>
            <label>
              توضیحات تکمیلی برای طراح / مدل
              <textarea
                value={content.additionalInstructions}
                onChange={updateContent("additionalInstructions")}
                placeholder="اختیاری؛ مثلاً پرهیز از نمادهای کلیشه‌ای، فضای رسمی یا استفاده از عکس مرجع"
                rows={3}
              />
            </label>
          </section>
        )}
        {template === "night" && (
          <section className="content-tool-fields">
            <div className="morning-section-heading">
              <h3>استوری شبانه</h3>
              <SparkleButton
                label="پیشنهاد ۵ گزینه"
                loading={contentToolLoading === "night"}
                onClick={() => void requestContentIdeas("night")}
              />
            </div>
            <div className="field-pair">
              <label>
                نوع محتوا
                <select
                  value={content.nightKind}
                  onChange={updateContent("nightKind")}
                >
                  <option value="book">معرفی کتاب</option>
                  <option value="film">معرفی فیلم</option>
                  <option value="series">معرفی سریال</option>
                  <option value="album">معرفی آلبوم موسیقی</option>
                </select>
              </label>
              <label>
                روش انتخاب
                <select
                  value={content.nightFreshness}
                  onChange={updateContent("nightFreshness")}
                >
                  <option value="classic">ماندگارترین‌ها</option>
                  <option value="latest">جدیدترین‌ها (جست‌وجوی وب)</option>
                </select>
              </label>
            </div>
            <label className="title-field">
              نام اثر / عنوان روی طرح
              <textarea
                value={content.title}
                onChange={updateContent("title")}
                placeholder="نام اثر را دستی بنویسید یا از گزینه‌های پیشنهادی انتخاب کنید"
                rows={3}
              />
            </label>
            <label>
              یادداشت یا دلیل معرفی
              <textarea
                value={content.caption}
                onChange={updateContent("caption")}
                placeholder="اختیاری؛ یک معرفی کوتاه و بدون لو دادن داستان"
                rows={3}
              />
            </label>
            <label>
              درخواست اختصاصی برای پیشنهادها
              <textarea
                value={content.nightPrompt}
                onChange={updateContent("nightPrompt")}
                placeholder="اختیاری؛ مثلاً مناسب آخر هفته، ایرانی، خانوادگی یا ژانر دلخواه"
                rows={2}
              />
            </label>
            {ideaOptions.length > 0 && (
              <div className="idea-options">
                {ideaOptions.map((option) => (
                  <button
                    key={option}
                    onClick={() => {
                      const [title, ...rest] = option.split("—");
                      setContent((current) => ({
                        ...current,
                        title: title.trim(),
                        caption: rest.join("—").trim(),
                      }));
                    }}
                    type="button"
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
          </section>
        )}
        {template === "home_tip" && (
          <section className="content-tool-fields">
            <div className="morning-section-heading">
              <h3>ترفند خانه‌داری</h3>
              <SparkleButton
                label="پیشنهاد ۵ ترفند"
                loading={contentToolLoading === "home_tip"}
                onClick={() => void requestContentIdeas("home_tip")}
              />
            </div>
            <label className="title-field">
              تیتر ترفند
              <textarea
                value={content.title}
                onChange={updateContent("title")}
                placeholder="دستی بنویسید یا از پیشنهادها انتخاب کنید"
                rows={3}
              />
            </label>
            <label>
              توضیح کوتاه و ایمن
              <textarea
                value={content.caption}
                onChange={updateContent("caption")}
                placeholder="اختیاری"
                rows={3}
              />
            </label>
            <label>
              درخواست اختصاصی
              <input
                value={content.homeTipPrompt}
                onChange={updateContent("homeTipPrompt")}
                placeholder="مثلاً آشپزخانه، نظم‌دهی یا نظافت"
              />
            </label>
            {ideaOptions.length > 0 && (
              <div className="idea-options">
                {ideaOptions.map((option) => (
                  <button
                    key={option}
                    onClick={() => {
                      const [title, ...rest] = option.split("—");
                      setContent((current) => ({
                        ...current,
                        title: title.trim(),
                        caption: rest.join("—").trim(),
                      }));
                    }}
                    type="button"
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
          </section>
        )}
        {template === "infographic" && (
          <section className="content-tool-fields">
            <div className="morning-section-heading">
              <h3>محتوای اینفوگرافی</h3>
              <SparkleButton
                label="آماده‌سازی با هوش مصنوعی"
                loading={contentToolLoading === "infographic"}
                onClick={() => void requestContentIdeas("infographic")}
              />
            </div>
            <label>
              موضوع
              <input
                value={content.infographicTopic}
                onChange={updateContent("infographicTopic")}
                placeholder="مثلاً وضعیت مصرف آب در گلبهار"
              />
            </label>
            <label>
              محتوای تأییدشده
              <textarea
                value={content.infographicSourceText}
                onChange={updateContent("infographicSourceText")}
                placeholder="متن کامل یا داده‌های تأییدشده را وارد کنید؛ مدل چیزی به آن اضافه نمی‌کند."
                rows={5}
              />
            </label>
            <label>
              روتیتر
              <textarea
                value={content.kicker}
                onChange={updateContent("kicker")}
                rows={2}
              />
            </label>
            <label className="title-field">
              تیتر
              <textarea
                value={content.title}
                onChange={updateContent("title")}
                rows={3}
              />
            </label>
            <label>
              زیرتیتر
              <textarea
                value={content.subtitle}
                onChange={updateContent("subtitle")}
                rows={2}
              />
            </label>
            <label>
              داده‌ها؛ هر مورد در یک خط
              <textarea
                value={content.dataPoints}
                onChange={updateContent("dataPoints")}
                rows={6}
              />
            </label>
            <label>
              منبع
              <input
                value={content.source}
                onChange={updateContent("source")}
                placeholder="اختیاری"
              />
            </label>
          </section>
        )}
        {template === "sticker" && (
          <section className="content-tool-fields poster-fields">
            <div className="morning-section-heading">
              <div>
                <h3>استیکر شفاف</h3>
                <p>برای قراردادن روی پست، ویدیو یا استوری. خروجی با مدل‌های GPT Image به PNG شفاف واقعی تبدیل می‌شود.</p>
              </div>
            </div>
            <label>
              نوع استیکر
              <select value={content.stickerKind} onChange={updateContent("stickerKind")}>
                <option value="news">خبری</option>
                <option value="promotion">تبلیغاتی</option>
                <option value="video_title">تیتر ویدیویی — بدون ظاهر استیکر</option>
              </select>
            </label>
            <label className="title-field">
              متن اصلی
              <textarea
                maxLength={80}
                required
                value={content.stickerText}
                onChange={updateContent("stickerText")}
                placeholder={content.stickerKind === "video_title" ? "مثلاً مهم‌ترین خبر امروز" : "مثلاً فوری"}
                rows={2}
              />
            </label>
            <label>
              متن کوتاه تکمیلی
              <input
                maxLength={100}
                value={content.stickerSubtext}
                onChange={updateContent("stickerSubtext")}
                placeholder="اختیاری"
              />
            </label>
          </section>
        )}
        {template === "poster" && (
          <section className="content-tool-fields poster-fields">
            <div className="morning-section-heading">
              <div>
                <h3>پوستر حرفه‌ای</h3>
                <p className="hint">
                  برای بنر تبلیغاتی، معرفی رسانه، کمپین یا هر پیام مستقل؛ متن
                  کوتاه‌تر، خروجی حرفه‌ای‌تر.
                </p>
              </div>
            </div>
            <div className="field-pair">
              <label>
                کاربری پوستر
                <select
                  value={content.posterPurpose}
                  onChange={updateContent("posterPurpose")}
                >
                  <option value="promotion">تبلیغ / معرفی</option>
                  <option value="campaign">کمپین و فراخوان</option>
                  <option value="event">رویداد و برنامه</option>
                  <option value="media">معرفی رسانه یا کانال</option>
                  <option value="announcement">اطلاعیه</option>
                </select>
              </label>
              <label>
                حال‌وهوای بصری
                <select
                  value={content.posterStyle}
                  onChange={updateContent("posterStyle")}
                >
                  <option value="modern">مدرن و مجله‌ای</option>
                  <option value="bold">جسور و پرانرژی</option>
                  <option value="luxury">لوکس و مینیمال</option>
                  <option value="local">گرم و محلی</option>
                  <option value="corporate">رسمی و سازمانی</option>
                </select>
              </label>
            </div>
            <label className="title-field">
              پیام اصلی پوستر
              <textarea
                maxLength={120}
                required
                value={content.posterHeadline}
                onChange={updateContent("posterHeadline")}
                placeholder="مثلاً کانال روبیکای کلام تازه را دنبال کنید"
                rows={3}
              />
            </label>
            <label>
              زیرپیام / مزیت اصلی
              <textarea
                maxLength={220}
                value={content.posterSubheadline}
                onChange={updateContent("posterSubheadline")}
                placeholder="اختیاری؛ یک توضیح کوتاه و دقیق"
                rows={2}
              />
            </label>
            <label>
              جزئیات تکمیلی
              <textarea
                maxLength={360}
                value={content.posterBody}
                onChange={updateContent("posterBody")}
                placeholder="اختیاری؛ تاریخ، مزیت، آدرس یا توضیحی که باید روی پوستر دیده شود"
                rows={3}
              />
            </label>
            <label>
              دعوت به اقدام
              <input
                maxLength={96}
                value={content.posterCta}
                onChange={updateContent("posterCta")}
                placeholder="مثلاً همین حالا عضو شوید"
              />
            </label>
          </section>
        )}
        {template === "classifieds" && (
          <section className="content-tool-fields classifieds-fields">
            <div className="morning-section-heading">
              <div>
                <h3>آگهی نیازمندی‌ها</h3>
                <p className="hint">
                  از یک تا چهار آگهی ثبت کنید. هر مورد روی کارت روزنامه‌ایِ
                  مستقل با راه تماس خودش قرار می‌گیرد.
                </p>
              </div>
              <span className="classified-count">
                {toPersianDigits(String(classifiedAds.length))} از ۴ آگهی
              </span>
            </div>
            <div className="classified-ad-list">
              {classifiedAds.map((ad, index) => (
                <fieldset className="classified-ad" key={`${index}-${ad.category}`}>
                  <legend>آگهی {toPersianDigits(String(index + 1))}</legend>
                  <div className="field-pair">
                    <label>
                      نوع آگهی
                      <select
                        value={ad.category}
                        onChange={(event) =>
                          updateClassifiedAds((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index
                                ? {
                                    ...item,
                                    category: event.target.value as ClassifiedAd["category"],
                                  }
                                : item,
                            ),
                          )
                        }
                      >
                        {classifiedCategories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      راه ارتباطی
                      <input
                        maxLength={96}
                        required
                        value={ad.contact}
                        onChange={(event) =>
                          updateClassifiedAds((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, contact: event.target.value }
                                : item,
                            ),
                          )
                        }
                        placeholder="مثلاً ۰۹۱۲... یا @username"
                      />
                    </label>
                  </div>
                  <label>
                    تیتر آگهی
                    <input
                      maxLength={56}
                      required
                      value={ad.title}
                      onChange={(event) =>
                        updateClassifiedAds((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, title: event.target.value }
                              : item,
                          ),
                        )
                      }
                      placeholder="مثلاً گم‌شدن مدارک شناسایی"
                    />
                  </label>
                  <label>
                    متن آگهی
                    <textarea
                      maxLength={220}
                      required
                      value={ad.body}
                      onChange={(event) =>
                        updateClassifiedAds((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, body: event.target.value }
                              : item,
                          ),
                        )
                      }
                      placeholder="جزئیات کوتاه، دقیق و قابل انتشار"
                      rows={3}
                    />
                  </label>
                  {classifiedAds.length > 1 && (
                    <button
                      className="link-button"
                      onClick={() =>
                        updateClassifiedAds((current) =>
                          current.filter((_, itemIndex) => itemIndex !== index),
                        )
                      }
                      type="button"
                    >
                      حذف این آگهی
                    </button>
                  )}
                </fieldset>
              ))}
            </div>
            {classifiedAds.length < 4 && (
              <button
                className="secondary"
                onClick={() =>
                  updateClassifiedAds((current) => [...current, emptyClassifiedAd()])
                }
                type="button"
              >
                + افزودن آگهی دیگر
              </button>
            )}
          </section>
        )}
        {template === "sport" && (
          <section className="content-tool-fields">
            <div className="morning-section-heading">
              <h3>ورزشی</h3>
              <SparkleButton
                label={sportCompetitions.length ? "به‌روزرسانی فهرست رقابت‌ها" : "دریافت رقابت‌های فعال"}
                loading={sportLoading === "catalog"}
                onClick={() => void loadSportCatalog()}
              />
            </div>
            <div className="field-pair">
              <label>
                نوع محتوا
                <select
                  value={content.sportMode}
                  onChange={updateContent("sportMode")}
                >
                  <option value="result">اعلام نتیجهٔ مسابقه</option>
                  <option value="league">نتایج هفتهٔ لیگ</option>
                  <option value="upcoming">بازی‌های مهم پیش رو</option>
                </select>
              </label>
              <label>
                لیگ / رشته / رقابت
                <select
                  value={content.sportCompetition}
                  onChange={(event) => {
                    setContent((current) => ({
                      ...current,
                      sportCompetition: event.target.value,
                      sportEventIds: "[]",
                      sportResults: "",
                    }));
                    setSportEvents([]);
                  }}
                  disabled={!sportCompetitions.length}
                >
                  <option value="">انتخاب کنید</option>
                  {sportCompetitions.map((competition) => (
                    <option
                      disabled={!competition.available}
                      key={competition.id}
                      value={competition.id}
                    >
                      {competition.label}{competition.available ? "" : " (اتصال منبع در انتظار)"}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button
              className="secondary"
              disabled={!content.sportCompetition || sportLoading === "events"}
              onClick={() => void loadSportEvents()}
              type="button"
            >
              {sportLoading === "events" ? "در حال دریافت مسابقه‌ها…" : "دریافت مسابقه‌های این رقابت"}
            </button>
            {sportEvents.length > 0 && (
              <section className="sport-event-picker">
                <p className="hint">یک یا چند مسابقه را انتخاب کنید؛ نام‌ها فارسی می‌شوند و متن آمادهٔ انتشار در فرم می‌نشیند.</p>
                {sportEvents.map((event) => {
                  let selected: string[] = [];
                  try {
                    const stored = JSON.parse(content.sportEventIds);
                    if (Array.isArray(stored)) selected = stored.filter((id): id is string => typeof id === "string");
                  } catch { /* empty selection */ }
                  return (
                    <label className="sport-event-option" key={event.eventId}>
                      <input
                        checked={selected.includes(event.eventId)}
                        onChange={() => toggleSportEvent(event)}
                        type="checkbox"
                      />
                      {event.homeBadge && <img alt="" src={event.homeBadge} />}
                      <span>{event.label}</span>
                      {event.awayBadge && <img alt="" src={event.awayBadge} />}
                    </label>
                  );
                })}
              </section>
            )}
            {sportDataSource && <p className="hint">منبع: {sportDataSource}</p>}
            <label className="title-field">
              تیتر روی طرح
              <textarea
                value={content.title}
                onChange={updateContent("title")}
                placeholder="اختیاری؛ مثلاً نتیجهٔ مسابقه یا خبر محلی"
                rows={3}
              />
            </label>
            <label>
              نتایج / برنامه / مدال‌آوران
              <textarea
                value={content.sportResults}
                onChange={updateContent("sportResults")}
                placeholder="با انتخاب مسابقه‌ها خودکار پر می‌شود؛ برای رقابت محلیِ تأییدشده قابل ویرایش است."
                rows={5}
              />
            </label>
            <label>
              منبع داده
              <input
                value={content.sportSource}
                onChange={updateContent("sportSource")}
                placeholder="اختیاری؛ برای مسابقات محلی دستی وارد کنید"
              />
            </label>
            <label>
              توضیحات تکمیلی
              <textarea
                value={content.additionalInstructions}
                onChange={updateContent("additionalInstructions")}
                rows={2}
              />
            </label>
          </section>
        )}
        {contentToolError && (
          <p className="error morning-data-error">{contentToolError}</p>
        )}
        {hasField("kicker") && (
          <label>
            روتیتر
            <textarea
              value={content.kicker}
              onChange={updateContent("kicker")}
              placeholder="اختیاری؛ از خروجی تأییدشده"
              rows={2}
            />
          </label>
        )}
        {template === "editorial_note" && (
          <section className="editorial-note-style">
            <label>
              حالت بصری یادداشت
              <select
                value={content.editorialNoteStyle}
                onChange={updateContent("editorialNoteStyle")}
              >
                <option value="auto">هوشمند؛ متناسب با متن و تصویر</option>
                <option value="modern_statement">حرف / یادداشت مدرن</option>
                <option value="personal_message">پیام مستقیم و انسانی</option>
                <option value="progress_report">
                  گزارش عملکرد / بازدید صفحه
                </option>
              </select>
            </label>
          </section>
        )}
        {hasField("title") && (
          <VisualTextArea
            field="title"
            label={
              template === "editorial_note"
                ? "عنوان یادداشت (اختیاری)"
                : "تیتر اصلی"
            }
            onChange={(value) =>
              setContent((current) => ({
                ...current,
                title: normaliseContentValue("title", value),
              }))
            }
            placeholder={
              template === "editorial_note"
                ? "اختیاری؛ اگر خالی باشد متن یادداشت قهرمان طرح می‌شود."
                : "بدون تغییر کلمات"
            }
            required={template !== "editorial_note"}
            rows={3}
            value={content.title}
          />
        )}
        {hasField("subtitle") && (
          <VisualTextArea
            field="subtitle"
            label="زیرتیتر"
            onChange={(value) =>
              setContent((current) => ({
                ...current,
                subtitle: normaliseContentValue("subtitle", value),
              }))
            }
            placeholder="اختیاری"
            rows={2}
            value={content.subtitle}
          />
        )}
        {hasField("caption") && (
          <VisualTextArea
            field="body"
            label={
              templateGroup === "news"
                ? "کپشن / متن خبر برای فضای طرح و انتشار"
                : template === "editorial_note"
                  ? "متن یادداشت"
                  : "کپشن / متن روی طرح"
            }
            onChange={(value) =>
              setContent((current) => ({
                ...current,
                caption: normaliseContentValue("caption", value),
              }))
            }
            placeholder={
              templateGroup === "news"
                ? "متن نهایی خبر؛ مدل آن را برای درک موضوع و اندازهٔ فضای خالی کپشن می‌خواند اما داخل تصویر نمی‌نویسد."
                : template === "editorial_note"
                  ? "عنوان یا متن یادداشت باید وارد شود. متن کوتاه عیناً می‌آید؛ متن بلند فقط فضای خالی می‌گیرد."
                  : "عین خروجی متنی تأییدشده"
            }
            rows={templateGroup === "news" ? 6 : 4}
            value={content.caption}
          />
        )}
        {hasField("dataPoints") && (
          <label>
            داده‌های اینفوگرافی
            <textarea
              value={content.dataPoints}
              onChange={updateContent("dataPoints")}
              placeholder="هر مورد در یک خط؛ فقط دادهٔ تأییدشده"
            />
          </label>
        )}
        {hasField("prayerTimes") && (
          <label>
            اوقات شرعی
            <textarea
              value={content.prayerTimes}
              onChange={updateContent("prayerTimes")}
              placeholder="هر مورد در یک خط؛ نمونه: اذان صبح: ۰۴:۲۵&#10;طلوع: ۰۵:۵۴&#10;اذان ظهر: ۱۲:۰۸&#10;اذان مغرب: ۱۸:۲۷"
            />
            <small>
              برای صبح‌بخیر محلیِ گلبهار یا چناران؛ فقط زمان‌های تأییدشده را
              وارد کنید.
            </small>
          </label>
        )}
        {hasField("weather") && (
          <label>
            آب‌وهوا
            <textarea
              value={content.weather}
              onChange={updateContent("weather")}
              placeholder="هر مورد در یک خط؛ نمونه: وضعیت: نیمه‌ابری&#10;دما: ۲۲°&#10;کمینه / بیشینه: ۱۴° / ۲۶°&#10;باد: ۱۲ کیلومتر بر ساعت"
            />
          </label>
        )}
        {hasField("occasions") && (
          <label>
            مناسبت‌های روز
            <textarea
              value={content.occasions}
              onChange={updateContent("occasions")}
              placeholder="هر مناسبت در یک خط؛ ملی، مذهبی یا جهانیِ مرتبط"
            />
          </label>
        )}
        {hasField("riddle") && (
          <label>
            معمای کوتاه روز
            <textarea
              value={content.riddle}
              onChange={updateContent("riddle")}
              placeholder="یک معمای ساده و مناسب تعامل؛ پاسخ را در طرح ننویسید."
            />
          </label>
        )}
        {hasField("videoNote") && (
          <label>
            راهنمای جای خالی ویدیو
            <input
              value={content.videoNote}
              onChange={updateContent("videoNote")}
              placeholder="مثلاً ویدیوی مصاحبه یا گزارش میدانی"
            />
          </label>
        )}
        {hasField("senderContext") && (
          <label>
            توضیح پیام مردمی
            <input
              value={content.senderContext}
              onChange={updateContent("senderContext")}
              placeholder="مثلاً محله یا موضوع؛ اختیاری"
            />
          </label>
        )}
        {hasField("source") && (
          <label>
            {template === "editorial_note" ? "امضا / نام نویسنده" : "منبع"}
            <input
              value={content.source}
              onChange={updateContent("source")}
              placeholder={
                template === "editorial_note"
                  ? "اختیاری؛ مثلاً سردبیر کلام تازه"
                  : "اختیاری"
              }
            />
          </label>
        )}
        {templateGroup === "news" &&
          !isCitizenMessage &&
          canvas === "story_1080x1920" && (
            <label>
              متن تعامل با مخاطب
              <input
                value={content.interactionText}
                onChange={updateContent("interactionText")}
                placeholder="اختیاری؛ مثلاً «نظر شما چیه؟» یا «برای دوستت بفرست»"
              />
              <small>
                اگر وارد شود، به‌صورت یک لایهٔ مستقل و خوانا در طراحی استوری
                استفاده می‌شود.
              </small>
            </label>
          )}
        {templateGroup === "news" && !isCitizenMessage && (
          <label>
            توضیحات تکمیلی برای طراح / مدل
            <textarea
              value={content.additionalInstructions}
              onChange={updateContent("additionalInstructions")}
              placeholder="اختیاری؛ فقط برای توضیح جداگانهٔ طراحی. متن اصلی خبر را تغییر نمی‌دهد."
            />
          </label>
        )}
      </section>

      <section
        className={`card ${activeTab !== "create" || designSlides.length > 1 || templateGroup === "studio" ? "tab-hidden" : ""} ${formCollapsed ? "form-hidden" : ""} ${activeJob?.state === "completed" && !formEditMode ? "form-readonly" : ""}`}
      >
        <h2>
          {isCitizenMessage
            ? "۳. عکس یا فیلم پیام"
            : template === "poster"
              ? "۳. تصویر یا زمینهٔ پوستر"
              : template === "classifieds"
                ? "۳. بافت زمینهٔ آگهی‌ها"
                : "۳. عکس خبر / محتوا"}
        </h2>
        <p className="hint">
          {isCitizenMessage && citizenMessageType === "text"
            ? "این نوع فقط متن است؛ طرح یک فضای گفت‌وگوی خالیِ متناسب با طول پیام می‌سازد و تصویر مرجع نمی‌گیرد."
            : template === "classifieds"
              ? "اختیاری است؛ آگهی‌ها با کادرهای مستقل و خوانا ساخته می‌شوند. اگر عکسی می‌افزایید، فقط برای بافت آرامِ زمینه به‌کار می‌رود."
            : template === "poster"
              ? "اختیاری است؛ برای پوستر می‌توانید تصویر تازه بسازید، عکس مرجع بدهید یا طرحی کاملاً تایپوگرافیک و بدون عکس انتخاب کنید."
            : videoOverlay
              ? "در قالب ویدیو، مدل زیرِ لایه‌های رویی یک سبز فنی می‌سازد و رندرر آن را به کانال آلفای واقعی تبدیل می‌کند؛ متن، قاب و گرادینتِ روی ویدیو حفظ می‌شوند."
              : "تمام عناصر این طرح، از جمله متن، سربرگ، واترمارک و عکس، توسط هوش مصنوعی و بر پایهٔ قالب انتخابی ساخته می‌شوند."}
        </p>
        {!(isCitizenMessage && citizenMessageType === "text") && (
          <div className="choices">
            <button
              className={imageMode === "generate" ? "selected" : ""}
              onClick={() => chooseImageMode("generate")}
              type="button"
            >
              ساخت تصویر جدید
            </button>
            <button
              className={imageMode === "preserve" ? "selected" : ""}
              onClick={() => chooseImageMode("preserve")}
              type="button"
            >
              استفاده مستقیم از عکس مرجع
            </button>
            <button
              className={imageMode === "reference" ? "selected" : ""}
              onClick={() => chooseImageMode("reference")}
              type="button"
            >
              استفاده وفادار از عکس مرجع
            </button>
            <button
              className={imageMode === "none" ? "selected" : ""}
              onClick={() => chooseImageMode("none")}
              type="button"
            >
              طراحی AI بدون عکس مرجع
            </button>
          </div>
        )}
        {template === "morning_local" && (
          <section className="morning-photo-meta">
            <label>
              لوکیشن روی عکس
              <input
                value={content.morningLocation}
                onChange={updateContent("morningLocation")}
                placeholder="اختیاری؛ مثلاً دریاچه مصنوعی گلبهار"
              />
            </label>
            <label>
              عکاس / اعتبار عکس
              <input
                value={content.morningPhotoCredit}
                onChange={updateContent("morningPhotoCredit")}
                placeholder="اختیاری؛ مثلاً ارسالی شما یا نام عکاس"
              />
            </label>
          </section>
        )}
        {template === "morning_kalam" && (
          <section className="morning-photo-meta">
            <label>
              لوکیشن روی عکس
              <input
                value={content.morningKalamLocation}
                onChange={updateContent("morningKalamLocation")}
                placeholder="اختیاری؛ مثلاً استخر در روستای کاهو"
              />
            </label>
            <label>
              عکاس / اعتبار عکس
              <input
                value={content.morningKalamPhotoCredit}
                onChange={updateContent("morningKalamPhotoCredit")}
                placeholder="اختیاری؛ مثلاً کلام تازه"
              />
            </label>
          </section>
        )}
        {selectedImageMode === "generate" && (
          <label className="image-specific-instructions">
            پرامپت ساخت خودِ تصویر
            <textarea
              maxLength={1200}
              onChange={updateContent("imagePrompt")}
              placeholder="اختیاری؛ سوژه، محیط، زاویه، نور و حال‌وهوای عکس را بنویسید. این متن فقط لایهٔ تصویر را هدایت می‌کند و متن یا سربرگ طرح را تغییر نمی‌دهد."
              rows={4}
              value={content.imagePrompt}
            />
          </label>
        )}
        {["preserve", "reference"].includes(selectedImageMode) && (
          <label className="image-specific-instructions">
            توضیحات اختصاصی تصاویر مرجع
            <textarea
              maxLength={1000}
              onChange={updateContent("referenceInstructions")}
              placeholder="مثلاً کدام سوژه حفظ شود، تصویر در کدام بخش قرار بگیرد یا فقط پس‌زمینه از لبه‌ها گسترش یابد. این توضیح فقط روی همان تصویرها اثر دارد."
              rows={4}
              value={content.referenceInstructions}
            />
          </label>
        )}
        {selectedImageMode !== "none" && (
          <label className="reference-upload">
            تصاویر مرجع
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(event) =>
                setFiles(Array.from(event.target.files ?? []))
              }
            />
            <span>＋ انتخاب یک یا چند تصویر</span>
          </label>
        )}
        {filePreviews.length > 0 && (
          <div className="reference-grid">
            {filePreviews.map(({ file, url }) => (
              <figure key={`${file.name}-${file.lastModified}`}>
                <img src={url} alt={file.name} />
                <figcaption>{file.name}</figcaption>
                <div>
                  <button
                    aria-label={`نمایش ${file.name}`}
                    onClick={() => setPreviewFile({ name: file.name, url })}
                    type="button"
                  >
                    ◉
                  </button>
                  <button
                    aria-label={`حذف ${file.name}`}
                    onClick={() =>
                      setFiles((current) =>
                        current.filter((item) => item !== file),
                      )
                    }
                    type="button"
                  >
                    ×
                  </button>
                </div>
              </figure>
            ))}
          </div>
        )}
        {formEditMode &&
          (activeJob?.uploadedImages ?? []).filter(
            (item) => !excludedDraftReferences.includes(item.filename),
          ).length > 0 && (
            <div className="reference-files">
              <b>تصاویر مرجعِ نسخهٔ فعلی</b>
              {(activeJob?.uploadedImages ?? [])
                .filter(
                  (item) => !excludedDraftReferences.includes(item.filename),
                )
                .map((item) => (
                  <span key={item.filename}>
                    ✓ {item.filename}
                    <button
                      aria-label={`نمایش ${item.filename}`}
                      onClick={() => void previewActiveReference(item.filename)}
                      type="button"
                    >
                      ◉
                    </button>
                    <button
                      aria-label={`حذف ${item.filename}`}
                      onClick={() =>
                        setExcludedDraftReferences((current) => [
                          ...current,
                          item.filename,
                        ])
                      }
                      type="button"
                    >
                      ×
                    </button>
                  </span>
                ))}
            </div>
          )}
        {visibleDraftReferences.length > 0 && (
          <div className="reference-files">
            <b>تصاویر واردشده از پیام فورواردی</b>
            {visibleDraftReferences.map((name) => (
              <span key={name}>
                ✓ {name}
                <button
                  aria-label={`نمایش ${name}`}
                  onClick={() => void previewDraftReference(name)}
                  type="button"
                >
                  ◉
                </button>
                <button
                  aria-label={`حذف ${name}`}
                  onClick={() =>
                    setExcludedDraftReferences((current) => [...current, name])
                  }
                  type="button"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </section>

      <section className={`card content-archive subject-workspace ${activeTab === "subjects" ? "" : "tab-hidden"}`}>
        <div className="section-heading"><div><h2>سوژه خبری</h2><p className="hint">فضای مشترک تحریریه برای خبر، پیام مردمی، کامنت، دایرکت و خروجی‌های AI.</p></div><button className="primary" onClick={() => setManualSubjectOpen((value) => !value)} type="button">＋ افزودن دستی</button></div>
        {subjectError && <p className="error">{subjectError}</p>}
        {subjectNotice && <p className="hint">{subjectNotice}</p>}
        {manualSubjectOpen && <section className="archive-note-form">
          <label>تیتر سوژه<input value={manualSubjectTitle} onChange={(event) => setManualSubjectTitle(event.target.value)} placeholder="تیتر یا عنوان سوژه" /></label>
          <label>متن کامل خبر<textarea rows={5} value={manualSubjectText} onChange={(event) => setManualSubjectText(event.target.value)} placeholder="متن کامل خبر یا اطلاعات اولیه" /></label>
          <label>توضیحات اولیه (به‌عنوان اولین یادداشت)<textarea rows={3} value={manualSubjectNote} onChange={(event) => setManualSubjectNote(event.target.value)} placeholder="نکتهٔ سردبیر یا شرح پیگیری" /></label>
          <label>فایل‌های مرتبط<input type="file" multiple onChange={(event) => { const files = Array.from(event.target.files ?? []); setManualSubjectFiles(files); setManualSubjectUploadQueue(files.map((file) => ({ id: `${file.name}-${file.lastModified}`, file, loaded: 0, total: file.size, status: "preparing" }))); }} /><small>{toPersianDigits(String(manualSubjectFiles.length))} فایل انتخاب شده</small></label><UploadQueueRows items={manualSubjectUploadQueue} />
          <button className="primary" disabled={manualSubjectBusy || (!manualSubjectTitle.trim() && !manualSubjectText.trim())} onClick={() => void createManualSubject()} type="button">{manualSubjectBusy ? "در حال ثبت و بارگذاری…" : "ثبت سوژه"}</button>
        </section>}
        <div className="archive-filters"><label>نوع محتوا<select value={archiveCategory} onChange={(event) => setArchiveCategory(event.target.value as typeof archiveCategory)}><option value="all">همه</option><option value="news">خبر</option><option value="citizen">مردمی</option><option value="misc">متفرقه</option></select></label><label>وضعیت<select value={archiveState} onChange={(event) => setArchiveState(event.target.value as typeof archiveState)}><option value="all">همه</option><option value="draft">پیش‌نویس</option><option value="preparing">در حال آماده‌سازی</option><option value="ready">آمادهٔ انتشار</option><option value="published">منتشرشده</option><option value="cancelled">لغوشده</option></select></label></div>
        <div className="project-list">{archivedContentProjects.length === 0 ? <p className="hint">هنوز سوژه‌ای با این فیلتر ثبت نشده است.</p> : archivedContentProjects.map((project) => {
          const open = subjectOpenId === project.contentProjectId;
          const detail = open && activeContentProject?.contentProjectId === project.contentProjectId ? activeContentProject : project;
          const isAiSubject = ["ai_editor", "editorial"].includes(String(project.source?.kind || ""));
          const sourceData = (detail.source ?? {}) as Record<string, unknown>;
          const archivedMessages = Array.isArray(sourceData.engagementItems) ? sourceData.engagementItems as Array<Record<string, unknown>> : [];
          const archivedClubItems = Array.isArray(sourceData.clubItems) ? sourceData.clubItems as Array<Record<string, unknown>> : [];
          return <article className="project-card archive-project-card" key={project.contentProjectId}><b>{project.title || project.article?.title || "بدون تیتر"}</b><small>{project.createdBy?.name || accessView.users.find((person) => person.chatId === project.ownerId)?.username || project.ownerId} · {formatEngagementTime(Math.floor(new Date(project.createdAt).getTime() / 1000))} · {subjectSourceLabel(project.source)} · {toPersianDigits(String(project.mediaCount))} مدیا</small><div className="archive-actions"><select value={project.state} onChange={(event) => void updateContentProject(telegram?.initData, project.contentProjectId, { state: event.target.value as ContentProject["state"] }).then((result) => result?.project && setContentProjects((items) => items.map((item) => item.contentProjectId === project.contentProjectId ? result.project : item)))}><option value="draft">پیش‌نویس</option><option value="preparing">در حال آماده‌سازی</option><option value="ready">آمادهٔ انتشار</option><option value="published">منتشرشده</option><option value="cancelled">لغوشده</option></select><button onClick={() => void toggleSubjectProject(project.contentProjectId)} type="button">{open ? "بستن" : "نمایش"}</button><button aria-label="حذف سوژه" onClick={() => void deleteSubjectProject(project)} title="حذف سوژه" type="button">🗑</button></div>
          {open && <div className="subject-detail">
            {isAiSubject ? <><h3>متن اولیه</h3><p style={{ whiteSpace: "pre-wrap" }}>{detail.rawText || "متن اولیه ثبت نشده است."}</p><h3>متن نهایی</h3><p style={{ whiteSpace: "pre-wrap" }}>{detail.article?.body || detail.article?.lead || detail.article?.title || "هنوز خروجی نهایی ندارد."}</p></> : <><h3>محتوا</h3><p style={{ whiteSpace: "pre-wrap" }}>{detail.rawText || detail.article?.body || detail.article?.lead || "متنی ثبت نشده است."}</p></>}
            {(archivedMessages.length > 0 || archivedClubItems.length > 0) && <section className="archived-source-items"><h3>همهٔ پیام‌های ذخیره‌شده</h3>{[...archivedMessages, ...archivedClubItems].map((item, index) => <article key={String(item.eventId || `${index}`)}><b>{String(item.senderUsername || item.senderName || (item.direction === "outgoing" ? "پاسخ ما" : "پیام مخاطب"))}</b><p style={{ whiteSpace: "pre-wrap" }}>{String(item.text || "رسانهٔ پیوست‌شده")}</p>{Array.isArray(item.attachments) && <small>{toPersianDigits(String(item.attachments.length))} پیوست</small>}</article>)}</section>}
            <div className="subject-media">{(detail.media ?? []).map((media) => media.kind === "image" ? <img className="engagement-message-media" key={media.mediaId} src={subjectMediaUrls[media.mediaId]} alt={media.filename} /> : <span key={media.mediaId}>{media.filename}</span>)}</div>
            <h3>یادداشت‌ها</h3>{(detail.notes ?? []).map((note) => <div className="archive-note" key={note.id || `${note.at}-${note.by}`}><b>{note.author}</b>{note.parentNoteId && <small> پاسخ به یادداشت</small>}<p style={{ whiteSpace: "pre-wrap" }}>{note.text}</p><button aria-label="پاسخ به یادداشت" onClick={() => { setSubjectReplyTo(note.id); setSubjectNote(`@${accessView.users.find((person) => person.chatId === note.by)?.username || note.by} `); }} type="button">↩</button></div>)}
            <div className="archive-note-form"><textarea rows={4} value={subjectNote} onChange={(event) => setSubjectNote(event.target.value)} placeholder={subjectReplyTo ? "پاسخ به یادداشت…" : "یادداشت جدید؛ برای منشن @نام‌کاربری را وارد کنید"}/><datalist id="subject-mentions">{accessView.users.filter((person) => ["active", "owner"].includes(person.status)).map((person) => <option key={person.chatId} value={`@${person.username || person.chatId}`}>{person.username || person.chatId}</option>)}</datalist><button disabled={!subjectNote.trim()} onClick={() => void addSubjectNote(detail)} type="button">ثبت یادداشت</button></div>
            {accessState === "owner" && <div className="archive-note-form"><button onClick={() => setSubjectSmsOpenId(subjectSmsOpenId === detail.contentProjectId ? "" : detail.contentProjectId)} type="button">📨 پیامک تیم</button>{subjectSmsOpenId === detail.contentProjectId && <><b>دریافت‌کننده‌ها</b>{accessView.users.filter((person) => person.status === "active" && person.workPhone).map((person) => <label key={person.chatId}><input type="checkbox" checked={subjectSmsRecipientIds.includes(person.chatId)} onChange={() => setSubjectSmsRecipientIds((current) => current.includes(person.chatId) ? current.filter((id) => id !== person.chatId) : [...current, person.chatId])}/>{person.username || person.chatId}</label>)}<textarea maxLength={320} rows={3} value={subjectSmsText} onChange={(event) => setSubjectSmsText(event.target.value)} placeholder="متن کوتاه اعلان تیم"/><button disabled={!subjectSmsText.trim() || !subjectSmsRecipientIds.length} onClick={() => void sendSubjectTeamSms(detail)} type="button">ارسال پیامک</button></>}</div>}
          </div>}</article>;
        })}</div>
      </section>

      <section
        className={`card library-workspace ${activeTab === "library" ? "" : "tab-hidden"}`}
      >
        <div className="section-heading">
          <div>
            <h2>کتابخانه</h2>
            <p className="hint">
              دارایی‌های تصویر، پروژه‌های متنی و سابقهٔ انتشار جدا نگه‌داری
              می‌شوند.
            </p>
          </div>
          <button
            className="secondary"
            onClick={() => {
              void refreshProjects();
              void refreshContentProjects();
              void refreshVideoLibrary();
            }}
            type="button"
          >
            به‌روزرسانی
          </button>
        </div>
        <div className="library-tabs">
          <button
            className={libraryTab === "images" ? "selected" : ""}
            onClick={() => setLibraryTab("images")}
            type="button"
          >
            تصاویر
          </button>
          <button
            className={libraryTab === "videos" ? "selected" : ""}
            onClick={() => setLibraryTab("videos")}
            type="button"
          >
            ویدیوها
          </button>
          <button
            className={libraryTab === "texts" ? "selected" : ""}
            onClick={() => setLibraryTab("texts")}
            type="button"
          >
            متن‌ها
          </button>
          <button
            className={libraryTab === "publications" ? "selected" : ""}
            onClick={() => setLibraryTab("publications")}
            type="button"
          >
            انتشارها
          </button>
          {activeContentProject && (
            <button
              className="secondary"
              disabled={editorialSaving}
              onClick={() => void saveEditorialProject(true)}
              type="button"
            >
              ذخیره به‌عنوان محتوای جدید
            </button>
          )}
          <button
            className="secondary"
            disabled={editorialSaving || (!editorialArticle.title && !editorialRawText && !reporterOutput)}
            onClick={() => void saveEditorialToArchive()}
            type="button"
          >
            <BookmarkIcon /> ذخیره در سوژه خبری
          </button>
        </div>
        {libraryTab === "archive" && (
          <section className="content-archive">
            <div className="archive-filters">
              <label>
                نوع محتوا
                <select value={archiveCategory} onChange={(event) => setArchiveCategory(event.target.value as typeof archiveCategory)}>
                  <option value="all">همه</option>
                  <option value="news">خبر</option>
                  <option value="citizen">مردمی</option>
                  <option value="misc">متفرقه</option>
                </select>
              </label>
              <label>
                وضعیت
                <select value={archiveState} onChange={(event) => setArchiveState(event.target.value as typeof archiveState)}>
                  <option value="all">همه</option>
                  <option value="draft">پیش‌نویس</option>
                  <option value="preparing">در حال آماده‌سازی</option>
                  <option value="ready">آمادهٔ انتشار</option>
                  <option value="published">منتشرشده</option>
                  <option value="cancelled">لغوشده</option>
                </select>
              </label>
            </div>
            <div className="project-list">
              {archivedContentProjects.length === 0 ? <p className="hint">محتوای ذخیره‌شده‌ای با این فیلتر وجود ندارد.</p> : archivedContentProjects.map((project) => (
                <article className="project-card archive-project-card" key={project.contentProjectId}>
                  <b>{project.title || project.article?.title || "بدون تیتر"}</b>
                  <small>{project.category === "news" ? "خبر" : project.category === "citizen" ? "مردمی" : "متفرقه"} · {project.state === "draft" ? "پیش‌نویس" : project.state === "preparing" ? "در حال آماده‌سازی" : project.state === "ready" ? "آمادهٔ انتشار" : project.state === "published" ? "منتشرشده" : "لغوشده"} · {toPersianDigits(String(project.mediaCount))} مدیا</small>
                  <div className="archive-actions">
                    <select value={project.state} onChange={(event) => void updateContentProject(telegram?.initData, project.contentProjectId, { state: event.target.value as ContentProject["state"] }).then((result) => { if (result?.project) { setContentProjects((items) => items.map((item) => item.contentProjectId === result.project.contentProjectId ? result.project : item)); if (activeContentProject?.contentProjectId === result.project.contentProjectId) setActiveContentProject(result.project); } })}>
                      <option value="draft">پیش‌نویس</option><option value="preparing">در حال آماده‌سازی</option><option value="ready">آمادهٔ انتشار</option><option value="published">منتشرشده</option><option value="cancelled">لغوشده</option>
                    </select>
                    <button type="button" onClick={() => void openContentProject(project.contentProjectId, "editorial")}>بازکردن</button>
                  </div>
                  <div className="archive-note-form">
                    <input value={archiveNote} onChange={(event) => setArchiveNote(event.target.value)} placeholder="یادداشت برای این محتوا" />
                    <button type="button" disabled={!archiveNote.trim()} onClick={() => void updateContentProject(telegram?.initData, project.contentProjectId, { note: archiveNote }).then((result) => { if (result?.project) { setArchiveNote(""); setContentProjects((items) => items.map((item) => item.contentProjectId === result.project.contentProjectId ? result.project : item)); } })}>ثبت یادداشت</button>
                  </div>
                  {(project.notes ?? []).slice(-2).reverse().map((note) => <small className="archive-note" key={`${note.at}-${note.by}`}>{note.author}: {note.text}</small>)}
                </article>
              ))}
            </div>
          </section>
        )}
        {libraryTab === "images" && (
          <>
            <p className="hint">سربرگ فعال رسانه: {brands[brand].label}</p>
            <div className="brand-asset-previews">
              <figure>
                <img
                  src={brandHeaders[brand]}
                  alt={`سربرگ ${brands[brand].label}`}
                />
                <figcaption>سربرگ فعال</figcaption>
              </figure>
            </div>
            <div className="project-list">
              {projects.length === 0 ? (
                <p className="hint">هنوز پروژهٔ تصویری ثبت نشده است.</p>
              ) : (
                projects.map((project) => (
                  <article className="project-card" key={project.requestId}>
                    <b>{project.title || "بدون تیتر"}</b>
                    <small>
                      {brands[project.brand as Brand]?.label ?? project.brand} ·{" "}
                      {toPersianDigits(String(project.uploadedImageCount))} عکس
                      · {project.state}
                    </small>
                    <button
                      onClick={() => openProject(project.requestId)}
                      type="button"
                    >
                      بازکردن خروجی و ویرایش
                    </button>
                  </article>
                ))
              )}
            </div>
          </>
        )}
        {libraryTab === "videos" && (
          <div className="project-list video-library-list">
            {videoLibraryProjects.length === 0 ? (
              <p className="hint">هنوز پروژهٔ ویدیویی ثبت نشده است.</p>
            ) : (
              videoLibraryProjects.map((project) => {
                const stateLabel =
                  {
                    queued: "در صف",
                    processing: "در حال ساخت",
                    cancel_requested: "در حال توقف",
                    cancelled: "متوقف‌شده",
                    completed: "تکمیل‌شده",
                    failed: "ناموفق",
                  }[project.state] ?? project.state;
                return (
                  <article className="project-card video-library-card" key={project.projectId}>
                    <b>
                      {project.project.lines[0]?.text || "پروژهٔ ویدیویی"}
                    </b>
                    <small>
                      {brands[project.project.brand].label} · {stateLabel} ·{" "}
                      {toPersianDigits(String(project.estimatedSeconds))} ثانیه
                    </small>
                    <small>
                      {project.project.generationModel === "gemini_omni_flash"
                        ? "Gemini Omni Flash"
                        : "Veo 3.1"}{" "}
                      · {project.project.canvas === "portrait" ? "عمودی" : "افقی"}
                      · {toPersianDigits(String(project.segments.length))} بخش
                    </small>
                    <details className="video-attempt-history">
                      <summary>
                        فهرست کامل تلاش‌ها ({toPersianDigits(String(project.events?.length ?? 0))})
                      </summary>
                      {(project.events ?? []).slice().reverse().map((event, index) => (
                        <span key={`${event.at}-${index}`}>
                          <b>{event.attempt ? `تلاش ${toPersianDigits(String(event.attempt))} · ` : ""}{event.state}</b>
                          <small>
                            {new Date(event.at * 1000).toLocaleString("fa-IR")} ·{" "}
                            {event.message}
                          </small>
                        </span>
                      ))}
                    </details>
                    <button
                      onClick={() => {
                        setVideoProjectToOpen(project.projectId);
                        setActiveTab("video");
                      }}
                      type="button"
                    >
                      بازکردن فرم و نتیجه
                    </button>
                  </article>
                );
              })
            )}
          </div>
        )}
        {libraryTab === "texts" && (
          <div className="project-list">
            {contentProjects.length === 0 ? (
              <p className="hint">هنوز پروژهٔ متنی ثبت نشده است.</p>
            ) : (
              contentProjects.map((project) => (
                <article
                  className="project-card"
                  key={project.contentProjectId}
                >
                  <b>{project.title || "بدون تیتر"}</b>
                  <small>
                    {brands[project.brand].label} · نسخهٔ{" "}
                    {toPersianDigits(String(project.revision))} ·{" "}
                    {new Date(project.updatedAt).toLocaleString("fa-IR")}
                  </small>
                  <button
                    onClick={() =>
                      void openContentProject(
                        project.contentProjectId,
                        "editorial",
                      )
                    }
                    type="button"
                  >
                    بازکردن متن
                  </button>
                </article>
              ))
            )}
          </div>
        )}
        {libraryTab === "publications" && (
          <div className="project-list">
            {libraryPublications.length === 0 ? (
              <p className="hint">هنوز سابقهٔ انتشار ثبت نشده است.</p>
            ) : (
              libraryPublications.map(({ project, publication }) => (
                <article
                  className="project-card"
                  key={publication.publicationId}
                >
                  <b>{project.title || "بدون تیتر"}</b>
                  <small>
                    {brands[project.brand].label} ·{" "}
                    {publication.kind === "text"
                      ? "متن"
                      : publication.kind === "site"
                        ? "سایت"
                        : "فایل"}{" "}
                    ·{" "}
                    {new Date(publication.createdAt * 1000).toLocaleString(
                      "fa-IR",
                    )}
                  </small>
                  <small>
                    {publication.status === "published"
                      ? "منتشر شد"
                      : publication.status === "partial"
                        ? "بخشی از مقصدها ناموفق بودند"
                        : publication.status === "uncertain"
                          ? "نیازمند بررسی است"
                          : publication.status === "failed"
                            ? "ناموفق"
                            : "در حال انجام"}{" "}
                    ·{" "}
                    {toPersianDigits(
                      String(
                        (
                          publication.targets ??
                          publication.results.map((item) => item.target)
                        ).length,
                      ),
                    )}{" "}
                    مقصد
                  </small>
                  <button
                    onClick={() =>
                      void openContentProject(
                        project.contentProjectId,
                        "publish",
                        publication.publicationId,
                      )
                    }
                    type="button"
                  >
                    مشاهدهٔ انتشار
                  </button>
                </article>
              ))
            )}
          </div>
        )}
      </section>

      {activeTab === "video" && <VideoMakerWorkspace brand={brand} telegramInitData={telegram?.initData} openProjectId={videoProjectToOpen} onProjectOpened={() => setVideoProjectToOpen("")} />}

      {activeTab === "news" && (
        <NewsSeekerWorkspace
          activeCategory={newsCategory}
          busy={newsBusy}
          error={newsError}
          notice={newsNotice}
          onBack={() => setActiveTab("create")}
          onCategory={setNewsCategory}
          onEdit={sendNewsToEditorial}
          onImage={sendNewsToImage}
          onPublish={(item) => void sendNewsToPublish(item)}
          onArchive={(item) => void saveNewsToArchive(item)}
          onRefresh={(category) => void requestNewsRefresh(category)}
          onSelect={setSelectedNewsSnapshotId}
          selectedSnapshotId={selectedNewsSnapshotId}
          snapshots={newsSnapshots}
          items={newsItems}
          queue={newsQueue}
          sources={newsSources}
          onQueueSelect={(item) => void addNewsToQueue(item)}
          onQueueDraft={(entry) => void draftNewsQueueItem(entry)}
          onQueueProject={(entry) => void openNewsQueueProject(entry)}
        />
      )}

      {activeTab === "club" && (
        <ClubAdmin
          telegramInitData={telegram?.initData}
          onBack={() => setActiveTab("create")}
          onClassifiedsSelected={(ads) => {
            setTemplateGroup("non_news");
            setTemplate("classifieds");
            setContent((current) => ({ ...current, classifiedsJson: JSON.stringify(ads) }));
            setActiveTab("create");
          }}
        />
      )}

      <section
        className={`engagement-workspace ${activeTab === "engagement" ? "" : "tab-hidden"}`}
      >
        <div className="engagement-hero">
          <div>
            <span>Instagram · Community Desk</span>
            <h2>
              {engagementView === "inbox"
                ? "صندوق ورودی مخاطبان"
                : engagementView === "comments"
                  ? "کامنت‌های پست‌ها"
                  : engagementView === "rules"
                    ? "قوانین پاسخ‌گویی"
                    : "تنظیمات اتصال"}
            </h2>
            <p>
              دایرکت و کامنت از هم جدا هستند؛ کلیدهای اتصال فقط برای مدیر اصلی
              قابل مدیریت‌اند.
            </p>
          </div>
          <button
            className="secondary"
            disabled={engagementBusy}
            onClick={() =>
              void refreshEngagement(
                engagementView === "settings" &&
                  Boolean(selectedEngagementConnection),
              )
            }
            type="button"
          >
            {engagementBusy ? "در حال همگام‌سازی…" : "به‌روزرسانی"}
          </button>
        </div>
        {!engagementConfigured && (
          <article className="engagement-notice">
            <b>هنوز اتصال BoxAPI ثبت نشده است.</b>
            <p>
              در تب «تنظیمات» نام اتصال و کلید API را وارد کنید. کلید پس از ثبت
              فقط در سرور نگه‌داری می‌شود و قابل مشاهدهٔ مجدد نیست.
            </p>
          </article>
        )}
        {engagementError && <p className="error">{engagementError}</p>}
        {engagementView === "settings" && accessState === "owner" && (
          <>
            <EngagementKnowledgePanel
              articles={engagementSiteArticles}
              busy={engagementKnowledgeBusy}
              knowledge={engagementKnowledge}
              onChange={setEngagementKnowledge}
              onSave={() => void saveEngagementKnowledge()}
              onSync={() => void saveEngagementKnowledge(true)}
              onOptimize={() => void optimizeEngagementKnowledge()}
            />
            <EngagementTagCatalog
              tags={engagementTags}
              busy={engagementBusy}
              onCreate={(tag) => void manageSharedEngagementTag("create", tag)}
              onRename={(tag, next) => void manageSharedEngagementTag("rename", tag, next)}
              onDelete={(tag) => void manageSharedEngagementTag("delete", tag)}
            />
          </>
        )}
        {engagementView === "inbox" && (
          <EngagementMessenger
            accounts={engagementAccounts}
            inbox={engagementInbox}
            knownTags={engagementTags}
            selectedEventId={selectedInboxEventId}
            activeAccounts={engagementFilters}
            activeTags={engagementTagFilters}
            replyText={engagementReplyText}
            busy={engagementReplyBusy}
            loading={engagementBusy}
            onBack={() => {
              setSelectedInboxEventId("");
              setEngagementReplyText("");
            }}
            onProfile={() => void resolveEngagementProfile()}
            onArchive={(eventId) => void saveEngagementToArchive(eventId)}
            onArchiveMany={(eventIds) => void saveEngagementManyToArchive(eventIds)}
            onBulkMessage={(eventIds, text) => sendBulkEngagementConversations(eventIds, text)}
            onRefresh={() => void refreshEngagement()}
            hasMore={engagementInboxHasMore}
            loadingMore={engagementInboxLoadingMore}
            onLoadMore={() => void loadMoreEngagementInbox()}
            onStoryContext={(story, context) => saveEngagementStoryContext(story, context)}
            onStoryRule={(story) => {
              if (accessState !== "owner") {
                setEngagementError("فعال‌سازی پاسخ خودکار استوری فقط برای مدیر اصلی مجاز است.");
                return;
              }
              if (!story.mediaId) {
                setEngagementError("شناسهٔ این استوری در دادهٔ دریافتی موجود نیست؛ قانون امن برای آن ساخته نشد.");
                return;
              }
              setEditingEngagementRule({
                ruleId: "",
                name: "پاسخ این استوری",
                enabled: false,
                accountIds: [story.accountId],
                eventTypes: ["story_reply"],
                match: { mode: "contains", text: "" },
                action: { mode: "auto_reply", text: "", character: "none" },
                actions: [{ mode: "auto_reply", text: "", character: "none" }],
                priority: 100,
                cooldownSeconds: 0,
                scope: { kind: "story", accountId: story.accountId, mediaId: story.mediaId },
              });
              setEngagementView("rules");
            }}
            onReply={() => void replyToEngagementMessage()}
            onReplyText={setEngagementReplyText}
            onSelect={(eventId) => {
              setSelectedInboxEventId(eventId);
              setEngagementReplyText("");
              void markEngagementConversationRead(eventId);
              void loadEngagementThread(eventId, "conversation");
            }}
            onSuggest={(instruction, character) => void suggestEngagementReply(instruction, character)}
            showcases={engagementShowcases}
            onSendShowcase={(showcaseId) => void sendSelectedShowcase(showcaseId)}
            onLead={() => void prepareEngagementLead()}
            onTags={(eventId, tags) => void updateEngagementTags(tags, eventId)}
            onToggleAccount={(id) =>
              setEngagementFilters((current) =>
                current.includes(id)
                  ? current.filter((item) => item !== id)
                  : [...current, id],
              )
            }
            onClearAccounts={() => setEngagementFilters([])}
            onToggleTag={(tag) =>
              setEngagementTagFilters((current) =>
                current.includes(tag)
                  ? current.filter((item) => item !== tag)
                  : [...current, tag],
              )
            }
            instagramPushAccounts={instagramPushAccounts}
            onToggleInstagramPush={(accountId) => void toggleInstagramBrowserPush(accountId)}
          />
        )}
        {leadDraft && <div className="bulk-modal-backdrop" role="presentation"><section className="lead-draft-modal" role="dialog" aria-modal="true"><header><h3>ثبت لید بازاریابی از گفتگو</h3><button className="secondary" onClick={() => setLeadDraft(undefined)} type="button">×</button></header><p className="hint">اطلاعات با تحلیل همین گفتگو و فیلدهای لید تازه‌سیستم پیشنهاد شده‌اند؛ قبل از ثبت قابل ویرایش‌اند.</p><div className="lead-draft-grid">{([['title','عنوان لید'],['business_name','نام کسب‌وکار'],['industry','صنعت'],['city','شهر'],['province','استان'],['address','آدرس'],['mobile','شماره موبایل'],['first_name','نام'],['last_name','نام خانوادگی']] as Array<[string,string]>).map(([key,label]) => <label key={key}>{label}<input value={String((leadDraft as unknown as Record<string, unknown>)[key] ?? "")} onChange={(event) => setLeadDraft((current) => current ? ({ ...current, [key]: event.target.value }) : current)} /></label>)}<label>وضعیت<select value={leadDraft.status} onChange={(event) => setLeadDraft((current) => current ? ({ ...current, status: event.target.value as "new" }) : current)}><option value="new">جدید</option></select></label><label>نوع لید<input value={leadDraft.lead_type} onChange={(event) => setLeadDraft((current) => current ? ({ ...current, lead_type: event.target.value }) : current)} /></label><label>درصد موفقیت<input type="number" min={0} max={100} value={leadDraft.success_probability} onChange={(event) => setLeadDraft((current) => current ? ({ ...current, success_probability: Number(event.target.value) }) : current)} /></label><label>منبع سرنخ<input value="دایرکت هوشمند" readOnly /></label><label className="lead-draft-wide">علاقمندی‌ها<input value={leadDraft.customer_interests.join(", ")} onChange={(event) => setLeadDraft((current) => current ? ({ ...current, customer_interests: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) }) : current)} /></label><label className="lead-draft-wide">یادداشت<textarea rows={6} value={leadDraft.notes} onChange={(event) => setLeadDraft((current) => current ? ({ ...current, notes: event.target.value }) : current)} /></label></div><div className="lead-draft-actions"><button className="secondary" disabled={leadDraftSaving} onClick={() => setLeadDraft(undefined)} type="button">انصراف</button><button className="primary" disabled={leadDraftSaving} onClick={() => void saveEngagementLead()} type="button">{leadDraftSaving ? "در حال ثبت…" : "تأیید و ثبت لید"}</button></div></section></div>}
        {engagementView === "comments" && (
          <EngagementComments
            accounts={engagementAccounts}
            inbox={engagementInbox}
            knownTags={engagementTags}
            activeAccounts={engagementFilters}
            busy={engagementReplyBusy}
            onReply={(eventId, text) =>
              void replyToEngagementMessage(eventId, text)
            }
            onBulk={bulkReplyToEngagementComments}
            onArchive={(eventId) => void saveEngagementToArchive(eventId)}
            onArchiveMany={(eventIds) => void saveEngagementManyToArchive(eventIds)}
            onTags={(eventId, tags) => void updateEngagementTags(tags, eventId)}
            onToggleAccount={(id) =>
              setEngagementFilters((current) =>
                current.includes(id)
                  ? current.filter((item) => item !== id)
                  : [...current, id],
              )
            }
            onClearAccounts={() => setEngagementFilters([])}
            hasMore={engagementInboxHasMore}
            loadingMore={engagementInboxLoadingMore}
            onLoadMore={() => void loadMoreEngagementInbox()}
            onOpenPost={(eventId) => void loadEngagementThread(eventId, "post")}
          />
        )}
        {engagementView === "inbox" && selectedInboxEventId && (
          <div className="engagement-ai-shortcut">
            <button
              className="secondary"
              disabled={engagementReplyBusy}
              onClick={() => void suggestEngagementReply()}
              type="button"
            >
              ✦ ساخت پیشنهاد پاسخ با AI
            </button>
            <small>
              پیشنهاد در کادر پاسخ قرار می‌گیرد؛ بدون تأیید و ارسال شما، پیام
              ارسال نمی‌شود.
            </small>
          </div>
        )}
        {engagementView === "inbox" && (
          <section className="engagement-panel engagement-inbox">
            <div className="section-heading">
              <div>
                <h3>صندوق ورودی یکپارچه</h3>
                <p className="hint">
                  دایرکت، کامنت و پاسخ استوریِ حساب‌های انتخاب‌شده.
                </p>
              </div>
              <span>
                {toPersianDigits(
                  String(
                    engagementInbox.filter(
                      (item) => item.direction !== "outgoing",
                    ).length,
                  ),
                )}{" "}
                پیام
              </span>
            </div>
            <div className="engagement-account-list inbox-filter">
              {engagementAccounts.map((account) => (
                <label
                  className={
                    engagementFilters.includes(account.id) ? "selected" : ""
                  }
                  key={account.id}
                >
                  <input
                    checked={engagementFilters.includes(account.id)}
                    onChange={() =>
                      setEngagementFilters((current) =>
                        current.includes(account.id)
                          ? current.filter((id) => id !== account.id)
                          : [...current, account.id],
                      )
                    }
                    type="checkbox"
                  />
                  <span>
                    {account.username
                      ? `@${account.username.replace(/^@/, "")}`
                      : account.id}
                  </span>
                  <small>{account.active ? "فعال" : "غیرفعال"}</small>
                </label>
              ))}
            </div>
            <button
              className="link-button"
              disabled={engagementBusy}
              onClick={() => void refreshEngagement()}
              type="button"
            >
              به‌روزرسانی صندوق
            </button>
            <div className="inbox-messenger">
              {engagementInbox.length === 0 ? (
                <p className="hint">
                  هنوز رویدادی دریافت نشده است. پس از اتصال حساب و ثبت وب‌هوک،
                  پیام‌ها اینجا دیده می‌شوند.
                </p>
              ) : (
                <>
                  <div className="engagement-inbox-list">
                    {engagementInbox
                      .filter((item) => item.direction !== "outgoing")
                      .map((item) => {
                        const account = engagementAccounts.find(
                          (entry) => entry.id === item.accountId,
                        );
                        const displayName =
                          item.senderName ||
                          item.senderUsername ||
                          "کاربر اینستاگرام";
                        return (
                          <button
                            className={`inbox-message-card ${selectedInboxEventId === item.eventId ? "selected" : ""}`}
                            key={item.eventId}
                            onClick={() => {
                              setSelectedInboxEventId(item.eventId);
                              setEngagementReplyText("");
                            }}
                            type="button"
                          >
                            <span className="inbox-avatar">
                              {item.senderProfilePhoto ? (
                                <img src={item.senderProfilePhoto} alt="" />
                              ) : (
                                displayName.slice(0, 1)
                              )}
                            </span>
                            <span className="inbox-card-copy">
                              <b>{displayName}</b>
                              <small>
                                {item.senderUsername
                                  ? `@${item.senderUsername.replace(/^@/, "")}`
                                  : "نام کاربری در حال دریافت یا در دسترس نیست"}
                              </small>
                              <p>{engagementMessageSummary(item)}</p>
                            </span>
                            <span className="inbox-card-meta">
                              <small>
                                {account?.username
                                  ? `@${account.username.replace(/^@/, "")}`
                                  : "رسانه نامشخص"}
                              </small>
                              <time>
                                {formatEngagementTime(item.receivedAt)}
                              </time>
                              <i className={item.status}>
                                {item.status === "replied"
                                  ? "پاسخ داده شد"
                                  : item.status === "new"
                                    ? "جدید"
                                    : item.status}
                              </i>
                            </span>
                          </button>
                        );
                      })}
                  </div>
                  {selectedInboxEventId &&
                    (() => {
                      const selected = engagementInbox.find(
                        (item) => item.eventId === selectedInboxEventId,
                      );
                      if (!selected) return null;
                      const conversation = engagementInbox.filter(
                        (item) =>
                          item.accountId === selected.accountId &&
                          (item.senderId === selected.senderId ||
                            item.parentEventId === selected.eventId),
                      );
                      const account = engagementAccounts.find(
                        (entry) => entry.id === selected.accountId,
                      );
                      const displayName =
                        selected.senderName ||
                        selected.senderUsername ||
                        "کاربر اینستاگرام";
                      const profileUsername = (selected.senderUsername || "").replace(/^@/, "").trim();
                      return (
                        <aside className="inbox-conversation">
                          <header>
                            <button
                              aria-label="بستن مکالمه"
                              onClick={() => setSelectedInboxEventId("")}
                              type="button"
                            >
                              ×
                            </button>
                            <span className="inbox-avatar">
                              {selected.senderProfilePhoto ? (
                                <img src={selected.senderProfilePhoto} alt="" />
                              ) : (
                                displayName.slice(0, 1)
                              )}
                            </span>
                            <div>
                              {profileUsername ? <a className="instagram-profile-link" href={`https://www.instagram.com/${encodeURIComponent(profileUsername)}/`} rel="noreferrer" target="_blank">{displayName}</a> : <b>{displayName}</b>}
                              <small>
                                {selected.senderUsername
                                  ? `@${selected.senderUsername.replace(/^@/, "")}`
                                  : "کاربر اینستاگرام"}{" "}
                                ·{" "}
                                {account?.username
                                  ? `پیام به @${account.username.replace(/^@/, "")}`
                                  : ""}
                              </small>
                            </div>
                            <button
                              className="link-button"
                              disabled={engagementReplyBusy}
                              onClick={() => void resolveEngagementProfile()}
                              type="button"
                            >
                              دریافت نام
                            </button>
                          </header>
                          <div className="chat-history">
                            {conversation
                              .sort((a, b) => a.receivedAt - b.receivedAt)
                              .map((item) => (
                                <article
                                  className={
                                    item.direction === "outgoing"
                                      ? "outgoing"
                                      : "incoming"
                                  }
                                  key={item.eventId}
                                >
                                  <EngagementMessageMedia item={item} />
                                  <p>{engagementMessageSummary(item)}</p>
                                  <time>
                                    {formatEngagementTime(item.receivedAt)}
                                  </time>
                                </article>
                              ))}
                          </div>
                          <div className="reply-composer">
                            <textarea
                              disabled={engagementReplyBusy}
                              onChange={(event) =>
                                setEngagementReplyText(event.target.value)
                              }
                              placeholder="پاسخ دستی به مخاطب…"
                              rows={3}
                              value={engagementReplyText}
                            />
                            <button
                              className="primary"
                              disabled={
                                engagementReplyBusy ||
                                !engagementReplyText.trim()
                              }
                              onClick={() => void replyToEngagementMessage()}
                              type="button"
                            >
                              {engagementReplyBusy
                                ? "در حال ارسال…"
                                : "ارسال پاسخ"}
                            </button>
                          </div>
                        </aside>
                      );
                    })()}
                </>
              )}
            </div>
          </section>
        )}
        {engagementView === "rules" && (
          <section className="engagement-panel engagement-rules-page">
            <div className="section-heading">
              <div>
                <h3>قواعد پاسخ‌گویی</h3>
                <p className="hint">
                  هر قانون فقط پس از فعال‌سازی اجرا می‌شود؛ پیش‌فرض پاسخ‌ها
                  تأیید دستی است.
                </p>
              </div>
              <button
                className="primary"
                onClick={() => void createStarterEngagementRule()}
                type="button"
              >
                قانون جدید
              </button>
            </div>
            <details className="engagement-persona-editor">
              <summary>تنظیم شخصیت پاسخ‌دهنده‌ها</summary>
              <small>شخصیت فقط لحن پاسخ را تغییر می‌دهد؛ به مخاطب وعده، اطلاعات تأییدنشده یا هویت انسانیِ واقعی نسبت نمی‌دهد.</small>
              {engagementPersonas.map((persona, index) => <fieldset key={persona.characterId}><legend>{persona.characterId === "kamran" ? "کامران" : "تارا"}</legend><label>نام نمایشی<input value={persona.name} maxLength={80} onChange={(event) => setEngagementPersonas((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} /></label><label>دستور شخصیت<textarea value={persona.instruction} maxLength={6000} rows={5} onChange={(event) => setEngagementPersonas((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, instruction: event.target.value } : item))} /></label></fieldset>)}
              <button className="secondary" disabled={engagementKnowledgeBusy} onClick={() => void saveEngagementPersonas()} type="button">ذخیرهٔ شخصیت‌ها</button>
            </details>
            {editingEngagementRule && (
              <div className="rule-editor">
                <label>
                  نام قانون
                  <input
                    value={editingEngagementRule.name}
                    onChange={(event) =>
                      setEditingEngagementRule({
                        ...editingEngagementRule,
                        name: event.target.value,
                      })
                    }
                  />
                </label>
                {editingEngagementRule.scope?.kind === "story" && (() => {
                  const scopedStory = engagementInbox.find((item) => item.accountId === editingEngagementRule.scope?.accountId && item.mediaId === editingEngagementRule.scope?.mediaId && (item.mediaType ?? "").toLowerCase() === "story_reply");
                  const scopedAccount = engagementAccounts.find((item) => item.id === editingEngagementRule.scope?.accountId);
                  return <section className="rule-story-context"><b>شرط پاسخ برای همین استوری</b>{scopedStory ? <><EngagementMessageMedia item={scopedStory} /><small>{scopedAccount?.username ? `@${scopedAccount.username.replace(/^@/, "")}` : scopedStory.accountId} · {formatEngagementTime(scopedStory.storyPublishedAt || scopedStory.receivedAt)}</small></> : <small>رسانهٔ استوری در حافظهٔ فعلی موجود نیست؛ با این حال حساب و شناسهٔ استوری به‌صورت قفل‌شده روی قانون ثبت می‌شود.</small>}<code dir="ltr">{editingEngagementRule.scope.accountId} / {editingEngagementRule.scope.mediaId}</code></section>;
                })()}
                <fieldset>
                  <legend>دامنهٔ حساب‌ها</legend>
                  <div className="rule-account-options">
                    {engagementAccounts.length === 0 ? (
                      <small>
                        پس از اتصال حساب، این بخش فعال می‌شود. خالی‌بودن یعنی
                        همهٔ حساب‌ها.
                      </small>
                    ) : (
                      engagementAccounts.map((account) => (
                        <label key={account.id}>
                          <input
                            disabled={editingEngagementRule.scope?.kind === "story"}
                            checked={editingEngagementRule.accountIds.includes(
                              account.id,
                            )}
                            onChange={() =>
                              setEditingEngagementRule({
                                ...editingEngagementRule,
                                accountIds:
                                  editingEngagementRule.accountIds.includes(
                                    account.id,
                                  )
                                    ? editingEngagementRule.accountIds.filter(
                                        (id) => id !== account.id,
                                      )
                                    : [
                                        ...editingEngagementRule.accountIds,
                                        account.id,
                                      ],
                              })
                            }
                            type="checkbox"
                          />
                          {account.username
                            ? `@${account.username.replace(/^@/, "")}`
                            : account.id}
                        </label>
                      ))
                    )}
                  </div>
                </fieldset>
                <label>
                  رویداد
                  <select
                    disabled={editingEngagementRule.scope?.kind === "story"}
                    multiple
                    value={editingEngagementRule.eventTypes}
                    onChange={(event) =>
                      setEditingEngagementRule({
                        ...editingEngagementRule,
                        eventTypes: Array.from(
                          event.target.selectedOptions,
                        ).map((item) => item.value),
                      })
                    }
                  >
                    <option value="messaging">پیام مستقیم</option>
                    <option value="comment">کامنت</option>
                    <option value="story_reply">پاسخ استوری</option>
                  </select>
                </label>
                <label>
                  شرط متن
                  <select
                    value={editingEngagementRule.match.mode}
                    onChange={(event) =>
                      setEditingEngagementRule({
                        ...editingEngagementRule,
                        match: {
                          ...editingEngagementRule.match,
                          mode: event.target.value,
                        },
                      })
                    }
                  >
                    <option value="contains">شامل این عبارت باشد</option>
                    <option value="equals">دقیقاً برابر باشد</option>
                    <option value="starts_with">با این عبارت شروع شود</option>
                    <option value="not_contains">شامل این عبارت نباشد</option>
                  </select>
                  <RuleTermsInput
                    terms={
                      editingEngagementRule.match.terms?.length
                        ? editingEngagementRule.match.terms
                        : editingEngagementRule.match.text
                            .split(/\r?\n/)
                            .map((item) => item.trim())
                            .filter(Boolean)
                    }
                    onChange={(terms) =>
                      setEditingEngagementRule({
                        ...editingEngagementRule,
                        match: {
                          ...editingEngagementRule.match,
                          terms,
                          text: terms.join("\n"),
                        },
                      })
                    }
                  />
                  <small className="hint">هر عبارت با Enter جدا ذخیره می‌شود؛ برای «شامل باشد» یکی از عبارت‌ها و برای «نباشد» هیچ‌کدام نباید در پیام باشد.</small>
                </label>
                <section className="rule-action-sequence">
                  {(editingEngagementRule.actions?.length ? editingEngagementRule.actions : [editingEngagementRule.action]).map((action, actionIndex) => {
                    const actions = editingEngagementRule.actions?.length ? editingEngagementRule.actions : [editingEngagementRule.action];
                    const updateAction = (patch: Partial<typeof action>) => {
                      const next = actions.map((entry, index) => index === actionIndex ? { ...entry, ...patch } : entry);
                      setEditingEngagementRule({ ...editingEngagementRule, action: next[0], actions: next });
                    };
                    return <fieldset className="rule-action-card" key={actionIndex}>
                      <legend>پیام / اقدام {toPersianDigits(String(actionIndex + 1))}</legend>
                      <label>نوع اقدام<select value={action.mode} onChange={(event) => updateAction({ mode: event.target.value })}>
                        <option value="auto_reply">پاسخ خودکار ثابت</option>
                        <option value="ai_auto_reply">چت خودکار با AI</option>
                        <option value="conversation_tag">افزودن یا حذف برچسب</option>
                        <option value="tag_admin">ارجاع و اعلان به ادمین</option>
                        <option value="showcase">ارسال ویترین</option>
                      </select></label>
                      {action.mode === "showcase" && <label>انتخاب ویترین<select value={action.showcaseCards?.[0]?.cardId ?? ""} onChange={(event) => { const selected = engagementShowcases.find((item) => item.cards[0]?.cardId === event.target.value); updateAction({ showcaseCards: selected?.cards ?? [] }); }}><option value="">انتخاب کنید</option>{engagementShowcases.map((item) => <option key={item.showcaseId} value={item.cards[0]?.cardId}>{item.name} · {item.cards.length} کارت</option>)}</select></label>}
                      {action.mode === "ai_auto_reply" && <label>شخصیت پاسخ<select value={action.character ?? "none"} onChange={(event) => updateAction({ character: event.target.value as "none" | "random" | "kamran" | "tara" })}>
                        <option value="none">هیچ‌کدام؛ لحن رسانه</option><option value="random">تصادفی بین کامران و تارا</option><option value="kamran">کامران</option><option value="tara">تارا</option>
                      </select></label>}
                      {action.mode === "conversation_tag" && <section className="rule-tag-action"><label>برچسب مشترک<select value={action.tagName ?? ""} onChange={(event) => updateAction({ tagName: event.target.value })}><option value="">انتخاب برچسب</option>{engagementTags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}</select></label><label>عملیات<select value={action.tagOperation ?? "add"} onChange={(event) => updateAction({ tagOperation: event.target.value as "add" | "remove" })}><option value="add">افزودن به گفتگو</option><option value="remove">حذف از گفتگو</option></select></label><small className="hint">برچسب فقط از فهرست مشترک انتخاب می‌شود و بدون ارسال پیام روی همهٔ پیام‌های همین مخاطب در همین پیج اعمال می‌شود.</small></section>}
                      {action.mode !== "showcase" && action.mode !== "conversation_tag" && <label>{action.mode === "ai_auto_reply" ? "دستور اختصاصی برای AI" : "متن پاسخ"}<textarea value={action.text} onChange={(event) => updateAction({ text: event.target.value })} placeholder="متن پاسخ یا دستور پاسخ" rows={4} />{action.mode === "auto_reply" && (() => { const bytes = utf8ByteLength(action.text ?? ""); const over = bytes > 1000; return <small className={over ? "error" : "hint"}>سقف پیام دایرکت اینستاگرام: {toPersianDigits(String(bytes))} از ۱٬۰۰۰ بایت UTF-8 {over ? "— متن را کوتاه کنید یا با «افزودن پاسخ / اقدام دیگر» به چند پیام جدا تقسیم کنید." : "— برای متن بلند، پیام بعدی را به‌عنوان اقدام جدا اضافه کنید."}</small>; })()}</label>}
                      {action.mode === "showcase" && <section className="rule-showcase-preview"><div className="rule-showcase-preview-heading"><b>محتوای ویترین انتخاب‌شده</b>{(() => { const selected = engagementShowcases.find((item) => item.cards.length === (action.showcaseCards?.length ?? 0) && item.cards[0]?.cardId === action.showcaseCards?.[0]?.cardId); return selected ? <button className="link-button" onClick={() => { setEditingShowcase(selected); setEngagementView("settings"); }} type="button">ویرایش ویترین</button> : null; })()}</div>{(action.showcaseCards ?? []).map((card) => <article key={card.cardId}><img src={card.image?.url} alt="" /><div><b>{card.title}</b><small>{card.subtitle}</small><span>{(card.buttons ?? []).map((button) => button.title).filter(Boolean).join(" · ") || "بدون دکمه"}</span></div></article>)}{!(action.showcaseCards?.length) && <small className="hint">ابتدا یک ویترین انتخاب کنید.</small>}</section>}
                      {action.mode === "ai_auto_reply" && <label>ادامهٔ مکالمه تا چند پیام<input inputMode="numeric" min={1} max={50} onChange={(event) => updateAction({ conversationMaxMessages: Math.min(50, Math.max(1, Number(event.target.value) || 1)) })} value={action.conversationMaxMessages ?? 5} /><small>AI این تعداد پیامِ مخاطب را (با احتساب پیام فعال‌کننده) پاسخ می‌دهد و در همهٔ نوبت‌ها از تاریخچهٔ همین گفت‌وگو و پیج فعلی استفاده می‌کند.</small></label>}
                      {action.mode !== "showcase" && action.mode !== "conversation_tag" && <details className="rule-buttons-editor">
                        <summary>دکمه‌های پیام (اختیاری)</summary><small>حداکثر ۳ دکمه؛ لینک یا مقدار بازگشتی BoxAPI.</small>
                        {[0, 1, 2].map((index) => {
                          const button = action.buttons?.[index] ?? { type: "postback" as const, title: "", payload: "" };
                          const updateButton = (patch: Partial<typeof button>) => {
                            const next = [...(action.buttons ?? [])]; next[index] = { ...button, ...patch };
                            while (next.length && !next[next.length - 1]?.title?.trim()) next.pop(); updateAction({ buttons: next });
                          };
                          return <div className="rule-button-row" key={index}><select aria-label={`نوع دکمه ${index + 1}`} value={button.type ?? "postback"} onChange={(event) => updateButton({ type: event.target.value as "postback" | "web_url" })}><option value="postback">انتخابی</option><option value="web_url">لینک</option></select><input aria-label={`عنوان دکمه ${index + 1}`} value={button.title} onChange={(event) => updateButton({ title: event.target.value })} placeholder={`عنوان دکمه ${index + 1}`} />{button.type === "web_url" ? <input aria-label={`لینک دکمه ${index + 1}`} value={button.url ?? ""} onChange={(event) => updateButton({ url: event.target.value, payload: undefined })} placeholder="https://…" /> : <input aria-label={`مقدار دکمه ${index + 1}`} value={button.payload ?? ""} onChange={(event) => updateButton({ payload: event.target.value, url: undefined })} placeholder="مقدار بازگشتی" />}</div>;
                        })}
                      </details>}
                      {action.mode !== "conversation_tag" && <label className="rule-attachment-picker">فایل همراه (تصویر، ویدئو، ویس یا PDF)<input accept="image/jpeg,image/png,image/webp,video/mp4,video/ogg,video/quicktime,video/webm,audio/mp4,audio/x-m4a,audio/wav,application/pdf" multiple disabled={engagementBusy} onChange={(event) => { const files = Array.from(event.target.files ?? []); event.currentTarget.value = ""; void addEngagementRuleAttachments(actionIndex, files); }} type="file" /><small>فایل را انتخاب کنید، نوار پیشرفت تا ذخیرهٔ امن کامل می‌شود؛ سپس حتماً «ذخیرهٔ قانون» را بزنید تا به این اقدام متصل شود.</small></label>}
                      {ruleAttachmentUploads.length > 0 && <div className="rule-attachment-uploads"><UploadQueueRows items={ruleAttachmentUploads} /></div>}
                      {(action.attachments ?? []).length > 0 && <div className="rule-attachment-list">{action.attachments?.map((attachment) => <article key={attachment.attachmentId}>{attachment.kind === "image" && attachment.url ? <img src={attachment.url} alt={attachment.filename} /> : <span aria-hidden="true">{attachment.kind === "video" ? "🎬" : attachment.kind === "audio" ? "🎙" : "📎"}</span>}<div><b>{attachment.filename}</b><small>{attachment.mimeType}</small></div><button aria-label={`حذف ${attachment.filename}`} onClick={() => updateAction({ attachments: (action.attachments ?? []).filter((item) => item.attachmentId !== attachment.attachmentId) })} type="button">×</button></article>)}</div>}
                      {actions.length > 1 && <button className="danger-link" onClick={() => { const next = actions.filter((_, index) => index !== actionIndex); setEditingEngagementRule({ ...editingEngagementRule, action: next[0], actions: next }); }} type="button">حذف این اقدام</button>}
                    </fieldset>;
                  })}
                  <button className="secondary" onClick={() => { const actions = editingEngagementRule.actions?.length ? editingEngagementRule.actions : [editingEngagementRule.action]; const next = [...actions, { mode: "auto_reply", text: "", character: "none" as const }]; setEditingEngagementRule({ ...editingEngagementRule, action: next[0], actions: next }); }} type="button">+ افزودن پاسخ / اقدام دیگر</button>
                </section>
                <div className="rule-inline">
                  <label>
                    اولویت
                    <input
                      inputMode="numeric"
                      value={editingEngagementRule.priority}
                      onChange={(event) =>
                        setEditingEngagementRule({
                          ...editingEngagementRule,
                          priority: Number(event.target.value) || 100,
                        })
                      }
                    />
                  </label>
                  <label>
                    فاصلهٔ تکرار برای همان مخاطب (ثانیه)
                    <input
                      inputMode="numeric"
                      min={0}
                      max={86400}
                      value={editingEngagementRule.cooldownSeconds ?? ((editingEngagementRule.cooldownMinutes ?? 0) * 60)}
                      onChange={(event) =>
                        setEditingEngagementRule({
                          ...editingEngagementRule,
                          cooldownSeconds: Math.min(86400, Math.max(0, Number(event.target.value) || 0)),
                          cooldownMinutes: undefined,
                        })
                      }
                    />
                    <small>۰ یعنی هر پیام منطبق پاسخ می‌گیرد. برای جلوگیری از پاسخ تکراری ناشی از ارسال سریع یا وب‌هوک تکراری، ۳ تا ۵ ثانیه کافی است.</small>
                  </label>
                  <label className="switch-label">
                    <input
                      checked={editingEngagementRule.enabled}
                      onChange={(event) =>
                        setEditingEngagementRule({
                          ...editingEngagementRule,
                          enabled: event.target.checked,
                        })
                      }
                      type="checkbox"
                    />
                    فعال
                  </label>
                </div>
                <div className="choices">
                  <button
                    className="primary"
                    onClick={() => void saveEngagementRule()}
                    type="button"
                  >
                    ذخیرهٔ قانون
                  </button>
                  <button
                    className="secondary"
                    onClick={() => setEditingEngagementRule(undefined)}
                    type="button"
                  >
                    لغو
                  </button>
                </div>
              </div>
            )}
            <div className="engagement-rule-list">
              {engagementRules.length === 0 ? (
                <p className="hint">هنوز قانونی ساخته نشده است.</p>
              ) : (
                engagementRules.map((rule) => {
                  const scopedMedia = rule.scope
                    ? engagementInbox.find(
                        (item) =>
                          item.accountId === rule.scope?.accountId &&
                          item.mediaId === rule.scope?.mediaId,
                      )
                    : undefined;
                  return <article key={rule.ruleId}>
                    {scopedMedia?.mediaThumbnail && (
                      <img className="engagement-rule-thumbnail" loading="lazy" src={scopedMedia.mediaThumbnail} alt="رسانهٔ شرط" />
                    )}
                    <b>{rule.name}</b>
                    <small>
                      {rule.enabled ? "فعال" : "پیش‌نویس"} ·{" "}
                      {rule.eventTypes.join("، ") || "همهٔ رویدادها"} ·{" "}
                      {rule.action.mode === "approval"
                        ? "نیازمند تأیید"
                        : rule.action.mode}
                    </small>
                    <div>
                      <button
                        className="link-button"
                        onClick={() => setEditingEngagementRule(rule)}
                        type="button"
                      >
                        ویرایش
                      </button>
                      <button
                        className="link-button"
                        onClick={() =>
                          void manageEngagementRules(
                            telegram?.initData,
                            "delete",
                            undefined,
                            rule.ruleId,
                          ).then(
                            (result) =>
                              result && setEngagementRules(result.rules),
                          )
                        }
                        type="button"
                      >
                        حذف
                      </button>
                    </div>
                  </article>;
                })
              )}
            </div>
          </section>
        )}
        {engagementView === "settings" && (
          <section className="engagement-panel engagement-settings-page">
            {accessState !== "owner" ? (
              <p className="error">
                تنظیمات اتصال فقط برای مدیر اصلی در دسترس است.
              </p>
            ) : (
              <>
                <section className="engagement-showcases">
                  <div className="section-heading"><div><h3>کارت‌های ویترین</h3><p className="hint">ویترین از ۱ تا ۱۰ کارتِ قابل‌ورق تشکیل می‌شود؛ هر کارت تصویر، متن و دکمه‌های مستقل دارد.</p></div><button className="primary" onClick={() => setEditingShowcase({ showcaseId: crypto.randomUUID(), name: "ویترین جدید", cards: [{ cardId: crypto.randomUUID(), title: "", subtitle: "", image: {} as EngagementShowcaseCard["image"], buttons: [] }] })} type="button">+ ویترین جدید</button></div>
                  {editingShowcase && <div className="showcase-editor"><label>نام ویترین<input value={editingShowcase.name} onChange={(event) => setEditingShowcase({ ...editingShowcase, name: event.target.value })} /></label>{editingShowcase.cards.map((card, cardIndex) => <fieldset key={card.cardId}><legend>کارت {toPersianDigits(String(cardIndex + 1))}</legend><label>عنوان کارت<input value={card.title} maxLength={80} onChange={(event) => setEditingShowcase({ ...editingShowcase, cards: editingShowcase.cards.map((item, index) => index === cardIndex ? { ...item, title: event.target.value } : item) })} /></label><label>توضیح کوتاه<textarea rows={2} value={card.subtitle} maxLength={500} onChange={(event) => setEditingShowcase({ ...editingShowcase, cards: editingShowcase.cards.map((item, index) => index === cardIndex ? { ...item, subtitle: event.target.value } : item) })} /></label><label className="rule-attachment-picker">تصویر کارت<input accept="image/jpeg,image/png" disabled={engagementBusy} onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = ""; if (file) void uploadShowcaseCardImage(cardIndex, file); }} type="file" /></label>{card.image?.url && <img className="showcase-card-image" src={card.image.url} alt={card.title || "تصویر کارت"} />}{editingShowcase.cards.length > 1 && <button className="danger-link" onClick={() => setEditingShowcase({ ...editingShowcase, cards: editingShowcase.cards.filter((_, index) => index !== cardIndex) })} type="button">حذف کارت</button>}</fieldset>)}<div className="choices"><button className="secondary" disabled={editingShowcase.cards.length >= 10} onClick={() => setEditingShowcase({ ...editingShowcase, cards: [...editingShowcase.cards, { cardId: crypto.randomUUID(), title: "", subtitle: "", image: {} as EngagementShowcaseCard["image"], buttons: [] }] })} type="button">+ افزودن کارت</button><button className="primary" disabled={engagementBusy} onClick={() => void saveShowcaseEditor()} type="button">ذخیرهٔ ویترین</button><button className="secondary" onClick={() => setEditingShowcase(undefined)} type="button">انصراف</button></div></div>}
                  <div className="connection-list">{engagementShowcases.length === 0 ? <p className="hint">هنوز ویترینی ذخیره نشده است.</p> : engagementShowcases.map((showcase) => <article key={showcase.showcaseId}><button onClick={() => setEditingShowcase(showcase)} type="button"><b>{showcase.name}</b><small>{toPersianDigits(String(showcase.cards.length))} کارت</small></button><button className="link-button" onClick={() => void manageEngagementShowcases(telegram?.initData, "delete", showcase).then((result) => result?.showcases && setEngagementShowcases(result.showcases))} type="button">حذف</button></article>)}</div>
                </section>
                {editingShowcase && <section className="showcase-buttons-workbench"><h3>دکمه‌های کارت‌های ویترین</h3><p className="hint">برای هر کارت حداکثر سه دکمهٔ مستقل تعریف کنید؛ تغییرات همراه با ذخیرهٔ ویترین ثبت می‌شوند.</p>{editingShowcase.cards.map((card, index) => <article key={card.cardId}><b>کارت {toPersianDigits(String(index + 1))}: {card.title || "بدون عنوان"}</b><ShowcaseButtonsEditor card={card} onChange={(buttons) => setEditingShowcase({ ...editingShowcase, cards: editingShowcase.cards.map((item, itemIndex) => itemIndex === index ? { ...item, buttons } : item) })} /></article>)}</section>}
                <h3>اتصال‌های BoxAPI</h3>
                <p className="hint">
                  برای هر اشتراک تک‌حسابی یک اتصال بسازید. کلید API پس از ذخیره
                  پنهان می‌شود و فقط هنگام درخواست سرور استفاده خواهد شد.
                </p>
                <div className="connection-form">
                  <label>
                    نام اتصال
                    <input
                      value={connectionName}
                      onChange={(event) =>
                        setConnectionName(event.target.value)
                      }
                      placeholder="مثلاً BoxAPI کلام تازه"
                    />
                  </label>
                  <label>
                    کلید API
                    <input
                      dir="ltr"
                      type="password"
                      value={connectionApiKey}
                      onChange={(event) =>
                        setConnectionApiKey(event.target.value)
                      }
                      placeholder="کلید فقط یک‌بار ثبت می‌شود"
                      autoComplete="new-password"
                    />
                  </label>
                  <label>
                    آدرس API
                    <input
                      dir="ltr"
                      value={connectionBaseUrl}
                      onChange={(event) =>
                        setConnectionBaseUrl(event.target.value)
                      }
                    />
                  </label>
                  <button
                    className="primary"
                    disabled={
                      engagementBusy ||
                      !connectionName.trim() ||
                      connectionApiKey.length < 12
                    }
                    onClick={() => void saveEngagementConnection()}
                    type="button"
                  >
                    افزودن اتصال امن
                  </button>
                </div>
                <div className="connection-list">
                  {engagementConnections.map((connection) => (
                    <article
                      className={
                        selectedEngagementConnection === connection.connectionId
                          ? "selected"
                          : ""
                      }
                      key={connection.connectionId}
                    >
                      <button
                        onClick={() =>
                          setSelectedEngagementConnection(
                            connection.connectionId,
                          )
                        }
                        type="button"
                      >
                        <b>{connection.name}</b>
                        <small>
                          {connection.hasApiKey ? "کلید ثبت شده" : "بدون کلید"}{" "}
                          · {connection.baseUrl}
                        </small>
                      </button>
                      <button
                        className="link-button"
                        onClick={() =>
                          void deleteEngagementConnection(
                            connection.connectionId,
                          )
                        }
                        type="button"
                      >
                        حذف
                      </button>
                    </article>
                  ))}
                </div>
                {selectedEngagementConnection && (
                  <section className="connected-account-management">
                    <h3>حساب‌های زیرمجموعهٔ اتصال انتخاب‌شده</h3>
                    <div className="choices">
                      <button
                        className="primary"
                        disabled={engagementBusy}
                        onClick={() => void openBoxConnect()}
                        type="button"
                      >
                        اتصال حساب اینستاگرام
                      </button>
                      <button
                        className="secondary"
                        disabled={engagementBusy}
                        onClick={() => void refreshEngagement(true)}
                        type="button"
                      >
                        دریافت فهرست حساب‌ها
                      </button>
                    </div>
                    <div className="engagement-account-list">
                      {engagementAccounts.filter((account) =>
                        account.id.startsWith(
                          `${selectedEngagementConnection}:`,
                        ),
                      ).length === 0 ? (
                        <p className="hint">
                          پس از تکمیل OAuth، «دریافت فهرست حساب‌ها» را بزنید.
                        </p>
                      ) : (
                        engagementAccounts
                          .filter((account) =>
                            account.id.startsWith(
                              `${selectedEngagementConnection}:`,
                            ),
                          )
                          .map((account) => (
                            <label key={account.id}>
                              <span>
                                {account.username
                                  ? `@${account.username.replace(/^@/, "")}`
                                  : account.id}
                              </span>
                              <small>
                                {account.active ? "فعال" : "غیرفعال"}
                              </small>
                            </label>
                          ))
                      )}
                    </div>
                  </section>
                )}
                <section className="connected-account-management">
                  <h3>اتصال فروش تازه‌سیستم</h3>
                  <p className="hint">نشانی API داخلی، ثابت و پنهان است. فقط توکنی را وارد کنید که برای tenant کلام‌اپ ساخته شده باشد؛ پس از ذخیره نمایش داده نمی‌شود و لیدهای اینستاگرام با وضعیت «جدید» ثبت خواهند شد.</p>
                  <div className="connection-form">
                    <label>توکن API tenant کلام‌اپ<input dir="ltr" type="password" value={salesApiToken} onChange={(event) => setSalesApiToken(event.target.value)} placeholder={salesIntegration.configured ? "برای تغییر توکن وارد کنید" : "توکن فقط یک‌بار ثبت می‌شود"} autoComplete="new-password" /></label>
                    <button className="primary" disabled={engagementBusy || (!salesIntegration.configured && salesApiToken.length < 20)} onClick={() => void saveSalesIntegration()} type="button">ذخیرهٔ اتصال فروش</button>
                    <button className="secondary" disabled={engagementBusy || !salesIntegration.configured} onClick={() => void saveSalesIntegration(true)} type="button">آزمون اتصال</button>
                  </div>
                  <small>{salesIntegration.tested ? `اتصال تأیید شد؛ ${salesIntegration.fieldCount ?? 0} فیلد و ${salesIntegration.personaCount ?? 0} پرسونا در دسترس است.` : salesIntegration.configured ? "اتصال امن ذخیره شده است؛ برای تأیید، آزمون اتصال را بزنید." : "هنوز اتصال فروش ثبت نشده است."}</small>
                </section>
              </>
            )}
          </section>
        )}
        <footer className="engagement-footer">
          <nav>
            <button
              className={engagementView === "inbox" ? "active" : ""}
              onClick={() => setEngagementView("inbox")}
              type="button"
            >
              <span>▣</span>صندوق ورودی
            </button>
            <button
              className={engagementView === "comments" ? "active" : ""}
              onClick={() => setEngagementView("comments")}
              type="button"
            >
              <span>💬</span>کامنت‌ها
            </button>
            <button
              className={engagementView === "rules" ? "active" : ""}
              onClick={() => setEngagementView("rules")}
              type="button"
            >
              <span>⚡</span>قوانین
            </button>
            {accessState === "owner" && (
              <button
                className={engagementView === "settings" ? "active" : ""}
                onClick={() => setEngagementView("settings")}
                type="button"
              >
                <span>⚙</span>تنظیمات
              </button>
            )}
          </nav>
          <button
            className="engagement-back"
            onClick={() => setActiveTab("create")}
            type="button"
          >
            <span>✦</span>استودیو
          </button>
        </footer>
      </section>

      <section
        className={`card ${activeTab === "settings" ? "" : "tab-hidden"}`}
      >
        {accessState === "owner" && <VideoAssetManager telegramInitData={telegram?.initData} />}
        <h2>۵. تنظیمات دسترسی</h2>
        <p className="hint">
          مدیر اصلی: <span dir="ltr">605598559</span>. ورودِ افراد جدید به‌صورت
          درخواست ثبت و برای مدیر اصلی در تلگرام اعلان می‌شود.
        </p>
        {accessState === "pending" && (
          <p className="error">
            درخواست دسترسی شما ثبت شده و در انتظار تأیید مدیر است.
          </p>
        )}
        {accessState === "revoked" || accessState === "rejected" ? (
          <p className="error">دسترسی این حساب فعال نیست.</p>
        ) : null}
        {["owner", "active"].includes(accessState) && (
          <>
            {accessState === "owner" && <>
              <label>
                افزودن مستقیم Chat ID
                <input
                  dir="ltr"
                  inputMode="numeric"
                  value={chatIdToAdd}
                  onChange={(event) => setChatIdToAdd(event.target.value)}
                  placeholder="مثلاً 605598559"
                />
              </label>
              <button
                className="primary"
                disabled={!/^\d{5,20}$/.test(chatIdToAdd)}
                onClick={() => refreshAccess("add", chatIdToAdd)}
                type="button"
              >
                افزودن دسترسی
              </button>
            </>}
            {accessState === "active" && <p className="hint">فهرست کاربران برای ادمین فعال قابل مشاهده است؛ تغییر دسترسی‌ها فقط با مدیر اصلی انجام می‌شود.</p>}
            <div className="access-list">
              {accessView.users.map((user) => (
                <div className="access-row" key={user.chatId}>
                  <span dir="ltr">{user.chatId}</span>
                  <b>
                    {user.status === "owner"
                      ? "مدیر اصلی"
                      : user.status === "active"
                        ? "فعال"
                        : user.status === "pending"
                          ? "در انتظار"
                          : "غیرفعال"}
                  </b>
                  {accessState === "owner" && <label>شمارهٔ کاری<input dir="ltr" defaultValue={user.workPhone ?? ""} inputMode="tel" onBlur={(event) => { if (event.currentTarget.value !== (user.workPhone ?? "")) void refreshAccess("set_contact", user.chatId, event.currentTarget.value); }} placeholder="09xxxxxxxxx" /></label>}
                  {accessState === "owner" && user.status !== "owner" && (
                    <div className="access-actions">
                      {user.status === "pending" && (
                        <>
                          <button
                            onClick={() =>
                              refreshAccess("approve", user.chatId)
                            }
                            type="button"
                          >
                            تأیید
                          </button>
                          <button
                            onClick={() => refreshAccess("reject", user.chatId)}
                            type="button"
                          >
                            رد
                          </button>
                        </>
                      )}{" "}
                      {user.status === "active" && (
                        <button
                          onClick={() => refreshAccess("revoke", user.chatId)}
                          type="button"
                        >
                          مسدودسازی
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <section
        className={`card ${activeTab === "settings" ? "" : "tab-hidden"}`}
      >
        <h2>۶. حساب ورود با نام کاربری</h2>
        <p className="hint">
          ورود با موبایل از شمارهٔ کاریِ ثبت‌شده در فهرست دسترسی‌ها استفاده می‌کند.
          این بخش فقط برای ساخت یا تغییر ورود جایگزین با نام کاربری و رمز عبور است.
        </p>
        {accessState === "owner" && (
          <>
            <label>
              Chat ID ادمین
              <input
                dir="ltr"
                inputMode="numeric"
                value={webAccountChatId}
                onChange={(event) => setWebAccountChatId(event.target.value)}
                required
              />
            </label>
            <label>
              نام کاربری وب
              <input
                dir="ltr"
                autoComplete="off"
                value={webAccountUsername}
                onChange={(event) =>
                  setWebAccountUsername(event.target.value.toLowerCase())
                }
                placeholder="مثلاً editor.golbahar"
                required
              />
            </label>
            <label>
              رمز اولیه (حداقل ۸ کاراکتر)
              <div className="password-input">
                <input
                  dir="ltr"
                  autoComplete="new-password"
                  type={showWebAccountPassword ? "text" : "password"}
                  value={webAccountPassword}
                  onChange={(event) =>
                    setWebAccountPassword(event.target.value)
                  }
                  required
                />
                <button
                  aria-label={
                    showWebAccountPassword ? "مخفی‌کردن رمز" : "نمایش رمز"
                  }
                  onClick={() =>
                    setShowWebAccountPassword((current) => !current)
                  }
                  type="button"
                >
                  {showWebAccountPassword ? "🙈" : "👁"}
                </button>
              </div>
            </label>
            <button
              className="primary"
              disabled={
                !/^\d{5,20}$/.test(webAccountChatId) ||
                !/^[a-z0-9][a-z0-9._-]{2,31}$/.test(webAccountUsername) ||
                webAccountPassword.length < 8
              }
              onClick={() => void provisionWebAccount()}
              type="button"
            >
              فعال‌سازی حساب نام کاربری
            </button>
            <div className="access-list web-account-list">
              {accessView.users
                .filter((user) => user.webEnabled)
                .map((user) => (
                  <div className="access-row" key={`web-${user.chatId}`}>
                    <span dir="ltr">{user.webUsername}</span>
                    <small>متصل به {user.chatId}</small>
                    <button
                      onClick={() => void disableWebAccount(user.chatId)}
                      type="button"
                    >
                      غیرفعال‌سازی ورود وب
                    </button>
                  </div>
                ))}
            </div>
          </>
        )}
      </section>

      <section
        className={`card ${activeTab === "settings" ? "" : "tab-hidden"}`}
      >
        <h2>۷. موتور تصویرساز</h2>
        <p className="hint">این انتخاب، پیش‌فرض درخواست‌های بعدی است. در فرم ساخت تصویر هر کاربر می‌تواند فقط برای همان درخواست موتور و کیفیت را تغییر دهد.</p>
        {accessState === "owner" && imageModelSettings && (
          <label>
            مدل پیش‌فرض
            <select
              disabled={imageModelSaving}
              value={imageModelSettings.defaultModel}
              onChange={(event) => void saveImageModel(event.target.value)}
            >
              {imageModelSettings.models.map((model) => (
                <option key={model.id} value={model.id}>{model.label}</option>
              ))}
            </select>
          </label>
        )}
      </section>

      <section
        className={`card ${activeTab === "settings" ? "" : "tab-hidden"}`}
      >
        <h2>۸. موتورهای متنی</h2>
        <p className="hint">مدل ویرایش خبر، پاسخ‌گویی و ساخت پرامپت ویدیو مستقل‌اند. GPT-6 Luna اقتصادی و سریع، GPT-6.1 Terra متعادل و GPT-6 Astra توانمندترین گزینه است.</p>
        {accessState === "owner" && textModelSettings && (
          <div className="form-grid">
            <label>
              موتور ویرایش خبر
              <select
                disabled={textModelSaving}
                value={textModelSettings.editorialModel}
                onChange={(event) => void saveTextModels(event.target.value, textModelSettings.replyModel, textModelSettings.analysisModel)}
              >
                {textModelSettings.models.map((model) => (
                  <option key={model.id} value={model.id}>{model.label}</option>
                ))}
              </select>
            </label>
            <label>
              موتور پاسخ‌گویی خودکار
              <select
                disabled={textModelSaving}
                value={textModelSettings.replyModel}
                onChange={(event) => void saveTextModels(textModelSettings.editorialModel, event.target.value, textModelSettings.analysisModel)}
              >
                {textModelSettings.models.map((model) => (
                  <option key={model.id} value={model.id}>{model.label}</option>
                ))}
              </select>
            </label>
            <label>
              موتور تحلیل و پژوهش وب
              <select
                disabled={textModelSaving}
                value={textModelSettings.analysisModel}
                onChange={(event) => void saveTextModels(textModelSettings.editorialModel, textModelSettings.replyModel, event.target.value)}
              >
                {textModelSettings.models.map((model) => (
                  <option key={model.id} value={model.id}>{model.label}</option>
                ))}
              </select>
            </label>
            <label>
              موتور ساخت پرامپت ویدیو
              <select
                disabled={textModelSaving}
                value={textModelSettings.videoPromptModel}
                onChange={(event) => void saveTextModels(textModelSettings.editorialModel, textModelSettings.replyModel, textModelSettings.analysisModel, event.target.value)}
              >
                {textModelSettings.models.map((model) => (
                  <option key={model.id} value={model.id}>{model.label}</option>
                ))}
              </select>
              <small className="hint">این انتخاب فقط برای نگارش پرامپت ویدیوست؛ موتور تولید ویدیو جداگانه در فرم ویدیوساز انتخاب می‌شود.</small>
            </label>
          </div>
        )}
      </section>

      <section
        className={`card ${activeTab === "settings" ? "" : "tab-hidden"}`}
      >
        <h2>۹. موتور پیش‌فرض صدا</h2>
        <p className="hint">تولید صدا از همان حساب AvalAI انجام می‌شود. انتخاب اینجا فقط پیش‌فرض تب «تولید صدا» است و برای هر خوانش قابل تغییر خواهد بود.</p>
        {accessState === "owner" && voiceModelSettings && (() => {
          const selectedEngine = voiceModelSettings.engines.find((item) => item.id === voiceModelSettings.defaultVoiceEngine);
          return <div className="form-grid">
            <label>موتور پیش‌فرض<select disabled={voiceModelSaving} value={voiceModelSettings.defaultVoiceEngine} onChange={(event) => {
              const nextEngine = voiceModelSettings.engines.find((item) => item.id === event.target.value);
              void saveVoiceModels(event.target.value, nextEngine?.voices[0]?.id ?? "");
            }}>{voiceModelSettings.engines.map((engine) => <option key={engine.id} value={engine.id} disabled={!engine.available}>{engine.label}{engine.available ? "" : " · کلید AvalAI تنظیم نیست"}</option>)}</select></label>
            {selectedEngine && <label>شخصیت صوتی پیش‌فرض<select disabled={voiceModelSaving} value={voiceModelSettings.defaultVoice} onChange={(event) => void saveVoiceModels(selectedEngine.id, event.target.value)}>{selectedEngine.voices.map((voice) => <option key={voice.id} value={voice.id}>{voice.label}</option>)}</select><small className="hint">{selectedEngine.description}</small></label>}
          </div>;
        })()}
      </section>

      <section
        className={`card ${activeTab === "settings" ? "" : "tab-hidden"}`}
      >
        <h2>۱۰. موتور تبدیل صوت به متن</h2>
        <p className="hint">این انتخاب برای بخش «افزودن از فایل‌های صوتی» در ویرایش متن است. فایل ابتدا پایدار ذخیره می‌شود و سپس با همین موتور پیاده‌سازی خواهد شد.</p>
        {accessState === "owner" && transcriptionModelSettings && <label>موتور پیش‌فرض<select disabled={transcriptionModelSaving || !transcriptionModelSettings.available} value={transcriptionModelSettings.defaultTranscriptionModel} onChange={(event) => void saveTranscriptionModel(event.target.value)}>{transcriptionModelSettings.models.map((model) => <option key={model.id} value={model.id}>{model.label}</option>)}</select><small className="hint">{transcriptionModelSettings.models.find((model) => model.id === transcriptionModelSettings.defaultTranscriptionModel)?.description}</small></label>}
      </section>

      <section
        className={`card ${activeTab === "settings" ? "" : "tab-hidden"}`}
      >
        <h2>۱۱. پرامپت‌ها</h2>
        <p className="hint">
          این فهرست فقط پرامپت‌های واقعی و در حال استفادهٔ خودِ استودیو است:
          پایه، استخراج خودکار و هر خروجی متنی به‌صورت ماژول جدا؛ همچنین پایه،
          سبک و قالب‌های تصویر. هر ذخیره فوراً در درخواست بعدی اعمال و نسخهٔ
          قبلی نگه‌داری می‌شود.
        </p>
        <div className="choices">
          <button
            className={promptTab === "image" ? "selected" : ""}
            onClick={() => setPromptTab("image")}
            type="button"
          >
            پرامپت‌های ساخت تصویر
          </button>
          <button
            className={promptTab === "text" ? "selected" : ""}
            onClick={() => setPromptTab("text")}
            type="button"
          >
            پرامپت‌های خبر متنی
          </button>
        </div>
        {accessState === "owner" && (
          <div className="prompt-list">
            {visiblePrompts.map((prompt) => (
              <article className="prompt-card" key={prompt.id}>
                <b>{prompt.label}</b>
                <small>{prompt.nodeName}</small>
                {prompt.description && <em>{prompt.description}</em>}
                {editingPromptId === prompt.id ? (
                  <>
                    <textarea
                      value={promptDraft}
                      onChange={(event) => setPromptDraft(event.target.value)}
                    />
                    <div className="choices">
                      <button
                        className="selected"
                        onClick={savePrompt}
                        type="button"
                      >
                        ذخیره نسخهٔ جدید
                      </button>
                      <button
                        onClick={() => setEditingPromptId(undefined)}
                        type="button"
                      >
                        انصراف
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p>
                      {prompt.content.slice(0, 260)}
                      {prompt.content.length > 260 ? "…" : ""}
                    </p>
                    <button
                      onClick={() => {
                        setEditingPromptId(prompt.id);
                        setPromptDraft(prompt.content);
                      }}
                      type="button"
                    >
                      ویرایش پرامپت
                    </button>
                  </>
                )}
              </article>
            ))}
            {visiblePrompts.length === 0 && (
              <p className="hint">پرامپتی در این بخش پیدا نشد.</p>
            )}
          </div>
        )}
      </section>

      <section
        className={`card production-panel ${activeTab === "create" && designSlides.length <= 1 ? "" : "tab-hidden"}`}
      >
        <div className="image-engine-request-control">
          <button
            className="link-button"
            onClick={() => setImageEnginePickerOpen((current) => !current)}
            type="button"
          >
            {imageEnginePickerOpen ? "بستن انتخاب موتور" : "موتور و کیفیت این درخواست"}
          </button>
          {imageEnginePickerOpen && (
            <div className="image-engine-request-panel">
              {needsNativeTransparentImage ? (
                <p className="hint">برای PNG شفافِ واقعی، یکی از مدل‌های GPT Image با کیفیت Auto استفاده می‌شود؛ این مدل‌ها کانال آلفای معتبر دارند.</p>
              ) : (
                <>
                  <label>
                    موتور همین درخواست
                    <select
                      value={imageEngineOverride}
                      onChange={(event) => setImageEngineOverride(event.target.value)}
                    >
                      <option value="">پیش‌فرض تنظیمات ({imageModelLabel(imageModelSettings?.defaultModel)})</option>
                      {(imageModelSettings?.models?.length ? imageModelSettings.models : imageEngineOptions).map((model) => (
                        <option key={model.id} value={model.id}>{model.label}</option>
                      ))}
                    </select>
                  </label>
                  {(["gpt-image-2", "gpt-image-2.5-flare", "gpt-image-2.5-sunburst"].includes(imageEngineOverride) || (!imageEngineOverride && ["gpt-image-2", "gpt-image-2.5-flare", "gpt-image-2.5-sunburst"].includes(imageModelSettings?.defaultModel ?? ""))) && (
                    <label>
                      کیفیت GPT Image
                      <select value={imageQuality} onChange={(event) => setImageQuality(event.target.value as "low" | "medium" | "high")}>
                        <option value="low">اقتصادی — اتود و طرح‌های ساده</option>
                        <option value="medium">متعادل — پیش‌فرض پیشنهادی برای تولید روزانه</option>
                        <option value="high">بیشینه — چهره، استودیو، پوستر مهم و جزئیات ظریف</option>
                      </select>
                    </label>
                  )}
                  <p className="hint">Gemini Flash Lite برای اتودهای کم‌هزینه؛ Gemini Flash برای کارهای معمول؛ GPT Image 2.5 Flare برای تولید سریع و Sunburst برای ویرایش دقیق‌تر. کیفیت «بیشینه» را فقط برای چهره، استودیو، تصویر مرجع حساس یا پوستر نهایی انتخاب کنید.</p>
                </>
              )}
            </div>
          )}
        </div>
        <div className="choices production-actions">
          <button
            className="primary"
            disabled={
              submissionState === "uploading" ||
              !hasRequiredDesignContent ||
              (designSlides.length > 1
                ? !seriesFirstSlideReady
                : requiresReferenceImage &&
                  files.length + visibleDraftReferences.length === 0) ||
              (activeJob?.state === "completed" && !formEditMode)
            }
            onClick={submit}
            type="button"
          >
            {submissionState === "uploading"
              ? "در حال ارسال درخواست…"
              : formEditMode
                ? "ثبت ویرایش با فرم"
                : "ثبت درخواست طراحی AI"}
          </button>
          <button
            className="secondary"
            disabled={
              promptPreviewBusy ||
              !hasRequiredDesignContent ||
              (designSlides.length > 1
                ? !seriesFirstSlideReady
                : requiresReferenceImage &&
                  files.length + visibleDraftReferences.length === 0)
            }
            onClick={() => void createPromptOnly()}
            type="button"
          >
            {promptPreviewBusy ? "در حال ساخت پرامپت…" : "فقط ساخت پرامپت"}
          </button>
          {supportsDataCaption && (
            <button
              className="secondary"
              disabled={designCaptionBusy || !hasRequiredDesignContent}
              onClick={() => void createDesignCaption()}
              type="button"
            >
              {designCaptionBusy
                ? "در حال آماده‌سازی کپشن…"
                : "متن کپشن این تصویر"}
            </button>
          )}
        </div>
        {promptPreviewError && <p className="error">{promptPreviewError}</p>}
        {promptPreview && (
          <article className="prompt-only-result">
            <div>
              <b>پرامپت نهاییِ ماژولار</b>
              <small>
                مدل پیشنهادی: <code dir="ltr">{promptPreview.model}</code> ·{" "}
                {promptPreview.attachments.referenceImageCount > 0
                  ? `${toPersianDigits(String(promptPreview.attachments.referenceImageCount))} تصویر مرجع`
                  : "بدون تصویر مرجع"}
              </small>
            </div>
            <p>{promptPreview.attachments.note}</p>
            <textarea readOnly rows={14} value={promptPreview.prompt} />
            {promptPreview.files?.length > 0 && (
              <section className="prompt-package-files">
                <div className="section-heading">
                  <div>
                    <b>فایل‌های همین درخواست</b>
                    <small>نام فایل‌ها با ارجاع‌های داخل پرامپت یکی است.</small>
                  </div>
                  <button className="primary" onClick={() => void downloadDesignPromptBundle()} type="button">
                    دانلود ZIP کامل
                  </button>
                </div>
                <div className="prompt-reference-list">
                  {promptPreview.files.map((file) => (
                    <button key={file.filename} onClick={() => void downloadDesignPromptAsset(file.filename)} type="button">
                      <span aria-hidden="true">🖼️</span>
                      <span><b dir="ltr">{file.filename}</b><small>{file.role} · دانلود تکی</small></span>
                    </button>
                  ))}
                </div>
              </section>
            )}
            <div className="choices">
              <button
                className="selected"
                onClick={() =>
                  void navigator.clipboard?.writeText(promptPreview.prompt)
                }
                type="button"
              >
                کپی پرامپت
              </button>
              <button onClick={() => setPromptPreview(undefined)} type="button">
                بستن
              </button>
            </div>
          </article>
        )}
        {designCaptionError && <p className="error">{designCaptionError}</p>}
        {supportsDataCaption && designCaptionDraft && (
          <article className="prompt-only-result">
            <div>
              <b>کپشن آمادهٔ انتشار</b>
              <small>
                بر پایهٔ داده‌های همین فرم و منابع بازیابی‌شده؛ پیش از ساخت یا
                انتشار می‌توانید آن را ویرایش کنید.
              </small>
            </div>
            <textarea
              readOnly={!designCaptionEditing}
              rows={12}
              value={designCaptionDraft}
              onChange={(event) => setDesignCaptionDraft(event.target.value)}
            />
            <div className="choices">
              <button
                className="selected"
                onClick={() =>
                  void navigator.clipboard?.writeText(designCaptionDraft)
                }
                type="button"
              >
                کپی کپشن
              </button>
              <button
                onClick={() => setDesignCaptionEditing((current) => !current)}
                type="button"
              >
                {designCaptionEditing ? "ثبت ویرایش" : "ویرایش کپشن"}
              </button>
              <button
                onClick={() => {
                  setDesignCaptionDraft("");
                  setDesignCaptionEditing(false);
                }}
                type="button"
              >
                حذف کپشن
              </button>
            </div>
          </article>
        )}
        {requiresReferenceImage &&
          files.length + visibleDraftReferences.length === 0 && (
            <p className="hint">
              برای این حالت، دست‌کم یک عکس مرجع پیوست کنید.
            </p>
          )}
        {submissionState === "uploading" && (
          <div className="submission-progress">
            <span className="spinner" aria-hidden="true" />
            <span>
              <b>
                {files.length + puzzleFiles.length > 0
                  ? `در حال بارگذاری ${toPersianDigits(String(files.length + puzzleFiles.length))} فایل مرجع و ثبت پروژه`
                  : "در حال ثبت پروژه در صف ساخت"}
              </b>
              <small>لطفاً تا دریافت پاسخ سرور، دکمه را دوباره نزنید.</small>
            </span>
          </div>
        )}
        {submissionState === "submitted" && (
          <p className="success">درخواست با موفقیت و با شناسهٔ ثابت ثبت شد.</p>
        )}
        {submissionState === "error" && (
          <p className="error">
            {submissionError ||
              "ارسال درخواست انجام نشد؛ لطفاً اتصال را بررسی و دوباره تلاش کنید."}
          </p>
        )}
        {activeJob && (
          <article className={`production-card state-${activeJob.state}`}>
            <div>
              <h3>
                {activeJob.state === "completed"
                  ? "خروجی آماده است"
                  : activeJob.state === "failed"
                    ? "ساخت ناموفق بود"
                    : activeJob.state === "cancelled"
                      ? "پروژه لغو شد"
                      : activeJob.state === "processing"
                        ? "در حال ساخت تصویر"
                        : "در صف ساخت تصویر"}
              </h3>
              <p>
                {activeJob.failureReason ||
                  activeJob.lastEvent?.message ||
                  "وضعیت پروژه در حال به‌روزرسانی است."}
              </p>
            </div>
            {["queued", "processing", "cancel_requested"].includes(
              activeJob.state,
            ) && (
              <div className="job-progress">
                <span className="spinner" aria-hidden="true" />
                <span>
                  <b>در حال پردازش با {jobImageModelLabel(activeJob)}</b>
                  <small>
                    زمان سپری‌شده:{" "}
                    {String(Math.floor(elapsedSeconds / 60)).padStart(2, "0")}:
                    {String(elapsedSeconds % 60).padStart(2, "0")}
                  </small>
                </span>
              </div>
            )}
            <small>
              تلاش {activeJob.attempt} · شناسهٔ پروژه:{" "}
              {activeJob.requestId.slice(0, 8)}
            </small>
            {activeJob.state === "failed" && (
              <div className="raw-ai-response">
                <button
                  className="link-button"
                  onClick={() => setShowRawAiResponse((current) => !current)}
                  type="button"
                >
                  پاسخ خام هوش مصنوعی
                </button>
                {showRawAiResponse && (
                  <pre>
                    {activeJob.rawError ||
                      "پاسخ خام قابل‌نمایش از سرویس دریافت نشد."}
                  </pre>
                )}
              </div>
            )}
            <div className="choices">
              {["queued", "processing", "cancel_requested"].includes(
                activeJob.state,
              ) && (
                <button onClick={() => updateActiveJob("cancel")} type="button">
                  لغو
                </button>
              )}
              {["failed", "cancelled"].includes(activeJob.state) && activeJob.errorCode !== "provider_safety_rejected" && (
                <button
                  className="selected"
                  onClick={() => updateActiveJob("retry")}
                  type="button"
                >
                  تلاش مجدد
                </button>
              )}
              {activeJob.state === "failed" && activeJob.errorCode === "provider_safety_rejected" && (
                <small className="hint">برای این خطا، ابتدا متن یا تصویر مرجع را تغییر دهید؛ ارسال دوبارهٔ همان ورودی معمولاً دوباره رد می‌شود.</small>
              )}
              {activeJob.outputs.length > 0 && (
                <button
                  className="selected"
                  onClick={showLatestOutput}
                  disabled={outputLoading}
                  type="button"
                >
                  {outputLoading ? "در حال بارگذاری طرح…" : "نمایش طرح AI"}
                </button>
              )}
            </div>
            {activeJob.outputs.at(-1) && (
              <div className="output-actions">
                <span>
                  فایل نهایی هوش مصنوعی
                  {usageLabel(activeJob.outputs.at(-1)?.usage) && (
                    <small>{usageLabel(activeJob.outputs.at(-1)?.usage)}</small>
                  )}
                </span>
                <button
                  onClick={() =>
                    downloadOutput(activeJob.outputs.at(-1)!.filename)
                  }
                  type="button"
                >
                  {telegram?.initData
                    ? "دریافت فایل باکیفیت در چت"
                    : "دانلود فایل اصلی باکیفیت (PNG)"}
                </button>
                {latestNoHeaderOutput(activeJob) && (
                  <button
                    className="secondary"
                    onClick={() =>
                      void downloadJobOutput(
                        activeJob.requestId,
                        latestNoHeaderOutput(activeJob)!.filename,
                      )
                    }
                    type="button"
                  >
                    {telegram?.initData
                      ? "ارسال نسخه بدون سربرگ به چت"
                      : "دانلود بدون سربرگ (PNG)"}
                  </button>
                )}
              </div>
            )}
            {outputLoading && (
              <p className="output-loading">طرح AI در حال بارگذاری است…</p>
            )}
            {activeOutputUrl && (
              <img
                className="generated-output"
                src={activeOutputUrl}
                alt="خروجی پروژه"
              />
            )}
            {slideSeries && (
              <section className="series-review-panel">
                <div>
                  <b>
                    {slideSeries.mode === "carousel"
                      ? "کاروسل"
                      : "استوری چنداسلایدی"}{" "}
                    · اسلاید{" "}
                    {toPersianDigits(String(slideSeries.currentIndex + 1))} از{" "}
                    {toPersianDigits(String(designSlides.length))}
                  </b>
                  <small>اسلاید بعدی تا تأیید این اسلاید ساخته نمی‌شود.</small>
                </div>
                <div className="series-output-grid">
                  {slideSeriesOutputs.map((item) => (
                    <figure key={item.requestId}>
                      <button
                        className="series-output-preview"
                        onClick={() => void openSeriesSlide(item.index)}
                        title="بازکردن فرم و خروجی این اسلاید"
                        type="button"
                      >
                        <img alt={`اسلاید ${item.index + 1}`} src={item.url} />
                      </button>
                      <button
                        className="series-slide-name"
                        onClick={() => void openSeriesSlide(item.index)}
                        type="button"
                      >
                        اسلاید {toPersianDigits(String(item.index + 1))} ·
                        تأییدشده
                      </button>
                      <button
                        className="link-button"
                        onClick={() =>
                          void downloadJobOutput(item.requestId, item.filename)
                        }
                        type="button"
                      >
                        دانلود باکیفیت
                      </button>
                      {item.noHeaderFilename && (
                        <button
                          className="link-button"
                          onClick={() =>
                            void downloadJobOutput(item.requestId, item.noHeaderFilename!)
                          }
                          type="button"
                        >
                          دانلود بدون سربرگ
                        </button>
                      )}
                    </figure>
                  ))}
                  {activeOutputUrl &&
                    activeJob.state === "completed" &&
                    !slideSeriesOutputs.some(
                      (item) => item.requestId === activeJob.requestId,
                    ) && (
                      <figure className="current-slide">
                        <img
                          alt={`اسلاید ${slideSeries.currentIndex + 1}`}
                          src={activeOutputUrl}
                        />
                        <figcaption>
                          اسلاید{" "}
                          {toPersianDigits(
                            String(slideSeries.currentIndex + 1),
                          )}{" "}
                          · در انتظار تأیید
                        </figcaption>
                      </figure>
                    )}
                </div>
              </section>
            )}
            {activeJob.state === "completed" && (
              <div className="image-edit-panel">
                <label>
                  ویرایش این تصویر با هوش مصنوعی
                  <input
                    value={editInstruction}
                    onChange={(event) => setEditInstruction(event.target.value)}
                    placeholder="مثلاً نور عکس را گرم‌تر کن و سوژه را کمی به چپ ببر"
                  />
                </label>
                <p className="hint">
                  نسخهٔ اصلی محفوظ می‌ماند. ویرایش متنی یا فرمی یک پروژهٔ جدید و
                  قابل پیگیری می‌سازد.
                </p>
                <div className="choices">
                  {slideSeries && (
                    <>
                      <button
                        className="selected"
                        onClick={() => void approveSeriesSlide()}
                        type="button"
                      >
                        {slideSeries.currentIndex + 1 < designSlides.length
                          ? "تأیید اسلاید و ساخت بعدی"
                          : "تأیید و پایان سری"}
                      </button>
                      <button
                        className="secondary"
                        onClick={() =>
                          focusSeriesSlide(slideSeries.currentIndex, true)
                        }
                        type="button"
                      >
                        ویرایش متن اسلاید
                      </button>
                      <button
                        className="link-button"
                        onClick={() => void retrySeriesSlide()}
                        type="button"
                      >
                        تلاش مجدد همین اسلاید
                      </button>
                    </>
                  )}
                  <button
                    className="selected"
                    onClick={() => void sendCompletedDesignToPublish()}
                    type="button"
                  >
                    انتقال تصویر و کپشن به انتشار سریع
                  </button>
                  <button
                    className="secondary"
                    disabled={storySummaryBusy}
                    onClick={() => void createStorySummary()}
                    type="button"
                  >
                    {storySummaryBusy ? "در حال ساخت خلاصه…" : "خلاصه توضیح"}
                  </button>
                  <button
                    className="secondary"
                    disabled={publishMediaBusy}
                    onClick={() => void sendCompletedDesignToPublish(false)}
                    type="button"
                  >
                    <BookmarkIcon /> ذخیرهٔ تصویر در سوژه خبری
                  </button>
                  <button
                    className="secondary"
                    disabled={editInstruction.trim().length < 4}
                    onClick={submitImageEdit}
                    type="button"
                  >
                    ثبت ویرایش تصویر
                  </button>
                  <button
                    className="link-button"
                    onClick={() => void openCurrentJobFormEdit()}
                    type="button"
                  >
                    ویرایش با فرم
                  </button>
                  <button
                    className="link-button"
                    onClick={recreateSameContent}
                    type="button"
                  >
                    ساخت مجدد همین محتوا
                  </button>
                </div>
                {storySummaryError && <p className="error">{storySummaryError}</p>}
                {storySummary && <div className="story-summary-result"><b>خلاصهٔ توضیح استوری</b><textarea readOnly rows={5} value={storySummary} /><button className="secondary" onClick={() => void navigator.clipboard?.writeText(storySummary)} type="button">کپی خلاصه</button></div>}
              </div>
            )}
            {["completed", "failed", "cancelled"].includes(activeJob.state) && (
              <div className="new-design-zone">
                <p className="hint">
                  اگر قصد ویرایش همین خروجی را دارید، ابتدا از بخش‌های ویرایش
                  بالا استفاده کنید.
                </p>
                <button
                  className="primary new-design"
                  onClick={startNewDesign}
                  type="button"
                >
                  ساخت تصویر کاملاً جدید
                </button>
              </div>
            )}
          </article>
        )}
        <p className="hint rights">
          کلیه حقوق متعلق به پایگاه خبری کلام تازه نیوز می‌باشد.
          <small className="studio-release" title="شناسهٔ نسخهٔ رابط استودیو">
            نسخه {STUDIO_RELEASE}
          </small>
        </p>
      </section>
      {previewFile && (
        <div
          className="image-lightbox"
          role="dialog"
          aria-label="نمایش تصویر مرجع"
          onClick={() => setPreviewFile(undefined)}
        >
          <figure onClick={(event) => event.stopPropagation()}>
            <button onClick={() => setPreviewFile(undefined)} type="button">
              ×
            </button>
            <img src={previewFile.url} alt={previewFile.name} />
            <figcaption>{previewFile.name}</figcaption>
          </figure>
        </div>
      )}
      {publishReviewMode && (
        <div
          className="publish-review-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="بازبینی انتشار"
        >
          <section className="publish-review-modal">
            <div className="section-heading">
              <div>
                <h2>بازبینی نهایی انتشار</h2>
                <p className="hint">
                  پس از تأیید، درخواست فقط به مقصدهای زیر ارسال می‌شود.
                </p>
              </div>
              <button
                aria-label="بستن"
                className="link-button"
                onClick={() => setPublishReviewMode(undefined)}
                type="button"
              >
                ×
              </button>
            </div>
            {(() => {
              const isSitePreview = publishReviewMode === "site";
              const previewTitle = isSitePreview
                ? publishSiteArticle.title
                : "";
              const previewText = isSitePreview
                ? (publishSiteArticle.body ?? "")
                : publishDraftText;
              return (
                <article className="channel-preview">
                  <small>
                    {isSitePreview
                      ? "پیش‌نمایش سایت کلام تازه"
                      : "پیش‌نمایش پیام"}
                  </small>
                  {publishPreviewMedia.length > 0 && (
                    <div className="preview-media-grid">
                      {publishPreviewMedia.map((media) =>
                        media.kind === "video" ? (
                          <figure className="preview-video" key={media.mediaId}>
                            <video
                              aria-label={`پیش‌نمایش ویدیو: ${media.filename}`}
                              muted
                              playsInline
                              preload="auto"
                              src={media.url}
                            />
                            <span
                              aria-hidden="true"
                              className="preview-video-play"
                            >
                              ▶
                            </span>
                            <figcaption>{media.filename}</figcaption>
                          </figure>
                        ) : (
                          <img
                            alt={media.filename}
                            key={media.mediaId}
                            src={media.url}
                          />
                        ),
                      )}
                    </div>
                  )}
                  {publishReviewMode === "media" &&
                    publishPreviewMedia.length === 0 && (
                      <div className="preview-files">
                        {publishMediaIds.length
                          ? `📎 ${toPersianDigits(String(publishMediaIds.length))} فایل انتخاب‌شده`
                          : "📎 خروجی تصویر استودیو"}
                      </div>
                    )}
                  {previewTitle && (
                    <b className="channel-preview-title">{previewTitle}</b>
                  )}
                  <div
                    className="channel-preview-content"
                    dangerouslySetInnerHTML={{
                      __html: previewText || "<p>بدون متن</p>",
                    }}
                  />
                </article>
              );
            })()}
            <div className="review-targets">
              <b>مقصدها</b>
              <div>
                {publishReviewMode === "site"
                  ? "سایت کلام تازه"
                  : [
                      ...publishTargets,
                      ...(publishReviewMode === "media"
                        ? videoPublishTargets
                        : []),
                    ]
                      .map((target) => target.replace("_", " · "))
                      .join("، ")}
              </div>
            </div>
            <p className="hint">
              {publishTargets.some((target) => target.startsWith("rubika_"))
                ? "در روبیکا، قالب‌بندی Rich Text به متن ساده تبدیل می‌شود."
                : "قالب‌بندی مشترک پیام‌رسان‌ها تا حد پشتیبانی مقصد حفظ می‌شود."}
            </p>
            <div className="choices">
              <button
                className="secondary"
                onClick={() => setPublishReviewMode(undefined)}
                type="button"
              >
                بازگشت و ویرایش
              </button>
              <button
                className="primary"
                disabled={publishBusy}
                onClick={() => {
                  const mode = publishReviewMode;
                  setPublishReviewMode(undefined);
                  if (mode === "text") void runFastPublish(true);
                  else if (mode === "media") void runFastPhotoPublish(true);
                  else if (mode === "unified") void runUnifiedPublish(true);
                  else void runSitePublish(true);
                }}
                type="button"
              >
                {publishBusy ? "در حال ارسال…" : "تأیید نهایی و انتشار"}
              </button>
            </div>
          </section>
        </div>
      )}
      {activeTab !== "engagement" && activeTab !== "news" && activeTab !== "club" && (
          <nav className="tab-bar" aria-label="ناوبری اصلی">
            <button
              className={activeTab === "video" ? "active" : ""}
              onClick={() => setActiveTab("video")}
              type="button"
            >
              <span>▶</span>ویدیوساز
            </button>
            <button
              className={activeTab === "editorial" ? "active" : ""}
              onClick={() => setActiveTab("editorial")}
              type="button"
            >
              <span>✎</span>ویرایش متن
            </button>
            <button
              className={
                activeTab === "create" ? "active create-tab" : "create-tab"
              }
              onClick={startNewDesign}
              type="button"
            >
              <span>✦</span>ساخت تصویر
            </button>
            <button
              className={activeTab === "publish" ? "active" : ""}
              onClick={() => setActiveTab("publish")}
              type="button"
            >
              <span>↗</span>انتشار سریع
            </button>
            <button
              className={activeTab === "library" ? "active" : ""}
              onClick={() => setActiveTab("library")}
              type="button"
            >
              <span>▣</span>کتابخانه
            </button>
          </nav>
        )}
    </main>
  );
}

export default App;
