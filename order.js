// Order detail + tracking page: /order.html?id=<orderId>
const content = document.querySelector("#content");
const orderId = new URLSearchParams(window.location.search).get("id");

// The happy path an order follows once it's paid
const TRACK_STEPS = [
    { status: "pending_payment", label: "Order placed" },
    { status: "paid", label: "Payment confirmed" },
    { status: "processing", label: "Being prepared" },
    { status: "out_for_delivery", label: "Out for delivery" },
    { status: "delivered", label: "Delivered" },
];

function renderTimeline(order) {
    const history = order.statusHistory || [];
    const when = (status) => history.find((entry) => entry.status === status)?.at;
    const currentIndex = TRACK_STEPS.findIndex((step) => step.status === order.status);
    const cancelled = order.status === "cancelled" || order.status === "payment_failed";

    // Cancelled/failed orders show what happened instead of a progress bar
    if (cancelled) {
        return `<ol class="space-y-4">${history.map((entry) => `
            <li class="flex gap-3"><span class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${entry.status === "cancelled" || entry.status === "payment_failed" ? "bg-red-500" : "bg-gray-300"}"></span>
            <div><p class="text-sm font-medium text-gray-900">${escapeHtml((ORDER_STATUS[entry.status]?.label) || entry.status)}</p>
            <p class="text-xs text-gray-500">${escapeHtml(entry.note || "")} ${entry.note ? "·" : ""} ${escapeHtml(formatDateTime(entry.at))}</p></div></li>`).join("")}</ol>`;
    }

    return `<ol class="space-y-5">${TRACK_STEPS.map((step, index) => {
        const reached = index <= currentIndex;
        const timestamp = when(step.status);
        return `<li class="flex gap-3">
            <span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${reached ? "bg-yellow-600 text-white" : "border-2 border-gray-200 bg-white"}">${reached ? '<i data-lucide="check" class="h-3 w-3"></i>' : ""}</span>
            <div><p class="text-sm font-medium ${reached ? "text-gray-900" : "text-gray-400"}">${step.label}</p>
            ${timestamp ? `<p class="text-xs text-gray-500">${escapeHtml(formatDateTime(timestamp))}</p>` : ""}</div></li>`;
    }).join("")}</ol>`;
}

function render(order) {
    const address = order.deliveryAddress || {};
    const unpaid = order.status === "pending_payment" || order.status === "payment_failed";
    document.title = `Order ${order.orderNumber} | Homely`;

    content.innerHTML = `
        <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
                <h1 class="text-2xl font-bold text-gray-900">Order ${escapeHtml(order.orderNumber)}</h1>
                <p class="mt-1 text-sm text-gray-500">Placed ${escapeHtml(formatDateTime(order.createdAt))}</p>
            </div>
            ${statusBadge(ORDER_STATUS, order.status)}
        </div>

        <div class="mt-8 grid gap-6 md:grid-cols-[1fr_320px]">
            <div class="space-y-6">
                <section class="rounded-lg border bg-white p-6">
                    <h2 class="font-bold text-gray-900">Items</h2>
                    <ul class="mt-3 divide-y">${order.items.map((item) => `
                        <li class="flex items-center justify-between gap-4 py-3 text-sm">
                            <div><p class="font-medium text-gray-900">${escapeHtml(item.name)}</p><p class="text-xs text-gray-500">${money(item.price)} × ${item.quantity}</p></div>
                            <span class="font-medium text-gray-900">${money(item.price * item.quantity)}</span>
                        </li>`).join("")}</ul>
                    <dl class="mt-3 space-y-2 border-t pt-4 text-sm">
                        <div class="flex justify-between"><dt class="text-gray-500">Subtotal</dt><dd>${money(order.subtotal)}</dd></div>
                        <div class="flex justify-between"><dt class="text-gray-500">Delivery</dt><dd>${order.deliveryFee ? money(order.deliveryFee) : "Free"}</dd></div>
                        <div class="flex justify-between border-t pt-3 text-base font-bold text-gray-900"><dt>Total</dt><dd>${money(order.total)}</dd></div>
                    </dl>
                </section>

                <section class="rounded-lg border bg-white p-6">
                    <h2 class="font-bold text-gray-900">Delivery address</h2>
                    <p class="mt-3 text-sm text-gray-700">${escapeHtml(address.fullName)} · ${escapeHtml(address.phone)}</p>
                    <p class="text-sm text-gray-700">${escapeHtml(address.street)}, ${escapeHtml(address.city)}, ${escapeHtml(address.state)}</p>
                    ${address.landmark ? `<p class="mt-1 text-sm text-gray-500">Landmark: ${escapeHtml(address.landmark)}</p>` : ""}
                    ${order.notes ? `<p class="mt-3 text-sm text-gray-500">Note: ${escapeHtml(order.notes)}</p>` : ""}
                </section>
            </div>

            <div class="space-y-6">
                <section class="rounded-lg border bg-white p-6">
                    <h2 class="font-bold text-gray-900">Progress</h2>
                    <div class="mt-4">${renderTimeline(order)}</div>
                </section>

                <section class="rounded-lg border bg-white p-6 text-sm">
                    <h2 class="font-bold text-gray-900">Payment</h2>
                    <p class="mt-3 text-gray-700">${order.paymentStatus === "paid" ? `Paid ${escapeHtml(formatDateTime(order.paidAt))}` : "Not paid yet"}</p>
                    ${order.paymentReference ? `<p class="mt-1 break-all text-xs text-gray-400">Ref: ${escapeHtml(order.paymentReference)}</p>` : ""}
                    <div class="mt-4 flex flex-col gap-2" id="actions">
                        ${unpaid ? `<button class="rounded-md bg-yellow-600 py-2.5 font-medium text-white hover:bg-yellow-700" id="pay-now" type="button">Pay ${money(order.total)} now</button>
                        <button class="rounded-md border py-2.5 font-medium text-gray-700 hover:bg-gray-50" id="cancel-order" type="button">Cancel order</button>` : ""}
                        ${order.paymentStatus === "paid" ? `<button class="rounded-md border py-2.5 font-medium text-gray-700 hover:bg-gray-50" onclick="window.print()" type="button">Print receipt</button>` : ""}
                    </div>
                    <p class="mt-2 min-h-4 text-xs text-red-600" id="action-error"></p>
                </section>
            </div>
        </div>`;

    document.querySelector("#pay-now")?.addEventListener("click", async (event) => {
        event.target.disabled = true;
        try {
            const result = await api(`/orders/${order._id}/pay`, { method: "POST" });
            window.location.href = result.authorizationUrl;
        } catch (error) {
            document.querySelector("#action-error").textContent = error.message;
            event.target.disabled = false;
        }
    });
    document.querySelector("#cancel-order")?.addEventListener("click", async (event) => {
        if (!window.confirm("Cancel this order?")) return;
        event.target.disabled = true;
        try {
            render(await api(`/orders/${order._id}/cancel`, { method: "POST" }));
        } catch (error) {
            document.querySelector("#action-error").textContent = error.message;
            event.target.disabled = false;
        }
    });
    window.lucide?.createIcons();
}

(async () => {
    if (!getToken()) return goToLogin(window.location.pathname + window.location.search);
    if (!orderId) { content.innerHTML = '<p class="text-sm text-gray-500">No order selected. <a class="text-yellow-700 underline" href="orders.html">Go to your orders</a>.</p>'; return; }
    try {
        render(await api(`/orders/${encodeURIComponent(orderId)}`));
    } catch (error) {
        if (error.status === 401) { clearSession(); return goToLogin(window.location.pathname + window.location.search); }
        content.innerHTML = `<p class="text-sm text-red-600">${escapeHtml(error.message)}</p><a class="mt-3 inline-block text-sm text-yellow-700 underline" href="orders.html">Back to your orders</a>`;
    }
})();