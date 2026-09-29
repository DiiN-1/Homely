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
const menuToggleIcon = document.querySelector("#menu-toggle-icon");
const mobileMenu = document.querySelector("#mobile-menu");
const mobileMenuBackdrop = document.querySelector("#mobile-menu-backdrop");
const mobileMenuPanel = document.querySelector("#mobile-menu-panel");
const mobileMenuClose = document.querySelector("#mobile-menu-close");
const toast = document.querySelector("#toast");
const refreshIcons = () => window.lucide?.createIcons();
const userGreeting = document.querySelector("#user-greeting");
const userGreetingWrap = document.querySelector("#user-greeting-wrap");

// Auth-aware nav / view elements
const navGuestDesktop = document.querySelector("#nav-guest");
const navAuthDesktop = document.querySelector("#nav-auth");
const navGuestMobile = document.querySelector("#mobile-nav-guest");
const navAuthMobile = document.querySelector("#mobile-nav-auth");
const marketingEls = document.querySelectorAll(".marketing-only");
const dashboardView = document.querySelector("#dashboard-view");
const dashboardGreeting = document.querySelector("#dashboard-greeting");
const bookingsGrid = document.querySelector("#bookings-grid");
const cartButton = document.querySelector("#cart-button");
const cartCount = document.querySelector("#cart-count");
const cartDialog = document.querySelector("#cart-dialog");
const cartItemsEl = document.querySelector("#cart-items");
const cartSubtotalEl = document.querySelector("#cart-subtotal");
const adminLinks = [document.querySelector("#admin-link-desktop"), document.querySelector("#admin-link-mobile")];

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
    userGreetingWrap.style.display = signedIn ? "flex" : "none";

    navGuestMobile.classList.toggle("hidden", signedIn);
    navAuthMobile.classList.toggle("hidden", !signedIn);

    authButton.classList.toggle("hidden", signedIn);

    const isAdmin = signedIn && state.user.role === "admin";
    adminLinks.forEach((link) => { link.style.display = isAdmin ? "" : "none"; });

    // The cart belongs to the signed-in user, so it only exists once logged in
    cartButton.style.display = signedIn ? "" : "none";
    if (!signedIn && cartDialog.open) cartDialog.close();
    updateCartBadge();

    marketingEls.forEach((el) => el.classList.toggle("hidden", signedIn));
    dashboardView.classList.toggle("hidden", !signedIn);

    if (signedIn) {
        userGreeting.textContent = `Hi, ${state.user.name.split(" ")[0]}`;
        dashboardGreeting.textContent = `Welcome back, ${state.user.name}`;
        loadBookings();
    }
}
function requireAuth(promptMessage, returnTo) {
    if (state.token) return true;
    showToast(promptMessage);
    sessionStorage.setItem("fixitReturnTo", returnTo || window.location.pathname + window.location.hash);
    window.setTimeout(() => { window.location.href = "login.html"; }, 600);
    return false;
}

// ---------- Dialog helper: click outside + Escape (Escape is native to <dialog>) ----------

function makeDismissible(dialog) {
    dialog.addEventListener("click", (event) => {
        if (event.target === dialog) dialog.close();
    });
}

// ---------- Mobile menu (slide-in drawer + backdrop) ----------

function isMobileMenuOpen() {
    return mobileMenuPanel.classList.contains("translate-x-0");
}

function openMobileMenu() {
    mobileMenu.classList.remove("pointer-events-none");
    mobileMenu.setAttribute("aria-hidden", "false");
    mobileMenuBackdrop.classList.remove("opacity-0");
    mobileMenuBackdrop.classList.add("opacity-100");
    mobileMenuPanel.classList.remove("translate-x-full");
    mobileMenuPanel.classList.add("translate-x-0");
    menuToggle.setAttribute("aria-expanded", "true");
    menuToggleIcon.setAttribute("data-lucide", "x");
    document.body.classList.add("menu-open");
    refreshIcons();
}

function closeMobileMenu() {
    mobileMenu.classList.add("pointer-events-none");
    mobileMenu.setAttribute("aria-hidden", "true");
    mobileMenuBackdrop.classList.add("opacity-0");
    mobileMenuBackdrop.classList.remove("opacity-100");
    mobileMenuPanel.classList.add("translate-x-full");
    mobileMenuPanel.classList.remove("translate-x-0");
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggleIcon.setAttribute("data-lucide", "menu");
    document.body.classList.remove("menu-open");
    refreshIcons();
}

menuToggle.addEventListener("click", () => {
    isMobileMenuOpen() ? closeMobileMenu() : openMobileMenu();
});
mobileMenuClose.addEventListener("click", closeMobileMenu);
mobileMenuBackdrop.addEventListener("click", closeMobileMenu);
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isMobileMenuOpen()) closeMobileMenu();
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
    serviceGrid.innerHTML = services.map((service) => `<article class="flex flex-col justify-between rounded-lg border p-5"><div><div class="mb-3 flex h-32 items-center justify-center rounded-md bg-gray-100 text-gray-400">${service.image ? imageOrEmoji(service.image) : `<i data-lucide="${icons[service.category] || "home"}" class="h-8 w-8"></i>`}</div><span class="text-xs font-medium text-yellow-600">${escapeHtml(service.category)}</span><h3 class="mt-1 font-bold text-gray-900">${escapeHtml(service.name)}</h3><p class="mt-1 text-sm text-gray-500">${escapeHtml(service.description)}</p></div><div class="mt-4"><div class="mb-3 flex items-center justify-between text-sm"><span class="font-bold text-gray-900">${money(service.priceMin)} - ${money(service.priceMax)}</span><span class="flex items-center gap-1 text-gray-600"><i data-lucide="star" class="h-3.5 w-3.5 fill-current text-yellow-500"></i>${Number(service.rating || 0).toFixed(1)}</span></div><button class="book-now-btn w-full rounded-md bg-yellow-600 py-2 text-sm font-medium text-white hover:bg-yellow-700" type="button" data-id="${service._id || ""}" data-name="${escapeHtml(service.name)}" data-price-min="${service.priceMin}" data-price-max="${service.priceMax}" data-rating="${service.rating || 0}" data-description="${escapeHtml(service.description)}">Book Now</button></div></article>`).join("");
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

// The mock arrays have no _id (they were never fetched from Mongo), so we stamp
// each mock item with the REAL MongoDB _id of the matching seeded document,
// matched by exact name. Run `npm run seed` in /backend so those documents exist.
let mockIdsReady = false;

async function attachRealIdsToMockData() {
    try {
        const [servicesRes, productsRes] = await Promise.all([
            fetch(`${API_BASE}/services`),
            fetch(`${API_BASE}/products`),
        ]);
        const [realServices, realProducts] = await Promise.all([
            servicesRes.json(),
            productsRes.json(),
        ]);

        const serviceIdByName = new Map(realServices.map((s) => [s.name, s._id]));
        const productIdByName = new Map(realProducts.map((p) => [p.name, p._id]));

        mockServices.forEach((service) => {
            if (serviceIdByName.has(service.name)) service._id = serviceIdByName.get(service.name);
        });
        mockProducts.forEach((product) => {
            if (productIdByName.has(product.name)) product._id = productIdByName.get(product.name);
        });
    } catch (error) {
        // Backend not running / not seeded yet — mock data still renders.
        console.warn("Could not sync mock data with backend ids:", error.message);
    } finally {
        mockIdsReady = true;
    }
}

const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

// Last line of defence: if a card still has no real id when it's clicked
// (backend was slow, page loaded before the seed ran, etc.), look it up by
// name right now instead of sending "undefined" to the API.
async function resolveRealId(kind, item) {
    if (OBJECT_ID_RE.test(item.id || "")) return item.id;
    try {
        const response = await fetch(`${API_BASE}/${kind}`);
        const list = await response.json();
        if (!Array.isArray(list)) return null;
        const match = list.find((entry) => entry.name === item.name);
        return match && OBJECT_ID_RE.test(match._id) ? match._id : null;
    } catch {
        return null;
    }
}

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
    productGrid.innerHTML = products.map((product) => `<article class="flex flex-col rounded-lg border bg-white p-4"><div class="mb-3 flex h-28 items-center justify-center rounded-md bg-gray-100 text-gray-400">${product.image ? imageOrEmoji(product.image) : '<i data-lucide="package" class="h-8 w-8"></i>'}</div><span class="text-xs font-medium text-yellow-600">${escapeHtml(product.category)}</span><h3 class="mt-1 text-sm font-semibold text-gray-900">${escapeHtml(product.name)}</h3><p class="mt-1 text-xs text-gray-500">${escapeHtml(product.description)}</p><div class="mt-auto flex items-center justify-between pt-3"><span class="text-sm font-medium text-gray-900">${money(product.price)}</span><button class="add-to-cart-btn rounded-full bg-yellow-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-yellow-700" type="button" data-id="${product._id || ""}" data-name="${escapeHtml(product.name)}" data-price="${product.price}" data-image="${escapeHtml(product.image || "")}" data-category="${escapeHtml(product.category)}">Add to Cart</button></div></article>`).join("");
    productGrid.querySelectorAll(".add-to-cart-btn").forEach((button) => button.addEventListener("click", () => handleAddToCart(button.dataset, button)));
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

const actionButtons = (kind, doc) => {
    if (doc.status !== "pending_payment" && doc.status !== "payment_failed") return "";
    return `<div class="mt-3 flex gap-2">
        <button type="button" class="flex-1 rounded-md bg-yellow-600 py-1.5 text-xs font-medium text-white hover:bg-yellow-700 disabled:opacity-60" data-action="pay-${kind}" data-id="${doc._id}">Pay now</button>
        <button type="button" class="rounded-md border px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60" data-action="cancel-${kind}" data-id="${doc._id}">Cancel</button>
    </div>`;
};

function renderBookings(bookings) {
    if (!bookings.length) {
        bookingsGrid.innerHTML = '<p class="col-span-full text-sm text-gray-500">No bookings yet. Book a service to see it here.</p>';
        return;
    }
    bookingsGrid.innerHTML = bookings.map((booking) => {
        const service = booking.service || {};
        const name = booking.serviceName || service.name || "Service";
        const address = booking.address ? `${booking.address.street}, ${booking.address.city}` : "";
        return `<article class="rounded-lg border p-5"><div class="flex items-start justify-between gap-2"><h3 class="font-bold text-gray-900">${escapeHtml(name)}</h3>${statusBadge(BOOKING_STATUS, booking.status)}</div>
            <p class="mt-1 text-xs text-yellow-600">${escapeHtml(service.category || "")}</p>
            <p class="mt-2 text-sm text-gray-700">${escapeHtml(formatDay(booking.preferredDate))}${booking.timeSlot ? ` · ${escapeHtml(TIME_SLOTS[booking.timeSlot] || "")}` : ""}</p>
            ${address ? `<p class="mt-1 text-sm text-gray-500">${escapeHtml(address)}</p>` : ""}
            ${booking.notes ? `<p class="mt-1 text-sm text-gray-500">${escapeHtml(booking.notes)}</p>` : ""}
            ${booking.bookingFee ? `<p class="mt-2 text-xs text-gray-400">Booking fee ${money(booking.bookingFee)} · ${booking.paymentStatus === "paid" ? "paid" : "not paid"}</p>` : ""}
            ${actionButtons("booking", booking)}</article>`;
    }).join("");
}

async function loadBookings() {
    try {
        renderBookings(await api("/bookings/mine"));
    } catch (error) {
        if (error.status === 401) return handleExpiredSession();
        bookingsGrid.innerHTML = `<p class="col-span-full text-sm text-red-600">${escapeHtml(error.message)}</p>`;
    }
}

// Token expired or user deleted: drop the stale session instead of showing a broken dashboard
function handleExpiredSession() {
    setSignedOut();
    showToast("Your session expired. Please sign in again.");
}

// Pay / cancel buttons on booking cards
document.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const [verb] = button.dataset.action.split("-");
    if (verb === "cancel" && !window.confirm("Cancel this booking?")) return;

    button.disabled = true;
    try {
        if (verb === "pay") {
            const result = await api(`/bookings/${button.dataset.id}/pay`, { method: "POST" });
            window.location.href = result.authorizationUrl;
            return;
        }
        await api(`/bookings/${button.dataset.id}/cancel`, { method: "POST" });
        showToast("Booking cancelled.");
        loadBookings();
    } catch (error) {
        showToast(error.message);
        button.disabled = false;
    }
});

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
makeDismissible(cartDialog);

// ---------- Booking modal (requires sign in) ----------

const bookingStateSelect = document.querySelector("#booking-state");
bookingStateSelect.innerHTML = stateOptions("Rivers");
let bookingFee = 2000;
api("/config", { authed: false }).then((config) => {
    bookingFee = config.bookingFee;
    document.querySelector("#booking-fee-label").textContent = money(bookingFee);
}).catch(() => { /* keep default label */ });

async function openBookingDialog(service) {
    if (!requireAuth("Sign in to book this service.")) return;
    const realId = await resolveRealId("services", service);
    if (!realId) {
        showToast("This service isn't in the database yet. Run `npm run seed` in /backend, then refresh.");
        return;
    }
    activeBookingService = realId;
    document.querySelector("#booking-service-name").textContent = service.name;
    document.querySelector("#booking-service-meta").innerHTML = `<span>${money(service.priceMin)} - ${money(service.priceMax)}</span><span class="flex items-center gap-1"><i data-lucide="star" class="h-3.5 w-3.5 fill-current text-yellow-500"></i>${Number(service.rating).toFixed(1)}</span>`;
    document.querySelector("#booking-service-description").textContent = service.description;
    bookingForm.reset();
    bookingForm.elements.date.min = new Date().toISOString().slice(0, 10);
    if (state.user?.name) bookingForm.elements.notes.placeholder = "Anything they should know";
    bookingMessage.textContent = "";
    bookingMessage.className = "mt-2 min-h-4 text-xs";
    document.querySelector("#booking-submit").disabled = false;
    refreshIcons();
    bookingDialog.showModal();
}

document.querySelector("#close-booking").addEventListener("click", () => bookingDialog.close());
document.querySelector("#cancel-booking").addEventListener("click", () => bookingDialog.close());

bookingForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = document.querySelector("#booking-submit");
    if (!OBJECT_ID_RE.test(activeBookingService || "")) {
        bookingMessage.className = "mt-2 min-h-4 text-xs text-red-600";
        bookingMessage.textContent = "Couldn't identify this service. Close this and try again.";
        return;
    }
    const data = Object.fromEntries(new FormData(bookingForm));
    if (!data.date || !data.phone.trim() || !data.street.trim() || !data.city.trim()) {
        bookingMessage.className = "mt-2 min-h-4 text-xs text-red-600";
        bookingMessage.textContent = "Please fill in the date, phone number, street address and city.";
        return;
    }
    const payload = {
        serviceId: activeBookingService,
        preferredDate: data.date,
        timeSlot: data.timeSlot,
        phone: data.phone,
        address: { street: data.street, city: data.city, state: data.state, landmark: data.landmark },
    };
    if (data.notes) payload.notes = data.notes;

    submitButton.disabled = true;
    bookingMessage.className = "mt-2 min-h-4 text-xs text-gray-500";
    bookingMessage.textContent = "Setting up your payment...";
    try {
        const result = await api("/bookings", { method: "POST", body: payload });
        bookingMessage.className = "mt-2 min-h-4 text-xs text-green-600";
        bookingMessage.textContent = "Redirecting to Paystack...";
        window.location.href = result.authorizationUrl;
    } catch (error) {
        if (error.status === 401) { bookingDialog.close(); return handleExpiredSession(); }
        bookingMessage.className = "mt-2 min-h-4 text-xs text-red-600";
        bookingMessage.textContent = error.message;
        submitButton.disabled = false;
    }
});

// ---------- Cart ----------

function updateCartBadge() {
    const count = cart.count();
    cartCount.textContent = count;
    cartCount.classList.toggle("hidden", count === 0);
}

function renderCart() {
    const items = cart.items();
    document.querySelector("#cart-checkout").disabled = items.length === 0;
    cartSubtotalEl.textContent = money(cart.subtotal());
    if (!items.length) {
        cartItemsEl.innerHTML = '<div class="py-16 text-center text-sm text-gray-500"><i data-lucide="shopping-cart" class="mx-auto mb-3 h-8 w-8 text-gray-300"></i>Your cart is empty.</div>';
        refreshIcons();
        return;
    }
    cartItemsEl.innerHTML = `<ul class="divide-y">${items.map((item) => `
        <li class="flex items-start gap-3 py-4">
            <div class="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-gray-100 text-gray-400">${item.image ? imageOrEmoji(item.image) : '<i data-lucide="package" class="h-5 w-5"></i>'}</div>
            <div class="min-w-0 flex-1">
                <p class="text-sm font-medium text-gray-900">${escapeHtml(item.name)}</p>
                <p class="text-xs text-gray-500">${money(item.price)}</p>
                <div class="mt-2 flex items-center gap-2">
                    <button type="button" class="h-6 w-6 rounded border text-sm hover:bg-gray-50" data-cart-qty="-1" data-id="${escapeHtml(item.id)}" aria-label="Decrease quantity">−</button>
                    <span class="w-5 text-center text-sm">${item.quantity}</span>
                    <button type="button" class="h-6 w-6 rounded border text-sm hover:bg-gray-50" data-cart-qty="1" data-id="${escapeHtml(item.id)}" aria-label="Increase quantity">+</button>
                    <button type="button" class="ml-2 text-xs text-gray-400 hover:text-red-600" data-cart-remove="${escapeHtml(item.id)}">Remove</button>
                </div>
            </div>
            <span class="text-sm font-medium text-gray-900">${money(item.price * item.quantity)}</span>
        </li>`).join("")}</ul>`;
    refreshIcons();
}

async function handleAddToCart(product, button) {
    if (!requireAuth("Sign in to add items to your cart.")) return;
    const realId = await resolveRealId("products", product);
    if (!realId) {
        showToast("This product isn't in the database yet. Run `npm run seed` in /backend, then refresh.");
        return;
    }
    cart.add({ id: realId, name: product.name, price: Number(product.price), image: product.image || "", category: product.category });
    showToast(`Added ${product.name} to your cart.`);
}

cartButton.addEventListener("click", () => { renderCart(); cartDialog.showModal(); });
document.querySelector("#close-cart").addEventListener("click", () => cartDialog.close());
cartItemsEl.addEventListener("click", (event) => {
    const qtyButton = event.target.closest("[data-cart-qty]");
    const removeButton = event.target.closest("[data-cart-remove]");
    if (qtyButton) {
        const item = cart.items().find((entry) => entry.id === qtyButton.dataset.id);
        if (item) cart.setQuantity(item.id, item.quantity + Number(qtyButton.dataset.cartQty));
    } else if (removeButton) {
        cart.remove(removeButton.dataset.cartRemove);
    }
});
document.querySelector("#cart-checkout").addEventListener("click", () => {
    if (!cart.items().length) return;
    // Guests can fill a cart freely; they only need an account to check out
    if (!requireAuth("Sign in to check out.", "checkout.html")) return;
    window.location.href = "checkout.html";
});
window.addEventListener("cart-changed", () => { updateCartBadge(); if (cartDialog.open) renderCart(); });
window.addEventListener("storage", (event) => { if (event.key && event.key.startsWith("homelyCart")) { updateCartBadge(); if (cartDialog.open) renderCart(); } });

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
updateCartBadge();
renderServiceFilters();
loadServices();
loadProducts();
refreshIcons();

// Fetch real ids in the background, then re-render so the on-screen cards
// pick up working data-id attributes without blocking the first paint.
attachRealIdsToMockData().then(() => {
    if (mockIdsReady) {
        loadServices();
        loadProducts();
        refreshIcons();
    }
});