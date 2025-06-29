// ===== SERVICE WORKER UNTUK PWA =====
// File ini menangani caching dan offline functionality

const CACHE_NAME = "shopmart-pwa-v1.0.0"
const STATIC_CACHE = "shopmart-static-v1.0.0"
const DYNAMIC_CACHE = "shopmart-dynamic-v1.0.0"

// Daftar file yang akan di-cache untuk offline access
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/products.html",
  "/cart.html",
  "/profile.html",
  "/styles.css",
  "/script.js",
  "//manifest.json",
  // Font Awesome (akan di-cache saat pertama kali diakses)
  "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css",
]

// API endpoints yang akan di-cache
const API_URLS = ["https://fakestoreapi.com/products"]

// ===== EVENT INSTALL =====
// Dipanggil saat service worker pertama kali diinstall
self.addEventListener("install", (event) => {
  console.log("🔧 Service Worker: Installing...")

  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => {
        console.log("📦 Service Worker: Caching static assets...")
        return cache.addAll(STATIC_ASSETS)
      })
      .then(() => {
        console.log("✅ Service Worker: Static assets cached")
        return self.skipWaiting() // Aktifkan service worker baru langsung
      })
      .catch((error) => {
        console.error("❌ Service Worker: Error caching static assets:", error)
      }),
  )
})

// ===== EVENT ACTIVATE =====
// Dipanggil saat service worker diaktifkan
self.addEventListener("activate", (event) => {
  console.log("🚀 Service Worker: Activating...")

  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        // Hapus cache lama yang tidak digunakan
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log("🗑️ Service Worker: Deleting old cache:", cacheName)
              return caches.delete(cacheName)
            }
          }),
        )
      })
      .then(() => {
        console.log("✅ Service Worker: Activated")
        return self.clients.claim() // Ambil kontrol semua clients
      }),
  )
})

// ===== EVENT FETCH =====
// Dipanggil setiap kali ada request network
self.addEventListener("fetch", (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== "GET") {
    return
  }

  // Skip chrome-extension requests
  if (url.protocol === "chrome-extension:") {
    return
  }

  // Handle different types of requests
  if (isStaticAsset(request.url)) {
    // Static assets: Cache First strategy
    event.respondWith(cacheFirst(request))
  } else if (isAPIRequest(request.url)) {
    // API requests: Network First strategy
    event.respondWith(networkFirst(request))
  } else {
    // Other requests: Stale While Revalidate strategy
    event.respondWith(staleWhileRevalidate(request))
  }
})

// ===== CACHING STRATEGIES =====

// Cache First: Cek cache dulu, jika tidak ada baru fetch dari network
async function cacheFirst(request) {
  try {
    const cachedResponse = await caches.match(request)
    if (cachedResponse) {
      console.log("📱 Cache hit:", request.url)
      return cachedResponse
    }

    console.log("🌐 Cache miss, fetching:", request.url)
    const networkResponse = await fetch(request)

    // Cache response untuk request selanjutnya
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE)
      cache.put(request, networkResponse.clone())
    }

    return networkResponse
  } catch (error) {
    console.error("❌ Cache First error:", error)

    // Jika offline dan tidak ada di cache, return offline page
    if (request.destination === "document") {
      return caches.match("/index.html")
    }

    // Return placeholder untuk gambar
    if (request.destination === "image") {
      return new Response(
        '<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg"><rect width="200" height="200" fill="#f3f4f6"/><text x="100" y="100" text-anchor="middle" dy=".3em" fill="#9ca3af">Image not available</text></svg>',
        { headers: { "Content-Type": "image/svg+xml" } },
      )
    }

    throw error
  }
}

// Network First: Coba fetch dari network dulu, jika gagal baru dari cache
async function networkFirst(request) {
  try {
    console.log("🌐 Network first:", request.url)
    const networkResponse = await fetch(request)

    if (networkResponse.ok) {
      // Cache response yang berhasil
      const cache = await caches.open(DYNAMIC_CACHE)
      cache.put(request, networkResponse.clone())
      console.log("💾 Cached API response:", request.url)
    }

    return networkResponse
  } catch (error) {
    console.log("📱 Network failed, trying cache:", request.url)

    const cachedResponse = await caches.match(request)
    if (cachedResponse) {
      console.log("📱 Serving from cache:", request.url)
      return cachedResponse
    }

    // Jika API request dan tidak ada di cache, return mock data
    if (isAPIRequest(request.url)) {
      return getMockAPIResponse(request.url)
    }

    throw error
  }
}

// Stale While Revalidate: Return dari cache langsung, tapi update cache di background
async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE)
  const cachedResponse = await cache.match(request)

  // Fetch dari network di background untuk update cache
  const networkResponsePromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone())
      }
      return networkResponse
    })
    .catch((error) => {
      console.log("🌐 Network update failed:", error)
    })

  // Return cached response jika ada, atau tunggu network response
  return cachedResponse || networkResponsePromise
}

// ===== HELPER FUNCTIONS =====

function isStaticAsset(url) {
  return (
    STATIC_ASSETS.some((asset) => url.includes(asset)) ||
    url.includes(".css") ||
    url.includes(".js") ||
    url.includes(".png") ||
    url.includes(".jpg") ||
    url.includes(".jpeg") ||
    url.includes(".gif") ||
    url.includes(".svg") ||
    url.includes(".ico") ||
    url.includes(".woff") ||
    url.includes(".woff2") ||
    url.includes(".ttf")
  )
}

function isAPIRequest(url) {
  return API_URLS.some((apiUrl) => url.includes(apiUrl)) || url.includes("api.") || url.includes("/api/")
}

function getMockAPIResponse(url) {
  console.log("🎭 Returning mock data for:", url)

  // Mock data untuk products API
  if (url.includes("fakestoreapi.com/products")) {
    const mockProducts = [
      {
        id: 1,
        title: "Produk Offline 1",
        price: 29.99,
        description: "Produk ini tersedia saat offline",
        category: "electronics",
        image: "/placeholder.svg?height=200&width=200",
        rating: { rate: 4.5, count: 120 },
      },
      {
        id: 2,
        title: "Produk Offline 2",
        price: 19.99,
        description: "Produk ini juga tersedia saat offline",
        category: "clothing",
        image: "/placeholder.svg?height=200&width=200",
        rating: { rate: 4.0, count: 85 },
      },
      {
        id: 3,
        title: "Produk Offline 3",
        price: 39.99,
        description: "Produk ketiga yang tersedia offline",
        category: "jewelery",
        image: "/placeholder.svg?height=200&width=200",
        rating: { rate: 4.8, count: 200 },
      },
      {
        id: 4,
        title: "Produk Offline 4",
        price: 24.99,
        description: "Produk keempat untuk mode offline",
        category: "electronics",
        image: "/placeholder.svg?height=200&width=200",
        rating: { rate: 4.2, count: 95 },
      },
    ]

    return new Response(JSON.stringify(mockProducts), {
      headers: {
        "Content-Type": "application/json",
        "X-Offline-Response": "true",
      },
    })
  }

  // Default mock response
  return new Response(
    JSON.stringify({
      error: "Offline",
      message: "Data tidak tersedia saat offline",
    }),
    {
      status: 503,
      headers: { "Content-Type": "application/json" },
    },
  )
}

// ===== EVENT MESSAGE =====
// Handle pesan dari main thread
self.addEventListener("message", (event) => {
  console.log("📨 Service Worker received message:", event.data)

  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting()
  }

  if (event.data && event.data.type === "CACHE_URLS") {
    const urls = event.data.urls
    cacheUrls(urls)
  }
})

// Function untuk cache URLs tertentu
async function cacheUrls(urls) {
  try {
    const cache = await caches.open(DYNAMIC_CACHE)
    await cache.addAll(urls)
    console.log("✅ URLs cached successfully:", urls)
  } catch (error) {
    console.error("❌ Error caching URLs:", error)
  }
}

// ===== BACKGROUND SYNC =====
// Handle background sync untuk offline actions
self.addEventListener("sync", (event) => {
  console.log("🔄 Background sync:", event.tag)

  if (event.tag === "cart-sync") {
    event.waitUntil(syncCart())
  }

  if (event.tag === "profile-sync") {
    event.waitUntil(syncProfile())
  }
})

async function syncCart() {
  try {
    // Implementasi sync cart saat kembali online
    console.log("🛒 Syncing cart data...")

    // Ambil data cart dari IndexedDB atau localStorage
    const cartData = await getStoredCartData()

    if (cartData && cartData.length > 0) {
      // Kirim ke server jika ada
      // await fetch('/api/cart/sync', {
      //     method: 'POST',
      //     body: JSON.stringify(cartData)
      // });

      console.log("✅ Cart synced successfully")
    }
  } catch (error) {
    console.error("❌ Cart sync failed:", error)
  }
}

async function syncProfile() {
  try {
    console.log("👤 Syncing profile data...")

    // Implementasi sync profile
    const profileData = await getStoredProfileData()

    if (profileData) {
      // Kirim ke server jika ada
      console.log("✅ Profile synced successfully")
    }
  } catch (error) {
    console.error("❌ Profile sync failed:", error)
  }
}

// Helper functions untuk data storage
async function getStoredCartData() {
  // Implementasi untuk mengambil cart data dari storage
  return []
}

async function getStoredProfileData() {
  // Implementasi untuk mengambil profile data dari storage
  return null
}

// ===== PUSH NOTIFICATIONS =====
// Handle push notifications
self.addEventListener("push", (event) => {
  console.log("📬 Push notification received")

  const options = {
    body: event.data ? event.data.text() : "Notifikasi baru dari ShopMart!",
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-72x72.png",
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1,
    },
    actions: [
      {
        action: "explore",
        title: "Lihat Produk",
        icon: "/icons/icon-72x72.png",
      },
      {
        action: "close",
        title: "Tutup",
        icon: "/icons/icon-72x72.png",
      },
    ],
  }

  event.waitUntil(self.registration.showNotification("ShopMart PWA", options))
})

// Handle notification click
self.addEventListener("notificationclick", (event) => {
  console.log("🔔 Notification clicked:", event.action)

  event.notification.close()

  if (event.action === "explore") {
    event.waitUntil(clients.openWindow("/products.html"))
  } else if (event.action === "close") {
    // Just close the notification
  } else {
    // Default action - open the app
    event.waitUntil(clients.openWindow("/"))
  }
})

console.log("🎯 Service Worker loaded successfully!")
