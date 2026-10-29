interface ImportMetaEnv {
  readonly BASE_URL: string;
  readonly PROD: boolean;
  readonly VITE_DESIGN_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare const __STUDIO_RELEASE__: string;
