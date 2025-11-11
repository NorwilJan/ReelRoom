/**
 * js/app.js
 * * CORE JAVASCRIPT LOGIC FOR THE MEDIA BROWSING APPLICATION
 */

// --- 1. Global State Management & Constants ---
const API_BASE_URL = 'http://api.myserver.com/v1'; // Replace with actual API endpoint
const MEDIA_TYPE_MOVIE = 'movie';
const MEDIA_TYPE_SERIES = 'series';

// State object to hold dynamic data and UI settings
let appState = {
    // Media Lists
    trending: [],
    popular: [],
    newReleases: [],
    // Currently Active Filters
    activeFilters: {
        genre: 'All',
        year: 'All',
        type: MEDIA_TYPE_MOVIE // Default starting type
    },
    // Search State
    searchQuery: '',
    searchResults: [],
    // Modals & Active Items
    isModalOpen: false,
    activeItem: null, // The item currently displayed in the modal
    // For Series/Episodes
    activeSeason: 1,
    activeEpisode: 1,
    // Theme
    isLightMode: false
};

// --- 2. Utility Functions ---

/**
 * Fetches data from the specified API path.
 * @param {string} path - The API endpoint path (e.g., 'trending/movie').
 * @returns {Promise<Array>} - The array of media items.
 */
async function fetchData(path) {
    try {
        const response = await fetch(`${API_BASE_URL}/${path}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        // Assuming the API returns an array of items under a 'results' key
        return data.results || [];
    } catch (error) {
        console.error("Error fetching data:", error);
        showToast(`Failed to load data: ${path}`, 'error');
        return [];
    }
}

/**
 * Shows a temporary toast notification.
 * @param {string} message - The message to display.
 * @param {'success'|'error'|'info'} type - Type of toast.
 */
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    // Use requestAnimationFrame for smooth transition start
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    // Automatically hide after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        // Wait for transition to complete before removing
        toast.addEventListener('transitionend', () => toast.remove());
    }, 3000);
}

// --- 3. Rendering and DOM Manipulation ---

/**
 * Creates the HTML for a single media card/item.
 * @param {Object} item - The media item object.
 * @param {boolean} isLoading - If true, render a skeleton loading state.
 * @returns {string} - The HTML string for the item.
 */
function createMediaCardHTML(item, isLoading = false) {
    if (isLoading) {
        // Skeleton HTML
        return `
            <div class="skeleton" style="min-width: 150px; height: 225px; margin-right: 10px;"></div>
        `;
    }

    const imageSrc = item.poster_path ? `http://image.myserver.com/${item.poster_path}` : 'placeholder.jpg';
    
    // Use data attributes to store essential info for click handler
    return `
        <a href="#" data-id="${item.id}" data-type="${item.media_type || appState.activeFilters.type}" onclick="handleItemClick(event)">
            <img 
                src="${imageSrc}" 
                alt="${item.title || item.name}" 
                title="${item.title || item.name}" 
                loading="lazy"
            />
        </a>
    `;
}

/**
 * Renders a list of media items into a specified container.
 * @param {string} containerId - The ID of the HTML element to render into.
 * @param {Array<Object>} items - The array of media items.
 * @param {boolean} loading - If true, render skeletons.
 */
function renderMediaList(containerId, items, loading = false) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (loading) {
        // Render 10 skeletons
        container.innerHTML = Array(10).fill().map(() => createMediaCardHTML(null, true)).join('');
        container.classList.add('loading-list');
        return;
    }

    container.classList.remove('loading-list');

    if (items.length === 0) {
        container.innerHTML = '<p class="error-message">No results found.</p>';
        return;
    }

    // Render actual items
    container.innerHTML = items.map(item => createMediaCardHTML(item)).join('');
}


// --- 4. Modals and Detail View (Core User Interaction) ---

/**
 * Opens the detail modal for a specific media item.
 * @param {Object} item - The detailed media item object.
 */
function openModal(item) {
    appState.activeItem = item;
    appState.isModalOpen = true;

    // Set initial active season/episode if it's a series
    if (item.media_type === MEDIA_TYPE_SERIES && item.seasons && item.seasons.length > 0) {
        appState.activeSeason = 1;
        appState.activeEpisode = 1; // Default to S1 E1
    }

    const modal = document.getElementById('mediaDetailModal');
    const content = document.getElementById('modalContent');
    const isSeries = item.media_type === MEDIA_TYPE_SERIES;

    // --- Dynamic Content Generation ---
    const imageSrc = item.poster_path ? `http://image.myserver.com/${item.poster_path}` : 'placeholder.jpg';
    const title = item.title || item.name;
    const releaseDate = item.release_date || item.first_air_date;
    const runtime = item.runtime || (item.episode_run_time ? `${item.episode_run_time[0]}m` : 'N/A');
    const genres = item.genres ? item.genres.map(g => g.name).join(', ') : 'N/A';
    const tagline = item.tagline ? `<p><em>"${item.tagline}"</em></p>` : '';

    let seriesControlsHTML = '';
    let videoPlayerHTML = `
        <div class="video-player-container">
            <iframe 
                id="mediaPlayer"
                src="https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1&mute=1" 
                frameborder="0" 
                allow="autoplay; encrypted-media; picture-in-picture" 
                allowfullscreen
            ></iframe>
            <div class="player-controls">
                <button class="player-control-btn" onclick="markWatched(event)"><i class="fas fa-eye"></i> Watched</button>
                <button class="player-control-btn" onclick="toggleFavorite(event)"><i class="fas fa-heart"></i> Favorite</button>
            </div>
        </div>
    `;

    if (isSeries) {
        // Create Season Selector
        const seasonOptions = item.seasons.map((s, index) => 
            `<option value="${s.season_number || index + 1}">S${s.season_number || index + 1}: ${s.name || 'Season ' + (index + 1)}</option>`
        ).join('');

        seriesControlsHTML = `
            <div class="season-selector">
                <label for="season-select">Season:</label>
                <select id="season-select" onchange="handleSeasonChange(this.value)">
                    ${seasonOptions}
                </select>
            </div>
            <div id="episode-list-container">
                </div>
        `;
    }

    // --- Final Modal Structure ---
    content.innerHTML = `
        <div class="video-player-section">
            ${videoPlayerHTML}
        </div>
        <div class="modal-body">
            <img src="${imageSrc}" alt="${title}" />
            <div class="modal-text">
                <h2>${title} 
                    <i class="favorite-icon fas fa-heart ${item.isFavorite ? 'active' : ''}" onclick="toggleFavorite()"></i>
                </h2>
                ${tagline}
                <p><strong>Release:</strong> ${releaseDate}</p>
                <p><strong>Runtime:</strong> ${runtime}</p>
                <p><strong>Genre:</strong> ${genres}</p>
                <p><strong>Rating:</strong> <span class="stars">${'★'.repeat(Math.floor(item.vote_average / 2))}</span> (${item.vote_average})</p>
                <p><strong>Overview:</strong> ${item.overview}</p>
                
                ${isSeries ? '' : '<button class="filter-btn" style="margin-top: 15px;" onclick="playTrailer()">Play Trailer</button>'}
            </div>
        </div>
        ${seriesControlsHTML}
        <span class="close" onclick="closeModal()">&times;</span>
    `;

    if (isSeries) {
        renderEpisodeList(item, appState.activeSeason);
    }
    
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
}

/**
 * Renders the episode list for the currently active season.
 * @param {Object} item - The active series item.
 * @param {number} seasonNumber - The season to render.
 */
function renderEpisodeList(item, seasonNumber) {
    const episodeContainer = document.getElementById('episode-list-container');
    if (!episodeContainer || !item.seasons) return;

    const seasonData = item.seasons.find(s => (s.season_number || 1) == seasonNumber);
    if (!seasonData || !seasonData.episodes) {
        episodeContainer.innerHTML = '<p class="error-message">No episode data available for this season.</p>';
        return;
    }

    // Simple placeholder for watched status
    const isEpisodeWatched = (epId) => {
        // In a real app, this would check localStorage or a backend user profile
        return localStorage.getItem(`watched_${item.id}_${seasonNumber}_${epId}`) === 'true';
    };

    const episodesHTML = seasonData.episodes.map(ep => {
        const isCurrent = ep.episode_number == appState.activeEpisode && seasonNumber == appState.activeSeason;
        const isWatched = isEpisodeWatched(ep.episode_number);
        const watchedClass = isWatched ? 'watched' : '';

        return `
            <div 
                class="episode-item ${isCurrent ? 'active' : ''} ${watchedClass}" 
                data-episode="${ep.episode_number}" 
                data-season="${seasonNumber}"
                onclick="handleEpisodeClick(this, ${seasonNumber}, ${ep.episode_number})"
            >
                <img src="${ep.still_path ? `http://image.myserver.com/${ep.still_path}` : 'placeholder_ep.jpg'}" alt="E${ep.episode_number}" />
                <span>E${ep.episode_number} - ${ep.name}</span>
            </div>
        `;
    }).join('');

    episodeContainer.innerHTML = `
        <div class="episode-list">
            ${episodesHTML}
        </div>
    `;
}

/**
 * Closes the detail modal.
 */
function closeModal() {
    appState.isModalOpen = false;
    appState.activeItem = null;
    document.getElementById('mediaDetailModal').style.display = 'none';
    document.body.style.overflow = 'auto';
}


// --- 5. Event Handlers and Interactions ---

/**
 * Handles clicks on media cards to open the modal.
 */
async function handleItemClick(event) {
    event.preventDefault();
    const target = event.currentTarget.tagName === 'A' ? event.currentTarget : event.currentTarget.closest('a');
    if (!target) return;

    const id = target.dataset.id;
    const type = target.dataset.type;

    if (!id || !type) {
        showToast("Missing media ID or type.", 'error');
        return;
    }

    showToast("Loading details...");
    
    // Fetch detailed data for the item
    const detailsPath = `${type}/${id}/details`;
    const details = await fetchData(detailsPath);
    
    // Fetch episodes for series, assuming season 1 is fetched initially
    if (type === MEDIA_TYPE_SERIES) {
        const episodesPath = `${MEDIA_TYPE_SERIES}/${id}/season/1`;
        const season1Details = await fetchData(episodesPath);

        // Merge season details into the main item object
        if (details.seasons) {
            const seasonIndex = details.seasons.findIndex(s => (s.season_number || 1) == 1);
            if (seasonIndex !== -1) {
                details.seasons[seasonIndex].episodes = season1Details.episodes;
            }
        }
    }

    if (details) {
        // Add dummy favorite status for demonstration
        details.isFavorite = localStorage.getItem(`fav_${id}`) === 'true'; 
        openModal(details);
    } else {
        showToast("Could not load item details.", 'error');
    }
}

/**
 * Handles the change of the season selection dropdown.
 * @param {string} seasonNumberStr - The new season number selected.
 */
async function handleSeasonChange(seasonNumberStr) {
    const seasonNumber = parseInt(seasonNumberStr);
    const item = appState.activeItem;

    if (!item || item.media_type !== MEDIA_TYPE_SERIES) return;

    // Check if episode data for this season is already loaded
    const seasonData = item.seasons.find(s => (s.season_number || 1) == seasonNumber);
    
    if (seasonData && seasonData.episodes) {
        // Already loaded, just render
        appState.activeSeason = seasonNumber;
        appState.activeEpisode = 1; // Reset episode selection
        renderEpisodeList(item, seasonNumber);
    } else {
        // Fetch episodes for the new season
        showToast(`Loading Season ${seasonNumber}...`);
        const episodesPath = `${MEDIA_TYPE_SERIES}/${item.id}/season/${seasonNumber}`;
        const newSeasonDetails = await fetchData(episodesPath);

        if (newSeasonDetails && newSeasonDetails.episodes) {
            // Update the main state object with new episode data
            const seasonIndex = item.seasons.findIndex(s => (s.season_number || 1) == seasonNumber);
            if (seasonIndex !== -1) {
                item.seasons[seasonIndex].episodes = newSeasonDetails.episodes;
            }
            appState.activeSeason = seasonNumber;
            appState.activeEpisode = 1; // Reset episode selection
            renderEpisodeList(item, seasonNumber);
        } else {
            showToast(`Failed to load episodes for Season ${seasonNumber}.`, 'error');
        }
    }
}

/**
 * Handles clicking an episode item in the list.
 */
function handleEpisodeClick(element, season, episode) {
    // 1. Update active state
    appState.activeSeason = season;
    appState.activeEpisode = episode;
    
    // 2. Update player (simulate changing video source)
    const player = document.getElementById('mediaPlayer');
    if (player) {
        // In a real app, you would dynamically load the actual stream URL here
        player.src = `https://www.youtube.com/embed/S${season}E${episode}_demo_link?autoplay=1`; 
        showToast(`Now playing S${season} E${episode}`);
    }

    // 3. Update UI to highlight the active episode
    document.querySelectorAll('.episode-item').forEach(el => el.classList.remove('active'));
    element.classList.add('active');
}

/**
 * Toggles the favorite status of the active item.
 */
function toggleFavorite() {
    if (!appState.activeItem) return;

    const itemId = appState.activeItem.id;
    const isCurrentlyFavorite = appState.activeItem.isFavorite;

    if (isCurrentlyFavorite) {
        localStorage.removeItem(`fav_${itemId}`);
        appState.activeItem.isFavorite = false;
        showToast(`${appState.activeItem.title || appState.activeItem.name} removed from Favorites.`);
    } else {
        localStorage.setItem(`fav_${itemId}`, 'true');
        appState.activeItem.isFavorite = true;
        showToast(`${appState.activeItem.title || appState.activeItem.name} added to Favorites!`, 'success');
    }

    // Update heart icon in the modal
    const icon = document.querySelector('#mediaDetailModal .favorite-icon');
    if (icon) {
        icon.classList.toggle('active', appState.activeItem.isFavorite);
    }
    
    // Re-render relevant lists if needed (e.g., if a Favorites list is visible)
    loadAllLists(); 
}

/**
 * Marks the active episode or movie as watched.
 */
function markWatched(event) {
    if (!appState.activeItem) return;

    const item = appState.activeItem;
    const isSeries = item.media_type === MEDIA_TYPE_SERIES;
    let key;
    let message;

    if (isSeries) {
        const season = appState.activeSeason;
        const episode = appState.activeEpisode;
        key = `watched_${item.id}_${season}_${episode}`;
        message = `S${season} E${episode} marked as watched.`;

        // Update UI of the episode in the list
        const episodeElement = document.querySelector(`.episode-item[data-season="${season}"][data-episode="${episode}"]`);
        if (episodeElement) {
            episodeElement.classList.add('watched');
        }

    } else {
        key = `watched_movie_${item.id}`;
        message = `${item.title} marked as watched.`;
    }

    localStorage.setItem(key, 'true');
    showToast(message, 'success');

    // Optionally update the control button style
    if (event && event.target) {
        event.target.closest('.player-control-btn').classList.add('watched');
    }
}

// --- 6. Search and Filter Logic ---

/**
 * Toggles the visibility of the search overlay modal.
 */
function toggleSearchModal() {
    const modal = document.getElementById('searchModal');
    const input = document.getElementById('searchInput');
    const isVisible = modal.style.display === 'flex';

    if (isVisible) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
        input.value = '';
        appState.searchResults = [];
        document.getElementById('searchResults').innerHTML = ''; // Clear results
    } else {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        input.focus();
    }
}

/**
 * Performs a search against the API and updates the search results.
 */
async function performSearch(query) {
    appState.searchQuery = query.trim();
    const resultsContainer = document.getElementById('searchResults');
    resultsContainer.innerHTML = ''; // Clear previous results

    if (appState.searchQuery.length < 3) {
        resultsContainer.innerHTML = '<p class="loading">Type at least 3 characters to search.</p>';
        appState.searchResults = [];
        return;
    }

    // Show loading skeleton grid
    const skeletonGrid = Array(12).fill().map(() => `
        <div class="skeleton" style="width: 100%; height: 180px;"></div>
    `).join('');
    resultsContainer.innerHTML = skeletonGrid;
    resultsContainer.classList.add('loading-list');

    // API Call
    const searchPath = `search/multi?query=${encodeURIComponent(appState.searchQuery)}`;
    const results = await fetchData(searchPath);

    resultsContainer.classList.remove('loading-list');
    appState.searchResults = results.filter(item => item.media_type !== 'person'); // Filter out people

    if (appState.searchResults.length === 0) {
        resultsContainer.innerHTML = '<p class="error-message">No results found for your query.</p>';
        return;
    }

    // Render search results
    resultsContainer.innerHTML = appState.searchResults.map(item => `
        <a href="#" data-id="${item.id}" data-type="${item.media_type}" onclick="handleSearchItemClick(event)">
            <img src="${item.poster_path ? `http://image.myserver.com/${item.poster_path}` : 'placeholder.jpg'}" alt="${item.title || item.name}" loading="lazy"/>
            </a>
    `).join('');
}

// Simple debouncing for search input
let searchTimeout;
document.getElementById('searchInput')?.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        performSearch(e.target.value);
    }, 400); // 400ms debounce delay
});

/**
 * Handles click on a search result item.
 */
function handleSearchItemClick(event) {
    // Re-use the main item click handler
    handleItemClick(event);
    toggleSearchModal(); // Close search modal after selection
}

/**
 * Opens the filtering modal.
 */
function openFilterModal(listId, initialType) {
    const modal = document.getElementById('filterModal');
    document.getElementById('filterTypeSelect').value = initialType || appState.activeFilters.type;
    document.getElementById('filterGenreSelect').value = appState.activeFilters.genre;
    document.getElementById('filterYearSelect').value = appState.activeFilters.year;
    
    // Store the ID of the list that triggered the filter (if needed for specific list filtering)
    modal.dataset.targetListId = listId;

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

/**
 * Applies filters and reloads the lists.
 */
function applyFilters() {
    const type = document.getElementById('filterTypeSelect').value;
    const genre = document.getElementById('filterGenreSelect').value;
    const year = document.getElementById('filterYearSelect').value;

    appState.activeFilters.type = type;
    appState.activeFilters.genre = genre;
    appState.activeFilters.year = year;
    
    closeFilterModal();
    loadAllLists(); // Reload content based on new filters
    showToast(`Filtering by Type: ${type}, Genre: ${genre}, Year: ${year}`);
}

/**
 * Closes the filter modal.
 */
function closeFilterModal() {
    document.getElementById('filterModal').style.display = 'none';
    document.body.style.overflow = 'auto';
}

/**
 * Clears all active filters and reloads content.
 */
function clearFilters() {
    appState.activeFilters.genre = 'All';
    appState.activeFilters.year = 'All';
    // Keep type as it's the main toggle (movie/series)
    
    // Optional: Reset type to movie if desired
    // appState.activeFilters.type = MEDIA_TYPE_MOVIE; 

    // Update the UI buttons/indicators (not explicitly covered here but needed)
    
    loadAllLists(); 
    showToast("Filters cleared. Displaying all content.");
}

// --- 7. Initialization and Data Loading ---

/**
 * Filters a raw list of media items based on active state filters.
 * @param {Array<Object>} list - The list to filter.
 * @returns {Array<Object>} - The filtered list.
 */
function applyClientFilters(list) {
    const { genre, year } = appState.activeFilters;
    
    return list.filter(item => {
        let matchesGenre = true;
        let matchesYear = true;

        // Genre filtering (assuming item.genre_ids is an array of numbers)
        if (genre !== 'All' && item.genre_ids) {
            // Need a mapping of genre name to ID for the real check, 
            // but for this example, we assume `item.genres` has name property (from details API) 
            // and simply check if the genre name is present.
            // In a real app, this check would be more robust.
            
            // Simplified check: If we have full details (unlikely for a list view), check name. 
            // Since we usually only have IDs here, this part is often done by the API.
            // If API filtering is not available, we need a complete Genre ID list. 
            
            // For now, if we assume filtering happens mostly via API calls:
            // This client filter mainly demonstrates client-side capability.
            // The API calls in loadAllLists should handle the server-side filtering.
        }

        // Year filtering (checks release_date or first_air_date)
        if (year !== 'All') {
            const date = item.release_date || item.first_air_date;
            const itemYear = date ? new Date(date).getFullYear().toString() : null;
            matchesYear = itemYear === year;
        }

        return matchesGenre && matchesYear;
    });
}


/**
 * Fetches data for all main lists and updates the UI.
 */
async function loadAllLists() {
    // 1. Render Skeletons first
    renderMediaList('trending-list', [], true);
    renderMediaList('popular-list', [], true);
    renderMediaList('new-releases-list', [], true);

    const type = appState.activeFilters.type;
    const genre = appState.activeFilters.genre;
    const year = appState.activeFilters.year;

    // 2. Fetch data (API calls should ideally be filtered based on type/genre/year)
    // NOTE: In a real app, the API endpoints would accept query parameters for filtering.
    // E.g., `trending/${type}?genre=${genre}&year=${year}`
    
    const [trending, popular, newReleases] = await Promise.all([
        fetchData(`trending/${type}`),
        fetchData(`popular/${type}`),
        fetchData(`new-releases/${type}`)
    ]);

    // 3. Update state (and apply simple client-side filtering if necessary)
    appState.trending = applyClientFilters(trending);
    appState.popular = applyClientFilters(popular);
    appState.newReleases = applyClientFilters(newReleases);

    // 4. Render actual content
    renderMediaList('trending-list', appState.trending);
    renderMediaList('popular-list', appState.popular);
    renderMediaList('new-releases-list', appState.newReleases);
}

/**
 * Toggles between light and dark mode.
 */
function toggleTheme() {
    appState.isLightMode = !appState.isLightMode;
    document.body.classList.toggle('light-mode', appState.isLightMode);
    localStorage.setItem('theme', appState.isLightMode ? 'light' : 'dark');
    showToast(`Switched to ${appState.isLightMode ? 'Light' : 'Dark'} Mode`, 'info');
}

/**
 * Initializes the application: loads theme, populates filters, and loads data.
 */
function initializeApp() {
    // Load theme from localStorage
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        appState.isLightMode = true;
        document.body.classList.add('light-mode');
    }

    // Set up main event listeners
    document.getElementById('searchIcon')?.addEventListener('click', toggleSearchModal);
    document.getElementById('searchModalClose')?.addEventListener('click', toggleSearchModal);
    document.getElementById('filterOpenBtn')?.addEventListener('click', () => openFilterModal('list-container-all', appState.activeFilters.type));
    document.getElementById('filterApplyBtn')?.addEventListener('click', applyFilters);
    document.getElementById('filterCloseBtn')?.addEventListener('click', closeFilterModal);
    document.getElementById('clearFiltersBtn')?.addEventListener('click', clearFilters);
    document.getElementById('themeToggleBtn')?.addEventListener('click', toggleTheme);

    // Initial content load
    loadAllLists();
    
    // Initial dummy slider content render
    renderSliderContent();
}

// --- 8. Slideshow/Banner Logic ---

let slideIndex = 1;

/**
 * Renders initial content for the main banner/slideshow.
 */
function renderSliderContent() {
    const slidesContainer = document.querySelector('.slides');
    const dotsContainer = document.querySelector('.dots');
    
    // Dummy slide data - in a real app, this would be fetched from API
    const dummySlides = [
        { id: 101, title: "The Cosmic Voyager", type: MEDIA_TYPE_MOVIE, imageUrl: 'images/slide1.jpg' },
        { id: 102, title: "Echoes of the Past S2", type: MEDIA_TYPE_SERIES, imageUrl: 'images/slide2.jpg' },
        { id: 103, title: "Neon City Drifter", type: MEDIA_TYPE_MOVIE, imageUrl: 'images/slide3.jpg' }
    ];

    if (!slidesContainer || !dotsContainer) return;

    slidesContainer.innerHTML = dummySlides.map(slide => `
        <div 
            class="slide" 
            style="background-image: url('${slide.imageUrl}');"
            data-id="${slide.id}" 
            data-type="${slide.type}" 
            onclick="handleItemClick(event)"
        >
            <h1>${slide.title}</h1>
        </div>
    `).join('');

    dotsContainer.innerHTML = dummySlides.map((_, index) => 
        `<span class="dot" onclick="currentSlide(${index + 1})"></span>`
    ).join('');

    showSlides(slideIndex);
    // Start auto-play after initial load (optional)
    // setInterval(() => plusSlides(1), 8000); 
}

/**
 * Advances the slideshow by a number of steps.
 */
function plusSlides(n) {
    showSlides(slideIndex += n);
}

/**
 * Jumps to a specific slide index.
 */
function currentSlide(n) {
    showSlides(slideIndex = n);
}

/**
 * Core function to display the correct slide.
 */
function showSlides(n) {
    const slides = document.querySelectorAll(".slide");
    const dots = document.querySelectorAll(".dot");
    if (slides.length === 0) return;

    if (n > slides.length) { slideIndex = 1; }    
    if (n < 1) { slideIndex = slides.length; }

    const container = document.querySelector(".slideshow-container");
    const slideWidth = container.offsetWidth;
    const offset = -(slideIndex - 1) * slideWidth;

    slides.forEach((slide, index) => {
        // Use translation for smooth sliding animation
        slide.style.transform = `translateX(${offset}px)`;
        
        // Handle dots (active indicator)
        dots[index].classList.remove("active");
    });
    
    if (dots[slideIndex - 1]) {
        dots[slideIndex - 1].classList.add("active");
    }
}

// Ensure the application starts when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initializeApp);

