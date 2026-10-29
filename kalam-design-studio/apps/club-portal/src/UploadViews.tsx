import MediaCard from "./MediaCard";
import { clubApi } from "./api";
import { UploadProgress } from "./uploads";
import { fa } from "./format";
export function UploadProgressView({ progress }: { progress: UploadProgress }) {
  const items = Object.entries(progress);
  return items.length ? (
    <div className="upload-progress">
      {items.map(([key, item]) => (
        <div key={key}>
          <span>{item.name}</span>
          {item.error ? (
            <b className="error">{item.error}</b>
          ) : (
            <>
              <i>
                <em style={{ width: `${item.percent}%` }} />
              </i>
              <small>{fa(item.percent)}٪</small>
            </>
          )}
        </div>
      ))}
    </div>
  ) : null;
}

const loadMemberMedia = async (id: string) => {
  const { attachment } = await clubApi.attachment(id);
  const data = attachment.status === "available" ? await clubApi.attachmentDownload(id) : undefined;
  return { ...attachment, url: data?.url };
};
export function AttachmentPill({ attachmentId, caption }: { attachmentId: string; caption?: string }) {
  return <MediaCard id={attachmentId} load={loadMemberMedia} caption={caption} />;
}
