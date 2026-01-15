function patch_breadcrumbs_update() {
	if (!frappe.breadcrumbs || !frappe.breadcrumbs.update) {
		setTimeout(patch_breadcrumbs_update, 100);
		return;
	}

	const original_update = frappe.breadcrumbs.update;

	frappe.breadcrumbs.update = function () {
		const page = frappe.breadcrumbs.current_page();
		const breadcrumbs = this.all[page];

		if (!breadcrumbs) {
			return original_update.call(this);
		}

		this.clear();

		if (breadcrumbs.type === "Custom") {
			this.set_custom_breadcrumbs(breadcrumbs);
		} else {
			let view = frappe.get_route()[0];
			view = view ? view.toLowerCase() : null;

			if (breadcrumbs.doctype || view === "list") {
				const route = frappe.get_route();
				const last = frappe.route_history.slice(-2)[0];
				const from_workspace = last && last[0] === "Workspaces";

				this.clear();

				if (route[0] === "Form") {
					if (from_workspace) {
						this.append_breadcrumb_element(
							`/app/${frappe.router.slug(last[1])}`,
							__(last[1])
						);
					}
					this.append_breadcrumb_element(
						`/app/${frappe.router.slug(breadcrumbs.doctype)}`,
						__(breadcrumbs.doctype)
					);
					const name = route[2];
					this.append_breadcrumb_element(
						`/app/${frappe.router.slug(breadcrumbs.doctype)}/${encodeURIComponent(
							name
						)}`,
						__(name)
					);
					return this.toggle(true);
				} else if (route[0] === "List") {
					if (from_workspace) {
						this.append_breadcrumb_element(
							`/app/${frappe.router.slug(last[1])}`,
							__(last[1])
						);
					}
					this.append_breadcrumb_element(
						`/app/${frappe.router.slug(breadcrumbs.doctype)}`,
						__(breadcrumbs.doctype)
					);
					return this.toggle(true);
				}
			}

			this.set_workspace_breadcrumb(breadcrumbs);

			if (breadcrumbs.doctype && ["print", "form"].includes(view)) {
				this.set_list_breadcrumb(breadcrumbs);
				this.set_form_breadcrumb(breadcrumbs, view);
			} else if (breadcrumbs.doctype && view == "dashboard-view") {
				this.set_list_breadcrumb(breadcrumbs);
			}
		}

		if (
			breadcrumbs.workspace &&
			frappe.workspace_map[breadcrumbs.workspace]?.app &&
			frappe.workspace_map[breadcrumbs.workspace]?.app != frappe.current_app
		) {
			let app = frappe.workspace_map[breadcrumbs.workspace].app;
			frappe.app.sidebar.apps_switcher.set_current_app(app);
		}
		this.toggle(true);
	};
}

patch_breadcrumbs_update();
