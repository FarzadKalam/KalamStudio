import { clubApi, Attachment } from "./api";
export type UploadProgress = Record<
  string,
  { name: string; percent: number; error?: string }
>;

type UploadPart = { partNumber: number; etag: string };
type ResumableUpload = {
  uploadId: string;
  partSize: number;
  partCount: number;
  expiresAt: string;
  transport?: "proxy" | "direct";
  parts: UploadPart[];
};

const uploadKey = (file: File) =>
  `kalam-club-upload:${file.name}:${file.size}:${file.lastModified}`;
const partBytes = (file: File, size: number, number: number) =>
  Math.max(0, Math.min(size, file.size - (number - 1) * size));
const readResumableUpload = (file: File): ResumableUpload | undefined => {
  try {
    const raw = localStorage.getItem(uploadKey(file));
    const value = raw ? (JSON.parse(raw) as ResumableUpload) : undefined;
    return value && new Date(value.expiresAt).getTime() > Date.now() + 15_000
      ? value
      : undefined;
  } catch {
    return undefined;
  }
};
const saveResumableUpload = (file: File, value: ResumableUpload) => {
  try {
    localStorage.setItem(uploadKey(file), JSON.stringify(value));
  } catch {
    /* upload still works when storage is unavailable */
  }
};
const clearResumableUpload = (file: File) => {
  try {
    localStorage.removeItem(uploadKey(file));
  } catch {
    /* no persisted state to remove */
  }
};

async function putPart(
  url: string,
  part: Blob,
  onProgress: (loaded: number) => void,
): Promise<string> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const etag = await new Promise<string>((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open("PUT", url, true);
        request.upload.onprogress = (event) => {
          if (event.lengthComputable) onProgress(event.loaded);
        };
        request.onerror = () =>
          reject(new Error("ارسال یکی از بخش‌های فایل ناموفق بود."));
        request.onload = () => {
          let receivedEtag =
            request.getResponseHeader("etag") ||
            request.getResponseHeader("ETag");
          if (!receivedEtag && url.startsWith("/api/")) {
            try {
              receivedEtag = String(
                JSON.parse(request.responseText).etag || "",
              );
            } catch {
              /* handled below */
            }
          }
          if (request.status >= 200 && request.status < 300 && receivedEtag)
            resolve(receivedEtag);
          else reject(new Error("ارسال یکی از بخش‌های فایل ناموفق بود."));
        };
        request.send(part);
      });
      onProgress(part.size);
      return etag;
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error("آپلود ناموفق بود.");
      if (attempt < 2)
        await new Promise((resolve) =>
          window.setTimeout(resolve, 700 * (attempt + 1)),
        );
    }
  }
  throw lastError || new Error("آپلود ناموفق بود.");
}

async function uploadOneFile(
  file: File,
  progress: UploadProgress,
  report: () => void,
  permitResume = true,
  anonymousAuthorization?: string,
): Promise<Attachment> {
  const key = `${file.name}-${file.size}-${file.lastModified}`;
  progress[key] = { name: file.name, percent: 1 };
  report();
  const resume = !anonymousAuthorization && permitResume ? readResumableUpload(file) : undefined;
  const started = resume || (anonymousAuthorization
    ? await clubApi.initiateAnonymousUpload(file, anonymousAuthorization)
    : await clubApi.initiateUpload(file));
  const completed = new Map<number, string>(
    (resume?.parts || []).map((part) => [part.partNumber, part.etag]),
  );
  const loaded = new Map<number, number>();
  for (const number of completed.keys())
    loaded.set(number, partBytes(file, started.partSize, number));
  const updateProgress = () => {
    const bytes = [...loaded.values()].reduce(
      (total, value) => total + value,
      0,
    );
    progress[key] = {
      name: file.name,
      percent: Math.min(99, Math.max(1, Math.round((bytes / file.size) * 100))),
    };
    report();
  };
  const persist = () => {
    if (anonymousAuthorization) return;
    saveResumableUpload(file, {
      ...started,
      parts: [...completed].map(([partNumber, etag]) => ({ partNumber, etag })),
    });
  };
  persist();
  try {
    const missing = Array.from(
      { length: started.partCount },
      (_, index) => index + 1,
    ).filter((number) => !completed.has(number));
    for (let cursor = 0; cursor < missing.length; cursor += 4) {
      const batch = missing.slice(cursor, cursor + 4);
      const urls =
        anonymousAuthorization
          ? await clubApi.anonymousUploadPartUrls(started.uploadId, batch, anonymousAuthorization)
          : started.transport === "direct"
          ? await clubApi.uploadPartUrls(started.uploadId, batch)
          : {
              parts: batch.map((partNumber) => ({
                partNumber,
                url: clubApi.uploadPartProxyUrl(started.uploadId, partNumber),
              })),
            };
      await Promise.all(
        urls.parts.map(async ({ partNumber, url }) => {
          const bytes = partBytes(file, started.partSize, partNumber);
          const etag = await putPart(
            url,
            file.slice(
              (partNumber - 1) * started.partSize,
              Math.min(partNumber * started.partSize, file.size),
            ),
            (value) => {
              loaded.set(partNumber, value);
              updateProgress();
            },
          );
          completed.set(partNumber, etag);
          loaded.set(partNumber, bytes);
          persist();
          updateProgress();
        }),
      );
    }
    const completedParts = [...completed]
      .map(([partNumber, etag]) => ({ partNumber, etag }))
      .sort((a, b) => a.partNumber - b.partNumber);
    const result = anonymousAuthorization
      ? await clubApi.completeAnonymousUpload(started.uploadId, completedParts, anonymousAuthorization)
      : await clubApi.completeUpload(started.uploadId, completedParts);
    clearResumableUpload(file);
    progress[key] = { name: file.name, percent: 100 };
    report();
    return result.attachment;
  } catch (error) {
    if (
      resume &&
      permitResume &&
      error instanceof Error &&
      error.message.includes("جلسهٔ آپلود")
    ) {
      clearResumableUpload(file);
      return uploadOneFile(file, progress, report, false, anonymousAuthorization);
    }
    progress[key] = {
      name: file.name,
      percent: 0,
      error: error instanceof Error ? error.message : "آپلود ناموفق بود.",
    };
    report();
    throw error;
  }
}

export async function uploadFiles(
  files: File[],
  onProgress: (next: UploadProgress) => void,
): Promise<Attachment[]> {
  if (files.length > 12)
    throw new Error("در هر ارسال حداکثر ۱۲ فایل قابل انتخاب است.");
  const progress: UploadProgress = {};
  const report = () => onProgress({ ...progress });
  const results: Attachment[] = new Array(files.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(3, files.length) }, async () => {
      while (cursor < files.length) {
        const index = cursor;
        cursor += 1;
        results[index] = await uploadOneFile(files[index], progress, report);
      }
    }),
  );
  return results;
}

export async function uploadAnonymousFiles(
  files: File[],
  authorizationToken: string,
  onProgress: (next: UploadProgress) => void,
): Promise<Attachment[]> {
  if (files.length > 12) throw new Error("در هر ارسال حداکثر ۱۲ فایل قابل انتخاب است.");
  const progress: UploadProgress = {};
  const report = () => onProgress({ ...progress });
  const results: Attachment[] = new Array(files.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(2, files.length) }, async () => {
    while (cursor < files.length) {
      const index = cursor; cursor += 1;
      results[index] = await uploadOneFile(files[index], progress, report, false, authorizationToken);
    }
  }));
  return results;
}

