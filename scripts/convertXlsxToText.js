import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";

async function convertXlsxToText() {
  const xlsxPath = "/Users/cgiohidalgos/Desktop/botusbcali/uploads/70b51ed58badb39a40324da19cc0a65e.xlsx";
  const outputPath = "/Users/cgiohidalgos/Desktop/botusbcali/data/horarios_cursos.txt";

  if (!fs.existsSync(xlsxPath)) {
    console.error(`❌ Archivo no encontrado: ${xlsxPath}`);
    process.exit(1);
  }

  console.log("📖 Leyendo XLSX...");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(xlsxPath);

  let textContent = "INFORMACIÓN DE CURSOS, HORARIOS Y AULAS\n";
  textContent += "=" + "=".repeat(60) + "\n\n";

  // Procesa cada hoja
  workbook.eachSheet((worksheet, sheetId) => {
    console.log(`   Procesando hoja: "${worksheet.name}"`);
    textContent += `\nHOJA: ${worksheet.name.toUpperCase()}\n`;
    textContent += "-".repeat(60) + "\n\n";

    // Extraer datos
    let rowNum = 0;
    worksheet.eachRow((row, rowNumber) => {
      rowNum++;
      const values = row.values
        .slice(1) // Omite el índice 0 (multer)
        .map((val) => (val !== undefined && val !== null ? String(val).trim() : ""))
        .filter((val) => val); // Elimina vacíos

      if (values.length > 0) {
        textContent += values.join(" | ") + "\n";
      }
    });

    textContent += "\n";
  });

  // Guardar
  fs.writeFileSync(outputPath, textContent, "utf8");
  const sizeKb = (fs.statSync(outputPath).size / 1024).toFixed(2);
  
  console.log(`✅ Texto convertido: ${outputPath}`);
  console.log(`📊 Tamaño: ${sizeKb} KB`);
  console.log(`📝 Líneas procesadas: ${textContent.split("\n").length}`);
}

convertXlsxToText().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
