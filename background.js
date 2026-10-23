const hlsStreams = new Map();

function setBadge(text) {
  chrome.action.setBadgeText({ text });
  if (text) chrome.action.setBadgeBackgroundColor({ color: "#eb0400" });
}

function changeIcon(isRecording) {
  const path = isRecording ? {
    "16": "icon/rec16.png", "32": "icon/rec32.png", "48": "icon/rec48.png", "128": "icon/rec128.png"
  } : {
    "16": "icon/icon16.png", "32": "icon/icon32.png", "48": "icon/icon48.png", "128": "icon/icon128.png"
  };
  chrome.action.setIcon({ path }, () => {
    if (chrome.runtime.lastError) console.error(chrome.runtime.lastError.message);
  });
}

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") {
    chrome.tabs.create({ url: chrome.runtime.getURL("onboarding.html") });
  }
});

// Перехват любых m3u8 файлов
chrome.webRequest.onBeforeRequest.addListener((details) => {
  if (details.tabId < 0 || !details.url.includes(".m3u8")) return;
  const tabId = details.tabId;
  
  if (!hlsStreams.has(tabId) || hlsStreams.get(tabId).masterUrl !== details.url) {
    chrome.scripting.executeScript({
      target: { tabId },
      func: async (url) => {
        try {
          const res = await fetch(url);
          const text = await res.text();
          return text.includes("#EXT-X-STREAM-INF") ? text : null;
        } catch(e) { return null; }
      },
      args: [details.url]
    }).then(results => {
      const text = results[0]?.result;
      if (text) {
        const qualities = parseMaster(text, details.url);
        if (qualities.length > 0) {
          hlsStreams.set(tabId, { masterUrl: details.url, qualities });
          chrome.runtime.sendMessage({ action: "hlsDetected", tabId, qualities }).catch(() => {});
        }
      }
    }).catch(() => {});
  }
}, { urls: ["*://*.twitch.tv/*", "*://*.ttvnw.net/*", "*://*.kick.com/*", "*://*.playback.kick.com/*", "*://*.cloudfront.net/*"] });

function parseMaster(text, base) {
  const lines = text.split("\n");
  const out = [];
  let cur = null;
  for (const line of lines) {
    if (line.startsWith("#EXT-X-STREAM-INF:")) {
      const a = line.slice(18);
      const r = a.match(/RESOLUTION=(\d+x\d+)/);
      const f = a.match(/FRAME-RATE=([\d.]+)/);
      const n = a.match(/NAME="([^"]+)"/);
      cur = { resolution: r ? r[1] : "unknown", fps: f ? parseFloat(f[1]) : 30, name: n ? n[1] : "" };
    } else if (line && !line.startsWith("#") && cur) {
      out.push({
        ...cur,
        url: new URL(line.trim(), base).href,
        label: `${cur.name || cur.resolution} (${cur.resolution}@${cur.fps})`
      });
      cur = null;
    }
  }
  out.sort((a, b) => (parseInt(b.resolution.split("x")[1]) || 0) - (parseInt(a.resolution.split("x")[1]) || 0));
  return out;
}

async function forceFindHls(tabId) {
  // 1. Пытаемся найти в кэше браузера
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: async () => {
        const entries = performance.getEntriesByType('resource');
        const m3u8s = [...new Set(entries.map(e => e.name).filter(n => n.includes('.m3u8')))];
        for (const url of m3u8s) {
          try {
            const res = await fetch(url);
            const text = await res.text();
            if (text.includes("#EXT-X-STREAM-INF")) return { url, text };
          } catch (_) {}
        }
        return null;
      }
    });
    
    if (results && results[0].result) {
      const { url, text } = results[0].result;
      const qualities = parseMaster(text, url);
      hlsStreams.set(tabId, { masterUrl: url, qualities });
      return { masterUrl: url, qualities };
    }
  } catch (e) {}

  // 2. Обход API Kick
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab.url && tab.url.includes("kick.com")) {
      // Извлекаем ник, пропуская языковые префиксы (типа /ru/, /en/)
      const urlObj = new URL(tab.url);
      const parts = urlObj.pathname.split('/').filter(p => p && !['ru', 'en', 'es', 'de', 'fr'].includes(p));
      const channel = parts.length > 0 ? parts[0] : null;
      
      if (channel && !["browse", "following", "categories", "video"].includes(channel)) {
        const apiResult = await chrome.scripting.executeScript({
          target: { tabId },
          func: async (ch) => {
            try {
              const res = await fetch(`https://kick.com/api/v2/channels/${ch}`);
              if (!res.ok) return null;
              const data = await res.json();
              
              if (data && data.playback_url) {
                // Обязательно добавляем Referer, иначе Kick блокирует
                const playbackRes = await fetch(data.playback_url, {
                  headers: {
                    'Referer': 'https://kick.com/',
                    'Origin': 'https://kick.com'
                  }
                });
                const text = await playbackRes.text();
                if (text.includes("#EXT-X-STREAM-INF")) {
                  return { url: data.playback_url, text };
                }
              }
            } catch (e) {}
            return null;
          },
          args: [channel]
        });

        if (apiResult && apiResult[0].result) {
          const { url, text } = apiResult[0].result;
          const qualities = parseMaster(text, url);
          hlsStreams.set(tabId, { masterUrl: url, qualities });
          return { masterUrl: url, qualities };
        }
      }
    }
  } catch (e) {
    console.warn("Kick API failed:", e);
  }

  return null;
}

chrome.runtime.onMessage.addListener((msg, _s, respond) => {
  if (msg.action === "getHls") {
    respond({ ok: true, data: hlsStreams.get(msg.tabId) || null });
    return true;
  }
  if (msg.action === "forceFindHls") {
    forceFindHls(msg.tabId).then((data) => respond({ ok: true, data: data }));
    return true;
  }
  if (msg.action === "recordingStarted") {
    changeIcon(true);
    setBadge("REC");
    chrome.notifications.create({
      type: "basic", iconUrl: "icon/icon128.png", 
      title: "Stream Recorder", message: "Запись начата"
    });
    respond({ ok: true });
    return true;
  }
  if (msg.action === "recordingStopped") {
    changeIcon(false);
    setBadge("");
    respond({ ok: true });
    return true;
  }
});

chrome.action.onClicked.addListener(async () => {
  const url = chrome.runtime.getURL("recorder.html");
  const ex = await chrome.tabs.query({ url });
  if (ex.length) return chrome.windows.update(ex[0].windowId, { focused: true });
  chrome.windows.create({ url, type: "popup", width: 420, height: 720 });
});