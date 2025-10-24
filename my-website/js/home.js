// =====================================================================
// Reel Room - Home Logic (js/home.js)
// =====================================================================

// --- TMDB API CONSTANTS ---
const API_KEY = 'YOUR_API_KEY'; // Replace with your actual TMDB API key
const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_URL = 'https://image.tmdb.org/t/p/w500';
const FALLBACK_IMAGE = 'https://via.placeholder.com/500x750?text=Image+Not+Available';

// --- LOCAL STORAGE CONSTANTS ---
const FAVORITES_KEY = 'reelroom_favorites';
const RECENTLY_VIEWED_KEY = 'reelroom_recent';
const RATINGS_KEY = 'reelroom_ratings';
const WATCH_PROGRESS_KEY = 'reelroom_progress';
const USER_SETTINGS_KEY = 'reelroom_user_settings';
const SEARCH_HISTORY_KEY = 'reelroom_search_history'; 
const MAX_RECENT = 15;
const MAX_FAVORITES = 30;
const MAX_HISTORY = 10; 

// --- APPLICATION STATE ---
let allCategories = ['now_playing', 'popular', 'top_rated', 'upcoming'];
let favoritesList = [];
let recentlyViewed = [];
let ratings = {};
let watchProgress = {};
let isLightMode = false;
let currentCategoryToFilter = null;
let fullViewScrollPositions = {}; // Object to store scroll position per category

let searchState = {
    page: 0,
    query: '',
    isLoading: false,
    totalPages: 1
}; 

let categoryState = {
    'now_playing': { page: 1, totalPages: 1, isLoading: false },
    'popular': { page: 1, totalPages: 1, isLoading: false },
    'top_rated': { page: 1, totalPages: 1, isLoading: false },
    'upcoming': { page: 1, totalPages: 1, isLoading: false },
    'favorite': { page: 1, totalPages: 1, isLoading: false }
};

// --- UTILITY FUNCTIONS ---

/**
 * Debounce utility function to limit the rate of function calls.
 */
function debounce(func, delay) {
    let timeout;
    const debounced = function(...args) {
        const context = this;
        const later = function() {
            timeout = null;
            func.apply(context, args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, delay);
    };
    debounced.timeout = null; 
    return debounced;
}

function loadStorageList(key) {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
}

function saveStorageList(key, list) {
    localStorage.setItem(key, JSON.stringify(list));
}

function saveSettings() {
    const settings = {
        isLightMode: isLightMode
    };
    localStorage.setItem(USER_SETTINGS_KEY, JSON.stringify(settings));
}

function loadSettings() {
    const defaultSettings = {
        isLightMode: false
    };
    const settingsData = localStorage.getItem(USER_SETTINGS_KEY);
    const settings = settingsData ? JSON.parse(settingsData) : defaultSettings;

    isLightMode = settings.isLightMode === true; 

    const fullViewModal = document.getElementById('full-view-modal');
    if (isLightMode) {
        document.body.classList.add('light-mode');
        fullViewModal.classList.add('light-mode'); // FIX: Apply class to modal on load
        document.getElementById('light-mode-toggle').innerHTML = '<i class="fas fa-moon"></i>';
        document.getElementById('light-mode-toggle').title = 'Switch to Dark Mode';
    } else {
        document.getElementById('light-mode-toggle').innerHTML = '<i class="fas fa-sun"></i>';
        document.getElementById('light-mode-toggle').title = 'Switch to Light Mode';
    }
}

/**
 * Shows a toast notification.
 */
function showToast(message, duration = 3000) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, duration);
}

/**
 * Shows an error message in a specific container.
 */
function showError(message, containerId) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = `<p class="error-message">${message}</p>`;
    }
}

// --- HISTORY MANAGEMENT ---

function saveSearchQuery(query) {
    if (!query || query.length < 3) return;
    query = query.trim().toLowerCase();

    let history = loadStorageList(SEARCH_HISTORY_KEY);

    // Remove if already exists to move it to the top
    history = history.filter(q => q !== query);

    // Add the new query to the front
    history.unshift(query);

    // Limit the array size
    history = history.slice(0, MAX_HISTORY);

    saveStorageList(SEARCH_HISTORY_KEY, history);
}

function loadSearchHistory() {
    return loadStorageList(SEARCH_HISTORY_KEY);
}

function displaySearchHistory(container) {
    const history = loadSearchHistory();
    container.innerHTML = '';

    if (history.length === 0) {
        container.innerHTML = '<p style="color: var(--secondary-color); text-align: center; margin-top: 20px;">Your recent searches will appear here.</p>';
        return;
    }

    const title = document.createElement('h3');
    title.textContent = 'Recent Searches';
    title.style.margin = '10px 10px 5px';
    title.style.color = 'var(--text-color)';
    container.appendChild(title);

    const list = document.createElement('div');
    list.style.textAlign = 'left';
    list.style.padding = '0 10px';
    list.style.display = 'flex';
    list.style.flexWrap = 'wrap';

    history.forEach(query => {
        const item = document.createElement('button');
        item.className = 'history-btn';
        item.innerHTML = `<i class="fas fa-history"></i> ${query}`;

        item.addEventListener('click', () => {
            document.getElementById('search-input').value = query;
            debouncedSearchTMDB.flush(); // Execute immediately
        });
        list.appendChild(item);
    });

    container.appendChild(list);
}


// --- DATA FETCHING & RENDERING ---

/**
 * Fetches data for a category.
 */
async function fetchMovies(category, isInitialLoad = false) {
    const state = categoryState[category];
    if (state.isLoading || (!isInitialLoad && state.page >= state.totalPages)) {
        return;
    }

    state.isLoading = true;
    const listContainer = document.getElementById(`${category}-list`);

    // Only show loading if it's the first load or user scrolled to bottom of a short list
    if (isInitialLoad || listContainer.children.length === 0) {
        listContainer.innerHTML = '<p class="loading">Loading movies...</p>';
    }

    try {
        const res = await fetch(`${BASE_URL}/movie/${category}?api_key=${API_KEY}&page=${state.page}`);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();

        if (state.page === 1) {
            listContainer.innerHTML = ''; // Clear only on first page load
        } else {
            listContainer.querySelector('.loading')?.remove(); // Remove load message
        }

        state.totalPages = data.total_pages;

        data.results.forEach(movie => {
            renderMovieCard(movie, listContainer, category);
        });

    } catch (error) {
        console.error(`Error fetching ${category}:`, error);
        showError('Failed to load movies.', `${category}-list`);
    } finally {
        state.isLoading = false;
    }
}

/**
 * Renders a movie card and appends it to the container.
 */
function renderMovieCard(item, container, category) {
    const card = document.createElement('div');
    card.className = 'movie-card';
    card.dataset.id = item.id;
    card.dataset.category = category;

    const img = document.createElement('img');
    img.src = item.poster_path ? `${IMG_URL}${item.poster_path}` : FALLBACK_IMAGE;
    img.alt = item.title || item.name || 'Unknown';

    const overlay = document.createElement('div');
    overlay.className = 'card-overlay';

    const title = document.createElement('div');
    title.className = 'card-title';
    title.textContent = item.title || item.name || 'Unknown';

    overlay.appendChild(title);
    card.appendChild(img);
    card.appendChild(overlay);

    card.addEventListener('click', () => showDetails(item));
    container.appendChild(card);
}

// --- DETAILS MODAL ---

function showDetails(item) {
    // Save to recently viewed
    addToRecentlyViewed(item);
    updateRecentlyViewedList();

    const modal = document.getElementById('details-modal');
    const content = document.getElementById('details-content');

    // Show loading spinner
    content.innerHTML = '<p class="loading-full-screen">Loading details...</p>';
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden'; // Prevents body scrolling behind the modal

    // Fetch full details
    fetch(`${BASE_URL}/movie/${item.id}?api_key=${API_KEY}`)
        .then(res => res.json())
        .then(details => {
            const isFavorite = favoritesList.some(fav => fav.id === details.id);
            const currentRating = ratings[details.id] || 0;
            const progress = watchProgress[details.id] || 0;
            const runtime = details.runtime ? `${Math.floor(details.runtime / 60)}h ${details.runtime % 60}m` : 'N/A';
            const genres = details.genres.map(g => g.name).join(', ') || 'N/A';
            const year = details.release_date ? details.release_date.split('-')[0] : 'N/A';

            content.innerHTML = `
                <div class="details-header" style="background-image: linear-gradient(to top, rgba(18, 18, 18, 1), rgba(18, 18, 18, 0.5)), url(${details.backdrop_path ? `${IMG_URL}${details.backdrop_path}` : FALLBACK_IMAGE});">
                    <img src="${details.poster_path ? `${IMG_URL}${details.poster_path}` : FALLBACK_IMAGE}" alt="${details.title}" class="details-poster">
                    <div class="details-title-area">
                        <h1>${details.title}</h1>
                        <p class="details-tagline">${details.tagline || ''}</p>
                        <div class="details-meta">
                            <span><i class="fas fa-calendar"></i> ${year}</span>
                            <span><i class="fas fa-clock"></i> ${runtime}</span>
                            <span><i class="fas fa-star"></i> ${details.vote_average.toFixed(1)} / 10</span>
                        </div>
                    </div>
                </div>
                <div class="details-body">
                    <p class="details-overview">${details.overview || 'No overview available.'}</p>
                    <p class="details-genres"><strong>Genres:</strong> ${genres}</p>
                    
                    <div class="details-actions">
                        <button id="favorite-btn" class="${isFavorite ? 'active' : ''}">
                            <i class="fas fa-heart"></i> ${isFavorite ? 'In Favorites' : 'Add to Favorites'}
                        </button>
                        <button class="rating-btn" onclick="openRatingModal(${details.id}, '${details.title}')">
                            <i class="fas fa-star"></i> Rate (${currentRating > 0 ? currentRating.toFixed(1) : 'Unrated'})
                        </button>
                    </div>

                    <div class="progress-bar-container">
                        <h3>Watch Progress</h3>
                        <div class="progress-bar-wrapper">
                            <div id="progress-bar" style="width: ${progress}%;"></div>
                            <span id="progress-text">${progress}%</span>
                        </div>
                        <input type="range" min="0" max="100" value="${progress}" id="progress-slider" oninput="updateProgressDisplay(this.value)">
                    </div>

                </div>
            `;

            document.getElementById('favorite-btn').addEventListener('click', () => toggleFavorite(details));
            document.getElementById('progress-slider').addEventListener('change', (e) => saveProgress(details.id, e.target.value));

            // Initial setup for progress text
            document.getElementById('progress-text').textContent = `${progress}%`;

        })
        .catch(error => {
            console.error('Error fetching details:', error);
            showError('Failed to load movie details. Please try again.', 'details-content');
        });
}

function closeDetailsModal() {
    document.getElementById('details-modal').style.display = 'none';
    document.body.style.overflow = ''; // Important: Restore body scrolling
}

// --- FULL VIEW MODAL & ADVANCED FILTERING ---

function openFullView(category, title) {
    currentFullView = category;
    const modal = document.getElementById('full-view-modal');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Apply Light Mode class when opening the modal
    if (isLightMode) {
        modal.classList.add('light-mode');
    } else {
        modal.classList.remove('light-mode');
    }

    document.getElementById('full-view-title').textContent = title;
    // Hide all full-view lists
    document.querySelectorAll('.full-view-list').forEach(list => list.style.display = 'none');
    // Show the target list
    const listContainer = document.getElementById(`${category}-full-list`);
    listContainer.style.display = 'grid';

    document.getElementById('full-view-category').textContent = category;

    // Reset filtering UI
    document.getElementById('full-view-genre').value = '';
    document.getElementById('full-view-sort').value = 'popularity.desc';
    document.getElementById('full-view-year').value = '';
    currentCategoryToFilter = null;
    
    // Reset state and load first page
    categoryState[category].page = 1;
    categoryState[category].totalPages = 1;

    // Load initial data with default filters
    loadMoreFullView(category, {
        sort_by: 'popularity.desc',
        with_genres: '',
        primary_release_year: ''
    }, true);

    // Restore saved scroll position if available
    listContainer.scrollTop = fullViewScrollPositions[category] || 0; 

    // Setup scroll listener for pagination and saving position
    listContainer.onscroll = function () {
        // Save current scroll position
        fullViewScrollPositions[category] = listContainer.scrollTop; 

        // Check for scroll near bottom
        if (
            !categoryState[category].isLoading &&
            categoryState[category].page < categoryState[category].totalPages &&
            listContainer.scrollTop + listContainer.clientHeight >= listContainer.scrollHeight - 50
        ) {
            // Get current filter values for the next page load
            const filters = getFullViewFilters();
            loadMoreFullView(category, filters);
        }
    };
}

function closeFullView() {
    // Save scroll position before closing
    const category = document.getElementById('full-view-category').textContent;
    const listContainer = document.getElementById(`${category}-full-list`);
    fullViewScrollPositions[category] = listContainer.scrollTop; 

    document.getElementById('full-view-modal').style.display = 'none';
    document.body.style.overflow = '';
    document.getElementById('full-view-genre-list').innerHTML = '';
}

function getFullViewFilters() {
    return {
        sort_by: document.getElementById('full-view-sort').value,
        with_genres: currentCategoryToFilter, // Use the dynamically filtered genre
        primary_release_year: document.getElementById('full-view-year').value
    };
}

// Global filter application function
function applyFullViewFilters() {
    const category = document.getElementById('full-view-category').textContent;
    const filters = getFullViewFilters();

    // Reset to page 1 for a new filter query
    categoryState[category].page = 1;
    categoryState[category].totalPages = 1;

    // Scroll to top on new filter application
    document.getElementById(`${category}-full-list`).scrollTop = 0;

    loadMoreFullView(category, filters, true);
}


async function loadMoreFullView(category, filters, isFirstLoad = false) {
    const state = categoryState[category];
    if (state.isLoading || (!isFirstLoad && state.page >= state.totalPages)) {
        return;
    }

    state.isLoading = true;
    const container = document.getElementById(`${category}-full-list`);

    // Determine the API endpoint
    let endpoint;
    if (category === 'favorite') {
        // Favorites are loaded from local storage, not TMDB. This is a placeholder.
        state.isLoading = false;
        if (isFirstLoad) {
            container.innerHTML = '<p class="error-message">Filtering is disabled for Local Favorites list.</p>';
            favoritesList.forEach(item => {
                const card = document.createElement('div');
                card.className = 'full-view-card';
                card.innerHTML = `
                    <img src="${item.poster_path ? `${IMG_URL}${item.poster_path}` : FALLBACK_IMAGE}" alt="${item.title}">
                    <div class="full-view-info">
                        <h3>${item.title || item.name}</h3>
                        <p class="full-view-release"><i class="fas fa-calendar"></i> ${item.release_date ? item.release_date.split('-')[0] : 'N/A'}</p>
                        <p class="full-view-rating"><i class="fas fa-heart"></i> Favorite</p>
                        <p class="full-view-overview">Stored locally. Filtering not supported here.</p>
                    </div>
                `;
                card.addEventListener('click', () => {
                    closeFullView();
                    showDetails(item);
                });
                container.appendChild(card);
            });
            if (favoritesList.length === 0) {
                container.innerHTML = '<p class="error-message">Your favorites list is empty.</p>';
            }
        }
        state.totalPages = 1;
        return;
    } else {
        endpoint = `${BASE_URL}/discover/movie?api_key=${API_KEY}&page=${state.page}`;

        // Append filter parameters
        if (filters.sort_by) endpoint += `&sort_by=${filters.sort_by}`;
        if (filters.with_genres) endpoint += `&with_genres=${filters.with_genres}`;
        if (filters.primary_release_year) endpoint += `&primary_release_year=${filters.primary_release_year}`;
    }


    // Add loading indicator
    if (isFirstLoad) {
        container.innerHTML = '<p class="loading-full-screen">Loading movies...</p>';
    } else {
        container.querySelector('.loading-full-screen')?.remove();
        container.insertAdjacentHTML('beforeend', '<p class="loading-full-screen">Loading more...</p>');
    }

    try {
        const res = await fetch(endpoint);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        state.totalPages = data.total_pages;

        if (isFirstLoad) {
            container.innerHTML = '';
            currentFullView = category;
        } else {
            container.querySelector('.loading-full-screen')?.remove();
        }

        if (data.results.length === 0) {
            container.innerHTML = '<p class="error-message">No movies found matching these filters.</p>';
            state.totalPages = state.page; // Stop further attempts
            return;
        }

        data.results.forEach(item => {
            const card = document.createElement('div');
            card.className = 'full-view-card';
            card.innerHTML = `
                <img src="${item.poster_path ? `${IMG_URL}${item.poster_path}` : FALLBACK_IMAGE}" alt="${item.title}">
                <div class="full-view-info">
