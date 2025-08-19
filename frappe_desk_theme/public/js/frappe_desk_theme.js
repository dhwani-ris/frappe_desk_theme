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
        this.footerCacheStorageKey = 'frappe_desk_theme_footer_cache';
        this.cacheTimeout = 30 * 24 * 60 * 60 * 1000; // 30 days (1 month) in milliseconds
        // Footer creation throttling and caching
        this.footerCreating = false;
        this.footerHtmlCache = null;
        this.footerCacheKey = null; // Track what theme data the footer was cached for
        this.stickyFooterListenerSetup = false;
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
            // Production-ready silent fail - apply default theme and show login box
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
        
        return cacheAge < this.cacheTimeout; // 30 days
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
            // Clear footer cache to ensure fresh data
            this.footerHtmlCache = null;
            this.footerCacheKey = null;
            
            await this.loadTheme();
            this.applyTheme();
            
            // Dispatch event for other components
            document.dispatchEvent(new CustomEvent('themeRefreshed', {
                detail: { themeData: this.themeData }
            }));
        } catch (error) {
            // Silent fail - theme refresh errors should not interrupt user experience
        }
    }

    /**
     * Save footer cache to localStorage
     */
    saveFooterCache(footerHtml, cacheKey) {
        try {
            const cacheData = {
                html: footerHtml,
                key: cacheKey,
                timestamp: Date.now()
            };
            localStorage.setItem(this.footerCacheStorageKey, JSON.stringify(cacheData));
        } catch (error) {
            // localStorage might be full or disabled
        }
    }

    /**
     * Load footer cache from localStorage
     */
    loadFooterCache() {
        try {
            const cached = localStorage.getItem(this.footerCacheStorageKey);
            if (!cached) return null;

            const cacheData = JSON.parse(cached);
            const now = Date.now();
            const cacheAge = now - cacheData.timestamp;

            // Return cached data if it's still valid (within 30-day timeout)
            if (cacheAge < this.cacheTimeout) {
                return cacheData;
            } else {
                // Remove expired cache
                localStorage.removeItem(this.footerCacheStorageKey);
                return null;
            }
        } catch (error) {
            return null;
        }
    }

    /**
     * Clear theme cache (useful for debugging or forced refresh)
     */
    clearCache() {
        try {
            localStorage.removeItem(this.cacheKey);
            localStorage.removeItem(this.footerCacheStorageKey);
            // Also clear footer cache
            this.footerHtmlCache = null;
            this.footerCacheKey = null;
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
            '--hide-app-switcher', '--app-switcher-pointer-events', '--footer-bg', '--footer-color', '--footer-border',
            '--footer-display', '--footer-powered-color', '--footer-link-color', '--footer-link-hover-color',
            '--carousel-fade-opacity', '--login-bg-carousel-image'
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
        
        // Footer defaults
        root.style.setProperty('--footer-display', 'flex');
        root.style.setProperty('--footer-bg', '#f8f9fa');
        root.style.setProperty('--footer-color', '#495057');
        root.style.setProperty('--footer-border', '#dee2e6');
        root.style.setProperty('--footer-powered-color', '#6c757d');
        root.style.setProperty('--footer-link-color', '#007bff');
        root.style.setProperty('--footer-link-hover-color', '#0056b3');

        // Carousel fade default
        root.style.setProperty('--carousel-fade-opacity', '1');
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
        if (theme.carousel && theme.carousel.images && theme.carousel.images.length > 0) {
            // Skip static background image/color for carousel mode
        } else {
            if (theme.login_page_background_color) {
                root.style.setProperty('--login-bg-color', theme.login_page_background_color);
            }
            if (theme.login_page_background_image) {
                root.style.setProperty('--login-bg-image', `url("${theme.login_page_background_image}")`);
            }
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

        // Footer styling
        if (theme.footer_background_color) {
            root.style.setProperty('--footer-bg', theme.footer_background_color);
        }
        if (theme.footer_text_color) {
            root.style.setProperty('--footer-color', theme.footer_text_color);
            root.style.setProperty('--footer-powered-color', theme.footer_text_color);
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
        if (this.themeData.carousel && this.themeData.carousel.images && this.themeData.carousel.images.length > 0) {
            this.renderLoginCarousel();
        } else {
            this.removeLoginCarousel();
        }
        this.showLoginBox();
        this.createFooter();
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
        }
        }
    }

    /**
     * Create and display footer in desk view using HTML template
     * Much more efficient than creating DOM elements dynamically
     */
    async createFooter() {
        // Don't create footer on login page
        if (document.body.classList.contains('login-page') || document.querySelector('#page-login')) {
            return;
        }

        // Remove existing footer if any
        const existingFooter = document.querySelector('#desk-footer');
        if (existingFooter) {
            existingFooter.remove();
            // Clean up sticky footer classes
            document.body.classList.remove('has-sticky-footer');
            const mainSection = document.querySelector('.main-section');
            if (mainSection) {
                mainSection.classList.remove('has-sticky-footer');
            }
        }

        // Check if footer should be displayed (basic check to avoid unnecessary API calls)
        if (!this.themeData.copyright_text && !this.themeData.footer_powered_by) {
            return;
        }

        // Throttle footer creation to prevent multiple simultaneous calls
        if (this.footerCreating) {
            return;
        }
        this.footerCreating = true;

        try {
            // Create a cache key from footer-related theme data
            const currentFooterKey = JSON.stringify({
                copyright_text: this.themeData.copyright_text,
                footer_powered_by: this.themeData.footer_powered_by,
                sticky_footer: this.themeData.sticky_footer
            });

            let footerHtml = this.footerHtmlCache;
            
            // Check in-memory cache first, then localStorage, then API
            if (!footerHtml || this.footerCacheKey !== currentFooterKey) {
                // Try to load from localStorage
                const cachedFooter = this.loadFooterCache();
                if (cachedFooter && cachedFooter.key === currentFooterKey) {
                    footerHtml = cachedFooter.html;
                    this.footerHtmlCache = footerHtml;
                    this.footerCacheKey = currentFooterKey;
                } else {
                    
                    // Get rendered footer HTML from server
                    const response = await fetch('/api/method/frappe_desk_theme.api.get_footer_html', {
                        method: 'GET',
                        headers: {
                            'Accept': 'application/json',
                        }
                    });

                    if (!response.ok) {
                        throw new Error(`HTTP error! Status: ${response.status}`);
                    }

                    const data = await response.json();
                    footerHtml = data?.message || '';
                    
                    // Cache the HTML and key for subsequent calls (both memory and localStorage)
                    this.footerHtmlCache = footerHtml;
                    this.footerCacheKey = currentFooterKey;
                    this.saveFooterCache(footerHtml, currentFooterKey);
                }
            }

            if (footerHtml.trim()) {
                // Create a temporary container to hold the HTML
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = footerHtml;
                
                // Get the footer element from the template
                const footerElement = tempDiv.querySelector('#desk-footer');
                if (footerElement) {
                    // Try to append to main-section first, then fall back to body
                    const mainSection = document.querySelector('.main-section');
                    if (mainSection) {
                        mainSection.appendChild(footerElement);
                        if (this.themeData.sticky_footer) {
                            mainSection.classList.add('has-sticky-footer');
                            // Set up sticky footer sidebar toggle listener
                            this.setupStickyFooterToggle();
                        }
                    } else {
                        // Fallback to body if main-section doesn't exist
                        document.body.appendChild(footerElement);
                        if (this.themeData.sticky_footer) {
                            document.body.classList.add('has-sticky-footer');
                            // Set up sticky footer sidebar toggle listener
                            this.setupStickyFooterToggle();
                        }
                    }
                }
            }
        } catch (error) {
            // Silent fail - footer is optional, don't show errors to user
        } finally {
            this.footerCreating = false;
        }
    }

    /**
     * Set up dynamic positioning for sticky footer when sidebar toggles
     * Ensures footer position updates in real-time with sidebar state
     */
    setupStickyFooterToggle() {
        // Avoid setting up multiple listeners
        if (this.stickyFooterListenerSetup) {
            return;
        }
        this.stickyFooterListenerSetup = true;

        // Function to update sticky footer position
        const updateStickyFooterPosition = () => {
            const footer = document.querySelector('#desk-footer.sticky');
            if (!footer) return;

            const sidebarContainer = document.querySelector('.body-sidebar-container');
            const isExpanded = sidebarContainer && sidebarContainer.classList.contains('expanded');
            
            // Update footer position based on sidebar state
            if (isExpanded) {
                footer.style.left = '220px';
            } else {
                footer.style.left = '50px';
            }
        };

        // Listen for sidebar toggle events
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && 
                    mutation.attributeName === 'class' && 
                    mutation.target.classList.contains('body-sidebar-container')) {
                    // Delay to ensure CSS transitions complete
                    setTimeout(updateStickyFooterPosition, 50);
                }
            });
        });

        // Observe sidebar container for class changes
        const sidebarContainer = document.querySelector('.body-sidebar-container');
        if (sidebarContainer) {
            observer.observe(sidebarContainer, {
                attributes: true,
                attributeFilter: ['class']
            });
        }

        // Also listen for sidebar toggle via click events
        document.addEventListener('click', (event) => {
            // Check if clicked element or its parent is a sidebar toggle
            const isToggle = event.target.closest('.collapse-sidebar-link, .sidebar-toggle, [data-toggle="sidebar"]');
            if (isToggle) {
                setTimeout(updateStickyFooterPosition, 200); // Allow time for animation
            }
        });

        // Initial position update
        updateStickyFooterPosition();
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
        let footerTimeout;
        const observer = new MutationObserver(() => {
            this.toggleSearchBar();
            
            // Debounce footer creation to avoid performance issues
            clearTimeout(footerTimeout);
            footerTimeout = setTimeout(() => {
                // Only create footer if it doesn't exist
                if (!document.querySelector('#desk-footer')) {
                    this.createFooter();
                }
            }, 500); // 500ms delay to avoid constant recreation
        });

        // Observe all changes in document body and its children
        observer.observe(document.body, {
            childList: true,  // Watch for element additions/removals
            subtree: true     // Watch all descendant nodes
        });

    }

    // Navigation buttons
    
    ensureButton(loginPage, images, id, html, onClick) {
        const manual = !!this.themeData.carousel.manual_navigation;
        let btn = document.getElementById(id);
        if (!manual || images.length <= 1) {
            if (btn) btn.remove();
            return null;
        }
        if (!btn) {
            btn = document.createElement('button');
            btn.id = id;
            btn.className = `carousel-nav ${id === 'carousel-nav-left' ? 'carousel-nav-left' : 'carousel-nav-right'}`;
            btn.innerHTML = html;
            btn.addEventListener('click', onClick);
            loginPage.appendChild(btn);
        }
        return btn;
    };

    renderLoginCarousel() {
        const loginPage = document.querySelector('#page-login');
        if (!loginPage) return;
        const root = document.documentElement;
        const images = this.themeData.carousel.images;
        if (!images || images.length === 0) return;

        // Set initial state and background
        if (typeof this._carouselIndex !== 'number' || this._carouselIndex >= images.length) {
            this._carouselIndex = 0;
        }
        root.style.setProperty('--login-bg-carousel-image', `url("${images[this._carouselIndex]}")`);

        // Remove any previous timer
        if (this._carouselTimer) {
            clearTimeout(this._carouselTimer);
            this._carouselTimer = null;
        }

        
        this.ensureButton(loginPage, images,'carousel-nav-left', '&#8592;', (e) => {
            e.stopPropagation(); e.preventDefault();
            if (this._carouselTimer) {
                clearTimeout(this._carouselTimer);
                this._carouselTimer = null;
            }
            this.carouselShowImage(this._carouselIndex - 1, images, root, -1);
        });
        this.ensureButton(loginPage, images,'carousel-nav-right', '&#8594;', (e) => {
            e.stopPropagation(); e.preventDefault();
            if (this._carouselTimer) {
                clearTimeout(this._carouselTimer);
                this._carouselTimer = null;
            }
            this.carouselShowImage(this._carouselIndex + 1, images, root, 1);
        });

        // Auto-advance: handled in carouselShowImage after animation
        if (this.themeData.carousel.auto_advance !== false && images.length > 1 && !this._carouselTimer) {
            this._carouselTimer = setTimeout(() => {
                this._carouselTimer = null;
                this.carouselShowImage(this._carouselIndex + 1, images, root, 1);
            }, 5000);
        }
    }
    

    carouselShowImage(idx, images, root, direction = 1) {
        const total = images.length;
        idx = (idx + total) % total;
        if (idx === this._carouselIndex || this._carouselSliding) return;

        this._carouselSliding = true;
        // Fade out
        root.style.setProperty('--carousel-fade-opacity', '0');
        setTimeout(() => {
            root.style.setProperty('--login-bg-carousel-image', `url("${images[idx]}")`);
            root.style.setProperty('--carousel-fade-opacity', '1');
            this._carouselIndex = idx;
            this._carouselSliding = false;
            // Auto-advance
            const auto = this.themeData.carousel.auto_advance !== false;
            if (auto && images.length > 1 && !this._carouselTimer) {
                this._carouselTimer = setTimeout(() => {
                    this._carouselTimer = null;
                    this.carouselShowImage(this._carouselIndex + 1, images, root, 1);
                }, 5000);
            }
        }, 400);
    }
    
    
    

    removeLoginCarousel() {
        // Remove navigation buttons if present
        const left = document.getElementById('carousel-nav-left');
        const right = document.getElementById('carousel-nav-right');
        if (left) left.remove();
        if (right) right.remove();
        if (this._carouselTimer) {
            clearTimeout(this._carouselTimer);
            this._carouselTimer = null;
        }
        // Remove the CSS variable
        document.documentElement.style.removeProperty('--login-bg-carousel-image');
        this._carouselIndex = 0;
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