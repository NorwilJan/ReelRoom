// js/home.js
const API_KEY = '40f1982842db35042e8561b13b38d492'; // Your original TMDB API key - UNCHANGED
const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_URL = 'https://image.tmdb.org/t/p/w500'; // Use w500 for thumbnails
const DETAIL_IMG_URL = 'https://image.tmdb.org/t/p/original'; // Use original for details modal and slideshow
const FALLBACK_IMAGE = 'https://via.placeholder.com/150x225?text=No+Image';
let currentItem;
let currentSeason = 1;
let currentEpisode = 1;
let slideshowItems = [];
let currentSlide = 0;
let slideshowInterval;

// Configuration object for magic numbers
const CONFIG = {
    ITEMS_PER_ROW: 15,
    SLIDESHOW_INTERVAL: 5000,
    MAX_YEARS: 20,
    SLIDESHOW_ITEM_COUNT: 7,
    // NEW: Define the category to be replaced by the user's genre pick
    TRENDING_CATEGORY_ID: 'movies' // Assuming 'movies' is the "trending movie row" you want to replace
};

// Centralized category configuration
const CATEGORIES = [
    { id: 'movies', type: 'movie', label: 'Movies', params: '' },
    { id: 'tvshows', type: 'tv', label: 'TV Shows', params: '' },
    { id: 'anime', type: 'tv', label: 'Anime', params: '&with_genres=16&with_original_language=ja' },
    { id: 'tagalog-movies', type: 'movie', label: 'Tagalog Movies', params: '&with_original_language=tl' },
    { id: 'netflix-movies', type: 'movie', label: 'Netflix Movies', params: '&with_watch_providers=8&watch_region=US' },
    { id: 'netflix-tv', type: 'tv', label: 'Netflix TV', params: '&with_watch_providers=8&watch_region=US' },
    { id: 'korean-drama', type: 'tv', label: 'Korean Drama', params: '&with_original_language=ko&with_genres=18' }
];

// Category state with scroll position
let categoryState = CATEGORIES.reduce((state, cat) => ({
    ...state,
    [cat.id]: { 
        page: 1, 
        isLoading: false, 
        filters: {}, 
        scrollPosition: 0, 
        isFullView: false, // NEW: Track if it's in full view mode
        isInfiniteScroll: false // NEW: Track if it's in infinite scroll mode
    }
}), {});

let currentFullView = null;
let currentCategoryToFilter = null;
// NEW: State for the category that replaces the trending row
let trendingReplacement = null;

// Simplified Genre IDs for the filter dropdown
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
 */
function debounce(func, delay) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}

/**
 * Function to test API Key validity on startup.
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
        // Determine the type and configuration based on the category ID or the temporary trending replacement
        let catConfig = CATEGORIES.find(c => c.id === category);
        let catType = catConfig ? catConfig.type : 'movie';
        let extraParams = catConfig ? catConfig.params : '';

        // If this is the trending replacement, use the temporary config
        if (category === CONFIG.TRENDING_CATEGORY_ID && trendingReplacement && trendingReplacement.filters) {
            // This is a temporary category based on a genre pick, so we'll use a dynamic label/params
            catConfig = { id: category, type: 'movie', label: trendingReplacement.label, params: '' };
        }
        
        if (!catConfig) throw new Error('Unknown category.');


        const baseParams = `&page=${page}&include_adult=false&include_video=false&sort_by=popularity.desc`;
        let filterParams = filters.year ? `&primary_release_year=${filters.year}` : '';
        let genreParams = '';

        // Handle genre combination: merge base category genres with user-selected genre
        if (filters.genre) {
            let baseGenres = '';
            const genreMatch = extraParams.match(/&with_genres=([^&]*)/);
            if (genreMatch) {
                baseGenres = genreMatch[1];
                extraParams = extraParams.replace(genreMatch[0], ''); // Remove base genres from extraParams
            }
            const combinedGenres = baseGenres ? `${baseGenres},${filters.genre}` : filters.genre;
            genreParams = `&with_genres=${combinedGenres}`;
        }

        const fetchURL = `${BASE_URL}/discover/${catType}?api_key=${API_KEY}${extraParams}${baseParams}${filterParams}${genreParams}`;
        console.log(`Fetching ${category} with URL: ${fetchURL}`); // Debug log

        const res = await fetch(fetchURL);
        if (!res.ok) {
            if (res.status === 429) throw new Error('Rate limit exceeded. Please try again later.');
            if (res.status === 404) throw new Error('Content not found for this category.');
            throw new Error(`HTTP ${res.status}: Failed to fetch ${catConfig.label}.`);
        }
        const data = await res.json();

        if (data.results) {
            data.results.forEach(item => item.media_type = item.media_type || catType);
        }
        return data;
    } catch (error) {
        console.error(`Error fetching ${category}:`, error);
        showError(`Failed to load ${CATEGORIES.find(c => c.id === category)?.label || category}: ${error.message}`, `${category}-list`);
        return { results: [], total_pages: 1 };
    }
}

// --- UI UTILITIES ---

function removeLoadingAndError(containerId) {
    const container = document.getElementById(containerId);
    if (container) {
        container.querySelector('.loading')?.remove();
        container.querySelector('.error-message')?.remove();
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

    const loading = document.createElement('p');
    loading.className = 'loading';
    loading.textContent = 'Loading...';
    container.appendChild(loading);
}

// Lazy load category rows using IntersectionObserver
function setupLazyLoading() {
    const rows = document.querySelectorAll('.category-row');
    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const category = entry.target.getAttribute('data-category');
                loadRowContent(category, categoryState[category].filters);
                observer.unobserve(entry.target);
            }
        });
    }, { rootMargin: '100px' });

    rows.forEach(row => observer.observe(row));
}

// --- SLIDESHOW LOGIC ---

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
        slide.style.backgroundImage = `url(${DETAIL_IMG_URL}${item.backdrop_path})`;
        slide.innerHTML = `<h1>${item.title || item.name || 'Unknown'}</h1>`;
        slide.onclick = () => showDetails(item);
        slide.tabIndex = 0;
        slide.onkeydown = (e) => {
            if (e.key === 'Enter' || e.key === ' ') showDetails(item);
        };
        slidesContainer.appendChild(slide);

        const dot = document.createElement('span');
        dot.className = 'dot';
        dot.tabIndex = 0;
        if (index === currentSlide) dot.className += ' active';
        dot.onclick = () => {
            currentSlide = index;
            showSlide();
        };
        dot.onkeydown = (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                currentSlide = index;
                showSlide();
            }
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
    }, CONFIG.SLIDESHOW_INTERVAL);
}

function changeSlide(n) {
    const slides = document.querySelectorAll('.slide');
    if (slides.length === 0) return;
    currentSlide = (currentSlide + n + slides.length) % slides.length;
    showSlide();
}

// --- MAIN PAGE LIST DISPLAY ---

function displayItems(items, containerId, append = false) { // MODIFIED: Added 'append'
    const container = document.getElementById(containerId);
    if (!container) return;
    
    // NEW: Only clear if not appending
    if (!append) container.innerHTML = '';
    
    removeLoadingAndError(containerId);

    if (items.length === 0 && !append) { // MODIFIED: Check for !append to not overwrite existing content when appending
        container.innerHTML = `
            <p style="color: #ccc; text-align: center; width: 100%;">
                No content matches your filters.
                <button class="reset-filters-btn" onclick="clearFilters('${containerId.split('-list')[0]}')">
                    Reset Filters
                </button>
            </p>`;
        return;
    }

    items.forEach(item => {
        // Check if item already exists (important for infinite scroll)
        if (container.querySelector(`img[data-id="${item.id}"]`)) return;
        
        const img = document.createElement('img');
        img.src = item.poster_path ? `${IMG_URL}${item.poster_path}` : FALLBACK_IMAGE;
        img.alt = `${item.title || item.name || 'Unknown'} (${item.media_type}, ${item.release_date || item.first_air_date || 'N/A'})`;
        img.setAttribute('data-id', item.id);
        img.loading = 'lazy';
        img.tabIndex = 0;
        img.onclick = () => showDetails(item, categoryState[containerId.split('-list')[0]].isFullView); // MODIFIED: Pass state to showDetails
        img.onkeydown = (e) => {
            if (e.key === 'Enter' || e.key === ' ') showDetails(item, categoryState[containerId.split('-list')[0]].isFullView); // MODIFIED: Pass state to showDetails
        };
        container.appendChild(img);
    });
}

// --- FULL VIEW / INFINITE SCROLL LOGIC ---

function updateRowUI(category, filters) {
    const row = document.getElementById(`${category}-row`);
    if (!row) return; // For temporary rows like the trending replacement

    const rowTitle = row.querySelector('.category-title');
    const filterBtn = row.querySelector('.filter-btn');
    const clearBtn = row.querySelector('.clear-filter-btn');
    const showMoreLink = row.querySelector('.show-more-link');

    // Update Title if it's the trending replacement
    if (category === CONFIG.TRENDING_CATEGORY_ID && trendingReplacement && trendingReplacement.label) {
        rowTitle.textContent = trendingReplacement.label;
    } else {
        const catConfig = CATEGORIES.find(c => c.id === category);
        rowTitle.textContent = catConfig ? catConfig.label : category;
    }

    const isFiltered = filters.year || filters.genre;

    if (isFiltered) {
        const genreName = filters.genre ? (GENRES.find(g => g.id == filters.genre)?.name || 'Genre') : '';
        const yearText = filters.year || '';
        filterBtn.textContent = `Filtered ${genreName} ${yearText}`.trim();
        filterBtn.style.background = 'red';
        filterBtn.style.color = 'white';
        clearBtn.style.display = 'inline-block';
        showMoreLink.textContent = 'Show All (Filtered)'; // MODIFIED: Indicate filtered state
    } else {
        filterBtn.innerHTML = '<i class="fas fa-filter"></i> Filter';
        filterBtn.style.background = '#444';
        filterBtn.style.color = '#fff';
        clearBtn.style.display = 'none';
        showMoreLink.textContent = 'Show More';
    }
}

// MODIFIED: loadRowContent is now primarily for the initial load of the row.
async function loadRowContent(category, filters = {}) {
    const state = categoryState[category];
    if (state.isLoading) return;

    state.isLoading = true;
    const containerId = `${category}-list`;
    showLoading(containerId);

    // Reset page and infinite scroll state
    state.page = 1; 
    state.filters = filters;
    state.isFullView = false;
    state.isInfiniteScroll = false; // Reset to false

    const data = await fetchCategoryContent(category, state.page, filters);

    // Initial load: Only show ITEMS_PER_ROW
    displayItems(data.results.slice(0, CONFIG.ITEMS_PER_ROW), containerId);
    updateRowUI(category, filters);

    // NEW: If there are more items than the row limit, and the user hasn't pressed 'Show More', 
    // we want to initiate infinite scroll for the row itself.
    if (data.total_pages > 1) {
        // Attach infinite scroll logic to the row container
        const rowListContainer = document.getElementById(containerId);
        // Only attach if not already attached and we have more than one page of content
        if (!rowListContainer.getAttribute('data-scroll-attached')) {
            rowListContainer.setAttribute('data-scroll-attached', 'true');
            // The row itself should handle the scroll, which is not typical for a single-row design.
            // We'll use an IntersectionObserver on the *last item* of the initial load.
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting && !state.isFullView) {
                        // User has scrolled to the last item and is still in the row view
                        if (!state.isLoading && data.total_pages > state.page) {
                            state.isInfiniteScroll = true; // Activate infinite scroll for this row
                            loadMoreRowContent(category, filters);
                        }
                        observer.unobserve(entry.target); // Stop observing the old last item
                    }
                });
            }, { rootMargin: '100px' });
            
            // Observe the last item loaded
            const lastItem = rowListContainer.lastElementChild;
            if (lastItem) observer.observe(lastItem);
            
            // To ensure the observer is set up, the infinite scroll will be triggered in loadMoreRowContent
            // The show-more button is still there as a fallback/alternative.
        }
    }


    state.isLoading = false;
    document.getElementById(containerId)?.querySelector('.loading')?.remove();
}

// NEW: Function to load more content specifically for the main row (infinite scroll on the row)
async function loadMoreRowContent(category, filters) {
    const state = categoryState[category];
    const containerId = `${category}-list`;

    if (state.isLoading || !state.isInfiniteScroll) return; // Only load if in infinite scroll mode

    state.isLoading = true;
    showLoading(containerId);

    state.page++; 
    let currentPage = state.page;

    try {
        const data = await fetchCategoryContent(category, currentPage, filters);
        const items = data.results || [];

        if (items.length === 0) {
            state.page--;
            console.log(`${category} row reached end of content.`);
            state.isInfiniteScroll = false; // Disable infinite scroll if no more results
            return;
        }

        displayItems(items, containerId, true); // Append items

        // Setup observer for the *new* last item
        const rowListContainer = document.getElementById(containerId);
        const newLastItem = rowListContainer.lastElementChild;
        if (newLastItem) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting && !state.isFullView) {
                        if (!state.isLoading && data.total_pages > state.page) {
                            loadMoreRowContent(category, filters);
                        }
                        observer.unobserve(entry.target);
                    }
                });
            }, { rootMargin: '100px' });
            observer.observe(newLastItem);
        } else {
             state.isInfiniteScroll = false; // Disable if somehow no new items
        }

    } catch (error) {
        console.error(`Error loading more row content for ${category}:`, error);
        showError(`Failed to load more row content for ${category}: ${error.message}`, containerId);
        state.page--;
    } finally {
        state.isLoading = false;
        document.getElementById(containerId)?.querySelector('.loading')?.remove();
    }
}

function clearFilters(category) {
    // NEW: Clear trending replacement if this is the trending category
    if (category === CONFIG.TRENDING_CATEGORY_ID) {
        trendingReplacement = null;
    }
    categoryState[category].filters = {};
    categoryState[category].scrollPosition = 0;
    // MODIFIED: Re-load the row content, which will reset the view and filters
    loadRowContent(category);
}

function openFullView(category) {
    currentFullView = category;
    const state = categoryState[category];
    const filters = state.filters;

    // MODIFIED: Set the state to indicate full view
    state.isFullView = true;
    state.isInfiniteScroll = false; // Disable row infinite scroll

    const fullViewContainer = document.createElement('div');
    fullViewContainer.id = 'full-view-modal';
    fullViewContainer.className = 'search-modal';
    fullViewContainer.style.display = 'flex';
    document.body.appendChild(fullViewContainer);

    // Determine the title, accounting for the trending replacement
    let title = CATEGORIES.find(c => c.id === category)?.label || category.replace('-', ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    if (category === CONFIG.TRENDING_CATEGORY_ID && trendingReplacement && trendingReplacement.label) {
        title = trendingReplacement.label;
    }
    
    fullViewContainer.innerHTML = `
        <span class="close" onclick="closeFullView()" style="color: red;" tabIndex="0" onkeydown="if(event.key === 'Enter') closeFullView()">&times;</span>
        <h2 style="text-transform: uppercase;">${title}</h2>
        <div class="results" id="${category}-full-list"></div>
    `;

    // MODIFIED: Reset page to 0 and load first page in full view
    state.page = 0;
    loadMoreFullView(category, filters);

    const listContainer = document.getElementById(`${category}-full-list`);
    listContainer.onscroll = function () {
        state.scrollPosition = listContainer.scrollTop;
        if (
            !state.isLoading &&
            listContainer.scrollTop + listContainer.clientHeight >= listContainer.scrollHeight - 50
        ) {
            loadMoreFullView(category, filters);
        }
    };

    if (state.scrollPosition) {
        listContainer.scrollTop = state.scrollPosition;
    }
}

function closeFullView() {
    const category = currentFullView;
    const modal = document.getElementById('full-view-modal');
    if (modal) modal.remove();
    currentFullView = null;
    if (categoryState[category]) {
        categoryState[category].isFullView = false;
        // Re-initiate row infinite scroll logic if it was loading more before
        // This is handled by loadRowContent on clearFilters, but we reset the flag here
        // If the user hasn't scrolled far enough, the row will just display the initial items
    }
}

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
        const data = await fetchCategoryContent(category, currentPage, filters);
        const items = data.results || [];

        if (items.length === 0) {
            if (currentPage > 1) {
                state.page--;
            }
            console.log(`${category} reached end of available content or found no content matching filter.`);
            document.getElementById(containerId)?.querySelector('.loading')?.remove();
            state.isLoading = false;
            if (container.children.length === 0) {
                container.innerHTML = `
                    <p style="color: #ccc; text-align: center; width: 100%;">
                        No content matches your active filter in the full view.
                        <button class="reset-filters-btn" onclick="clearFilters('${category}')">
                            Reset Filters
                        </button>
                    </p>`;
            }
            return;
        }

        // MODIFIED: Append is true for full view infinite scroll
        displayItems(items, containerId, true);

    } catch (error) {
        console.error(`Error loading more for ${category}:`, error);
        showError(`Failed to load more ${CATEGORIES.find(c => c.id === category)?.label || category}: ${error.message}`, containerId);
        state.page--;
    } finally {
        state.isLoading = false;
        document.getElementById(containerId)?.querySelector('.loading')?.remove();
        if (currentPage === 1 && state.scrollPosition > 0) {
            // Restore scroll position only on the first page load in full view
            container.scrollTop = state.scrollPosition;
        }
    }
}

// --- FILTER MODAL LOGIC ---

function populateFilterOptions() {
    const yearSelect = document.getElementById('filter-year');
    const genreSelect = document.getElementById('filter-genre');

    yearSelect.innerHTML = '<option value="">Any Year</option>';
    genreSelect.innerHTML = '<option value="">Any Genre</option>';

    const currentYear = new Date().getFullYear();
    for (let i = 0; i < CONFIG.MAX_YEARS; i++) {
        const year = currentYear - i;
        const option = new Option(year, year);
        yearSelect.appendChild(option);
    }

    GENRES.forEach(genre => {
        const option = new Option(genre.name, genre.id);
        genreSelect.appendChild(option);
    });

    [yearSelect, genreSelect].forEach(select => {
        select.tabIndex = 0;
        select.onkeydown = (e) => {
            if (e.key === 'Enter') select.focus();
        };
    });
    
    // NEW: Populate genre picker for the trending movie row replacement
    const trendingGenreSelect = document.getElementById('trending-genre-picker');
    if (trendingGenreSelect) {
        trendingGenreSelect.innerHTML = '<option value="">Pick a Genre...</option>';
        GENRES.forEach(genre => {
            const option = new Option(genre.name, genre.id);
            trendingGenreSelect.appendChild(option);
        });
        // Check if a replacement is already active
        if (trendingReplacement && trendingReplacement.filters.genre) {
            trendingGenreSelect.value = trendingReplacement.filters.genre;
        }
    }
}

function openFilterModal(category) {
    currentCategoryToFilter = category;
    const title = CATEGORIES.find(c => c.id === category)?.label || category.replace('-', ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    document.getElementById('filter-modal-title').textContent = `Filter ${title}`;

    const currentFilters = categoryState[category].filters;
    document.getElementById('filter-year').value = currentFilters.year || '';
    document.getElementById('filter-genre').value = currentFilters.genre || '';

    document.getElementById('filter-modal').style.display = 'flex';
}

function applyFilters() {
    const year = document.getElementById('filter-year').value;
    const genre = document.getElementById('filter-genre').value;
    const category = currentCategoryToFilter;

    console.log(`Applying filters for ${category}: year=${year}, genre=${genre}`); // Debug log

    document.getElementById('filter-modal').style.display = 'none';

    const newFilters = { year: year, genre: genre };
    categoryState[category].filters = newFilters;
    categoryState[category].scrollPosition = 0;
    
    // MODIFIED: Immediately open full view after applying filters, as requested
    openFullView(category);
}

// NEW: Function to handle the trending genre pick
function applyTrendingGenre() {
    const genreId = document.getElementById('trending-genre-picker').value;
    const category = CONFIG.TRENDING_CATEGORY_ID;
    
    if (!genreId) {
        // If the user selects "Pick a Genre...", revert to default 'movies'
        clearFilters(category);
        return;
    }
    
    const genreName = GENRES.find(g => g.id == genreId)?.name;
    const newFilters = { genre: genreId, year: '' }; // Only filter by genre, clear year
    
    // Set the global state for the replacement
    trendingReplacement = {
        label: `${genreName} Movies`,
        filters: newFilters
    };
    
    // Apply filters to the 'movies' category state
    categoryState[category].filters = newFilters;
    categoryState[category].scrollPosition = 0;
    
    // Re-load the 'movies' row with the new genre filter
    loadRowContent(category, newFilters);
}


// --- DETAILS MODAL LOGIC (UNCHANGED) ---

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

async function showDetails(item, isFullViewOpen = false) {
    currentItem = item;
    currentSeason = 1;
    currentEpisode = 1;
    document.getElementById('modal-title').textContent = item.title || item.name || 'Unknown';
    document.getElementById('modal-description').textContent = item.overview || 'No description available.';
    document.getElementById('modal-image').src = item.poster_path ? `${DETAIL_IMG_URL}${item.poster_path}` : FALLBACK_IMAGE;
    document.getElementById('modal-rating').innerHTML = '★'.repeat(Math.round((item.vote_average || 0) / 2));
    document.getElementById('server').value = 'player.videasy.net';

    const seasonSelector = document.getElementById('season-selector');
    const episodeList = document.getElementById('episode-list');
    const isTVShow = item.media_type === 'tv' || (item.name && !item.title);

    if (isTVShow) {
        seasonSelector.style.display = 'block';
        const seasons = await fetchSeasonsAndEpisodes(item.id);
        const seasonSelect = document.getElementById('season');
        seasonSelect.innerHTML = '';

        if (seasons.length === 0) {
            episodeList.innerHTML = '<p style="color: #ccc; text-align: center;">No seasons available.</p>';
            seasonSelector.style.display = 'none';
            changeServer();
            document.getElementById('modal').style.display = 'flex';
            if (isFullViewOpen) {
                document.getElementById('full-view-modal').style.display = 'none';
            }
            return;
        }

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

async function loadEpisodes() {
    if (!currentItem) return;
    const seasonNumber = document.getElementById('season').value;
    currentSeason = seasonNumber;
    const episodes = await fetchEpisodes(currentItem.id, seasonNumber);
    const episodeList = document.getElementById('episode-list');
    episodeList.innerHTML = '';
    currentEpisode = 1;

    if (episodes.length === 0) {
        episodeList.innerHTML = '<p style="color: #ccc; text-align: center;">No episodes available for this season.</p>';
        changeServer();
        return;
    }

    episodes.forEach(episode => {
        const div = document.createElement('div');
        div.className = 'episode-item';
        div.tabIndex = 0;
        const img = episode.still_path
            ? `<img src="${IMG_URL}${episode.still_path}" alt="Episode ${episode.episode_number} thumbnail" loading="lazy" />`
            : '';
        div.innerHTML = `${img}<span>E${episode.episode_number}: ${episode.name || 'Untitled'}</span>`;
        div.onclick = () => {
            currentEpisode = episode.episode_number;
            changeServer();
            document.querySelectorAll('.episode-item').forEach(e => e.classList.remove('active'));
            div.classList.add('active');
        };
        div.onkeydown = (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                currentEpisode = episode.episode_number;
                changeServer();
                document.querySelectorAll('.episode-item').forEach(e => e.classList.remove('active'));
                div.classList.add('active');
            }
        };
        episodeList.appendChild(div);
    });

    if (episodes.length > 0) {
        episodeList.querySelector('.episode-item')?.click();
    }
}

function changeServer() {
    if (!currentItem) return;
    const server = document.getElementById('server').value;
    const type = currentItem.media_type || (currentItem.title ? 'movie' : 'tv');
    let embedURL = '';

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

    const videoElement = document.getElementById('modal-video');
    videoElement.src = embedURL;
    videoElement.onerror = () => {
        showError('Video failed to load. Please try another server.', 'modal');
        videoElement.src = '';
    };
}

function closeModal() {
    document.getElementById('modal').style.display = 'none';
    document.getElementById('modal-video').src = '';
    document.getElementById('episode-list').innerHTML = '';
    document.getElementById('season-selector').style.display = 'none';

    const fullViewModal = document.getElementById('full-view-modal');
    if (fullViewModal) {
        // MODIFIED: Do not display full view modal if it was open. It was closed by showDetails
        // Instead, we just let the user re-open it if they want.
        // If you absolutely want it to pop back up, uncomment the lines below:
        // fullViewModal.style.display = 'flex';
    }
}

// --- SEARCH MODAL LOGIC (UNCHANGED) ---

function openSearchModal() {
    document.getElementById('search-modal').style.display = 'flex';
    document.getElementById('search-input').focus();
}

function closeSearchModal() {
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
        if (!res.ok) throw new Error(`HTTP ${res.status}: Search failed.`);
        const data = await res.json();

        container.innerHTML = '';
        data.results
            .filter(item => item.media_type !== 'person' && item.poster_path)
            .forEach(item => {
                const img = document.createElement('img');
                img.src = item.poster_path ? `${IMG_URL}${item.poster_path}` : FALLBACK_IMAGE;
                img.alt = `${item.title || item.name || 'Unknown'} (${item.media_type}, ${item.release_date || item.first_air_date || 'N/A'})`;
                img.loading = 'lazy';
                img.tabIndex = 0;
                img.onclick = () => {
                    closeSearchModal();
                    showDetails(item);
                };
                img.onkeydown = (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        closeSearchModal();
                        showDetails(item);
                    }
                };
                container.appendChild(img);
            });

        if (container.children.length === 0) {
            container.innerHTML = '<p style="color: #ccc; text-align: center; margin-top: 20px;">No results found for your search.</p>';
        }

    } catch (error) {
        console.error('Error searching:', error);
        showError(`Search failed: ${error.message}`, 'search-results');
    }
}, 300);

// --- INITIALIZATION ---

// NEW: Function to create the trending genre picker
function createTrendingGenrePicker() {
    const pickerContainer = document.getElementById(`${CONFIG.TRENDING_CATEGORY_ID}-row`)?.querySelector('.category-header');
    if (!pickerContainer) return;
    
    // Create the select element for genre picking
    const select = document.createElement('select');
    select.id = 'trending-genre-picker';
    select.className = 'filter-select';
    select.style.marginLeft = '10px';
    select.onchange = applyTrendingGenre;
    
    // Find the category title element
    const title = pickerContainer.querySelector('.category-title');
    
    // Insert the select element after the title
    if (title) {
        title.insertAdjacentElement('afterend', select);
    } else {
        pickerContainer.appendChild(select);
    }
}

async function init() {
    document.getElementById('empty-message').style.display = 'none';

    const apiKeyValid = await testApiKey();
    if (!apiKeyValid) {
        return;
    }
    
    // NEW: Create and populate the trending genre picker before populating other filters
    createTrendingGenrePicker();
    populateFilterOptions();

    document.querySelectorAll('.show-more-link').forEach(link => {
        link.tabIndex = 0;
        link.addEventListener('click', (e) => {
            e.preventDefault();
            // MODIFIED: Load Full View
            openFullView(link.getAttribute('data-category'));
        });
        link.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') openFullView(link.getAttribute('data-category'));
        });
    });

    document.querySelectorAll('.filter-btn').forEach(button => {
        button.tabIndex = 0;
        button.addEventListener('click', (e) => {
            e.preventDefault();
            openFilterModal(button.getAttribute('data-category'));
        });
        button.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') openFilterModal(button.getAttribute('data-category'));
        });
    });

    document.querySelectorAll('.clear-filter-btn').forEach(button => {
        button.tabIndex = 0;
        button.addEventListener('click', (e) => {
            e.preventDefault();
            clearFilters(button.getAttribute('data-category'));
        });
        button.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') clearFilters(button.getAttribute('data-category'));
        });
    });

    try {
        showLoading('slides');
        CATEGORIES.forEach(cat => showLoading(`${cat.id}-list`));

        const categoryData = await Promise.all(
            CATEGORIES.map(cat => fetchCategoryContent(cat.id, 1))
        );

        const allResults = categoryData
            .flatMap(data => data.results)
            .filter(item => item && item.backdrop_path);

        slideshowItems = allResults.slice(0, CONFIG.SLIDESHOW_ITEM_COUNT);
        displaySlides();

        CATEGORIES.forEach((cat, index) => {
            // Check if this is the trending category and a replacement genre is set
            let filters = {};
            if (cat.id === CONFIG.TRENDING_CATEGORY_ID && trendingReplacement) {
                filters = trendingReplacement.filters;
            }
            // MODIFIED: Use loadRowContent to ensure filters and UI are updated and infinite scroll is set up
            loadRowContent(cat.id, filters); 
        });

        setupLazyLoading();

    } catch (error) {
        console.error('Fatal initialization error:', error);
        showError(`Failed to load content categories: ${error.message}`, 'empty-message');
        document.getElementById('empty-message').style.display = 'block';
    }
}

init();
