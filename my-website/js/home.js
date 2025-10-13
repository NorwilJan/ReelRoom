// js/home.js

// ... (Existing variables remain unchanged) ...

// NEW: Constants for Local Storage keys
const FAVORITES_KEY = 'reelroom_favorites';
const RECENTLY_VIEWED_KEY = 'reelroom_recent';
const MAX_RECENT = 15; // Limit to 15 recent items
const MAX_FAVORITES = 30; // Limit to 30 favorites

// --- NEW: Local Storage Management Functions ---

/**
 * Loads the array from local storage, or returns an empty array.
 * @param {string} key The localStorage key.
 */
function loadStorageList(key) {
  try {
    const json = localStorage.getItem(key);
    return json ? JSON.parse(json) : [];
  } catch (e) {
    console.error(`Error loading storage list for key: ${key}`, e);
    return [];
  }
}

/**
 * Saves the array to local storage.
 * @param {string} key The localStorage key.
 * @param {Array} list The array to save.
 */
function saveStorageList(key, list) {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch (e) {
    console.error(`Error saving storage list for key: ${key}`, e);
  }
}

/**
 * Adds an item to the Recently Viewed list.
 */
function addToRecentlyViewed(item) {
  // Ensure we save minimal data for efficiency
  const itemData = {
    id: item.id,
    title: item.title || item.name,
    poster_path: item.poster_path,
    media_type: item.media_type || (item.title ? 'movie' : 'tv')
  };
  
  let recentList = loadStorageList(RECENTLY_VIEWED_KEY);
  
  // Remove the existing item if it's already in the list
  recentList = recentList.filter(i => i.id !== itemData.id);
  
  // Add the new item to the start
  recentList.unshift(itemData);
  
  // Trim the list to the max size
  recentList = recentList.slice(0, MAX_RECENT);
  
  saveStorageList(RECENTLY_VIEWED_KEY, recentList);
  displayRecentlyViewed();
}

/**
 * Toggles an item in the Favorites list.
 */
function toggleFavorite(item) {
  const itemData = {
    id: item.id,
    title: item.title || item.name,
    poster_path: item.poster_path,
    media_type: item.media_type || (item.title ? 'movie' : 'tv')
  };

  let favoritesList = loadStorageList(FAVORITES_KEY);
  const isFavorite = favoritesList.some(i => i.id === itemData.id);
  
  if (isFavorite) {
    // Remove from favorites
    favoritesList = favoritesList.filter(i => i.id !== itemData.id);
  } else {
    // Add to favorites (at the beginning)
    favoritesList.unshift(itemData);
    favoritesList = favoritesList.slice(0, MAX_FAVORITES); // Trim just in case
  }
  
  saveStorageList(FAVORITES_KEY, favoritesList);
  
  // Update the heart icon and the display lists
  document.getElementById('favorite-toggle').classList.toggle('active', !isFavorite);
  displayFavorites();
}

/**
 * Renders the Favorites list.
 */
function displayFavorites() {
    const favorites = loadStorageList(FAVORITES_KEY);
    const container = document.getElementById('favorites-list');
    const countSpan = document.getElementById('favorites-count');
    container.innerHTML = '';
    
    countSpan.textContent = `(${favorites.length})`;
    
    if (favorites.length === 0) {
        container.innerHTML = '<p style="color: #ccc; padding: 10px; width: 100%;">Add movies or shows to your favorites by clicking the heart icon in the details window.</p>';
        return;
    }
    
    favorites.forEach(item => {
        const img = document.createElement('img');
        img.src = item.poster_path ? `${IMG_URL}${item.poster_path}` : FALLBACK_IMAGE;
        img.alt = item.title || item.name || 'Unknown';
        img.setAttribute('data-id', item.id);
        // Note: The item saved in storage is a minimal version. We pass it 
        // to showDetails, which treats it like a search result object.
        img.onclick = () => showDetails(item); 
        container.appendChild(img);
    });
}

/**
 * Renders the Recently Viewed list.
 */
function displayRecentlyViewed() {
    const recent = loadStorageList(RECENTLY_VIEWED_KEY);
    const container = document.getElementById('recently-viewed-list');
    container.innerHTML = '';
    
    if (recent.length === 0) {
        container.innerHTML = '<p style="color: #ccc; padding: 10px; width: 100%;">Your recently viewed items will appear here.</p>';
        return;
    }
    
    recent.forEach(item => {
        const img = document.createElement('img');
        img.src = item.poster_path ? `${IMG_URL}${item.poster_path}` : FALLBACK_IMAGE;
        img.alt = item.title || item.name || 'Unknown';
        img.setAttribute('data-id', item.id);
        img.onclick = () => showDetails(item);
        container.appendChild(img);
    });
}


// --- MODIFIED: showDetails and init functions ---

/**
 * Modified showDetails to handle favorites tracking and modal setup.
 */
async function showDetails(item, isFullViewOpen = false) {
  // NEW: Add item to recently viewed list
  addToRecentlyViewed(item);

  currentItem = item;
  currentSeason = 1;
  currentEpisode = 1;
  
  // Use a separate span for the title so the heart icon can sit next to it
  document.getElementById('modal-item-title').textContent = item.title || item.name || 'Unknown';
  document.getElementById('modal-description').textContent = item.overview || 'No description available.';
  document.getElementById('modal-image').src = item.poster_path ? `${IMG_URL}${item.poster_path}` : FALLBACK_IMAGE;
  document.getElementById('modal-rating').innerHTML = '★'.repeat(Math.round((item.vote_average || 0) / 2));
  document.getElementById('server').value = 'player.videasy.net'; 

  // NEW: Set up the Favorite Toggle
  const favoritesList = loadStorageList(FAVORITES_KEY);
  const isFavorite = favoritesList.some(i => i.id === item.id);
  const favoriteToggle = document.getElementById('favorite-toggle');
  
  // Check if item is currently in favorites and set the heart icon state
  favoriteToggle.classList.toggle('active', isFavorite);
  
  // Remove old listeners before adding the new one to prevent duplication
  favoriteToggle.onclick = null; 
  favoriteToggle.onclick = () => toggleFavorite(item);


  const seasonSelector = document.getElementById('season-selector');
  const episodeList = document.getElementById('episode-list');
  // Determine media type based on existence of name/title and API data
  const isTVShow = item.media_type === 'tv' || (item.name && !item.title);

  // ... (Rest of the TV show/episode loading logic remains unchanged) ...
  if (isTVShow) {
    seasonSelector.style.display = 'block';
    const seasons = await fetchSeasonsAndEpisodes(item.id);
    const seasonSelect = document.getElementById('season');
    seasonSelect.innerHTML = '';
    
    seasons.filter(s => s.season_number > 0).forEach(season => {
      const option = document.createElement('option');
      option.value = season.season_number;
      option.textContent = `Season ${season.season_number}`;
      seasonSelect.appendChild(option);
    });
    
    currentSeason = seasons.find(s => s.season_number > 0)?.season_number || 1;
    seasonSelect.value = currentSeason;
    
    await loadEpisodes();
  } else {
    seasonSelector.style.display = 'none';
    episodeList.innerHTML = '';
  }

  changeServer();
  document.getElementById('modal').style.display = 'flex';
  
  if (isFullViewOpen) {
      document.getElementById('full-view-modal').style.display = 'none';
  }
}

/**
 * Modified init function to load the new lists on startup.
 */
async function init() {
  document.getElementById('empty-message').style.display = 'none';
  
  const apiKeyValid = await testApiKey();
  if (!apiKeyValid) {
      return;
  }
  
  // NEW: Load and display the user lists before fetching TMDB content
  displayFavorites();
  displayRecentlyViewed();
  
  populateFilterOptions(); 

  // ... (Rest of the existing init function remains unchanged) ...

  // ... (TMDB fetching and list display logic) ...
}

// init() call remains at the end
init();
