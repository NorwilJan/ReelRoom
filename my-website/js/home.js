// ... (rest of the file remains unchanged until openFullView)

function openFullView(category) {
    currentFullView = category;
    const filters = categoryState[category].filters; // ✅ This correctly uses the new filters set by applyFilters()
    
    // Create and display a new modal/container for full view
    const fullViewContainer = document.createElement('div');
    fullViewContainer.id = 'full-view-modal';
    fullViewContainer.className = 'search-modal';
    fullViewContainer.style.display = 'flex';
    document.body.appendChild(fullViewContainer);

    const title = category.replace('-', ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    
    fullViewContainer.innerHTML = `
        <span class="close" onclick="closeFullView()" style="color: red;">&times;</span>
        <h2 style="text-transform: uppercase;">${title}</h2>
        <div class="results" id="${category}-full-list"></div>
    `;

    // Reset pagination and clear previous content *before* loading new
    categoryState[category].page = 0; 
    document.getElementById(`${category}-full-list`).innerHTML = ''; // Clear existing images
    
    // 💡 Pass the filters explicitly to loadMoreFullView for the first load
    loadMoreFullView(category, filters);
    
    const listContainer = document.getElementById(`${category}-full-list`);
    listContainer.onscroll = function () {
        // Save the scroll position whenever the user scrolls
        scrollPosition = listContainer.scrollTop; 
        
        if (
            !categoryState[category].isLoading &&
            listContainer.scrollTop + listContainer.clientHeight >= listContainer.scrollHeight - 50
        ) {
            // 💡 Pass the current category's filters for subsequent loads
            loadMoreFullView(category, categoryState[category].filters);
        }
    };
}

// ... (rest of the file remains unchanged until loadMoreFullView)

async function loadMoreFullView(category, filters) {
  const state = categoryState[category];
  const containerId = `${category}-full-list`;
  const container = document.getElementById(containerId); 

  if (state.isLoading) return;

  state.isLoading = true;
  
  showLoading(containerId);
  
  state.page++; 
  let currentPage = state.page;

  try {
    // 🔑 Key Change: Use the 'filters' argument, which contains the newly applied filter set.
    const data = await fetchCategoryContent(category, currentPage, filters);

    const items = data.results || [];
    
    // Check for end of content
    if (items.length === 0) {
        if (currentPage > 1) { 
            state.page--; // Decrement if we tried to scroll past the last page
        }
        console.log(`${category} reached end of available content or found no content matching filter.`);
        
        document.getElementById(containerId)?.querySelector('.loading')?.remove();
        state.isLoading = false;
        
        // Show a "no results" message only if no items were ever loaded into the container.
        if (container.children.length === 0) {
            container.innerHTML = '<p style="color: #ccc; text-align: center; width: 100%;">No content matches your active filter in the full view.</p>';
        }
        
        return;
    }
    
    displayFullList(items, containerId);

  } catch (error) {
    console.error(`Error loading more for ${category}:`, error);
    showError(`Failed to load more ${category}.`, containerId);
    state.page--; // Decrement page on fetch error
  } finally {
    state.isLoading = false;
    document.getElementById(containerId)?.querySelector('.loading')?.remove();
    
    // Restore scroll position after content loads (only needed for the first load)
    if (currentPage === 1 && scrollPosition > 0) {
        container.scrollTop = scrollPosition;
    }
  }
}

// ... (rest of the file remains unchanged)
