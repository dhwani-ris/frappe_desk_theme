/**
 * FrappeDeskTheme - Main theme management class
 * Handles loading, applying, and managing custom theme configurations for Frappe Desk
 * Supports dynamic theme changes, user role-based hiding, and real-time DOM updates
 */
class FrappeDeskTheme {
    constructor() {
        // Store theme configuration data from server
        this.themeData = null;
        // Cache configuration
        this.cacheKey = 'frappe_desk_theme_cache';
        this.cacheTimeout = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        this.init();
    }

    /**
     * Initialize the theme system
     * First applies cached theme immediately, then loads fresh data if needed
     * Uses async/await pattern with graceful error handling
     */
    async init() {
        try {
            // Apply cached theme immediately to prevent flickering
            this.applyCachedTheme();
            
            // Load fresh theme data if needed (async)
            await this.loadThemeIfNeeded();
            
            // Apply fresh theme if we got new data
            if (this.themeData) {
                this.applyTheme();
            }
            
            this.setupEventListeners();
        } catch (error) {
            // Silent fail in production - apply default theme and show login box
            this.applyTheme();
            this.showLoginBoxFallback();
        }
    }

    /**
     * Fallback method to show login box if theme loading fails
     * Ensures login form is always visible even if theme fails to load
     */
    showLoginBoxFallback() {
        const loginBox = document.querySelector('.for-login');
        if (loginBox && !loginBox.classList.contains('theme-ready')) {
            setTimeout(() => {
                loginBox.classList.add('theme-ready');
            }, 100);
        }
    }

    /**
     * Apply cached theme immediately to prevent UI flickering
     */
    applyCachedTheme() {
        const cachedData = this.getCachedTheme();
        if (cachedData && cachedData.data) {
            this.themeData = cachedData.data;
            this.applyTheme();
        } else {
            // No cached theme, but still show login box to prevent indefinite hiding
            this.showLoginBoxFallback();
        }
    }

    /**
     * Get cached theme data from localStorage
     * @returns {Object|null} Cached theme data with timestamp
     */
    getCachedTheme() {
        try {
            const cached = localStorage.getItem(this.cacheKey);
            return cached ? JSON.parse(cached) : null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Save theme data to localStorage with timestamp
     * @param {Object} themeData Theme configuration data
     */
    setCachedTheme(themeData) {
        try {
            const cacheData = {
                data: themeData,
                timestamp: Date.now(),
                version: 1 // Increment this when theme structure changes
            };
            localStorage.setItem(this.cacheKey, JSON.stringify(cacheData));
        } catch (error) {
            // localStorage might be full or disabled
        }
    }

    /**
     * Check if cached theme is still valid
     * @returns {boolean} True if cache is valid and not expired
     */
    isCacheValid() {
        const cachedData = this.getCachedTheme();
        if (!cachedData) return false;

        const now = Date.now();
        const cacheAge = now - cachedData.timestamp;
        
        return cacheAge < this.cacheTimeout;
    }

    /**
     * Load theme only if cache is invalid or doesn't exist
     */
    async loadThemeIfNeeded() {
        // Skip API call if cache is still valid
        if (this.isCacheValid()) {
            return;
        }

        await this.loadTheme();
    }

    /**
     * Load theme configuration from server API
     * Fetches custom theme data via REST API endpoint
     * Handles response parsing and error states
     */
    async loadTheme() {
        try {
            const response = await fetch('/api/method/frappe_desk_theme.api.get_custom_theme', {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            const data = await response.json();
            // Handle different response formats - some APIs wrap data in 'message' property
            this.themeData = data?.message || data;
            
            if (!this.themeData) {
                throw new Error('No theme data received');
            }

            // Cache the new theme data
            this.setCachedTheme(this.themeData);
            
        } catch (error) {
            // If API fails, try to use cached data as fallback
            const cachedData = this.getCachedTheme();
            if (cachedData && cachedData.data) {
                this.themeData = cachedData.data;
            } else {
                throw error;
            }
        }
    }

    /**
     * Force refresh theme from server (ignores cache)
     * Useful for manual theme updates or admin changes
     */
    async refreshTheme() {
        try {
            await this.loadTheme();
            this.applyTheme();
            
            // Dispatch event for other components
            document.dispatchEvent(new CustomEvent('themeRefreshed', {
                detail: { themeData: this.themeData }
            }));
        } catch (error) {
            console.error('Failed to refresh theme:', error);
        }
    }

    /**
     * Clear theme cache (useful for debugging or forced refresh)
     */
    clearCache() {
        try {
            localStorage.removeItem(this.cacheKey);
        } catch (error) {
            // Ignore localStorage errors
        }
    }

    /**
     * Check if current user's roles match hide_search configuration
     * Used to conditionally hide search bar based on user permissions
     * @returns {boolean} True if search should be hidden for current user
     */
    getUserRoles() {
        const currentUser = frappe?.boot?.user?.roles;
        // Exit early if no user roles or no hide_search config
        if (!currentUser || !this.themeData?.hide_search) {
            return false;
        }

        // Special handling for Administrator role
        if (currentUser.includes('Administrator')) {
            return this.themeData.hide_search.some(u => u.role === 'Administrator');
        }

        // Check if any user role matches hide_search configuration
        return currentUser.some(role => 
            this.themeData.hide_search.some(u => u.role === role)
        );
    }

    /**
     * Clear all theme-related CSS custom properties from document root
     * Used to reset theme state before applying new theme values
     * Ensures clean slate for theme updates
     */
    clearCSSVariables() {
        const root = document.documentElement;
        // Comprehensive list of all theme CSS variables
        const cssVariables = [
            '--login-bg-color', '--login-bg-image', '--login-box-position', '--login-box-right', '--login-box-left',
            '--login-btn-bg', '--login-btn-color', '--login-btn-hover-bg', '--login-btn-hover-color',
            '--login-box-bg', '--page-heading-color', '--input-bg', '--input-color', '--input-border',
            '--input-label-color', '--navbar-bg', '--navbar-color', '--hide-help', '--btn-primary-bg',
            '--btn-primary-color', '--btn-primary-hover-bg', '--btn-primary-hover-color', '--btn-secondary-bg',
            '--btn-secondary-color', '--btn-secondary-hover-bg', '--btn-secondary-hover-color', '--body-bg',
            '--content-bg', '--table-head-bg', '--table-head-color', '--table-body-bg', '--table-body-color',
            '--hide-like-comment', '--widget-bg', '--widget-border', '--widget-color', '--sidebar-expanded',
            '--login-content-border', '--login-title-display', '--login-title-after-display', 
            '--login-title-after-justify', '--login-title-after-margin', '--login-title-after-content', '--login-title-after-color',
            '--login-box-top', '--login-box-bg-override', '--login-box-border-radius', '--search-bar-display',
            '--navbar-toggler-border', '--breadcrumb-disabled-color', '--help-nav-link-color', '--help-nav-link-stroke',
            '--hide-app-switcher', '--app-switcher-pointer-events'
        ];

        // Remove each CSS variable from document root
        cssVariables.forEach(variable => {
            root.style.removeProperty(variable);
        });
    }

    /**
     * Set default CSS variable values
     * Provides fallback values when theme configuration is missing or incomplete
     * Ensures UI remains functional even without complete theme data
     */
    setDefaultCSSVariables() {
        const root = document.documentElement;
        
        // Login page defaults - ensures login form remains usable
        root.style.setProperty('--login-box-position', 'static');
        root.style.setProperty('--login-box-right', 'auto');
        root.style.setProperty('--login-box-left', 'auto');
        root.style.setProperty('--login-box-top', '18%');
        root.style.setProperty('--login-box-bg', '#fff');
        root.style.setProperty('--login-content-border', '2px solid #d1d8dd');
        root.style.setProperty('--login-title-display', 'block');
        root.style.setProperty('--login-title-after-display', 'none');
        
        // UI element visibility defaults
        root.style.setProperty('--hide-help', 'block');
        root.style.setProperty('--hide-like-comment', 'block');
        root.style.setProperty('--hide-app-switcher', 'block');
        root.style.setProperty('--app-switcher-pointer-events', 'auto');
        root.style.setProperty('--sidebar-expanded', '');
        root.style.setProperty('--login-box-width', '400px');
        root.style.setProperty('--search-bar-display', 'block');
        
        // Navigation and UI component defaults
        root.style.setProperty('--navbar-toggler-border', '#dee2e6');
        root.style.setProperty('--breadcrumb-disabled-color', '#6c757d');
        root.style.setProperty('--help-nav-link-color', 'inherit');
        root.style.setProperty('--help-nav-link-stroke', 'currentColor');
    }

    /**
     * Apply theme configuration to CSS custom properties
     * Maps theme data fields to corresponding CSS variables
     * Only sets variables when theme values are provided (conditional application)
     */
    setCSSVariables() {
        const root = document.documentElement;
        const theme = this.themeData;

        // Reset all variables to clean state
        this.clearCSSVariables();

        // Establish default values first
        this.setDefaultCSSVariables();

        // Login page background customization
        if (theme.login_page_background_color) {
            root.style.setProperty('--login-bg-color', theme.login_page_background_color);
        }
        if (theme.login_page_background_image) {
            root.style.setProperty('--login-bg-image', `url("${theme.login_page_background_image}")`);
        }
        
        // Login box positioning - supports Left, Right, or Default positioning
        if (theme.login_box_position && theme.login_box_position !== 'Default') {
            root.style.setProperty('--login-box-position', 'absolute');
            root.style.setProperty('--login-box-right', theme.login_box_position === 'Right' ? '10%' : 'auto');
            root.style.setProperty('--login-box-left', theme.login_box_position === 'Left' ? '10%' : 'auto');
            root.style.setProperty('--login-box-padding', theme.is_app_details_inside_the_box === 1 ? '18px 40px 40px 40px' : '40px');
        }

        // Login box vertical positioning and app details integration
        if (theme.is_app_details_inside_the_box !== undefined) {
            root.style.setProperty('--login-box-top', theme.is_app_details_inside_the_box === 1 ? '26%' : '18%');
        }
        
        // Special styling when app details are inside the login box
        if (theme.is_app_details_inside_the_box === 1) {
            root.style.setProperty('--login-box-bg-override', theme.login_box_background_color);
            root.style.setProperty('--login-box-border-radius', '10px');
        }
        
        // Login button styling
        if (theme.login_button_background_color) {
            root.style.setProperty('--login-btn-bg', theme.login_button_background_color);
        }
        if (theme.login_button_text_color) {
            root.style.setProperty('--login-btn-color', theme.login_button_text_color);
        }
        if (theme.login_page_button_hover_background_color) {
            root.style.setProperty('--login-btn-hover-bg', theme.login_page_button_hover_background_color);
        }
        if (theme.login_page_button_hover_text_color) {
            root.style.setProperty('--login-btn-hover-color', theme.login_page_button_hover_text_color);
        }
        if (theme.login_box_background_color) {
            root.style.setProperty('--login-box-bg', theme.login_box_background_color);
        }
        if (theme.page_heading_text_color) {
            root.style.setProperty('--page-heading-color', theme.page_heading_text_color);
        }

        // Login content border - removed when app details are inside box
        if (theme.is_app_details_inside_the_box === 1) {
            root.style.setProperty('--login-content-border', 'none');
        }

        // Custom login page title - replaces default Frappe title
        if (theme.login_page_title) {
            root.style.setProperty('--login-title-display', 'none');
            root.style.setProperty('--login-title-after-display', 'flex');
            root.style.setProperty('--login-title-after-justify', 'center');
            root.style.setProperty('--login-title-after-margin', '10px');
            root.style.setProperty('--login-title-after-content', `'${theme.login_page_title}'`);
            if (theme.page_heading_text_color) {
                root.style.setProperty('--login-title-after-color', theme.page_heading_text_color);
            }
        }

        // Form input field customization
        if (theme.input_background_color) {
            root.style.setProperty('--input-bg', theme.input_background_color);
        }
        if (theme.input_text_color) {
            root.style.setProperty('--input-color', theme.input_text_color);
        }
        if (theme.input_border_color) {
            root.style.setProperty('--input-border', theme.input_border_color);
        }
        if (theme.input_label_color) {
            root.style.setProperty('--input-label-color', theme.input_label_color);
        }

        // Navigation bar customization
        if (theme.navbar_color) {
            root.style.setProperty('--navbar-bg', theme.navbar_color);
        }
        if (theme.navbar_text_color) {
            root.style.setProperty('--navbar-color', theme.navbar_text_color);
        }
        if (theme.hide_help_button !== undefined) {
            root.style.setProperty('--hide-help', theme.hide_help_button ? 'none' : 'block');
        }
        if (theme.hide_app_switcher !== undefined) {
            root.style.setProperty('--hide-app-switcher', theme.hide_app_switcher ? 'none' : 'block');
            root.style.setProperty('--app-switcher-pointer-events', theme.hide_app_switcher ? 'none' : 'auto');
        }

        // Primary button styling
        if (theme.button_background_color) {
            root.style.setProperty('--btn-primary-bg', theme.button_background_color);
        }
        if (theme.button_text_color) {
            root.style.setProperty('--btn-primary-color', theme.button_text_color);
        }
        if (theme.button_hover_background_color) {
            root.style.setProperty('--btn-primary-hover-bg', theme.button_hover_background_color);
        }
        if (theme.button_hover_text_color) {
            root.style.setProperty('--btn-primary-hover-color', theme.button_hover_text_color);
        }
        
        // Secondary button styling
        if (theme.secondary_button_background_color) {
            root.style.setProperty('--btn-secondary-bg', theme.secondary_button_background_color);
        }
        if (theme.secondary_button_text_color) {
            root.style.setProperty('--btn-secondary-color', theme.secondary_button_text_color);
        }
        if (theme.secondary_button_hover_background_color) {
            root.style.setProperty('--btn-secondary-hover-bg', theme.secondary_button_hover_background_color);
        }
        if (theme.secondary_button_hover_text_color) {
            root.style.setProperty('--btn-secondary-hover-color', theme.secondary_button_hover_text_color);
        }

        // Main body and content area styling
        if (theme.body_background_color) {
            root.style.setProperty('--body-bg', theme.body_background_color);
        }
        if (theme.main_body_content_box_background_color) {
            root.style.setProperty('--content-bg', theme.main_body_content_box_background_color);
        }
        if (theme.main_body_content_box_text_color) {
            root.style.setProperty('--content-text-color', theme.main_body_content_box_text_color);
        }
        
        // Sidebar customization
        if (theme.sidebar_background_color) {
            root.style.setProperty('--sidebar-bg', theme.sidebar_background_color);
        }
        if (theme.sidebar_text_color) {
            root.style.setProperty('--sidebar-text-color', theme.sidebar_text_color);
        }

        // Data table styling
        if (theme.table_head_background_color) {
            root.style.setProperty('--table-head-bg', theme.table_head_background_color);
        }
        if (theme.table_head_text_color) {
            root.style.setProperty('--table-head-color', theme.table_head_text_color);
        }
        if (theme.table_body_background_color) {
            root.style.setProperty('--table-body-bg', theme.table_body_background_color);
        }
        if (theme.table_body_text_color) {
            root.style.setProperty('--table-body-color', theme.table_body_text_color);
        }
        if (theme.table_hide_like_comment_section !== undefined) {
            root.style.setProperty('--hide-like-comment', theme.table_hide_like_comment_section ? 'none' : 'block');
        }

        // Widget/card styling (number cards, dashboard widgets)
        if (theme.number_card_background_color) {
            root.style.setProperty('--widget-bg', theme.number_card_background_color);
        }
        if (theme.number_card_border_color) {
            root.style.setProperty('--widget-border', theme.number_card_border_color);
        }
        if (theme.number_card_text_color) {
            root.style.setProperty('--widget-color', theme.number_card_text_color);
        }

        // Sidebar visibility control
        if (theme.hide_side_bar !== undefined) {
            root.style.setProperty('--sidebar-expanded', theme.hide_side_bar === 0 ? 'expanded' : '');
        }
    }

    /**
     * Apply all theme configurations to the current page
     * Orchestrates the application of CSS variables and UI element toggles
     */
    applyTheme() {
        this.setCSSVariables();
        this.toggleSidebar();
        this.toggleSearchBar();
        this.setDefaultApp();
        this.showLoginBox();
    }

    /**
     * Show login box with smooth transition after theme is applied
     * Prevents flickering by revealing the login form only after positioning is set
     */
    showLoginBox() {
        const loginBox = document.querySelector('.for-login');
        if (loginBox) {
            // Small delay to ensure CSS variables are applied
            setTimeout(() => {
                loginBox.classList.add('theme-ready');
            }, 50);
        }
    }

    /**
     * Toggle sidebar visibility based on theme configuration
     * Adds/removes 'expanded' class to control sidebar state
     */
    toggleSidebar() {
        const sidebarContainer = document.querySelector('.body-sidebar-container');
        if (!sidebarContainer) {
            return;
        }

        if (this.themeData.hide_side_bar === 0) {
            sidebarContainer.classList.add('expanded');
        } else {
            sidebarContainer.classList.remove('expanded');
        }
    }

    /**
     * Toggle search bar visibility based on user roles
     * Hides search bar if current user's role matches hide_search configuration
     */
    toggleSearchBar() {
        const searchBar = document.querySelector('.input-group.search-bar.text-muted');
        if (!searchBar) {
            return;
        }

        if (this.getUserRoles()) {
            searchBar.style.display = 'none';
        }
    }

    /**
     * Set current app to default app when app switcher is hidden
     * Similar to breadcrumbs.js line 83 functionality
     */
    setDefaultApp() {
        // Only proceed if hide_app_switcher is enabled and default_app is set
        if (!this.themeData.hide_app_switcher || !this.themeData.default_app) {
            return;
        }

        // Check if frappe.app.sidebar.apps_switcher exists (similar to breadcrumbs.js)
        if (frappe?.app?.sidebar?.apps_switcher?.set_current_app) {
            try {
                // Set the current app to the default app (same as breadcrumbs.js line 83)
                frappe.app.sidebar.apps_switcher.set_current_app(this.themeData.default_app);
            } catch (error) {
                // Silent fail if app switcher is not available or app doesn't exist
                console.warn('Failed to set default app:', error);
            }
        }
    }

    /**
     * Set up event listeners for dynamic theme updates and DOM changes
     * Handles real-time theme changes and new element detection
     */
    setupEventListeners() {
        // Listen for theme changes - allows for runtime theme updates
        document.addEventListener('themeChanged', () => {
            this.loadTheme().then(() => this.applyTheme());
        });

        // Listen for DOM changes to apply theme to dynamically added elements
        // Frappe uses dynamic content loading, so we need to monitor for new elements
        const observer = new MutationObserver(() => {
            this.toggleSearchBar();
        });

        // Observe all changes in document body and its children
        observer.observe(document.body, {
            childList: true,  // Watch for element additions/removals
            subtree: true     // Watch all descendant nodes
        });

    }

}

// Initialize theme system when DOM is ready
// Handles both immediate initialization and delayed initialization for slow-loading pages
if (document.readyState === 'loading') {
    // DOM is still loading, wait for DOMContentLoaded event
    document.addEventListener('DOMContentLoaded', () => {
        window.frappeDeskTheme = new FrappeDeskTheme();
    });
} else {
    // DOM is already loaded, initialize immediately
    window.frappeDeskTheme = new FrappeDeskTheme();
} 