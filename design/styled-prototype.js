/**
 * Messaging Matrix - Styled Prototype
 * Interactive behaviors and UI functionality
 */

// Initialize Lucide icons
document.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();
  initMenu();
  initToolbar();
  initViewModes();
  initDropdowns();
  initDialog();
  initMatrixGrid();
  initFormControls();
  initKeyboardShortcuts();

  // Open toolbar by default for demo
  setTimeout(() => {
    toggleToolbar();
  }, 500);
});


/* ============================================================================
   MENU SYSTEM
   ============================================================================ */

let hamburgerBtn, menuPanel, menuOverlay, menuSelector, menuContent, allNavItems;
let activeIndex = 1; // Default to Creative Library (index 1)

// Position the selector behind a nav item
function positionSelector(item) {
  if (item && menuContent && menuSelector) {
    const itemRect = item.getBoundingClientRect();
    const contentRect = menuContent.getBoundingClientRect();
    const offsetTop = itemRect.top - contentRect.top;
    menuSelector.style.transform = `translateY(${offsetTop}px)`;
  }
}

// Initialize selector position after menu opens
function initSelector() {
  if (!menuSelector) return;
  // Hide selector initially
  menuSelector.classList.remove('visible');
  // Wait for scale animation to fully complete (500ms bounce)
  setTimeout(() => {
    positionSelector(allNavItems[activeIndex]);
    // Show selector after position is set
    menuSelector.classList.add('visible');
  }, 500);
}

function toggleMenu() {
  if (!menuPanel) return;
  const isOpen = menuPanel.classList.contains('open');
  if (isOpen) {
    menuPanel.classList.remove('open');
    menuOverlay.classList.remove('open');
    hamburgerBtn.classList.remove('menu-open');
    // Hide selector when menu closes
    if (menuSelector) menuSelector.classList.remove('visible');
  } else {
    menuPanel.classList.add('open');
    menuOverlay.classList.add('open');
    hamburgerBtn.classList.add('menu-open');
    initSelector();
  }
}

function initMenu() {
  // Get DOM elements
  hamburgerBtn = document.getElementById('hamburgerBtn');
  menuPanel = document.getElementById('menuPanel');
  menuOverlay = document.getElementById('menuOverlay');
  menuSelector = document.getElementById('menuSelector');
  menuContent = document.querySelector('.menu-content');
  allNavItems = menuContent ? menuContent.querySelectorAll('.nav-item') : [];

  if (!hamburgerBtn || !menuPanel) return;

  hamburgerBtn.addEventListener('click', toggleMenu);
  menuOverlay.addEventListener('click', toggleMenu);

  // Hover events for selector animation
  allNavItems.forEach((item, index) => {
    item.addEventListener('mouseenter', () => {
      if (menuSelector) {
        menuSelector.classList.add('visible');
        positionSelector(item);
      }
    });

    item.addEventListener('mouseleave', () => {
      // Return to active item
      positionSelector(allNavItems[activeIndex]);
    });

    item.addEventListener('click', () => {
      allNavItems.forEach(i => i.classList.remove('active'));
      if (!item.classList.contains('logout') && !item.classList.contains('profile-item')) {
        item.classList.add('active');
        activeIndex = index;
      }
      setTimeout(toggleMenu, 150);
    });
  });
}


/* ============================================================================
   TOOLBAR
   ============================================================================ */

let toolbarOpen = false;

function initToolbar() {
  // Toolbar initialization if needed
}

function toggleToolbar() {
  toolbarOpen = !toolbarOpen;
  document.getElementById('toolbar').classList.toggle('open', toolbarOpen);
}


/* ============================================================================
   VIEW MODES (with toggling pairs)
   ============================================================================ */

function initViewModes() {
  const viewModes = document.getElementById('viewModes');
  if (!viewModes) return;

  const displayToggles = viewModes.querySelectorAll('.display-toggle');
  const treeToggles = viewModes.querySelectorAll('.tree-toggle');
  const sankeyToggles = viewModes.querySelectorAll('.sankey-toggle');
  const viewBtns = viewModes.querySelectorAll('.view-mode-btn:not(.display-toggle):not(.tree-toggle):not(.sankey-toggle)');
  const sliderGroup = document.querySelector('.slider-group');

  // Show sliders only for tree and sankey views
  function updateSliderVisibility() {
    const treeActive = Array.from(treeToggles).some(btn => btn.classList.contains('active'));
    const sankeyActive = Array.from(sankeyToggles).some(btn => btn.classList.contains('active'));
    if (sliderGroup) {
      sliderGroup.style.display = (treeActive || sankeyActive) ? 'flex' : 'none';
    }
  }

  // Helper to deselect all
  function deselectAllViews() {
    displayToggles.forEach(b => b.classList.remove('active'));
    treeToggles.forEach(b => b.classList.remove('active'));
    sankeyToggles.forEach(b => b.classList.remove('active'));
    viewBtns.forEach(b => b.classList.remove('active'));
  }

  // Display toggle (informative/minimal) - swap only when already active
  displayToggles.forEach(btn => {
    btn.addEventListener('click', () => {
      const isActive = btn.classList.contains('active');
      if (isActive) {
        // Swap to other variant
        displayToggles.forEach(toggle => {
          if (toggle.style.display === 'none') {
            toggle.style.display = 'flex';
            toggle.classList.add('active');
          } else {
            toggle.style.display = 'none';
            toggle.classList.remove('active');
          }
        });
        lucide.createIcons();
      } else {
        // Just select this view
        deselectAllViews();
        btn.classList.add('active');
      }
      updateSliderVisibility();
    });
  });

  // Tree toggle (vertical/horizontal) - swap only when already active
  treeToggles.forEach(btn => {
    btn.addEventListener('click', () => {
      const isActive = btn.classList.contains('active');
      if (isActive) {
        // Swap to other variant
        treeToggles.forEach(toggle => {
          if (toggle.style.display === 'none') {
            toggle.style.display = 'flex';
            toggle.classList.add('active');
          } else {
            toggle.style.display = 'none';
            toggle.classList.remove('active');
          }
        });
        lucide.createIcons();
      } else {
        // Just select this view
        deselectAllViews();
        btn.classList.add('active');
      }
      updateSliderVisibility();
    });
  });

  // Sankey toggle (sankey/circular) - swap only when already active
  sankeyToggles.forEach(btn => {
    btn.addEventListener('click', () => {
      const isActive = btn.classList.contains('active');
      if (isActive) {
        // Swap to other variant
        sankeyToggles.forEach(toggle => {
          if (toggle.style.display === 'none') {
            toggle.style.display = 'flex';
            toggle.classList.add('active');
          } else {
            toggle.style.display = 'none';
            toggle.classList.remove('active');
          }
        });
        lucide.createIcons();
      } else {
        // Just select this view
        deselectAllViews();
        btn.classList.add('active');
      }
      updateSliderVisibility();
    });
  });

  // Other view mode buttons (e.g., Feed view)
  viewBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      deselectAllViews();
      btn.classList.add('active');
      updateSliderVisibility();
    });
  });

  // Initialize slider visibility
  updateSliderVisibility();
}


/* ============================================================================
   DROPDOWNS
   ============================================================================ */

function initDropdowns() {
  // Close dropdowns when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.filter-dropdown')) {
      document.querySelectorAll('.filter-dropdown-menu').forEach(d => d.style.display = 'none');
    }
  });
}

function toggleDropdown(id) {
  const dropdown = document.getElementById(id);
  const isVisible = dropdown.style.display !== 'none';

  // Close all dropdowns
  document.querySelectorAll('.filter-dropdown-menu').forEach(d => d.style.display = 'none');

  // Toggle this one
  if (!isVisible) {
    dropdown.style.display = 'block';
  }
}


/* ============================================================================
   DIALOG
   ============================================================================ */

function initDialog() {
  // Dialog tabs
  document.querySelectorAll('.dialog-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.dialog-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
    });
  });
}

function openDialog() {
  document.getElementById('dialogOverlay').classList.add('open');
}

function closeDialog() {
  document.getElementById('dialogOverlay').classList.remove('open');
}


/* ============================================================================
   MATRIX GRID
   ============================================================================ */

function initMatrixGrid() {
  // Message card selection
  document.querySelectorAll('.message-card').forEach(card => {
    card.addEventListener('click', () => {
      // Toggle selection
      card.classList.toggle('selected');
    });
  });

  // Matrix cell hover - highlight path to headers
  const matrixGrid = document.querySelector('.matrix-grid');
  if (matrixGrid) {
    const cells = matrixGrid.querySelectorAll('.matrix-cell-content');
    const audienceHeaders = matrixGrid.querySelectorAll('.matrix-audience-header');
    const topicHeaders = matrixGrid.querySelectorAll('.matrix-topic-header');
    const gridColumns = 3; // corner + 2 audiences

    cells.forEach((cell, index) => {
      cell.addEventListener('mouseenter', () => {
        // Calculate row and column
        const cellsPerRow = gridColumns - 1; // 2 cells per row (excluding topic header)
        const rowIndex = Math.floor(index / cellsPerRow);
        const colIndex = index % cellsPerRow;

        // Highlight the audience header for this column
        if (audienceHeaders[colIndex]) {
          audienceHeaders[colIndex].classList.add('highlight');
        }

        // Highlight the topic header for this row
        if (topicHeaders[rowIndex]) {
          topicHeaders[rowIndex].classList.add('highlight');
        }

        // Highlight cells between hovered cell and headers (left in row, above in column)
        cells.forEach((otherCell, otherIndex) => {
          const otherRow = Math.floor(otherIndex / cellsPerRow);
          const otherCol = otherIndex % cellsPerRow;
          // Same row, to the left (smaller column index)
          if (otherRow === rowIndex && otherCol < colIndex) {
            otherCell.classList.add('highlight');
          }
          // Same column, above (smaller row index)
          if (otherCol === colIndex && otherRow < rowIndex) {
            otherCell.classList.add('highlight');
          }
        });
      });

      cell.addEventListener('mouseleave', () => {
        // Remove all highlights
        audienceHeaders.forEach(h => h.classList.remove('highlight'));
        topicHeaders.forEach(h => h.classList.remove('highlight'));
        cells.forEach(c => c.classList.remove('highlight'));
      });
    });
  }
}


/* ============================================================================
   FORM CONTROLS
   ============================================================================ */

function initFormControls() {
  // Toggle switch
  document.querySelectorAll('.toggle-track').forEach(track => {
    track.addEventListener('click', () => {
      track.classList.toggle('active');
    });
  });
}


/* ============================================================================
   KEYBOARD SHORTCUTS
   ============================================================================ */

function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Press 'd' to open dialog
    if (e.key === 'd' && !e.target.matches('input, textarea')) {
      openDialog();
    }
    // Press Escape to close dialog/menu
    if (e.key === 'Escape') {
      closeDialog();
      if (menuPanel && menuPanel.classList.contains('open')) toggleMenu();
    }
  });
}
