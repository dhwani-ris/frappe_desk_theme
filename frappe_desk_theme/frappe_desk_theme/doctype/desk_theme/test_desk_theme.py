# Copyright (c) 2025, Dhwani RIS and Contributors
# See license.txt

import importlib.util
import os
import unittest

import frappe
from frappe.auth import CookieManager, LoginManager
from frappe.tests import IntegrationTestCase
from playwright.sync.api import sync_playwright


def _playwright_available() -> bool:
    return importlib.util.find_spec("playwright") is not None


class TestDeskTheme(unittest.TestCase):
    """Schema + data-layer tests for the Desk Theme hide_search /
    hide_notification fields.

    Uses plain unittest.TestCase (not IntegrationTestCase) because these
    tests don't insert any Desk Theme rows — they only read meta and
    round-trip the existing singleton. Avoiding IntegrationTestCase skips
    Frappe's transitive fixture loader (Email Account → ToDo → …) which
    can fail on downstream sites that customise those doctypes."""

    def test_doctype_exposes_hide_notification_and_hide_search_fields(self):
        """Field schema is the contract the bundle JS reads against — the
        bug history was: schema field exists, JS never consumed it. This
        test fails fast if a future refactor removes either field, so the
        client-side toggle code wouldn't silently regress."""
        meta = frappe.get_meta("Desk Theme")
        hide_notification = meta.get_field("hide_notification")
        hide_search = meta.get_field("hide_search")

        self.assertIsNotNone(hide_notification, "hide_notification field removed")
        self.assertEqual(hide_notification.fieldtype, "Check")

        self.assertIsNotNone(hide_search, "hide_search field removed")
        self.assertEqual(hide_search.fieldtype, "Table MultiSelect")
        self.assertEqual(hide_search.options, "Has Role")

    def test_api_round_trips_both_fields(self):
        """The bundle JS reads both fields from get_custom_theme via /api/method.
        Round-tripping through frappe.get_doc proves the data layer carries
        both values to the client; if either disappears here, the JS reads
        undefined and silently no-ops."""
        theme = frappe.get_single("Desk Theme")
        prev_notif = theme.hide_notification
        prev_roles = [row.role for row in (theme.hide_search or [])]

        try:
            theme.hide_notification = 1
            theme.set("hide_search", [])
            theme.append("hide_search", {"role": "Administrator"})
            theme.save(ignore_permissions=True)
            frappe.db.commit()  # nosemgrep

            reloaded = frappe.get_single("Desk Theme")
            self.assertEqual(reloaded.hide_notification, 1)
            self.assertEqual(
                [row.role for row in reloaded.hide_search],
                ["Administrator"],
            )
        finally:
            theme = frappe.get_single("Desk Theme")
            theme.hide_notification = prev_notif
            theme.set("hide_search", [])
            for role in prev_roles:
                theme.append("hide_search", {"role": role})
            theme.save(ignore_permissions=True)
            frappe.db.commit()  # nosemgrep


@unittest.skipUnless(_playwright_available(), "playwright not installed")
@unittest.skipUnless(
    os.environ.get("DESK_THEME_E2E_SITE"), "DESK_THEME_E2E_SITE not set"
)
class E2EDeskThemeToggle(IntegrationTestCase):
    """End-to-end browser test that exercises the JS bundle directly.

    Set DESK_THEME_E2E_SITE=http://bsebeamv16.localhost:8003 (a running bench
    with the user `Administrator`) before invoking. Skipped otherwise so
    standard CI runs aren't blocked on the bench dev server.

    Browser launch lives in setUp / tearDown (per-instance) rather than
    setUpClass / tearDownClass so the test file conforms to the project's
    snake_case naming policy. The extra ~2s per test is negligible given
    these tests only run in opt-in E2E mode.
    """

    def setUp(self):
        super().setUp()
        self._pw = sync_playwright().start()
        self.browser = self._pw.chromium.launch(headless=True)
        self.base = os.environ["DESK_THEME_E2E_SITE"].rstrip("/")
        self._original_notif = frappe.db.get_single_value(
            "Desk Theme", "hide_notification"
        )

    def tearDown(self):
        try:
            theme = frappe.get_single("Desk Theme")
            theme.hide_notification = self._original_notif
            theme.set("hide_search", [])
            theme.save(ignore_permissions=True)
            frappe.db.commit()  # nosemgrep
        finally:
            self.browser.close()
            self._pw.stop()
            super().tearDown()

    def _login_url(self) -> str:
        """Mint a single-use SID for Administrator on the live site."""
        frappe.local.cookie_manager = CookieManager()
        frappe.local.login_manager = LoginManager()
        frappe.local.login_manager.login_as("Administrator")
        sid = frappe.session.sid
        return f"{self.base}/app?sid={sid}"

    def _open(self):
        ctx = self.browser.new_context(viewport={"width": 1440, "height": 900})
        page = ctx.new_page()
        page.goto(self._login_url(), wait_until="networkidle", timeout=60000)
        page.goto(self.base + "/app/dashboard", wait_until="networkidle", timeout=60000)
        # Wait for sidebar to render (polling — wait_for_selector is flaky on first paint)
        for _ in range(60):
            if (
                page.evaluate(
                    "document.querySelectorAll('.body-sidebar .sidebar-item-container').length"
                )
                > 5
            ):
                break
            page.wait_for_timeout(250)
        return ctx, page

    def _set_theme(self, hide_notification: bool, hide_for_roles: list[str]):
        theme = frappe.get_single("Desk Theme")
        theme.hide_notification = 1 if hide_notification else 0
        theme.set("hide_search", [])
        for role in hide_for_roles:
            theme.append("hide_search", {"role": role})
        theme.save(ignore_permissions=True)
        frappe.db.commit()  # nosemgrep

    def _is_hidden(self, page, selector: str) -> bool:
        return page.evaluate(f"""() => {{
				const el = document.querySelector('{selector}');
				if (!el) return null;
				const s = getComputedStyle(el);
				return s.display === 'none' || el.offsetHeight === 0;
			}}""")

    def test_hide_notification_flag_actually_hides_sidebar_bell(self):
        # Off → bell visible
        self._set_theme(hide_notification=False, hide_for_roles=[])
        ctx, page = self._open()
        self.assertFalse(self._is_hidden(page, ".body-sidebar .sidebar-notification"))
        ctx.close()

        # On → bell hidden
        self._set_theme(hide_notification=True, hide_for_roles=[])
        ctx, page = self._open()
        self.assertTrue(self._is_hidden(page, ".body-sidebar .sidebar-notification"))
        ctx.close()

    def test_hide_search_for_role_actually_hides_sidebar_search(self):
        # Administrator not in list → search visible
        self._set_theme(hide_notification=False, hide_for_roles=[])
        ctx, page = self._open()
        self.assertFalse(self._is_hidden(page, ".body-sidebar .navbar-search-bar"))
        ctx.close()

        # Administrator in list → search hidden
        self._set_theme(hide_notification=False, hide_for_roles=["Administrator"])
        ctx, page = self._open()
        self.assertTrue(self._is_hidden(page, ".body-sidebar .navbar-search-bar"))
        ctx.close()
