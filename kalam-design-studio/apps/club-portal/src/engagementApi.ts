import { request, Member, Submission } from "./api";
export type PointAward = { id: string; amount: number; title: string; submissionId?: string; createdAt: string; receivedAt?: string };
export type ActivityEvent = Partial<PointAward> & { id: string; kind: string; title: string; createdAt: string; description?: string; submission?: Submission };
export type StoryCampaign = { id: string; title: string; active: boolean; points: number; submissionStatus?: string; media: Array<{ id: string; label: string; handle: string; bannerId?: string; bannerUrl?: string; ready: boolean }> };
export const engagementApi = {
  pending: () => request<{ points: PointAward[] }>("/points/pending"),
  receive: (id: string) => request<{ member: Member }>(`/points/${id}/receive`, { method: "POST" }),
  activity: () => request<{ events: ActivityEvent[]; submissions: Submission[] }>("/activity"),
  campaigns: () => request<{ campaigns: StoryCampaign[] }>("/story-campaigns"),
  banner: (id: string, media: string) => request<{ url: string }>(`/story-campaigns/${id}/banner/${media}`),
  submitStory: (id: string, media: string, publishedAt: string, attachmentId: string) => request<{ submission: Submission }>(`/story-campaigns/${id}/submissions`, { method: "POST", body: JSON.stringify({ media, published_at: publishedAt, attachment_id: attachmentId }) }),
};
