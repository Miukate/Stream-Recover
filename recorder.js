let currentLang = "ru";
let currentTheme = "auto";
let currentPlatform = "twitch";
let selectedTabId = null;
let selectedQuality = null;
let selectedFormat = "ts";
let hlsData = null;
let dirHandle = null;

let isRecording = false;
let writable = null;
let remuxer = null;
let stopRequested = false;
let startTime = 0;
let stats = { bytes: 0, segments: 0, failed: 0 };
let qualityUrl = "";

const T = {
  ru: {
    noTwitch: "Нет открытых вкладок Twitch",
    noKick: "Нет открытых вкладок Kick",
    waitingHls: "Ожидание HLS-потока...",
    recording: "Запись...",
    stopped: "Запись остановлена",
    streamEnded: "Стрим закончился",
    hlsFound: "HLS найден. Выберите качество.",
    hlsNotFound: "HLS не найден. Откройте стрим и подождите.",
    folderNotSelected: "Папка не выбрана. Откройте Настройки.",
    folderNotSelectedText: "Не выбрана",
    error: "Ошибка",
    mp4: ".mp4 (ремукс)",
    ts: ".ts (без ремукса)",
    auto: "Системная",
    dark: "Тёмная",
    light: "Светлая"
  },
  en: {
    noTwitch: "No open Twitch tabs",
    noKick: "No open Kick tabs",
    waitingHls: "Waiting for HLS...",
    recording: "Recording...",
    stopped: "Recording stopped",
    streamEnded: "Stream ended",
    hlsFound: "HLS found. Choose quality.",
    hlsNotFound: "HLS not found. Open a stream and wait.",
    folderNotSelected: "No folder selected. Open Settings.",
    folderNotSelectedText: "Not selected",
    error: "Error",
    mp4: ".mp4 (remux)",
    ts: ".ts (no remux)",
    auto: "System",
    dark: "Dark",
    light: "Light"
  }
};

function t(k) { return T[currentLang][k]; }

function applyLang() {
  document.querySelectorAll("[data-ru]").forEach((el) => {
    el.textContent = el.dataset[currentLang];
  });
  document.getElementById("langToggle").textContent = currentLang;
  document.getElementById("formatTrigger").textContent = t(selectedFormat);
  document.getElementById("themeTrigger").textContent = t(currentTheme);

  const folderEl = document.getElementById("folderName");
  if (dirHandle) {
    folderEl.textContent = dirHandle.name;
  } else {
    folderEl.textContent = t("folderNotSelectedText");
  }

  if (!selectedTabId) {
    document.getElementById("status").textContent = currentPlatform === 'twitch' ? t("noTwitch") : t("noKick");
  }
}

function applyTheme(theme) {
  currentTheme = theme;
  if (theme === "auto") {
    const dark = matchMedia("(prefers-color-scheme: dark)").matches;
    document.body.dataset.theme = dark ? "dark" : "light";
  } else {
    document.body.dataset.theme = theme;
  }
  document.getElementById("themeTrigger").textContent = t(theme);
  chrome.storage.local.set({ theme });
}

function setPlatform(platform) {
  currentPlatform = platform;
  document.body.className = `theme-${platform}`;
  
  document.getElementById("platformTwitch").classList.toggle("active", platform === "twitch");
  document.getElementById("platformKick").classList.toggle("active", platform === "kick");
  
  selectedTabId = null;
  hlsData = null;
  document.getElementById("tabTrigger").textContent = "—";
  document.getElementById("qualityTrigger").textContent = t("waitingHls");
  document.getElementById("qualityOptions").innerHTML = "";
  document.getElementById("hlsHint").textContent = t("hlsNotFound");
  document.getElementById("status").textContent = "";
  
  loadStreamTabs();
  chrome.storage.local.set({ platform });
}

document.getElementById("platformTwitch").addEventListener("click", () => setPlatform("twitch"));
document.getElementById("platformKick").addEventListener("click", () => setPlatform("kick"));

document.getElementById("langToggle").addEventListener("click", () => {
  currentLang = currentLang === "ru" ? "en" : "ru";
  applyLang();
  loadStreamTabs();
});

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
  });
});

function initSelect(wrapId, trigId, optId, onPick) {
  const wrap = document.getElementById(wrapId);
  const trig = document.getElementById(trigId);
  const opts = document.getElementById(optId);
  trig.addEventListener("click", () => {
    document.querySelectorAll(".select-options.open").forEach((el) => {
      if (el !== opts) el.classList.remove("open");
    });
    opts.classList.toggle("open");
  });
  opts.addEventListener("click", (e) => {
    const it = e.target.closest("div[data-value]");
    if (!it) return;
    trig.textContent = it.textContent;
    opts.classList.remove("open");
    onPick(it.dataset.value);
  });
  document.addEventListener("click", (e) => {
    if (!wrap.contains(e.target)) opts.classList.remove("open");
  });
}

// ЖЕСТКАЯ ОЧИСТКА НАЗВАНИЯ (просто берем всё до первого дефиса)
function cleanTabTitle(title) {
  if (!title) return "";
  // Разбиваем строку по " - " и берем первую часть (название стрима)
  let clean = title.split(" - ")[0];
  // Дополнительно на всякий случай чистим от слов Twitch/Kick в конце
  clean = clean.replace(/\s*(Twitch|Kick)$/i, "");
  return clean.trim();
}

async function loadStreamTabs() {
  const pattern = currentPlatform === "twitch" ? "*://*.twitch.tv/*" : "*://*.kick.com/*";
  const tabs = await chrome.tabs.query({ url: pattern });
  
  const el = document.getElementById("tabOptions");
  el.innerHTML = "";
  
  if (!tabs.length) {
    const noTabText = currentPlatform === "twitch" ? t("noTwitch") : t("noKick");
    el.innerHTML = `<div style="color:var(--text-muted);padding:8px 10px;">${noTabText}</div>`;
    document.getElementById("tabTrigger").textContent = "—";
    document.getElementById("status").textContent = noTabText;
    selectedTabId = null;
    return;
  }
  
  tabs.forEach((tab) => {
    const d = document.createElement("div");
    d.dataset.value = tab.id;
    d.textContent = cleanTabTitle(tab.title);
    el.appendChild(d);
  });
  
  selectedTabId = tabs[0].id;
  document.getElementById("tabTrigger").textContent = cleanTabTitle(tabs[0].title);
  document.getElementById("status").textContent = "";
  
  fetchHls(selectedTabId);
}

document.getElementById("refreshTabsBtn").addEventListener("click", () => {
  loadStreamTabs();
  if (selectedTabId) fetchHls(selectedTabId);
});

let fetchRetryCount = 0;
function fetchHls(tabId) {
  document.getElementById("qualityTrigger").textContent = t("waitingHls");
  document.getElementById("hlsHint").textContent = t("hlsNotFound");
  
  chrome.runtime.sendMessage({ action: "getHls", tabId }, (res) => {
    if (res?.data) {
      hlsData = res.data;
      renderQualities(res.data.qualities);
      document.getElementById("hlsHint").textContent = t("hlsFound");
      fetchRetryCount = 0;
    } else {
      chrome.runtime.sendMessage({ action: "forceFindHls", tabId }, (fRes) => {
        if (fRes?.data) {
          hlsData = fRes.data;
          renderQualities(fRes.data.qualities);
          document.getElementById("hlsHint").textContent = t("hlsFound");
          fetchRetryCount = 0;
        } else {
          hlsData = null;
          renderQualities([]);
          
          // Если Kick не отдал ссылку сразу, пробуем еще пару раз с задержкой
          if (currentPlatform === 'kick' && fetchRetryCount < 3) {
            fetchRetryCount++;
            setTimeout(() => fetchHls(tabId), 2000);
          } else {
            document.getElementById("hlsHint").textContent = t("hlsNotFound");
          }
        }
      });
    }
  });
}

function renderQualities(qualities) {
  const trig = document.getElementById("qualityTrigger");
  const el = document.getElementById("qualityOptions");
  el.innerHTML = "";
  if (!qualities.length) {
    trig.textContent = t("waitingHls");
    selectedQuality = null;
    return;
  }
  qualities.forEach((q, i) => {
    const d = document.createElement("div");
    d.dataset.value = i;
    d.textContent = q.label;
    el.appendChild(d);
  });
  trig.textContent = qualities[0].label;
  selectedQuality = qualities[0];
}

initSelect("tabSelectWrapper", "tabTrigger", "tabOptions", (v) => {
  selectedTabId = parseInt(v, 10);
  document.getElementById("status").textContent = "";
  fetchRetryCount = 0;
  fetchHls(selectedTabId);
});
initSelect("qualitySelectWrapper", "qualityTrigger", "qualityOptions", (v) => {
  if (hlsData?.qualities[v]) selectedQuality = hlsData.qualities[v];
});
initSelect("formatSelectWrapper", "formatTrigger", "formatOptions", (v) => {
  selectedFormat = v;
  chrome.storage.local.set({ format: v });
});
initSelect("themeSelectWrapper", "themeTrigger", "themeOptions", (v) => applyTheme(v));

function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open("twitch-recorder", 2);
    r.onupgradeneeded = () => {
      if (!r.result.objectStoreNames.contains("handles")) {
        r.result.createObjectStore("handles");
      }
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function saveDirHandle(h) {
  const db = await openDB();
  return new Promise((res) => {
    const tx = db.transaction("handles", "readwrite");
    tx.objectStore("handles").put(h, "saveDir");
    tx.oncomplete = res;
  });
}

async function loadDirHandle() {
  try {
    const db = await openDB();
    return await new Promise((res) => {
      const r = db.transaction("handles", "readonly").objectStore("handles").get("saveDir");
      r.onsuccess = () => res(r.result || null);
      r.onerror = () => res(null);
    });
  } catch { return null; }
}

async function verifyPermission(h) {
  const o = { mode: "readwrite" };
  if (await h.queryPermission(o) === "granted") return true;
  return (await h.requestPermission(o)) === "granted";
}

document.getElementById("pickFolderBtn").addEventListener("click", async () => {
  try {
    dirHandle = await window.showDirectoryPicker({ mode: "readwrite" });
    document.getElementById("folderName").textContent = dirHandle.name;
    await saveDirHandle(dirHandle);
    await chrome.storage.local.set({ folderName: dirHandle.name });
  } catch (e) { if (e.name !== "AbortError") console.error(e); }
});

function setStatus(msg) { document.getElementById("status").textContent = msg; }

function setRecordingUI(rec) {
  isRecording = rec;
  document.getElementById("startBtn").disabled = rec;
  document.getElementById("stopBtn").disabled = !rec;
  document.getElementById("endStreamBtn").disabled = rec;
  document.getElementById("progress").style.display = rec ? "block" : "none";
}

function fmtTime(sec) {
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

async function fetchWithRetry(url, retries = 3) {
  let last;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return res;
      last = new Error("HTTP " + res.status);
    } catch (e) { last = e; }
    await sleep(1000 * Math.pow(2, i));
  }
  throw last;
}

function parseMedia(text, base) {
  const lines = text.split("\n");
  const segs = [];
  let key = null, disc = false, seq = 0, endList = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#EXT-X-KEY:")) {
      const attrs = {};
      const re = /([A-Z0-9-]+)=("([^"]*)"|([^,]*))/g;
      let m;
      while ((m = re.exec(line.slice(11)))) attrs[m[1]] = m[3] ?? m[4];
      key = attrs;
    } else if (line === "#EXT-X-DISCONTINUITY") disc = true;
    else if (line === "#EXT-X-ENDLIST") endList = true;
    else if (!line.startsWith("#")) {
      segs.push({ url: new URL(line, base).href, seq: seq++, key, discontinuity: disc });
      disc = false;
    }
  }
  return { segments: segs, endList };
}

async function decryptSegment(data, keyInfo, seq, baseUrl, keyCache) {
  if (!keyInfo || !keyInfo.METHOD || keyInfo.METHOD === "NONE" || keyInfo.METHOD !== "AES-128") return data;
  const keyUrl = new URL(keyInfo.URI, baseUrl).href;
  let keyBuf = keyCache.get(keyUrl);
  if (!keyBuf) {
    const r = await fetch(keyUrl);
    keyBuf = await r.arrayBuffer();
    keyCache.set(keyUrl, keyBuf);
  }
  const cKey = await crypto.subtle.importKey("raw", keyBuf, { name: "AES-CBC" }, false, ["decrypt"]);
  let iv;
  if (keyInfo.IV) iv = hexToBytes(keyInfo.IV.replace(/^0x/, ""));
  else {
    iv = new Uint8Array(16);
    new DataView(iv.buffer).setUint32(12, seq);
  }
  const dec = await crypto.subtle.decrypt({ name: "AES-CBC", iv }, cKey, data);
  return new Uint8Array(dec);
}

class Mp4Remuxer {
  constructor(writable, onWrite) {
    this.initWritten = false;
    this.tx = new muxjs.mp4.Transmuxer({ remux: true, keepOriginalTimestamps: false });
    this.tx.on("data", (s) => {
      if (!this.initWritten && s.initSegment) {
        onWrite(new Uint8Array(s.initSegment));
        this.initWritten = true;
      }
      if (s.data?.length) onWrite(new Uint8Array(s.data));
    });
  }
  push(d) { this.tx.push(d); }
  flush() { this.tx.flush(); }
}

async function startRecordingLocal() {
  if (!selectedTabId) return setStatus(currentPlatform === 'twitch' ? t("noTwitch") : t("noKick"));
  if (!selectedQuality) return setStatus(t("hlsNotFound"));
  if (!dirHandle) return setStatus(t("folderNotSelected"));

  const o = { mode: "readwrite" };
  if (await dirHandle.queryPermission(o) !== "granted") {
    if (await dirHandle.requestPermission(o) !== "granted") {
      return setStatus(t("error") + ": Permission denied");
    }
  }

  const ext = selectedFormat === "mp4" ? "mp4" : "ts";
  try {
    const fh = await dirHandle.getFileHandle(`stream-record-${Date.now()}.${ext}`, { create: true });
    writable = await fh.createWritable();
  } catch (e) {
    return setStatus(t("error") + ": " + e.message);
  }

  isRecording = true;
  stopRequested = false;
  startTime = Date.now();
  stats = { bytes: 0, segments: 0, failed: 0 };
  qualityUrl = selectedQuality.url;
  const keyCache = new Map();

  setRecordingUI(true);
  setStatus(t("recording"));
  chrome.runtime.sendMessage({ action: "recordingStarted" });

  let writeQueue = Promise.resolve();
  const queueWrite = (buf) => {
    writeQueue = writeQueue.then(() => writable.write(buf)).catch(console.error);
  };

  if (selectedFormat === "mp4") {
    remuxer = new Mp4Remuxer(writable, queueWrite);
  }

  pollAndRecordLocal(queueWrite, keyCache).catch((e) => {
    console.error(e);
    setStatus(t("error") + ": " + e.message);
    stopRecordingLocal("error");
  });
}

async function pollAndRecordLocal(queueWrite, keyCache) {
  const seen = new Set();
  let currentRemuxer = remuxer;

  while (!stopRequested) {
    try {
      const url = qualityUrl + (qualityUrl.includes("?") ? "&" : "?") + "_=" + Date.now();
      const res = await fetchWithRetry(url);
      const { segments, endList } = parseMedia(await res.text(), qualityUrl);

      for (const seg of segments) {
        if (stopRequested) break;
        if (seen.has(seg.url)) continue;
        seen.add(seg.url);

        let buf;
        try {
          const r = await fetchWithRetry(seg.url);
          buf = new Uint8Array(await r.arrayBuffer());
        } catch { stats.failed++; continue; }

        if (seg.key?.METHOD === "AES-128") {
          try { buf = await decryptSegment(buf, seg.key, seg.seq, qualityUrl, keyCache); }
          catch { stats.failed++; continue; }
        }

        if (seg.discontinuity && currentRemuxer) {
          currentRemuxer.flush();
          await sleep(200);
          currentRemuxer = new Mp4Remuxer(writable, queueWrite);
        }

        if (currentRemuxer) currentRemuxer.push(buf);
        else queueWrite(buf);

        stats.bytes += buf.byteLength;
        stats.segments++;
        updateProgress();
      }

      if (endList) {
        setStatus(t("streamEnded"));
        await stopRecordingLocal("streamEnded");
        return;
      }
    } catch (e) { console.warn("Poll error:", e); }
    await sleep(4000);
  }
}

function updateProgress() {
  const el = (Date.now() - startTime) / 1000;
  const mb = stats.bytes / (1024 * 1024);
  document.getElementById("progTimeSize").textContent = `${fmtTime(el)} · ${mb.toFixed(1)} MB`;
  document.getElementById("progStats").textContent = `${stats.segments} segs · ${stats.failed} failed`;
}

async function stopRecordingLocal(reason = "user") {
  if (!isRecording) return;
  isRecording = false;
  stopRequested = true;
  
  if (remuxer) {
    remuxer.flush();
    await sleep(1000);
  }
  try { if (writable) await writable.close(); } catch (_) {}
  
  remuxer = null;
  writable = null;
  
  setRecordingUI(false);
  setStatus(reason === "streamEnded" ? t("streamEnded") : t("stopped"));
  chrome.runtime.sendMessage({ action: "recordingStopped" });
}

window.addEventListener("beforeunload", (e) => {
  if (isRecording) {
    e.preventDefault();
    e.returnValue = "";
  }
});

document.getElementById("startBtn").addEventListener("click", startRecordingLocal);
document.getElementById("endStreamBtn").addEventListener("click", startRecordingLocal);

document.getElementById("stopBtn").addEventListener("click", () => {
  stopRecordingLocal("user");
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "hlsDetected" && msg.tabId === selectedTabId) {
    hlsData = { qualities: msg.qualities };
    renderQualities(msg.qualities);
    document.getElementById("hlsHint").textContent = t("hlsFound");
  }
});

document.getElementById("exportBtn").addEventListener("click", async () => {
  const data = await chrome.storage.local.get(null);
  delete data.defaultTabId;
  delete data.defaultQualityUrl;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `stream-recorder-settings.json`; a.click();
  URL.revokeObjectURL(url);
});

document.getElementById("importBtn").addEventListener("click", () => document.getElementById("importInput").click());
document.getElementById("importInput").addEventListener("change", async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    await chrome.storage.local.set(data);
    if (data.theme) applyTheme(data.theme);
    setStatus(currentLang === "ru" ? "Настройки импортированы" : "Settings imported");
  } catch (err) { setStatus(t("error") + ": " + err.message); }
});

(async () => {
  const st = await chrome.storage.local.get(["theme", "format", "folderName", "platform"]);
  applyTheme(st.theme || "auto");
  if (st.format) selectedFormat = st.format;

  const h = await loadDirHandle();
  if (h) {
    dirHandle = h;
  }

  applyLang();
  setPlatform(st.platform || "twitch");

  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (currentTheme === "auto") applyTheme("auto");
  });
})();