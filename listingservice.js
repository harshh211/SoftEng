import {
    collection,
    addDoc,
    getDoc,
    getDocs,
    doc,
    query,
    where,
    orderBy,
    updateDoc,
    deleteDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

import { auth, db } from "./firebase.js";

export const LISTING_TYPES = {
    product: "Product",
    service: "Service",
    event: "Event"
};


const MAX_TITLE_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 2000;


function validateListing(fields) {
    if (!fields.business_id) {
        throw new Error("Please select a business.");
    }
    if (!fields.title || fields.title.trim().length === 0) {
        throw new Error("Listing title is required.");
    }
    if (fields.title.length > MAX_TITLE_LENGTH) {
        throw new Error("Title must be 100 characters or less.");
    }
    if (!LISTING_TYPES[fields.type]) {
        throw new Error("Invalid listing type.");
    }
    if (!fields.category || fields.category.trim().length === 0) {
        throw new Error("Category is required.");
    }
    if (!fields.description) {
        throw new Error("Description is required.");
    }
    if (fields.description.length > MAX_DESCRIPTION_LENGTH) {
        throw new Error("Description must be 2000 characters or less.");
    }
    if (fields.price !== "" && fields.price !== null) {
        const price = Number(fields.price);
        if (Number.isNaN(price) || price < 0) {
            throw new Error("Price must be a valid non-negative number.");
        }
    }
}

async function verifyBusinessOwnership(businessId) {
    const user = auth.currentUser;
    if (!user) {
        throw new Error("You must be logged in.");
    }
    const businessRef = doc(db, "businesses", businessId);
    const businessSnap = await getDoc(businessRef);
    if (!businessSnap.exists()) {
        throw new Error("Business not found.");
    }
    const business = businessSnap.data();
    if (business.owner_id !== user.uid) {
        throw new Error("You do not have permission to manage this business.");
    }
    return business;
}

export async function createListing(fields) {
    validateListing(fields);
    await verifyBusinessOwnership(fields.business_id);
    const user = auth.currentUser;
    const listingData = {
        business_id: fields.business_id,
        owner_id: user.uid,
        title: fields.title.trim(),
        title_lower: fields.title.trim().toLowerCase(),
        type: fields.type,
        category: fields.category.trim(),
        description: fields.description.trim(),
        price: fields.price === "" ? null : Number(fields.price),
        status: "active",
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
    };
    return await addDoc(collection(db, "listings"), listingData);
}
export async function getBusinessListings(businessId) {
    await verifyBusinessOwnership(businessId);
    const q = query(
        collection(db, "listings"),
        where("business_id", "==", businessId),
        orderBy("created_at", "desc")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}
export async function getListing(listingId) {
    const user = auth.currentUser;
    if (!user) {
        throw new Error("You must be logged in.");
    }
    const listingRef = doc(db, "listings", listingId);
    const listingSnap = await getDoc(listingRef);
    if (!listingSnap.exists()) {
        throw new Error("Listing not found.");
    }
    const listing = listingSnap.data();
    if (listing.owner_id !== user.uid) {
        throw new Error("You do not have permission to access this listing.");
    }
    return listing;
}
export async function updateListing(listingId, fields) {
    const existing = await getListing(listingId);
    const merged = { ...existing, ...fields };
    validateListing(merged);
    const listingRef = doc(db, "listings", listingId);
    await updateDoc(listingRef, {
        title: fields.title.trim(),
        title_lower: fields.title.trim().toLowerCase(),
        type: fields.type,
        category: fields.category.trim(),
        description: fields.description.trim(),
        price: fields.price === "" ? null : Number(fields.price),
        updated_at: serverTimestamp()
    });
}
export async function toggleListingStatus(listingId) {
    const listing = await getListing(listingId);
    const newStatus = listing.status === "active" ? "hidden" : "active";
    const listingRef = doc(db, "listings", listingId);
    await updateDoc(listingRef, {
        status: newStatus,
        updated_at: serverTimestamp()
    });
    return newStatus;
}
export async function deleteListing(listingId) {
    await getListing(listingId);
    const listingRef = doc(db, "listings", listingId);
    await deleteDoc(listingRef);
}
export async function getActiveListings(businessId) {
    const q = query(
        collection(db, "listings"),
        where("business_id", "==", businessId),
        where("status", "==", "active"),
        orderBy("created_at", "desc")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}
export async function getMyListings() {
    const user = auth.currentUser;
    if (!user) {
        throw new Error("You must be logged in.");
    }
    const q = query(
        collection(db, "listings"),
        where("owner_id", "==", user.uid),
        orderBy("created_at", "desc")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}
