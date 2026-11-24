// Service worker ของแอปคำนวณเรทเงิน
// แอปจะถูกเก็บไว้ในเครื่องถาวร และใช้ไฟล์ในเครื่องเสมอ (ไม่โหลดใหม่เอง)
// จะเปลี่ยนเป็นเวอร์ชันใหม่ก็ต่อเมื่อผู้ใช้กด "ตรวจหาอัปเดต" ในแอปเท่านั้น
// หมายเหตุ: ไม่ต้องแก้ไฟล์นี้เวลาอัปเดตแอป แก้แค่ index.html (และ APP_VERSION) พอ
const CACHE = "fx-calc-app";
const FILES = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png"];

function goodResponse(res) {
  return res && res.ok && res.type === "basic" && !res.redirected;
}
async function fetchAll() {
  const out = [];
  for (const f of FILES) {
    const res = await fetch(new Request(f, {cache: "reload"}));
    if (!goodResponse(res)) throw new Error("bad " + f);
    out.push([f, res]);
  }
  return out;
}
async function store(pairs) {
  const c = await caches.open(CACHE);
  for (const [f, res] of pairs) await c.put(f, res);
}

self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    if (!(await c.match("index.html"))) await store(await fetchAll());
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith("fx-calc") && k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return; // ตัวอ่าน PDF โหลดจากเน็ตตามปกติ
  if (url.searchParams.has("fresh")) return; // ใช้ตอนตรวจหาอัปเดต: ไปเอาจากเว็บตรงๆ

  e.respondWith((async () => {
    const key = req.mode === "navigate" ? "index.html" : req;
    const cached = await caches.match(key, {ignoreSearch: true}) || (req.mode === "navigate" && await caches.match("./"));
    if (cached) return cached;
    const res = await fetch(req);
    if (goodResponse(res)) { const c = await caches.open(CACHE); c.put(key, res.clone()); }
    return res;
  })());
});

// ผู้ใช้กดอัปเดต: โหลดไฟล์ใหม่ทั้งชุด ถ้าได้ครบค่อยเขียนทับของเดิม
self.addEventListener("message", e => {
  if (!e.data || e.data.type !== "update") return;
  const port = e.ports && e.ports[0];
  e.waitUntil(fetchAll().then(store)
    .then(() => port && port.postMessage({ok: true}))
    .catch(err => port && port.postMessage({ok: false, error: String(err)})));
});
