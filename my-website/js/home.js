// --- Configuration ---
const API_KEY = 'YOUR_TMDB_API_KEY'; // Replace with your actual key
const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';
const BACKDROP_BASE_URL = 'https://image.tmdb.org/t/p/w1280';
const EMBED_URL = 'https://vidsrc.me/embed/'; // Base URL for the video player
const FALLBACK_IMAGE = 'images/fallback-poster.jpg';
const PLACEHOLDER_SERVER = 'server-1';

// --- State Variables ---
let currentItem = null;
let currentSeason = 1;
let currentEpisode = 1;

// --- Helper Functions (Local Storage) ---

// Saves the last watched position, including the selected server
function saveWatchProgress(id, server, season, episode) {
    const progress = { server, season, episode, timestamp: new Date().getTime() };
    localStorage.setItem(`progress_${id}`, JSON.stringify(progress));
}

// Loads the last watched position
function loadWatchProgress(id) {
    const progress = localStorage.getItem(`progress_${id}`);
    return progress ? JSON.parse(progress) : null;
}

function saveUserRating(id, rating) {
    localStorage.setItem(`rating_${id}`, rating);
    displayUserRatingOnPoster(id, rating); // Update the poster immediately
}

function loadUserRating(id) {
    const rating = localStorage.getItem(`rating_${id}`);
    return rating ? parseInt(rating) : 0;
}

function getFavorites() {
    const favorites = localStorage.getItem('favorites');
    return favorites ? JSON.parse(favorites) : [];
}

function isFavorite(id) {
    return getFavorites().includes(id);
}

function toggleFavorite(id) {
    let favorites = getFavorites();
    const index = favorites.indexOf(id);

    if (index > -1) {
        // Remove from favorites
        favorites.splice(index, 1);
        document.getElementById('favorite-button').classList.remove('active');
    } else {
        // Add to favorites
        favorites.push(id);
        document.getElementById('favorite-button').classList.add('active');
    }
    localStorage.setItem('favorites', JSON.stringify(favorites));
    // Re-render favorites if on that page
    if (document.getElementById('favorites-section').style.display !== 'none') {
        loadFavorites();
    }
}

// --- API Functions ---

async function fetchTMDB(endpoint) {
    const url = `${BASE_URL}${endpoint}?api_key=${API_KEY}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error("Error fetching data from TMDB:", error);
        return null;
    }
}

// --- UI Rendering Functions ---

function createPoster(item, isFullList = false) {
    const posterPath = item.poster_path ? `${IMAGE_BASE_URL}${item.poster_path}` : FALLBACK_IMAGE;
    const itemId = item.id;
    const itemTitle = item.title || item.name;
    const userRating = loadUserRating(itemId);
    
    const posterDiv = document.createElement('div');
    posterDiv.className = 'content-item';
    posterDiv.setAttribute('onclick', `showDetails(${itemId}, '${item.media_type}')`);

    // Poster Image with Native Lazy Loading
    const img = document.createElement('img');
    img.src = posterPath;
    img.alt = itemTitle;
    img.setAttribute('loading', 'lazy'); // Native Lazy Loading
    posterDiv.appendChild(img);

    // Title
    const titleDiv = document.createElement('div');
    titleDiv.className = 'content-item-title';
    titleDiv.textContent = itemTitle;
    posterDiv.appendChild(titleDiv);

    // User Rating Display (if rated)
    if (userRating > 0) {
        posterDiv.innerHTML += `
            <div class="user-rating-display" id="rating-display-${itemId}">
                <span class="star">&#9733;</span> ${userRating}/5
            </div>
        `;
    }
    
    return posterDiv;
}

function displayList(containerId, items, isFullList = false) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';
    items.forEach(item => {
        // Filter out items without media_type or id (TMDB API often has this issue)
        if (item.media_type && item.id) {
            container.appendChild(createPoster(item, isFullList));
        }
    });
}

// Function to update the rating display on a poster
function displayUserRatingOnPoster(id, rating) {
    const poster = document.querySelector(`.content-item[onclick*='${id}']`);
    if (!poster) return;

    let ratingDisplay = document.getElementById(`rating-display-${id}`);
    
    if (rating > 0) {
        if (!ratingDisplay) {
            ratingDisplay = document.createElement('div');
            ratingDisplay.className = 'user-rating-display';
            ratingDisplay.id = `rating-display-${id}`;
            poster.appendChild(ratingDisplay);
        }
        ratingDisplay.innerHTML = `<span class="star">&#9733;</span> ${rating}/5`;
    } else if (ratingDisplay) {
        ratingDisplay.remove();
    }
}


function renderRatingStars(itemId, currentRating) {
    let starsHtml = '';
    for (let i = 1; i <= 5; i++) {
        const isActive = i <= currentRating ? 'active' : '';
        // The event listener is simple: when a star is clicked, save the rating (i)
        starsHtml += `<span class="${isActive}" onclick="setUserRating(${itemId}, ${i})">&#9733;</span>`;
    }

    return `
        <div class="user-rating">
            <p>Your Rating:</p>
            <div class="rating-stars">
                ${starsHtml}
                <button onclick="setUserRating(${itemId}, 0)" style="margin-left: 10px; background: none; border: none; color: #aaa; cursor: pointer;">Clear</button>
            </div>
        </div>
    `;
}

function setUserRating(id, rating) {
    const stars = document.querySelectorAll('.rating-stars span');
    
    // Update visual state in modal
    stars.forEach((star, index) => {
        star.classList.remove('active');
        if (index < rating) {
            star.classList.add('active');
        }
    });

    // Save to Local Storage
    saveUserRating(id, rating);
    alert(rating > 0 ? `Rating for saved: ${rating}/5` : 'Rating cleared.');
}

// --- Detail Modal Functions ---

async function showDetails(id, mediaType) {
    const item = await fetchTMDB(`/${mediaType}/${id}`);
    if (!item) return;

    currentItem = { ...item, media_type: mediaType };
    
    const posterPath = item.poster_path ? `${IMAGE_BASE_URL}${item.poster_path}` : FALLBACK_IMAGE;
    const backdropPath = item.backdrop_path ? `${BACKDROP_BASE_URL}${item.backdrop_path}` : '';
    const title = item.title || item.name;
    const releaseDate = item.release_date || item.first_air_date || 'N/A';
    const overview = item.overview || 'No overview available.';
    const rating = item.vote_average ? item.vote_average.toFixed(1) : 'N/A';
    const genres = item.genres ? item.genres.map(g => g.name).join(', ') : 'N/A';
    
    const isTVShow = mediaType === 'tv';
    const favoriteButtonClass = isFavorite(id) ? 'active' : '';
    const playButtonText = isTVShow ? 'Start Watching' : 'Watch Movie';
    const userRating = loadUserRating(id);

    // Build the details HTML
    const detailsHtml = `
        <img id="detail-poster" src="${posterPath}" alt="${title}" loading="lazy">
        <div id="detail-info">
            <h2 id="detail-title">${title} (${new Date(releaseDate).getFullYear() || ''})</h2>
            <p id="detail-rating">TMDB Rating: <strong>${rating}</strong> / 10</p>
            <p id="detail-release">Release Date: ${releaseDate}</p>
            <p id="detail-genres">Genres: ${genres}</p>
            <p id="detail-overview">${overview}</p>
            
            <div class="detail-actions">
                <button id="play-button" onclick="loadPlayer()">
                    ${playButtonText}
                </button>
                <button id="favorite-button" class="${favoriteButtonClass}" onclick="toggleFavorite(${id})">
                    ${isFavorite(id) ? '&#9733; Favorite' : '&#9734; Add to Favorites'}
                </button>
            </div>

            ${renderRatingStars(id, userRating)}
        </div>
    `;

    document.getElementById('modal-details').innerHTML = detailsHtml;
    document.getElementById('details-modal').style.display = 'block';

    // Load episode list if it's a TV show
    if (isTVShow) {
        loadEpisodes(item.id, item.seasons);
    } else {
        // Clear any previous episode selector from TV shows
        const playerView = document.getElementById('player-view');
        if(playerView) {
            const episodeSelector = document.getElementById('episode-selector');
            if(episodeSelector) episodeSelector.innerHTML = '';
        }
    }
}

function closeModal() {
    document.getElementById('details-modal').style.display = 'none';
    currentItem = null;
}

// --- Player Functions ---

// The server list is simplified as we don't have real server info from TMDB, 
// but the functionality to select and save one is implemented.
const serverOptions = [
    { value: 'server-1', name: 'Server 1 (Default)' },
    { value: 'server-2', name: 'Server 2 (Backup)' },
    { value: 'server-3', name: 'Server 3 (External)' }
];

function populateServerSelect(selectedServer) {
    const select = document.getElementById('server-select');
    if (!select) return;
    
    select.innerHTML = '';
    serverOptions.forEach(server => {
        const option = document.createElement('option');
        option.value = server.value;
        option.textContent = server.name;
        if (server.value === selectedServer) {
            option.selected = true;
        }
        select.appendChild(option);
    });
}

function loadPlayer() {
    if (!currentItem) {
        alert("Error: No item selected.");
        return;
    }

    const { id, media_type } = currentItem;
    const progress = loadWatchProgress(id);
    let url = '';
    
    // Determine the media-specific path component
    let mediaPath = '';
    if (media_type === 'movie') {
        mediaPath = `movie/${id}`;
    } else if (media_type === 'tv') {
        // Load progress for TV show or default to S1E1
        currentSeason = progress ? progress.season : 1;
        currentEpisode = progress ? progress.episode : 1;
        
        // Ensure the season/episode selectors are visible and updated
        document.getElementById('episode-selector').style.display = 'block';
        
        // Re-use the existing seasons array from the currentItem
        if(currentItem.seasons) {
            displaySeasonButtons(id, currentItem.seasons);
            displayEpisodeButtons(currentSeason);
        }

        mediaPath = `tv/${id}/${currentSeason}/${currentEpisode}`;
    } else {
        alert("Error: Unknown media type.");
        return;
    }
    
    // Load saved server or default
    const savedServer = progress ? progress.server : serverOptions[0].value;
    populateServerSelect(savedServer);
    
    url = `${EMBED_URL}${mediaPath}?server=${savedServer}`;
    
    document.getElementById('video-iframe').src = url;
    document.getElementById('episode-info').textContent = `${currentItem.title || currentItem.name} - ${media_type === 'tv' ? `S${currentSeason} E${currentEpisode}` : 'Movie'}`;
    
    document.getElementById('details-modal').style.display = 'none';
    document.getElementById('player-modal').style.display = 'block';
}

// **BUG FIX AND IMPROVEMENT:** The changeServer function now correctly saves the server.
function changeServer() {
    const serverSelect = document.getElementById('server-select');
    const newServer = serverSelect.value;
    
    if (currentItem) {
        // 1. Save the new server along with existing watch progress
        saveWatchProgress(currentItem.id, newServer, currentSeason, currentEpisode);
        
        // 2. Update the video iframe source
        let mediaPath = '';
        if (currentItem.media_type === 'movie') {
            mediaPath = `movie/${currentItem.id}`;
        } else if (currentItem.media_type === 'tv') {
            mediaPath = `tv/${currentItem.id}/${currentSeason}/${currentEpisode}`;
        } else {
            console.error("Unknown media type.");
            return;
        }
        
        const newUrl = `${EMBED_URL}${mediaPath}?server=${newServer}`;
        document.getElementById('video-iframe').src = newUrl;
    }
}


function closePlayer() {
    document.getElementById('player-modal').style.display = 'none';
    document.getElementById('video-iframe').src = ''; // Stop video playback
}

// TV Show Episode Selection Functions

// **IMPROVEMENT:** Updated to include Season 0 (Specials)
async function loadEpisodes(id, seasons) {
    const episodeSelector = document.getElementById('episode-selector');
    episodeSelector.innerHTML = '';
    
    // Sort and filter seasons to include Season 0
    const validSeasons = seasons
        .filter(s => s.season_number >= 0 && s.episode_count > 0)
        .sort((a, b) => a.season_number - b.season_number);
    
    // Store season data on the current item for quick access
    currentItem.seasonsData = validSeasons; 

    // Create container for season buttons
    const seasonContainer = document.createElement('div');
    seasonContainer.className = 'season-selector';
    episodeSelector.appendChild(seasonContainer);

    // Create container for episode buttons
    const episodeContainer = document.createElement('div');
    episodeContainer.className = 'episodes-list';
    episodeContainer.id = 'episodes-list';
    episodeSelector.appendChild(episodeContainer);

    displaySeasonButtons(id, validSeasons);
    
    // Automatically select the last watched season/episode or default
    const progress = loadWatchProgress(id);
    const initialSeason = progress ? progress.season : (validSeasons[0]?.season_number || 1);
    
    // Set initial state
    currentSeason = initialSeason;
    const initialSeasonElement = document.querySelector(`.season-button[data-season='${initialSeason}']`);
    if (initialSeasonElement) initialSeasonElement.classList.add('active');
    
    // Display initial episode buttons
    displayEpisodeButtons(initialSeason);
}


function displaySeasonButtons(id, validSeasons) {
    const seasonContainer = document.querySelector('.season-selector');
    seasonContainer.innerHTML = '<h4>Select Season:</h4>';
    
    validSeasons.forEach(s => {
        const button = document.createElement('button');
        button.className = 'season-button';
        button.textContent = `S${s.season_number} (${s.episode_count})`;
        button.setAttribute('data-season', s.season_number);
        button.onclick = () => {
            selectSeason(s.season_number);
        };
        
        // Highlight active season
        const progress = loadWatchProgress(id);
        const activeSeason = progress ? progress.season : 1;
        if (s.season_number === activeSeason) {
            button.classList.add('active');
        }
        
        seasonContainer.appendChild(button);
    });
}

function selectSeason(seasonNumber) {
    currentSeason = seasonNumber;
    
    // Update active season button
    document.querySelectorAll('.season-button').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.season-button[data-season='${seasonNumber}']`).classList.add('active');

    // Display episodes for the selected season
    displayEpisodeButtons(seasonNumber);
    
    // Reset episode and update player to S{new} E1
    selectEpisode(1);
}

function displayEpisodeButtons(seasonNumber) {
    const episodeContainer = document.getElementById('episodes-list');
    episodeContainer.innerHTML = '<h4>Select Episode:</h4>';

    const seasonData = currentItem.seasonsData.find(s => s.season_number === seasonNumber);
    if (!seasonData) {
        episodeContainer.innerHTML = '<p>No episode data available for this season.</p>';
        return;
    }

    const totalEpisodes = seasonData.episode_count;
    const progress = loadWatchProgress(currentItem.id);
    const activeEpisode = progress && progress.season === seasonNumber ? progress.episode : 1;

    for (let i = 1; i <= totalEpisodes; i++) {
        const button = document.createElement('button');
        button.className = 'episode-button';
        button.textContent = `E${i}`;
        button.onclick = () => {
            selectEpisode(i);
        };
        
        if (i === activeEpisode) {
            button.classList.add('active');
        }
        
        episodeContainer.appendChild(button);
    }
}

function selectEpisode(episodeNumber) {
    currentEpisode = episodeNumber;
    
    // Update active episode button
    document.querySelectorAll('.episode-button').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`#episodes-list .episode-button:nth-child(${episodeNumber})`).classList.add('active');

    // Get the currently selected server
    const serverSelect = document.getElementById('server-select');
    const selectedServer = serverSelect ? serverSelect.value : serverOptions[0].value;
    
    // Save progress with the current server
    saveWatchProgress(currentItem.id, selectedServer, currentSeason, currentEpisode);

    // Update the player iframe
    const mediaPath = `tv/${currentItem.id}/${currentSeason}/${currentEpisode}`;
    const url = `${EMBED_URL}${mediaPath}?server=${selectedServer}`;
    
    document.getElementById('video-iframe').src = url;
    document.getElementById('episode-info').textContent = `${currentItem.name} - S${currentSeason} E${currentEpisode}`;
}


// --- Home/Category Functions ---

async function fetchCategoryContent(title, endpoint, containerId) {
    const data = await fetchTMDB(endpoint);
    if (data && data.results) {
        // Inject category title
        const container = document.getElementById('category-content');
        container.innerHTML += `<h2 class="category-title">${title}</h2><div id="${containerId}" class="content-list"></div>`;
        
        // Display content
        displayList(containerId, data.results.slice(0, 15)); // Limit to 15 for horizontal scroll
    }
}

async function loadHome() {
    // Reset view
    document.getElementById('category-content').innerHTML = '';
    document.getElementById('search-results').style.display = 'none';
    document.getElementById('favorites-section').style.display = 'none';
    document.getElementById('slideshow-container').style.display = 'block';

    // Update nav buttons
    document.getElementById('home-button').classList.add('active');
    document.getElementById('favorites-button').classList.remove('active');

    // Load Banner/Slideshow
    await loadSlideshow();

    // Load Categories
    await fetchCategoryContent('Trending Today', '/trending/all/day', 'trending-list');
    await fetchCategoryContent('Popular Movies', '/movie/popular', 'popular-movies-list');
    await fetchCategoryContent('Top Rated TV Shows', '/tv/top_rated', 'top-tv-list');
}

// --- Search Functions ---

document.getElementById('search-button').addEventListener('click', () => {
    const query = document.getElementById('search-input').value;
    if (query) {
        searchContent(query);
    }
});

document.getElementById('search-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const query = document.getElementById('search-input').value;
        if (query) {
            searchContent(query);
        }
    }
});

async function searchContent(query) {
    const data = await fetchTMDB(`/search/multi?query=${encodeURIComponent(query)}`);
    
    // Hide home view elements
    document.getElementById('slideshow-container').style.display = 'none';
    document.getElementById('category-content').innerHTML = '';
    document.getElementById('favorites-section').style.display = 'none';

    // Show search results
    document.getElementById('search-results').style.display = 'block';
    
    const validResults = data.results.filter(item => 
        (item.media_type === 'movie' || item.media_type === 'tv') && item.poster_path
    );

    displayList('search-list', validResults, true);
    
    document.querySelector('#search-results .category-title').textContent = `Search Results for "${query}"`;
}

// --- Favorites Functions ---

async function loadFavorites() {
    // Reset view
    document.getElementById('slideshow-container').style.display = 'none';
    document.getElementById('category-content').innerHTML = '';
    document.getElementById('search-results').style.display = 'none';
    document.getElementById('favorites-section').style.display = 'block';
    
    // Update nav buttons
    document.getElementById('home-button').classList.remove('active');
    document.getElementById('favorites-button').classList.add('active');

    const favorites = getFavorites();
    const favoritesList = document.getElementById('favorites-list');
    favoritesList.innerHTML = '';
    
    if (favorites.length === 0) {
        favoritesList.innerHTML = '<p style="text-align: center; width: 100%; padding: 50px;">You have no favorites yet. Add some from the details view!</p>';
        return;
    }

    // Fetch details for each favorite item and display
    const favoriteItems = await Promise.all(favorites.map(async id => {
        // TMDB doesn't store media_type in favorites, so we have to guess (try movie first)
        let item = await fetchTMDB(`/movie/${id}`);
        if (item && item.title) {
            item.media_type = 'movie';
            return item;
        }
        item = await fetchTMDB(`/tv/${id}`);
        if (item && item.name) {
            item.media_type = 'tv';
            return item;
        }
        return null; // Item not found or deleted
    }));
    
    const validFavorites = favoriteItems.filter(item => item !== null);
    
    validFavorites.forEach(item => {
        favoritesList.appendChild(createPoster(item, true));
    });
}


// --- Slideshow/Banner Functions (with UX improvements) ---
let slideIndex = 0;
let slideshowItems = [];
let slideshowInterval;

async function loadSlideshow() {
    const data = await fetchTMDB('/trending/all/week');
    if (!data || !data.results) return;

    // Filter to only include items with a backdrop path for a good banner look
    slideshowItems = data.results
        .filter(item => item.backdrop_path)
        .slice(0, 10); // Use the top 10 for the banner

    const wrapper = document.getElementById('slideshow-wrapper');
    const dotsContainer = document.getElementById('dots-container');
    wrapper.innerHTML = '';
    dotsContainer.innerHTML = '';

    slideshowItems.forEach((item, index) => {
        const title = item.title || item.name;
        const overview = item.overview || 'No overview available.';
        const backdropPath = `${BACKDROP_BASE_URL}${item.backdrop_path}`;
        
        const slide = document.createElement('div');
        slide.className = 'slide';
        slide.style.backgroundImage = `url('${backdropPath}')`;
        slide.setAttribute('onclick', `showDetails(${item.id}, '${item.media_type}')`);
        
        slide.innerHTML = `
            <div class="slide-content">
                <h3 class="slide-title">${title}</h3>
                <p class="slide-overview">${overview}</p>
            </div>
        `;
        wrapper.appendChild(slide);

        // Dots
        const dot = document.createElement('span');
        dot.className = 'dot';
        dot.setAttribute('data-index', index);
        dot.setAttribute('onclick', `goToSlide(${index})`);
        dotsContainer.appendChild(dot);
    });

    // Initialize the slideshow
    slideIndex = 0;
    showSlide(slideIndex);
    
    // Clear any existing interval and start a new one
    clearInterval(slideshowInterval);
    slideshowInterval = setInterval(() => changeSlide(1), 5000);
    
    // Add event listeners for keyboard and swipe
    addSlideshowUX();
}

function showSlide(n) {
    if (slideshowItems.length === 0) return;
    
    if (n >= slideshowItems.length) {
        slideIndex = 0;
    } else if (n < 0) {
        slideIndex = slideshowItems.length - 1;
    } else {
        slideIndex = n;
    }

    const wrapper = document.getElementById('slideshow-wrapper');
    const slideWidth = wrapper.offsetWidth / slideshowItems.length;
    wrapper.style.transform = `translateX(-${slideIndex * slideWidth}px)`;

    // Update dots
    document.querySelectorAll('.dot').forEach(dot => dot.classList.remove('active-dot'));
    document.querySelector(`.dot[data-index='${slideIndex}']`).classList.add('active-dot');
}

function changeSlide(n) {
    // Clear the auto-advance timer on manual navigation
    clearInterval(slideshowInterval);
    showSlide(slideIndex + n);
    // Restart the timer
    slideshowInterval = setInterval(() => changeSlide(1), 5000);
}

function goToSlide(n) {
    // Clear the auto-advance timer on manual navigation
    clearInterval(slideshowInterval);
    showSlide(n);
    // Restart the timer
    slideshowInterval = setInterval(() => changeSlide(1), 5000);
}


// **IMPROVEMENT:** Add Keyboard and Swipe Navigation
function addSlideshowUX() {
    // --- Keyboard Navigation ---
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') {
            changeSlide(-1);
        } else if (e.key === 'ArrowRight') {
            changeSlide(1);
        }
    });

    // --- Swipe Navigation (Touch Events) ---
    const slideshow = document.getElementById('slideshow-container');
    let touchstartX = 0;
    let touchendX = 0;
    const minSwipeDistance = 50; // Minimum distance in pixels for a valid swipe

    slideshow.addEventListener('touchstart', (e) => {
        // Only track the first touch point
        touchstartX = e.changedTouches[0].screenX;
    }, false);

    slideshow.addEventListener('touchend', (e) => {
        // Only track the first touch point
        touchendX = e.changedTouches[0].screenX;
        handleGesture();
    }, false);

    function handleGesture() {
        const swipeDistance = touchendX - touchstartX;
        
        if (Math.abs(swipeDistance) > minSwipeDistance) {
            // Swipe right (prev slide)
            if (swipeDistance > 0) {
                changeSlide(-1);
            } 
            // Swipe left (next slide)
            else if (swipeDistance < 0) {
                changeSlide(1);
            }
        }
    }
}


// --- Initialization ---

document.addEventListener('DOMContentLoaded', () => {
    // Load the initial view
    loadHome();

    // Check for PWA support (optional, requires manifest.json and sw.js)
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
        .then(() => console.log('Service Worker Registered'))
        .catch(error => console.log('Service Worker Registration Failed:', error));
    }
});
