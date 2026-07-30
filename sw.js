const CACHE_NAME = 'shehab-portfolio-v1';

// الملفات الأساسية التي سيتم تخزينها فوراً للعمل بدون إنترنت
const STATIC_ASSETS = [
  './',
  './index.html',
  './tailwind.min.css',
  './script.js',
  './fonts/Cairo-Regular.ttf',
  './fonts/Cairo-Bold.ttf',
  './fonts/Cairo-ExtraBold.ttf',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// 1. التثبيت والتخزين المسبق (Install Phase)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching App Shell & Static Assets');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// 2. التفعيل وحذف التخزين القديم (Activate Phase)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Deleting Old Cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. الاعتراض والطلب الذكي (Fetch Phase)
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // استثناء الخرائط والطلبات غير الحسابية من الكاش
  if (url.origin.includes('google.com') || url.origin.includes('gstatic.com')) {
    return; // اتركه يطلب من الشبكة مباشرة
  }

  // استراتيجية الصور والملفات الميديا (Stale-While-Revalidate / Cache First)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // إرجاع النسخة المخزنة فوراً مع تحديث الكاش في الخلفية
        fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
          }
        }).catch(() => {/* تجاهل أخطاء الشبكة أثناء التحديث الخلفي */});

        return cachedResponse;
      }

      // إذا لم تكن مخزنة، جلبها من الشبكة وتخزينها
      return fetch(request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic' && !request.url.includes('cloudinary')) {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache);
        });

        return networkResponse;
      }).catch(() => {
        // إذا كان أوفلاين والطلب لصفحة HTML، ارجع لـ index.html
        if (request.headers.get('accept').includes('text/html')) {
          return caches.match('./index.html');
        }
      });
    })
  );
});