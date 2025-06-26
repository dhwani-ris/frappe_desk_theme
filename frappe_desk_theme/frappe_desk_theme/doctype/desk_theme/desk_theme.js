// Copyright (c) 2025, Dhwani RIS and contributors
// For license information, please see license.txt

// frappe.ui.form.on("Desk Theme", {
// 	refresh(frm) {

// 	},
// });

frappe.ui.form.on("Desk Theme", {
	refresh(frm) {
		// Load app options for default_app field
		frappe.xcall("frappe.apps.get_apps").then((r) => {
			let apps = r?.map((r) => r.name) || [];
			frm.set_df_property("default_app", "options", ["", ...apps]);
		});

		// Load current system default app if hide_app_switcher is enabled
		if (frm.doc.hide_app_switcher) {
			frappe.call({
				method: "frappe.client.get_value",
				args: {
					doctype: "System Settings",
					fieldname: "default_app"
				},
				callback: function(r) {
					if (r.message && r.message.default_app) {
						frm.set_value("default_app", r.message.default_app);
					}
				}
			});
		}

        // Add refresh theme button       
        frm.add_custom_button(__('Refresh Theme'), function() {
            window.frappeDeskTheme?.clearCache();
            window.frappeDeskTheme?.refreshTheme();
            frappe.show_alert({message: __('Theme refreshed'), indicator: 'green'});
        });
	},

	hide_app_switcher(frm) {
		if (frm.doc.hide_app_switcher) {
			// Load current system default app when hide_app_switcher is checked
			frappe.call({
				method: "frappe.client.get_value",
				args: {
					doctype: "System Settings",
					fieldname: "default_app"
				},
				callback: function(r) {
					if (r.message && r.message.default_app) {
						frm.set_value("default_app", r.message.default_app);
					}
				}
			});
		} else {
			// Clear default_app when hide_app_switcher is unchecked
			frm.set_value("default_app", "");
		}
	},

	validate(frm) {
		// Validate that default_app is set when hide_app_switcher is checked
		if (frm.doc.hide_app_switcher && !frm.doc.default_app) {
			frappe.throw(__("Default App is required when App Switcher is hidden"));
		}
	},

	after_save(frm) {
		// Update system settings with the selected default app
		if (frm.doc.hide_app_switcher && frm.doc.default_app) {
			frappe.call({
				method: "frappe_desk_theme.frappe_desk_theme.doctype.desk_theme.desk_theme.update_system_default_app",
				args: {
					default_app: frm.doc.default_app
				},
				callback: function(r) {
					if (r.message && r.message.success) {
						frappe.show_alert({
							message: __("System default app updated successfully"),
							indicator: "green"
						});
					}
				}
			});
		}
	}
});
