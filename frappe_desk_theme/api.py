import frappe

@frappe.whitelist(allow_guest=True)
def get_custom_theme():
    return frappe.get_doc("Desk Theme")