import { useEffect, useRef, useState } from "react";
import { ClubAdminReward, clubAdminRequest } from "./api";

export type ClubShowcase = { rewardId: string; title: string; store: string; discount: string; gift: string; description: string; points: string; expires: string; address: string };
export const emptyClubShowcase = (): ClubShowcase => ({ rewardId: "", title: "", store: "", discount: "", gift: "", description: "", points: "", expires: "", address: "" });
export function restoreClubShowcase(value: unknown): ClubShowcase {
  const result = emptyClubShowcase();
  if (value && typeof value === "object") for (const key of Object.keys(result) as Array<keyof ClubShowcase>) {
    const field = (value as Record<string, unknown>)[key];
    if (typeof field === "string") result[key] = field;
  }
  return result;
}
type ReferenceImage = { id: string; filename: string; contentType: string; dataBase64: string };

export default function ClubShowcaseFields({ initData, value, onChange, onImages }: {
  initData?: string; value: ClubShowcase; onChange: (value: ClubShowcase) => void; onImages: (files: File[]) => void;
}) {
  const [rewards, setRewards] = useState<ClubAdminReward[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const selection = useRef(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    void clubAdminRequest<{ rewards: ClubAdminReward[] }>(initData, "GET", "/api/admin/showcase-rewards")
      .then(result => { if (active) { if (!result) throw new Error("فهرست جوایز دریافت نشد."); setRewards(result.rewards); } })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "دریافت جوایز ناموفق بود."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; selection.current += 1; };
  }, [initData, retry]);
  async function chooseReward(id: string) {
    const current = ++selection.current;
    setError("");
    const reward = rewards.find(item => item.id === id);
    if (!reward) { onChange(emptyClubShowcase()); onImages([]); setBusy(false); return; }
    const discount = `${reward.title} ${reward.description}`.match(/[۰-۹0-9]+(?:[٫.]?[۰-۹0-9]+)?\s*(?:٪|%|درصد)/)?.[0] || "";
    onChange({ rewardId: id, title: reward.title, store: reward.partner?.name || "", discount: reward.kind === "discount_code" ? discount : "", gift: reward.kind === "discount_code" ? "" : reward.title, description: reward.description, points: String(reward.pointsCost), expires: reward.activeUntil ? new Date(reward.activeUntil).toLocaleDateString("fa-IR") : "", address: reward.partner?.address || "" });
    onImages([]); setBusy(true);
    try {
      const result = await clubAdminRequest<{ images: ReferenceImage[]; pending: boolean }>(initData, "GET", `/api/admin/showcase-rewards/${id}/images`);
      if (current !== selection.current) return;
      if (!result) throw new Error("تصاویر جایزه دریافت نشد.");
      const files = result.images.map(item => {
        const bytes = Uint8Array.from(atob(item.dataBase64), char => char.charCodeAt(0));
        return new File([bytes], `club-${item.id}-${item.filename}`, { type: item.contentType });
      });
      onImages(files);
      if (result.pending) setError("بعضی تصاویر هنوز در حال بررسی هستند؛ پس از آماده شدن، جایزه را دوباره انتخاب کنید یا عکس مرجع اضافه کنید.");
    } catch (reason) { if (current === selection.current) setError(reason instanceof Error ? reason.message : "دریافت تصویر ناموفق بود؛ می‌توانید تصویر را دستی اضافه کنید."); }
    finally { if (current === selection.current) setBusy(false); }
  }
  return <section className="club-showcase-fields">
    <h3>ویترین باشگاه مخاطبان</h3><p className="hint">کارت سه‌بعدی روی استیج قرمز نورانی؛ اطلاعات جایزه را انتخاب و در صورت نیاز ویرایش کنید.</p>
    <label>انتخاب جایزه فعال<select value={value.rewardId} disabled={loading} onChange={event => void chooseReward(event.target.value)}><option value="">{loading ? "در حال دریافت جوایز…" : "ورود اطلاعات به‌صورت دستی"}</option>{rewards.map(reward => <option key={reward.id} value={reward.id}>{reward.title}{reward.partner ? ` · ${reward.partner.name}` : ""}</option>)}</select></label>
    {!loading && !error && rewards.length === 0 && <p className="hint">جایزه فعالی وجود ندارد؛ اطلاعات را دستی وارد کنید.</p>}
    {busy && <p role="status">در حال افزودن عکس جایزه و لوگوی فروشگاه به تصاویر مرجع…</p>}
    {error && <p className="error" role="alert">{error}<button className="secondary" type="button" onClick={() => value.rewardId ? void chooseReward(value.rewardId) : setRetry(number => number + 1)}>تلاش دوباره</button></p>}
    <div className="club-showcase-grid">{([
      ["title", "عنوان جایزه"], ["store", "نام فروشگاه"], ["discount", "میزان تخفیف"], ["gift", "هدیه"], ["points", "امتیاز لازم"], ["expires", "مهلت استفاده"], ["address", "نشانی فروشگاه"],
    ] as Array<[keyof ClubShowcase, string]>).map(([key, label]) => <label key={key}>{label}<input value={value[key]} maxLength={key === "address" ? 400 : 240} onChange={event => onChange({ ...value, [key]: event.target.value })} /></label>)}</div>
    <label>توضیحات و شرایط جایزه<textarea rows={4} maxLength={4000} value={value.description} onChange={event => onChange({ ...value, description: event.target.value })} /></label>
    <small className="hint">عکس‌های دریافت‌شده در بخش تصاویر مرجع فرم قرار می‌گیرند. میزان تخفیف را از شرایط جایزه بررسی کنید و در فیلد مربوط بنویسید.</small>
  </section>;
}
