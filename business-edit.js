import { requireAuth, friendlyError } from "./auth.js";
import {
  LIMITS,
  BUSINESS_TYPES,
  validateBusiness,
  listCategories,
  createBusiness,
  updateBusiness,
  getBusiness,
} from "./businesses.js";

const $ = (id) => document.getElementById(id);
const form = $("business-form");
const id = new URLSearchParams(location.search).get("id");
const FIELDS = ["name", "category_id", "description", "location", "contact_info"];
let current = null;

const ERROR_FIELD = [
  [/business or a club/i, "type"],
  [/name/i, "name"],
  [/category/i, "category_id"],
  [/description/i, "description"],
  [/location/i, "location"],
  [/contact/i, "contact_info"],
];

function showPageMessage(text) {
  $("message").textContent = text;
  $("business-loading").hidden = true;
}

function clearErrors() {
  for (const el of form.querySelectorAll(".field__error")) el.textContent = "";
  for (const el of form.querySelectorAll("[aria-invalid]")) el.removeAttribute("aria-invalid");
  $("message").textContent = "";
}

function showFieldError(text) {
  const field = ERROR_FIELD.find(([pattern]) => pattern.test(text))?.[1];
  const slot = field && $(`${field}-error`);
  if (!slot) {
    $("message").textContent = text;
    return;
  }
  slot.textContent = text;
  const input = form.elements[field];
  if (input && input.focus) {
    input.setAttribute?.("aria-invalid", "true");
    input.focus();
  }
}

function updateCounters() {
  for (const el of form.querySelectorAll(".counter")) {
    const field = el.dataset.for;
    el.textContent = `${form.elements[field].value.length}/${LIMITS[field]}`;
  }
}

async function fillCategories() {
  const select = form.elements.category_id;
  for (const cat of await listCategories()) {
    select.append(new Option(cat.name, cat.id));
  }
}

function fillForm(b) {
  document.title = `Edit ${b.name} · Bento`;
  $("heading").textContent = "Edit profile";
  $("save").textContent = "Save changes";
  $("cancel").href = `business.html?id=${encodeURIComponent(b.id)}`;
  $("type-field").hidden = true;
  $("type-fixed").hidden = false;
  $("type-fixed-value").textContent = BUSINESS_TYPES[b.type] || b.type;
  for (const field of FIELDS) form.elements[field].value = b[field] ?? "";
}

function readForm() {
  const data = Object.fromEntries(new FormData(form));
  if (current) data.type = current.type;
  return data;
}

requireAuth(async (user) => {
  try {
    await fillCategories();
    if (id) {
      current = await getBusiness(id);
      if (!current) return showPageMessage("This profile isn't available.");
      if (current.owner_id !== user.uid) return showPageMessage("You can only edit your own profile.");
      fillForm(current);
    }
    updateCounters();
    $("business-loading").hidden = true;
    $("business-content").hidden = false;
  } catch (err) {
    showPageMessage(friendlyError(err));
  }
});

form.addEventListener("input", updateCounters);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearErrors();
  $("save-status").textContent = "";

  const data = readForm();
  const error = validateBusiness(data);
  if (error) return showFieldError(error);

  const button = $("save");
  button.disabled = true;
  $("save-status").textContent = current ? "Saving…" : "Creating your profile…";
  try {
    const targetId = current ? (await updateBusiness(current, data), current.id) : await createBusiness(data);
    window.location.href = `business.html?id=${encodeURIComponent(targetId)}`;
  } catch (err) {
    $("save-status").textContent = "";
    $("message").textContent = friendlyError(err);
    button.disabled = false;
  }
});
