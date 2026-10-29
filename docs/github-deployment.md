# استقرار Kalam Studio با GitHub Actions

هر push به شاخهٔ `main` ابتدا frontend و backend را build و اعتبارسنجی می‌کند و سپس همان release را با SSH/rsync روی سرور فعال می‌کند. نسخهٔ قبلی در مسیر releaseهای سرور باقی می‌ماند و اسکریپت deploy در صورت خطا rollback می‌کند.

در تنظیمات GitHub repository این Secretها را بسازید:

- `KALAM_STUDIO_SSH_HOST`: آدرس سرور
- `KALAM_STUDIO_SSH_PORT`: پورت SSH؛ مقدار فعلی `2244`
- `KALAM_STUDIO_SSH_USER`: مقدار فعلی `root`
- `KALAM_STUDIO_SSH_KEY`: کلید خصوصی deploy، بدون passphrase یا با agent مناسب

کلید عمومی متناظر باید در `authorized_keys` کاربر deploy روی سرور باشد. فایل‌های `.secrets` و داده‌های runtime عمداً وارد repository نمی‌شوند.
