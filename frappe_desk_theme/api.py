import frappe
from frappe import _

@frappe.whitelist(allow_guest=True)
def get_custom_theme():
    return frappe.get_doc("Desk Theme")

@frappe.whitelist(allow_guest=True)
def get_footer_html():
    """Get rendered footer HTML template with theme data"""
    try:
        theme = frappe.get_doc("Desk Theme")
        
        # Prepare context for template
        context = {
            'copyright_text': theme.copyright_text,
            'footer_powered_by': theme.footer_powered_by,
            'sticky_footer': theme.sticky_footer
        }
        
        # Render the template
        return frappe.render_template("frappe_desk_theme/templates/includes/desk_footer.html", context)
    except Exception as e:
        frappe.log_error(f"Error rendering footer template: {str(e)}")
        return ""