const btn = document.getElementById("chooseFolder");
const status = document.getElementById("status");

btn.addEventListener("click", async () => {
  try {
    const dirHandle = await window.showDirectoryPicker({ mode: "readwrite" });
    await saveDirHandle(dirHandle);
    
    await chrome.storage.local.set({ folderName: dirHandle.name });
    
    status.textContent = `Папка «${dirHandle.name}» сохранена. Теперь можно открыть расширение и начать запись.`;
    setTimeout(() => window.close(), 3000);
  } catch (err) {
    if (err.name === "AbortError") {
      status.textContent = "Выбор папки отменён. Вы можете выбрать её позже в настройках расширения.";
    } else {
      status.textContent = "Ошибка: " + err.message;
    }
  }
});

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