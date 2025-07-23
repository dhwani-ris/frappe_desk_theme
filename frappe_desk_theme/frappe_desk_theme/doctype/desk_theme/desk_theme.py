# Copyright (c) 2025, Dhwani RIS and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class DeskTheme(Document):
	def validate(self):
		# Validate that default_app is set when hide_app_switcher is checked
		if self.hide_app_switcher and not self.default_app:
			frappe.throw("Default App is required when App Switcher is hidden")

		# Carousel validation: if carousel selected, must have at least one image
		if self.page_background_type == "Carousel":
			if not self.carousel_images or not any(img.image for img in self.carousel_images):
				# Fallback: clear page_background_type
				self.page_background_type = ""
				frappe.msgprint("No carousel images found. Falling back to default background.")

	def on_update(self):
		# Update system settings with the selected default app
		if self.hide_app_switcher and self.default_app:
			update_system_default_app(self.default_app)
		
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
			frappe.log_error(f"Error updating website settings: {str(e)}")

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


@frappe.whitelist()
def update_system_default_app(default_app):
	"""Update the system default app setting"""
	try:
		# Check if the app exists in installed apps
		installed_apps = frappe.get_installed_apps()
		if default_app not in installed_apps:
			frappe.throw(f"App '{default_app}' is not installed")
		
		# Update system settings
		system_settings = frappe.get_single("System Settings")
		system_settings.default_app = default_app
		system_settings.save(ignore_permissions=True)
		
		return {"success": True}
	except Exception as e:
		frappe.log_error(f"Error updating system default app: {str(e)}")
		frappe.throw(f"Failed to update system default app: {str(e)}")
