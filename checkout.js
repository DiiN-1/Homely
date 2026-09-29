// Checkout: collects the delivery address, creates the order on the server, then sends the customer to Paystack.
if (!getToken()) goToLogin("checkout.html");

const grid = document.querySelector("#checkout-grid");
const emptyCart = document.querySelector("#empty-cart");
const form = document.querySelector("#checkout-form");
const message = document.querySelector("#checkout-message");
const payButton = document.querySelector("#pay-button");
const payLabel = document.querySelector("#pay-label");
const stateSelect = document.querySelector("#state-select");

// Fallback matches backend/config/pricing.js if /api/config can't be reached
let pricing = { delivery: { homeState: "Rivers", homeFee: 1500, otherFee: 3500, freeAbove: 50000 } };

const deliveryFee = (state, subtotal) => {
    const rules = pricing.delivery;
    if (subtotal >= rules.freeAbove) return 0;
    return state.trim().toLowerCase() === rules.homeState.toLowerCase() ? rules.homeFee : rules.otherFee;
};

function renderSummary() {
    const items = cart.items();
    if (!items.length) {
        grid.classList.add("hidden");
        emptyCart.classList.remove("hidden");
        window.lucide?.createIcons();
        return;
    }
    const subtotal = cart.subtotal();
    const fee = deliveryFee(stateSelect.value, subtotal);

    document.querySelector("#summary-items").innerHTML = items.map((item) => `
        <li class="flex items-start gap-3 py-3">
            <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium text-gray-900">${escapeHtml(item.name)}</p>
                <p class="text-xs text-gray-500">${money(item.price)} each</p>
                <div class="mt-2 flex items-center gap-2">
                    <button type="button" class="h-6 w-6 rounded border text-sm hover:bg-gray-50" data-qty="-1" data-id="${escapeHtml(item.id)}" aria-label="Decrease quantity">−</button>
                    <span class="w-5 text-center text-sm">${item.quantity}</span>
                    <button type="button" class="h-6 w-6 rounded border text-sm hover:bg-gray-50" data-qty="1" data-id="${escapeHtml(item.id)}" aria-label="Increase quantity">+</button>
                    <button type="button" class="ml-2 text-xs text-gray-400 hover:text-red-600" data-remove="${escapeHtml(item.id)}">Remove</button>
                </div>
            </div>
            <span class="text-sm font-medium text-gray-900">${money(item.price * item.quantity)}</span>
        </li>`).join("");

    document.querySelector("#sum-subtotal").textContent = money(subtotal);
    document.querySelector("#sum-delivery").textContent = fee === 0 ? "Free" : money(fee);
    document.querySelector("#sum-total").textContent = money(subtotal + fee);
    document.querySelector("#delivery-hint").textContent = fee === 0
        ? "You qualified for free delivery."
        : `Free delivery on orders of ${money(pricing.delivery.freeAbove)} and above.`;
    payLabel.textContent = `Pay ${money(subtotal + fee)} with Paystack`;
}

document.querySelector("#summary-items").addEventListener("click", (event) => {
    const qtyButton = event.target.closest("[data-qty]");
    const removeButton = event.target.closest("[data-remove]");
    if (qtyButton) {
        const item = cart.items().find((entry) => entry.id === qtyButton.dataset.id);
        if (item) cart.setQuantity(item.id, item.quantity + Number(qtyButton.dataset.qty));
    } else if (removeButton) {
        cart.remove(removeButton.dataset.remove);
    }
    renderSummary();
});

stateSelect.innerHTML = stateOptions("Rivers");
stateSelect.addEventListener("change", renderSummary);

const user = getUser();
if (user?.name) form.elements.fullName.value = user.name;

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    message.textContent = "";
    const data = Object.fromEntries(new FormData(form));

    const missing = ["fullName", "phone", "street", "city"].find((field) => !data[field].trim());
    if (missing) {
        message.textContent = "Please fill in your name, phone number, street address and city.";
        form.elements[missing].focus();
        return;
    }

    payButton.disabled = true;
    payLabel.textContent = "Creating your order...";
    try {
        const result = await api("/orders", {
            method: "POST",
            body: {
                items: cart.items().map((item) => ({ productId: item.id, quantity: item.quantity })),
                deliveryAddress: { fullName: data.fullName, phone: data.phone, street: data.street, city: data.city, state: data.state, landmark: data.landmark },
                notes: data.notes,
            },
        });
        // The order now exists on the server, so the cart has done its job. If payment
        // isn't finished, the customer can still pay from their dashboard.
        cart.clear();
        payLabel.textContent = "Redirecting to Paystack...";
        window.location.href = result.authorizationUrl;
    } catch (error) {
        if (error.status === 401) { clearSession(); goToLogin("checkout.html"); return; }
        message.textContent = error.message;
        payButton.disabled = false;
        renderSummary();
    }
});

(async () => {
    try { pricing = await api("/config", { authed: false }); } catch { /* keep fallback */ }
    renderSummary();
    window.lucide?.createIcons();
})();
