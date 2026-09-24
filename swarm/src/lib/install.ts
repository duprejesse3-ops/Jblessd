type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

let deferred: PromptEvent | null = null;
const listeners = new Set<() => void>();
let swArmed = false;

export const LIVE_INSTALL_URL = "https://multinicheai.com/swarm?install=1";

function emit() {
  for (const fn of listeners) fn();
}

export function subscribeInstall(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function getDeferredPrompt() {
  return deferred;
}

export function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: window-controls-overlay)").matches ||
    ("standalone" in navigator && Boolean((navigator as { standalone?: boolean }).standalone))
  );
}

export function platformOf() {
  if (typeof navigator === "undefined") return "other" as const;
  const ua = navigator.userAgent;
  if (/Windows/i.test(ua)) return "windows" as const;
  if (/Android/i.test(ua)) return "android" as const;
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios" as const;
  if (/Mac/i.test(ua)) return "mac" as const;
  return "other" as const;
}

export function isEmbedded() {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function isPreviewHost() {
  if (typeof location === "undefined") return false;
  return /grok-sandbox|grok\.com|localhost|127\.0\.0\.1/i.test(location.hostname);
}

export function isInAppBrowser() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/Instagram|FBAN|FBAV|FB_IAB|Line\/|Twitter|TikTok|Snapchat|LinkedInApp|Grok\/|; wv\)/i.test(ua)) {
    return true;
  }
  if (/Android/i.test(ua) && /\bwv\b/.test(ua)) return true;
  const ios = /iPhone|iPad|iPod/i.test(ua);
  if (ios && /AppleWebKit/i.test(ua) && !/Safari/i.test(ua)) return true;
  return false;
}

export function wantsNativeInstall() {
  if (typeof location === "undefined") return false;
  return new URLSearchParams(location.search).has("install");
}

function targetInstallUrl() {
  if (isPreviewHost()) return LIVE_INSTALL_URL;
  const u = new URL(location.href);
  u.searchParams.set("install", "1");
  return u.toString();
}

export function chromeInstallIntent(url = targetInstallUrl()) {
  const u = new URL(url, LIVE_INSTALL_URL);
  const path = `${u.host}${u.pathname}${u.search}${u.hash}`;
  return `intent://${path}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(u.toString())};end`;
}

export function registerServiceWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator) || swArmed) return;
  swArmed = true;
  void navigator.serviceWorker.register("/sw.js").catch(() => {});
}

export function armInstallCapture() {
  if (typeof window === "undefined") return;
  registerServiceWorker();
  window.addEventListener("beforeinstallprompt", (event) => {
    // Keep the event so the in-page button can install inside Chrome.
    // Native mini-infobar is suppressed in favor of Download.
    event.preventDefault();
    deferred = event as PromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    emit();
  });
}

export async function promptInstall() {
  if (!deferred) return { ok: false as const, reason: "none" as const };
  await deferred.prompt();
  const choice = await deferred.userChoice;
  deferred = null;
  emit();
  return { ok: true as const, outcome: choice.outcome };
}

export type InstallResult = "accepted" | "dismissed" | "opened-chrome" | "ios" | "none";

/** One tap: install in Chrome, or hand the same URL to Chrome from an in-app browser. */
export async function installApp(): Promise<InstallResult> {
  if (typeof window === "undefined") return "none";
  if (isStandalone()) return "accepted";
  registerServiceWorker();

  if (deferred) {
    const result = await promptInstall();
    if (result.ok) return result.outcome === "accepted" ? "accepted" : "dismissed";
  }

  const android = platformOf() === "android";
  const ios = platformOf() === "ios";

  if (ios) return "ios";

  if (android && (isInAppBrowser() || isEmbedded() || isPreviewHost())) {
    window.location.href = chromeInstallIntent();
    return "opened-chrome";
  }

  if (isEmbedded() || isPreviewHost()) {
    window.open(LIVE_INSTALL_URL, "_blank", "noopener");
    return "opened-chrome";
  }

  return "none";
}
