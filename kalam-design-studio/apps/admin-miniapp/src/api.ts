export type SubmissionResult =
  { mode: "preview" } | { mode: "submitted"; requestId: string };
export type DesignPromptPreview = {
  prompt: string;
  model: string;
  packageId: string;
  bundleFilename: string;
  files: Array<{
    filename: string;
    originalFilename?: string;
    role: string;
    bytes: number;
    mimeType: string;
  }>;
  attachments: { header: string; referenceImageCount: number; note: string };
};

export type AccessUser = {
  chatId: string;
  status: string;
  username?: string;
  requestedAt?: number;
  webUsername?: string;
  webEnabled?: boolean;
  workPhone?: string;
};
export type AccessView = { ownerId: string; users: AccessUser[] };
export type LibraryProject = {
  requestId: string;
  title: string;
  brand: string;
  createdAt: string;
  uploadedImageCount: number;
  state: string;
  request?: Record<string, unknown>;
};
export type PromptItem = {
  id: string;
  nodeName: string;
  label: string;
  description?: string;
  content: string;
  category?: "text" | "image";
};
export type EngagementAccount = {
  id: string;
  username: string;
  instagramUserId?: string;
  profilePhoto?: string;
  active: boolean;
  expiresAt?: string;
  syncedAt?: number;
};
export type EngagementConnection = {
  connectionId: string;
  name: string;
  baseUrl: string;
  active: boolean;
  hasApiKey: boolean;
  createdAt?: number;
};
export type EngagementRule = {
  ruleId: string;
  name: string;
  enabled: boolean;
  accountIds: string[];
  eventTypes: string[];
  match: { mode: string; text: string; terms?: string[] };
  action: EngagementRuleAction;
  // `action` remains the first action for existing rules. New rules may run
  // a bounded sequence in `actions`, in the order shown to the administrator.
  actions?: EngagementRuleAction[];
  priority: number;
  // Per-rule/per-person repeat guard.  Seconds make a short debounce explicit;
  // older saved rules may still return cooldownMinutes until they are re-saved.
  cooldownSeconds: number;
  cooldownMinutes?: number;
  scope?: { kind: "story"; accountId: string; mediaId: string };
};
export type EngagementRuleAction = {
    mode: string;
    text: string;
    character?: "none" | "random" | "kamran" | "tara";
    buttons?: Array<{ type?: "postback" | "web_url"; title: string; url?: string; payload?: string }>;
    attachments?: Array<{ attachmentId: string; filename: string; storedFilename?: string; mimeType: string; kind?: "image" | "video" | "audio" | "file"; url?: string }>;
    conversationMaxMessages?: number;
    showcaseCards?: EngagementShowcaseCard[];
    // A rule may label a whole DM thread without sending a message. The tag
    // name is always selected from the shared, server-side tag catalog.
    tagName?: string;
    tagOperation?: "add" | "remove";
};
export type EngagementShowcaseCard = {
  cardId: string;
  title: string;
  subtitle: string;
  image: { attachmentId: string; filename: string; storedFilename?: string; mimeType: string; kind?: "image"; url?: string };
  buttons: Array<{ type?: "postback" | "web_url"; title: string; url?: string; payload?: string }>;
};
export type EngagementShowcase = { showcaseId: string; name: string; cards: EngagementShowcaseCard[]; updatedAt?: number };
export type EngagementPersona = { characterId: "kamran" | "tara"; name: string; instruction: string };
export type EngagementInboxItem = {
  eventId: string;
  platform: string;
  accountId: string;
  eventType: string;
  senderId?: string;
  senderName?: string;
  senderUsername?: string;
  senderProfilePhoto?: string;
  direction?: "incoming" | "outgoing";
  parentEventId?: string;
  text: string;
  receivedAt: number;
  status: string;
  tags?: string[];
  aiSuggestion?: string;
  ruleId?: string;
  autoReply?: boolean;
  mediaId?: string;
  mediaType?: string;
  mediaThumbnail?: string;
  mediaUrl?: string;
  mediaPermalink?: string;
  mediaCaption?: string;
  storyPublishedAt?: number;
  storyContext?: string;
  buttonLabel?: string;
  buttonPayload?: string;
  buttonUrl?: string;
  mediaPending?: boolean;
  commentTotal?: number;
  commentNewTotal?: number;
};
export type EngagementKnowledge = {
  version?: number;
  voice: string;
  safety: string;
  advertising: string;
  nonAdvertising: string;
  facts: string;
  faq: string;
  sources: Array<{
    sourceId: string;
    kind: string;
    label: string;
    url: string;
    enabled: boolean;
  }>;
};
export type ClubAdminMember = {
  id: string;
  phone: string;
  fullName: string;
  city: string;
  platformHandles: Record<string, string>;
  score: number;
};
export type ClubAdminConversation = {
  id: string;
  status: string;
  member: ClubAdminMember;
  lastMessageAt: string;
  assignedAdminId?: string | null;
};
export type ClubAdminMessage = {
  attachmentCaptions?: Record<string, string>;
  id: string;
  conversationId: string;
  sender: "member" | "admin" | "system";
  text: string;
  attachmentIds: string[];
  sentAt: string;
  aiGenerated?: boolean;
};
export type ClubAdminSubmission = {
  contentCategory?: string;
  anonymous?: boolean;
  classifiedDetails?: { type?: string; contact?: string };
  reviewedAt?: string;
  reviewedBy?: string;
  campaign?: { points: number; label: string; handle: string; publishedAt: string; title: string };
  id: string;
  member: ClubAdminMember;
  status: "pending" | "approved" | "rejected";
  creditLabel: string;
  awardedScore: number;
  adminNote: string;
  rejectionReason: string;
  createdAt: string;
  items: Array<{
    id: string;
    attachmentId?: string | null;
    text: string;
    caption: string;
  }>;
};
export type ClubAdminReward = {
  activeUntil?: string | null;
  id: string;
  partnerId?: string | null;
  imageAttachmentId?: string | null;
  imageUrl?: string | null;
  title: string;
  description: string;
  kind: string;
  fulfillmentMode: string;
  pointsCost: number;
  active: boolean;
  stockRemaining?: number | null;
  stockTotal?: number | null;
  codeExpiresAfterDays?: number | null;
  partner?: {
    name: string;
    description: string;
    address: string;
    phone: string;
    websiteUrl: string;
    logoAttachmentId?: string | null;
    logoUrl?: string | null;
  } | null;
};
export type ClubAdminClaim = {
  id: string;
  member: ClubAdminMember;
  reward: ClubAdminReward;
  status: string;
  pointsDebited: number;
  fulfillmentNote: string;
  createdAt: string;
};
export type NewsSeekerCategory =
  | "google_trends"
  | "google_sports"
  | "local"
  | "khabarfarsi"
  | "national"
  | "khorasan_razavi";
export type NewsSeekerItem = {
  id: string;
  snapshotId?: string;
  title: string;
  summary: string;
  source: string;
  sourceId?: string;
  scope?: string;
  url: string;
  publishedAt?: string;
  traffic?: string;
  imageUrl?: string;
  tags?: string;
  priorityScore?: number;
  priorityReason?: string;
  trendUrl?: string;
  trendKeyword?: string;
  needsReview?: boolean;
  related?: Array<{ id: string; title: string; summary?: string; source?: string; url: string; publishedAt?: string; imageUrl?: string }>;
};
export type ImageModelSettings = {
  defaultModel: string;
  models: Array<{ id: string; label: string }>;
};
export type TextModelSettings = {
  editorialModel: string;
  replyModel: string;
  analysisModel: string;
  videoPromptModel: string;
  models: Array<{ id: string; label: string }>;
};
export type VoiceOption = { id: string; label: string };
export type VoiceEngine = {
  id: string;
  provider: "openai" | "gemini";
  model: string;
  label: string;
  description: string;
  available: boolean;
  estimatedCostUsdPer1kCharacters: number;
  voices: VoiceOption[];
};
export type VoiceModelSettings = {
  defaultVoiceEngine: string;
  defaultVoice: string;
  engines: VoiceEngine[];
};
export type VoiceProject = {
  voiceId: string;
  state: "completed";
  createdAt: number;
  updatedAt: number;
  engineId: string;
  model: string;
  voice: string;
  instructions: string;
  outputFilename: string;
  mimeType: string;
  bytes: number;
  estimatedCostUsd: number;
  durationMs: number;
};
export type TranscriptionModelSettings = { defaultTranscriptionModel: string; available: boolean; models: Array<{ id: string; label: string; description: string }> };
export type AudioTranscriptionJob = { jobId: string; contentProjectId: string; model: string; state: "queued" | "processing" | "completed" | "failed"; files: Array<{ filename: string; bytes: number; state: string; text?: string }>; transcript: string; error: string; createdAt: number; updatedAt: number };
export type NewsSeekerSnapshot = {
  snapshotId: string;
  category: NewsSeekerCategory;
  createdAt: number;
  requestedBy?: {
    id?: string;
    name?: string;
    username?: string;
    automated?: boolean;
  };
  itemCount: number;
  items: NewsSeekerItem[];
  trigger: "manual" | "automatic";
};
export type NewsroomQueueEntry = {
  id: string;
  status: "selected" | "draft_ready" | "ready_to_publish" | "archived";
  item: NewsSeekerItem;
  draft: Record<string, unknown>;
  targets: string[];
  siteMediaStatus?: "needs_media" | "ready";
  contentProjectId?: string;
  publicationState?: string;
  publicationCount?: number;
  createdAt: number;
  updatedAt: number;
};
export type NewsroomSource = {
  id: string;
  label: string;
  domain: string;
  scope: string;
  credibility: number;
  feedUrl: string;
  lastReceivedAt?: number;
  health: "healthy" | "stale" | "unknown";
  itemCount: number;
};
export type NewsroomWorkspace = {
  snapshots: NewsSeekerSnapshot[];
  items: NewsSeekerItem[];
  queue: NewsroomQueueEntry[];
  sources: NewsroomSource[];
  refreshAfterSeconds: number;
};
export type VideoQualityMode = "fast" | "precise";
export type VideoGenerationModel = "veo_3_1" | "gemini_omni_flash";
export type VideoDirectionMode = "news_bulletin" | "explainer" | "social_reel" | "cinematic_report";
export type VideoShot =
  | "formal" | "semi_formal" | "close_up" | "medium" | "full"
  | "moving" | "podium" | "microphone" | "reference";
export type VideoLine = { id: string; presenterId: string; text: string; shot: VideoShot };
export type VideoMotionTextStyle = "headline" | "lower_third" | "stat" | "label";
export type VideoMotionTextPosition = "top" | "center" | "bottom" | "left" | "right";
export type VideoMotionTextAnimation = "fade" | "slide_up" | "slide_left" | "type_on";
export type VideoTimelineBeat = {
  id: string;
  startSecond: number;
  endSecond: number;
  description: string;
  motionText?: string;
  motionStyle?: VideoMotionTextStyle;
  motionPosition?: VideoMotionTextPosition;
  motionAnimation?: VideoMotionTextAnimation;
};
export type ReferenceChoice = { mode: "auto" | "manual"; assetIds: string[] };
export type ReferenceSelection = { presenters: Record<string, ReferenceChoice>; location: ReferenceChoice };
export type VideoProjectInput = {
  projectId: string;
  brand: "kalametaze" | "golbahar" | "chenaran";
  canvas: "portrait" | "landscape";
  qualityMode: VideoQualityMode;
  generationModel: VideoGenerationModel;
  directionMode: VideoDirectionMode;
  durationSeconds: 4 | 6 | 8;
  resolution: "720p" | "1080p";
  speechEnabled: boolean;
  additionalInstructions?: string;
  characterInstructions?: Record<string, string>;
  presenterIds: string[];
  referenceSelection?: ReferenceSelection;
  location: {
    mode: "catalog" | "generated_prompt" | "exact_reference" | "faithful_reference" | "new_from_reference" | "inspiration";
    id: string;
    assetIds?: string[];
    prompt?: string;
    referenceInstructions?: string;
  };
  monitorText: string;
  monitor: { enabled: boolean; mode: "text" | "images" | "blank" | "disabled"; text: string; imageMode: "generate" | "reference" | "preserve"; imageCount: number; brief: string; assetIds?: string[] };
  lines: Array<Omit<VideoLine, "id">>;
  timeline: Array<Omit<VideoTimelineBeat, "id">>;
  music: { mood: "calm" | "serious" | "uplifting" | "neutral"; continuityKey: string };
  continuation?: { parentProjectId: string };
};
export type VideoSegment = { index: number; state: string; progress: number; presenterId: string; shot: VideoShot; error?: string };
export type VideoProjectEvent = { at: number; attempt?: number; state: string; message: string };
export type VideoAttempt = { attempt: number; finishedAt: number; state: string; outputFilename?: string; segments?: Array<Pick<VideoSegment, "index" | "state" | "progress" | "error">> };
export type VideoProject = { projectId: string; state: string; attempt?: number; attempts?: VideoAttempt[]; createdAt: number; updatedAt: number; project: VideoProjectInput; segments: VideoSegment[]; events?: VideoProjectEvent[]; outputFilename?: string; estimatedSeconds: number; estimatedCostUsd: number; error?: string };
export type VideoAssetProfile = {
  role: string;
  aspectRatio: "portrait" | "landscape" | "square" | "flexible";
  framing: "close" | "medium" | "full" | "wide";
  presenterCapacity: number;
  copySpace: "none" | "left" | "right" | "top" | "bottom";
  placement: "auto" | "behind_desk" | "beside_screen" | "seated" | "standing_floor";
  subjectPosition: "auto" | "left" | "center" | "right";
  foregroundOccluder: "auto" | "none" | "desk" | "seating" | "podium";
  cameraAngle: "eye_level" | "slight_low" | "slight_high";
  label: string;
};
export type VideoAssetProfileOptions = {
  roles: Record<"presenter" | "location" | "monitor", Record<string, string>>;
  aspectRatios: Record<string, string>;
  framings: Record<string, string>;
  copySpaces: Record<string, string>;
  placements: Record<string, string>;
  subjectPositions: Record<string, string>;
  foregroundOccluders: Record<string, string>;
  cameraAngles: Record<string, string>;
};
export type VideoAsset = { assetId: string; kind: "presenter" | "location" | "monitor"; entityId: string; filename: string; bytes: number; isDefault: boolean; scope?: "studio" | "project"; createdAt: number; profile: VideoAssetProfile; url: string };
export type VideoAssetRegistry = { version: number; entities: Record<"presenter" | "location" | "monitor", Record<string, string>>; profileOptions: VideoAssetProfileOptions; assets: VideoAsset[] };
export type VideoPromptReference = { referenceId: string; assetId: string; kind: "presenter" | "location" | "monitor"; entityId: string; label: string; originalFilename: string; downloadName: string; bytes: number; url: string };
export type VideoPromptSegment = { index: number; title: string; prompt: string; negativePrompt: string; referenceIds: string[]; referenceFiles: string[] };
export type VideoPromptPreview = { promptId: string; projectId: string; model: string; targetModel: VideoGenerationModel; generatedAt: number; projectSummary: string; directorialStrategy: string; references: VideoPromptReference[]; segments: VideoPromptSegment[]; fullPrompt: string; usage?: AvalaiUsage };
export type StudioDraft = {
  draftId: string;
  content: {
    title?: string;
    caption?: string;
    source?: string;
    titleOnly?: boolean;
  };
  brand: "kalametaze" | "golbahar" | "chenaran";
  format: {
    family?: string;
    template?: string;
    canvas?: "story_1080x1920" | "post_1080x1350";
    slideMode?: "single" | "multi_story" | "carousel";
    slideCount?: number;
  };
  uploadedImages?: Array<{ filename: string }>;
};
export type AvalaiUsage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  costIrt?: number;
  costVerified?: boolean;
  balanceIrt?: number;
  requestId?: string;
  model?: string;
};
export type JobOutput = {
  filename: string;
  mimeType: string;
  bytes: number;
  createdAt: number;
  attempt: number;
  revisedPrompt?: string;
  usage?: AvalaiUsage;
};
export type JobIntermediate = JobOutput & { kind: string };
export type DesignReference = {
  filename: string;
  bytes?: number;
  role?: string;
};
export type DesignJob = {
  requestId: string;
  title: string;
  brand: string;
  createdAt?: string;
  updatedAt?: string;
  state:
    | "queued"
    | "processing"
    | "cancel_requested"
    | "cancelled"
    | "completed"
    | "failed";
  attempt: number;
  outputs: JobOutput[];
  uploadedImages?: DesignReference[];
  intermediates?: JobIntermediate[];
  failureReason?: string;
  rawError?: string;
  errorCode?: string;
  lastEvent?: { at?: number; state?: string; message?: string };
  request?: Record<string, unknown>;
};
export type ContentArticle = {
  kicker?: string;
  title?: string;
  subtitle?: string;
  lead?: string;
  body?: string;
  source?: string;
  tags?: string;
  caption?: string;
};
export type ContentSlide = {
  kicker?: string;
  title: string;
  subtitle: string;
  body: string;
  footer: string;
  titleLayout?: "top" | "right_column" | "center" | "bottom";
  imageMode?: "generate" | "preserve" | "reference" | "studio" | "none";
  additionalInstructions?: string;
  imagePrompt?: string;
  referenceInstructions?: string;
  presenterIds?: string[];
  presenterReferenceSelection?: Record<string, ReferenceChoice>;
  /** Empty means inherit the image engine selected for the parent design. */
  imageEngine?: string;
  /** Optional per-slide Studio scene contract. Empty fields inherit the parent Studio settings. */
  studioLocationId?: string;
  studioLocationMode?: "catalog" | "generated_prompt" | "exact_reference" | "faithful_reference";
  studioLocationAssetIds?: string[];
  studioLocationPrompt?: string;
  studioLocationReferenceInstructions?: string;
  studioLocationReferences?: ReferenceChoice;
};
export type ContentMedia = {
  mediaId: string;
  filename: string;
  mimeType: string;
  bytes: number;
  kind: "image" | "video";
  createdAt: number;
  origin?: "upload" | "design";
  designRequestId?: string;
};
export type ContentReporterRun = {
  runId: string;
  at: number;
  profile: ReporterProfile;
  inputRevision: number;
  text: string;
  additionalInstructions?: string;
  channelJoinUrl?: string;
};
export type PublicationEvent = {
  at: number;
  event: string;
  target?: string;
  status?: "processing" | "published" | "partial" | "failed" | "uncertain";
  error?: string;
  sourceId?: string;
  mode?: string;
};
export type ContentPublication = {
  publicationId: string;
  idempotencyKey: string;
  kind: string;
  status: "processing" | "published" | "partial" | "failed" | "uncertain";
  createdAt: number;
  text?: string;
  targets?: string[];
  forwardPlan?: ForwardPlan;
  designRequestId?: string;
  mediaIds?: string[];
  featuredMediaId?: string;
  article?: ContentArticle;
  categoryIds?: number[];
  tagIds?: number[];
  newTags?: string[];
  categoryNames?: string;
  tagNames?: string;
  results: Array<{
    target: string;
    status: "published" | "failed" | "uncertain";
    error?: string;
    url?: string;
  }>;
  events?: PublicationEvent[];
};
export type ContentProject = {
  contentProjectId: string;
  ownerId: string;
  createdBy?: { id: string; name: string };
  brand: "kalametaze" | "golbahar" | "chenaran";
  state: "draft" | "preparing" | "ready" | "published" | "cancelled";
  category: "news" | "citizen" | "misc";
  source?: Record<string, string>;
  revision: number;
  title: string;
  rawText?: string;
  article?: ContentArticle;
  slides?: ContentSlide[];
  mediaCount: number;
  media?: ContentMedia[];
  designProjectCount: number;
  designProjects?: Array<{
    requestId: string;
    title?: string;
    attachedAt?: number;
  }>;
  publicationCount: number;
  publicationRequests?: ContentPublication[];
  reporterRuns?: ContentReporterRun[];
  createdAt: string;
  updatedAt: string;
  revisions?: Array<{
    revision: number;
    at: number;
    kind: string;
    message: string;
    rawText?: string;
    article?: ContentArticle;
    slides?: ContentSlide[];
  }>;
  audit?: Array<{ at: number; kind: string; message: string }>;
  notes?: Array<{ id: string; at: number; text: string; by: string; author: string; parentNoteId?: string; mentions?: string[] }>;
};
export type PublicationTarget =
  | "telegram_kalam"
  | "telegram_golbahar"
  | "telegram_chenaran"
  | "eita_kalam"
  | "eita_golbahar"
  | "eita_chenaran"
  | "rubika_kalam"
  | "rubika_golbahar"
  | "rubika_chenaran"
  | "bale_kalam"
  | "bale_golbahar"
  | "bale_chenaran";
export type VideoPlatformTarget = "youtube" | "aparat";
export type MediaPublicationTarget = PublicationTarget | VideoPlatformTarget;
export type ForwardPlan = Partial<
  Record<
    "telegram" | "eita" | "rubika" | "bale",
    { mode: "separate" | "forward"; sourceTarget?: PublicationTarget }
  >
>;
export type PublicationResult = {
  publicationId: string;
  idempotencyKey: string;
  status: "processing" | "published" | "partial" | "failed" | "uncertain";
  results: Array<{
    target: string;
    status: "published" | "failed" | "uncertain";
    error?: string;
    url?: string;
  }>;
  events?: PublicationEvent[];
};

const DESIGN_API_URL = "/studio/api/design-requests";

function gatewayUrl(path: string): string | undefined {
  const endpoint = DESIGN_API_URL;
  return endpoint?.replace(/\/design-requests$/, path);
}

async function gatewayForm(
  path: string,
  telegramInitData: string | undefined,
  fields: Record<string, string>,
) {
  const endpoint = gatewayUrl(path);
  if (!endpoint) return undefined;
  const body = new FormData();
  body.append("telegramInitData", telegramInitData ?? "");
  Object.entries(fields).forEach(([name, value]) => body.append(name, value));
  const response = await fetch(endpoint, {
    method: "POST",
    body,
    credentials: "same-origin",
  });
  if (!response.ok) {
    const detail = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(detail.error ?? "دسترسی به تنظیمات انجام نشد.");
  }
  return response.json();
}

export async function clubAdminRequest<T>(
  telegramInitData: string | undefined,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  payload: Record<string, unknown> = {},
) {
  return gatewayForm("/club/admin", telegramInitData, {
    method,
    path,
    payload: JSON.stringify(payload),
  }) as Promise<T | undefined>;
}

export type ClubAdminMedia = {
  id: string;
  filename: string;
  contentType: string;
  bytes: number;
  status: string;
  createdAt: string;
};

function imageDataBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("خواندن تصویر ناموفق بود."));
    reader.onload = () => {
      const value = String(reader.result ?? "");
      const delimiter = value.indexOf(",");
      if (delimiter < 0) {
        reject(new Error("دادهٔ تصویر معتبر نیست."));
        return;
      }
      resolve(value.slice(delimiter + 1));
    };
    reader.readAsDataURL(file);
  });
}

export async function uploadClubAdminImage(
  telegramInitData: string | undefined,
  file: File,
  purpose: "partner_logo" | "reward_image" | "campaign_banner",
) {
  const supported = ["image/jpeg", "image/png", "image/webp"];
  if (!supported.includes(file.type))
    throw new Error("برای لوگو و تصویر جایزه فقط JPG، PNG و WebP مجاز است.");
  if (file.size <= 0 || file.size > 4 * 1024 * 1024)
    throw new Error("حجم تصویر باید حداکثر ۴ مگابایت باشد.");
  return clubAdminRequest<{
    attachment: ClubAdminMedia;
    scanStatus: "pending";
  }>(telegramInitData, "POST", "/api/admin/media", {
    filename: file.name,
    content_type: file.type,
    data_base64: await imageDataBase64(file),
    purpose,
  });
}

export async function getClubAiSuggestion(
  telegramInitData: string | undefined,
  incomingText: string,
  instruction = "",
) {
  return gatewayForm("/club/ai-suggestion", telegramInitData, {
    incomingText,
    instruction,
  }) as Promise<{ suggestion: string } | undefined>;
}

export async function getAccessSession(telegramInitData: string | undefined) {
  return gatewayForm("/session", telegramInitData, {}) as Promise<
    { userId: string; access: string } | undefined
  >;
}

export async function getWebSession() {
  try {
    return (await gatewayForm("/web/session", undefined, {})) as
      | { userId: string; access: string; username: string; auth: "web" }
      | undefined;
  } catch {
    return undefined;
  }
}

export async function loginWeb(
  username: string,
  password: string,
  remember = false,
) {
  return gatewayForm("/web/login", undefined, {
    username,
    password,
    remember: String(remember),
  }) as Promise<
    | { userId: string; access: string; username: string; auth: "web" }
    | undefined
  >;
}

export async function requestWebLoginOtp(phone: string) {
  return gatewayForm("/web/otp/request", undefined, { phone }) as Promise<
    { sent: boolean; expiresIn: number } | undefined
  >;
}

export async function verifyWebLoginOtp(
  phone: string,
  code: string,
  remember = false,
) {
  return gatewayForm("/web/otp/verify", undefined, {
    phone,
    code,
    remember: String(remember),
  }) as Promise<
    | { userId: string; access: string; username: string; auth: "sms" }
    | undefined
  >;
}

export async function logoutWeb() {
  return gatewayForm("/web/logout", undefined, {}) as Promise<
    { loggedOut: boolean } | undefined
  >;
}

export async function getStudioDraft(
  telegramInitData: string | undefined,
  draftId: string,
) {
  return gatewayForm("/drafts/get", telegramInitData, { draftId }) as Promise<
    { draft: StudioDraft } | undefined
  >;
}

export async function previewDesignPrompt(
  telegramInitData: string | undefined,
  request: Record<string, unknown>,
  images: File[] = [],
  puzzleImages: File[] = [],
  monitorImages: File[] = [],
) {
  const endpoint = gatewayUrl("/design-prompts/preview");
  if (!endpoint) return undefined;
  const body = new FormData();
  body.append("telegramInitData", telegramInitData ?? "");
  body.append("request", JSON.stringify(request));
  images.forEach((file) => body.append("images", file, file.name));
  puzzleImages.forEach((file) => body.append("puzzleImages", file, file.name));
  monitorImages.forEach((file) => body.append("monitorImages", file, file.name));
  const response = await fetch(endpoint, {
    method: "POST",
    body,
    credentials: "same-origin",
  });
  if (!response.ok) {
    const detail = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(detail.error ?? "ساخت پرامپت انجام نشد.");
  }
  return response.json() as Promise<DesignPromptPreview>;
}

async function getDesignPromptFile(
  telegramInitData: string | undefined,
  path: "preview-asset" | "preview-bundle",
  fields: Record<string, string>,
) {
  const endpoint = gatewayUrl(`/design-prompts/${path}`);
  if (!endpoint) return undefined;
  const body = new FormData();
  body.append("telegramInitData", telegramInitData ?? "");
  Object.entries(fields).forEach(([key, value]) => body.append(key, value));
  const response = await fetch(endpoint, { method: "POST", body, credentials: "same-origin" });
  if (!response.ok) {
    const detail = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(detail.error ?? "دریافت فایل‌های پرامپت انجام نشد.");
  }
  return response.blob();
}

export function getDesignPromptAsset(
  telegramInitData: string | undefined,
  packageId: string,
  filename: string,
) {
  return getDesignPromptFile(telegramInitData, "preview-asset", { packageId, filename });
}

export function getDesignPromptBundle(
  telegramInitData: string | undefined,
  packageId: string,
) {
  return getDesignPromptFile(telegramInitData, "preview-bundle", { packageId });
}

export async function previewDesignCaption(
  telegramInitData: string | undefined,
  request: Record<string, unknown>,
) {
  return gatewayForm("/design-captions/preview", telegramInitData, {
    request: JSON.stringify(request),
  }) as Promise<
    | { caption: string; title: string; brand: string; template: string }
    | undefined
  >;
}
export async function getDesignStorySummary(
  telegramInitData: string | undefined,
  requestId: string,
) {
  return gatewayForm("/design-story-summary", telegramInitData, { requestId }) as Promise<
    { requestId: string; summary: string } | undefined
  >;
}
export async function manageEngagementPersonas(
  telegramInitData: string | undefined,
  action: "list" | "save",
  personas: EngagementPersona[] = [],
) {
  return gatewayForm("/engagement/personas", telegramInitData, {
    action,
    personas: JSON.stringify({ personas }),
  }) as Promise<{ version: number; personas: EngagementPersona[] } | undefined>;
}
export async function uploadEngagementRuleAttachment(
  telegramInitData: string | undefined,
  accountId: string,
  file: File,
  onProgress?: (loaded: number, total: number) => void,
) {
  const endpoint = gatewayUrl("/engagement/rule-attachment");
  if (!endpoint) return undefined;
  const body = new FormData();
  body.append("telegramInitData", telegramInitData ?? "");
  body.append("accountId", accountId);
  body.append("file", file, file.name);
  return new Promise<{ attachment: { attachmentId: string; filename: string; name: string; mimeType: string; kind: "image" | "video" | "audio" | "file"; url: string } }>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", endpoint);
    request.withCredentials = true;
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded, event.total);
    };
    request.onerror = () => reject(new Error("ارتباط هنگام بارگذاری فایل همراه قطع شد."));
    request.onload = () => {
      let payload: { attachment?: { attachmentId: string; filename: string; name: string; mimeType: string; kind: "image" | "video" | "audio" | "file"; url: string }; error?: string } = {};
      try { payload = JSON.parse(request.responseText) as typeof payload; } catch { /* handled below */ }
      if (request.status < 200 || request.status >= 300 || !payload.attachment) {
        reject(new Error(payload.error ?? "بارگذاری فایل همراه ناموفق بود."));
        return;
      }
      resolve({ attachment: payload.attachment });
    };
    request.send(body);
  });
}

export async function setEngagementStoryContext(
  telegramInitData: string | undefined,
  accountId: string,
  mediaId: string,
  context: string,
) {
  return gatewayForm("/engagement/story-context", telegramInitData, {
    accountId,
    mediaId,
    context,
  }) as Promise<{ context: string; updated: number } | undefined>;
}

export async function getStudioDraftOutput(
  telegramInitData: string | undefined,
  draftId: string,
  filename: string,
) {
  const endpoint = gatewayUrl("/drafts/output");
  if (!endpoint) return undefined;
  const body = new FormData();
  body.append("telegramInitData", telegramInitData ?? "");
  body.append("draftId", draftId);
  body.append("filename", filename);
  const response = await fetch(endpoint, { method: "POST", body });
  if (!response.ok) throw new Error("نمایش تصویر مرجع ممکن نشد.");
  return response.blob();
}

export async function manageAccess(
  telegramInitData: string | undefined,
  action: "list" | "add" | "approve" | "reject" | "revoke" | "set_contact",
  chatId = "",
  workPhone = "",
) {
  return gatewayForm("/settings/access", telegramInitData, {
    action,
    chatId,
    workPhone,
  }) as Promise<AccessView | undefined>;
}

export async function manageWebAccount(
  telegramInitData: string | undefined,
  action: "provision" | "disable",
  chatId: string,
  username = "",
  password = "",
) {
  return gatewayForm("/settings/web-accounts", telegramInitData, {
    action,
    chatId,
    username,
    password,
  }) as Promise<
    | { access: AccessView }
    | undefined
  >;
}

export async function listProjects(telegramInitData: string | undefined) {
  return gatewayForm("/library/projects", telegramInitData, {}) as Promise<
    { projects: LibraryProject[] } | undefined
  >;
}

export async function createContentProject(
  telegramInitData: string | undefined,
  project: {
    contentProjectId?: string;
    brand: ContentProject["brand"];
    rawText?: string;
    article?: ContentArticle;
    slides?: ContentSlide[];
    category?: ContentProject["category"];
    source?: Record<string, string>;
  },
) {
  return gatewayForm("/content-projects/create", telegramInitData, {
    project: JSON.stringify(project),
  }) as Promise<{ project: ContentProject; duplicate: boolean } | undefined>;
}

export async function listContentProjects(
  telegramInitData: string | undefined,
) {
  return gatewayForm("/content-projects/list", telegramInitData, {}) as Promise<
    { projects: ContentProject[] } | undefined
  >;
}

export async function getContentProject(
  telegramInitData: string | undefined,
  contentProjectId: string,
) {
  return gatewayForm("/content-projects/get", telegramInitData, {
    contentProjectId,
  }) as Promise<{ project: ContentProject } | undefined>;
}

export async function updateContentProject(
  telegramInitData: string | undefined,
  contentProjectId: string,
  changes: {
    brand?: ContentProject["brand"];
    rawText?: string;
    article?: ContentArticle;
    slides?: ContentSlide[];
    state?: ContentProject["state"];
    category?: ContentProject["category"];
    note?: string | { text: string; parentNoteId?: string; mentions?: string[] };
  },
) {
  return gatewayForm("/content-projects/update", telegramInitData, {
    contentProjectId,
    changes: JSON.stringify(changes),
  }) as Promise<{ project: ContentProject; changed: boolean } | undefined>;
}

export async function archiveEngagementContent(
  telegramInitData: string | undefined,
  eventIds: string | string[],
  category: "citizen" | "misc" = "citizen",
) {
  return gatewayForm("/content-projects/archive-engagement", telegramInitData, {
    eventId: Array.isArray(eventIds) ? "" : eventIds,
    eventIds: JSON.stringify(Array.isArray(eventIds) ? eventIds : [eventIds]),
    category,
  }) as Promise<{ project: ContentProject; duplicate: boolean } | undefined>;
}

export async function manageBrowserNotifications(
  telegramInitData: string | undefined,
  action: "status" | "subscribe" | "unsubscribe" | "preferences",
  values: { subscription?: PushSubscriptionJSON; endpoint?: string; preferences?: Record<string, unknown> } = {},
) {
  return gatewayForm("/notifications/subscription", telegramInitData, {
    action,
    subscription: JSON.stringify(values.subscription ?? {}),
    endpoint: values.endpoint ?? "",
    preferences: JSON.stringify(values.preferences ?? {}),
  }) as Promise<{ supported: boolean; publicKey?: string; subscribed?: boolean; preferences?: { clubContent: boolean; clubMessage: boolean; designComplete: boolean; newsSubject: boolean; instagramAccounts: string[] } } | undefined>;
}

export async function sendContentTeamSms(
  telegramInitData: string | undefined,
  contentProjectId: string,
  recipientIds: string[],
  text: string,
) {
  return gatewayForm("/content-projects/team-sms", telegramInitData, {
    contentProjectId,
    recipientIds: JSON.stringify(recipientIds),
    text,
  }) as Promise<{ delivered?: number; recipients?: number[] } | undefined>;
}

export async function archiveClubContent(
  telegramInitData: string | undefined,
  selections: { messageIds?: string[]; submissionIds?: string[] },
  category: "citizen" | "misc" = "citizen",
) {
  return gatewayForm("/content-projects/archive-club", telegramInitData, {
    messageIds: JSON.stringify(selections.messageIds ?? []),
    submissionIds: JSON.stringify(selections.submissionIds ?? []),
    category,
  }) as Promise<{ project: ContentProject; mediaCount: number } | undefined>;
}

export async function deleteContentProject(telegramInitData: string | undefined, contentProjectId: string) {
  return gatewayForm("/content-projects/delete", telegramInitData, { contentProjectId }) as Promise<{ deleted: string } | undefined>;
}

export async function attachDesignToContentProject(
  telegramInitData: string | undefined,
  contentProjectId: string,
  designRequestId: string,
) {
  return gatewayForm("/content-projects/attach-design", telegramInitData, {
    contentProjectId,
    designRequestId,
  }) as Promise<{ project: ContentProject } | undefined>;
}

/** Copies the immutable final studio output into the project's normal media tray.
 * Removing that tray item never deletes the original design project. */
export async function importDesignOutputToContentProject(
  telegramInitData: string | undefined,
  contentProjectId: string,
  designRequestId: string,
) {
  return gatewayForm(
    "/content-projects/import-design-output",
    telegramInitData,
    { contentProjectId, designRequestId },
  ) as Promise<
    | { project: ContentProject; media: ContentMedia; duplicate: boolean }
    | undefined
  >;
}

export type UploadTransferProgress = {
  loaded: number;
  total: number;
  stage: "uploading" | "securing";
};

/**
 * Uses XMLHttpRequest deliberately: fetch does not expose request-upload
 * progress in browsers. Each caller can therefore show a truthful, per-file
 * transfer bar before the server starts its S3 verification step.
 */
export async function uploadContentMedia(
  telegramInitData: string | undefined,
  contentProjectId: string,
  files: File[],
  onProgress?: (progress: UploadTransferProgress) => void,
) {
  const endpoint = gatewayUrl("/content-projects/upload-media");
  if (!endpoint) return undefined;
  const body = new FormData();
  body.append("telegramInitData", telegramInitData ?? "");
  body.append("contentProjectId", contentProjectId);
  files.forEach((file) => body.append("media", file, file.name));
  return new Promise<{ project: ContentProject; media: ContentMedia[] }>(
    (resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open("POST", endpoint, true);
      request.withCredentials = true;
      // A large video can legitimately spend a few minutes on the gateway while
      // it is written and mirrored to S3. A finite timeout still prevents an
      // invisible, permanent waiting state.
      request.timeout = 15 * 60 * 1000;
      request.upload.onprogress = (event) => {
        if (event.lengthComputable)
          onProgress?.({
            loaded: event.loaded,
            total: event.total,
            stage: "uploading",
          });
      };
      request.upload.onload = () =>
        onProgress?.({ loaded: 1, total: 1, stage: "securing" });
      request.onerror = () =>
        reject(
          new Error("ارتباط هنگام بارگذاری فایل قطع شد. دوباره تلاش کنید."),
        );
      request.ontimeout = () =>
        reject(
          new Error(
            "ذخیرهٔ فایل بیش از حد طول کشید؛ اتصال و حجم فایل را بررسی کنید.",
          ),
        );
      request.onabort = () => reject(new Error("بارگذاری فایل لغو شد."));
      request.onload = () => {
        let payload: {
          project?: ContentProject;
          media?: ContentMedia[];
          error?: string;
        } = {};
        try {
          payload = JSON.parse(request.responseText || "{}") as typeof payload;
        } catch {
          /* handled below */
        }
        if (
          request.status < 200 ||
          request.status >= 300 ||
          !payload.project ||
          !payload.media
        ) {
          reject(
            new Error(payload.error ?? "بارگذاری فایل‌های انتشار ناموفق بود."),
          );
          return;
        }
        resolve({ project: payload.project, media: payload.media });
      };
      request.send(body);
    },
  );
}

export async function deleteContentMedia(
  telegramInitData: string | undefined,
  contentProjectId: string,
  mediaId: string,
) {
  return gatewayForm("/content-projects/delete-media", telegramInitData, {
    contentProjectId,
    mediaId,
  }) as Promise<{ project: ContentProject; deleted: string } | undefined>;
}

export async function compressContentVideo(
  telegramInitData: string | undefined,
  contentProjectId: string,
  mediaId: string,
  targets: PublicationTarget[],
) {
  return gatewayForm("/content-projects/compress-video", telegramInitData, {
    contentProjectId,
    mediaId,
    targets: JSON.stringify(targets),
  }) as Promise<
    | {
        project: ContentProject;
        media: ContentMedia;
        alreadyCompatible: boolean;
        targetBytes: number;
      }
    | undefined
  >;
}

export async function getContentMediaOutput(
  telegramInitData: string | undefined,
  contentProjectId: string,
  mediaId: string,
) {
  const endpoint = gatewayUrl("/content-projects/media-output");
  if (!endpoint) return undefined;
  const body = new FormData();
  body.append("telegramInitData", telegramInitData ?? "");
  body.append("contentProjectId", contentProjectId);
  body.append("mediaId", mediaId);
  const response = await fetch(endpoint, {
    method: "POST",
    body,
    credentials: "same-origin",
  });
  if (!response.ok) throw new Error("نمایش فایل انتشار ممکن نشد.");
  return response.blob();
}

export type ReporterProfile =
  | "extract"
  | "citizen_clean"
  | "citizen_short"
  | "citizen_report"
  | "post"
  | "channel"
  | "story"
  | "multi_story"
  | "citizen_multi_story"
  | "admin_multi_story"
  | "site"
  | "reel"
  | "scenario"
  | "carousel"
  | "titles"
  | "analysis"
  | "infographic_data"
  | "channel_teaser";
export async function runContentReporter(
  telegramInitData: string | undefined,
  contentProjectId: string,
  profile: ReporterProfile,
  rawText = "",
  additionalInstructions = "",
  channelJoinUrl = "",
  webResearch = false,
) {
  return gatewayForm("/content-projects/run-reporter", telegramInitData, {
    contentProjectId,
    profile,
    rawText,
    additionalInstructions,
    channelJoinUrl,
    webResearch: webResearch ? "true" : "false",
  }) as Promise<
    | {
        runId: string;
        profile: ReporterProfile;
        text: string;
        usage?: AvalaiUsage;
        article?: ContentArticle;
        slides?: ContentSlide[];
        webResearch?: {
          query: string;
          provider: string;
          searchedAt: number;
          sources: Array<{ title: string; url: string; publisher: string; publishedAt: string }>;
        };
        project: ContentProject;
      }
    | undefined
  >;
}

export async function publishContentText(
  telegramInitData: string | undefined,
  contentProjectId: string,
  text: string,
  targets: PublicationTarget[],
  idempotencyKey: string,
  forwardPlan: ForwardPlan = {},
) {
  return gatewayForm("/content-projects/publish-text", telegramInitData, {
    contentProjectId,
    text,
    targets: JSON.stringify(targets),
    idempotencyKey,
    forwardPlan: JSON.stringify(forwardPlan),
  }) as Promise<
    | {
        publication: PublicationResult;
        project: ContentProject;
        duplicate: boolean;
      }
    | undefined
  >;
}
export async function publishContentPhoto(
  telegramInitData: string | undefined,
  contentProjectId: string,
  designRequestId: string,
  mediaIds: string[],
  text: string,
  targets: MediaPublicationTarget[],
  idempotencyKey: string,
  forwardPlan: ForwardPlan = {},
) {
  return gatewayForm("/content-projects/publish-media", telegramInitData, {
    contentProjectId,
    designRequestId,
    mediaIds: JSON.stringify(mediaIds),
    text,
    targets: JSON.stringify(targets),
    idempotencyKey,
    forwardPlan: JSON.stringify(forwardPlan),
  }) as Promise<
    | {
        publication: PublicationResult;
        project: ContentProject;
        duplicate: boolean;
      }
    | undefined
  >;
}
export async function publishContentSite(
  telegramInitData: string | undefined,
  contentProjectId: string,
  designRequestId: string,
  featuredMediaId: string,
  article: ContentArticle,
  categoryIds: number[] = [],
  tagIds: number[] = [],
  newTags: string[] = [],
  idempotencyKey: string,
  galleryMediaIds: string[] = [],
  categoryNames = "",
  tagNames = "",
) {
  return gatewayForm("/content-projects/publish-site", telegramInitData, {
    contentProjectId,
    designRequestId,
    featuredMediaId,
    title: article.title ?? "",
    body: article.body ?? "",
    kicker: article.kicker ?? "",
    lead: article.lead ?? "",
    source: article.source ?? "",
    categoryIds: JSON.stringify(categoryIds),
    tagIds: JSON.stringify(tagIds),
    newTags: JSON.stringify(newTags),
    galleryMediaIds: JSON.stringify(galleryMediaIds),
    idempotencyKey,
    categoryNames,
    tagNames,
  }) as Promise<
    | {
        publication: PublicationResult;
        project: ContentProject;
        duplicate: boolean;
      }
    | undefined
  >;
}
export async function getSitePublishSuggestion(
  telegramInitData: string | undefined,
  contentProjectId: string,
  rawText = "",
) {
  return gatewayForm("/content-projects/site-suggest", telegramInitData, {
    contentProjectId,
    rawText,
  }) as Promise<
    | {
        article: ContentArticle;
        categories: Array<{ id: number; name: string }>;
        tags: Array<{ id: number; name: string }>;
        newTags: string[];
        availableCategories: Array<{ id: number; name: string }>;
      }
    | undefined
  >;
}
export async function getSitePublishTerms(
  telegramInitData: string | undefined,
  taxonomy: "categories" | "tags",
  search = "",
) {
  return gatewayForm("/content-projects/site-terms", telegramInitData, {
    taxonomy,
    search,
  }) as Promise<
    | {
        taxonomy: "categories" | "tags";
        search: string;
        items: Array<{ id: number; name: string; slug?: string }>;
      }
    | undefined
  >;
}

export async function managePrompts(
  telegramInitData: string | undefined,
  action: "list" | "update",
  promptId = "",
  content = "",
) {
  return gatewayForm("/settings/prompts", telegramInitData, {
    action,
    promptId,
    content,
  }) as Promise<{ prompts: PromptItem[] } | undefined>;
}

export async function startAudioTranscription(
  telegramInitData: string | undefined,
  contentProjectId: string,
  model: string,
  files: File[],
  onProgress?: (progress: UploadTransferProgress) => void,
) {
  const endpoint = gatewayUrl("/content-projects/upload-media");
  if (!endpoint) return undefined;
  const body = new FormData();
  body.append("telegramInitData", telegramInitData ?? "");
  body.append("action", "transcribe");
  body.append("contentProjectId", contentProjectId);
  body.append("model", model);
  files.forEach((file) => body.append("audio", file, file.name));
  return new Promise<{ job: AudioTranscriptionJob; project: ContentProject }>((resolve, reject) => {
    const request = new XMLHttpRequest(); request.open("POST", endpoint, true); request.withCredentials = true; request.timeout = 30 * 60 * 1000;
    request.upload.onprogress = (event) => { if (event.lengthComputable) onProgress?.({ loaded: event.loaded, total: event.total, stage: "uploading" }); };
    request.upload.onload = () => onProgress?.({ loaded: 1, total: 1, stage: "securing" });
    request.onerror = () => reject(new Error("ارتباط هنگام ارسال فایل صوتی قطع شد؛ فایلِ ذخیره‌شده در سرور قابل پیگیری است."));
    request.ontimeout = () => reject(new Error("ارسال فایل صوتی بیش از حد طول کشید؛ از آرشیو پروژه وضعیت آن را بررسی کنید."));
    request.onload = () => {
      let payload: { job?: AudioTranscriptionJob; project?: ContentProject; error?: string } = {};
      try { payload = JSON.parse(request.responseText || "{}") as typeof payload; } catch { /* handled below */ }
      if (request.status < 200 || request.status >= 300 || !payload.job || !payload.project) return reject(new Error(payload.error ?? "ثبت تبدیل صوت ناموفق بود."));
      resolve({ job: payload.job, project: payload.project });
    };
    request.send(body);
  });
}

export async function getAudioTranscription(telegramInitData: string | undefined, jobId: string) {
  return gatewayForm("/content-projects/upload-media", telegramInitData, { action: "transcription-status", jobId }) as Promise<{ job: AudioTranscriptionJob; project: ContentProject } | undefined>;
}

export async function manageImageModel(
  telegramInitData: string | undefined,
  action: "get" | "save",
  defaultModel = "",
) {
  return gatewayForm("/settings/image-model", telegramInitData, {
    action,
    defaultModel,
  }) as Promise<ImageModelSettings | undefined>;
}

export async function manageTextModels(
  telegramInitData: string | undefined,
  action: "get" | "save",
  editorialModel = "",
  replyModel = "",
  analysisModel = "",
  videoPromptModel = "",
) {
  return gatewayForm("/settings/text-models", telegramInitData, {
    action,
    editorialModel,
    replyModel,
    analysisModel,
    videoPromptModel,
  }) as Promise<TextModelSettings | undefined>;
}

export async function manageVoiceModels(
  telegramInitData: string | undefined,
  action: "get" | "save",
  defaultVoiceEngine = "",
  defaultVoice = "",
) {
  return gatewayForm("/settings/text-models", telegramInitData, {
    action: action === "get" ? "voice_get" : "voice_save",
    defaultVoiceEngine,
    defaultVoice,
  }) as Promise<VoiceModelSettings | undefined>;
}

export async function manageTranscriptionModels(telegramInitData: string | undefined, action: "get" | "save", defaultTranscriptionModel = "") {
  return gatewayForm("/settings/text-models", telegramInitData, {
    action: action === "get" ? "transcription_get" : "transcription_save",
    defaultTranscriptionModel,
  }) as Promise<TranscriptionModelSettings | undefined>;
}

export async function manageEngagementAccounts(
  telegramInitData: string | undefined,
  action:
    | "list"
    | "sync"
    | "connect-url"
    | "club"
    | "save-connection"
    | "delete-connection",
  values: {
    connectionId?: string;
    name?: string;
    apiKey?: string;
    baseUrl?: string;
    enabled?: boolean;
    mode?: string;
  } = {},
) {
  return gatewayForm("/engagement/accounts", telegramInitData, {
    action,
    connectionId: values.connectionId ?? "",
    name: values.name ?? "",
    apiKey: values.apiKey ?? "",
    baseUrl: values.baseUrl ?? "",
    enabled: String(values.enabled ?? false),
    mode: values.mode ?? "approval",
  }) as Promise<
    | {
        connections: EngagementConnection[];
        accounts: EngagementAccount[];
        configured: boolean;
        webhookConfigured: boolean;
        connectUrl?: string;
        club?: { enabled: boolean; mode: string };
      }
    | undefined
  >;
}
export async function getEngagementInbox(
  telegramInitData: string | undefined,
  accountIds: string[] = [],
  eventTypes: string[] = [],
  status = "all",
  limit = 300,
  before = 0,
  tags: string[] = [],
) {
  const payload: Record<string, string> = {
    accountIds: accountIds.join(","),
    eventTypes: eventTypes.join(","),
    status,
    limit: String(limit),
    tags: tags.join(","),
  };
  if (before > 0) payload.before = String(before);
  const response = (await gatewayForm("/engagement/inbox", telegramInitData, payload)) as { items: EngagementInboxItem[]; hasMore?: boolean; nextCursor?: number } | undefined;
  if (!response?.items) return response;
  // Old WebView state can briefly contain a Lookaside/CDN URL from a prior
  // release. Those URLs expire and cause long failed requests; only our
  // durable signed media endpoint is safe to render.
  const safeMediaUrl = (value: string | undefined) => {
    if (!value) return "";
    try {
      const parsed = new URL(value, window.location.origin);
      return parsed.origin === window.location.origin && parsed.pathname.includes("/engagement/media")
        ? value
        : "";
    } catch {
      return "";
    }
  };
  return {
    ...response,
    items: response.items.map((item) => ({
      ...item,
      mediaUrl: safeMediaUrl(item.mediaUrl),
      mediaThumbnail: safeMediaUrl(item.mediaThumbnail),
      senderProfilePhoto: safeMediaUrl(item.senderProfilePhoto),
    })),
  };
}

export async function getEngagementThread(
  telegramInitData: string | undefined,
  eventId: string,
  kind: "conversation" | "post",
  limit = 100,
  before = 0,
) {
  const payload: Record<string, string> = {
    view: "thread",
    eventId,
    kind,
    limit: String(limit),
  };
  if (before > 0) payload.before = String(before);
  const response = (await gatewayForm("/engagement/inbox", telegramInitData, payload)) as
    | { items: EngagementInboxItem[]; total?: number; incomingTotal?: number; hasMore?: boolean; nextCursor?: number }
    | undefined;
  if (!response?.items) return response;
  const safeMediaUrl = (value: string | undefined) => {
    if (!value) return "";
    try {
      const parsed = new URL(value, window.location.origin);
      return parsed.origin === window.location.origin && parsed.pathname.includes("/engagement/media") ? value : "";
    } catch {
      return "";
    }
  };
  return {
    ...response,
    items: response.items.map((item) => ({
      ...item,
      mediaUrl: safeMediaUrl(item.mediaUrl),
      mediaThumbnail: safeMediaUrl(item.mediaThumbnail),
      senderProfilePhoto: safeMediaUrl(item.senderProfilePhoto),
    })),
  };
}

export type EngagementSalesIntegration = {
  enabled: boolean;
  configured: boolean;
  tested?: boolean;
  fieldCount?: number;
  personaCount?: number;
};
export type EngagementLeadDraft = {
  title: string;
  status: "new";
  business_name: string;
  lead_type: string;
  success_probability: number;
  source: string;
  industry: string;
  customer_interests: string[];
  city: string;
  province: string;
  address: string;
  mobile: string;
  first_name: string;
  last_name: string;
  notes: string;
  attachments?: Array<{ eventId: string; url?: string; mediaType?: string; caption?: string }>;
};

export async function manageEngagementSalesIntegration(
  telegramInitData: string | undefined,
  action: "list" | "save" | "test",
  values: { apiToken?: string; enabled?: boolean } = {},
) {
  return gatewayForm("/engagement/sales-integration", telegramInitData, {
    action,
    apiToken: values.apiToken ?? "",
    enabled: String(values.enabled ?? false),
  }) as Promise<EngagementSalesIntegration | undefined>;
}
export async function getEngagementLeadDraft(
  telegramInitData: string | undefined,
  eventId: string,
) {
  return gatewayForm("/engagement/sales-lead", telegramInitData, {
    action: "draft",
    eventId,
  }) as Promise<{ draft: EngagementLeadDraft; historyCount: number } | undefined>;
}
export async function createEngagementLead(
  telegramInitData: string | undefined,
  eventId: string,
  draft: EngagementLeadDraft,
) {
  return gatewayForm("/engagement/sales-lead", telegramInitData, {
    action: "create",
    eventId,
    lead: JSON.stringify(draft),
  }) as Promise<{ leadId: string; draft: EngagementLeadDraft } | undefined>;
}
export async function markEngagementRead(
  telegramInitData: string | undefined,
  eventIds: string[],
) {
  return gatewayForm("/engagement/read", telegramInitData, {
    eventIds: JSON.stringify(eventIds),
  }) as Promise<{ updated: number } | undefined>;
}
export async function manageEngagementRules(
  telegramInitData: string | undefined,
  action: "list" | "save" | "delete",
  rule?: Partial<EngagementRule>,
  ruleId = "",
) {
  return gatewayForm("/engagement/rules", telegramInitData, {
    action,
    rule: JSON.stringify(rule ?? {}),
    ruleId,
  }) as Promise<{ rules: EngagementRule[] } | undefined>;
}
export async function replyEngagementInbox(
  telegramInitData: string | undefined,
  eventId: string,
  text: string,
) {
  return gatewayForm("/engagement/reply", telegramInitData, {
    eventId,
    text,
  }) as Promise<
    { item: EngagementInboxItem; source: EngagementInboxItem } | undefined
  >;
}
export async function requestEngagementProfile(
  telegramInitData: string | undefined,
  eventId: string,
) {
  return gatewayForm("/engagement/profile", telegramInitData, {
    eventId,
  }) as Promise<{ requested: boolean } | undefined>;
}
export async function setEngagementTags(
  telegramInitData: string | undefined,
  eventId: string,
  tags: string[],
) {
  return gatewayForm("/engagement/tags", telegramInitData, {
    eventId,
    tags: tags.join(","),
  }) as Promise<{ tags: string[]; catalog?: string[]; items: EngagementInboxItem[] } | undefined>;
}
export async function manageEngagementTagCatalog(
  telegramInitData: string | undefined,
  action: "catalog" | "create" | "rename" | "delete",
  tag = "",
  newTag = "",
) {
  return gatewayForm("/engagement/tags", telegramInitData, {
    action,
    tag,
    newTag,
  }) as Promise<{ tags: string[] } | undefined>;
}
export async function manageEngagementKnowledge(
  telegramInitData: string | undefined,
  action: "list" | "save" | "optimize" | "sync-site",
  knowledge?: EngagementKnowledge,
) {
  return gatewayForm("/engagement/knowledge", telegramInitData, {
    action,
    knowledge: JSON.stringify(knowledge ?? {}),
  }) as Promise<
    | {
        knowledge: EngagementKnowledge;
        personas?: { version: number; personas: EngagementPersona[] };
        siteCache: {
          fetchedAt?: number;
          url?: string;
          articles?: Array<{ title: string; url: string }>;
        };
      }
    | undefined
  >;
}
export async function getEngagementAiSuggestion(
  telegramInitData: string | undefined,
  eventId: string,
  instruction = "",
  character: "none" | "kamran" | "tara" = "none",
) {
  return gatewayForm("/engagement/ai-suggestion", telegramInitData, {
    eventId,
    instruction,
    character,
  }) as Promise<{ eventId: string; suggestion: string } | undefined>;
}
export async function manageEngagementShowcases(
  telegramInitData: string | undefined,
  action: "list" | "save" | "delete" | "send",
  showcase?: Partial<EngagementShowcase>,
  eventId = "",
) {
  return gatewayForm("/engagement/showcases", telegramInitData, {
    action,
    showcase: JSON.stringify(showcase ?? {}),
    showcaseId: showcase?.showcaseId ?? "",
    eventId,
  }) as Promise<{ showcases?: EngagementShowcase[]; item?: EngagementInboxItem; source?: EngagementInboxItem } | undefined>;
}
export type EngagementBulkAnswer = { eventId: string; text: string };
export async function bulkReplyEngagementComments(
  telegramInitData: string | undefined,
  values: {
    action: "prepare" | "send";
    eventIds: string[];
    mode?:
      | "thanks"
      | "emoji_thanks"
      | "emoji_laugh"
      | "emoji_sad"
      | "emoji_think"
      | "ai";
    instruction?: string;
    answers?: EngagementBulkAnswer[];
  },
) {
  return gatewayForm("/engagement/bulk-reply", telegramInitData, {
    action: values.action,
    eventIds: JSON.stringify(values.eventIds),
    mode: values.mode ?? "thanks",
    instruction: values.instruction ?? "",
    answers: JSON.stringify(values.answers ?? []),
  }) as Promise<
    | {
        answers?: EngagementBulkAnswer[];
        sent?: EngagementInboxItem[];
        failed?: Array<{ eventId: string; error: string }>;
        skipped?: Array<{ eventId: string; reason: string }>;
        model?: string;
        delaySeconds?: number;
        maxPerBatch?: number;
      }
    | undefined
  >;
}

export async function bulkMessageEngagementConversations(
  telegramInitData: string | undefined,
  eventIds: string[],
  text: string,
) {
  return gatewayForm("/engagement/bulk-message", telegramInitData, {
    eventIds: JSON.stringify(eventIds),
    text,
  }) as Promise<
    | {
        sent: EngagementInboxItem[];
        failed: Array<{ eventId: string; error: string }>;
        delaySeconds: number;
      }
    | undefined
  >;
}

export async function listNewsSeekerSnapshots(
  telegramInitData: string | undefined,
) {
  return gatewayForm("/news-seeker/list", telegramInitData, {}) as Promise<NewsroomWorkspace | undefined>;
}

export async function manageNewsroomQueue(
  telegramInitData: string | undefined,
  payload: { action: "select" | "draft" | "update" | "link_project" | "archive"; entryId?: string; item?: NewsSeekerItem; draft?: Record<string, unknown>; targets?: string[]; contentProjectId?: string },
) {
  return gatewayForm("/news-seeker/queue", telegramInitData, {
    action: payload.action,
    entryId: payload.entryId ?? "",
    contentProjectId: payload.contentProjectId ?? "",
    item: payload.item ? JSON.stringify(payload.item) : "",
    draft: payload.draft ? JSON.stringify(payload.draft) : "",
    targets: payload.targets ? JSON.stringify(payload.targets) : "",
  }) as Promise<{ entry: NewsroomQueueEntry; queue: NewsroomQueueEntry[]; duplicate?: boolean } | undefined>;
}

export async function requestNewsSeekerRefresh(
  telegramInitData: string | undefined,
  category: "all" | NewsSeekerCategory,
) {
  return gatewayForm("/news-seeker/request", telegramInitData, {
    category,
  }) as Promise<
    | {
        accepted: boolean;
        reused: boolean;
        snapshot?: NewsSeekerSnapshot;
        refreshAfterSeconds: number;
        message: string;
      }
    | undefined
  >;
}

export async function getMorningLocalData(
  telegramInitData: string | undefined,
  action:
    | "date"
    | "weather"
    | "prayer"
    | "riddle"
    | "visual_riddle"
    | "local_occasions"
    | "kalam_calendar"
    | "kalam_occasions",
  city: "golbahar" | "chenaran",
) {
  return gatewayForm("/tools/morning-local", telegramInitData, {
    action,
    city,
  }) as Promise<
    | {
        values: Record<string, string>;
        source?: string;
        meta?: { todayIndex?: number; holidayIndexes?: number[] };
      }
    | undefined
  >;
}

export async function getMarketData(
  telegramInitData: string | undefined,
  action: "date" | "rates",
) {
  return gatewayForm("/tools/market", telegramInitData, { action }) as Promise<
    | {
        values: Record<string, string>;
        source?: string;
        upstreamUpdatedAt?: string;
        changeStatus?: "ready" | "baseline_pending";
      }
    | undefined
  >;
}

export async function getOccasionTool(
  telegramInitData: string | undefined,
  action: "calendar" | "copy",
  values: { tone?: string; category?: string; occasions?: string } = {},
) {
  return gatewayForm("/tools/occasion", telegramInitData, {
    action,
    tone: values.tone ?? "",
    category: values.category ?? "",
    occasions: values.occasions ?? "",
  }) as Promise<
    | { values: Record<string, string>; options?: string[]; source?: string }
    | undefined
  >;
}

export async function getContentIdeas(
  telegramInitData: string | undefined,
  action: "night" | "home_tip" | "infographic" | "sport",
  values: Record<string, string>,
) {
  return gatewayForm("/tools/content-ideas", telegramInitData, {
    action,
    ...values,
  }) as Promise<
    | { values?: Record<string, string>; options?: string[]; source?: string }
    | undefined
  >;
}

export type SportCompetition = {
  id: string;
  label: string;
  sport: string;
  available: boolean;
  provider: string;
};
export type SportEvent = {
  eventId: string;
  home: string;
  away: string;
  date: string;
  time: string;
  round: string;
  status: string;
  played: boolean;
  score: string;
  label: string;
  homeBadge?: string;
  awayBadge?: string;
  leagueBadge?: string;
};

export async function getSportData(
  telegramInitData: string | undefined,
  action: "catalog" | "events",
  values: { competitionId?: string; mode?: string } = {},
) {
  return gatewayForm("/tools/sport", telegramInitData, {
    action,
    competitionId: values.competitionId ?? "",
    mode: values.mode ?? "result",
  }) as Promise<
    | {
        competitions?: SportCompetition[];
        competition?: { id: string; label: string; badge?: string; season?: string };
        events?: SportEvent[];
        source?: string;
      }
    | undefined
  >;
}

export async function getDesignJob(
  telegramInitData: string | undefined,
  requestId: string,
) {
  return gatewayForm("/jobs/status", telegramInitData, {
    requestId,
  }) as Promise<{ job: DesignJob } | undefined>;
}

export async function getDesignSeries(
  telegramInitData: string | undefined,
  requestId: string,
) {
  return gatewayForm("/jobs/series", telegramInitData, {
    requestId,
  }) as Promise<{ jobs: DesignJob[] } | undefined>;
}

export async function getDesignPublicationPackage(
  telegramInitData: string | undefined,
  requestId: string,
) {
  return gatewayForm("/jobs/caption", telegramInitData, {
    requestId,
  }) as Promise<
    | {
        caption: string;
        title: string;
        article: ContentArticle;
        brand: ContentProject["brand"];
        template: string;
      }
    | undefined
  >;
}

export async function manageDesignJob(
  telegramInitData: string | undefined,
  action: "cancel" | "retry",
  requestId: string,
) {
  return gatewayForm(`/jobs/${action}`, telegramInitData, {
    requestId,
  }) as Promise<{ job: DesignJob } | undefined>;
}

export async function editDesignJob(
  telegramInitData: string | undefined,
  requestId: string,
  instruction: string,
) {
  return gatewayForm("/jobs/edit", telegramInitData, {
    requestId,
    instruction,
  }) as Promise<{ job: DesignJob } | undefined>;
}

export async function editDesignJobWithForm(
  telegramInitData: string | undefined,
  requestId: string,
  request: Record<string, unknown>,
  images: File[] = [],
  puzzleImages: File[] = [],
  monitorImages: File[] = [],
) {
  const endpoint = gatewayUrl("/jobs/edit-form");
  if (!endpoint) return undefined;
  const body = new FormData();
  body.append("telegramInitData", telegramInitData ?? "");
  body.append("requestId", requestId);
  body.append("request", JSON.stringify(request));
  images.forEach((file) => body.append("images", file, file.name));
  puzzleImages.forEach((file) => body.append("puzzleImages", file, file.name));
  monitorImages.forEach((file) => body.append("monitorImages", file, file.name));
  const response = await fetch(endpoint, {
    method: "POST",
    body,
    credentials: "same-origin",
  });
  if (!response.ok) {
    const detail = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(detail.error ?? "ویرایش فرم ثبت نشد.");
  }
  return response.json() as Promise<{ job: DesignJob }>;
}

export async function recomposeDesignJob(
  telegramInitData: string | undefined,
  requestId: string,
  format: Record<string, string>,
) {
  return gatewayForm("/jobs/recompose", telegramInitData, {
    requestId,
    format: JSON.stringify(format),
  }) as Promise<{ job: DesignJob } | undefined>;
}

/**
 * Telegram WebView does not reliably honour the browser download attribute.
 * Ask the authenticated gateway to deliver the original PNG as a Telegram
 * document instead: it remains full resolution and Telegram exposes its
 * native save/share controls.
 */
export async function deliverDesignOutput(
  telegramInitData: string | undefined,
  requestId: string,
  filename: string,
) {
  return gatewayForm("/jobs/deliver", telegramInitData, {
    requestId,
    filename,
  }) as Promise<{ delivered: boolean } | undefined>;
}

export async function getDesignOutput(
  telegramInitData: string | undefined,
  requestId: string,
  filename: string,
) {
  const endpoint = gatewayUrl("/jobs/output");
  if (!endpoint) return undefined;
  const body = new FormData();
  body.append("telegramInitData", telegramInitData ?? "");
  body.append("requestId", requestId);
  body.append("filename", filename);
  const response = await fetch(endpoint, { method: "POST", body });
  if (!response.ok) throw new Error("دریافت فایل خروجی انجام نشد.");
  return response.blob();
}

export async function getDesignReferenceOutput(
  telegramInitData: string | undefined,
  requestId: string,
  filename: string,
) {
  const endpoint = gatewayUrl("/jobs/reference-output");
  if (!endpoint) return undefined;
  const body = new FormData();
  body.append("telegramInitData", telegramInitData ?? "");
  body.append("requestId", requestId);
  body.append("filename", filename);
  const response = await fetch(endpoint, {
    method: "POST",
    body,
    credentials: "same-origin",
  });
  if (!response.ok) throw new Error("دریافت تصویر مرجع انجام نشد.");
  return response.blob();
}

export async function manageVideoAssets(
  telegramInitData: string | undefined,
  action: "list" | "add" | "delete" | "set_default" | "update_profile" = "list",
  fields: { kind?: "presenter" | "location" | "monitor"; entityId?: string; assetId?: string; image?: File; scope?: "studio" | "project"; profile?: VideoAssetProfile } = {},
  onProgress?: (progress: UploadTransferProgress) => void,
) {
  const endpoint = gatewayUrl("/settings/video-assets");
  if (!endpoint) return undefined;
  const body = new FormData();
  body.append("telegramInitData", telegramInitData ?? "");
  body.append("action", action);
  if (fields.kind) body.append("kind", fields.kind);
  if (fields.entityId) body.append("entityId", fields.entityId);
  if (fields.assetId) body.append("assetId", fields.assetId);
  if (fields.profile) {
    body.append("profileRole", fields.profile.role);
    body.append("profileAspectRatio", fields.profile.aspectRatio);
    body.append("profileFraming", fields.profile.framing);
    body.append("profilePresenterCapacity", String(fields.profile.presenterCapacity));
    body.append("profileCopySpace", fields.profile.copySpace);
    body.append("profilePlacement", fields.profile.placement);
    body.append("profileSubjectPosition", fields.profile.subjectPosition);
    body.append("profileForegroundOccluder", fields.profile.foregroundOccluder);
    body.append("profileCameraAngle", fields.profile.cameraAngle);
    body.append("profileLabel", fields.profile.label);
  }
  body.append("scope", fields.scope ?? "studio");
  if (fields.image) body.append("image", fields.image, fields.image.name);
  return new Promise<VideoAssetRegistry>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", endpoint, true);
    request.withCredentials = true;
    request.timeout = 4 * 60 * 1000;
    request.upload.onprogress = (event) => {
      if (event.lengthComputable)
        onProgress?.({ loaded: event.loaded, total: event.total, stage: "uploading" });
    };
    request.upload.onload = () => onProgress?.({ loaded: 1, total: 1, stage: "securing" });
    request.onerror = () => reject(new Error("ارتباط هنگام بارگذاری تصویر مرجع قطع شد."));
    request.ontimeout = () => reject(new Error("ذخیرهٔ تصویر مرجع بیش از حد طول کشید."));
    request.onabort = () => reject(new Error("بارگذاری تصویر مرجع لغو شد."));
    request.onload = () => {
      let detail: (VideoAssetRegistry & { error?: string }) | undefined;
      try { detail = JSON.parse(request.responseText || "{}") as VideoAssetRegistry & { error?: string }; } catch { /* handled below */ }
      if (request.status < 200 || request.status >= 300 || !detail?.assets)
        return reject(new Error(detail?.error ?? "مدیریت تصاویر مرجع انجام نشد."));
      resolve(detail);
    };
    request.send(body);
  });
}

export async function createVideoPrompt(telegramInitData: string | undefined, project: VideoProjectInput) {
  return gatewayForm("/video-projects/prompt", telegramInitData, { project: JSON.stringify(project) }) as Promise<VideoPromptPreview | undefined>;
}

async function getVideoPromptFile(telegramInitData: string | undefined, path: "prompt-asset" | "prompt-bundle", fields: Record<string, string>) {
  const endpoint = gatewayUrl(`/video-projects/${path}`);
  if (!endpoint) return undefined;
  const body = new FormData();
  body.append("telegramInitData", telegramInitData ?? "");
  Object.entries(fields).forEach(([key, value]) => body.append(key, value));
  const response = await fetch(endpoint, { method: "POST", body, credentials: "same-origin" });
  if (!response.ok) {
    const detail = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(detail.error ?? "دریافت بستهٔ پرامپت انجام نشد.");
  }
  return response.blob();
}

export function getVideoPromptAsset(telegramInitData: string | undefined, projectId: string, referenceId: string) {
  return getVideoPromptFile(telegramInitData, "prompt-asset", { projectId, referenceId });
}

export function getVideoPromptBundle(telegramInitData: string | undefined, projectId: string) {
  return getVideoPromptFile(telegramInitData, "prompt-bundle", { projectId });
}

export async function createVideoProject(telegramInitData: string | undefined, project: VideoProjectInput) {
  return gatewayForm("/video-projects/create", telegramInitData, { project: JSON.stringify(project) }) as Promise<VideoProject | undefined>;
}

export async function listVideoProjects(telegramInitData: string | undefined) {
  return gatewayForm("/video-projects/list", telegramInitData, {}) as Promise<{ projects: VideoProject[] } | undefined>;
}

export async function getVideoProject(telegramInitData: string | undefined, projectId: string) {
  return gatewayForm("/video-projects/get", telegramInitData, { projectId }) as Promise<VideoProject | undefined>;
}

export async function manageVideoProject(telegramInitData: string | undefined, projectId: string, action: "retry" | "cancel") {
  return gatewayForm(`/video-projects/${action}`, telegramInitData, { projectId }) as Promise<VideoProject | undefined>;
}

export async function getVideoProjectOutput(telegramInitData: string | undefined, projectId: string) {
  const endpoint = gatewayUrl("/video-projects/output");
  if (!endpoint) return undefined;
  const body = new FormData();
  body.append("telegramInitData", telegramInitData ?? "");
  body.append("projectId", projectId);
  const response = await fetch(endpoint, { method: "POST", body, credentials: "same-origin" });
  if (!response.ok) throw new Error("دریافت ویدیو انجام نشد.");
  return response.blob();
}

export async function createVoiceProject(
  telegramInitData: string | undefined,
  project: { voiceId: string; engineId: string; voice: string; text: string; instructions: string },
) {
  return gatewayForm("/video-projects/prompt", telegramInitData, {
    voiceAction: "create",
    voiceProject: JSON.stringify(project),
  }) as Promise<VoiceProject | undefined>;
}

export async function listVoiceProjects(telegramInitData: string | undefined) {
  return gatewayForm("/video-projects/list", telegramInitData, { voiceAction: "list" }) as Promise<{ projects: VoiceProject[] } | undefined>;
}

export async function getVoiceProjectOutput(telegramInitData: string | undefined, voiceId: string) {
  const endpoint = gatewayUrl("/video-projects/output");
  if (!endpoint) return undefined;
  const body = new FormData();
  body.append("telegramInitData", telegramInitData ?? "");
  body.append("voiceId", voiceId);
  const response = await fetch(endpoint, { method: "POST", body, credentials: "same-origin" });
  if (!response.ok) {
    const detail = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(detail.error ?? "دریافت صدای تولیدشده ناموفق بود.");
  }
  return response.blob();
}

/**
 * The production endpoint is an n8n Webhook or a small gateway in front of it.
 * Telegram initData is deliberately forwarded unchanged: authorization must be
 * verified on the server using the bot token, never trusted in the browser.
 */
export async function submitDesignRequest(
  request: Record<string, unknown>,
  telegramInitData: string | undefined,
  images: File[],
  puzzleImages: File[] = [],
  monitorImages: File[] = [],
  onProgress?: (progress: UploadTransferProgress) => void,
): Promise<SubmissionResult> {
  const endpoint = DESIGN_API_URL;

  if (!endpoint) return { mode: "preview" };

  const body = new FormData();
  body.append("request", JSON.stringify(request));
  body.append("telegramInitData", telegramInitData ?? "");
  images.forEach((image) => body.append("images", image, image.name));
  puzzleImages.forEach((image) =>
    body.append("puzzleImages", image, image.name),
  );
  monitorImages.forEach((image) =>
    body.append("monitorImages", image, image.name),
  );

  // fetch intentionally is not used here: it cannot expose browser upload
  // progress, while design references can be several large photos.
  return new Promise<SubmissionResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", endpoint, true);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable)
        onProgress?.({
          loaded: event.loaded,
          total: event.total,
          stage: "uploading",
        });
    };
    xhr.upload.onload = () =>
      onProgress?.({ loaded: 1, total: 1, stage: "securing" });
    xhr.onerror = () =>
      reject(new Error("ارتباط هنگام بارگذاری فایل‌های مرجع قطع شد."));
    xhr.onload = () => {
      let result: { requestId?: string; error?: string } = {};
      try {
        result = JSON.parse(xhr.responseText || "{}") as typeof result;
      } catch {
        /* handled below */
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(result.error ?? "ارسال درخواست طراحی ناموفق بود."));
        return;
      }
      resolve({
        mode: "submitted",
        requestId: result.requestId ?? String(request.requestId),
      });
    };
    xhr.send(body);
  });
}
