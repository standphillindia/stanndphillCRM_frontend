// src/utils/notificationAlert.ts
//
// Sound + desktop pop-up for new CRM notifications (like WhatsApp Web).
//
//  - Sound: public/sounds/notification.wav, played once per batch of new
//    notifications. Each user can switch it off with the speaker button
//    next to the bell; the choice is remembered in this browser.
//  - Desktop pop-up: shown only while the CRM tab is in the background
//    (the in-page toast already covers the case where it's in front), and
//    only after the user has clicked "Allow" once.
//
// Browsers only let a page play sound after the user has clicked on it
// once — logging in counts, so in practice this just works.

import logoUrl from "../assets/logo.png";

const SOUND_KEY = "crm.notificationSound";
const SOUND_URL = "/sounds/notification.wav";

let audio: HTMLAudioElement | null = null;

export const isSoundOn = (): boolean => {
  try {
    return localStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
};

export const setSoundOn = (on: boolean): void => {
  try {
    localStorage.setItem(SOUND_KEY, on ? "on" : "off");
  } catch {
    // storage blocked (private window) — the toggle still works for this visit
  }
};

/** Plays the notification sound. Never throws (autoplay blocks are ignored). */
export const playNotificationSound = (force = false): void => {
  if (!force && !isSoundOn()) return;
  try {
    if (!audio) {
      audio = new Audio(SOUND_URL);
      audio.volume = 0.7;
    }
    audio.currentTime = 0;
    void audio.play().catch(() => {
      /* browser blocked it — no user click yet */
    });
  } catch {
    /* Audio not supported */
  }
};

const desktopSupported = (): boolean =>
  typeof window !== "undefined" && "Notification" in window;

/** Asks the browser for pop-up permission once (needs a click to call it). */
export const requestDesktopPermission = (): void => {
  if (!desktopSupported()) return;
  if (Notification.permission === "default") {
    void Notification.requestPermission().catch(() => {});
  }
};

/**
 * Shows a Windows/Mac pop-up when the CRM tab is not in front.
 * Clicking it brings the CRM forward and runs onClick.
 */
export const showDesktopNotification = (
  title: string,
  body: string,
  tag: string,
  onClick?: () => void
): void => {
  if (!desktopSupported() || Notification.permission !== "granted") return;
  if (typeof document !== "undefined" && !document.hidden) return;
  try {
    const n = new Notification(title, {
      body: body.length > 140 ? body.slice(0, 137) + "…" : body,
      tag,                     // same notification never pops twice
      icon: logoUrl,
      silent: true,            // our own sound already played
    });
    n.onclick = () => {
      window.focus();
      onClick?.();
      n.close();
    };
  } catch {
    /* some browsers only allow pop-ups from a service worker — skip */
  }
};