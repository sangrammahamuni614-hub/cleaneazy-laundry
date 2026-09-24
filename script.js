const phone = "919145554242";

const modal = document.getElementById("bookingModal");
const form = document.getElementById("bookingForm");
const errorBox = document.getElementById("formError");
const offerMini = document.getElementById("offerMini");
const menuBtn = document.querySelector(".menu-btn");
const mobileNav = document.getElementById("mobileNav");

function openBooking(service = "", offer = "") {
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  const serviceField = form.elements.service;
  if (service && serviceField) serviceField.value = service;
  if (offer) {
    offerMini.hidden = false;
    offerMini.textContent = offer;
  } else {
    offerMini.hidden = true;
    offerMini.textContent = "";
  }
  setTimeout(() => form.elements.name?.focus(), 60);
}

function closeBooking() {
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  errorBox.hidden = true;
  errorBox.textContent = "";
}

document.querySelectorAll("[data-open-booking]").forEach(btn => {
  btn.addEventListener("click", () => openBooking(btn.dataset.service || "", btn.dataset.offer || ""));
});

document.querySelectorAll("[data-service]").forEach(btn => {
  btn.addEventListener("click", () => openBooking(btn.dataset.service || ""));
});

document.querySelectorAll("[data-close-booking]").forEach(el => {
  el.addEventListener("click", closeBooking);
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && modal.getAttribute("aria-hidden") === "false") closeBooking();
});

menuBtn?.addEventListener("click", () => {
  const open = mobileNav.classList.toggle("open");
  menuBtn.setAttribute("aria-expanded", String(open));
});

document.querySelectorAll(".mobile-nav a, .mobile-book").forEach(el => {
  el.addEventListener("click", () => {
    mobileNav.classList.remove("open");
    menuBtn?.setAttribute("aria-expanded", "false");
  });
});

function normalizeMobile(value) {
  return value.replace(/\D/g, "").replace(/^91/, "").slice(-10);
}

form?.addEventListener("submit", (e) => {
  e.preventDefault();
  errorBox.hidden = true;

  const data = new FormData(form);
  const name = String(data.get("name") || "").trim();
  const mobile = normalizeMobile(String(data.get("mobile") || ""));
  const service = String(data.get("service") || "").trim();
  const time = String(data.get("time") || "").trim();
  const address = String(data.get("address") || "").trim();
  const note = String(data.get("note") || "").trim();

  if (!name || !mobile || mobile.length !== 10 || !service || !address) {
    errorBox.textContent = "Please fill Name, valid 10-digit Mobile Number, Service and Pickup Address.";
    errorBox.hidden = false;
    return;
  }

  const offer = offerMini.hidden ? "" : offerMini.textContent.trim();

  const lines = [
    "Hello CleanEazy 👋",
    "",
    "*New Pickup Booking Request*",
    `Name: ${name}`,
    `Mobile: ${mobile}`,
    `Service: ${service}`,
    `Preferred Time: ${time || "Not specified"}`,
    `Pickup Address: ${address}`,
    `Special Note: ${note || "None"}`,
    offer ? `Offer: ${offer}` : "",
    "",
    "Please confirm pickup availability."
  ].filter(Boolean);

  const url = `https://wa.me/${phone}?text=${encodeURIComponent(lines.join("\n"))}`;

  // No "booking received" claim is shown. The customer still has to press Send in WhatsApp.
  window.open(url, "_blank", "noopener,noreferrer");
});

document.getElementById("year").textContent = new Date().getFullYear();

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add("in");
      observer.unobserve(entry.target);
    }
  });
}, {threshold: 0.12});

document.querySelectorAll(".reveal").forEach(el => observer.observe(el));
