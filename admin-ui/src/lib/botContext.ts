const BOT_KEY = "active_bot_id";
const MANAGE_KEY = "bot_manage_mode";

export function getStoredBotId() {
  if (typeof window === "undefined") return "";
  return window.sessionStorage.getItem(BOT_KEY) || "";
}

export function setStoredBotId(botId: string) {
  if (typeof window === "undefined") return;
  if (botId) {
    window.sessionStorage.setItem(BOT_KEY, botId);
  } else {
    window.sessionStorage.removeItem(BOT_KEY);
  }
}

export function getManageMode() {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(MANAGE_KEY) === "true";
}

export function setManageMode(value: boolean) {
  if (typeof window === "undefined") return;
  if (value) {
    window.sessionStorage.setItem(MANAGE_KEY, "true");
  } else {
    window.sessionStorage.removeItem(MANAGE_KEY);
  }
}
