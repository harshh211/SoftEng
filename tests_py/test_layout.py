"""Mariam: consistent look and feel, responsive layout, clear errors, profile page.

Requirements: NFR-1.1, NFR-1.3, NFR-2.1, use case "Create and edit personal profile".

The ProfilePage tests switch on automatically once public/profile.html exists.
They expect these element IDs (change the tests if you pick different ones):
  form#profile-form, input[name=name], #message, and the shared header.topbar.
"""

import unittest

from support import PUBLIC, BrowserTestCase

ALICE = "alice@student.gsu.edu"
SIGNED_IN = {
    "users": {ALICE: {"uid": "alice", "password": "secret123", "verified": True}},
    "docs": {"users/alice": {"name": "Alice Smith", "gsu_email": ALICE,
                             "role": "student", "is_verified": True}},
    "signed_in": ALICE,
}

PUBLIC_PAGES = ["login.html", "signup.html", "offline.html"]   # no sign-in needed
SIGNED_IN_PAGES = ["index.html"]                                 # add profile.html etc. here
PHONE = {"width": 390, "height": 760}
DESKTOP = {"width": 1280, "height": 800}


class ConsistentPages(unittest.TestCase):
    """Every page shares the same basics (NFR-1.1). No browser needed."""

    PAGES = sorted(p.name for p in PUBLIC.glob("*.html"))

    def test_every_page_uses_the_shared_stylesheet(self):
        for page in self.PAGES:
            with self.subTest(page=page):
                self.assertRegex((PUBLIC / page).read_text(), r'href="/?css/(styles|base)\.css"')

    def test_every_page_has_a_mobile_viewport(self):
        for page in self.PAGES:
            with self.subTest(page=page):
                self.assertRegex((PUBLIC / page).read_text(),
                                 r'name="viewport" content="width=device-width, initial-scale=1[",]')

    def test_every_page_title_mentions_bento(self):
        for page in self.PAGES:
            with self.subTest(page=page):
                self.assertRegex((PUBLIC / page).read_text(), r"<title>[^<]*Bento</title>")

    def test_every_page_has_lang_attribute(self):
        for page in self.PAGES:
            with self.subTest(page=page):
                self.assertIn('<html lang="en">', (PUBLIC / page).read_text())


class ResponsiveLayout(BrowserTestCase):
    """Pages work at phone and desktop widths (NFR-2.1)."""

    def open(self, page):
        if page in SIGNED_IN_PAGES:
            self.seed_firebase(**SIGNED_IN)
        self.page.goto(self.url(page))
        self.page.wait_for_load_state("networkidle")

    def check_all_pages(self, size, check):
        self.page.set_viewport_size(size)
        for page in PUBLIC_PAGES + SIGNED_IN_PAGES:
            with self.subTest(page=page, width=size["width"]):
                self.open(page)
                check(page)

    def test_no_sideways_scrolling_on_phone_or_desktop(self):
        def check(page):
            overflow = self.page.evaluate(
                "() => document.documentElement.scrollWidth - document.documentElement.clientWidth")
            self.assertLessEqual(overflow, 0, f"{page} scrolls sideways by {overflow}px")
        self.check_all_pages(PHONE, check)
        self.check_all_pages(DESKTOP, check)

    def test_buttons_and_inputs_are_big_enough_to_tap_on_phone(self):
        def check(page):
            small = self.page.evaluate("""() => [...document.querySelectorAll('button, input, a')]
                .filter(el => el.offsetParent !== null)
                .filter(el => !el.closest('p'))   // links inside a sentence are fine
                .map(el => ({ el: el.outerHTML.slice(0, 60), h: el.getBoundingClientRect().height }))
                .filter(x => x.h < 24)""")
            self.assertEqual(small, [], f"{page}: elements shorter than 24px")
        self.check_all_pages(PHONE, check)

    def test_text_is_readable_on_phone(self):
        def check(page):
            size = self.page.evaluate("() => parseFloat(getComputedStyle(document.body).fontSize)")
            self.assertGreaterEqual(size, 16)
        self.check_all_pages(PHONE, check)


class AccessibleForms(BrowserTestCase):
    """Form fields are labeled and errors are announced (NFR-1.3)."""

    def test_every_input_has_a_label(self):
        for page in ["login.html", "signup.html"]:
            with self.subTest(page=page):
                self.page.goto(self.url(page))
                unlabeled = self.page.evaluate("""() => [...document.querySelectorAll('input')]
                    .filter(i => !i.closest('label') && !i.labels?.length && !i.getAttribute('aria-label'))
                    .map(i => i.name)""")
                self.assertEqual(unlabeled, [])

    def test_error_messages_are_announced_to_screen_readers(self):
        for page in ["login.html", "signup.html"]:
            with self.subTest(page=page):
                self.page.goto(self.url(page))
                self.assertEqual(self.page.get_attribute("#message", "role"), "alert")

    def test_error_text_is_red(self):
        self.page.goto(self.url("signup.html"))
        self.page.click("button[type=submit]")
        self.wait_for_message()
        self.assertIn("error", self.page.get_attribute("#message", "class"))
        color = self.page.evaluate("() => getComputedStyle(document.querySelector('#message')).color")
        r, g, b = [int(x) for x in color[color.index("(") + 1:color.index(")")].split(",")[:3]]
        self.assertGreater(r, g + b, f"error text should look red, got {color}")


@unittest.skipUnless((PUBLIC / "profile.html").exists(), "profile.html not built yet")
class ProfilePage(BrowserTestCase):
    """Create and edit personal profile."""

    def open_profile(self):
        self.seed_firebase(**SIGNED_IN)
        self.page.goto(self.url("profile.html"))
        self.page.wait_for_selector("#profile-form input[name=name]")

    def test_requires_sign_in(self):
        self.page.goto(self.url("profile.html"))
        self.page.wait_for_url("**/login.html")

    def test_shows_current_name(self):
        self.open_profile()
        self.assertEqual(self.page.input_value("#profile-form input[name=name]"), "Alice Smith")

    def test_saving_a_new_name(self):
        self.open_profile()
        self.page.fill("#profile-form input[name=name]", "Alice Johnson")
        self.page.click("#profile-form button[type=submit]")
        self.wait_for_message()
        self.assertEqual(self.fb_state()["docs"]["users/alice"]["name"], "Alice Johnson")

    def test_empty_name_shows_an_error_and_does_not_save(self):
        self.open_profile()
        self.page.fill("#profile-form input[name=name]", "  ")
        self.page.click("#profile-form button[type=submit]")
        self.assertIn("name", self.wait_for_message().lower())
        self.assertEqual(self.fb_state()["docs"]["users/alice"]["name"], "Alice Smith")

    def test_email_and_role_cannot_be_edited(self):
        self.open_profile()
        for field in ["gsu_email", "email", "role"]:
            with self.subTest(field=field):
                editable = self.page.locator(f"#profile-form [name={field}]:not([disabled]):not([readonly])")
                self.assertEqual(editable.count(), 0)


@unittest.skipUnless((PUBLIC / "profile.html").exists(), "shared header not built yet")
class SharedHeader(BrowserTestCase):
    """The same header and links on every signed-in page (NFR-1.1)."""

    PAGES = ["index.html", "profile.html"]

    def header_links(self, page):
        self.seed_firebase(**SIGNED_IN)
        self.page.goto(self.url(page))
        self.page.wait_for_selector("header.topbar")
        return self.page.eval_on_selector_all(
            "header.topbar a", "links => links.map(a => [a.textContent.trim(), a.getAttribute('href')])")

    def test_same_header_links_on_every_page(self):
        expected = self.header_links(self.PAGES[0])
        self.assertTrue(expected, "header has no links")
        for page in self.PAGES[1:]:
            with self.subTest(page=page):
                self.assertEqual(self.header_links(page), expected)

    def test_header_fits_on_phone(self):
        self.page.set_viewport_size(PHONE)
        for page in self.PAGES:
            with self.subTest(page=page):
                self.header_links(page)
                width = self.page.evaluate("() => document.querySelector('header.topbar').scrollWidth")
                self.assertLessEqual(width, PHONE["width"])


if __name__ == "__main__":
    unittest.main()
