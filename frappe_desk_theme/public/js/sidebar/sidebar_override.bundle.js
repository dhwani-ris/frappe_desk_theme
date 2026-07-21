frappe.ui.Sidebar = class CustomSidebar extends frappe.ui.Sidebar {
	// Improved method to handle sidebar item clicks
	handle_sidebar_click(item_element, item_name, item_title) {
		$(".standard-sidebar-item").removeClass("active-sidebar");
		$(item_element).closest(".standard-sidebar-item").addClass("active-sidebar");
		this.active_item = $(item_element).closest(".standard-sidebar-item");
		localStorage.setItem("sidebar-active-item", item_name || item_title);
		this.collapse_inactive_sections();
	}
	set_active_workspace_item() {
		const current_route = frappe.get_route();
		if (!current_route || !current_route.length) return;

		// For workspaces: route is ["Workspaces", workspace_name]. For doctype list: ["List", "DocType", ...].
		// For Page doctype: route is ["page-name"] (desk/page-name) or ["Page", "page-name"] (desk/Page/page-name).
		const current_item = current_route[1] || current_route[0];

		const $match = this.$sidebar.find(`.sidebar-item-container[item-name="${current_item}"]`);
		if ($match.length) {
			this.$sidebar.find(".standard-sidebar-item").removeClass("active-sidebar");
			$match.find(".standard-sidebar-item").addClass("active-sidebar");
			this.active_item = $match;

			// If nested, expand parent
			const $parent_container = $match.closest(".sidebar-child-item");
			if ($parent_container.length) {
				$parent_container.removeClass("hidden");
				const $toggle_btn = $parent_container
					.siblings(".sidebar-item-control")
					.find(".drop-icon");
				$toggle_btn.find("use").attr("href", "#icon-chevron-up");
			}
		}
		this.collapse_inactive_sections();
	}
	build_sidebar_section(title, root_pages) {
		let sidebar_section = $(
			`<div class="standard-sidebar-section nested-container" data-title="${title}"></div>`
		);

		this.prepare_sidebar(root_pages, sidebar_section, this.wrapper.find(".sidebar-items"));

		// Rewrite Page links from desk/Page/page-name or desk/page/page-name to desk/page-name
		sidebar_section.find(".item-anchor[href]").each(function () {
			const href = $(this).attr("href") || "";
			const match = href.match(/^\/desk\/(?:Page|page)\/([^/?#]+)/);
			if (match) {
				$(this).attr("href", "/desk/" + match[1]);
			}
		});

		if (Object.keys(root_pages).length === 0) {
			sidebar_section.addClass("hidden");
		}

		// Fixed single-click active + breadcrumb update
		$(".item-anchor")
			.off("click")
			.on("click", (e) => {
				const $target = $(e.currentTarget);
				const item_name = $target.closest(".sidebar-item-container").attr("item-name");
				const item_title = $target.attr("title");

				// Delay to let route update
				setTimeout(() => {
					this.set_active_workspace_item();
					this.handle_sidebar_click(e.currentTarget, item_name, item_title);
					frappe.breadcrumbs.update();

					// Scroll to item if needed
					if (!frappe.dom.is_element_in_viewport($target)) {
						$target[0].scrollIntoView({ behavior: "smooth", block: "center" });
					}
				}, 50);

				$(".list-sidebar.hidden-xs.hidden-sm").removeClass("opened");
				$("body").css("overflow", "auto");

				if (frappe.is_mobile()) {
					this.close_sidebar();
				}
			});

		if (
			sidebar_section.find(".sidebar-item-container").length &&
			sidebar_section.find("> [item-is-hidden='0']").length == 0
		) {
			sidebar_section.addClass("hidden show-in-edit-mode");
		}

		// Collapsible-groups behavior (opt-in via Desk Theme -> Collapse Sidebar Groups).
		this.ensure_collapse_observer();
		this.ensure_collapse_route_hook();
		this.collapse_soon();
	}

	// ---- Collapsible sidebar groups (opt-in) --------------------------------
	// Enabled by the `collapse_sidebar_groups` flag on the Desk Theme single doctype, published to the
	// client as `frappe.desk_theme_settings` by frappe_desk_theme.bundle.js (applyTheme).
	collapse_enabled() {
		try {
			return !!(frappe.desk_theme_settings && frappe.desk_theme_settings.collapse_sidebar_groups);
		} catch (e) {
			return false;
		}
	}

	// Which sidebar group holds the currently-open page. Resolved by iterating the group sections and
	// returning the one that CONTAINS the active item — robust against multiple `.body-sidebar` trees
	// on the page (walking up with `closest()` could land on a marker with no section-item ancestor).
	// Preference: the section containing the `.active-sidebar` marker; else the section containing a
	// link whose href matches the current URL slug.
	active_section_from_url() {
		const sections = document.querySelectorAll(
			".body-sidebar .sidebar-item-container.section-item"
		);
		// 1) section that contains the active-sidebar marker
		for (const sec of sections) {
			if (sec.querySelector(".standard-sidebar-item.active-sidebar")) return sec;
		}
		// 2) section that contains a link matching the current URL's first path segment
		const slug = (
			window.location.pathname.replace(/^\/(app|desk)\/?/, "").split(/[/?#]/)[0] || ""
		).toLowerCase();
		if (!slug) return null;
		for (const sec of sections) {
			for (const a of sec.querySelectorAll(".item-anchor[href]")) {
				const href = (a.getAttribute("href") || "")
					.replace(/^\/(app|desk)\/?/, "")
					.split(/[/?#]/)[0]
					.replace(/\/+$/, "")
					.toLowerCase();
				if (href && href === slug) return sec;
			}
		}
		return null;
	}

	// Collapse every group except the one holding the current page, so the active item stays visible.
	// No-op unless the flag is enabled.
	collapse_inactive_sections() {
		if (!this.collapse_enabled()) return;
		document
			.querySelectorAll(".body-sidebar .sidebar-item-container.section-item")
			.forEach((sec) => {
				const nested = sec.querySelector(".sidebar-child-item.nested-container");
				if (nested) nested.classList.add("hidden");
				const icon = sec.querySelector(".sidebar-item-control .drop-icon");
				if (icon) {
					icon.setAttribute("data-state", "closed");
					const use = icon.querySelector("use");
					if (use) use.setAttribute("href", "#icon-chevron-right");
				}
			});
		const active = this.active_section_from_url();
		if (!active) return;
		const nested = active.querySelector(".sidebar-child-item.nested-container");
		if (nested) nested.classList.remove("hidden");
		const icon = active.querySelector(".sidebar-item-control .drop-icon");
		if (icon) {
			icon.setAttribute("data-state", "open");
			const use = icon.querySelector("use");
			if (use) use.setAttribute("href", "#icon-chevron-down");
		}
	}

	// Re-apply on a few short delays after render/navigation (the theme's active-section expansion and
	// staggered re-renders happen just after).
	collapse_soon() {
		if (!this.collapse_enabled()) return;
		[0, 100, 300, 700].forEach((d) => setTimeout(() => this.collapse_inactive_sections(), d));
	}

	// Re-apply on every route change — the click/list navigation rebuilds the sidebar just after.
	ensure_collapse_route_hook() {
		if (this.__collapseRouteHooked || !frappe.router || !frappe.router.on) return;
		this.__collapseRouteHooked = true;
		frappe.router.on("change", () => this.collapse_soon());
	}

	// Desk/list pages rebuild the sidebar after render, which would re-collapse the active group.
	// Re-apply on structural re-renders (groups added/removed) — reacting to childList only, so a user's
	// manual section toggle and unrelated churn (notifications panel) don't trigger it. Anchored to the
	// persistent `.body-sidebar-container` so a full `.body-sidebar` rebuild doesn't detach the observer.
	ensure_collapse_observer() {
		if (this.__collapseObserver || typeof MutationObserver === "undefined") return;
		const body = document.querySelector(".body-sidebar");
		const target =
			document.querySelector(".body-sidebar-container") ||
			(body && body.parentElement) ||
			body;
		if (!target) return;
		const touches_groups = (node) =>
			node.nodeType === 1 &&
			(node.matches?.(
				".body-sidebar, .sidebar-items, .sidebar-item-container.section-item"
			) ||
				node.querySelector?.(".sidebar-item-container.section-item"));
		let scheduled = false;
		this.__collapseObserver = new MutationObserver((muts) => {
			if (!this.collapse_enabled()) return;
			for (const m of muts) {
				if ([...m.addedNodes].some(touches_groups) || [...m.removedNodes].some(touches_groups)) {
					if (scheduled) return;
					scheduled = true;
					requestAnimationFrame(() => {
						scheduled = false;
						this.collapse_inactive_sections();
					});
					return;
				}
			}
		});
		this.__collapseObserver.observe(target, { childList: true, subtree: true });
	}
};
