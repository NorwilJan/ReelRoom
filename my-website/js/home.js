// js/home.js
const API_KEY = '40f1982842db35042e8561b13b38d492'; // Your original TMDB API key - UNCHANGED
const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_URL = 'https://image.tmdb.org/t/p/original';
const FALLBACK_IMAGE = 'https://via.placeholder.com/150x225?text=No+Image';
let currentItem;
let currentSeason = 1;
let currentEpisode = 1;
let slideshowItems = [];
let currentSlide = 0;
let slideshowInterval;

// New: Constants for Local Storage keys
const FAVORITES_KEY = 'reelroom_favorites';
const RECENTLY_VIEWED_KEY = 'reelroom_recent';
const RATINGS_KEY = 'reelroom_ratings';         
const WATCH_PROGRESS_KEY = 'reelroom_progress'; 
const USER_SETTINGS_KEY = 'reelroom_user_settings'; // NEW
const MAX_RECENT = 15; // Limit to 15 recent items
const MAX_FAVORITES = 30; // Limit to 30 favorites

// Replaced simple currentPages/isLoading with a single state object from the 2nd code
let categoryState = {
    movies: { page: 1, isLoading: false, filters: {} },
    tvshows: { page: 1, isLoading: false, filters: {} },
    anime: { page: 1, isLoading: false, filters: {} },
    'tagalog-movies': { page: 1, isLoading: false, filters: {} },
    'netflix-movies': { page: 1, isLoading: false, filters: {} },
    'netflix-tv': { page: 1, isLoading: false, filters: {} },
    'korean-drama': { page: 1, isLoading: false, filters: {} }
};

let currentFullView = null; // Tracks the category currently in the full view
let currentCategoryToFilter = null; // Tracks the category targeted by the filter modal
let scrollPosition = 0; 

// Simplified Genre IDs for the filter dropdown - NEW
const GENRES = [
  { id: 28, name: 'Action' }, { id: 12, name: 'Adventure' }, 
  { id: 35, name: 'Comedy' }, { id: 80, name: 'Crime' }, 
  { id: 18, name: 'Drama' }, { id: 10751, name: 'Family' }, 
  { id: 27, name: 'Horror' }, { id: 878, name: 'Science Fiction' }, 
  { id: 53, name: 'Thriller' }, { id: 10749, name: 'Romance' },
  { id: 16, name: 'Animation' }, { id: 9648, name: 'Mystery' }
];

/**
 * Utility function to debounce another function call.
 * Ensures a function is not called until a certain time has passed after the last call.
 */
function debounce(func, delay) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), delay);
  };
}

/**
 * 🔑 Function to test API Key validity on startup.
 */
async function testApiKey() {
    try {
        const res = await fetch(`${BASE_URL}/movie/popular?api_key=${API_KEY}&page=1`);
        if (res.status === 401) {
            throw new Error("TMDB API Key is invalid. Please check your key.");
        }
        if (!res.ok) {
            throw new Error(`TMDB API request failed with status: ${res.status}`);
        }
        return true;
    } catch (error) {
        console.error("API Key Test Failed:", error.message);
        const errorMessage = `
            ❌ **Initialization Failed** ❌
            Reason: ${error.message}
            
            Action Required: Check your '${API_KEY}' key on TMDB.
        `;
        showError(errorMessage, 'empty-message');
        document.getElementById('empty-message').style.display = 'block';
        return false;
    }
}

// --- CORE FETCH FUNCTION (Handles all categories and filters) ---

async function fetchCategoryContent(category, page, filters = {}) {
    try {
        // Base parameters now include a default sort for safety, but can be overridden
        let baseParams = `&page=${page}&include_adult=false&include_video=false`; 
        
        // NEW: Check for sort_by parameter, default to popularity.desc
        const sortBy = filters.sort_by || 'popularity.desc';
        baseParams += `&sort_by=${sortBy}`;
        
        // Correctly apply year and genre filters
        const filterParams = `${filters.year ? `&primary_release_year=${filters.year}` : ''}${filters.genre ? `&with_genres=${filters.genre}` : ''}`;
        let fetchURL = '';
        let mediaType = category.includes('movie') ? 'movie' : 'tv';

        if (category === 'movies') {
            fetchURL = `${BASE_URL}/discover/movie?api_key=${API_KEY}${baseParams}${filterParams}`;
        } else if (category === 'tvshows') {
            fetchURL = `${BASE_URL}/discover/tv?api_key=${API_KEY}${baseParams}${filterParams}`;
        } else if (category === 'anime') {
            // Anime base filters: genre 16 and Japanese language, augmented by user filters
            fetchURL = `${BASE_URL}/discover/tv?api_key=${API_KEY}&with_genres=16&with_original_language=ja${baseParams}${filterParams}`;
        } else if (category === 'tagalog-movies') {
            fetchURL = `${BASE_URL}/discover/movie?api_key=${API_KEY}&with_original_language=tl${baseParams}${filterParams}`;
        } else if (category === 'netflix-movies') {
            fetchURL = `${BASE_URL}/discover/movie?api_key=${API_KEY}&with_watch_providers=8&watch_region=US${baseParams}${filterParams}`;
        } else if (category === 'netflix-tv') {
            fetchURL = `${BASE_URL}/discover/tv?api_key=${API_KEY}&with_watch_providers=8&watch_region=US${baseParams}${filterParams}`;
        } else if (category === 'korean-drama') {
            // KDrama base filters: Korean language and Drama genre 18, augmented by user filters
            fetchURL = `${BASE_URL}/discover/tv?api_key=${API_KEY}&with_original_language=ko&with_genres=18${baseParams}${filterParams}`;
        } else {
            throw new Error('Unknown category.');
        }

        const res = await fetch(fetchURL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        
        // Ensure media_type is set for Discover results
        if (data.results) {
            data.results.forEach(item => item.media_type = item.media_type || mediaType);
        }
        return data;
    } catch (error) {
        console.error(`Error fetching ${category}:`, error);
        return { results: [], total_pages: 1 };
    }
}


async function fetchSeasonsAndEpisodes(tvId) {
  try {
    const res = await fetch(`${BASE_URL}/tv/${tvId}?api_key=${API_KEY}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.seasons || [];
  } catch (error) {
    console.error('Error fetching seasons:', error);
    return [];
  }
}

async function fetchEpisodes(tvId, seasonNumber) {
  try {
    const res = await fetch(`${BASE_URL}/tv/${tvId}/season/${seasonNumber}?api_key=${API_KEY}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.episodes || [];
  } catch (error) {
    console.error('Error fetching episodes:', error);
    return [];
  }
}

function removeLoadingAndError(containerId) {
    const container = document.getElementById(containerId);
    if (container) {
        container.querySelector('.loading')?.remove();
        container.querySelector('.error-message')?.remove();
        // NEW: Remove skeleton class and placeholders when done
        container.classList.remove('loading-list');
        container.querySelectorAll('.skeleton').forEach(el => el.remove());
    }
}

function showError(message, containerId) {
  removeLoadingAndError(containerId);
  const container = document.getElementById(containerId);
  if (container) {
    const error = document.createElement('p');
    error.className = 'error-message';
    error.style.whiteSpace = 'pre-wrap';
    error.textContent = message;
    container.appendChild(error);
  }
}

function showLoading(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (container.querySelector('.loading')) return;
  
  container.querySelector('.error-message')?.remove();
  
  // NEW: Apply skeleton class to the list itself
  if (container.classList.contains('list')) {
      container.classList.add('loading-list');
  }
  
  const loading = document.createElement('p');
  loading.className = 'loading';
  loading.textContent = 'Loading...';
  
  // Only add 'Loading...' text if it's the slides container
  if(container.id === 'slides') {
      container.appendChild(loading);
  }
}

function displaySlides() {
  const slidesContainer = document.getElementById('slides');
  const dotsContainer = document.getElementById('dots');
  
  slidesContainer.innerHTML = '';
  dotsContainer.innerHTML = '';
  removeLoadingAndError('slides');

  if (slideshowItems.length === 0) {
    slidesContainer.innerHTML = '<h1 class="loading">No featured content available</h1>';
    return;
  }

  slideshowItems.forEach((item, index) => {
    if (!item.backdrop_path) return;
    const slide = document.createElement('div');
    slide.className = 'slide';
    slide.style.backgroundImage = `url(${IMG_URL}${item.backdrop_path})`;
    slide.innerHTML = `<h1>${item.title || item.name || 'Unknown'}</h1>`;
    slide.onclick = () => showDetails(item);
    slidesContainer.appendChild(slide);

    const dot = document.createElement('span');
    dot.className = 'dot';
    if (index === currentSlide) dot.className += ' active';
    dot.onclick = () => {
      currentSlide = index;
      showSlide();
    };
    dotsContainer.appendChild(dot);
  });

  showSlide();
}

function showSlide() {
  const slides = document.querySelectorAll('.slide');
  const dots = document.querySelectorAll('.dot');
  if (slides.length === 0) return;
  slides.forEach((slide, index) => {
    slide.style.transform = `translateX(-${currentSlide * 100}%)`;
  });
  dots.forEach((dot, index) => {
    dot.className = index === currentSlide ? 'dot active' : 'dot';
  });
  clearInterval(slideshowInterval);
  slideshowInterval = setInterval(() => {
    currentSlide = (currentSlide + 1) % slides.length;
    showSlide();
  }, 5000);
}

function changeSlide(n) {
  const slides = document.querySelectorAll('.slide');
  if (slides.length === 0) return;
  currentSlide = (currentSlide + n + slides.length) % slides.length;
  showSlide();
}

/**
 * Restored: displayList now appends items for infinite scroll, but clears for filter changes.
 * The only way to clear content is via loadRowContent (which is called when filters change).
 */
function displayList(items, containerId) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`Container ${containerId} not found`);
    return;
  }
  
  removeLoadingAndError(containerId);

  if (items.length === 0 && container.children.length === 0) {
    container.innerHTML = '<p style="color: #ccc; text-align: center; width: 100%;">No content available.</p>';
    return;
  }

  items.forEach(item => {
    // Check if the item already exists before appending (crucial for infinite scroll)
    if (container.querySelector(`img[data-id="${item.id}"]`)) return;

    const img = document.createElement('img');
    img.src = item.poster_path ? `${IMG_URL}${item.poster_path}` : FALLBACK_IMAGE;
    img.alt = (item.title || item.name || 'Unknown') + (item.media_type ? ` (${item.media_type})` : '');
    img.setAttribute('data-id', item.id);
    img.onclick = () => showDetails(item);
    container.appendChild(img);
  });
}

/**
 * NEW: Function to display custom Shopee/Ad links in a dedicated row.
 */
function displayShopeeLinks() {
    const shopeeLinks = [
        { 
            // YOUR SHOPEE LINK
            url: 'https://collshp.com/reelroom', 
            // Placeholder image - Replace with a hosted image URL for your product/store banner
            img: 'https://down-ph.img.susercontent.com/file/ph-11134207-7ras9-m8on3bi10kula8@resize_w1080_nl.webp',
            alt: 'ReelRoom Official Shopee Store'
        },
        { 
            // Example for a specific popular product (replace URL and image)
            url: 'https://collshp.com/reelroom', 
            img: 'https://down-ph.img.susercontent.com/file/ph-11134207-7rasd-m8vm437l4fg308@resize_w1080_nl.webp', 
            alt: 'Best Seller Deal'
        },
        { 
            // Example for another promotional slot
            url: 'https://collshp.com/reelroom', 
            img: 'https://down-ph.img.susercontent.com/file/3c7cc4df24ee620a24bd45f2a35efd88@resize_w1080_nl.webp', 
            alt: 'Promo Alert'
        }
        // Add more objects here for more links/ads
    ];

    const container = document.getElementById('shopee-link-list');
    if (!container) return;
    
    // Clear the skeleton placeholders before appending actual links
    removeLoadingAndError('shopee-link-list');
    
    container.innerHTML = ''; // Clear previous content

    shopeeLinks.forEach(item => {
        const link = document.createElement('a');
        link.href = item.url;
        link.target = '_blank'; // Open in new tab
        
        const img = document.createElement('img');
        img.src = item.img;
        img.alt = item.alt;
        img.style.width = '150px'; // Maintain existing poster width
        img.style.height = '225px'; // Maintain existing poster height
        
        link.appendChild(img);
        container.appendChild(link);
    });
}


// --- CORE LOCAL STORAGE MANAGEMENT FUNCTIONS ---

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

// --- NEW: Toast Notification Function ---
function showToast(message, duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;

    container.appendChild(toast);

    // Show the toast
    setTimeout(() => {
        toast.classList.add('show');
    }, 10); // Small delay for CSS transition to work

    // Hide and remove the toast
    setTimeout(() => {
        toast.classList.remove('show');
        // Wait for the transition to finish before removing
        toast.addEventListener('transitionend', () => {
            toast.remove();
        }, { once: true });
    }, duration);
}
// --- END NEW: Toast Notification Function ---

// --- USER SETTINGS FUNCTIONS (NEW) ---

/**
 * Loads the user settings object from local storage.
 */
function loadUserSettings() {
    try {
        const json = localStorage.getItem(USER_SETTINGS_KEY);
        // Default settings if none exist
        return json ? JSON.parse(json) : { defaultServer: 'player.videasy.net' };
    } catch (e) {
        console.error("Error loading user settings:", e);
        return { defaultServer: 'player.videasy.net' };
    }
}

/**
 * Saves the user settings object to local storage.
 * @param {object} settings The settings object to save.
 */
function saveUserSettings(settings) {
    try {
        localStorage.setItem(USER_SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
        console.error("Error saving user settings:", e);
    }
}

/**
 * Function called by the new button to save the selected server as default.
 */
function saveDefaultServer() {
    const selectedServer = document.getElementById('server').value;
    const settings = loadUserSettings();
    
    settings.defaultServer = selectedServer;
    saveUserSettings(settings);
    
    // Provide user feedback via the new toast system
    const serverName = selectedServer.split('.')[0].replace('player', 'Videasy');
    showToast(`✅ Default server set to ${serverName}!`); 
}


// --- LIST MANAGEMENT FUNCTIONS ---

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
    showToast(`Removed from Favorites`);
  } else {
    // Add to favorites (at the beginning)
    favoritesList.unshift(itemData);
    favoritesList = favoritesList.slice(0, MAX_FAVORITES); // Trim just in case
    showToast(`Added to Favorites ❤️`);
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
    
    // Always clear the container and remove loading status before rendering
    removeLoadingAndError('favorites-list'); 
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
        // We pass the minimal item saved in storage to showDetails
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
    
    // Always clear the container and remove loading status before rendering
    removeLoadingAndError('recently-viewed-list');
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

// --- USER RATING FUNCTIONS ---

/**
 * Loads the user rating for the current item.
 */
function loadUserRating(itemId) {
    const ratings = loadStorageList(RATINGS_KEY);
    return ratings.find(r => r.id === itemId)?.rating || 0;
}

/**
 * Saves the user rating for an item.
 */
function setUserRating(rating) {
    if (!currentItem) return;
    const itemId = currentItem.id;

    let ratings = loadStorageList(RATINGS_KEY);
    const existingIndex = ratings.findIndex(r => r.id === itemId);

    // If the user clicks the currently selected rating star, clear the rating (set to 0)
    const currentRating = parseInt(document.getElementById('modal-rating-user').getAttribute('data-rating'));
    const finalRating = (rating === currentRating) ? 0 : rating;


    if (finalRating === 0) { 
        if (existingIndex !== -1) {
            ratings.splice(existingIndex, 1);
        }
        showToast('Rating cleared.');
    } else if (existingIndex !== -1) {
        ratings[existingIndex].rating = finalRating;
        showToast(`Rated ${finalRating} stars!`);
    } else {
        ratings.push({ id: itemId, rating: finalRating });
        showToast(`Rated ${finalRating} stars!`);
    }

    saveStorageList(RATINGS_KEY, ratings);
    updateUserRatingDisplay(finalRating);
}

/**
 * Updates the star icons based on the saved rating.
 */
function updateUserRatingDisplay(rating) {
    const stars = document.querySelectorAll('#modal-rating-user .user-star');
    document.getElementById('modal-rating-user').setAttribute('data-rating', rating);
    
    stars.forEach(star => {
        const value = parseInt(star.getAttribute('data-value'));
        if (value <= rating) {
            star.className = 'fas fa-star user-star'; // Solid star
        } else {
            star.className = 'far fa-star user-star'; // Outline star
        }
    });
}


// --- WATCH PROGRESS FUNCTIONS ---

/**
 * Saves the current server/season/episode progress.
 */
function saveWatchProgress(itemId, server, season, episode) {
    let progressList = loadStorageList(WATCH_PROGRESS_KEY);
    const existingIndex = progressList.findIndex(p => p.id === itemId);
    
    const progressData = {
        id: itemId,
        server: server,
        season: season,
        episode: episode
    };

    if (existingIndex !== -1) {
        progressList[existingIndex] = progressData;
    } else {
        progressList.push(progressData);
    }

    saveStorageList(WATCH_PROGRESS_KEY, progressList);
}

/**
 * Loads the saved progress for the current item.
 */
function loadWatchProgress(itemId) {
    const progressList = loadStorageList(WATCH_PROGRESS_KEY);
    return progressList.find(p => p.id === itemId);
}


// --- MAIN ROW INFINITE SCROLL LOGIC (RESTORED & ADAPTED) ---

function addScrollListener(category) {
  const containerId = category + '-list';
  const container = document.getElementById(containerId);
  if (!container) return;
  
  // Remove existing listener to prevent duplicates
  container.onscroll = null; 
  
  container.onscroll = function () {
    const state = categoryState[category];
    
    if (
      !state.isLoading &&
      container.scrollLeft + container.clientWidth >= container.scrollWidth - 50
    ) {
      loadMore(category);
    }
  };
}

async function loadMore(category) {
  const state = categoryState[category];
  if (state.isLoading) return;

  state.isLoading = true;
  const containerId = category + '-list';
  
  showLoading(containerId);
  
  state.page++;

  try {
    // Use the filter-aware fetch function
    const data = await fetchCategoryContent(category, state.page, state.filters);

    const items = data.results || [];
    
    // Stop loading if the API returns no results for the next page
    if (items.length === 0) {
        state.page--; 
        console.log(`${category} reached end of available content.`);
        document.getElementById(containerId)?.querySelector('.loading')?.remove();
        state.isLoading = false; // Fix: Use state variable
        return;
    }
    
    // Display the items, which will be appended due to logic in displayList
    displayList(items, containerId);

  } catch (error) {
    console.error(`Error loading more for ${category}:`, error);
    showError(`Failed to load more ${category}.`, containerId);
    state.page--;
  } finally {
    state.isLoading = false;
    document.getElementById(containerId)?.querySelector('.loading')?.remove();
    document.getElementById(containerId)?.classList.remove('loading-list'); // Ensure removal after load
  }
}

// --- FILTER & SHOW MORE LOGIC (ADAPTED) ---

function updateFilterButtons(category, filters) {
    const row = document.getElementById(`${category}-row`);
    const filterBtn = row.querySelector('.filter-btn:not(.clear-filter-btn)');
    const clearBtn = row.querySelector('.clear-filter-btn');
    
    if (!filterBtn || !clearBtn) return; 

    const isFiltered = filters.year || filters.genre;

    if (isFiltered) {
        const genreName = filters.genre ? (GENRES.find(g => g.id == filters.genre)?.name || 'Genre') : '';
        const yearText = filters.year || '';
        
        // Show the filter text only on larger screens via CSS (we only keep the icon here)
        filterBtn.innerHTML = `<i class="fas fa-filter"></i> ${genreName} ${yearText}`.trim(); 
        filterBtn.style.background = 'red';
        filterBtn.style.color = 'white';
        clearBtn.style.display = 'inline-block';
    } else {
        filterBtn.innerHTML = '<i class="fas fa-filter"></i>'; // Icon only
        filterBtn.style.background = '#444';
        filterBtn.style.color = '#fff';
        clearBtn.style.display = 'none';
    }
}

async function loadRowContent(category, filters = {}) {
    const state = categoryState[category];
    if (state.isLoading) return;

    state.isLoading = true;
    const containerId = `${category}-list`;
    showLoading(containerId);

    // Reset page to 1 for a new filtered query
    state.page = 1; 

    const data = await fetchCategoryContent(category, 1, filters);
    
    // Update the state with the applied filters
    state.filters = filters;

    // Call displayList which will clear the container first since it's the start of a new query
    const container = document.getElementById(containerId);
    if(container) container.innerHTML = '';
    displayList(data.results, containerId); // Display all results from page 1
    
    updateFilterButtons(category, filters);
    
    state.isLoading = false;
    document.getElementById(containerId)?.querySelector('.loading')?.remove();
    document.getElementById(containerId)?.classList.remove('loading-list'); // Ensure removal after load
}

function clearFilters(category) {
    // Reset filters and load the original content
    categoryState[category].filters = {};
    loadRowContent(category);
}


function openFullView(category) {
    currentFullView = category;
    
    // Use a copy of the currently applied row filters for the initial load
    let filters = { ...categoryState[category].filters }; 
    // Ensure the default sort is set if none is active
    filters.sort_by = filters.sort_by || 'popularity.desc'; 
    
    // NEW: Disable scrolling on the main page when the full view is open
    document.body.style.overflow = 'hidden'; 
    
    const fullViewContainer = document.createElement('div');
    fullViewContainer.id = 'full-view-modal';
    fullViewContainer.className = 'search-modal'; 
    fullViewContainer.style.display = 'flex';
    document.body.appendChild(fullViewContainer);

    const title = category.replace('-', ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    
    fullViewContainer.innerHTML = `
        <span class="close" onclick="closeFullView()" style="color: red;">&times;</span>
        <h2 style="text-transform: uppercase;">${title}</h2>
        
        <div class="full-view-controls">
            <label for="full-view-sort">Sort By:</label>
            <select id="full-view-sort" onchange="applyFullViewSort()">
                <option value="popularity.desc">Popularity (Descending)</option>
                <option value="release_date.desc">Release Date (Newest)</option>
                <option value="vote_average.desc">Rating (Highest)</option>
                <option value="title.asc">Title (A-Z)</option>
            </select>
        </div>
        <div class="results" id="${category}-full-list"></div>
    `;
    
    // Set the initial value of the sort dropdown
    document.getElementById('full-view-sort').value = filters.sort_by;


    // Reset pagination to 0 so the first call increments it to page 1 for the full view
    categoryState[category].page = 0; 
    loadMoreFullView(category, filters, true); // Initial load
    
    const listContainer = document.getElementById(`${category}-full-list`);
    // Add infinite scroll listener for the full view
    listContainer.onscroll = function () {
        scrollPosition = listContainer.scrollTop; 
        
        if (
            !categoryState[category].isLoading &&
            listContainer.scrollTop + listContainer.clientHeight >= listContainer.scrollHeight - 50
        ) {
            // Pass the current filters (including sort) to loadMore
            loadMoreFullView(category, filters);
        }
    };
}

function closeFullView() {
    const modal = document.getElementById('full-view-modal');
    if (modal) modal.remove();
    currentFullView = null;
    scrollPosition = 0; 
    
    // NEW: Restore scrolling on the main page
    document.body.style.overflow = ''; 
}

// Helper to display images in the grid (similar to search results)
function displayFullList(items, containerId, isFirstLoad = false) {
  const container = document.getElementById(containerId);
  if (isFirstLoad) {
      container.innerHTML = ''; 
  }
  
  items.forEach(item => {
    // Only add if not already present
    if (container.querySelector(`img[data-id="${item.id}"]`)) return;

    const img = document.createElement('img');
    img.src = item.poster_path ? `${IMG_URL}${item.poster_path}` : FALLBACK_IMAGE;
    img.alt = item.title || item.name || 'Unknown';
    img.setAttribute('data-id', item.id);
    
    img.onclick = () => showDetails(item, true); 
    
    container.appendChild(img);
  });
}

// NEW: Function to handle sort change in the full view
function applyFullViewSort() {
    if (!currentFullView) return;
    
    const sortValue = document.getElementById('full-view-sort').value;
    const category = currentFullView;
    const state = categoryState[category];

    // 1. Update the state's sort filter
    state.filters.sort_by = sortValue;
    
    // 2. Reset the page count
    state.page = 0; 
    
    // 3. Reload the list from scratch
    loadMoreFullView(category, state.filters, true); // true for first load to clear content
}

async function loadMoreFullView(category, filters, isFirstLoad = false) {
  const state = categoryState[category];
  const containerId = `${category}-full-list`;
  const container = document.getElementById(containerId); 

  if (state.isLoading) return;

  state.isLoading = true;
  
  showLoading(containerId);
  
  state.page++; 
  let currentPage = state.page;

  try {
    const data = await fetchCategoryContent(category, currentPage, filters);

    const items = data.results || [];
    
    if (items.length === 0) {
        if (currentPage > 1) { 
            state.page--; 
        }
        document.getElementById(containerId)?.querySelector('.loading')?.remove();
        state.isLoading = false;
        
        if (container.children.length === 0) {
            container.innerHTML = '<p style="color: #ccc; text-align: center; width: 100%;">No content matches your active filter in the full view.</p>';
        }
        
        return;
    }
    
    displayFullList(items, containerId, isFirstLoad);

  } catch (error) {
    console.error(`Error loading more for ${category}:`, error);
    showError(`Failed to load more ${category}.`, containerId);
    state.page--; 
  } finally {
    state.isLoading = false;
    document.getElementById(containerId)?.querySelector('.loading')?.remove();
    
    if (isFirstLoad && scrollPosition > 0) {
        container.scrollTop = scrollPosition;
    }
  }
}

// --- FILTER MODAL LOGIC ---

function populateFilterOptions() {
    const yearSelect = document.getElementById('filter-year');
    const genreSelect = document.getElementById('filter-genre');
    
    if (!yearSelect || !genreSelect) return; 

    yearSelect.innerHTML = '<option value="">Any Year</option>';
    genreSelect.innerHTML = '<option value="">Any Genre</option>';
    
    const currentYear = new Date().getFullYear();
    for (let i = 0; i < 20; i++) {
        const year = currentYear - i;
        const option = new Option(year, year);
        yearSelect.appendChild(option);
    }
    
    GENRES.forEach(genre => {
        const option = new Option(genre.name, genre.id);
        genreSelect.appendChild(option);
    });
}

function openFilterModal(category) {
    currentCategoryToFilter = category;
    
    const modalTitle = document.getElementById('filter-modal-title');
    const filterModal = document.getElementById('filter-modal');
    
    if (!modalTitle || !filterModal) {
        console.error("Filter modal elements not found in HTML.");
        return;
    }

    const title = category.replace('-', ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    modalTitle.textContent = `Filter ${title}`;
    
    const currentFilters = categoryState[category].filters;
    document.getElementById('filter-year').value = currentFilters.year || '';
    document.getElementById('filter-genre').value = currentFilters.genre || '';
    
    filterModal.style.display = 'flex';
}

/**
 * Updates filters and IMMEDIATELY auto-opens the full view.
 */
function applyFilters() {
    const year = document.getElementById('filter-year').value;
    const genre = document.getElementById('filter-genre').value;
    const category = currentCategoryToFilter;

    if (!category) return;
    
    // 1. Close the filter modal
    document.getElementById('filter-modal').style.display = 'none';
    
    const newFilters = { year: year, genre: genre };

    // 2. Update the filter state and the visual button indicator
    categoryState[category].filters = newFilters;
    updateFilterButtons(category, newFilters);
    
    // 3. Re-load the main row content with new filters (this clears the row and loads page 1)
    loadRowContent(category, newFilters);
    
    // 4. Immediately open the full view to show all filtered results.
    openFullView(category);
    showToast(`Filters Applied to ${category.replace('-', ' ')}`);
}


// --- DETAILS & MODAL LOGIC (MODIFIED for Auto-Highlight and Default Server) ---

async function showDetails(item, isFullViewOpen = false) {
  // NEW: Add item to recently viewed list
  addToRecentlyViewed(item);

  currentItem = item;
  
  // NEW: Load user rating and update display
  const userRating = loadUserRating(item.id);
  updateUserRatingDisplay(userRating);
  
  // NEW: Load watch progress (if it exists)
  const progress = loadWatchProgress(item.id);

  // NEW: Load user settings for default server
  const settings = loadUserSettings();
  const defaultServer = settings.defaultServer || 'player.videasy.net';
  
  // Restore server from progress or use default from settings
  document.getElementById('server').value = progress?.server || defaultServer; 


  // Use a separate span for the title so the heart icon can sit next to it
  document.getElementById('modal-item-title').textContent = item.title || item.name || 'Unknown';
  document.getElementById('modal-description').textContent = item.overview || 'No description available.';
  document.getElementById('modal-image').src = item.poster_path ? `${IMG_URL}${item.poster_path}` : FALLBACK_IMAGE;
  
  // TMDB Rating update (using the new ID)
  document.getElementById('modal-rating-tmdb').innerHTML = '★'.repeat(Math.round((item.vote_average || 0) / 2));
  

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


  if (isTVShow) {
    seasonSelector.style.display = 'block';
    // NOTE: If item is from local storage (Favorites/Recent), it might not have 'id'. Use currentItem.id.
    const tvId = item.id || currentItem.id;
    
    const seasons = await fetchSeasonsAndEpisodes(tvId);
    const seasonSelect = document.getElementById('season');
    seasonSelect.innerHTML = '';
    
    seasons.filter(s => s.season_number > 0).forEach(season => {
      const option = document.createElement('option');
      option.value = season.season_number;
      option.textContent = `Season ${season.season_number}`;
      seasonSelect.appendChild(option);
    });
    
    // Restore season from progress or use default
    currentSeason = progress?.season || seasons.find(s => s.season_number > 0)?.season_number || 1;
    seasonSelect.value = currentSeason;
    
    await loadEpisodes(); // loadEpisodes will now use and save the episode progress
  } else {
    seasonSelector.style.display = 'none';
    episodeList.innerHTML = '';
    
    // NEW: For movies, just call changeServer immediately to load the player
    changeServer();
  }
  
  // NEW: Disable body scroll when modal is open
  document.body.style.overflow = 'hidden';

  document.getElementById('modal').style.display = 'flex';
  
  if (isFullViewOpen) {
      document.getElementById('full-view-modal').style.display = 'none';
  }
}

async function loadEpisodes() {
  if (!currentItem) return;
  const seasonNumber = document.getElementById('season').value;
  currentSeason = seasonNumber;
  const episodes = await fetchEpisodes(currentItem.id, seasonNumber);
  const episodeList = document.getElementById('episode-list');
  episodeList.innerHTML = '';
  
  const progress = loadWatchProgress(currentItem.id);
  
  // We need to determine the episode to auto-select/highlight
  // 1. Check progress for this specific season
  let targetEpisode = (progress && progress.season == currentSeason) ? progress.episode : 1;
  
  // 2. If progress exists, assume the user finished that episode and target the NEXT one.
  //    If the user was on E5, we highlight E6. If they were on the last episode, we stick to that one.
  if (progress && progress.season == currentSeason && targetEpisode < episodes.length) {
      targetEpisode += 1;
  }
  // Ensure targetEpisode is within the valid range for the current season
  if (targetEpisode > episodes.length) {
      targetEpisode = episodes.length; // Stick to the last one if they finished it
  }
  if (targetEpisode < 1) {
      targetEpisode = 1; // Never go below E1
  }


  episodes.forEach(episode => {
    const div = document.createElement('div');
    div.className = 'episode-item';
    // Use data attribute for easy selection later
    div.setAttribute('data-episode-number', episode.episode_number); 
    
    const img = episode.still_path
      ? `<img src="${IMG_URL}${episode.still_path}" alt="Episode ${episode.episode_number} thumbnail" />`
      : '';
    div.innerHTML = `${img}<span>E${episode.episode_number}: ${episode.name || 'Untitled'}</span>`;
    
    div.onclick = () => {
      currentEpisode = episode.episode_number;
      changeServer();
      document.querySelectorAll('.episode-item').forEach(e => e.classList.remove('active'));
      div.classList.add('active');
      
      // NEW: Save progress on episode click
      saveWatchProgress(currentItem.id, document.getElementById('server').value, currentSeason, currentEpisode);
    };
    episodeList.appendChild(div);
  });
  
  if (episodes.length > 0) {
      // Find the element corresponding to the calculated targetEpisode
      const targetElement = episodeList.querySelector(`.episode-item[data-episode-number="${targetEpisode}"]`);
      
      if (targetElement) {
          // 1. Click the element to load the iframe and highlight it
          targetElement.click(); 
          
          // 2. Scroll the episode list container to bring the selected episode into view
          //    This uses a slight offset to center the episode better
          episodeList.scrollTop = targetElement.offsetTop - (episodeList.clientHeight / 2);

      } else {
          // Fallback to the very first episode if the calculated one isn't found (shouldn't happen)
          episodeList.querySelector('.episode-item')?.click();
      }
  }
}

function changeServer() {
  if (!currentItem) return;
  const server = document.getElementById('server').value;
  const type = currentItem.media_type || (currentItem.title ? 'movie' : 'tv');
  let embedURL = '';
  
  // NEW: Save progress on server change (This handles the case where the user changes the server)
  saveWatchProgress(currentItem.id, server, currentSeason, currentEpisode); 

  if (server === 'vidsrc.cc') {
    embedURL = type === 'tv'
      ? `https://vidsrc.cc/v2/embed/tv/${currentItem.id}/${currentSeason}/${currentEpisode}`
      : `https://vidsrc.cc/v2/embed/movie/${currentItem.id}`;
  } else if (server === 'vidsrc.me') {
    embedURL = type === 'tv'
      ? `https://vidsrc.net/embed/tv/?tmdb=${currentItem.id}&season=${currentSeason}&episode=${currentEpisode}`
      : `https://vidsrc.net/embed/movie/?tmdb=${currentItem.id}`;
  } else if (server === 'player.videasy.net') {
    embedURL = type === 'tv'
      ? `https://player.videasy.net/tv/${currentItem.id}/${currentSeason}/${currentEpisode}`
      : `https://player.videasy.net/movie/${currentItem.id}`;
  }

  document.getElementById('modal-video').src = embedURL;
}

function closeModal() {
  document.getElementById('modal').style.display = 'none';
  document.getElementById('modal-video').src = '';
  document.getElementById('episode-list').innerHTML = '';
  document.getElementById('season-selector').style.display = 'none';
  
  // NEW: Restore body scroll when modal is closed
  document.body.style.overflow = '';
  
  const fullViewModal = document.getElementById('full-view-modal');
  if (fullViewModal) {
      fullViewModal.style.display = 'flex';
  }
}

function openSearchModal() {
  // NEW: Disable body scroll when modal is open
  document.body.style.overflow = 'hidden'; 
  document.getElementById('search-modal').style.display = 'flex';
  document.getElementById('search-input').focus();
}

function closeSearchModal() {
  // NEW: Restore body scroll when modal is closed
  document.body.style.overflow = ''; 
  document.getElementById('search-modal').style.display = 'none';
  document.getElementById('search-results').innerHTML = '';
  document.getElementById('search-input').value = '';
}

const debouncedSearchTMDB = debounce(async () => {
  const query = document.getElementById('search-input').value;
  const container = document.getElementById('search-results');
  container.innerHTML = '';
  
  if (!query.trim()) return;

  container.innerHTML = '<p class="loading">Searching...</p>';

  try {
    const res = await fetch(`${BASE_URL}/search/multi?api_key=${API_KEY}&query=${query}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    container.innerHTML = ''; 
    data.results
      .filter(item => item.media_type !== 'person' && item.poster_path)
      .forEach(item => {
        const img = document.createElement('img');
        img.src = item.poster_path ? `${IMG_URL}${item.poster_path}` : FALLBACK_IMAGE;
        img.alt = item.title || item.name || 'Unknown';
        img.onclick = () => {
          closeSearchModal();
          showDetails(item);
        };
        container.appendChild(img);
      });
      
    if (container.children.length === 0) {
        container.innerHTML = '<p style="color: #ccc; text-align: center; margin-top: 20px;">No results found.</p>';
    }

  } catch (error) {
    console.error('Error searching:', error);
    showError('Search failed. Try again.', 'search-results');
  }
}, 300);

// --- INITIALIZATION ---

async function init() {
  document.getElementById('empty-message').style.display = 'none';
  
  const apiKeyValid = await testApiKey();
  if (!apiKeyValid) {
      return;
  }
  
  // Show loading for all sections initially (including skeletons)
  showLoading('shopee-link-list');
  showLoading('favorites-list'); // Add skeleton loading for static lists
  showLoading('recently-viewed-list');
  showLoading('slides');
  showLoading('movies-list');
  showLoading('tvshows-list');
  showLoading('anime-list');
  showLoading('tagalog-movies-list');
  showLoading('netflix-movies-list');
  showLoading('netflix-tv-list');
  showLoading('korean-drama-list');

  // NEW: Display your custom Shopee/Ad links 
  // This is called before TMDB fetch since it's local data
  displayShopeeLinks();
  
  // NEW: Load and display the user lists before fetching TMDB content
  displayFavorites();
  displayRecentlyViewed();
  
  populateFilterOptions(); 

  // Set up listeners for the new control buttons
  document.querySelectorAll('.show-more-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      openFullView(link.getAttribute('data-category'));
    });
  });

  document.querySelectorAll('.filter-btn:not(.clear-filter-btn)').forEach(button => {
    button.addEventListener('click', (e) => {
      e.preventDefault(); 
      openFilterModal(button.getAttribute('data-category'));
    });
  });
  
  document.querySelectorAll('.clear-filter-btn').forEach(button => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      clearFilters(button.getAttribute('data-category'));
    });
  });


  try {
    // Fetch and display all rows concurrently (page 1)
    const [moviesData, tvShowsData, animeData, tagalogMoviesData, netflixMoviesData, netflixTVData, koreanDramaData] = await Promise.all([
      fetchCategoryContent('movies', 1),
      fetchCategoryContent('tvshows', 1),
      fetchCategoryContent('anime', 1),
      fetchCategoryContent('tagalog-movies', 1),
      fetchCategoryContent('netflix-movies', 1),
      fetchCategoryContent('netflix-tv', 1),
      fetchCategoryContent('korean-drama', 1)
    ]);

    // Prepare data for the slideshow 
    const allResults = [
        ...moviesData.results, ...tvShowsData.results, ...animeData.results,
        ...tagalogMoviesData.results, ...netflixMoviesData.results, ...netflixTVData.results,
        ...koreanDramaData.results
    ].filter(item => item && item.backdrop_path);

    slideshowItems = allResults.slice(0, 7);
    displaySlides();

    // Display the initial rows (removes skeletons/loading text via displayList)
    displayList(moviesData.results, 'movies-list');
    displayList(tvShowsData.results, 'tvshows-list');
    displayList(animeData.results, 'anime-list');
    displayList(tagalogMoviesData.results, 'tagalog-movies-list');
    displayList(netflixMoviesData.results, 'netflix-movies-list');
    displayList(netflixTVData.results, 'netflix-tv-list');
    displayList(koreanDramaData.results, 'korean-drama-list');
    
    // Setup infinite scroll listeners for the main rows (RESTORED)
    addScrollListener('movies');
    addScrollListener('tvshows');
    addScrollListener('anime');
    addScrollListener('tagalog-movies');
    addScrollListener('netflix-movies');
    addScrollListener('netflix-tv');
    addScrollListener('korean-drama');

  } catch (error) {
    console.error('Fatal initialization error:', error);
    showError('Failed to load content categories. Please check browser console.', 'empty-message');
    document.getElementById('empty-message').style.display = 'block';
  }
}

init();
