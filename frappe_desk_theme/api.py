import frappe
from frappe import _


@frappe.whitelist(allow_guest=True)
def get_custom_theme():
	theme = frappe.get_doc("Desk Theme")
	data = theme.as_dict()
	# Add carousel data if present
	carousel_data = theme.get_carousel_data() if hasattr(theme, "get_carousel_data") else None
	if carousel_data:
		data["carousel"] = carousel_data
	return data


@frappe.whitelist(allow_guest=True)
def get_footer_html():
	"""Get rendered footer HTML template with theme data"""
	try:
		theme = frappe.get_doc("Desk Theme")

		# Prepare context for template
		context = {
			"copyright_text": theme.copyright_text,
			"footer_powered_by": theme.footer_powered_by,
			"sticky_footer": theme.sticky_footer,
		}

		# Render the template
		return frappe.render_template("frappe_desk_theme/templates/includes/desk_footer.html", context)
	except Exception as e:
		frappe.log_error(f"Error rendering footer template: {e!s}")
		return ""


def boot_session(bootinfo):
	"""Desk Theme's last-modified time, so the browser copy of the theme is refreshed
	as soon as the theme is saved (see isCacheValid in frappe_desk_theme.bundle.js)."""
	modified = frappe.db.get_value("Desk Theme", "Desk Theme", "modified")
	bootinfo.desk_theme_modified = str(modified) if modified else None
