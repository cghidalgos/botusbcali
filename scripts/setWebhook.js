import dotenv from "dotenv";

dotenv.config();

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_BASE = process.argv[2] || process.env.WEBHOOK_BASE;

if (!TELEGRAM_TOKEN) {
  throw new Error("TELEGRAM_BOT_TOKEN no está definido en .env");
}

if (!WEBHOOK_BASE) {
  throw new Error(
    "Debes indicar la URL pública de tu servidor (WEBHOOK_BASE o como argumento)");
}

const normalizedBase = WEBHOOK_BASE.replace(/\/+$/, "");
const webhookUrl = `${normalizedBase}/webhook`;

(async () => {
  const response = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_TOKEN}/setWebhook`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ url: webhookUrl }),
    }
  );

  const body = await response.json();
  console.log(JSON.stringify(body, null, 2));
})().catch((error) => {
  console.error("No se pudo registrar el webhook:", error);
  process.exit(1);
});
