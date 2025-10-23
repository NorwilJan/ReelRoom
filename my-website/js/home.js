// js/home.js
const API_KEY = '40f1982842db35042e8561b13b38d492'; // Your original TMDB API key - UNCHANGED
const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_URL = 'https://image.tmdb.org/t/p/original';
const FALLBACK_IMAGE = 'https://via.placeholder.com/150x225?text=No+Image';

// --- CONFIGURATION OBJECTS (NEW) ---
const PLAYER_CONFIG = {
    'vidsrc.cc': { 
        name: 'Vidsrc.cc',
        movie: (id) => `https://vidsrc.cc/v2/embed/movie/${id}`, 
        tv: (id, s, e) => `https://vidsrc.cc/v2/embed/tv/${id}/${s}/${e}` 
    },
    'vidsrc.me': { 
        name: 'Vidsrc.me',
        movie: (id) => `https://vidsrc.net/embed/movie/?tmdb=${id}`, 
        tv: (id, s, e) => `https://vidsrc.net/embed/tv/?tmdb=${id}&season=${s}&episode=${e}` 
    },
    'player.videasy.net': { 
        name: 'Player.Videasy.net',
        movie: (id) => `https://player.videasy.net/movie/${id}`, 
        tv: (id, s, e) => `https://player.videasy.net/tv/${id}/${s}/${e}` 
    },
};

const GENRES = [
  { id: 28, name: 'Action' }, { id: 12, name: 'Adventure' }, 
  { id: 35, name: 'Comedy' }, { id: 80, name: 'Crime' }, 
  { id: 18, name: 'Drama' }, { id: 10751, name: 'Family' }, 
  { id: 27, name: 'Horror' }, { id: 878, name: 'Science Fiction' }, 
  { id: 53, name: 'Thriller' }, { id: 10749, name: 'Romance' },
  { id: 16, name: 'Animation' }, { id: 9648, name: 'Mystery' }
];

// --- APPLICATION STATE (CLEANER) ---
let currentItem;
let currentSeason = 1;
let currentEpisode = 1;
let slideshowItems = [];
let currentSlide = 0;
let slideshowInterval;
let scrollPosition = 0; 
let currentFullView = null; 
let currentCategoryToFilter = null; 

let categoryState = {
    movies: { page: 1, isLoading: false, filters: {} },
    tvshows: { page: 1, isLoading: false, filters: {} },
    anime: { page: 1, isLoading: false, filters: {} },
    'tagalog-movies': { page: 1, isLoading: false, filters: {} },
    'netflix-movies': { page: 1, isLoading: false, filters: {} },
    'netflix-tv': { page: 1, isLoading: false, filters: {} },
    'korean-drama': { page: 1, isLoading: false, filters: {} }
};

// --- LOCAL STORAGE CONSTANTS ---
const FAVORITES_KEY = 'reelroom_favorites';
const RECENTLY_VIEWED_KEY = 'reelroom_recent';
const RATINGS_KEY = 'reelroom_ratings';         
const WATCH_PROGRESS_KEY = 'reelroom_progress'; 
const USER_SETTINGS_KEY = 'reelroom_user_settings'; 
const MAX_RECENT = 15; 
const MAX_FAVORITES = 30; 


/**
 * Utility function to debounce another function call.
 */
function debounce(func, delay) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), delay);
  };
}


// --- CORE API & UI UTILITIES ---

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

async function fetchCategoryContent(category, page, filters = {}) {
    try {
        let baseParams = `&page=${page}&include_adult=false&include_video=false`; 
        const sortBy = filters.sort_by || 'popularity.desc';
        baseParams += `&sort_by=${sortBy}`;
        
        const filterParams = `${filters.year ? `&primary_release_year=${filters.year}` : ''}${filters.genre ? `&with_genres=${filters.genre}` : ''}`;
        let fetchURL = '';
        let mediaType = category.includes('movie') ? 'movie' : 'tv';

        if (category === 'movies') {
            fetchURL = `${BASE_URL}/discover/movie?api_key=${API_KEY}${baseParams}${filterParams}`;
        } else if (category === 'tvshows') {
            fetchURL = `${BASE_URL}/discover/tv?api_key=${API_KEY}${baseParams}${filterParams}`;
        } else if (category === 'anime') {
            fetchURL = `${BASE_URL}/discover/tv?api_key=${API_KEY}&with_genres=16&with_original_language=ja${baseParams}${filterParams}`;
        } else if (category === 'tagalog-movies') {
            fetchURL = `${BASE_URL}/discover/movie?api_key=${API_KEY}&with_original_language=tl${baseParams}${filterParams}`;
        } else if (category === 'netflix-movies') {
            fetchURL = `${BASE_URL}/discover/movie?api_key=${API_KEY}&with_watch_providers=8&watch_region=US${baseParams}${filterParams}`;
        } else if (category === 'netflix-tv') {
            fetchURL = `${BASE_URL}/discover/tv?api_key=${API_KEY}&with_watch_providers=8&watch_region=US${baseParams}${filterParams}`;
        } else if (category === 'korean-drama') {
            fetchURL = `${BASE_URL}/discover/tv?api_key=${API_KEY}&with_original_language=ko&with_genres=18${baseParams}${filterParams}`;
        } else {
            throw new Error('Unknown category.');
        }

        const res = await fetch(fetchURL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        
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
  
  container.querySelector('.error-message')?.remove();
  
  if (container.classList.contains('list')) {
      container.classList.add('loading-list');
      // Adding skeleton placeholders if they don't exist
      if (container.children.length === 0) {
        for(let i=0; i<5; i++) {
            const skeleton = document.createElement('div');
            skeleton.className = 'skeleton';
            container.appendChild(skeleton);
        }
      }
  }
  
  // Only add 'Loading...' text for the slides
  if(container.id === 'slides' && !container.querySelector('.loading')) {
      const loading = document.createElement('h1');
      loading.className = 'loading';
      loading.textContent = 'Loading...';
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
    
    // Attach event listener in JS
    slide.addEventListener('click', () => showDetails(item));
    
    slidesContainer.appendChild(slide);

    const dot = document.createElement('span');
    dot.className = 'dot';
    if (index === currentSlide) dot.className += ' active';
    
    // Attach event listener in JS
    dot.addEventListener('click', () => {
        currentSlide = index;
        showSlide();
    });
    
    dotsContainer.appendChild(dot);
  });

  showSlide();
}

function showSlide() {
  const slides = document.querySelectorAll('#slides .slide');
  const dots = document.querySelectorAll('#dots .dot');
  if (slides.length === 0) return;
  slides.forEach((slide) => {
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
  const slides = document.querySelectorAll('#slides .slide');
  if (slides.length === 0) return;
  currentSlide = (currentSlide + n + slides.length) % slides.length;
  showSlide();
}

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
    if (container.querySelector(`img[data-id="${item.id}"]`)) return;

    const img = document.createElement('img');
    img.src = item.poster_path ? `${IMG_URL}${item.poster_path}` : FALLBACK_IMAGE;
    img.alt = (item.title || item.name || 'Unknown') + (item.media_type ? ` (${item.media_type})` : '');
    img.setAttribute('data-id', item.id);
    
    // Attach listener
    img.addEventListener('click', () => showDetails(item));
    
    container.appendChild(img);
  });
}

function displayShopeeLinks() {
    const shopeeLinks = [
        { 
            url: 'https://collshp.com/reelroom', 
            img: 'https://down-ph.img.susercontent.com/file/ph-11134207-7ras9-m8on3bi10kula8@resize_w1080_nl.webp',
            alt: 'ReelRoom Official Shopee Store'
        },
        { 
            url: 'https://collshp.com/reelroom', 
            img: 'https://down-ph.img.susercontent.com/file/ph-11134207-7rasd-m8vm437l4fg308@resize_w1080_nl.webp', 
            alt: 'Best Seller Deal'
        },
        { 
            url: 'https://collshp.com/reelroom', 
            img: 'https://down-ph.img.susercontent.com/file/3c7cc4df24ee620a24bd45f2a35efd88@resize_w1080_nl.webp', 
            alt: 'Promo Alert'
        }
    ];

    const container = document.getElementById('shopee-link-list');
    if (!container) return;
    
    removeLoadingAndError('shopee-link-list');
    container.innerHTML = ''; 

    shopeeLinks.forEach(item => {
        const link = document.createElement('a');
        link.href = item.url;
        link.target = '_blank'; 
        
        const img = document.createElement('img');
        img.src = item.img;
        img.alt = item.alt;
        
        link.appendChild(img);
        container.appendChild(link);
    });
}


// --- LOCAL STORAGE & USER FUNCTIONS ---

function loadStorageList(key) {
  try {
    const json = localStorage.getItem(key);
    return json ? JSON.parse(json) : [];
  } catch (e) {
    console.error(`Error loading storage list for key: ${key}`, e);
    return [];
  }
}

function saveStorageList(key, list) {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch (e) {
    console.error(`Error saving storage list for key: ${key}`, e);
  }
}

function showToast(message, duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('show');
    }, 10); 

    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => {
            toast.remove();
        }, { once: true });
    }, duration);
}

function loadUserSettings() {
    try {
        const json = localStorage.getItem(USER_SETTINGS_KEY);
        // Default to the most reliable player
        return json ? JSON.parse(json) : { defaultServer: 'player.videasy.net' };
    } catch (e) {
        console.error("Error loading user settings:", e);
        return { defaultServer: 'player.videasy.net' };
    }
}

function saveUserSettings(settings) {
    try {
        localStorage.setItem(USER_SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
        console.error("Error saving user settings:", e);
    }
}

function saveDefaultServer() {
    const selectedServer = document.getElementById('server').value;
    const settings = loadUserSettings();
    
    settings.defaultServer = selectedServer;
    saveUserSettings(settings);
    
    const serverName = PLAYER_CONFIG[selectedServer]?.name || selectedServer;
    showToast(`✅ Default server set to ${serverName}!`); 
}

function addToRecentlyViewed(item) {
  const itemData = {
    id: item.id,
    title: item.title || item.name,
    poster_path: item.poster_path,
    media_type: item.media_type || (item.title ? 'movie' : 'tv')
  };
  
  let recentList = loadStorageList(RECENTLY_VIEWED_KEY);
  recentList = recentList.filter(i => i.id !== itemData.id);
  recentList.unshift(itemData);
  recentList = recentList.slice(0, MAX_RECENT);
  
  saveStorageList(RECENTLY_VIEWED_KEY, recentList);
  displayRecentlyViewed();
}

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
    favoritesList = favoritesList.filter(i => i.id !== itemData.id);
    showToast(`Removed from Favorites`);
  } else {
    favoritesList.unshift(itemData);
    favoritesList = favoritesList.slice(0, MAX_FAVORITES); 
    showToast(`Added to Favorites ❤️`);
  }
  
  saveStorageList(FAVORITES_KEY, favoritesList);
  
  document.getElementById('favorite-toggle').classList.toggle('active', !isFavorite);
  displayFavorites();
}

function displayFavorites() {
    const favorites = loadStorageList(FAVORITES_KEY);
    const container = document.getElementById('favorites-list');
    const countSpan = document.getElementById('favorites-count');
    
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
        img.addEventListener('click', () => showDetails(item)); 
        container.appendChild(img);
    });
}

function displayRecentlyViewed() {
    const recent = loadStorageList(RECENTLY_VIEWED_KEY);
    const container = document.getElementById('recently-viewed-list');
    
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
        img.addEventListener('click', () => showDetails(item));
        container.appendChild(img);
    });
}

function loadUserRating(itemId) {
    const ratings = loadStorageList(RATINGS_KEY);
    return ratings.find(r => r.id === itemId)?.rating || 0;
}

function setUserRating(rating) {
    if (!currentItem) return;
    const itemId = currentItem.id;

    let ratings = loadStorageList(RATINGS_KEY);
    const existingIndex = ratings.findIndex(r => r.id === itemId);

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

function loadWatchProgress(itemId) {
    const progressList = loadStorageList(WATCH_PROGRESS_KEY);
    return progressList.find(p => p.id === itemId);
}


// --- SCROLL & FILTER LOGIC ---

function addScrollListener(category) {
  const containerId = category + '-list';
  const container = document.getElementById(containerId);
  if (!container) return;
  
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
    const data = await fetchCategoryContent(category, state.page, state.filters);
    const items = data.results || [];
    
    if (items.length === 0) {
        state.page--; 
        document.getElementById(containerId)?.querySelector('.loading')?.remove();
        state.isLoading = false; 
        return;
    }
    
    displayList(items, containerId);

  } catch (error) {
    console.error(`Error loading more for ${category}:`, error);
    showError(`Failed to load more ${category}.`, containerId);
    state.page--;
  } finally {
    state.isLoading = false;
    document.getElementById(containerId)?.querySelector('.loading')?.remove();
    document.getElementById(containerId)?.classList.remove('loading-list');
  }
}

function updateFilterButtons(category, filters) {
    const row = document.getElementById(`${category}-row`);
    const filterBtn = row.querySelector('.filter-btn:not(.clear-filter-btn)');
    const clearBtn = row.querySelector('.clear-filter-btn');
    
    if (!filterBtn || !clearBtn) return; 

    const isFiltered = filters.year || filters.genre;

    if (isFiltered) {
        const genreName = filters.genre ? (GENRES.find(g => g.id == filters.genre)?.name || 'Genre') : '';
        const yearText = filters.year || '';
        
        // Update button text for larger screens, keep icon for small screens
        filterBtn.innerHTML = `<i class="fas fa-filter"></i> ${genreName} ${yearText}`.trim(); 
        filterBtn.style.background = 'red';
        filterBtn.style.color = 'white';
        clearBtn.style.display = 'inline-block';
        // Add aria-label for accessibility
        filterBtn.setAttribute('aria-label', `Active Filters: ${genreName} ${yearText}`);
    } else {
        filterBtn.innerHTML = '<i class="fas fa-filter"></i>'; 
        filterBtn.style.background = '#444';
        filterBtn.style.color = '#fff';
        clearBtn.style.display = 'none';
        filterBtn.setAttribute('aria-label', 'Open Filter');
    }
}

async function loadRowContent(category, filters = {}) {
    const state = categoryState[category];
    if (state.isLoading) return;

    state.isLoading = true;
    const containerId = `${category}-list`;
    showLoading(containerId);

    state.page = 1; 

    const data = await fetchCategoryContent(category, 1, filters);
    state.filters = filters;

    const container = document.getElementById(containerId);
    if(container) container.innerHTML = '';
    displayList(data.results, containerId);
    
    updateFilterButtons(category, filters);
    
    state.isLoading = false;
    document.getElementById(containerId)?.querySelector('.loading')?.remove();
    document.getElementById(containerId)?.classList.remove('loading-list');
}

function clearFilters(category) {
    categoryState[category].filters = {};
    loadRowContent(category);
    showToast(`Filters cleared for ${category.replace('-', ' ')}`);
}


function openFullView(category) {
    currentFullView = category;
    
    let filters = { ...categoryState[category].filters }; 
    filters.sort_by = filters.sort_by || 'popularity.desc'; 
    
    document.body.style.overflow = 'hidden'; 
    
    const fullViewContainer = document.createElement('div');
    fullViewContainer.id = 'full-view-modal';
    fullViewContainer.className = 'search-modal'; 
    fullViewContainer.style.display = 'flex';
    document.body.appendChild(fullViewContainer);

    const title = category.replace('-', ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    
    fullViewContainer.innerHTML = `
        <span class="close" id="full-view-close-btn" style="color: red;">&times;</span>
        <h2 style="text-transform: uppercase;">${title}</h2>
        
        <div class="full-view-controls">
            <label for="full-view-sort">Sort By:</label>
            <select id="full-view-sort">
                <option value="popularity.desc">Popularity (Descending)</option>
                <option value="release_date.desc">Release Date (Newest)</option>
                <option value="vote_average.desc">Rating (Highest)</option>
                <option value="title.asc">Title (A-Z)</option>
            </select>
        </div>
        <div class="results" id="${category}-full-list"></div>
    `;
    
    document.getElementById('full-view-close-btn').addEventListener('click', closeFullView);
    document.getElementById('full-view-sort').addEventListener('change', applyFullViewSort);
    document.getElementById('full-view-sort').value = filters.sort_by;

    categoryState[category].page = 0; 
    loadMoreFullView(category, filters, true); 
    
    const listContainer = document.getElementById(`${category}-full-list`);
    listContainer.onscroll = function () {
        scrollPosition = listContainer.scrollTop; 
        
        if (
            !categoryState[category].isLoading &&
            listContainer.scrollTop + listContainer.clientHeight >= listContainer.scrollHeight - 50
        ) {
            loadMoreFullView(category, filters);
        }
    };
}

function closeFullView() {
    const modal = document.getElementById('full-view-modal');
    if (modal) modal.remove();
    currentFullView = null;
    scrollPosition = 0; 
    document.body.style.overflow = ''; 
}

function displayFullList(items, containerId, isFirstLoad = false) {
  const container = document.getElementById(containerId);
  if (isFirstLoad) {
      container.innerHTML = ''; 
  }
  
  items.forEach(item => {
    if (container.querySelector(`img[data-id="${item.id}"]`)) return;

    const img = document.createElement('img');
    img.src = item.poster_path ? `${IMG_URL}${item.poster_path}` : FALLBACK_IMAGE;
    img.alt = item.title || item.name || 'Unknown';
    img.setAttribute('data-id', item.id);
    
    img.addEventListener('click', () => showDetails(item, true)); 
    
    container.appendChild(img);
  });
}

function applyFullViewSort() {
    if (!currentFullView) return;
    
    const sortValue = document.getElementById('full-view-sort').value;
    const category = currentFullView;
    const state = categoryState[category];

    state.filters.sort_by = sortValue;
    state.page = 0; 
    
    loadMoreFullView(category, state.filters, true);
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
    
    if (isFirstLoad && scrollPosition > 0 && container) {
        container.scrollTop = scrollPosition;
    }
  }
}

function populateFilterOptions() {
    const yearSelect = document.getElementById('filter-year');
    const genreSelect = document.getElementById('filter-genre');
    
    if (!yearSelect || !genreSelect) return; 

    // Populate Year
    const currentYear = new Date().getFullYear();
    for (let i = 0; i < 20; i++) {
        const year = currentYear - i;
        const option = new Option(year, year);
        yearSelect.appendChild(option);
    }
    
    // Populate Genre
    GENRES.forEach(genre => {
        const option = new Option(genre.name, genre.id);
        genreSelect.appendChild(option);
    });
}

function openFilterModal(category) {
    currentCategoryToFilter = category;
    
    const modalTitle = document.getElementById('filter-modal-title');
    const filterModal = document.getElementById('filter-modal');
    
    if (!modalTitle || !filterModal) return;

    const title = category.replace('-', ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    modalTitle.textContent = `Filter ${title}`;
    
    const currentFilters = categoryState[category].filters;
    document.getElementById('filter-year').value = currentFilters.year || '';
    document.getElementById('filter-genre').value = currentFilters.genre || '';
    
    filterModal.style.display = 'flex';
}

function applyFilters() {
    const year = document.getElementById('filter-year').value;
    const genre = document.getElementById('filter-genre').value;
    const category = currentCategoryToFilter;

    if (!category) return;
    
    document.getElementById('filter-modal').style.display = 'none';
    
    const newFilters = { year: year, genre: genre };

    categoryState[category].filters = newFilters;
    updateFilterButtons(category, newFilters);
    
    loadRowContent(category, newFilters);
    
    openFullView(category);
    showToast(`Filters Applied to ${category.replace('-', ' ')}`);
}


// --- DETAILS & MODAL LOGIC (MODIFIED for Auto-Highlight and Default Server) ---

// Helper function to populate server options once
function populateServerOptions() {
    const serverSelect = document.getElementById('server');
    if (!serverSelect) return;
    serverSelect.innerHTML = '';
    
    for (const key in PLAYER_CONFIG) {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = PLAYER_CONFIG[key].name;
        serverSelect.appendChild(option);
    }
}

async function showDetails(item, isFullViewOpen = false) {
  addToRecentlyViewed(item);
  currentItem = item;
  
  const userRating = loadUserRating(item.id);
  updateUserRatingDisplay(userRating);
  const progress = loadWatchProgress(item.id);
  const settings = loadUserSettings();
  const defaultServer = settings.defaultServer || 'player.videasy.net';
  
  document.getElementById('server').value = progress?.server || defaultServer; 

  document.getElementById('modal-item-title').textContent = item.title || item.name || 'Unknown';
  document.getElementById('modal-description').textContent = item.overview || 'No description available.';
  document.getElementById('modal-image').src = item.poster_path ? `${IMG_URL}${item.poster_path}` : FALLBACK_IMAGE;
  document.getElementById('modal-rating-tmdb').innerHTML = '★'.repeat(Math.round((item.vote_average || 0) / 2));
  
  const favoritesList = loadStorageList(FAVORITES_KEY);
  const isFavorite = favoritesList.some(i => i.id === item.id);
  document.getElementById('favorite-toggle').classList.toggle('active', isFavorite);
  
  // Re-attach listener for the specific item
  const favoriteToggle = document.getElementById('favorite-toggle');
  favoriteToggle.onclick = () => toggleFavorite(item);


  const seasonSelector = document.getElementById('season-selector');
  const episodeList = document.getElementById('episode-list');
  const isTVShow = item.media_type === 'tv' || (item.name && !item.title);


  if (isTVShow) {
    seasonSelector.style.display = 'block';
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
    
    currentSeason = progress?.season || seasons.find(s => s.season_number > 0)?.season_number || 1;
    seasonSelect.value = currentSeason;
    
    await loadEpisodes();
  } else {
    seasonSelector.style.display = 'none';
    episodeList.innerHTML = '';
    changeServer();
  }
  
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
  
  // Determine the episode to auto-select: Next episode from progress OR Episode 1
  let targetEpisode = (progress && progress.season == currentSeason) 
    ? (progress.episode + 1) // Start on the next episode
    : 1; 
  
  // Cap at max available episode
  if (targetEpisode > episodes.length) {
      targetEpisode = episodes.length;
  }
  // Ensure it's at least 1
  if (targetEpisode < 1 && episodes.length > 0) {
      targetEpisode = 1;
  }

  episodes.forEach(episode => {
    const div = document.createElement('div');
    div.className = 'episode-item';
    div.setAttribute('data-episode-number', episode.episode_number); 
    
    const img = episode.still_path
      ? `<img src="${IMG_URL}${episode.still_path}" alt="Episode ${episode.episode_number} thumbnail" />`
      : '';
    div.innerHTML = `${img}<span>E${episode.episode_number}: ${episode.name || 'Untitled'}</span>`;
    
    div.addEventListener('click', () => {
      currentEpisode = episode.episode_number;
      changeServer();
      document.querySelectorAll('.episode-item').forEach(e => e.classList.remove('active'));
      div.classList.add('active');
      
      saveWatchProgress(currentItem.id, document.getElementById('server').value, currentSeason, currentEpisode);
    });
    episodeList.appendChild(div);
  });
  
  if (episodes.length > 0) {
      const targetElement = episodeList.querySelector(`.episode-item[data-episode-number="${targetEpisode}"]`);
      
      if (targetElement) {
          targetElement.click(); 
          episodeList.scrollTop = targetElement.offsetTop - (episodeList.clientHeight / 2);
      } else {
          // Fallback to the very first episode if the list isn't empty
          episodeList.querySelector('.episode-item')?.click();
      }
  }
}

function changeServer() {
  if (!currentItem) return;
  const server = document.getElementById('server').value;
  const type = currentItem.media_type || (currentItem.title ? 'movie' : 'tv');
  
  saveWatchProgress(currentItem.id, server, currentSeason, currentEpisode); 

  const config = PLAYER_CONFIG[server];
  let embedURL = '';
  
  if (config) {
      embedURL = type === 'tv'
          ? config.tv(currentItem.id, currentSeason, currentEpisode)
          : config.movie(currentItem.id);
  }

  document.getElementById('modal-video').src = embedURL;
}

function closeModal() {
  document.getElementById('modal').style.display = 'none';
  document.getElementById('modal-video').src = '';
  document.getElementById('episode-list').innerHTML = '';
  document.getElementById('season-selector').style.display = 'none';
  
  document.body.style.overflow = '';
  
  const fullViewModal = document.getElementById('full-view-modal');
  if (fullViewModal) {
      fullViewModal.style.display = 'flex';
  }
}

function openSearchModal() {
  document.body.style.overflow = 'hidden'; 
  document.getElementById('search-modal').style.display = 'flex';
  document.getElementById('search-input').focus();
}

function closeSearchModal() {
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
        
        // Attach listener
        img.addEventListener('click', () => {
            closeSearchModal();
            showDetails(item);
        });
        
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


// --- EVENT LISTENER SETUP (NEW UNIFIED FUNCTION) ---

function attachListeners() {
    // Navbar/Modal Closers
    document.getElementById('search-btn').addEventListener('click', openSearchModal);
    document.getElementById('search-modal-close-btn').addEventListener('click', closeSearchModal);
    document.getElementById('modal-close-btn').addEventListener('click', closeModal);
    document.getElementById('filter-modal-close-btn').addEventListener('click', () => {
        document.getElementById('filter-modal').style.display='none';
    });

    // Slideshow Controls
    document.getElementById('prev-slide-btn').addEventListener('click', () => changeSlide(-1));
    document.getElementById('next-slide-btn').addEventListener('click', () => changeSlide(1));

    // Search Input
    document.getElementById('search-input').addEventListener('keyup', debouncedSearchTMDB);

    // Modal Controls
    document.getElementById('server').addEventListener('change', changeServer);
    document.getElementById('season').addEventListener('change', loadEpisodes);
    document.getElementById('save-default-server-btn').addEventListener('click', saveDefaultServer);
    
    // User Rating Stars
    for (let i = 1; i <= 5; i++) {
        document.getElementById(`star-${i}`).addEventListener('click', () => setUserRating(i));
    }
    
    // Filter Modal/Buttons
    document.getElementById('apply-filters-btn').addEventListener('click', applyFilters);
    
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
}


// --- INITIALIZATION ---

async function init() {
  document.getElementById('empty-message').style.display = 'none';
  
  const apiKeyValid = await testApiKey();
  if (!apiKeyValid) {
      return;
  }
  
  populateServerOptions(); // Populate server dropdown once
  attachListeners(); // Attach all event handlers
  
  // Show loading/skeletons for all sections
  const categoryIds = Object.keys(categoryState);
  categoryIds.forEach(id => showLoading(`${id}-list`));
  showLoading('shopee-link-list');
  showLoading('favorites-list'); 
  showLoading('recently-viewed-list');
  showLoading('slides');
  
  displayShopeeLinks();
  displayFavorites();
  displayRecentlyViewed();
  populateFilterOptions(); 

  // Use Promise.allSettled for robust parallel loading
  const fetchPromises = categoryIds.map(category => fetchCategoryContent(category, 1));
  const results = await Promise.allSettled(fetchPromises);
  
  let allResults = [];
  
  results.forEach((result, index) => {
    const category = categoryIds[index];
    const containerId = `${category}-list`;
    
    if (result.status === 'fulfilled' && result.value.results) {
        const data = result.value;
        displayList(data.results, containerId);
        addScrollListener(category);
        
        // Collect results for the slideshow
        allResults = allResults.concat(data.results);
    } else {
        console.error(`Failed to load ${category}:`, result.reason);
        showError(`Failed to load ${category}.`, containerId);
    }
  });

  // Display Slideshow
  slideshowItems = allResults
    .filter(item => item && item.backdrop_path)
    .sort((a, b) => (b.popularity || 0) - (a.popularity || 0)) // Sort by popularity for better quality slides
    .slice(0, 7);
    
  displaySlides();
}

init();
