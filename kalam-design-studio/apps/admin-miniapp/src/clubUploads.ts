import { clubAdminRequest } from "./api";
export type ClubUploadProgress = Record<string, { percent: number; error?: string }>;
export const clubFileKey = (file: File) => `${file.name}:${file.size}:${file.lastModified}`;
function base64(blob: Blob): Promise<string> { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onerror = () => reject(new Error("خواندن فایل ناموفق بود.")); reader.onload = () => resolve(String(reader.result).split(",")[1]); reader.readAsDataURL(blob); }); }
export async function uploadClubFiles(initData: string | undefined, files: File[], onProgress: (progress: ClubUploadProgress) => void) {
  const progress: ClubUploadProgress = {}; const result: Array<{ id: string }> = [];
  for (const file of files) {
    const key = clubFileKey(file); const report = (percent: number, error?: string) => { progress[key] = { percent, error }; onProgress({ ...progress }); };
    report(0);
    try {
      const upload = await clubAdminRequest<{ uploadId: string; partSize: number; partCount: number }>(initData, "POST", "/api/admin/uploads/initiate", { filename: file.name, content_type: file.type || "application/octet-stream", bytes: file.size });
      if (!upload) throw new Error("شروع بارگذاری ناموفق بود.");
      const parts: Array<{ part_number: number; etag: string }> = [];
      for (let number = 1; number <= upload.partCount; number++) {
        const encoded = await base64(file.slice((number - 1) * upload.partSize, number * upload.partSize));
        let part: { etag: string } | undefined;
        for (let attempt = 0; attempt < 3; attempt++) {
          try { part = await clubAdminRequest<{ etag: string }>(initData, "POST", `/api/admin/uploads/${upload.uploadId}/parts/${number}`, { data_base64: encoded }); if (!part) throw new Error("ارسال بخش فایل ناموفق بود."); break; }
          catch (e) { if (attempt === 2) throw e; }
        }
        parts.push({ part_number: number, etag: part!.etag }); report(Math.round(number / upload.partCount * 95));
      }
      const completed = await clubAdminRequest<{ attachment: { id: string } }>(initData, "POST", `/api/admin/uploads/${upload.uploadId}/complete`, { parts });
      if (!completed) throw new Error("تکمیل بارگذاری ناموفق بود.");
      result.push(completed.attachment); report(100);
    } catch (e) { report(progress[key]?.percent || 0, e instanceof Error ? e.message : "بارگذاری ناموفق بود."); throw e; }
  }
  return result;
}
