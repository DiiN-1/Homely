// "My orders" page: list, filter, pay-now and cancel.
const listEl = document.querySelector("#orders-list");
const filtersEl = document.querySelector("#filters");
const messageEl = document.querySelector("#orders-message");

const FILTERS = [
    { key: "all", label: "All", test: () => true },
    { key: "topay", label: "To pay", test: (o) => o.status === "pending_payment" || o.status === "payment_failed" },
    { key: "active", label: "In progress", test: (o) => ["paid", "processing", "out_for_delivery"].includes(o.status) },
    { key: "delivered", label: "Delivered", test: (o) => o.status === "delivered" },
    { key: "cancelled", label: "Cancelled", test: (o) => o.status === "cancelled" },
];
let orders = [];
let activeFilter = "all";

function renderFilters() {
    filtersEl.innerHTML = FILTERS.map((filter) => {
        const count = orders.filter(filter.test).length;
        const on = filter.key === activeFilter;
        return `<button type="button" role="tab" data-filter="${filter.key}" class="rounded-full border px-4 py-1.5 text-sm font-medium ${on ? "border-yellow-600 bg-yellow-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}">${filter.label}${filter.key !== "all" && count ? ` (${count})` : ""}</button>`;
    }).join("");
}

function renderOrders() {
    const filter = FILTERS.find((entry) => entry.key === activeFilter);
    const shown = orders.filter(filter.test);
    if (!orders.length) {
        listEl.innerHTML = `<div class="rounded-lg border bg-white p-10 text-center">
            <i data-lucide="package" class="mx-auto h-8 w-8 text-gray-300"></i>
            <p class="mt-3 font-semibold text-gray-900">No orders yet</p>
            <p class="mt-1 text-sm text-gray-500">Add a product to your cart and check out to see it here.</p>
            <a class="mt-5 inline-block rounded-md bg-yellow-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-yellow-700" href="index.html#shop">Browse products</a></div>`;
        window.lucide?.createIcons();
        return;
    }
    if (!shown.length) {
        listEl.innerHTML = '<p class="text-sm text-gray-500">Nothing in this tab.</p>';
        return;
    }
    listEl.innerHTML = shown.map((order) => {
        const items = order.items || [];
        const names = items.slice(0, 3).map((item) => `${escapeHtml(item.name)} ×${item.quantity}`).join(", ") + (items.length > 3 ? ` +${items.length - 3} more` : "");
        const unpaid = order.status === "pending_payment" || order.status === "payment_failed";
        return `<article class="rounded-lg border bg-white p-5">
            <div class="flex flex-wrap items-start justify-between gap-2">
                <div><h2 class="font-bold text-gray-900">${escapeHtml(order.orderNumber || "Order")}</h2><p class="text-xs text-gray-400">${escapeHtml(formatDateTime(order.createdAt))}</p></div>
                ${statusBadge(ORDER_STATUS, order.status)}
            </div>
            <p class="mt-3 text-sm text-gray-600">${names || "Order items unavailable"}</p>
            <div class="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                <span class="text-base font-bold text-gray-900">${money(order.total)}</span>
                <div class="flex flex-wrap items-center gap-2">
                    <a class="rounded-md border px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50" href="order.html?id=${order._id}">View details</a>
                    ${unpaid ? `<button type="button" class="rounded-md border px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60" data-action="cancel" data-id="${order._id}">Cancel</button>
                    <button type="button" class="rounded-md bg-yellow-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-yellow-700 disabled:opacity-60" data-action="pay" data-id="${order._id}">Pay now</button>` : ""}
                </div>
            </div>
        </article>`;
    }).join("");
}

function render() { renderFilters(); renderOrders(); }

async function load() {
    try {
        orders = await api("/orders/mine");
        render();
    } catch (error) {
        if (error.status === 401) { clearSession(); return goToLogin("orders.html"); }
        listEl.innerHTML = "";
        messageEl.textContent = error.message;
    }
}

filtersEl.addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;
    activeFilter = button.dataset.filter;
    render();
});

listEl.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    messageEl.textContent = "";
    if (button.dataset.action === "cancel" && !window.confirm("Cancel this order?")) return;

    button.disabled = true;
    try {
        if (button.dataset.action === "pay") {
            const result = await api(`/orders/${button.dataset.id}/pay`, { method: "POST" });
            window.location.href = result.authorizationUrl;
            return;
        }
        const updated = await api(`/orders/${button.dataset.id}/cancel`, { method: "POST" });
        orders = orders.map((order) => order._id === updated._id ? updated : order);
        render();
    } catch (error) {
        messageEl.textContent = error.message;
        button.disabled = false;
    }
});

if (!getToken()) goToLogin("orders.html");
else load();