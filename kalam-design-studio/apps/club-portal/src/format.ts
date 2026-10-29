export const fa = (value: string | number) =>
  String(value).replace(/\d/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]);
export const formatDate = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("fa-IR", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "—";
export const formatBytes = (value: number) =>
  value >= 1024 * 1024
    ? `${fa((value / (1024 * 1024)).toFixed(1))} مگابایت`
    : `${fa(Math.ceil(value / 1024))} کیلوبایت`;
