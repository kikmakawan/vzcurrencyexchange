// เปลี่ยนเลขเวอร์ชันทุกครั้งที่อัปเดต index.html
const CACHE = "fx-calc-v3";
const FILES = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(FILES.map(f => new Request(f, {cache: "reload"}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith("fx-calc") && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// เก็บเฉพาะไฟล์จริงจากเว็บเรา (กันไม่ให้หน้า login ของ Wi-Fi บนเครื่องบินมาทับแอป)
function goodResponse(res) {
  return res && res.ok && res.type === "basic" && !res.redirected;
}

// อัปเดตไฟล์เบื้องหลัง ถ้ามีเน็ต (ใช้เวอร์ชันใหม่ในการเปิดครั้งถัดไป)
async function refresh(path, alsoAs) {
  try {
    const res = await fetch(new Request(path, {cache: "no-store"}));
    if (!goodResponse(res)) return;
    const c = await caches.open(CACHE);
    if (alsoAs) await c.put(alsoAs, res.clone());
    await c.put(path, res);
  } catch (err) { /* ออฟไลน์ ไม่เป็นไร */ }
}

self.addEventListener("fetch", e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return; // ตัวอ่าน PDF โหลดจากเน็ตตามปกติ

  // เปิดหน้าแอป: ใช้ไฟล์ที่เก็บไว้ในเครื่องก่อนเสมอ ไม่ต้องรอเน็ต
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      const cached = await caches.match("index.html") || await caches.match("./");
      if (cached) {
        e.waitUntil(refresh("index.html", "./"));
        return cached;
      }
      return fetch(req);
    })());
    return;
  }

  // ไฟล์อื่น (ไอคอน ฯลฯ): ใช้ของในเครื่องก่อน ไม่มีค่อยโหลด
  e.respondWith((async () => {
    const cached = await caches.match(req, {ignoreSearch: true});
    if (cached) { e.waitUntil(refresh(url.pathname)); return cached; }
    const res = await fetch(req);
    if (goodResponse(res)) { const c = await caches.open(CACHE); c.put(req, res.clone()); }
    return res;
  })());
});
