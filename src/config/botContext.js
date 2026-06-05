export const DEFAULT_BOT_ID = process.env.DEFAULT_BOT_ID || "default";

export function normalizeBotId(botId) {
  const normalized = String(botId || "").trim();
  return normalized || DEFAULT_BOT_ID;
}
