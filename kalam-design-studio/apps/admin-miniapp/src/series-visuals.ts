import type { ContentSlide } from "./api";

const automatic = () => ({ mode: "auto" as const, assetIds: [] as string[] });

export function slideVisualIssue(slide: ContentSlide, fileCount: number, monitorFileCount: number): string {
  if (["preserve", "reference"].includes(slide.imageMode ?? "") && !fileCount) return "برای تصویر مرجع همین اسلاید، فایل اضافه کنید.";
  if (slide.imageMode !== "studio") return "";
  if (["exact_reference", "faithful_reference"].includes(slide.studioLocationMode ?? "") && !(slide.studioLocationAssetIds ?? []).length) return "مرجع اختصاصی لوکیشن همین اسلاید را انتخاب کنید.";
  if (slide.studioLocationMode === "generated_prompt" && (slide.studioLocationPrompt ?? "").trim().length < 4) return "پرامپت ساخت لوکیشن همین اسلاید را کامل کنید.";
  if (slide.studioMonitorMode === "images" && slide.studioMonitorImageMode !== "generate" && !monitorFileCount) return "تصویر را در بخش «تصاویر اختصاصی مانیتور این اسلاید» پیوست کنید.";
  if ((slide.presenterIds ?? []).some(id => slide.presenterReferenceSelection?.[id]?.mode === "manual" && !slide.presenterReferenceSelection[id].assetIds.length)) return "برای مجری، تصویر هویتی را انتخاب کنید یا حالت خودکار را بزنید.";
  return "";
}

/** Never read the single-image form here. This is the entire slide contract. */
export function slideVisualContract(slide: ContentSlide) {
  const studio = slide.imageMode === "studio";
  const presenterIds = studio ? [...(slide.presenterIds ?? [])] : [];
  const monitorMode = slide.studioMonitorMode ?? "blank";
  const locationMode = slide.studioLocationMode ?? "catalog";
  const locationId = slide.studioLocationId || "newsroom";
  return {
    image: {
      mode: slide.imageMode ?? "generate",
      prompt: slide.imageMode === "generate" || studio ? (slide.imagePrompt ?? "").trim() : "",
      referenceInstructions: ["preserve", "reference"].includes(slide.imageMode ?? "") ? (slide.referenceInstructions ?? "").trim() : "",
      presenterIds,
      referenceSelection: { presenters: Object.fromEntries(presenterIds.map(id => [id, slide.presenterReferenceSelection?.[id] ?? automatic()])) },
    },
    studio: studio ? {
      presenterIds,
      locationId,
      location: {
        mode: locationMode, id: locationId,
        assetIds: ["exact_reference", "faithful_reference"].includes(locationMode) ? [...(slide.studioLocationAssetIds ?? [])] : [],
        prompt: locationMode === "generated_prompt" ? (slide.studioLocationPrompt ?? "").trim() : "",
        referenceInstructions: locationMode === "faithful_reference" ? (slide.studioLocationReferenceInstructions ?? "").trim() : "",
      },
      textMode: "monitor", text: "", monitorText: monitorMode === "text" ? (slide.studioMonitorText ?? "").trim() : "",
      monitor: {
        enabled: monitorMode !== "disabled", mode: monitorMode,
        text: monitorMode === "text" ? (slide.studioMonitorText ?? "").trim() : "",
        imageMode: slide.studioMonitorImageMode ?? "preserve",
        imageCount: slide.studioMonitorImageCount ?? 1,
        brief: monitorMode === "images" ? (slide.studioMonitorBrief ?? "").trim() : "",
      },
      expressions: slide.studioExpressions ?? {},
      titleSpace: { enabled: slide.studioTitleSpaceEnabled ?? false, placement: slide.studioTitleSpacePlacement ?? "auto", textHint: slide.studioTitleSpaceText ?? "" },
      characterInstructions: slide.studioCharacterInstructions ?? {},
      speechBubbles: slide.studioSpeechBubbles ?? {},
      referenceSelection: {
        presenters: Object.fromEntries(presenterIds.map(id => [id, slide.presenterReferenceSelection?.[id] ?? automatic()])),
        location: locationMode === "catalog" ? slide.studioLocationReferences ?? automatic() : automatic(),
      },
    } : undefined,
  };
}

/** Seed only visual settings once; never copy slide text, prompts or content files. */
export function seedNextSlide<T extends ContentSlide>(previous: T, next: T): T {
  if (next.visualSettingsInitialized) return next;
  return {
    ...next,
    imageMode: previous.imageMode ?? "generate",
    imageEngine: previous.imageEngine ?? "",
    imageQuality: previous.imageQuality ?? "medium",
    presenterIds: [...(previous.presenterIds ?? [])],
    presenterReferenceSelection: structuredClone(previous.presenterReferenceSelection ?? {}),
    studioLocationId: previous.studioLocationId,
    studioLocationMode: previous.studioLocationMode,
    studioLocationAssetIds: [...(previous.studioLocationAssetIds ?? [])],
    studioLocationPrompt: previous.studioLocationPrompt,
    studioLocationReferenceInstructions: previous.studioLocationReferenceInstructions,
    studioLocationReferences: structuredClone(previous.studioLocationReferences ?? automatic()),
    studioMonitorMode: previous.studioMonitorMode ?? "blank",
    studioMonitorImageMode: previous.studioMonitorImageMode ?? "preserve",
    studioMonitorImageCount: previous.studioMonitorImageCount ?? 1,
    newsOutputKind: previous.newsOutputKind,
    newsPhotoFrame: previous.newsPhotoFrame,
    videoOverlay: previous.videoOverlay,
    videoFrame: previous.videoFrame,
    videoBackgroundBlur: previous.videoBackgroundBlur,
    siteLinkPlaceholder: previous.siteLinkPlaceholder,
    studioTitleSpaceEnabled: previous.studioTitleSpaceEnabled,
    studioTitleSpacePlacement: previous.studioTitleSpacePlacement,
    // Monitor text/images, gestures and additional instructions describe this
    // slide's content, not the series identity. Keep the next slide's values.
    visualSettingsInitialized: true,
  };
}

export function slideNewsContract(slide: ContentSlide) {
  return {
    outputKind: slide.imageMode === "none" ? "title_only" : slide.newsOutputKind ?? "title_photo",
    photoFrame: slide.newsPhotoFrame ?? "full", layout: slide.titleLayout ?? "top",
    videoOverlay: slide.videoOverlay ?? false, videoFrame: slide.videoFrame ?? "landscape",
    videoBackgroundBlur: slide.videoBackgroundBlur ?? false, siteLinkPlaceholder: slide.siteLinkPlaceholder ?? false,
  };
}
