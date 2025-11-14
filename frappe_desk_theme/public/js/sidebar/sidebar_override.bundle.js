frappe.ui.Sidebar = class CustomSidebar extends frappe.ui.Sidebar {
	// Improved method to handle sidebar item clicks
	handle_sidebar_click(item_element, item_name, item_title) {
		$(".standard-sidebar-item").removeClass("active-sidebar");
		$(item_element).closest(".standard-sidebar-item").addClass("active-sidebar");
		this.active_item = $(item_element).closest(".standard-sidebar-item");
		localStorage.setItem("sidebar-active-item", item_name || item_title);
	}
	set_active_workspace_item() {
		const current_route = frappe.get_route();
		if (!current_route || !current_route.length) return;

		const current_item = current_route[1];
		if (!current_item) return;

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
	}
	build_sidebar_section(title, root_pages) {
		let sidebar_section = $(
			`<div class="standard-sidebar-section nested-container" data-title="${title}"></div>`
		);

		this.prepare_sidebar(root_pages, sidebar_section, this.wrapper.find(".sidebar-items"));

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
	}
};
