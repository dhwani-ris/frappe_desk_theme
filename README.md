# Frappe Desk Theme

A comprehensive theming solution for FrappeERPNext desk interface that allows complete customization of the user interface appearance.

## ✨ **Key Highlights**

- 🎨 **Comprehensive Customization** - Complete control over every UI element
- 📱 **Mobile Responsive** - Perfect experience across all devices
- 🔧 **Production Ready** - Silent error handling and bulletproof fallbacks

## Features

### 🎨 **Login Page Customization**
- **Background**: Choose between solid color or background image
- **Login Box**: Customizable position (Default, Left, Right)
- **Login Button**: Full control over button colors, text colors, and hover states
- **Page Title**: Custom login page title (30 characters max)
- **Smooth Animations**: Elegant fade-in transitions with fallback safety

### 🧭 **Navigation Bar**
- **Colors**: Customize background and text colors
- **Help Button**: Option to hide the help button
- **Search Bar**: Role-based search bar visibility control
- **Icons**: Automatic color adaptation for SVG elements

### 🔘 **Button Styling**
- **Primary Buttons**: Background, text, and hover state colors
- **Secondary Buttons**: Separate styling for secondary button variants
- **State Management**: Proper focus and active states

### 📄 **Body & Content**
- **Background**: Customize main body background color
- **Content Box**: Background color for content areas
- **Sidebar**: Option to hide the left sidebar
- **Typography**: Custom text colors for enhanced readability

### 📊 **Tables & Lists**
- **Header Styling**: Background and text colors for table headers
- **Body Styling**: Background and text colors for table bodies
- **Interactive Elements**: Option to hide like/comment sections
- **Mobile View**: Control card view and flex content on mobile devices

### 🎯 **Widgets & Components**
- **Number Cards**: Background, border, and text colors
- **Input Fields**: Background, border, text, and label colors
- **Form Elements**: Comprehensive styling for all form components

## Installation

### Using Bench CLI
```bash
cd $PATH_TO_YOUR_BENCH
bench get-app frappe_desk_theme --branch development
bench install-app frappe_desk_theme
bench build --app frappe_desk_theme
```

### Manual Installation
1. Clone this repository to your `apps` directory
2. Run `bench install-app frappe_desk_theme`
3. Build assets: `bench build --app frappe_desk_theme`
4. Restart your Frappe server

## Configuration

### **Quick Setup**
1. **Access Theme Settings**: Go to **Desk** → **Desk Theme** (System Manager role required)
2. **Choose Sections**: Configure Login Page, Navbar, Buttons, Body, Tables, Widgets, Inputs
3. **Save & Apply**: Changes apply immediately with smooth transitions

### **Theme Sections**
| Section | Customizable Elements |
|---------|----------------------|
| **Login Page** | Background, box position, button colors, custom title |
| **Navbar** | Background, text colors, help button, search visibility |
| **Buttons** | Primary/secondary colors, hover states |
| **Body** | Background, content areas, sidebar visibility |
| **Tables** | Headers, body colors, mobile behavior |
| **Widgets** | Number cards, dashboard elements |
| **Inputs** | Form fields, labels, borders |

## Browser Support

✅ **Modern Browsers**: Chrome 60+, Firefox 55+, Safari 12+, Edge 79+  
✅ **CSS Variables**: Full support for dynamic theming  
✅ **Local Storage**: Caching functionality  
✅ **Progressive Enhancement**: Works without JavaScript  

## Development

### **Setup Development Environment**
```bash
cd apps/frappe_desk_theme
pre-commit install
bench build --app frappe_desk_theme --force
```

### **Code Quality Tools**
- **ruff**: Python code formatting and linting
- **eslint**: JavaScript linting
- **prettier**: Code formatting
- **pyupgrade**: Python code modernization

### **Development Features**
- **Hot Reload**: Changes apply immediately in developer mode
- **Debug Tools**: Refresh button and keyboard shortcuts (Ctrl+Shift+R)
- **Error Logging**: Detailed error information in development

### **Building Assets**
```bash
# Development build
bench build --app frappe_desk_theme

# Production build (minified)
bench build --app frappe_desk_theme --production
```

## Troubleshooting

### **Common Issues**

**Theme not applying?**
- Clear browser cache and localStorage
- Check System Manager permissions
- Verify app installation: `bench list-apps`

**Login box flickering?**
- Ensure assets are built: `bench build --app frappe_desk_theme`
- Check browser console for JavaScript errors
- Verify CSS is loading properly

**Performance issues?**
- Clear theme cache: `localStorage.removeItem('frappe_desk_theme_cache')`
- Check network tab for failed API calls
- Restart Frappe server

### **Debug Commands**
```bash
# Clear cache
bench console --site <site> -c "import frappe; frappe.cache().delete_key('*theme*')"

# Rebuild assets
bench build --app frappe_desk_theme --force

# Check app status
bench list-apps
```

## License

MIT License - see [license.txt](license.txt) for details.

## Support & Contributing

- **Publisher**: Dhwani RIS
- **Email**: bhushan.barbuddhe@dhwaniris.com
- **Issues**: Report bugs via GitHub issues
- **PRs Welcome**: Follow pre-commit guidelines

### **Contributing Guidelines**
1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Follow code quality standards (pre-commit will help)
4. Test thoroughly on different screen sizes
5. Submit pull request with detailed description

