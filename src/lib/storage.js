import { EMAIL_MESSAGES } from "./email.js";

const KEY = "shoot-app";

export const defaults = {
  settings: {
    drive: "",
    review: "",
    stripe: "",
    revolut: "",
    paypal: "",
    cur: "€",
    lang: "en",
    pin: "1234",
    stripeUrl: "",
    emailMessages: EMAIL_MESSAGES,
  },
  shoots: [],
};

export function loadDatabase() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved && typeof saved === "object") {
      return {
        settings: { ...defaults.settings, ...saved.settings },
        shoots: Array.isArray(saved.shoots)
          ? saved.shoots.map((shoot) =>
              shoot.emailStatus === "sending"
                ? { ...shoot, emailStatus: "unknown" }
                : shoot,
            )
          : [],
      };
    }
  } catch {
    /* Start with an empty local database if storage is unavailable. */
  }
  return structuredClone(defaults);
}

export function saveDatabase(database) {
  localStorage.setItem(KEY, JSON.stringify(database));
}
