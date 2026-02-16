import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";

async function scrapeTeachers() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  console.log("Abriendo página...");
  await page.goto("https://usbcali.edu.co/facultad/ingenieria/", {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  }).catch(() => console.log("Navegación parcial completada"));

  console.log("Esperando a que se cargue el contenido dinámico...");

  // Espera a que los docentes se carguen
  await page.waitForSelector("[class*='docente'], [class*='profesor'], .team-member, li", {
    timeout: 30000,
  });

  // Scroll para cargar lazy content
  console.log("Scrolleando para cargar todo el contenido...");
  await page.evaluate(() => {
    document.body.parentElement.scrollTop = document.body.parentElement.scrollHeight;
  });

  // Espera más para lazy loading
  await page.waitForTimeout(3000);

  // Obtén el HTML completo
  const html = await page.content();

  // Guarda el HTML
  const outputDir = path.dirname(new URL(import.meta.url).pathname);
  const outputPath = path.join(outputDir, "../data/faculty_teachers.html");

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, html);

  console.log(`✅ HTML guardado en: ${outputPath}`);
  console.log(`📊 Tamaño: ${(fs.statSync(outputPath).size / 1024).toFixed(2)} KB`);

  await browser.close();
}

scrapeTeachers().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
