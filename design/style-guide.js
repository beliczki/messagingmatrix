/**
 * Messaging Matrix - Style Guide
 * Interactive behaviors and UI functionality
 */

// Initialize Lucide icons
lucide.createIcons();

const hamburgerBtn = document.getElementById('hamburgerBtn');
const menuPanel = document.getElementById('menuPanel');
const menuOverlay = document.getElementById('menuOverlay');
const menuSelector = document.getElementById('menuSelector');
const menuContent = document.querySelector('.menu-content');

// Get all nav items from entire menu
const allNavItems = menuContent.querySelectorAll('.nav-item');
let activeIndex = 1; // Default to Creative Library (index 1)

// Position the selector behind a nav item
function positionSelector(item) {
  if (item) {
    const itemRect = item.getBoundingClientRect();
    const contentRect = menuContent.getBoundingClientRect();
    const offsetTop = itemRect.top - contentRect.top;
    menuSelector.style.transform = `translateY(${offsetTop}px)`;
  }
}

// Initialize selector position after menu opens
function initSelector() {
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
  const isOpen = menuPanel.classList.contains('open');
  if (isOpen) {
    menuPanel.classList.remove('open');
    menuOverlay.classList.remove('open');
    hamburgerBtn.classList.remove('menu-open');
    // Hide selector when menu closes
    menuSelector.classList.remove('visible');
  } else {
    menuPanel.classList.add('open');
    menuOverlay.classList.add('open');
    hamburgerBtn.classList.add('menu-open');
    initSelector();
  }
}

hamburgerBtn.addEventListener('click', toggleMenu);
menuOverlay.addEventListener('click', toggleMenu);

// Hover events for selector animation
allNavItems.forEach((item, index) => {
  item.addEventListener('mouseenter', () => {
    menuSelector.classList.add('visible');
    positionSelector(item);
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

// Dialog Toggle - message editor dialog (opened by double-clicking message cards)
const dialog = document.getElementById('dialog');
const dialogOverlay = document.getElementById('dialogOverlay');
const bottomPanels = document.querySelectorAll('.bottom-panel');
let dialogVisible = false;

function toggleDialog() {
  dialogVisible = !dialogVisible;
  if (dialogVisible) {
    dialog.classList.add('open');
    dialogOverlay.classList.add('open');
    lucide.createIcons();
  } else {
    dialog.classList.remove('open');
    dialogOverlay.classList.remove('open');
  }
}

// Blue Dialog Toggle - opened by clicking bottom panels (Matrix State / AI Assistant)
const blueDialog = document.getElementById('blueDialog');
let blueDialogVisible = false;

function toggleBlueDialog() {
  blueDialogVisible = !blueDialogVisible;
  if (blueDialogVisible) {
    blueDialog.classList.add('open');
    dialogOverlay.classList.add('open');
  } else {
    blueDialog.classList.remove('open');
    dialogOverlay.classList.remove('open');
  }
}

// Overlay blocks clicks but doesn't close dialog
dialogOverlay.addEventListener('click', (e) => {
  e.stopPropagation();
});

// Bottom panels open blue dialog
bottomPanels.forEach(panel => {
  panel.style.cursor = 'pointer';
  panel.addEventListener('click', toggleBlueDialog);
});

// Prevent dialog toggle when clicking Reload/Save buttons
document.querySelectorAll('.bottom-panel-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
  });
});

// Close dialog with Cancel or Save & Close buttons
document.querySelectorAll('.dialog-actions .btn').forEach(btn => {
  if (btn.textContent.includes('Cancel') || btn.textContent.includes('Save & close')) {
    btn.addEventListener('click', () => {
      if (dialogVisible) {
        toggleDialog();
      }
    });
  }
});

// Toolbar Toggle
const toolbar = document.getElementById('toolbar');
const toolbarToggle = document.getElementById('toolbarToggle');
const toolbarDrag = document.querySelector('.toolbar-drag-row');

function toggleToolbar() {
  const isOpen = toolbar.classList.contains('open');
  if (isOpen) {
    toolbar.classList.remove('open');
  } else {
    toolbar.classList.add('open');
    lucide.createIcons();
  }
}

toolbarToggle.addEventListener('click', toggleToolbar);

// Toolbar Dragging
let isDragging = false;
let dragStartX, dragStartY;
let toolbarStartRight, toolbarStartY;

toolbarDrag.addEventListener('mousedown', (e) => {
  isDragging = true;
  dragStartX = e.clientX;
  dragStartY = e.clientY;

  const rect = toolbar.getBoundingClientRect();
  // Calculate right position from viewport
  toolbarStartRight = window.innerWidth - rect.right;
  toolbarStartY = rect.top;

  toolbarDrag.style.cursor = 'grabbing';
  toolbarDrag.style.opacity = '1';
  e.preventDefault();
});

document.addEventListener('mousemove', (e) => {
  if (!isDragging) return;

  const deltaX = e.clientX - dragStartX;
  const deltaY = e.clientY - dragStartY;

  const toolbarRect = toolbar.getBoundingClientRect();
  const toolbarWidth = toolbarRect.width;
  const toolbarHeight = toolbarRect.height;

  // Calculate new positions
  let newRight = toolbarStartRight - deltaX;
  let newY = toolbarStartY + deltaY;

  // Constrain to viewport based on dragger position
  // Minimum right = 0 (toolbar right edge at viewport right)
  // Maximum right = viewport width - toolbar width (toolbar left edge at viewport left)
  const minRight = 0;
  const maxRight = window.innerWidth - toolbarWidth;
  newRight = Math.max(minRight, Math.min(maxRight, newRight));

  // Constrain vertical position
  const minY = 0;
  const maxY = window.innerHeight - toolbarHeight;
  newY = Math.max(minY, Math.min(maxY, newY));

  toolbar.style.right = newRight + 'px';
  toolbar.style.top = newY + 'px';
  toolbar.style.left = 'auto';
});

document.addEventListener('mouseup', () => {
  if (isDragging) {
    isDragging = false;
    toolbarDrag.style.cursor = 'grab';
    toolbarDrag.style.opacity = '0.4';
  }
});

// View Mode Selector
const viewModes = document.querySelector('.view-modes');
const displayToggles = viewModes.querySelectorAll('.display-toggle');
const treeToggles = viewModes.querySelectorAll('.tree-toggle');
const sankeyToggles = viewModes.querySelectorAll('.sankey-toggle');
const viewBtns = viewModes.querySelectorAll('.view-mode-btn:not(.display-toggle):not(.tree-toggle):not(.sankey-toggle)');
const sliderGroup = document.getElementById('sliderGroup');

// Show sliders only for tree and sankey views
function updateSliderVisibility() {
  const treeActive = Array.from(treeToggles).some(btn => btn.classList.contains('active'));
  const sankeyActive = Array.from(sankeyToggles).some(btn => btn.classList.contains('active'));
  sliderGroup.style.display = (treeActive || sankeyActive) ? 'flex' : 'none';
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

// Interactive checkboxes
document.querySelectorAll('.checkbox').forEach(checkbox => {
  checkbox.addEventListener('click', () => {
    checkbox.classList.toggle('checked');
  });
});

// Skip animation button toggle
document.querySelectorAll('.skip-animation-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    btn.classList.toggle('checked');
  });
});

// Dialog toggle (Auto-Save) button
document.querySelectorAll('.dialog-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    btn.classList.toggle('checked');
  });
});

// Interactive toggles
document.querySelectorAll('.toggle').forEach(toggle => {
  toggle.addEventListener('click', () => {
    toggle.classList.toggle('active');
  });
});

// Interactive tabs (horizontal)
document.querySelectorAll('.tabs').forEach(tabGroup => {
  const tabs = tabGroup.querySelectorAll('.tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
    });
  });
});

// Interactive dialog tabs (vertical sidebar)
document.querySelectorAll('.dialog-tabs').forEach(tabGroup => {
  const tabs = tabGroup.querySelectorAll('.dialog-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
    });
  });
});

// Interactive tags (single select)
document.querySelectorAll('.tags').forEach(tagGroup => {
  const tags = tagGroup.querySelectorAll('.tag');
  tags.forEach(tag => {
    tag.addEventListener('click', () => {
      tags.forEach(t => t.classList.remove('active'));
      tag.classList.add('active');
    });
  });
});

// Tags input (multi-select toggle)
document.querySelectorAll('.tags-input').forEach(tagInput => {
  const tags = tagInput.querySelectorAll('.tag');
  const valueDisplay = tagInput.parentElement.querySelector('.tags-input-value span');

  const updateValue = () => {
    const selectedTags = tagInput.querySelectorAll('.tag.active');
    const values = Array.from(selectedTags).map(t => t.textContent).join(' ');
    if (valueDisplay) {
      valueDisplay.textContent = values || '(none)';
    }
  };

  tags.forEach(tag => {
    tag.addEventListener('click', () => {
      tag.classList.toggle('active');
      updateValue();
    });
  });
});

// Interactive color swatches
document.querySelectorAll('.color-swatches').forEach(swatchGroup => {
  const swatches = swatchGroup.querySelectorAll('.color-swatch');
  swatches.forEach(swatch => {
    swatch.addEventListener('click', () => {
      swatches.forEach(s => s.classList.remove('selected'));
      swatch.classList.add('selected');
    });
  });
});

// Dropdown functionality (Size selector and others)
document.querySelectorAll('.dropdown').forEach(dropdown => {
  const trigger = dropdown.querySelector('.dropdown-trigger');
  const menu = dropdown.querySelector('.dropdown-menu');
  const items = dropdown.querySelectorAll('.dropdown-item');
  const triggerText = trigger.querySelector('span');

  // Toggle dropdown on trigger click
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    // Close all other dropdowns first
    document.querySelectorAll('.dropdown.open').forEach(d => {
      if (d !== dropdown) d.classList.remove('open');
    });
    dropdown.classList.toggle('open');
  });

  // Handle item selection
  items.forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      // Update selected state
      items.forEach(i => i.classList.remove('selected'));
      item.classList.add('selected');
      // Update trigger text
      if (triggerText) {
        triggerText.textContent = item.textContent;
      }
      // Close dropdown
      dropdown.classList.remove('open');

      // Handle size dropdown specific logic
      if (dropdown.id === 'sizeDropdown') {
        const dialogLayout = document.querySelector('.dialog-layout');
        const previewImg = document.querySelector('.preview-frame img');
        const isWide = item.dataset.wide === 'true';
        const imageSrc = item.dataset.image;

        // Toggle wide layout
        if (isWide) {
          dialogLayout.classList.add('wide-layout');
        } else {
          dialogLayout.classList.remove('wide-layout');
        }

        // Update preview image
        if (previewImg && imageSrc) {
          previewImg.src = imageSrc;
        }
      }
    });
  });
});

// Close dropdowns when clicking outside
document.addEventListener('click', () => {
  document.querySelectorAll('.dropdown.open').forEach(dropdown => {
    dropdown.classList.remove('open');
  });
});

// Global/Local toggle
document.querySelectorAll('.global-local-toggle').forEach(toggle => {
  toggle.addEventListener('click', () => {
    const span = toggle.querySelector('span');
    const currentState = toggle.dataset.state;
    if (currentState === 'global') {
      toggle.dataset.state = 'local';
      span.textContent = 'Local';
    } else {
      toggle.dataset.state = 'global';
      span.textContent = 'Global';
    }
  });
});

// Add text formatting - creates new input row
document.querySelectorAll('.link-button').forEach(btn => {
  if (btn.textContent.includes('add text formatting')) {
    btn.addEventListener('click', () => {
      const formGroup = btn.closest('.form-group');
      const input = formGroup.querySelector('.form-input');
      const inputValue = input ? input.value : '';

      // Create new row
      const newRow = document.createElement('div');
      newRow.className = 'form-group';
      newRow.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <input type="text" class="form-input" value="${inputValue}" style="flex: 1;">
          <div class="dropdown">
            <button class="dropdown-trigger">
              <span>All sizes</span>
              <i data-lucide="chevron-down" style="width: 16px; height: 16px;"></i>
            </button>
            <div class="dropdown-menu">
              <div class="dropdown-item selected" data-value="all">All sizes</div>
              <div class="dropdown-item" data-value="300x600">300x600</div>
              <div class="dropdown-item" data-value="970x250">970x250</div>
              <div class="dropdown-item" data-value="300x250">300x250</div>
            </div>
          </div>
          <button class="global-local-toggle dropdown-trigger" data-state="global">
            <span>Global</span>
          </button>
          <button class="row-delete-btn" title="Remove line"><i data-lucide="trash-2" style="width: 16px; height: 16px;"></i></button>
        </div>
      `;

      // Insert after current form group
      formGroup.after(newRow);

      // Reinitialize icons and event listeners
      lucide.createIcons();

      // Add dropdown functionality to new dropdown
      const newDropdown = newRow.querySelector('.dropdown');
      const trigger = newDropdown.querySelector('.dropdown-trigger');
      const items = newDropdown.querySelectorAll('.dropdown-item');
      const triggerText = trigger.querySelector('span');

      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.dropdown.open').forEach(d => {
          if (d !== newDropdown) d.classList.remove('open');
        });
        newDropdown.classList.toggle('open');
      });

      items.forEach(item => {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          items.forEach(i => i.classList.remove('selected'));
          item.classList.add('selected');
          triggerText.textContent = item.textContent;
          newDropdown.classList.remove('open');
        });
      });

      // Add global/local toggle functionality
      const newToggle = newRow.querySelector('.global-local-toggle');
      newToggle.addEventListener('click', () => {
        const span = newToggle.querySelector('span');
        const currentState = newToggle.dataset.state;
        if (currentState === 'global') {
          newToggle.dataset.state = 'local';
          span.textContent = 'Local';
        } else {
          newToggle.dataset.state = 'global';
          span.textContent = 'Global';
        }
      });

      // Add delete button functionality
      const deleteBtn = newRow.querySelector('.row-delete-btn');
      deleteBtn.addEventListener('click', () => {
        newRow.remove();
      });
    });
  }
});

// Delete button functionality for existing rows
document.querySelectorAll('.row-delete-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const formGroup = btn.closest('.form-group');
    if (formGroup) {
      formGroup.remove();
    }
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

// Open dialog on message card double-click
document.querySelectorAll('.message-card').forEach(card => {
  card.addEventListener('dblclick', () => {
    if (!dialogVisible) {
      toggleDialog();
    }
  });
});

// Long press to select message cards
let longPressTimer = null;
let longPressTriggered = false;
const LONG_PRESS_DURATION = 500;

function isInSelectMode() {
  return document.querySelectorAll('.message-card.selected').length > 0;
}

function getSelectedCell() {
  const selectedCard = document.querySelector('.message-card.selected');
  return selectedCard ? selectedCard.closest('.matrix-cell-content') : null;
}

document.querySelectorAll('.message-card').forEach(card => {
  card.addEventListener('mousedown', (e) => {
    longPressTriggered = false;
    longPressTimer = setTimeout(() => {
      longPressTriggered = true;
      card.classList.toggle('selected');
    }, LONG_PRESS_DURATION);
  });

  card.addEventListener('mouseup', () => {
    clearTimeout(longPressTimer);
  });

  card.addEventListener('mouseleave', () => {
    clearTimeout(longPressTimer);
  });

  // Single click handling for select mode
  card.addEventListener('click', (e) => {
    if (longPressTriggered) {
      longPressTriggered = false;
      return;
    }

    if (isInSelectMode()) {
      e.stopPropagation();
      const selectedCell = getSelectedCell();
      const cardCell = card.closest('.matrix-cell-content');

      if (selectedCell === cardCell) {
        // Same cell - toggle selection
        card.classList.toggle('selected');
      } else {
        // Different cell - shake it
        card.classList.add('shake');
        setTimeout(() => card.classList.remove('shake'), 400);
      }
    }
  });

  // Touch support
  card.addEventListener('touchstart', (e) => {
    longPressTriggered = false;
    longPressTimer = setTimeout(() => {
      longPressTriggered = true;
      card.classList.toggle('selected');
    }, LONG_PRESS_DURATION);
  });

  card.addEventListener('touchend', () => {
    clearTimeout(longPressTimer);
  });

  card.addEventListener('touchmove', () => {
    clearTimeout(longPressTimer);
  });
});
