// Helpers shared by every page (index, checkout, order, payment-callback).
const API_BASE = "http://localhost:5000/api";

const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" }[character]));
const money = (value) => `\u20a6${Number(value || 0).toLocaleString("en-NG")}`;

// ---------- Session ----------
const getToken = () => localStorage.getItem("fixitToken") || sessionStorage.getItem("fixitToken");
const getUser = () => JSON.parse(localStorage.getItem("fixitUser") || sessionStorage.getItem("fixitUser") || "null");
function clearSession() {
    ["fixitToken", "fixitUser"].forEach((key) => { localStorage.removeItem(key); sessionStorage.removeItem(key); });
}
// Send the visitor to login and bring them back to `returnTo` afterwards
function goToLogin(returnTo) {
    sessionStorage.setItem("fixitReturnTo", returnTo || window.location.pathname + window.location.search);
    window.location.href = "login.html";
}

// ---------- API ----------
async function api(path, { method = "GET", body, authed = true } = {}) {
    const headers = {};
    if (body) headers["Content-Type"] = "application/json";
    if (authed && getToken()) headers.Authorization = `Bearer ${getToken()}`;

    let response;
    try {
        response = await fetch(`${API_BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    } catch {
        throw new Error("Can't reach the server. Is the backend running?");
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(data.message || data.errors?.[0]?.message || "Something went wrong.");
        error.status = response.status;
        throw error;
    }
    return data;
}

// ---------- Status labels + colours ----------
const ORDER_STATUS = {
    pending_payment: { label: "Awaiting payment", cls: "bg-yellow-50 text-yellow-700" },
    paid: { label: "Paid", cls: "bg-green-50 text-green-700" },
    processing: { label: "Preparing", cls: "bg-blue-50 text-blue-700" },
    out_for_delivery: { label: "Out for delivery", cls: "bg-indigo-50 text-indigo-700" },
    delivered: { label: "Delivered", cls: "bg-green-100 text-green-800" },
    cancelled: { label: "Cancelled", cls: "bg-red-50 text-red-700" },
    payment_failed: { label: "Payment failed", cls: "bg-red-50 text-red-700" },
};
const BOOKING_STATUS = {
    pending_payment: { label: "Awaiting payment", cls: "bg-yellow-50 text-yellow-700" },
    confirmed: { label: "Confirmed", cls: "bg-green-50 text-green-700" },
    in_progress: { label: "In progress", cls: "bg-blue-50 text-blue-700" },
    completed: { label: "Completed", cls: "bg-green-100 text-green-800" },
    cancelled: { label: "Cancelled", cls: "bg-red-50 text-red-700" },
    payment_failed: { label: "Payment failed", cls: "bg-red-50 text-red-700" },
};
const statusBadge = (map, status) => {
    // Unknown statuses (e.g. old test data saved as "pending") still render sensibly
    const entry = map[status] || { label: String(status || "unknown").replace(/_/g, " "), cls: "bg-gray-100 text-gray-700" };
    return `<span class="whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${entry.cls}">${escapeHtml(entry.label)}</span>`;
};

const TIME_SLOTS = { morning: "Morning (8am – 12pm)", afternoon: "Afternoon (12pm – 4pm)", evening: "Evening (4pm – 7pm)" };

const formatDay = (value) => value ? new Date(value).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "No date set";
const formatDateTime = (value) => value ? new Date(value).toLocaleString("en-NG", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "";

const NIGERIAN_STATES = ["Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT (Abuja)", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara"];
const stateOptions = (selected = "Rivers") => NIGERIAN_STATES.map((name) => `<option value="${escapeHtml(name)}" ${name === selected ? "selected" : ""}>${escapeHtml(name)}</option>`).join("");

// ---------- Cart ----------
// Each signed-in user gets their own cart, stored under their user id. Guests have no cart
// (they're asked to sign in when they try to add something), so accounts never share items,
// even on the same browser.
localStorage.removeItem("homelyCart"); // old shared cart from the first version

const cartKey = () => {
    const user = getUser();
    return user?.id ? `homelyCart:${user.id}` : null;
};
const cart = {
    items() {
        const key = cartKey();
        if (!key) return [];
        try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; }
    },
    save(items) {
        const key = cartKey();
        if (!key) return;
        localStorage.setItem(key, JSON.stringify(items));
        window.dispatchEvent(new Event("cart-changed"));
    },
    add(product) {
        const items = this.items();
        const existing = items.find((item) => item.id === product.id);
        if (existing) existing.quantity = Math.min(existing.quantity + 1, 10);
        else items.push({ ...product, quantity: 1 });
        this.save(items);
    },
    setQuantity(id, quantity) {
        const items = this.items().map((item) => item.id === id ? { ...item, quantity: Math.max(1, Math.min(10, quantity)) } : item);
        this.save(items);
    },
    remove(id) { this.save(this.items().filter((item) => item.id !== id)); },
    clear() { this.save([]); },
    count() { return this.items().reduce((sum, item) => sum + item.quantity, 0); },
    subtotal() { return this.items().reduce((sum, item) => sum + item.price * item.quantity, 0); },
};