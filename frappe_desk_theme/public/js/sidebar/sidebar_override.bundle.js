// Workspace sidebar behaviour: single-click active state, Page link rewriting, and the opt-in
// collapsible groups.
//
// The two framework generations build this sidebar in different places, so we patch whichever one
// is present:
//
//   v16  `frappe.ui.Sidebar` owns the workspace sidebar and is reachable as `frappe.app.sidebar`.
//        Groups are `.body-sidebar .sidebar-item-container.section-item`, collapsing hides the
//        group's `.sidebar-child-item.nested-container`, and the chevron is `#icon-chevron-*`.
//
//   v15  `frappe.views.Workspace` owns it. Groups are `.desk-sidebar .standard-sidebar-section`,
//        collapsing hides the section's `.sidebar-item-container` children (there is no per-group
//        nested container), and the chevron lives in the `.standard-sidebar-label` title button as
//        `#es-line-down` / `#es-line-right-chevron`.
//
// Everything version-specific is isolated in DOM_V15 / DOM_V16 below; the behaviour is shared.

// Wrapped in an IIFE: Frappe loads each *.bundle.js as a separate classic script sharing one
// global lexical scope, so a top-level `const` here would collide with an identically-named one
// in frappe_desk_theme.bundle.js and abort this whole file with a SyntaxError.
(function () {
	const IS_V15 = !!(
		frappe.views &&
		frappe.views.Workspace &&
		frappe.views.Workspace.prototype.build_sidebar_section
	);

	const DOM_V16 = {
		// Group sections, and the container that survives a full sidebar rebuild.
		sections: ".body-sidebar .sidebar-item-container.section-item",
		observe_root: ".body-sidebar-container",
		sidebar_root: ".body-sidebar",
		// Nodes whose add/remove means the group structure changed.
		structural: ".body-sidebar, .sidebar-items, .sidebar-item-container.section-item",
		chevron_open: "#icon-chevron-down",
		chevron_closed: "#icon-chevron-right",
		// A group's collapsible body.
		body(section) {
			return section.querySelectorAll(":scope > .sidebar-child-item.nested-container");
		},
		chevron(section) {
			return section.querySelector(".sidebar-item-control .drop-icon");
		},
	};

	const DOM_V15 = {
		sections: ".desk-sidebar .standard-sidebar-section",
		observe_root: ".layout-side-section",
		sidebar_root: ".desk-sidebar",
		structural: ".desk-sidebar, .standard-sidebar-section, .sidebar-item-container",
		chevron_open: "#es-line-down",
		chevron_closed: "#es-line-right-chevron",
		// v15 has no per-group wrapper — a section's body is its direct item children.
		body(section) {
			return section.querySelectorAll(":scope > .sidebar-item-container");
		},
		chevron(section) {
			return section.querySelector(".standard-sidebar-label");
		},
	};

	const DOM = IS_V15 ? DOM_V15 : DOM_V16;

	// Shared behaviour, mixed into whichever base class this framework version uses.
	const DeskThemeSidebar = (Base) =>
		class extends Base {
			// ---- active item ----------------------------------------------------
			handle_sidebar_click(item_element, item_name, item_title) {
				$(".standard-sidebar-item").removeClass("active-sidebar");
				$(item_element).closest(".standard-sidebar-item").addClass("active-sidebar");
				this.active_item = $(item_element).closest(".standard-sidebar-item");
				localStorage.setItem("sidebar-active-item", item_name || item_title);
				this.collapse_inactive_sections();
			}

			// The sidebar root differs per version; `this.$sidebar` only exists on v16.
			get $desk_sidebar() {
				return this.$sidebar || this.sidebar || $(DOM.sidebar_root);
			}

			set_active_workspace_item() {
				const current_route = frappe.get_route();
				if (!current_route || !current_route.length) return;

				// Workspaces route as ["Workspaces", name]; doctype lists as ["List", "DocType", ...];
				// Page doctype as ["page-name"] or ["Page", "page-name"].
				const current_item = current_route[1] || current_route[0];

				const $sidebar = this.$desk_sidebar;
				if (!$sidebar || !$sidebar.find) return;

				const $match = $sidebar.find(
					`.sidebar-item-container[item-name="${current_item}"]`
				);
				if ($match.length) {
					$sidebar.find(".standard-sidebar-item").removeClass("active-sidebar");
					$match.find(".standard-sidebar-item").addClass("active-sidebar");
					this.active_item = $match;

					// If nested, expand the parent group.
					const $parent_container = $match.closest(".sidebar-child-item");
					if ($parent_container.length) {
						$parent_container.removeClass("hidden");
						const $toggle_btn = $parent_container
							.siblings(".sidebar-item-control")
							.find(".drop-icon");
						$toggle_btn.find("use").attr("href", DOM.chevron_open);
					}
				}
				this.collapse_inactive_sections();
			}

			// ---- theme additions applied to every rendered group ----------------
			// Rewrites Page links and installs the single-click handler. Called from
			// build_sidebar_section on both versions, after the base markup exists.
			apply_theme_section_behaviour(sidebar_section) {
				// Rewrite Page links from <base>/Page/page-name to <base>/page-name.
				// v15 routes under /app, v16 under /desk.
				sidebar_section.find(".item-anchor[href]").each(function () {
					const href = $(this).attr("href") || "";
					const match = href.match(/^\/(app|desk)\/(?:Page|page)\/([^/?#]+)/);
					if (match) {
						$(this).attr("href", "/" + match[1] + "/" + match[2]);
					}
				});

				// Single-click active state + breadcrumb update.
				$(".item-anchor")
					.off("click")
					.on("click", (e) => {
						const $target = $(e.currentTarget);
						const item_name = $target
							.closest(".sidebar-item-container")
							.attr("item-name");
						const item_title = $target.attr("title");

						// Delay to let the route update first.
						setTimeout(() => {
							this.set_active_workspace_item();
							this.handle_sidebar_click(e.currentTarget, item_name, item_title);
							frappe.breadcrumbs.update();

							if (!frappe.dom.is_element_in_viewport($target)) {
								$target[0].scrollIntoView({ behavior: "smooth", block: "center" });
							}
						}, 50);

						$(".list-sidebar.hidden-xs.hidden-sm").removeClass("opened");
						$("body").css("overflow", "auto");

						if (frappe.is_mobile() && typeof this.close_sidebar === "function") {
							this.close_sidebar();
						}
					});

				this.ensure_collapse_observer();
				this.ensure_collapse_route_hook();
				this.collapse_soon();
			}

			// ---- collapsible sidebar groups (opt-in) ----------------------------
			// Driven by `collapse_sidebar_groups` on the Desk Theme single doctype, published to the
			// client as `frappe.desk_theme_settings` by frappe_desk_theme.bundle.js (applyTheme).
			collapse_enabled() {
				try {
					return !!(
						frappe.desk_theme_settings &&
						frappe.desk_theme_settings.collapse_sidebar_groups
					);
				} catch (e) {
					return false;
				}
			}

			// The group holding the currently-open page. Found by scanning group sections for the one
			// that CONTAINS the active marker — robust against multiple sidebar trees on the page.
			// v15 marks the current item `.selected`; the theme marks clicks `.active-sidebar`.
			active_section_from_url() {
				const sections = document.querySelectorAll(DOM.sections);
				for (const sec of sections) {
					if (
						sec.querySelector(
							".standard-sidebar-item.active-sidebar, .standard-sidebar-item.selected"
						)
					)
						return sec;
				}
				// Fall back to the section holding a link matching the current URL's first segment.
				const slug = (
					window.location.pathname.replace(/^\/(app|desk)\/?/, "").split(/[/?#]/)[0] ||
					""
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

			set_section_state(section, open) {
				DOM.body(section).forEach((el) => el.classList.toggle("hidden", !open));
				const icon = DOM.chevron(section);
				if (!icon) return;
				icon.setAttribute("data-state", open ? "open" : "closed");
				if (icon.hasAttribute("aria-expanded")) {
					icon.setAttribute("aria-expanded", String(open));
				}
				const use = icon.querySelector("use");
				if (use) use.setAttribute("href", open ? DOM.chevron_open : DOM.chevron_closed);
			}

			// Collapse every group except the one holding the current page. No-op unless enabled.
			collapse_inactive_sections() {
				if (!this.collapse_enabled()) return;
				document.querySelectorAll(DOM.sections).forEach((sec) => {
					this.set_section_state(sec, false);
				});
				const active = this.active_section_from_url();
				if (!active) return;
				this.set_section_state(active, true);
			}

			// Re-apply on short delays after render/navigation — the theme's own active-section
			// expansion and staggered re-renders land just after.
			collapse_soon() {
				if (!this.collapse_enabled()) return;
				[0, 100, 300, 700].forEach((d) =>
					setTimeout(() => this.collapse_inactive_sections(), d)
				);
			}

			ensure_collapse_route_hook() {
				if (this.__collapseRouteHooked || !frappe.router || !frappe.router.on) return;
				this.__collapseRouteHooked = true;
				frappe.router.on("change", () => this.collapse_soon());
			}

			// Desk/list pages rebuild the sidebar after render, which would re-expand collapsed groups.
			// React to structural changes only (groups added/removed), so a user's manual toggle and
			// unrelated churn don't trigger it. Anchored to a container that outlives a full rebuild.
			ensure_collapse_observer() {
				if (this.__collapseObserver || typeof MutationObserver === "undefined") return;
				const body = document.querySelector(DOM.sidebar_root);
				const target =
					document.querySelector(DOM.observe_root) ||
					(body && body.parentElement) ||
					body;
				if (!target) return;
				const touches_groups = (node) =>
					node.nodeType === 1 &&
					(node.matches?.(DOM.structural) || node.querySelector?.(DOM.sections));
				let scheduled = false;
				this.__collapseObserver = new MutationObserver((muts) => {
					if (!this.collapse_enabled()) return;
					for (const m of muts) {
						if (
							[...m.addedNodes].some(touches_groups) ||
							[...m.removedNodes].some(touches_groups)
						) {
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

	if (IS_V15) {
		// v15: extend Workspace. Delegate the markup to the base implementation — it renders the
		// section title button and its toggle, which the v16 override reimplements and would otherwise
		// drop — then layer the theme behaviour on the section it just appended.
		frappe.views.Workspace = class DeskThemeWorkspace extends (
			DeskThemeSidebar(frappe.views.Workspace)
		) {
			build_sidebar_section(category, root_pages) {
				super.build_sidebar_section(category, root_pages);

				const title = typeof category === "string" ? category : category && category.id;
				const sidebar_section = this.sidebar
					.find(`.standard-sidebar-section[data-title="${title}"]`)
					.last();
				if (!sidebar_section.length) return;

				this.apply_theme_section_behaviour(sidebar_section);
			}
		};
	} else {
		// v16: `frappe.ui.Sidebar` builds the section itself.
		frappe.ui.Sidebar = class CustomSidebar extends DeskThemeSidebar(frappe.ui.Sidebar) {
			build_sidebar_section(title, root_pages) {
				let sidebar_section = $(
					`<div class="standard-sidebar-section nested-container" data-title="${title}"></div>`
				);

				this.prepare_sidebar(
					root_pages,
					sidebar_section,
					this.wrapper.find(".sidebar-items")
				);

				if (Object.keys(root_pages).length === 0) {
					sidebar_section.addClass("hidden");
				}

				this.apply_theme_section_behaviour(sidebar_section);

				if (
					sidebar_section.find(".sidebar-item-container").length &&
					sidebar_section.find("> [item-is-hidden='0']").length == 0
				) {
					sidebar_section.addClass("hidden show-in-edit-mode");
				}
			}
		};
	}
})();
