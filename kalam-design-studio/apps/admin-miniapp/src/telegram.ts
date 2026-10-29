export type TelegramWebApp = {
  initData: string;
  initDataUnsafe?: { user?: { id?: number } };
  platform?: string;
  version?: string;
  ready: () => void;
  expand: () => void;
  openLink?: (url: string, options?: { try_instant_view?: boolean }) => void;
  MainButton?: { hide: () => void };
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

let preparedWebApp: TelegramWebApp | undefined;

export function initialiseTelegram(): TelegramWebApp | undefined {
  const app = window.Telegram?.WebApp;
  // The bridge may be injected after our first render.  The caller retries
  // until initData arrives, but these are one-time host commands; issuing them
  // on every retry floods Telegram's WebView log and can trigger relayouts.
  if (app && app !== preparedWebApp) {
    app.ready();
    app.expand();
    app.MainButton?.hide();
    preparedWebApp = app;
  }
  return app;
}
