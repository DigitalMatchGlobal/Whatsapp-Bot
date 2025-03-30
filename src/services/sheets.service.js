// Archivo: src/services/sheets.service.js
const fs = require("fs");
const { google } = require("googleapis");

let sheets;
const SHEET_NAME = "ListadoConsultas";
const SHEETS_ID = process.env.GOOGLE_SHEETS_ID;
const CREDENTIALS_PATH = process.env.GOOGLE_SHEETS_CREDENTIALS_FILE;

function connectSheets() {
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, "utf8"));
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });
  sheets = google.sheets({ version: "v4", auth });
}

async function writeToSheet(phone, name, message, contexto, estado) {
  const now = new Date();
  const montevideoTime = now.toLocaleString("es-UY", { timeZone: "America/Montevideo" });
  const [date, time] = montevideoTime.split(", ");

  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEETS_ID,
      range: `${SHEET_NAME}!A:J`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [[phone, name, date, message, contexto, estado, time, time, 1]]
      }
    });
    console.log("✅ Nuevo mensaje registrado en Google Sheets");
  } catch (error) {
    console.error("❌ Error escribiendo en Sheets:", error);
  }
}

module.exports = {
  connectSheets,
  writeToSheet
};
