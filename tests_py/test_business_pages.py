"""Kadie: business and organization profiles (FR-2.1-2.4).

Covers js/businesses.js, business-edit.html, business.html and "Your profiles" on index.html.
Runs against a fake Firebase, so no internet or Firebase project is needed.
"""

import unittest

from support import BrowserTestCase, FAKE_APP, FAKE_AUTH

# Until the shared fake in support.py supports queries, these tests bring their own.
# It adds collection/addDoc/query/where/orderBy/getDocs, records the fields of every
# write, and can pretend the rules blocked a read (window.__fb.denied).
FAKE_FIRESTORE = r"""
const fb = () => window.__fb;
function save() { sessionStorage.setItem("__fb", JSON.stringify(fb())); }
const denied = (path) => (fb().denied || []).includes(path);
const err = (code) => Object.assign(new Error(code), { code });

export function getFirestore() { return {}; }
export function connectFirestoreEmulator() {}
export function serverTimestamp() { return "SERVER_TIMESTAMP"; }
export function doc(db, collection, id) { return { path: `${collection}/${id}`, id }; }
export function collection(db, name) { return { collection: name }; }
export function query(col, ...constraints) { return { collection: col.collection, constraints }; }
export function where(field, op, value) { return { kind: "where", field, op, value }; }
export function orderBy(field, dir = "asc") { return { kind: "orderBy", field, dir }; }

export async function setDoc(ref, data) {
  fb().calls.push(["setDoc", ref.path, Object.keys(data).sort()]);
  fb().docs[ref.path] = data; save();
}
export async function addDoc(col, data) {
  fb().nextId = (fb().nextId || 0) + 1;
  const id = `new${fb().nextId}`;
  const path = `${col.collection}/${id}`;
  fb().calls.push(["addDoc", path, Object.keys(data).sort()]);
  fb().docs[path] = data; save();
  return { id, path };
}
export async function updateDoc(ref, data) {
  fb().calls.push(["updateDoc", ref.path, Object.keys(data).sort()]);
  fb().docs[ref.path] = { ...fb().docs[ref.path], ...data }; save();
}
export async function getDoc(ref) {
  if (denied(ref.path)) throw err("permission-denied");
  const d = fb().docs[ref.path];
  return { id: ref.id, exists: () => d !== undefined, data: () => d };
}
export async function getDocs(q) {
  const name = q.collection;
  let rows = Object.entries(fb().docs)
    .filter(([path]) => path.startsWith(name + "/") && path.split("/").length === 2)
    .map(([path, data]) => ({ id: path.split("/")[1], data }));
  for (const c of q.constraints || []) {
    if (c.kind === "where" && c.op === "==") rows = rows.filter((r) => r.data[c.field] === c.value);
    if (c.kind === "orderBy") {
      rows.sort((a, b) => (a.data[c.field] > b.data[c.field] ? 1 : -1) * (c.dir === "desc" ? -1 : 1));
    }
  }
  fb().calls.push(["getDocs", name]);
  const docs = rows.map((r) => ({ id: r.id, data: () => r.data }));
  return { docs, size: docs.length, empty: docs.length === 0 };
}
"""

ALICE = "alice@student.gsu.edu"
BOB = "bob@student.gsu.edu"

CATEGORIES = {
    "categories/food": {"name": "Food", "description": ""},
    "categories/beauty": {"name": "Beauty", "description": ""},
    "categories/clubs-social": {"name": "Clubs", "description": ""},
}

ALICE_BIZ = {
    "owner_id": "alice", "type": "business", "category_id": "beauty",
    "name": "Braids by Alice", "name_lower": "braids by alice",
    "description": "Box braids and twists.\nWeekends only.", "location": "Student Center East",
    "contact_info": "@braidsbyalice", "logo_url": None, "status": "active", "created_at": 1,
}


def listing(title, created, business="aliceBiz", status="active", price=20):
    return {"business_id": business, "owner_id": "alice", "business_type": "business",
            "category_id": "beauty", "type": "service", "title": title,
            "title_lower": title.lower(), "price": price, "status": status, "created_at": created}


def world(role_alice="student", **extra_docs):
    """Alice and Bob are verified students; Alice is signed in."""
    return {
        "users": {
            ALICE: {"uid": "alice", "password": "secret123", "verified": True},
            BOB: {"uid": "bob", "password": "secret123", "verified": True},
        },
        "docs": {
            "users/alice": {"name": "Alice Smith", "gsu_email": ALICE, "role": role_alice, "is_verified": True},
            "users/bob": {"name": "Bob Lee", "gsu_email": BOB, "role": "student", "is_verified": True},
            **CATEGORIES,
            **extra_docs,
        },
        "signed_in": ALICE,
    }


class BusinessTestCase(BrowserTestCase):

    @staticmethod
    def _serve_fake_firebase(route):
        url = route.request.url
        body = {"firebase-app.js": FAKE_APP, "firebase-auth.js": FAKE_AUTH,
                "firebase-firestore.js": FAKE_FIRESTORE}.get(url.rsplit("/", 1)[-1])
        if body is None:
            return route.abort()
        route.fulfill(status=200, content_type="text/javascript", body=body,
                      headers={"Access-Control-Allow-Origin": "*"})

    def seed(self, state, signed_in=ALICE, denied=()):
        state = {**state, "signed_in": signed_in}
        self.seed_firebase(**state)
        if denied:
            self.page.evaluate("d => { const s = JSON.parse(sessionStorage.getItem('__fb'));"
                               " s.denied = d; sessionStorage.setItem('__fb', JSON.stringify(s)); }",
                               list(denied))

    def field_error(self, field):
        """Text under a form field (Mariam's .field__error pattern)."""
        el = self.page.locator(f"#{field}-error")
        if field != "name":
            self.page.wait_for_function(f"() => document.querySelector('#{field}-error').textContent.length > 0")
        return el.inner_text().strip()

    def calls(self, kind):
        return [c for c in self.fb_state()["calls"] if c[0] == kind]


class Validation(BusinessTestCase):
    """validateBusiness() in js/businesses.js."""

    def setUp(self):
        super().setUp()
        self.page.goto(self.url("offline.html"))

    def check(self, **fields):
        base = {"type": "business", "name": "Braids", "category_id": "beauty"}
        return self.page.evaluate(
            "async f => (await import('/js/businesses.js')).validateBusiness(f)", {**base, **fields})

    def test_valid_profile(self):
        self.assertIsNone(self.check())
        self.assertIsNone(self.check(type="organization", name="  Chess Club  "))

    def test_errors(self):
        cases = {
            "name": dict(name="   "),
            "80 characters": dict(name="x" * 81),
            "category": dict(category_id=""),
            "business or a club": dict(type="store"),
            "Description": dict(description="x" * 2001),
            "Location": dict(location="x" * 201),
            "Contact": dict(contact_info="x" * 201),
        }
        for expected, fields in cases.items():
            with self.subTest(expected):
                self.assertIn(expected, self.check(**fields))


class CreateProfile(BusinessTestCase):

    def open_form(self, role="student"):
        self.seed(world(role_alice=role))
        self.page.goto(self.url("business-edit.html"))
        self.page.wait_for_selector("#business-content:not([hidden])")

    def fill(self, type_="business", name="Braids by Alice", category="beauty", **rest):
        self.page.check(f"input[name=type][value={type_}]")
        self.page.fill("input[name=name]", name)
        self.page.select_option("select[name=category_id]", category)   # "" = "Choose a category"
        for field, value in rest.items():
            self.page.fill(f"[name={field}]", value)
        self.page.click("#save")

    def test_requires_sign_in(self):
        self.page.goto(self.url("business-edit.html"))
        self.page.wait_for_url("**/login.html")

    def test_categories_are_listed_alphabetically(self):
        self.open_form()
        options = self.page.eval_on_selector_all(
            "select[name=category_id] option", "os => os.map(o => o.textContent)")
        self.assertEqual(options, ["Choose a category", "Beauty", "Clubs", "Food"])

    def test_create_business_saves_the_right_fields_and_opens_the_profile(self):
        self.open_form()
        self.fill(description="Box braids", location="SCE", contact_info="@alice")
        self.page.wait_for_url("**/business.html?id=new1")

        doc = self.fb_state()["docs"]["businesses/new1"]
        self.assertEqual(doc["owner_id"], "alice")
        self.assertEqual(doc["type"], "business")
        self.assertEqual(doc["name_lower"], "braids by alice")
        self.assertEqual(doc["status"], "active")
        self.assertIsNone(doc["logo_url"])
        self.assertEqual(doc["created_at"], "SERVER_TIMESTAMP")
        # Exactly the fields firestore.rules allows on create.
        self.assertEqual(self.calls("addDoc")[0][2], sorted([
            "category_id", "contact_info", "created_at", "description", "location",
            "logo_url", "name", "name_lower", "owner_id", "status", "type"]))

    def test_student_becomes_owner(self):
        self.open_form()
        self.fill()
        self.page.wait_for_url("**/business.html?id=new1")
        self.assertEqual(self.fb_state()["docs"]["users/alice"]["role"], "owner")

    def test_club_makes_student_an_organization(self):
        self.open_form()
        self.fill(type_="organization", name="Chess Club", category="clubs-social")
        self.page.wait_for_url("**/business.html?id=new1")
        self.assertEqual(self.fb_state()["docs"]["users/alice"]["role"], "organization")

    def test_other_roles_are_left_alone(self):
        self.open_form(role="admin")
        self.fill()
        self.page.wait_for_url("**/business.html?id=new1")
        self.assertEqual(self.fb_state()["docs"]["users/alice"]["role"], "admin")

    def test_missing_name_or_category_shows_error_and_saves_nothing(self):
        self.open_form()
        self.fill(name="  ")
        self.assertEqual(self.field_error("name"), "Please enter a name.")
        self.fill(category="")
        self.assertEqual(self.field_error("category_id"), "Please choose a category.")
        self.assertEqual(self.field_error("name"), "", "old errors are cleared on the next try")
        self.assertEqual(self.calls("addDoc"), [])

    def test_description_counter(self):
        self.open_form()
        self.page.fill("textarea[name=description]", "hello")
        self.assertEqual(self.page.inner_text(".counter").strip(), "5/2000")


class EditProfile(BusinessTestCase):

    def open_form(self, signed_in=ALICE, business="aliceBiz"):
        self.seed(world(**{"businesses/aliceBiz": ALICE_BIZ}), signed_in=signed_in)
        self.page.goto(self.url(f"business-edit.html?id={business}"))

    def test_form_is_filled_in_and_type_is_fixed(self):
        self.open_form()
        self.page.wait_for_selector("#business-content:not([hidden])")
        self.assertEqual(self.page.input_value("input[name=name]"), "Braids by Alice")
        self.assertEqual(self.page.input_value("select[name=category_id]"), "beauty")
        self.assertFalse(self.page.is_visible("#type-field"))
        self.assertEqual(self.page.inner_text("#type-fixed-value"), "Business")

    def test_saving_sends_only_changed_fields(self):
        self.open_form()
        self.page.wait_for_selector("#business-content:not([hidden])")
        self.page.fill("input[name=name]", "Braids & Locs by Alice")
        self.page.fill("input[name=location]", "Library")
        self.page.click("#save")
        self.page.wait_for_url("**/business.html?id=aliceBiz")

        _, path, keys = self.calls("updateDoc")[0]
        self.assertEqual(path, "businesses/aliceBiz")
        self.assertEqual(keys, ["location", "name", "name_lower", "updated_at"])
        doc = self.fb_state()["docs"]["businesses/aliceBiz"]
        self.assertEqual(doc["name_lower"], "braids & locs by alice")
        self.assertEqual(doc["status"], "active")

    def test_someone_else_cannot_edit(self):
        self.open_form(signed_in=BOB)
        self.assertEqual(self.wait_for_message(), "You can only edit your own profile.")
        self.assertFalse(self.page.is_visible("#business-form"))

    def test_unknown_profile(self):
        self.open_form(business="nope")
        self.assertEqual(self.wait_for_message(), "This profile isn't available.")


class ProfilePage(BusinessTestCase):

    def open_profile(self, signed_in=ALICE, biz=None, denied=(), extra=None):
        docs = {"businesses/aliceBiz": biz or ALICE_BIZ, **(extra or {})}
        self.seed(world(**docs), signed_in=signed_in, denied=denied)
        self.page.goto(self.url("business.html?id=aliceBiz"))

    def wait_for_profile(self):
        self.page.wait_for_selector("#profile:not([hidden])")
        self.page.wait_for_function(
            "() => document.querySelector('#listings-status').hidden"
            " || !document.querySelector('#listings-status').textContent.startsWith('Loading')")

    def test_shows_profile_details(self):
        self.open_profile(signed_in=BOB)
        self.wait_for_profile()
        self.assertEqual(self.page.inner_text("#name"), "Braids by Alice")
        self.assertEqual(self.page.inner_text("#type"), "Business")
        self.assertEqual(self.page.inner_text("#category"), "Beauty")
        self.assertEqual(self.page.inner_text("#logo"), "B")
        self.assertEqual(self.page.inner_text("#location"), "Student Center East")
        self.assertEqual(self.page.title(), "Braids by Alice · Bento")

    def test_owner_sees_edit_and_add_listing(self):
        self.open_profile()
        self.wait_for_profile()
        self.assertTrue(self.page.is_visible("#edit-profile"))
        self.assertEqual(self.page.get_attribute("#add-listing", "href"), "listing-edit.html?business=aliceBiz")

    def test_others_see_no_owner_buttons(self):
        self.open_profile(signed_in=BOB)
        self.wait_for_profile()
        self.assertFalse(self.page.is_visible("#owner-actions"))

    def test_suspended_profile_owner_sees_banner_and_cannot_add_listings(self):
        self.open_profile(biz={**ALICE_BIZ, "status": "suspended"})
        self.wait_for_profile()
        self.assertTrue(self.page.is_visible("#suspended-banner"))
        self.assertFalse(self.page.is_visible("#add-listing"))

    def test_suspended_profile_hidden_from_others(self):
        # The rules block the read, so the page shows "isn't available".
        self.open_profile(signed_in=BOB, denied=["businesses/aliceBiz"])
        self.assertEqual(self.wait_for_message(), "This profile isn't available.")

    def test_shows_only_this_businesss_active_listings_newest_first(self):
        self.open_profile(extra={
            "listings/a": listing("Old braids", 1),
            "listings/b": listing("New braids", 3),
            "listings/c": listing("Hidden braids", 2, status="hidden"),
            "listings/d": listing("Someone else's", 4, business="otherBiz"),
        })
        self.wait_for_profile()
        titles = self.page.eval_on_selector_all("#listings strong", "els => els.map(e => e.textContent)")
        self.assertEqual(titles, ["New braids", "Old braids"])

    def test_no_listings_message(self):
        self.open_profile()
        self.wait_for_profile()
        self.assertEqual(self.page.inner_text("#listings-status"), "No listings yet.")

    def test_user_text_is_shown_as_text_not_html(self):
        self.open_profile(biz={**ALICE_BIZ, "name": "<b>Bold</b>", "description": "<img src=x onerror=alert(1)>"})
        self.wait_for_profile()
        self.assertEqual(self.page.inner_text("#name"), "<b>Bold</b>")
        self.assertEqual(self.page.locator("#description img").count(), 0)


class HomePageProfiles(BusinessTestCase):

    def test_lists_your_profiles_with_links(self):
        self.seed(world(**{
            "businesses/aliceBiz": ALICE_BIZ,
            "businesses/club": {**ALICE_BIZ, "type": "organization", "name": "Art Club"},
            "businesses/bobBiz": {**ALICE_BIZ, "owner_id": "bob", "name": "Bob's Bakes"},
        }))
        self.page.goto(self.url("index.html"))
        self.page.wait_for_selector("#my-profiles li")
        items = self.page.eval_on_selector_all(
            "#my-profiles a", "as => as.map(a => [a.textContent, a.getAttribute('href')])")
        self.assertEqual(items, [
            ["Art Club · Club / organization", "business.html?id=club"],
            ["Braids by Alice · Business", "business.html?id=aliceBiz"],
        ])


if __name__ == "__main__":
    unittest.main()
