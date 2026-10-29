import { useCallback } from "react";
import MediaCard, { MediaInfo } from "../../club-portal/src/MediaCard";
import { clubAdminRequest } from "./api";
export default function ClubAttachment({ id, initData, caption }: { id: string; initData?: string; caption?: string }) {
  const load = useCallback(async (attachmentId: string) => {
    const result = await clubAdminRequest<{ attachment: MediaInfo }>(initData, "GET", `/api/admin/attachments/${attachmentId}`);
    if (!result) throw new Error("دریافت فایل ناموفق بود.");
    return result.attachment;
  }, [initData]);
  return <MediaCard id={id} load={load} caption={caption} />;
}
