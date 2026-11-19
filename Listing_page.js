import { auth } from "./firebase.js";
import { getMyBusinesses } from "./business_service.js";
import {
    createListing,
    getBusinessListings,
    updateListing,
    toggleListingStatus,
    deleteListing
} from "./listing_service.js";

const businessSelect = document.getElementById("businessSelect");
const newListingBtn = document.getElementById("newListingBtn");
const formPanel = document.getElementById("formPanel");
const listingForm = document.getElementById("listingForm");
const listingIdInput = document.getElementById("listingId");
const formTitle = document.getElementById("formTitle");
const listingsContainer = document.getElementById("listingsContainer");
const cancelBtn = document.getElementById("cancelBtn");
let selectedBusinessId = "";
let businesses = [];
function showMessage(message) { alert(message); }
function resetForm() {
    listingForm.reset();
    listingIdInput.value = "";
    formTitle.textContent = "Create Listing";
}
function openCreateForm() { resetForm(); formPanel.style.display = "block"; }
function closeForm() { formPanel.style.display = "none"; resetForm(); }
function fillForm(listing) {
    listingIdInput.value = listing.id;
    document.getElementById("title").value = listing.title;
    document.getElementById("type").value = listing.type;
    document.getElementById("category").value = listing.category;
    document.getElementById("price").value = listing.price ?? "";
    document.getElementById("description").value = listing.description;
    formTitle.textContent = "Edit Listing";
    formPanel.style.display = "block";
}
function renderListings(listings) {
    listingsContainer.innerHTML = "";
    if (listings.length === 0) {
        listingsContainer.innerHTML = "<p>No listings found.</p>";
        return;
    }
    listings.forEach(listing => {
        const card = document.createElement("div");
        card.className = "listing-card";
        if (listing.status === "hidden") card.classList.add("hidden-listing");
        const title = document.createElement("h3");
        title.textContent = listing.title;
        const type = document.createElement("p");
        type.textContent = `Type: ${listing.type}`;
        const category = document.createElement("p");
        category.textContent = `Category: ${listing.category}`;
        const price = document.createElement("p");
        price.textContent = listing.price === null ? "Price: Not specified" : `Price: $${Number(listing.price).toFixed(2)}`;
        const description = document.createElement("p");
        description.textContent = listing.description;
        const status = document.createElement("p");
        status.className = "status";
        status.textContent = `Status: ${listing.status}`;
        const editButton = document.createElement("button");
        editButton.textContent = "Edit";
        editButton.onclick = () => fillForm(listing);
        const hideButton = document.createElement("button");
        hideButton.textContent = listing.status === "active" ? "Hide" : "Unhide";
        hideButton.onclick = async () => {
            try { await toggleListingStatus(listing.id); await loadListings(); }
            catch (error) { showMessage(error.message); }
        };
        const deleteButton = document.createElement("button");
        deleteButton.textContent = "Delete";
        deleteButton.onclick = async () => {
            if (!confirm("Are you sure you want to delete this listing?")) return;
            try { await deleteListing(listing.id); await loadListings(); }
            catch (error) { showMessage(error.message); }
        };
        const actions = document.createElement("div");
        actions.className = "actions";
        actions.append(editButton, hideButton, deleteButton);
        card.append(title, type, category, price, description, status, actions);
        listingsContainer.appendChild(card);
    });
}
async function loadListings() {
    if (!selectedBusinessId) {
        listingsContainer.innerHTML = "<p>Select a business to view listings.</p>";
        return;
    }
    try { renderListings(await getBusinessListings(selectedBusinessId)); }
    catch (error) { showMessage(error.message); }
}
async function loadBusinesses() {
    try {
        businesses = await getMyBusinesses();
        businessSelect.innerHTML = '<option value="">Select a business</option>';
        businesses.forEach(business => {
            const option = document.createElement("option");
            option.value = business.id;
            option.textContent = business.name;
            businessSelect.appendChild(option);
        });
        if (businesses.length === 0) showMessage("You need to create a business before creating listings.");
    } catch (error) { showMessage(error.message); }
}
businessSelect.addEventListener("change", async () => {
    selectedBusinessId = businessSelect.value;
    await loadListings();
});
newListingBtn.addEventListener("click", () => {
    if (!selectedBusinessId) { showMessage("Please select a business first."); return; }
    openCreateForm();
});
cancelBtn.addEventListener("click", closeForm);
listingForm.addEventListener("submit", async event => {
    event.preventDefault();
    const fields = {
        business_id: selectedBusinessId,
        title: document.getElementById("title").value,
        type: document.getElementById("type").value,
        category: document.getElementById("category").value,
        price: document.getElementById("price").value,
        description: document.getElementById("description").value
    };
    try {
        if (listingIdInput.value) {
            await updateListing(listingIdInput.value, fields);
            showMessage("Listing updated successfully.");
        } else {
            await createListing(fields);
            showMessage("Listing created successfully.");
        }
        closeForm();
        await loadListings();
    } catch (error) { showMessage(error.message); }
});
auth.onAuthStateChanged(async user => {
    if (!user) {
        listingsContainer.innerHTML = "<p>Please log in to manage listings.</p>";
        businessSelect.disabled = true;
        newListingBtn.disabled = true;
        return;
    }
    businessSelect.disabled = false;
    newListingBtn.disabled = false;
    await loadBusinesses();
});
