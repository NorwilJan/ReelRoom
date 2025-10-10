async function loadMoreFullView(category, filters) {
  const state = categoryState[category];
  const containerId = `${category}-full-list`;
  const container = document.getElementById(containerId); // Get container reference here

  if (state.isLoading) return;

  state.isLoading = true;
  
  showLoading(containerId);
  
  state.page++; 
  let currentPage = state.page;

  try {
    const data = await fetchCategoryContent(category, currentPage, filters);

    const items = data.results || [];
    
    // FIX APPLIED HERE
    if (items.length === 0) {
        if (currentPage > 1) { 
            state.page--; // Only prevent moving to next page if we were already past page 1
        }
        console.log(`${category} reached end of available content or found no content matching filter.`);
        
        // Remove loading spinner
        document.getElementById(containerId)?.querySelector('.loading')?.remove();
        state.isLoading = false;
        
        // If no results were ever loaded (i.e., page 1 was empty), show a message
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
  }
}
