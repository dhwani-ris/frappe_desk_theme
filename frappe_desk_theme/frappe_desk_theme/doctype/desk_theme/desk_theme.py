# Copyright (c) 2025, Dhwani RIS and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class DeskTheme(Document):
	def validate(self):
		# Validate that default_app is set when hide_app_switcher is checked
		if self.hide_app_switcher and not self.default_app:
			frappe.throw("Default App is required when App Switcher is hidden")

	def on_update(self):
		# Update system settings with the selected default app
		if self.hide_app_switcher and self.default_app:
			update_system_default_app(self.default_app)


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
