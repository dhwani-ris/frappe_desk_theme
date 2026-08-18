# Copyright (c) 2025, Dhwani RIS and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt

SPLIT_LOGIN_POSITIONS = ("Split Right", "Split Left")
DEFAULT_SPLIT_PANEL_WIDTH = 20


class DeskTheme(Document):
	def validate(self):
		# Carousel validation: if carousel selected, must have at least one image
		if self.page_background_type == "Carousel":
			if not self.carousel_images or not any(img.image for img in self.carousel_images):
				# Fallback: clear page_background_type
				self.page_background_type = ""
				frappe.msgprint("No carousel images found. Falling back to default background.")

		self.validate_split_panel_width()

	def validate_split_panel_width(self):
		"""Split login panel width must leave room for both columns"""
		if self.login_box_position not in SPLIT_LOGIN_POSITIONS:
			return

		# flt() first: the field can still hold a string here, and comparing that
		# against an int would raise and make the whole DocType unsaveable
		width = flt(self.login_split_panel_width)
		if 0 < width < 100:
			self.login_split_panel_width = width
			return

		self.login_split_panel_width = DEFAULT_SPLIT_PANEL_WIDTH
		frappe.msgprint(
			_("Login Panel Width must be between 1 and 99. Falling back to {0}%.").format(
				DEFAULT_SPLIT_PANEL_WIDTH
			)
		)

	def on_update(self):
		# Update website settings with footer information
		self.update_website_settings()

	def update_website_settings(self):
		"""Update Website Settings with copyright and powered by text from Desk Theme"""
		try:
			website_settings = frappe.get_single("Website Settings")

			# Update copyright text if provided
			if self.copyright_text:
				website_settings.copyright = self.copyright_text

			# Update footer powered by text if provided
			if self.footer_powered_by:
				website_settings.footer_powered = self.footer_powered_by

			# Save without triggering permissions check
			website_settings.save(ignore_permissions=True)

		except Exception as e:
			frappe.log_error(f"Error updating website settings: {e!s}")

	def get_carousel_data(self):
		"""Return carousel images and config for API"""
		if self.page_background_type != "Carousel":
			return None
		images = [img.image for img in self.carousel_images if img.image]
		return {
			"images": images,
			"manual_navigation": getattr(self, "allow_manual_navigation", True),
			"auto_advance": getattr(self, "carousel_auto_advance", True),
		}
