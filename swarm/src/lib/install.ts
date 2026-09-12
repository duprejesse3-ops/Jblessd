type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

let deferred: PromptEvent | null = null;
const listeners = new Set<() => void>();

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

export function armInstallCapture() {
  if (typeof window === "undefined") return;
  window.addEventListener("beforeinstallprompt", (event) => {
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
