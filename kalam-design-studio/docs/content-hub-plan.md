# طرح یکپارچه‌سازی پروژهٔ محتوا

## اصل عدم‌پسرفت

مسیرهای تلگرامیِ فعال همچنان ورودی مستقل خود را خواهند داشت. هیچ Trigger، دکمه، Callback، Credential یا مسیر انتشار فعلی حذف یا جایگزین نمی‌شود. قابلیت‌های وب از APIهای جدید و جدا استفاده می‌کنند و فقط پس از آزمون کامل، منطق مشترک به‌صورت کنترل‌شده استخراج می‌شود.

در شروع کار، نسخهٔ زندهٔ این ورک‌فلوها در سرور پشتیبان‌گیری شد:

- `Kalam Reporter`
- `Fast Publish kalametaze`
- `Kalam Design Intake`

## معیار قابلیت‌های تلگرامی

### Reporter

- منوی اصلی: `news_menu_`، `image_menu_`، `video_menu_`
- خبر: `news_news_`، `news_other_`، `news_people_`
- خروجی‌های خبر: `news__post`، `news__channel`، `news__story`، `news__sstory`، `news__carousel`، `news__site`، `news__reel`، `news__scenario`
- ادامهٔ کار: `news_titr_`، `news_tryagain_`، `main_menu_`
- ابزار تصویر: `image_news`، `image_edit`، `image_expand`، `image_prompt`

### Fast Publish

- متن: `pub_text_kalam`، `pub_text_golbahar`، `pub_text_chenaran`
- تصویر: `pub_image_kalam`، `pub_image_golbahar`، `pub_image_chenaran`، `pub_image_site`
- ویدیو: `pub_video_kalam`، `pub_video_golbahar`، `pub_video_chenaran`، `pub_video_site`، `pub_video_aparat`، `pub_video_youtube`

هر انتشار این قابلیت‌ها باید پیش و پس از هر مرحله با یک پیام نمونه کنترل شود.

## قرارداد مشترک

هر «پروژهٔ محتوا» باید یک شناسهٔ پایدار و نسخه‌بندی داشته باشد:

```text
ContentProject
  id, ownerId, createdAt, updatedAt, revision
  brand
  rawText
  article { kicker, title, subtitle, lead, body, source, tags }
  media[]
  designProjectIds[]
  publicationRequests[]
  audit[]
```

تغییر دستی هر فیلد نسخه‌ای تازه می‌سازد و خروجی هوش مصنوعی را حذف نمی‌کند.

## مسیرهای API جدید

- `POST /content-projects` و `GET /content-projects/:id`
- `POST /editorial/jobs` برای اجرای امن هستهٔ Reporter
- `POST /content-projects/:id/design-draft` برای بازکردن فرم استودیو با متن و رسانهٔ پروژه
- `POST /publication-requests` برای ایجاد پیش‌نویس انتشار
- `POST /publication-requests/:id/confirm` برای انتشار نهاییِ idempotent

هر API فقط از Gateway احراز هویت‌شده فراخوانی می‌شود. کلیدهای مقصدها در مرورگر قرار نمی‌گیرند.

## نحوهٔ اتصال n8n

Reporter و FastPublish فعلی تلگرام‌محورند؛ به‌خصوص FastPublish به `reply_to_message` و `file_id` تلگرام وابسته است. بنابراین مینی‌اپ نباید آن Triggerها را تقلید کند.

راه امن، افزودن دو ورودی API جداست:

1. **Editorial API**: دادهٔ استاندارد خبر را می‌گیرد، هستهٔ پرامپت/کنترل کیفیت Reporter را اجرا می‌کند و خروجی نسخه‌بندی‌شده برمی‌گرداند.
2. **Publication API**: بستهٔ انتشار استاندارد شامل متن، فایل، رسانه و مقصدها را می‌گیرد و از Adapterهای هر مقصد استفاده می‌کند.

در مرحلهٔ نخست، دو ورک‌فلو تلگرامی دست‌نخورده می‌مانند. پس از تطبیق خروجی‌ها، بخش‌های تکراری به Sub-workflowهای مشترک منتقل می‌شوند.

## مراحل اجرا

1. ایجاد ذخیره‌سازی پروژهٔ محتوا در Gateway و آزمون دسترسی.
2. تب «ویرایش متن» و Job پایدار Reporter API.
3. انتقال یک‌کلیکی متن/رسانه از پروژه به استودیو تصویر.
4. تب «انتشار سریع» با پیش‌نمایش، فرم قابل‌ویرایش و تأیید نهایی.
5. اتصال مرحله‌ای مقصدها و گزارش نتیجهٔ هر مقصد.
6. آزمون رفت‌وبرگشت و اجرای کامل ماتریس قابلیت‌های تلگرام.

## کنترل ریسک انتشار

- انتشار پیش‌فرض تنها پس از تأیید نهایی انجام می‌شود.
- هر درخواست انتشار `idempotencyKey` دارد تا با دوبار کلیک یا تلاش مجدد، پست تکراری ساخته نشود.
- وضعیت هر مقصد جدا ثبت می‌شود: `queued`، `processing`، `published` یا `failed`.
- خطا و شناسهٔ خروجی مقصد در تاریخچهٔ پروژه می‌ماند.
