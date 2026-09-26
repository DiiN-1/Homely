const API_BASE = "http://localhost:5000/api";
const state = {
    category: "All",
    search: "",
    authMode: "login",
    token: localStorage.getItem("fixitToken") || sessionStorage.getItem("fixitToken") || null,
    user: JSON.parse(localStorage.getItem("fixitUser") || sessionStorage.getItem("fixitUser") || "null"),
};
let activeBookingService = null;

const serviceGrid = document.querySelector("#service-grid");
const productGrid = document.querySelector("#product-grid");
const productCount = document.querySelector("#product-count");
const searchInput = document.querySelector("#search-input");
const serviceFilters = document.querySelector("#service-filters");
const authButton = document.querySelector("#auth-button");
const authDialog = document.querySelector("#auth-dialog");
const authForm = document.querySelector("#auth-form");
const authMessage = document.querySelector("#auth-message");
const bookingDialog = document.querySelector("#booking-dialog");
const bookingForm = document.querySelector("#booking-form");
const bookingMessage = document.querySelector("#booking-message");
const menuToggle = document.querySelector("#menu-toggle");
const mobileMenu = document.querySelector("#mobile-menu");
const toast = document.querySelector("#toast");
const refreshIcons = () => window.lucide?.createIcons();

// Auth-aware nav / view elements
const navGuestDesktop = document.querySelector("#nav-guest");
const navAuthDesktop = document.querySelector("#nav-auth");
const navGuestMobile = document.querySelector("#mobile-nav-guest");
const navAuthMobile = document.querySelector("#mobile-nav-auth");
const userGreeting = document.querySelector("#user-greeting");
const marketingEls = document.querySelectorAll(".marketing-only");
const dashboardView = document.querySelector("#dashboard-view");
const dashboardGreeting = document.querySelector("#dashboard-greeting");
const bookingsGrid = document.querySelector("#bookings-grid");
const ordersGrid = document.querySelector("#orders-grid");

const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" }[character]));
const money = (value) => `\u20a6${Number(value || 0).toLocaleString("en-NG")}`;
const imageOrEmoji = (image) => image ? `<img class="h-full w-full object-cover" src="${escapeHtml(image)}" alt="" loading="lazy">` : "";

// ---------- Auth state ----------

function setSignedIn(user, token) {
    state.user = user;
    state.token = token;
    localStorage.setItem("fixitToken", token);
    localStorage.setItem("fixitUser", JSON.stringify(user));
    updateAuthUI();
}

function setSignedOut() {
    state.user = null;
    state.token = null;
    localStorage.removeItem("fixitToken");
    localStorage.removeItem("fixitUser");
    sessionStorage.removeItem("fixitToken");
    sessionStorage.removeItem("fixitUser");
    updateAuthUI();
}

// ---------- Switch between the logged-out marketing view and the logged-in dashboard ----------

function updateAuthUI() {
    const signedIn = Boolean(state.token && state.user);

    // nav-guest / nav-auth both carry Tailwind's "hidden md:flex" responsive pattern.
    // On desktop, "md:flex" always wins the cascade over a plain "hidden" class no
    // matter when it's added, so toggling classList("hidden") can't actually hide
    // either one on desktop. Inline style always overrides the cascade, so use that.
    navGuestDesktop.style.display = signedIn ? "none" : "";
    navAuthDesktop.style.display = signedIn ? "" : "none";
    userGreeting.style.display = signedIn ? "inline" : "none";

    navGuestMobile.classList.toggle("hidden", signedIn);
    navAuthMobile.classList.toggle("hidden", !signedIn);

    authButton.classList.toggle("hidden", signedIn);

    marketingEls.forEach((el) => el.classList.toggle("hidden", signedIn));
    dashboardView.classList.toggle("hidden", !signedIn);

    if (signedIn) {
        userGreeting.textContent = `Hi, ${state.user.name.split(" ")[0]}`;
        dashboardGreeting.textContent = `Welcome back, ${state.user.name}`;
        loadBookings();
        loadOrders();
    }
}
function requireAuth(promptMessage) {
    if (state.token) return true;
    showToast(promptMessage);
    sessionStorage.setItem("fixitReturnTo", window.location.pathname + window.location.hash);
    window.setTimeout(() => { window.location.href = "login.html"; }, 600);
    return false;
}

// ---------- Dialog helper: click outside + Escape (Escape is native to <dialog>) ----------

function makeDismissible(dialog) {
    dialog.addEventListener("click", (event) => {
        if (event.target === dialog) dialog.close();
    });
}

// ---------- Mobile menu ----------

function closeMobileMenu() {
    mobileMenu.classList.add("hidden");
    menuToggle.setAttribute("aria-expanded", "false");
}

menuToggle.addEventListener("click", () => {
    const isOpen = !mobileMenu.classList.contains("hidden");
    if (isOpen) {
        closeMobileMenu();
    } else {
        mobileMenu.classList.remove("hidden");
        menuToggle.setAttribute("aria-expanded", "true");
    }
});
mobileMenu.querySelectorAll(".mobile-link").forEach((link) => link.addEventListener("click", closeMobileMenu));

// ---------- Services + products (unified category/search filtering) ----------

function renderServiceFilters() {
    const categories = [
        "All",
        "Cleaning",
        "Electrical",
        "Plumbing",
        "Carpentry",
        "Painting",
        "Maintenance"
    ];

    serviceFilters.innerHTML = categories
        .map(
            (category) => `
                <button
                    type="button"
                    data-category="${escapeHtml(category)}"
                    class="service-filter rounded-full border px-4 py-1 text-sm font-medium transition-all duration-200
                    ${
                        category === state.category
                            ? "border-yellow-600 bg-yellow-600 text-white shadow-sm"
                            : "border-gray-200 bg-white text-gray-900 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900"
                    }"
                >
                    ${escapeHtml(category)}
                </button>
            `
        )
        .join("");

    serviceFilters.querySelectorAll(".service-filter").forEach((button) => {
        button.addEventListener("click", () => {
            state.category = button.dataset.category;

            renderServiceFilters();
            loadServices();
            loadProducts();
        });
    });
}

function renderServices(services) {
    if (!services.length) {
        serviceGrid.innerHTML = '<p class="col-span-full text-sm text-gray-500">No services matched your search.</p>';
        return;
    }
    const icons = { Cleaning: "sparkles", Electrical: "zap", Plumbing: "droplets", Carpentry: "hammer", Painting: "paint-roller", Maintenance: "wrench" };
    serviceGrid.innerHTML = services.map((service) => `<article class="flex flex-col justify-between rounded-lg border p-5"><div><div class="mb-3 flex h-32 items-center justify-center rounded-md bg-gray-100 text-gray-400">${service.image ? imageOrEmoji(service.image) : `<i data-lucide="${icons[service.category] || "home"}" class="h-8 w-8"></i>`}</div><span class="text-xs font-medium text-yellow-600">${escapeHtml(service.category)}</span><h3 class="mt-1 font-bold text-gray-900">${escapeHtml(service.name)}</h3><p class="mt-1 text-sm text-gray-500">${escapeHtml(service.description)}</p></div><div class="mt-4"><div class="mb-3 flex items-center justify-between text-sm"><span class="font-bold text-gray-900">${money(service.priceMin)} - ${money(service.priceMax)}</span><span class="flex items-center gap-1 text-gray-600"><i data-lucide="star" class="h-3.5 w-3.5 fill-current text-yellow-500"></i>${Number(service.rating || 0).toFixed(1)}</span></div><button class="book-now-btn w-full rounded-md bg-yellow-600 py-2 text-sm font-medium text-white hover:bg-yellow-700" type="button" data-id="${service._id}" data-name="${escapeHtml(service.name)}" data-price-min="${service.priceMin}" data-price-max="${service.priceMax}" data-rating="${service.rating || 0}" data-description="${escapeHtml(service.description)}">Book Now</button></div></article>`).join("");
    serviceGrid.querySelectorAll(".book-now-btn").forEach((button) => button.addEventListener("click", () => openBookingDialog(button.dataset)));
    refreshIcons();
}

function renderServiceSkeletons(count = 6) {
    serviceGrid.innerHTML = Array.from({ length: count }, () => `
        <div class="rounded-xl border border-gray-200 bg-white overflow-hidden animate-pulse">
            <div class="h-44 bg-gray-200"></div>

            <div class="p-5 space-y-4">
                <div class="h-5 w-3/4 rounded bg-gray-200"></div>

                <div class="space-y-2">
                    <div class="h-3 w-full rounded bg-gray-200"></div>
                    <div class="h-3 w-5/6 rounded bg-gray-200"></div>
                </div>

                <div class="flex justify-between items-center">
                    <div class="h-4 w-20 rounded bg-gray-200"></div>
                    <div class="h-4 w-16 rounded bg-gray-200"></div>
                </div>

                <div class="h-10 w-full rounded-lg bg-gray-200"></div>
            </div>
        </div>
    `).join("");
}

// Mock data for the Services grid — same set as before the backend was wired up.
const mockServices = [
    { name: "Deep House Cleaning", category: "Cleaning", description: "Full home deep clean including kitchen, bathrooms, and living areas.", image: "https://images.pexels.com/photos/7814798/pexels-photo-7814798.jpeg?w=800", priceMin: 8000, priceMax: 20000, rating: 4.7 },
    { name: "Electrical Wiring Inspection", category: "Electrical", description: "Safety inspection and minor repairs for home wiring.", image: "https://images.pexels.com/photos/257736/pexels-photo-257736.jpeg?w=800", priceMin: 5000, priceMax: 15000, rating: 4.5 },
    { name: "Pipe Leak Repair", category: "Plumbing", description: "Fix leaking pipes, taps, and joints around the home.", image: "https://images.pexels.com/photos/6419128/pexels-photo-6419128.jpeg?w=800", priceMin: 3000, priceMax: 12000, rating: 4.6 },
    { name: "Custom Furniture Repair", category: "Carpentry", description: "Repair or build custom wooden furniture and fittings.", image: "https://images.pexels.com/photos/6790042/pexels-photo-6790042.jpeg?w=800", priceMin: 6000, priceMax: 25000, rating: 4.3 },
    { name: "Interior Wall Painting", category: "Painting", description: "Fresh coat of paint for interior walls, includes prep work.", image: "https://images.pexels.com/photos/7218029/pexels-photo-7218029.jpeg?w=800", priceMin: 10000, priceMax: 40000, rating: 4.8 },
    { name: "General Home Maintenance", category: "Maintenance", description: "Routine checks and small fixes across the home.", image: "https://images.pexels.com/photos/5194769/pexels-photo-5194769.jpeg?w=800", priceMin: 4000, priceMax: 18000, rating: 4.4 },
    { name: "AC Servicing & Repair", category: "Maintenance", description: "Cleaning, gas top-up, and repair for air conditioning units.", image: "https://images.pexels.com/photos/5194769/pexels-photo-5194769.jpeg?w=800", priceMin: 7000, priceMax: 22000, rating: 4.6 },
    { name: "Bathroom Deep Clean", category: "Cleaning", description: "Intensive cleaning and descaling for bathrooms.", image: "https://images.pexels.com/photos/7814798/pexels-photo-7814798.jpeg?w=800", priceMin: 4000, priceMax: 10000, rating: 4.5 },
];

function loadServices() {
    renderServiceSkeletons();

    const searchTerm = state.search.toLowerCase().trim();
    const filtered = mockServices.filter((service) => {
        const matchesCategory = state.category === "All" || service.category === state.category;
        const matchesSearch =
            !searchTerm ||
            service.name.toLowerCase().includes(searchTerm) ||
            service.category.toLowerCase().includes(searchTerm) ||
            service.description.toLowerCase().includes(searchTerm);
        return matchesCategory && matchesSearch;
    });

    renderServices(filtered);
}
function renderProducts(products) {
    if (!products.length) {
        productGrid.innerHTML = '<p class="col-span-full text-sm text-gray-500">No products matched your search.</p>';
        return;
    }
    productGrid.innerHTML = products.map((product) => `<article class="flex flex-col rounded-lg border bg-white p-4"><div class="mb-3 flex h-28 items-center justify-center rounded-md bg-gray-100 text-gray-400">${product.image ? imageOrEmoji(product.image) : '<i data-lucide="package" class="h-8 w-8"></i>'}</div><span class="text-xs font-medium text-yellow-600">${escapeHtml(product.category)}</span><h3 class="mt-1 text-sm font-semibold text-gray-900">${escapeHtml(product.name)}</h3><p class="mt-1 text-xs text-gray-500">${escapeHtml(product.description)}</p><div class="mt-auto flex items-center justify-between pt-3"><span class="text-sm font-medium text-gray-900">${money(product.price)}</span><button class="order-now-btn rounded-full bg-yellow-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-yellow-700" type="button" data-id="${product._id}" data-name="${escapeHtml(product.name)}">Order Now</button></div></article>`).join("");
    productGrid.querySelectorAll(".order-now-btn").forEach((button) => button.addEventListener("click", () => handleOrder(button.dataset, button)));
    refreshIcons();
}

// Mock data for the Products grid — same set as before the backend was wired up.
const mockProducts = [
    { name: "Multi-Surface Cleaner (1L)", category: "Cleaning", description: "All-purpose cleaner safe for most household surfaces.", image: "https://images.pexels.com/photos/7814798/pexels-photo-7814798.jpeg?w=600", price: 2500 },
    { name: "LED Bulb Pack (4pcs)", category: "Electrical", description: "Energy-saving LED bulbs, cool white, 9W each.", image: "https://images.pexels.com/photos/5840158/pexels-photo-5840158.jpeg?cs=tinysrgb&w=600", price: 4000 },
    { name: "PVC Pipe Fitting Kit", category: "Plumbing", description: "Assorted fittings for common household plumbing repairs.", image: "https://images.pexels.com/photos/6419128/pexels-photo-6419128.jpeg?w=600", price: 6500 },
    { name: "Wood Varnish (500ml)", category: "Carpentry", description: "Protective varnish finish for wooden furniture.", image: "https://images.pexels.com/photos/6790042/pexels-photo-6790042.jpeg?w=600", price: 3200 },
    { name: "Interior Paint (4L, White)", category: "Painting", description: "Matte finish interior wall paint, washable.", image: "https://images.pexels.com/photos/7218029/pexels-photo-7218029.jpeg?w=600", price: 18000 },
    { name: "Tool Kit (32-piece)", category: "Maintenance", description: "General home repair tool kit with case.", image: "https://images.pexels.com/photos/5194769/pexels-photo-5194769.jpeg?w=600", price: 15000 },
    { name: "Extension Cable (5m)", category: "Electrical", description: "Heavy-duty extension cable with surge protection.", image: "https://images.pexels.com/photos/257736/pexels-photo-257736.jpeg?w=600", price: 5000 },
    { name: "Drain Unblocker (750ml)", category: "Plumbing", description: "Fast-acting liquid drain unblocker.", image: "https://images.pexels.com/photos/6419128/pexels-photo-6419128.jpeg?w=600", price: 2800 },
];

function loadProducts() {
    const searchTerm = state.search.toLowerCase().trim();
    const filtered = mockProducts.filter((product) => {
        const matchesCategory = state.category === "All" || product.category === state.category;
        const matchesSearch =
            !searchTerm ||
            product.name.toLowerCase().includes(searchTerm) ||
            product.category.toLowerCase().includes(searchTerm) ||
            product.description.toLowerCase().includes(searchTerm);
        return matchesCategory && matchesSearch;
    });

    renderProducts(filtered);
}

// ---------- Bookings / Orders (dashboard view, requires sign in) ----------

function renderBookings(bookings) {
    if (!bookings.length) {
        bookingsGrid.innerHTML = '<p class="col-span-full text-sm text-gray-500">No bookings yet. Book a service to see it here.</p>';
        return;
    }
    const statusStyles = { pending: "bg-yellow-50 text-yellow-700", confirmed: "bg-green-50 text-green-700", cancelled: "bg-red-50 text-red-700" };
    bookingsGrid.innerHTML = bookings.map((booking) => {
        const service = booking.service || {};
        const date = booking.preferredDate ? new Date(booking.preferredDate).toLocaleDateString() : "No date set";
        return `<article class="rounded-lg border p-5"><div class="flex items-start justify-between"><h3 class="font-bold text-gray-900">${escapeHtml(service.name || "Service")}</h3><span class="rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusStyles[booking.status] || "bg-gray-100 text-gray-700"}">${escapeHtml(booking.status)}</span></div><p class="mt-1 text-xs text-yellow-600">${escapeHtml(service.category || "")}</p><p class="mt-2 text-sm text-gray-500">${escapeHtml(date)}</p>${booking.notes ? `<p class="mt-1 text-sm text-gray-500">${escapeHtml(booking.notes)}</p>` : ""}</article>`;
    }).join("");
}

function renderOrders(orders) {
    if (!orders.length) {
        ordersGrid.innerHTML = '<p class="col-span-full text-sm text-gray-500">No orders yet. Order a product to see it here.</p>';
        return;
    }
    const statusStyles = { pending: "bg-yellow-50 text-yellow-700", confirmed: "bg-green-50 text-green-700", cancelled: "bg-red-50 text-red-700" };
    ordersGrid.innerHTML = orders.map((order) => {
        const product = order.product || {};
        return `<article class="rounded-lg border bg-white p-4"><div class="flex items-start justify-between"><h3 class="text-sm font-semibold text-gray-900">${escapeHtml(product.name || "Product")}</h3><span class="rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusStyles[order.status] || "bg-gray-100 text-gray-700"}">${escapeHtml(order.status)}</span></div><p class="mt-1 text-xs text-yellow-600">${escapeHtml(product.category || "")}</p><p class="mt-2 text-sm text-gray-500">Qty: ${Number(order.quantity || 1)}</p></article>`;
    }).join("");
}

// Mock data for the dashboard — shown as soon as you sign in, not pulled from Mongo.
const mockBookings = [
    { service: { name: "Deep House Cleaning", category: "Cleaning" }, status: "confirmed", preferredDate: "2026-09-28", notes: "Please bring eco-friendly products." },
    { service: { name: "Electrical Wiring Inspection", category: "Electrical" }, status: "pending", preferredDate: "2026-10-03", notes: "" },
    { service: { name: "Pipe Leak Repair", category: "Plumbing" }, status: "cancelled", preferredDate: "2026-09-20", notes: "Rescheduling for next month." },
];

const mockOrders = [
    { product: { name: "LED Bulb Pack (4pcs)", category: "Electrical" }, status: "confirmed", quantity: 2 },
    { product: { name: "PVC Pipe Fitting Kit", category: "Plumbing" }, status: "pending", quantity: 1 },
    { product: { name: "Tool Kit (32-piece)", category: "Maintenance" }, status: "confirmed", quantity: 1 },
];

function loadBookings() {
    renderBookings(mockBookings);
}

function loadOrders() {
    renderOrders(mockOrders);
}

// ---------- Toast ----------

function showToast(message) {
    toast.textContent = message;
    toast.classList.add("visible", "translate-y-0", "opacity-100");
    toast.classList.remove("invisible");
    window.setTimeout(() => toast.classList.remove("visible", "translate-y-0", "opacity-100"), 2600);
    window.setTimeout(() => toast.classList.add("invisible"), 2850);
}

authButton.addEventListener("click", () => {
    window.location.href = "login.html";
});

document.querySelector("#signout-desktop").addEventListener("click", () => {
    setSignedOut();
    showToast("Signed out.");
    window.location.hash = "#top";
});
document.querySelector("#signout-mobile").addEventListener("click", () => {
    setSignedOut();
    showToast("Signed out.");
    closeMobileMenu();
    window.location.hash = "#top";
});
makeDismissible(bookingDialog);
// ---------- Booking modal (requires sign in) ----------

function openBookingDialog(service) {
    if (!requireAuth("Sign in to book this service.")) return;
    activeBookingService = service.id;
    document.querySelector("#booking-service-name").textContent = service.name;
    document.querySelector("#booking-service-meta").innerHTML = `<span>${money(service.priceMin)} - ${money(service.priceMax)}</span><span class="flex items-center gap-1"><i data-lucide="star" class="h-3.5 w-3.5 fill-current text-yellow-500"></i>${Number(service.rating).toFixed(1)}</span>`;
    document.querySelector("#booking-service-description").textContent = service.description;
    bookingForm.reset();
    bookingMessage.textContent = "";
    bookingMessage.className = "mt-2 min-h-4 text-xs";
    refreshIcons();
    bookingDialog.showModal();
}

document.querySelector("#close-booking").addEventListener("click", () => bookingDialog.close());
document.querySelector("#cancel-booking").addEventListener("click", () => bookingDialog.close());

bookingForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!activeBookingService) return;
    const formData = new FormData(bookingForm);
    const payload = { serviceId: activeBookingService };
    if (formData.get("date")) payload.preferredDate = formData.get("date");
    if (formData.get("notes")) payload.notes = formData.get("notes");

    bookingMessage.className = "mt-2 min-h-4 text-xs text-gray-500";
    bookingMessage.textContent = "Sending your request...";
    try {
        const response = await fetch(`${API_BASE}/bookings`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${state.token}` },
            body: JSON.stringify(payload),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || data.errors?.[0]?.message || "Could not send that booking.");
        bookingMessage.className = "mt-2 min-h-4 text-xs text-green-600";
        bookingMessage.textContent = "Booked! We'll be in touch to confirm.";
        loadBookings();
        window.setTimeout(() => { bookingDialog.close(); showToast("Booking request sent."); }, 1100);
    } catch (error) {
        bookingMessage.className = "mt-2 min-h-4 text-xs text-red-600";
        bookingMessage.textContent = error.message;
    }
});

// ---------- Order flow (requires sign in, simpler than booking) ----------

async function handleOrder(product, button) {
    if (!requireAuth("Sign in to order this product.")) return;
    button.disabled = true;
    const originalLabel = button.textContent;
    button.textContent = "Ordering...";
    try {
        const response = await fetch(`${API_BASE}/orders`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${state.token}` },
            body: JSON.stringify({ productId: product.id }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || data.errors?.[0]?.message || "Could not place that order.");
        showToast(`Order placed for ${product.name}.`);
        loadOrders();
    } catch (error) {
        showToast(error.message);
    } finally {
        button.disabled = false;
        button.textContent = originalLabel;
    }
}

// ---------- Search (filters both services and products at once) ----------

let searchTimer;
searchInput.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
        state.search = searchInput.value.trim();
        loadServices();
        loadProducts();
    }, 300);
});

// ---------- Init ----------

updateAuthUI();
renderServiceFilters();
loadServices();
loadProducts();
refreshIcons();