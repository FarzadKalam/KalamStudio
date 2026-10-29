export type Member = {
  id: string;
  phone: string;
  fullName: string;
  city: string;
  contentTypes: string[];
  skills: string[];
  creditLabel: string;
  platformHandles: Record<string, string>;
  score: number;
  profileComplete: boolean;
  rulesVersion: string;
  marketingSmsAllowed: boolean;
  createdAt: string;
};

export type Attachment = {
  id: string;
  filename: string;
  contentType: string;
  bytes: number;
  status: string;
  createdAt: string;
};
export type ChatMessage = {
  attachmentCaptions?: Record<string, string>;
  id: string;
  conversationId: string;
  sender: "member" | "admin" | "system";
  text: string;
  attachmentIds: string[];
  sentAt: string;
  readAt?: string | null;
  aiGenerated: boolean;
};
export type Reward = {
  id: string;
  partnerId?: string | null;
  imageAttachmentId?: string | null;
  imageUrl?: string | null;
  partner?: {
    name: string;
    description: string;
    address: string;
    phone: string;
    websiteUrl: string;
    logoAttachmentId?: string | null;
    logoUrl?: string | null;
  } | null;
  title: string;
  description: string;
  kind: string;
  fulfillmentMode: string;
  pointsCost: number;
  stockRemaining?: number | null;
  activeUntil?: string | null;
};
export type RewardClaim = {
  id: string;
  reward: Reward;
  status: string;
  pointsDebited: number;
  fulfillmentNote: string;
  createdAt: string;
  redeemedAt?: string | null;
  codeAvailable: boolean;
};
export type Submission = {
  reviewedBy?: string | null;
  campaign?: { title: string; points: number; label: string; handle: string; publishedAt: string } | null;
  contentCategory: string;
  reviewedAt?: string | null;
  id: string;
  status: string;
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
    position: number;
  }>;
};

const base = "/api";

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${base}${path}`, {
    credentials: "include",
    signal: AbortSignal.timeout(20000),
    cache: "no-store",
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(String(data?.detail || "ارتباط با باشگاه ناموفق بود."));
  return data as T;
}

export const clubApi = {
  requestOtp: (phone: string) =>
    request<{
      resendAfterSeconds: number;
      expiresInSeconds: number;
      deliveryStatus: "confirmed" | "unconfirmed";
    }>("/auth/request-otp", {
      method: "POST",
      body: JSON.stringify({ phone }),
    }),
  verifyOtp: (phone: string, code: string) =>
    request<{ member: Member; profileComplete: boolean }>("/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({ phone, code }),
    }),
  logout: () => request<void>("/auth/logout", { method: "POST" }),
  acceptRules: (version: string) => request<{ member: Member }>("/me/rules", { method: "POST", body: JSON.stringify({ version }) }),
  me: () => request<{ member: Member }>("/me"),
  updateProfile: (
    value: Omit<
      Member,
      "id" | "phone" | "score" | "profileComplete" | "createdAt" | "rulesVersion"
    > & { agreementAccepted: boolean },
  ) =>
    request<{ member: Member }>("/me", {
      method: "PUT",
      body: JSON.stringify({
        full_name: value.fullName,
        city: value.city,
        content_types: value.contentTypes,
        skills: value.skills,
        credit_label: value.creditLabel,
        platform_handles: value.platformHandles,
        marketing_sms_allowed: value.marketingSmsAllowed,
        agreement_accepted: value.agreementAccepted,
      }),
    }),
  conversation: () =>
    request<{
      conversation: { id: string; status: string; lastMessageAt: string };
    }>("/chat/conversation"),
  messages: () => request<{ messages: ChatMessage[] }>("/chat/messages"),
  sendMessage: (text: string, attachmentIds: string[], attachmentCaptions: Record<string, string> = {}) =>
    request<{ message: ChatMessage }>("/chat/messages", {
      method: "POST",
      body: JSON.stringify({ text, attachment_ids: attachmentIds, attachment_captions: attachmentCaptions }),
    }),
  initiateUpload: (file: File) =>
    request<{
      uploadId: string;
      partSize: number;
      partCount: number;
      expiresAt: string;
      transport?: "proxy" | "direct";
    }>("/uploads/initiate", {
      method: "POST",
      body: JSON.stringify({
        filename: file.name,
        bytes: file.size,
        content_type: file.type || "application/octet-stream",
      }),
    }),
  uploadPartUrls: (uploadId: string, partNumbers: number[]) =>
    request<{ parts: Array<{ partNumber: number; url: string }> }>(
      `/uploads/${uploadId}/parts`,
      { method: "POST", body: JSON.stringify({ part_numbers: partNumbers }) },
    ),
  uploadPartProxyUrl: (uploadId: string, partNumber: number) =>
    `/api/uploads/${uploadId}/parts/${partNumber}`,
  completeUpload: (
    uploadId: string,
    parts: Array<{ partNumber: number; etag: string }>,
    sha256?: string,
  ) =>
    request<{ attachment: Attachment }>(`/uploads/${uploadId}/complete`, {
      method: "POST",
      body: JSON.stringify({
        parts: parts.map((part) => ({
          part_number: part.partNumber,
          etag: part.etag,
        })),
        sha256,
      }),
    }),
  attachment: (attachmentId: string) =>
    request<{ attachment: Attachment }>(`/attachments/${attachmentId}`),
  attachmentDownload: (attachmentId: string) =>
    request<{ url: string; filename: string }>(
      `/attachments/${attachmentId}/download`,
    ),
  submissions: () =>
    request<{ submissions: Submission[] }>("/content/submissions"),
  submitContent: (
    creditLabel: string,
    contentCategory: string,
    items: Array<{ attachment_id?: string; text?: string; caption?: string }>,
    classified?: { type: string; contact: string },
  ) =>
    request<{ submission: Submission }>("/content/submissions", {
      method: "POST",
      body: JSON.stringify({ credit_label: creditLabel, content_category: contentCategory, items, classified_type: classified?.type || "", classified_contact: classified?.contact || "" }),
    }),
  anonymousCaptcha: () => request<{ token: string; question: string; expiresInSeconds: number }>("/public/anonymous-captcha"),
  authorizeAnonymousContent: (captchaToken: string, captchaAnswer: string) =>
    request<{ authorizationToken: string; expiresInSeconds: number }>("/public/content/authorize", { method: "POST", body: JSON.stringify({ captcha_token: captchaToken, captcha_answer: captchaAnswer }) }),
  initiateAnonymousUpload: (file: File, authorizationToken: string) =>
    request<{ uploadId: string; partSize: number; partCount: number; expiresAt: string; transport: "proxy" }>("/public/uploads/initiate", { method: "POST", body: JSON.stringify({ authorization_token: authorizationToken, filename: file.name, bytes: file.size, content_type: file.type || "application/octet-stream" }) }),
  anonymousUploadPartUrls: (uploadId: string, partNumbers: number[], authorizationToken: string) =>
    request<{ parts: Array<{ partNumber: number; url: string }> }>(`/public/uploads/${uploadId}/parts`, { method: "POST", body: JSON.stringify({ authorization_token: authorizationToken, part_numbers: partNumbers }) }),
  completeAnonymousUpload: (uploadId: string, parts: Array<{ partNumber: number; etag: string }>, authorizationToken: string) =>
    request<{ attachment: Attachment }>(`/public/uploads/${uploadId}/complete`, { method: "POST", body: JSON.stringify({ authorization_token: authorizationToken, parts: parts.map(part => ({ part_number: part.partNumber, etag: part.etag })) }) }),
  submitAnonymousContent: (authorizationToken: string, items: Array<{ attachment_id?: string; text?: string; caption?: string }>) =>
    request<{ submission: Submission }>("/public/content/submissions", { method: "POST", body: JSON.stringify({ content_category: "people", authorization_token: authorizationToken, items }) }),
  rewards: () => request<{ rewards: Reward[] }>("/rewards"),
  claims: () => request<{ claims: RewardClaim[] }>("/reward-claims"),
  claimReward: (rewardId: string) =>
    request<{ claim: RewardClaim }>("/reward-claims", {
      method: "POST",
      body: JSON.stringify({ reward_id: rewardId }),
    }),
  rewardCode: (claimId: string) =>
    request<{ code: string }>(`/reward-claims/${claimId}/code`),
};
