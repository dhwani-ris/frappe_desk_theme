# Copyright (c) 2025, Dhwani RIS and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class DeskTheme(Document):
	def validate(self):
		# Carousel validation: if carousel selected, must have at least one image
		if self.page_background_type == "Carousel":
			if not self.carousel_images or not any(img.image for img in self.carousel_images):
				# Fallback: clear page_background_type
				self.page_background_type = ""
				frappe.msgprint("No carousel images found. Falling back to default background.")

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
