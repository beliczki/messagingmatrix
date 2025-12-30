# Messaging Matrix Design System

## Overview

Complete UI design system for the Messaging Matrix application. Blue-themed glassmorphism design with iOS-style animations.

**Reference Files:**
- `style-guide.css` - Complete CSS implementation (2180 lines)
- `style-guide.html` - HTML structure reference
- `style-guide.js` - Interactive behavior

---

## Design Tokens

### Primary Colors

```css
--color-primary: #2870ed        /* Main blue */
--color-primary-dark: #1e5bc7   /* Darker blue */
--color-primary-light: #4a8ef5  /* Lighter blue */
--main-ui-color: #2870ed        /* Hamburger, menu, panels */
--toolbar-color: #02a3a4        /* Teal toolbar */
```

### Accent Colors

```css
--color-accent-pink: #eb4c79    /* Pink highlights */
--color-accent-orange: #ff6130  /* Orange badges */
--color-accent-teal: #02a3a4    /* Teal toolbar */
```

### Status Colors (Message Cards)

| Status | Background | Text | CSS Class |
|--------|------------|------|-----------|
| Planned | `#ffff00` | `#000000` | `.planned` |
| Active | `#34a853` | `#ffffff` | `.active` |
| In Progress | `#ff6d01` | `#ffffff` | `.inprogress` |
| Inactive | `#cccccc` | `#000000` | `.inactive` |
| Error | `#ff0000` | `#ffffff` | `.error` |

### Transparency Levels

```css
--white-10: rgba(255, 255, 255, 0.1)
--white-15: rgba(255, 255, 255, 0.15)
--white-20: rgba(255, 255, 255, 0.2)
--white-30: rgba(255, 255, 255, 0.3)
--white-50: rgba(255, 255, 255, 0.5)
--white-80: rgba(255, 255, 255, 0.8)
--black-10: rgba(0, 0, 0, 0.1)
--black-30: rgba(0, 0, 0, 0.3)
--black-50: rgba(0, 0, 0, 0.5)
```

### Typography

```css
--font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif
--font-size-xs: 0.75rem    /* 12px */
--font-size-sm: 0.875rem   /* 14px */
--font-size-base: 1rem     /* 16px */
--font-size-lg: 1.125rem   /* 18px */
--font-size-xl: 1.25rem    /* 20px */
--font-size-2xl: 1.5rem    /* 24px */

--font-weight-normal: 400
--font-weight-medium: 500
--font-weight-semibold: 600
--font-weight-bold: 700
```

**Base Font Size:**
- Desktop: 14px
- Mobile (<960px): 12px

### Spacing Scale

```css
--space-1: 0.25rem   /* 4px */
--space-2: 0.5rem    /* 8px */
--space-3: 0.75rem   /* 12px */
--space-4: 1rem      /* 16px */
--space-5: 1.25rem   /* 20px */
--space-6: 1.5rem    /* 24px */
--space-8: 2rem      /* 32px */
--space-10: 2.5rem   /* 40px */
--space-12: 3rem     /* 48px */
```

### Border Radius

```css
--radius-sm: 3px
--radius-md: 5px
--radius-lg: 7px
--radius-xl: 10px
--radius-2xl: 12px
--radius-3xl: 14px
--radius-full: 9999px
```

### Shadows

```css
/* Main UI shadow - used on all floating panels */
--ui-shadow:
  0 30px 40px rgba(0, 0, 0, 0.8),
  0 7px 10px rgba(0, 0, 0, 0.4);

--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
```

### Transitions

```css
--transition-fast: 150ms ease
--transition-base: 250ms ease
--transition-slow: 400ms cubic-bezier(0.4, 0, 0.2, 1)
--transition-bounce: 500ms cubic-bezier(0.34, 1.56, 0.64, 1)
--transition-ios: 250ms cubic-bezier(0.32, 0.72, 0, 1)
```

### Z-Index Scale

```css
--z-dropdown: 100
--z-sticky: 200
--z-fixed: 300
--z-modal-backdrop: 400
--z-modal: 500
--z-menu-panel: 799
--z-hamburger: 800
--z-dialog-overlay: 899
--z-dialog: 900
```

### Component Sizes

```css
--hamburger-size: 52px
--menu-width: 320px
--toolbar-width: 280px
--bottom-bar-height: 46px
--dialog-sidebar-width: 200px
--dialog-preview-width: 340px
```

---

## Components

### 1. Hamburger Button

Fixed blue square button in top-left corner that toggles the menu panel.

**HTML Structure:**
```html
<button class="hamburger-btn" id="hamburgerBtn">
  <i data-lucide="menu"></i>
</button>
```

**CSS Classes:**
- `.hamburger-btn` - Base styles
- `.hamburger-btn.menu-open` - When menu is open

**Specs:**
- Position: Fixed, top-left (24px from edges)
- Size: 52x52px
- Background: `var(--main-ui-color)`
- Border radius: 7px
- Shadow: `var(--ui-shadow)`
- Icon: White, 24px

---

### 2. Menu Panel

Slide-out navigation panel with animated items.

**HTML Structure:**
```html
<div class="menu-overlay" id="menuOverlay"></div>

<div class="menu-panel" id="menuPanel">
  <div class="menu-content">
    <!-- Logo -->
    <svg class="menu-logo" viewBox="0 0 800 800">...</svg>

    <!-- Animated selector highlight -->
    <div class="menu-selector" id="menuSelector"></div>

    <!-- Navigation -->
    <nav class="nav-menu">
      <button class="nav-item" data-index="0">
        <i data-lucide="table"></i>
        <span>Messaging Matrix</span>
      </button>
      <!-- More nav items... -->
    </nav>

    <div class="menu-spacer"></div>

    <!-- Profile -->
    <button class="nav-item profile-item">
      <div class="profile-avatar">BR</div>
      <span>Profile</span>
    </button>

    <!-- Logout -->
    <button class="nav-item logout">
      <i data-lucide="log-out"></i>
      <span>Logout</span>
    </button>
  </div>
</div>
```

**CSS Classes:**
- `.menu-panel` - Panel container (hidden by default)
- `.menu-panel.open` - Visible state with scale animation
- `.menu-content` - Inner content wrapper
- `.menu-logo` - Animated logo
- `.menu-selector` - Floating highlight that follows hover
- `.menu-selector.visible` - Shows the selector
- `.nav-menu` - Navigation list container
- `.nav-item` - Individual nav button
- `.nav-item.active` - Currently selected item
- `.nav-item.profile-item` - Profile button variant
- `.nav-item.logout` - Logout button variant
- `.menu-spacer` - Flex spacer to push profile/logout to bottom
- `.menu-overlay` - Transparent click-away overlay

**Specs:**
- Position: Below hamburger button (aligned to bottom-right corner)
- Width: 320px
- Height: Fills viewport minus margins
- Animation: Scale 0.5→1 with bounce easing (500ms)
- Nav items: Staggered slide-in (50ms delay increment)

**Animation Details:**
- Panel: `transform: scale(0.5)` → `scale(1)` with bounce
- Nav items: `translateX(-20px)` → `translateX(0)` with staggered delays
- Selector: Fades in after 500ms, follows hover position

---

### 3. Toolbar (Teal Panel)

Collapsible control panel for view modes, filters, and zoom.

**HTML Structure:**
```html
<!-- Toggle Button (always visible) -->
<button class="toolbar-toggle" id="toolbarToggle">
  <i data-lucide="pocket-knife"></i>
</button>

<!-- Panel (hidden by default) -->
<div class="toolbar" id="toolbar">
  <div class="toolbar-drag-row">
    <i data-lucide="grip-horizontal"></i>
  </div>
  <div class="toolbar-content">
    <!-- View Modes -->
    <div class="view-modes">
      <button class="view-mode-btn active" title="Matrix View">
        <i data-lucide="grid-2x2"></i>
      </button>
      <button class="view-mode-btn" title="Tree View">
        <i data-lucide="network"></i>
      </button>
      <button class="view-mode-btn" title="Sankey View">
        <i data-lucide="layout-panel-top"></i>
      </button>
      <button class="view-mode-btn" title="Feed View">
        <i data-lucide="list"></i>
      </button>
    </div>

    <!-- Filters -->
    <div class="filter-group">
      <div class="filter-pill">
        <i data-lucide="filter" class="filter-pill-icon"></i>
        <input type="text" class="filter-input" placeholder="Product filter...">
        <span class="filter-pill-badge">3</span>
      </div>
      <!-- More filter pills... -->
    </div>

    <!-- Sliders (tree/sankey views) -->
    <div class="slider-group">
      <div class="slider-item">
        <div class="slider-header">
          <span class="slider-label">Node size</span>
          <span class="slider-value">1.3x</span>
        </div>
        <input type="range" class="slider-input" min="0.5" max="2" step="0.1" value="1.3">
      </div>
    </div>

    <!-- Zoom Controls -->
    <div class="zoom-controls">
      <div class="zoom-row">
        <button class="zoom-btn"><i data-lucide="minus"></i></button>
        <span class="zoom-value">78% <span class="zoom-fit">fit</span></span>
        <button class="zoom-btn"><i data-lucide="plus"></i></button>
      </div>
      <div class="nav-pad">
        <div></div>
        <button class="nav-pad-btn"><i data-lucide="arrow-up"></i></button>
        <div></div>
        <button class="nav-pad-btn"><i data-lucide="arrow-left"></i></button>
        <button class="nav-pad-btn center"><i data-lucide="square"></i></button>
        <button class="nav-pad-btn"><i data-lucide="arrow-right"></i></button>
        <div></div>
        <button class="nav-pad-btn"><i data-lucide="arrow-down"></i></button>
        <div></div>
      </div>
    </div>
  </div>
</div>
```

**CSS Classes:**
- `.toolbar-toggle` - 52x52 teal toggle button
- `.toolbar` - Panel container (hidden by default)
- `.toolbar.open` - Visible state
- `.toolbar-drag-row` - Drag handle area
- `.toolbar-content` - Inner content
- `.view-modes` - View switcher container
- `.view-mode-btn` - Individual view button
- `.view-mode-btn.active` - Selected view (white bg)
- `.filter-group` - Filter pills container
- `.filter-pill` - Individual filter row
- `.filter-pill-icon` - Filter icon
- `.filter-input` - Text input field
- `.filter-pill-badge` - Count badge
- `.filter-pill-badge.zero` - Orange badge when count is 0
- `.slider-group` - Sliders container
- `.slider-item` - Individual slider
- `.slider-header` - Label + value row
- `.slider-input` - Range input
- `.zoom-controls` - Zoom section container
- `.zoom-row` - +/- buttons with value
- `.zoom-btn` - Zoom button
- `.zoom-fit` - "fit" link text
- `.nav-pad` - 3x3 navigation grid
- `.nav-pad-btn` - Direction buttons

**Specs:**
- Toggle position: Fixed, top-right (24px from edges)
- Panel position: Below toggle button
- Width: 280px
- Background: `var(--toolbar-color)` (#02a3a4)
- Animation: Same as menu panel (scale + bounce)

---

### 4. Bottom Bar

Fixed bar at bottom with Matrix State and AI Assistant panels.

**HTML Structure:**
```html
<div class="bottom-bar">
  <div class="bottom-panel">
    <i data-lucide="save" class="bottom-panel-icon"></i>
    <span class="bottom-panel-title">Matrix State</span>
    <button class="bottom-panel-btn">Reload</button>
    <button class="bottom-panel-btn">Save</button>
  </div>
  <div class="bottom-panel">
    <i data-lucide="bot" class="bottom-panel-icon"></i>
    <span class="bottom-panel-title">AI Assistant</span>
  </div>
</div>
```

**CSS Classes:**
- `.bottom-bar` - Container, centered horizontally
- `.bottom-panel` - Individual panel
- `.bottom-panel-icon` - Icon
- `.bottom-panel-title` - Title text
- `.bottom-panel-btn` - Action buttons

**Specs:**
- Position: Fixed bottom, centered
- Height: 46px
- Background: `var(--main-ui-color)`
- Border radius: 10px
- Gap between panels: 16px

---

### 5. Matrix Grid

CSS Grid layout for audience/topic matrix.

**HTML Structure:**
```html
<div class="matrix-grid">
  <!-- Row 1: Corner + Audience Headers -->
  <div class="matrix-corner"></div>

  <div class="matrix-audience-header">
    <span class="audience-tag product">SZK</span>
    <div class="audience-name">Fiatalok 25-35</div>
    <div class="audience-tags">
      <span class="audience-tag">PRO</span>
      <span class="audience-tag">12345678</span>
    </div>
  </div>

  <!-- More audience headers... -->

  <!-- Row 2+: Topic + Message Cells -->
  <div class="matrix-topic-header">
    <span class="topic-tag product">SZK</span>
    <div class="topic-name">Erste Max Hitelkártya</div>
    <div class="topic-tags">
      <span class="topic-tag">top_01</span>
    </div>
  </div>

  <div class="matrix-cell-content">
    <div class="message-card planned">
      <span class="mc-number">1</span>
      <span class="mc-variant">a</span>
    </div>
    <div class="message-card active">
      <span class="mc-number">1</span>
      <span class="mc-variant">b</span>
    </div>
  </div>
</div>
```

**CSS Classes:**
- `.matrix-grid` - CSS Grid container
- `.matrix-corner` - Empty top-left cell
- `.matrix-audience-header` - Column header (top row)
- `.audience-name` - Audience name text
- `.audience-tags` - Tags container
- `.audience-tag` - Individual tag
- `.matrix-topic-header` - Row header (left column)
- `.topic-name` - Topic name text
- `.topic-tags` - Tags container
- `.topic-tag` - Individual tag
- `.matrix-cell-content` - Messages cell
- `.matrix-cell-content.highlight` - Hover highlight state

**Message Cards:**
- `.message-card` - Base card styles
- `.message-card.planned` - Yellow background
- `.message-card.active` - Green background
- `.message-card.inprogress` - Orange background
- `.message-card.inactive` - Gray background
- `.message-card.error` - Red background
- `.message-card.selected` - White border (selected state)
- `.message-card.shake` - Shake animation (invalid selection)
- `.mc-number` - Message number
- `.mc-variant` - Variant letter

**Specs:**
- Audience header: Pink underline (3px, #eb4c79)
- Topic header: White right border (3px)
- Message cards: 2px transparent border (prevents layout shift)
- Hover: `transform: scale(1.05)` with shadow

---

### 6. Message Editor Dialog

3-panel modal dialog for editing messages.

**HTML Structure:**
```html
<div id="dialogOverlay" class="overlay-animated"></div>

<div id="dialog" class="dialog-panel dialog-animated">
  <div class="dialog-layout">
    <!-- LEFT SIDEBAR -->
    <div class="dialog-sidebar">
      <h2 class="dialog-title">Edit</h2>

      <!-- Navigation -->
      <div class="dialog-nav">
        <button class="dialog-nav-btn"><i data-lucide="chevron-left"></i></button>
        <span class="dialog-nav-label">43 a</span>
        <button class="dialog-nav-btn"><i data-lucide="chevron-right"></i></button>
      </div>

      <!-- Auto-Save Toggle -->
      <button class="dialog-toggle checked">
        <div class="checkbox-box"><i data-lucide="check"></i></div>
        <span>Auto-Save</span>
      </button>

      <!-- Vertical Tabs -->
      <div class="dialog-tabs">
        <button class="dialog-tab">
          <h2>Naming</h2>
          <i data-lucide="tag"></i>
        </button>
        <button class="dialog-tab active">
          <h2>Content</h2>
          <i data-lucide="cooking-pot"></i>
        </button>
        <button class="dialog-tab">
          <h2>Generate</h2>
          <i data-lucide="sparkles"></i>
        </button>
        <button class="dialog-tab">
          <h2>Styles</h2>
          <i data-lucide="pencil-ruler"></i>
        </button>
        <button class="dialog-tab">
          <h2>Trafficking</h2>
          <i data-lucide="rocket"></i>
        </button>
      </div>

      <!-- Action Buttons -->
      <div class="dialog-actions">
        <button class="link-button"><i data-lucide="trash-2"></i> Delete</button>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-secondary">Cancel</button>
          <button class="btn btn-secondary">Save</button>
        </div>
        <button class="btn btn-primary">Save & close</button>
      </div>
    </div>

    <!-- CONTENT AREA -->
    <div class="dialog-content-area">
      <!-- MIDDLE: Main Content -->
      <div class="dialog-main custom-scrollbar">
        <!-- Form content here -->
      </div>

      <!-- RIGHT: Preview Panel -->
      <div class="dialog-preview">
        <div class="preview-header">
          <button class="skip-animation-btn">
            <div class="checkbox-box"><i data-lucide="check"></i></div>
            <span>Skip animation</span>
          </button>
          <div class="dropdown">
            <button class="dropdown-trigger">
              <span>300x600</span>
              <i data-lucide="chevron-down"></i>
            </button>
            <div class="dropdown-menu">
              <div class="dropdown-item selected">300x600</div>
              <div class="dropdown-item">970x250</div>
              <div class="dropdown-item">300x250</div>
            </div>
          </div>
        </div>
        <div class="preview-frame">
          <img src="preview.png" alt="Preview">
        </div>
      </div>
    </div>
  </div>
</div>
```

**CSS Classes:**
- `.overlay-animated` - Backdrop overlay
- `.overlay-animated.open` - Visible overlay
- `.dialog-panel` - Dialog container
- `.dialog-animated` - Animation wrapper
- `.dialog-animated.open` - Visible dialog
- `.dialog-layout` - 3-panel flex layout
- `.dialog-layout.wide-layout` - Wide preview mode (for 970x250)
- `.dialog-sidebar` - Left sidebar
- `.dialog-title` - Title text
- `.dialog-nav` - Message navigation
- `.dialog-nav-btn` - Prev/next buttons
- `.dialog-nav-label` - Current message indicator
- `.dialog-toggle` - Auto-save toggle
- `.dialog-toggle.checked` - Checked state
- `.dialog-tabs` - Vertical tabs container
- `.dialog-tab` - Individual tab
- `.dialog-tab.active` - Selected tab
- `.dialog-tab[data-color="pink"]` - Colored stripe variants
- `.dialog-actions` - Bottom action buttons
- `.dialog-content-area` - Middle + right wrapper
- `.dialog-main` - Scrollable main content
- `.dialog-preview` - Right preview panel
- `.preview-header` - Size selector row
- `.preview-frame` - Image container

**Specs:**
- Position: Fixed, inset with margins
- Max width: 1100px
- Animation: iOS-style scale 0.95→1 with fade
- Sidebar width: 200px
- Preview width: 340px
- Wide layout: Preview moves to top for horizontal creatives

---

### 7. Blue Dialog (Matrix State / AI Assistant)

Shorter, wider empty dialog for utility panels.

**HTML Structure:**
```html
<div id="blueDialog" class="dialog-animated dialog-panel blue-dialog">
  <!-- Content here -->
</div>
```

**CSS Classes:**
- `.dialog-panel.blue-dialog` - Blue dialog variant

**Specs:**
- Shorter and wider than editor dialog
- Background: `var(--color-primary)`
- Same iOS-style animation

---

### 8. Form Elements

**Input Fields:**
```html
<div class="form-group">
  <label class="form-label">Headline</label>
  <input type="text" class="form-input" value="...">
</div>
```

**Tags Input:**
```html
<div class="tags-input">
  <span class="tag">fullSurfaceColor</span>
  <span class="tag active">animated</span>
</div>
```

**Dropdown:**
```html
<div class="dropdown">
  <button class="dropdown-trigger">
    <span>300x600</span>
    <i data-lucide="chevron-down"></i>
  </button>
  <div class="dropdown-menu">
    <div class="dropdown-item selected">300x600</div>
    <div class="dropdown-item">970x250</div>
  </div>
</div>
```

**CSS Classes:**
- `.form-group` - Field wrapper
- `.form-label` - Label text
- `.form-input` - Text input (transparent bg, white border)
- `.form-textarea` - Multiline textarea
- `.tags-input` - Tags container
- `.tag` - Individual tag pill
- `.tag.active` - Selected tag (white bg)
- `.dropdown` - Dropdown wrapper
- `.dropdown.open` - Open state
- `.dropdown-trigger` - Button that opens dropdown
- `.dropdown-menu` - Options container
- `.dropdown-item` - Individual option
- `.dropdown-item.selected` - Selected option
- `.link-button` - Underlined text button
- `.link-button.danger` - Red text variant

---

### 9. Status Badges

```html
<span class="status-badge planned">Planned</span>
<span class="status-badge active">Active</span>
<span class="status-badge inprogress">In Progress</span>
<span class="status-badge inactive">Inactive</span>
<span class="status-badge error">Error</span>
```

**CSS Classes:**
- `.status-badge` - Base badge styles
- `.status-badge.planned` - Yellow
- `.status-badge.active` - Green
- `.status-badge.inprogress` - Orange
- `.status-badge.inactive` - Gray
- `.status-badge.error` - Red

---

### 10. Buttons

```html
<button class="btn btn-primary">Save & close</button>
<button class="btn btn-secondary">Cancel</button>
<button class="btn btn-danger">Delete</button>
<button class="btn btn-ghost">Ghost</button>
```

**CSS Classes:**
- `.btn` - Base button styles
- `.btn-primary` - White bg, blue text
- `.btn-secondary` - Semi-transparent white bg
- `.btn-danger` - Red text, transparent bg
- `.btn-ghost` - Bordered, transparent bg
- `.btn-lg` - Larger padding

---

### 11. Additional Components

**Search Input:**
```html
<div class="search-input">
  <i data-lucide="search" class="search-input-icon"></i>
  <input type="text" placeholder="Search...">
</div>
```

**Card:**
```html
<div class="card">
  <div class="card-header">
    <span class="card-title">Title</span>
  </div>
  <div class="card-body">Content</div>
  <div class="card-footer">
    <button class="btn btn-primary">Action</button>
  </div>
</div>
```

**Tabs:**
```html
<div class="tabs">
  <button class="tab active">Tab 1</button>
  <button class="tab">Tab 2</button>
</div>
```

**Checkbox:**
```html
<label class="checkbox checked">
  <div class="checkbox-box">
    <i data-lucide="check"></i>
  </div>
  <span>Label text</span>
</label>
```

**Toggle Switch:**
```html
<div class="toggle active">
  <div class="toggle-knob"></div>
</div>
```

**Color Swatches:**
```html
<div class="color-swatches">
  <div class="color-swatch selected" style="background: #2870ed;"></div>
  <div class="color-swatch" style="background: #eb4c79;"></div>
</div>
```

**Spinner:**
```html
<div class="spinner"></div>
<div class="spinner spinner-sm"></div>
<div class="spinner spinner-lg"></div>
```

**Toast/Notification:**
```html
<div class="toast visible success">
  <i data-lucide="check-circle" class="toast-icon"></i>
  <div class="toast-content">
    <div class="toast-title">Success</div>
    <div class="toast-message">Changes saved</div>
  </div>
  <button class="toast-close"><i data-lucide="x"></i></button>
</div>
```

**Progress Bar:**
```html
<div class="progress">
  <div class="progress-bar" style="width: 60%"></div>
</div>
```

**Avatar:**
```html
<div class="avatar">BR</div>
<div class="avatar sm">BR</div>
<div class="avatar lg">BR</div>
```

**Breadcrumbs:**
```html
<div class="breadcrumbs">
  <span class="breadcrumb-item">Home</span>
  <span class="breadcrumb-separator">/</span>
  <span class="breadcrumb-item active">Messages</span>
</div>
```

**Empty State:**
```html
<div class="empty-state">
  <i data-lucide="inbox" class="empty-state-icon"></i>
  <div class="empty-state-title">No messages</div>
  <div class="empty-state-text">Create your first message</div>
  <button class="btn btn-primary">Create</button>
</div>
```

---

## Animations

### Menu Open/Close

```css
/* Panel animation */
.menu-panel {
  transform: scale(0.5);
  opacity: 0;
  transition: transform 500ms cubic-bezier(0.34, 1.56, 0.64, 1),
              opacity 250ms ease;
}
.menu-panel.open {
  transform: scale(1);
  opacity: 1;
}

/* Staggered nav items */
.menu-panel.open .nav-item:nth-child(1) { transition-delay: 50ms; }
.menu-panel.open .nav-item:nth-child(2) { transition-delay: 80ms; }
/* ... incrementing by 30ms */
```

### Dialog Animation (iOS-style)

```css
.dialog-animated {
  opacity: 0;
  transform: scale(0.95) translateY(10px);
  transition: all 250ms cubic-bezier(0.32, 0.72, 0, 1);
}
.dialog-animated.open {
  opacity: 1;
  transform: scale(1) translateY(0);
}
```

### Shake Animation (Invalid Selection)

```css
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-4px); }
  40% { transform: translateX(4px); }
  60% { transform: translateX(-4px); }
  80% { transform: translateX(4px); }
}
.shake { animation: shake 0.4s ease-in-out; }
```

### Card Hover

```css
.message-card:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}
```

---

## Interaction Patterns

### Message Card Selection

1. **Long press** (500ms) enters select mode
2. **Single click** on same-cell cards toggles selection
3. **Single click** on different-cell cards shows shake animation
4. **Deselecting all** exits select mode
5. **Double-click** opens message editor

### Matrix Hover Highlighting

- Hovering a cell highlights the path to headers
- Highlights cells between hovered cell and top/left headers
- Uses `.highlight` class

### Menu Selector Behavior

1. On hover: Selector moves to hovered item
2. On mouse leave: Selector returns to active item
3. On click: Sets new active item, closes menu

---

## Utility Classes

```css
/* Glassmorphism */
.glass {
  background: rgba(255, 255, 255, 0.3);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.3);
}

/* Custom Scrollbar */
.custom-scrollbar::-webkit-scrollbar { width: 6px; }
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 9999px;
}

/* Divider */
.divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.1);
}
```

---

## File Structure

```
src/
├── styles/
│   ├── design-tokens.css      /* CSS variables */
│   ├── index.css              /* Entry point */
│   └── components/
│       ├── menu.css           /* Hamburger + menu panel */
│       ├── toolbar.css        /* Teal toolbar */
│       ├── dialog.css         /* Modal dialogs */
│       ├── matrix.css         /* Grid layout */
│       ├── form-elements.css  /* Inputs, buttons */
│       └── bottom-bar.css     /* Bottom panels */
```

---

## Implementation Checklist

### Phase 1: Core Layout
- [x] Design tokens (CSS variables)
- [x] Hamburger button + Menu panel
- [x] Menu animations (staggered items, selector)
- [x] Bottom bar

### Phase 2: Main Views
- [x] Matrix grid with headers
- [x] Message cards with status colors
- [x] Toolbar with controls
- [x] Tree view
- [x] Sankey view

### Phase 3: Dialogs
- [x] Dialog CSS styles
- [ ] Message Editor component integration
- [ ] Blue Dialog (Matrix State/AI) integration

### Phase 4: Polish
- [x] Login screen (glassmorphism)
- [x] Loading screens
- [ ] Card selection behavior
- [ ] Matrix hover highlighting
- [ ] Responsive breakpoints (<960px)
