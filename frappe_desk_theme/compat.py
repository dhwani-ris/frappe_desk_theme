"""Cross-version schema fixes applied at install and migrate time.

The Desk Theme doctype is shared by both framework generations, but one of its fields points at a
doctype that only exists on v16. Rather than fork the schema, the offending field is reshaped with
Property Setters on sites where its target is missing, and restored when it is present.
"""

import frappe
from frappe.custom.doctype.property_setter.property_setter import make_property_setter

# `fixed_sidebar` is a Link to `Workspace Sidebar`, which ships with Frappe v16 only. On v15 the
# missing target makes `frappe.desk.form.meta.get_meta` raise "Field fixed_sidebar is referring to
# non-existing doctype Workspace Sidebar" while assembling search fields — which takes down the
# whole Desk Theme form, not just this one control. Downgrading it to a plain Data field keeps the
# form usable; the Fixed Sidebar feature itself is already a documented no-op on v15.
V16_ONLY_LINKS = (
	{
		"doctype": "Desk Theme",
		"fieldname": "fixed_sidebar",
		"target": "Workspace Sidebar",
	},
)


def apply_version_compatibility():
	"""Reshape (or restore) fields whose Link target is absent on this Frappe version."""
	for link in V16_ONLY_LINKS:
		doctype, fieldname, target = link["doctype"], link["fieldname"], link["target"]

		if not frappe.db.exists("DocType", doctype):
			continue

		# The field itself was dropped from the schema on this branch, so there is nothing to
		# reshape. Kept guarded rather than deleted so the protection is already in place if
		# `fixed_sidebar` is ever reintroduced (e.g. by a merge from development).
		if not frappe.get_meta(doctype).get_field(fieldname):
			continue

		if frappe.db.exists("DocType", target):
			_restore_link(doctype, fieldname, target)
		else:
			_downgrade_link(doctype, fieldname, target)

		frappe.clear_cache(doctype=doctype)


def _downgrade_link(doctype, fieldname, target):
	make_property_setter(
		doctype, fieldname, "fieldtype", "Data", "Data", validate_fields_for_doctype=False
	)
	make_property_setter(
		doctype, fieldname, "options", "", "Text", validate_fields_for_doctype=False
	)
	frappe.msgprint(
		frappe._(
			"{0}.{1} was changed to a Data field because DocType {2} is not available on this "
			"Frappe version."
		).format(doctype, fieldname, target),
		alert=True,
	)


def _restore_link(doctype, fieldname, target):
	"""Drop a downgrade left behind by an earlier v15 install (e.g. after upgrading to v16)."""
	for prop in ("fieldtype", "options"):
		name = frappe.db.get_value(
			"Property Setter",
			{"doc_type": doctype, "field_name": fieldname, "property": prop},
		)
		if name:
			frappe.delete_doc("Property Setter", name, ignore_permissions=True)
