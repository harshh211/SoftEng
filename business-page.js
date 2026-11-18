import { requireAuth, friendlyError } from "./auth.js";
import { BUSINESS_TYPES, getBusiness, listCategories, getActiveListings } from "./businesses.js";

const $ = (id) => document.getElementById(id);
const id = new URLSearchParams(location.search).get("id");

function showPageMessage(text) {
  $("message").textContent = text;
  $("business-loading").hidden = true;
}

async function renderProfile(b, user) {
  document.title = `${b.name} · Bento`;
  $("name").textContent = b.name;
  $("logo").textContent = b.name.trim().charAt(0).toUpperCase() || "?";
  $("type").textContent = BUSINESS_TYPES[b.type] || b.type;
  $("description").textContent = b.description || "";

  const categories = await listCategories().catch(() => []);
  $("category").textContent = categories.find((c) => c.id === b.category_id)?.name || b.category_id;

  $("location").textContent = b.location || "";
  $("location-row").hidden = !b.location;
  $("contact").textContent = b.contact_info || "";
  $("contact-row").hidden = !b.contact_info;
  $("about").hidden = !b.description && !b.location && !b.contact_info;

  const isOwner = b.owner_id === user.uid;
  if (isOwner) {
    $("owner-actions").hidden = false;
    $("edit-profile").href = `business-edit.html?id=${encodeURIComponent(b.id)}`;
    $("add-listing").href = `listing-edit.html?business=${encodeURIComponent(b.id)}`;
    $("add-listing").hidden = b.status !== "active";
  }
  $("suspended-banner").hidden = !(isOwner && b.status === "suspended");

  $("business-loading").hidden = true;
  $("profile").hidden = false;
}

async function cardRenderer() {
  try {
    const mod = await import("./listing-card.js");
    return mod.renderListingCard;
  } catch {
    return (listing) => {
      const card = document.createElement("a");
      card.className = "simple-card";
      card.href = `listing.html?id=${encodeURIComponent(listing.id)}`;
      const title = document.createElement("strong");
      title.textContent = listing.title;
      const price = document.createElement("span");
      price.className = "muted";
      price.textContent = Number(listing.price) === 0 ? "Free" : `$${listing.price}`;
      card.append(title, price);
      return card;
    };
  }
}

async function renderListings(b) {
  const status = $("listings-status");
  let listings;
  try {
    listings = await getActiveListings(b.id);
  } catch {
    status.textContent = "Couldn't load listings. Try refreshing the page.";
    return;
  }
  if (listings.length === 0) {
    status.textContent = "No listings yet.";
    return;
  }
  status.hidden = true;
  const render = await cardRenderer();
  const grid = $("listings");
  for (const listing of listings) grid.append(render(listing, { businessName: b.name }));
}

requireAuth(async (user) => {
  try {
    const b = await getBusiness(id);
    if (!b) return showPageMessage("This profile isn't available.");
    await renderProfile(b, user);
    await renderListings(b);
  } catch (err) {
    showPageMessage(friendlyError(err));
  }
});
