// ===== VARIABEL GLOBAL =====
let products = [] // Array untuk menyimpan semua produk
let filteredProducts = [] // Array untuk produk yang sudah difilter
let cart = [] // Array untuk menyimpan item keranjang
let deferredPrompt // Untuk menyimpan event install PWA

// ===== INISIALISASI APLIKASI =====
document.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 ShopMart PWA dimulai")

  // Inisialisasi semua fungsi
  initializeApp()
  loadCartFromStorage()
  updateCartUI()
  checkOnlineStatus()

  // Load produk jika di halaman yang membutuhkan
  if (document.getElementById("popularProducts") || document.getElementById("productsGrid")) {
    loadProducts()
  }

  // Load cart items jika di halaman cart
  if (document.getElementById("cartItemsList")) {
    displayCartItems()
  }

  // Setup PWA install prompt
  setupPWAInstall()
})

// ===== FUNGSI INISIALISASI =====
function initializeApp() {
  console.log("🔧 Menginisialisasi aplikasi...")

  // Register service worker untuk PWA
  if ("serviceWorker" in navigator) {
    registerServiceWorker()
  }

  // Setup event listeners
  setupEventListeners()

  // Load user preferences
  loadUserPreferences()

  console.log("✅ Aplikasi berhasil diinisialisasi")
}

// ===== SERVICE WORKER REGISTRATION =====
async function registerServiceWorker() {
  try {
    const registration = await navigator.serviceWorker.register("/sw.js")
    console.log("✅ Service Worker terdaftar:", registration)

    // Update service worker jika ada versi baru
    registration.addEventListener("updatefound", () => {
      console.log("🔄 Service Worker baru ditemukan")
      const newWorker = registration.installing
      newWorker.addEventListener("statechange", () => {
        if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
          console.log("🆕 Konten baru tersedia, refresh halaman")
          showUpdateNotification()
        }
      })
    })
  } catch (error) {
    console.error("❌ Service Worker gagal terdaftar:", error)
  }
}

// ===== SETUP EVENT LISTENERS =====
function setupEventListeners() {
  // Event listener untuk online/offline status
  window.addEventListener("online", handleOnlineStatus)
  window.addEventListener("offline", handleOfflineStatus)

  // Event listener untuk PWA install
  window.addEventListener("beforeinstallprompt", handleInstallPrompt)
  window.addEventListener("appinstalled", handleAppInstalled)

  // Event listener untuk form submissions
  const profileForm = document.getElementById("profileForm")
  if (profileForm) {
    profileForm.addEventListener("submit", updateProfile)
  }
}

// ===== FUNGSI LOAD PRODUK DARI API =====
async function loadProducts() {
  console.log("📦 Memuat produk dari API...")

  try {
    // Tampilkan loading state
    showLoadingState()

    // Coba ambil dari cache terlebih dahulu (untuk offline support)
    const cachedProducts = getCachedProducts()
    if (cachedProducts && cachedProducts.length > 0) {
      console.log("📱 Menggunakan produk dari cache")
      products = cachedProducts
      filteredProducts = [...products]
      displayProducts()
      return
    }

    // Fetch dari API jika online
    const response = await fetch("https://fakestoreapi.com/products")

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()

    // Format data produk
    products = data.map((product) => ({
      id: product.id,
      title: product.title,
      price: product.price,
      description: product.description,
      category: product.category,
      image: product.image,
      rating: product.rating,
    }))

    // Simpan ke cache untuk offline access
    cacheProducts(products)

    filteredProducts = [...products]
    displayProducts()

    console.log(`✅ ${products.length} produk berhasil dimuat`)
  } catch (error) {
    console.error("❌ Error loading products:", error)
    handleProductLoadError()
  }
}

// ===== FUNGSI DISPLAY PRODUK =====
function displayProducts() {
  const popularContainer = document.getElementById("popularProducts")
  const productsContainer = document.getElementById("productsGrid")

  // Sembunyikan loading state
  hideLoadingState()

  if (popularContainer) {
    // Tampilkan 4 produk populer di homepage
    const popularProducts = filteredProducts.slice(0, 4)
    popularContainer.innerHTML = generateProductsHTML(popularProducts)
  }

  if (productsContainer) {
    // Tampilkan semua produk di halaman products
    if (filteredProducts.length === 0) {
      showNoProductsMessage()
    } else {
      productsContainer.innerHTML = generateProductsHTML(filteredProducts)
      hideNoProductsMessage()
    }
  }

  // Tambahkan animasi fade-in
  setTimeout(() => {
    document.querySelectorAll(".product-card").forEach((card) => {
      card.classList.add("fade-in")
    })
  }, 100)
}

// ===== FUNGSI GENERATE HTML PRODUK =====
function generateProductsHTML(productList) {
  return productList
    .map((product) => {
      const isInCart = cart.some((item) => item.id === product.id)
      const stars = generateStars(product.rating?.rate || 4)

      return `
            <div class="product-card" data-product-id="${product.id}">
                <img src="${product.image}" alt="${product.title}" class="product-image" 
                     onerror="this.src='/placeholder.svg?height=200&width=200'">
                <div class="product-info">
                    <div class="product-category">${product.category}</div>
                    <h3 class="product-title">${product.title}</h3>
                    <div class="product-rating">
                        <div class="stars">${stars}</div>
                        <span class="rating-text">(${product.rating?.count || 0} reviews)</span>
                    </div>
                    <div class="product-price">$${product.price.toFixed(2)}</div>
                    <div class="product-actions">
                        <button class="btn-add-cart" 
                                onclick="addToCart(${product.id})" 
                                ${isInCart ? "disabled" : ""}>
                            <i class="fas fa-shopping-cart"></i>
                            ${isInCart ? "Sudah di Keranjang" : "Tambah ke Keranjang"}
                        </button>
                    </div>
                </div>
            </div>
        `
    })
    .join("")
}

// ===== FUNGSI GENERATE BINTANG RATING =====
function generateStars(rating) {
  const fullStars = Math.floor(rating)
  const hasHalfStar = rating % 1 !== 0
  let starsHTML = ""

  // Bintang penuh
  for (let i = 0; i < fullStars; i++) {
    starsHTML += '<i class="fas fa-star"></i>'
  }

  // Setengah bintang
  if (hasHalfStar) {
    starsHTML += '<i class="fas fa-star-half-alt"></i>'
  }

  // Bintang kosong
  const emptyStars = 5 - Math.ceil(rating)
  for (let i = 0; i < emptyStars; i++) {
    starsHTML += '<i class="far fa-star"></i>'
  }

  return starsHTML
}

// ===== FUNGSI PENCARIAN PRODUK =====
function searchProducts() {
  const searchTerm = document.getElementById("searchInput").value.toLowerCase()
  console.log("🔍 Mencari produk:", searchTerm)

  if (searchTerm === "") {
    filteredProducts = [...products]
  } else {
    filteredProducts = products.filter(
      (product) =>
        product.title.toLowerCase().includes(searchTerm) ||
        product.description.toLowerCase().includes(searchTerm) ||
        product.category.toLowerCase().includes(searchTerm),
    )
  }

  displayProducts()
  console.log(`📊 Ditemukan ${filteredProducts.length} produk`)
}

// ===== FUNGSI FILTER BERDASARKAN KATEGORI =====
function filterByCategory() {
  const category = document.getElementById("categoryFilter").value
  console.log("🏷️ Filter kategori:", category)

  if (category === "") {
    filteredProducts = [...products]
  } else {
    filteredProducts = products.filter((product) => product.category === category)
  }

  displayProducts()
  console.log(`📊 Ditemukan ${filteredProducts.length} produk dalam kategori ${category}`)
}

// ===== FUNGSI SORT PRODUK =====
function sortProducts() {
  const sortBy = document.getElementById("sortFilter").value
  console.log("📈 Mengurutkan produk berdasarkan:", sortBy)

  switch (sortBy) {
    case "price-low":
      filteredProducts.sort((a, b) => a.price - b.price)
      break
    case "price-high":
      filteredProducts.sort((a, b) => b.price - a.price)
      break
    case "name":
      filteredProducts.sort((a, b) => a.title.localeCompare(b.title))
      break
    default:
      filteredProducts = [...products]
      break
  }

  displayProducts()
}

// ===== FUNGSI KERANJANG BELANJA =====
function addToCart(productId) {
  console.log("🛒 Menambahkan produk ke keranjang:", productId)

  const product = products.find((p) => p.id === productId)
  if (!product) {
    console.error("❌ Produk tidak ditemukan")
    return
  }

  // Cek apakah produk sudah ada di keranjang
  const existingItem = cart.find((item) => item.id === productId)

  if (existingItem) {
    // Jika sudah ada, tambah quantity
    existingItem.quantity += 1
    console.log("➕ Quantity produk ditambah")
  } else {
    // Jika belum ada, tambah item baru
    cart.push({
      id: product.id,
      title: product.title,
      price: product.price,
      image: product.image,
      quantity: 1,
    })
    console.log("🆕 Produk baru ditambahkan ke keranjang")
  }

  // Update UI dan simpan ke storage
  updateCartUI()
  saveCartToStorage()

  // Update tombol produk
  updateProductButton(productId)

  // Tampilkan notifikasi
  showNotification("Produk berhasil ditambahkan ke keranjang!", "success")
}

// ===== FUNGSI UPDATE QUANTITY KERANJANG =====
function updateCartQuantity(productId, newQuantity) {
  console.log("🔢 Update quantity:", productId, newQuantity)

  const item = cart.find((item) => item.id === productId)
  if (!item) return

  if (newQuantity <= 0) {
    removeFromCart(productId)
    return
  }

  item.quantity = newQuantity
  updateCartUI()
  saveCartToStorage()
  displayCartItems()
}

// ===== FUNGSI HAPUS DARI KERANJANG =====
function removeFromCart(productId) {
  console.log("🗑️ Menghapus produk dari keranjang:", productId)

  cart = cart.filter((item) => item.id !== productId)
  updateCartUI()
  saveCartToStorage()
  displayCartItems()

  // Update tombol produk jika ada
  updateProductButton(productId)

  showNotification("Produk dihapus dari keranjang", "info")
}

// ===== FUNGSI KOSONGKAN KERANJANG =====
function clearCart() {
  if (cart.length === 0) return

  if (confirm("Apakah Anda yakin ingin mengosongkan keranjang?")) {
    console.log("🧹 Mengosongkan keranjang")
    cart = []
    updateCartUI()
    saveCartToStorage()
    displayCartItems()

    // Update semua tombol produk
    document.querySelectorAll(".btn-add-cart").forEach((btn) => {
      btn.disabled = false
      btn.innerHTML = '<i class="fas fa-shopping-cart"></i> Tambah ke Keranjang'
    })

    showNotification("Keranjang berhasil dikosongkan", "info")
  }
}

// ===== FUNGSI UPDATE UI KERANJANG =====
function updateCartUI() {
  const cartCounts = document.querySelectorAll(".cart-count")
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0)

  cartCounts.forEach((count) => {
    count.textContent = totalItems
    count.style.display = totalItems > 0 ? "inline" : "none"
  })
}

// ===== FUNGSI DISPLAY ITEM KERANJANG =====
function displayCartItems() {
  const cartItemsList = document.getElementById("cartItemsList")
  const emptyCart = document.getElementById("emptyCart")
  const cartSummary = document.getElementById("cartSummary")

  if (!cartItemsList) return

  if (cart.length === 0) {
    // Tampilkan pesan keranjang kosong
    cartItemsList.innerHTML = ""
    if (emptyCart) emptyCart.style.display = "block"
    if (cartSummary) cartSummary.style.display = "none"
    return
  }

  // Sembunyikan pesan kosong dan tampilkan summary
  if (emptyCart) emptyCart.style.display = "none"
  if (cartSummary) cartSummary.style.display = "block"

  // Generate HTML untuk setiap item
  cartItemsList.innerHTML = cart
    .map(
      (item) => `
        <div class="cart-item" data-product-id="${item.id}">
            <img src="${item.image}" alt="${item.title}" class="cart-item-image"
                 onerror="this.src='/placeholder.svg?height=100&width=100'">
            <div class="cart-item-info">
                <h3>${item.title}</h3>
                <div class="cart-item-price">$${item.price.toFixed(2)}</div>
                <div class="quantity-controls">
                    <button class="quantity-btn" onclick="updateCartQuantity(${item.id}, ${item.quantity - 1})">
                        <i class="fas fa-minus"></i>
                    </button>
                    <input type="number" class="quantity-input" value="${item.quantity}" 
                           min="1" onchange="updateCartQuantity(${item.id}, parseInt(this.value))">
                    <button class="quantity-btn" onclick="updateCartQuantity(${item.id}, ${item.quantity + 1})">
                        <i class="fas fa-plus"></i>
                    </button>
                </div>
                <div class="item-total">Total: $${(item.price * item.quantity).toFixed(2)}</div>
            </div>
            <div class="cart-item-actions">
                <button class="btn-remove" onclick="removeFromCart(${item.id})">
                    <i class="fas fa-trash"></i> Hapus
                </button>
            </div>
        </div>
    `,
    )
    .join("")

  // Update summary
  updateCartSummary()
}

// ===== FUNGSI UPDATE SUMMARY KERANJANG =====
function updateCartSummary() {
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const shipping = subtotal > 0 ? 15 : 0 // Gratis ongkir jika tidak ada item
  const tax = subtotal * 0.1 // Pajak 10%
  const total = subtotal + shipping + tax

  // Update elemen summary
  const subtotalEl = document.getElementById("subtotal")
  const shippingEl = document.getElementById("shipping")
  const taxEl = document.getElementById("tax")
  const totalEl = document.getElementById("total")

  if (subtotalEl) subtotalEl.textContent = `$${subtotal.toFixed(2)}`
  if (shippingEl) shippingEl.textContent = `$${shipping.toFixed(2)}`
  if (taxEl) taxEl.textContent = `$${tax.toFixed(2)}`
  if (totalEl) totalEl.textContent = `$${total.toFixed(2)}`
}

// ===== FUNGSI CHECKOUT =====
function checkout() {
  if (cart.length === 0) {
    showNotification("Keranjang kosong!", "warning")
    return
  }

  console.log("💳 Memproses checkout...")

  // Simulasi proses checkout
  showNotification("Memproses pembayaran...", "info")

  setTimeout(() => {
    // Simulasi berhasil
    const orderNumber = "ORD-" + Date.now()
    showNotification(`Pesanan berhasil! Nomor pesanan: ${orderNumber}`, "success")

    // Kosongkan keranjang setelah checkout berhasil
    cart = []
    updateCartUI()
    saveCartToStorage()
    displayCartItems()

    console.log("✅ Checkout berhasil:", orderNumber)
  }, 2000)
}

// ===== FUNGSI STORAGE =====
function saveCartToStorage() {
  try {
    localStorage.setItem("shopmart_cart", JSON.stringify(cart))
    console.log("💾 Keranjang disimpan ke storage")
  } catch (error) {
    console.error("❌ Error saving cart:", error)
  }
}

function loadCartFromStorage() {
  try {
    const savedCart = localStorage.getItem("shopmart_cart")
    if (savedCart) {
      cart = JSON.parse(savedCart)
      console.log("📱 Keranjang dimuat dari storage:", cart.length, "items")
    }
  } catch (error) {
    console.error("❌ Error loading cart:", error)
    cart = []
  }
}

function cacheProducts(products) {
  try {
    localStorage.setItem("shopmart_products", JSON.stringify(products))
    localStorage.setItem("shopmart_products_timestamp", Date.now().toString())
    console.log("💾 Produk disimpan ke cache")
  } catch (error) {
    console.error("❌ Error caching products:", error)
  }
}

function getCachedProducts() {
  try {
    const cachedProducts = localStorage.getItem("shopmart_products")
    const timestamp = localStorage.getItem("shopmart_products_timestamp")

    if (cachedProducts && timestamp) {
      const age = Date.now() - Number.parseInt(timestamp)
      const maxAge = 30 * 60 * 1000 // 30 menit

      if (age < maxAge) {
        return JSON.parse(cachedProducts)
      } else {
        console.log("🕐 Cache produk sudah expired")
        localStorage.removeItem("shopmart_products")
        localStorage.removeItem("shopmart_products_timestamp")
      }
    }
  } catch (error) {
    console.error("❌ Error getting cached products:", error)
  }

  return null
}

// ===== FUNGSI MOBILE MENU =====
function toggleMobileMenu() {
  const mobileMenu = document.getElementById("mobileMenu")
  if (mobileMenu) {
    mobileMenu.classList.toggle("active")
    console.log("📱 Mobile menu toggled")
  }
}

// ===== FUNGSI STATUS KONEKSI =====
function checkOnlineStatus() {
  const status = navigator.onLine ? "online" : "offline"
  updateConnectionStatus(status)
}

function handleOnlineStatus() {
  console.log("🌐 Kembali online")
  updateConnectionStatus("online")

  // Reload produk jika belum ada
  if (products.length === 0) {
    loadProducts()
  }

  showNotification("Koneksi internet tersambung", "success")
}

function handleOfflineStatus() {
  console.log("📴 Sedang offline")
  updateConnectionStatus("offline")
  showNotification("Anda sedang offline. Beberapa fitur mungkin terbatas.", "warning")
}

function updateConnectionStatus(status) {
  const statusEl = document.getElementById("connectionStatus")
  if (statusEl) {
    statusEl.className = `connection-status ${status}`
    statusEl.innerHTML = `
            <i class="fas fa-${status === "online" ? "wifi" : "wifi-slash"}"></i>
            <span>${status === "online" ? "Online" : "Offline"}</span>
        `
  }
}

// ===== FUNGSI PWA INSTALL =====
function setupPWAInstall() {
  // Cek apakah sudah diinstall
  if (window.matchMedia("(display-mode: standalone)").matches) {
    console.log("📱 PWA sudah diinstall")
    return
  }

  // Setup install prompt
  window.addEventListener("beforeinstallprompt", handleInstallPrompt)
}

function handleInstallPrompt(e) {
  console.log("💾 Install prompt tersedia")
  e.preventDefault()
  deferredPrompt = e
  showInstallPrompt()
}

function showInstallPrompt() {
  const installPrompt = document.getElementById("installPrompt")
  if (installPrompt) {
    installPrompt.style.display = "block"

    // Setup install button
    const installBtn = document.getElementById("installBtn")
    if (installBtn) {
      installBtn.addEventListener("click", installPWA)
    }
  }
}

function hideInstallPrompt() {
  const installPrompt = document.getElementById("installPrompt")
  if (installPrompt) {
    installPrompt.style.display = "none"
  }
}

async function installPWA() {
  if (!deferredPrompt) return

  console.log("📲 Memulai instalasi PWA...")

  try {
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === "accepted") {
      console.log("✅ PWA berhasil diinstall")
      showNotification("Aplikasi berhasil diinstall!", "success")
    } else {
      console.log("❌ Instalasi PWA dibatalkan")
    }

    deferredPrompt = null
    hideInstallPrompt()
  } catch (error) {
    console.error("❌ Error installing PWA:", error)
  }
}

function handleAppInstalled() {
  console.log("🎉 PWA berhasil diinstall")
  hideInstallPrompt()
  showNotification("Selamat! Aplikasi telah diinstall di perangkat Anda.", "success")
}

// ===== FUNGSI PROFIL =====
function updateProfile(event) {
  event.preventDefault()
  console.log("👤 Mengupdate profil...")

  const formData = new FormData(event.target)
  const profileData = {
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    address: formData.get("address"),
  }

  // Simulasi update profil
  setTimeout(() => {
    // Update UI
    const profileName = document.getElementById("profileName")
    const profileEmail = document.getElementById("profileEmail")

    if (profileName) profileName.textContent = profileData.fullName
    if (profileEmail) profileEmail.textContent = profileData.email

    // Simpan ke storage
    localStorage.setItem("shopmart_profile", JSON.stringify(profileData))

    showNotification("Profil berhasil diupdate!", "success")
    console.log("✅ Profil berhasil diupdate")
  }, 1000)
}

function changeAvatar() {
  console.log("📷 Mengubah avatar...")
  // Simulasi perubahan avatar
  showNotification("Fitur ubah avatar akan segera tersedia!", "info")
}

function toggleNotifications() {
  const enabled = document.getElementById("notifications").checked
  console.log("🔔 Notifikasi:", enabled ? "enabled" : "disabled")

  if (enabled && "Notification" in window) {
    Notification.requestPermission().then((permission) => {
      if (permission === "granted") {
        showNotification("Notifikasi berhasil diaktifkan!", "success")
      }
    })
  }

  localStorage.setItem("shopmart_notifications", enabled.toString())
}

function toggleDarkMode() {
  const enabled = document.getElementById("darkMode").checked
  console.log("🌙 Dark mode:", enabled ? "enabled" : "disabled")

  document.body.classList.toggle("dark-mode", enabled)
  localStorage.setItem("shopmart_darkmode", enabled.toString())

  showNotification(`Mode ${enabled ? "gelap" : "terang"} diaktifkan`, "info")
}

function toggleOfflineMode() {
  const enabled = document.getElementById("offlineMode").checked
  console.log("📴 Offline mode:", enabled ? "enabled" : "disabled")

  localStorage.setItem("shopmart_offline", enabled.toString())
  showNotification(`Mode offline ${enabled ? "diaktifkan" : "dinonaktifkan"}`, "info")
}

function exportData() {
  console.log("📤 Mengexport data...")

  const userData = {
    profile: JSON.parse(localStorage.getItem("shopmart_profile") || "{}"),
    cart: cart,
    preferences: {
      notifications: localStorage.getItem("shopmart_notifications") === "true",
      darkMode: localStorage.getItem("shopmart_darkmode") === "true",
      offlineMode: localStorage.getItem("shopmart_offline") === "true",
    },
    exportDate: new Date().toISOString(),
  }

  const dataStr = JSON.stringify(userData, null, 2)
  const dataBlob = new Blob([dataStr], { type: "application/json" })
  const url = URL.createObjectURL(dataBlob)

  const link = document.createElement("a")
  link.href = url
  link.download = "shopmart-data.json"
  link.click()

  URL.revokeObjectURL(url)
  showNotification("Data berhasil diexport!", "success")
}

function logout() {
  if (confirm("Apakah Anda yakin ingin logout?")) {
    console.log("👋 Logout...")

    // Clear semua data (kecuali cache produk untuk offline)
    localStorage.removeItem("shopmart_cart")
    localStorage.removeItem("shopmart_profile")

    // Reset cart
    cart = []
    updateCartUI()

    showNotification("Anda telah logout", "info")

    // Redirect ke homepage
    setTimeout(() => {
      window.location.href = "index.html"
    }, 1500)
  }
}

// ===== FUNGSI UTILITY =====
function showLoadingState() {
  const loadingElements = document.querySelectorAll(".loading")
  loadingElements.forEach((el) => (el.style.display = "block"))
}

function hideLoadingState() {
  const loadingElements = document.querySelectorAll(".loading")
  loadingElements.forEach((el) => (el.style.display = "none"))
}

function showNoProductsMessage() {
  const noProducts = document.getElementById("noProducts")
  if (noProducts) noProducts.style.display = "block"
}

function hideNoProductsMessage() {
  const noProducts = document.getElementById("noProducts")
  if (noProducts) noProducts.style.display = "none"
}

function updateProductButton(productId) {
  const productCard = document.querySelector(`[data-product-id="${productId}"]`)
  if (productCard) {
    const button = productCard.querySelector(".btn-add-cart")
    const isInCart = cart.some((item) => item.id === productId)

    if (button) {
      button.disabled = isInCart
      button.innerHTML = isInCart
        ? '<i class="fas fa-check"></i> Sudah di Keranjang'
        : '<i class="fas fa-shopping-cart"></i> Tambah ke Keranjang'
    }
  }
}

function handleProductLoadError() {
  const containers = [document.getElementById("popularProducts"), document.getElementById("productsGrid")]

  containers.forEach((container) => {
    if (container) {
      container.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Gagal Memuat Produk</h3>
                    <p>Terjadi kesalahan saat memuat produk. Silakan coba lagi.</p>
                    <button class="btn-primary" onclick="loadProducts()">
                        <i class="fas fa-refresh"></i> Coba Lagi
                    </button>
                </div>
            `
    }
  })
}

function showUpdateNotification() {
  showNotification("Update tersedia! Refresh halaman untuk mendapatkan versi terbaru.", "info")
}

function showNotification(message, type = "info") {
  // Buat elemen notifikasi
  const notification = document.createElement("div")
  notification.className = `notification notification-${type}`
  notification.innerHTML = `
        <i class="fas fa-${getNotificationIcon(type)}"></i>
        <span>${message}</span>
        <button onclick="this.parentElement.remove()">×</button>
    `

  // Style notifikasi
  notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 1rem;
        background: ${getNotificationColor(type)};
        color: white;
        padding: 1rem;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        max-width: 300px;
        animation: slideInRight 0.3s ease;
    `

  // Tambahkan ke body
  document.body.appendChild(notification)

  // Auto remove setelah 5 detik
  setTimeout(() => {
    if (notification.parentElement) {
      notification.style.animation = "slideOutRight 0.3s ease"
      setTimeout(() => notification.remove(), 300)
    }
  }, 5000)

  console.log(`📢 Notifikasi (${type}):`, message)
}

function getNotificationIcon(type) {
  const icons = {
    success: "check-circle",
    error: "exclamation-circle",
    warning: "exclamation-triangle",
    info: "info-circle",
  }
  return icons[type] || "info-circle"
}

function getNotificationColor(type) {
  const colors = {
    success: "#10b981",
    error: "#ef4444",
    warning: "#f59e0b",
    info: "#3b82f6",
  }
  return colors[type] || "#3b82f6"
}

function loadUserPreferences() {
  // Load dark mode preference
  const darkMode = localStorage.getItem("shopmart_darkmode") === "true"
  if (darkMode) {
    document.body.classList.add("dark-mode")
    const darkModeToggle = document.getElementById("darkMode")
    if (darkModeToggle) darkModeToggle.checked = true
  }

  // Load notification preference
  const notifications = localStorage.getItem("shopmart_notifications") !== "false"
  const notificationToggle = document.getElementById("notifications")
  if (notificationToggle) notificationToggle.checked = notifications

  // Load offline mode preference
  const offlineMode = localStorage.getItem("shopmart_offline") !== "false"
  const offlineModeToggle = document.getElementById("offlineMode")
  if (offlineModeToggle) offlineModeToggle.checked = offlineMode

  // Load profile data
  const profileData = JSON.parse(localStorage.getItem("shopmart_profile") || "{}")
  if (profileData.fullName) {
    const fields = ["fullName", "email", "phone", "address"]
    fields.forEach((field) => {
      const element = document.getElementById(field)
      if (element && profileData[field]) {
        element.value = profileData[field]
      }
    })

    // Update profile display
    const profileName = document.getElementById("profileName")
    const profileEmail = document.getElementById("profileEmail")
    if (profileName && profileData.fullName) profileName.textContent = profileData.fullName
    if (profileEmail && profileData.email) profileEmail.textContent = profileData.email
  }

  console.log("⚙️ User preferences loaded")
}

// ===== CSS ANIMATIONS (ditambahkan via JavaScript) =====
const style = document.createElement("style")
style.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    
    .error-state {
        text-align: center;
        padding: 3rem;
        color: var(--text-secondary);
        grid-column: 1 / -1;
    }
    
    .error-state i {
        font-size: 3rem;
        color: var(--danger-color);
        margin-bottom: 1rem;
    }
    
    .error-state h3 {
        color: var(--text-primary);
        margin-bottom: 1rem;
    }
`
document.head.appendChild(style)

console.log("🎯 Script ShopMart PWA loaded successfully!")
