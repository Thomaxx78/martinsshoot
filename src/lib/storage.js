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
  },
  shoots: [],
};

export function loadDatabase() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved && typeof saved === "object") {
      return {
        settings: { ...defaults.settings, ...saved.settings },
        shoots: Array.isArray(saved.shoots) ? saved.shoots : [],
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
