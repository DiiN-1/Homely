// Admin console. Access is enforced by the server (role === "admin"); this page just calls the admin API.
const list = document.querySelector("#admin-list");
const adminMessage = document.querySelector("#admin-message");
let tab = "orders";

// Mirrors backend/config/statuses.js — the server re-checks every change.
const NEXT = {
    orders: { paid: ["processing", "cancelled"], processing: ["out_for_delivery", "cancelled"], out_for_delivery: ["delivered"] },
    bookings: { confirmed: ["in_progress", "cancelled"], in_progress: ["completed", "cancelled"] },
};
const LABELS = { orders: ORDER_STATUS, bookings: BOOKING_STATUS };

const customer = (doc) => `${escapeHtml(doc.user?.name || "Unknown")} <span class="text-gray-400">· ${escapeHtml(doc.user?.email || "")}</span>`;

function card(doc) {
    const next = NEXT[tab][doc.status] || [];
    const isOrder = tab === "orders";
    const paidTag = doc.paymentStatus === "paid"
        ? '<span class="text-xs font-medium text-green-700">Paid</span>'
        : '<span class="text-xs font-medium text-gray-400">Unpaid</span>';

    const details = isOrder
        ? `<p class="mt-1 text-sm text-gray-700">${doc.items.map((item) => `${escapeHtml(item.name)} ×${item.quantity}`).join(", ")}</p>
           <p class="mt-1 text-sm text-gray-500">Deliver to ${escapeHtml(doc.deliveryAddress?.fullName)} · ${escapeHtml(doc.deliveryAddress?.phone)}<br>${escapeHtml(doc.deliveryAddress?.street)}, ${escapeHtml(doc.deliveryAddress?.city)}, ${escapeHtml(doc.deliveryAddress?.state)}${doc.deliveryAddress?.landmark ? ` (${escapeHtml(doc.deliveryAddress.landmark)})` : ""}</p>`
        : `<p class="mt-1 text-sm text-gray-700">${escapeHtml(doc.serviceName || doc.service?.name || "Service")} · ${escapeHtml(formatDay(doc.preferredDate))}, ${escapeHtml(TIME_SLOTS[doc.timeSlot] || "")}</p>
           <p class="mt-1 text-sm text-gray-500">${escapeHtml(doc.phone)}<br>${escapeHtml(doc.address?.street)}, ${escapeHtml(doc.address?.city)}, ${escapeHtml(doc.address?.state)}${doc.address?.landmark ? ` (${escapeHtml(doc.address.landmark)})` : ""}</p>
           ${doc.notes ? `<p class="mt-1 text-sm text-gray-500">Note: ${escapeHtml(doc.notes)}</p>` : ""}`;

    return `<article class="rounded-lg border bg-white p-5" data-id="${doc._id}">
        <div class="flex flex-wrap items-start justify-between gap-2">
            <div><h3 class="font-bold text-gray-900">${isOrder ? escapeHtml(doc.orderNumber) : "Booking " + escapeHtml(doc._id.slice(-6).toUpperCase())}</h3>
            <p class="text-xs text-gray-500">${customer(doc)}</p></div>
            <div class="flex items-center gap-3">${paidTag}${statusBadge(LABELS[tab], doc.status)}</div>
        </div>
        ${details}
        <div class="mt-3 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
            <span class="text-sm font-semibold text-gray-900">${money(isOrder ? doc.total : doc.bookingFee)}</span>
            ${next.length ? `<div class="flex items-center gap-2">
                <select class="rounded-md border bg-white px-2 py-1.5 text-sm" data-select>${next.map((status) => `<option value="${status}">${escapeHtml(LABELS[tab][status].label)}</option>`).join("")}</select>
                <button class="rounded-md bg-yellow-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-yellow-700" data-update type="button">Update</button>
            </div>` : `<span class="text-xs text-gray-400">No further actions</span>`}
        </div>
    </article>`;
}

async function load() {
    adminMessage.textContent = "";
    list.innerHTML = '<p class="text-sm text-gray-500">Loading...</p>';
    document.querySelector("#tab-orders").className = `rounded px-4 py-1.5 ${tab === "orders" ? "bg-yellow-600 text-white" : "text-gray-600"}`;
    document.querySelector("#tab-bookings").className = `rounded px-4 py-1.5 ${tab === "bookings" ? "bg-yellow-600 text-white" : "text-gray-600"}`;
    try {
        const docs = await api(`/admin/${tab}`);
        list.innerHTML = docs.length ? docs.map(card).join("") : `<p class="text-sm text-gray-500">No ${tab} yet.</p>`;
    } catch (error) {
        list.innerHTML = "";
        if (error.status === 401) { clearSession(); return goToLogin("admin.html"); }
        adminMessage.textContent = error.status === 403
            ? "This page is for admins only. Run `npm run make-admin -- your@email.com` in /backend, then sign out and back in."
            : error.message;
    }
}

list.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-update]");
    if (!button) return;
    const cardEl = button.closest("[data-id]");
    const status = cardEl.querySelector("[data-select]").value;
    if (status === "cancelled" && !window.confirm("Cancel this? If it was already paid, you'll need to refund it from the Paystack dashboard.")) return;
    button.disabled = true;
    try {
        await api(`/admin/${tab}/${cardEl.dataset.id}/status`, { method: "PATCH", body: { status } });
        await load();
    } catch (error) {
        adminMessage.textContent = error.message;
        button.disabled = false;
    }
});

document.querySelector("#tab-orders").addEventListener("click", () => { tab = "orders"; load(); });
document.querySelector("#tab-bookings").addEventListener("click", () => { tab = "bookings"; load(); });

if (!getToken()) goToLogin("admin.html");
else load().then(() => window.lucide?.createIcons());