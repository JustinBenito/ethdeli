# macOS Notch Overlay - Dynamic Island

A macOS Electron app that creates a Dynamic Island-style notch overlay at the top of your screen, emulating iOS behavior with enhanced functionality.

## Features

### 🎯 Core Design
- **Pill-shaped notch**: Rounded rectangle with pitch-black background
- **Retina optimized**: Responsive to both Retina and non-Retina displays
- **Seamless integration**: Positioned at screen top without obstructing macOS menu bar
- **macOS styling**: Native vibrancy effects and smooth animations

### 🔧 Interactive Elements

#### Chips Section
- Four horizontally-aligned pill-shaped chips
- Each chip contains an icon and number
- Smooth hover and selection animations
- Keyboard shortcuts (1-4 keys)

#### Context Display
- Dynamic white text showing current status
- Smooth transitions when content updates
- Auto-rotating contextual messages

#### Control Panel
- **Green Up Arrow**: Clickable with tactile animation
- **Circular Timer**: 30-second countdown with yellow progress stroke
- **Red Down Arrow**: Clickable with tactile animation

### ⌨️ Keyboard Shortcuts
- **Option + L**: Toggle notch visibility
- **1-4**: Select chips
- **Space**: Start/stop timer
- **R**: Reset timer
- **Arrow Keys**: Trigger up/down actions
- **Escape**: Hide notch

### 🎨 Animations & Effects
- High-frame-rate animations optimized for Mac displays
- Natural easing and transitions mimicking Apple's design language
- Tactile feedback on all interactions
- Performance monitoring with automatic quality adjustment
- Accessibility support with reduced motion preferences

## Installation & Usage

### Prerequisites
- macOS 10.15 or later
- Node.js 16+ and npm

### Setup
```bash
# Install dependencies
npm install

# Start the application
npm start

# Development mode with logging
npm run dev

# Build for distribution
npm run build
```

### First Run
1. Launch the app with `npm start`
2. The notch will appear at the top center of your screen
3. Use **Option + L** to toggle visibility
4. Interact with chips, timer, and arrows using mouse or keyboard

## Technical Implementation

### Architecture
- **Main Process**: Electron window management and global shortcuts
- **Renderer Process**: UI interactions and animations
- **Overlay Window**: Transparent, always-on-top, frameless window

### Display Optimization
- Automatic scaling for different display densities
- Retina display support with crisp rendering
- Dynamic repositioning on display changes
- Performance monitoring for smooth animations

### Accessibility
- Full keyboard navigation support
- High contrast mode compatibility
- Screen reader friendly structure
- Reduced motion support for accessibility preferences

## Customization

### Styling
Modify `renderer.css` to customize:
- Notch dimensions and positioning
- Color schemes and transparency
- Animation timing and easing
- Interactive element styling

### Functionality
Update `renderer.js` to add:
- New chip behaviors
- Custom timer durations
- Additional keyboard shortcuts
- Integration with system services

### Window Behavior
Adjust `main.js` for:
- Window positioning and sizing
- Global shortcut combinations
- Display detection and handling
- macOS integration features

## Development Notes

### Performance Considerations
- Animations use hardware acceleration where possible
- Frame rate monitoring prevents performance degradation
- Efficient event handling to minimize CPU usage
- Optimized for battery life on laptops

### macOS Integration
- Uses native vibrancy effects
- Respects system appearance preferences
- Handles display scaling automatically
- Integrates with macOS window management

## Building & Distribution

```bash
# Create distributable package
npm run build

# Create development build
npm run pack
```

The built application will be available in the `dist` folder.

## Troubleshooting

### Common Issues
1. **Notch not appearing**: Check if another app is using the same screen space
2. **Shortcut not working**: Ensure no other app is using Option + L
3. **Animation lag**: Check system performance and reduce other running apps
4. **Display issues**: Try restarting the app after changing displays

### Development
- Use `npm run dev` for detailed logging
- Check the Developer Tools (View → Toggle Developer Tools)
- Monitor console for performance warnings

## License

MIT License - Feel free to modify and distribute.