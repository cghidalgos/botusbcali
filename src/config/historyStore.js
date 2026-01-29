// Simple persistent Q&A history store
import fs from "fs";
import path from "path";

const DATA_PATH = path.resolve("data/history.json");
let history = [];
let loaded = false;

function loadHistory() {
  if (loaded) return;
  try {
    if (fs.existsSync(DATA_PATH)) {
      const raw = fs.readFileSync(DATA_PATH, "utf8");
      history = JSON.parse(raw);
    }
  } catch (e) {
    history = [];
  }
  loaded = true;
}

function persistHistory() {
  try {
    fs.writeFileSync(DATA_PATH, JSON.stringify(history, null, 2), "utf8");
  } catch (e) {}
}

export function getHistory() {
  loadHistory();
  return history.slice();
}

export function addHistoryEntry(entry) {
  loadHistory();
  history.push({
    ...entry,
    timestamp: Date.now(),
  });
  persistHistory();
}

export function clearHistory() {
  loadHistory();
  history = [];
  persistHistory();
}
