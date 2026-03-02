// Copyright (c) 2025, Dhwani RIS and contributors
// For license information, please see license.txt

// frappe.ui.form.on("Desk Theme", {
// 	refresh(frm) {

// 	},
// });

frappe.ui.form.on("Desk Theme", {
	refresh(frm) {
		// Add refresh theme button
		frm.add_custom_button(__("Refresh Theme"), function () {
			window.frappeDeskTheme?.clearCache();
			window.frappeDeskTheme?.refreshTheme();
			frappe.show_alert({ message: __("Theme refreshed"), indicator: "green" });
		});
	},
});
