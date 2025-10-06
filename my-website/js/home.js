// js/home.js
const API_KEY = '40f1982842db35042e8561b13b38d492';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_URL = 'https://image.tmdb.org/t/p/original';
const FALLBACK_IMAGE = 'https://via.placeholder.com/150x225?text=No+Image';
let currentItem;
let currentSeason = 1;
let currentEpisode = 1;
let currentPages = {
  movies: 1,
  tvShows: 1,
  anime: 1,
  tagalogMovies: 1, 
  netflixMovies: 1,
  netflixTV: 1,
  koreanDrama: 1,
  allView: 1 // Page counter for the 'View All' mode
};
let isLoading = {
  movies: false,
  tvshows: false,
  anime: false,
  'tagalog-movies': false, 
  'netflix-movies': false,
  'netflix-tv': false,
  'korean-drama': false
};
let slideshowItems = [];
let currentSlide = 0;
let slideshowInterval;

// Global state for All View/Discover page
let currentAllViewCategory = null; 
let allViewTotalPages = 1;
let movieGenres = []; 
let tvGenres = []; 

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

// ==================================================================================
// TMDB FETCH FUNCTIONS
// ==================================================================================

async function fetchGenres(type) {
  try {
    const res = await fetch(`${BASE_URL}/genre/${type}/list?api_key=${API_KEY}`);
    const data = await res.json();
    return data.genres || [];
  } catch (error) {
    console.error(`Error fetching ${type} genres:`, error);
    return [];
  }
}

async function fetchTrending(type, page = 1) {
  try {
    const res = await fetch(`${BASE_URL}/trending/${type}/week?api_key=${API_KEY}&page=${page}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const data = await res.json();
    if (data.results) {
        data.results.forEach(item => item.media_type = item.media_type || type);
    }
    return data;
  } catch (error) {
    console.error(`Error fetching trending ${type}:`, error);
    showError(`Failed to load ${type}. Check API key or connection.`, `${type}-list`);
    return { results: [], total_pages: 1 };
  }
}

async function fetchFilteredContent(type, filters, page = 1) {
  const filterString = Object.entries(filters).map(([key, value]) => `&${key}=${value}`).join('');
  const url = `${BASE_URL}/discover/${type}?api_key=${API_KEY}&sort_by=popularity.desc&include_adult=false&page=${page}${filterString}`;
  
  const res = await fetch(url);
  const data = await res.json();
  if (data.results) {
    data.results.forEach(item => item.media_type = type);
  }
  return data;
}

// Specialized fetch functions (using the general one)
const fetchTrendingAnime = (page) => fetchFilteredContent('tv', { 'with_genres': 16, 'with_original_language': 'ja' }, page);
const fetchTagalogMovies = (page) => fetchFilteredContent('movie', { 'with_original_language': 'tl' }, page);
const fetchNetflixMovies = (page) => fetchFilteredContent('movie', { 'with_watch_providers': 8, 'watch_region': 'US' }, page);
const fetchNetflixTV = (page) => fetchFilteredContent('tv', { 'with_watch_providers': 8, 'watch_region': 'US' }, page);
const fetchKoreanDrama = (page) => fetchFilteredContent('tv', { 'with_original_language': 'ko', 'with_genres': 18 }, page);


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

// ==================================================================================
// UTILITY & DISPLAY FUNCTIONS
// ==================================================================================

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
    slide.className = 'slide-item';
    slide.style.backgroundImage = `url(${IMG_URL}${item.backdrop_path})`;
    
    const content = document.createElement('div');
    content.classList.add('slide-content');
    content.innerHTML = `<h3 class="slide-title">${item.title || item.name || 'Unknown'}</h3>`;

    slide.appendChild(content);
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
  const slides = document.querySelectorAll('.slide-item');
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
  const slides = document.querySelectorAll('.slide-item');
  if (slides.length === 0) return;
  currentSlide = (currentSlide + n + slides.length) % slides.length;
  showSlide();
}

function displayList(items, containerId, append = false) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`Container ${containerId} not found`);
    return;
  }
  
  if (!append) {
      removeLoadingAndError(containerId);
      container.innerHTML = '';
  }
  
  if (items.length === 0 && container.children.length === 0) {
    container.innerHTML = '<p style="color: #ccc; text-align: center;">No content available.</p>';
    return;
  }

  items.forEach(item => {
    // Check if the item already exists in the container
    if (container.querySelector(`[data-id="${item.id}"]`)) return;

    const listItem = document.createElement('div');
    listItem.classList.add('list-item');
    listItem.setAttribute('data-id', item.id);
    listItem.onclick = () => showDetails(item);

    const img = document.createElement('img');
    img.src = item.poster_path ? `${IMG_URL}${item.poster_path}` : FALLBACK_IMAGE;
    img.alt = (item.title || item.name || 'Unknown');

    const title = document.createElement('p');
    title.textContent = (item.title || item.name || 'Unknown');
    
    listItem.appendChild(img);
    listItem.appendChild(title);
    container.appendChild(listItem);
  });
}

function addScrollListener(category) {
  const containerId = category + '-list';
  const container = document.getElementById(containerId);
  if (!container) return;
  
  container.onscroll = debounce(function () {
    if (
      !isLoading[category] &&
      container.scrollLeft + container.clientWidth >= container.scrollWidth - 50
    ) {
      loadMore(category);
    }
  }, 100);
}

async function loadMore(category) {
  // Translate category string to the correct key name for currentPages
  let pageKey = category.replace(/-/g, '').replace('tvshows', 'tvShows');
  
  if (isLoading[category]) return;

  isLoading[category] = true;
  const containerId = category + '-list';
  
  currentPages[pageKey]++;

  try {
    let data;
    if (category === 'movies') {
      data = await fetchTrending('movie', currentPages[pageKey]);
    } else if (category === 'tvshows') {
      data = await fetchTrending('tv', currentPages[pageKey]);
    } else if (category === 'anime') {
      data = await fetchFilteredContent('tv', { 'with_genres': 16, 'with_original_language': 'ja' }, currentPages[pageKey]);
    } else if (category === 'tagalog-movies') {
      data = await fetchFilteredContent('movie', { 'with_original_language': 'tl' }, currentPages[pageKey]);
    } else if (category === 'netflix-movies') {
      data = await fetchFilteredContent('movie', { 'with_watch_providers': 8, 'watch_region': 'US' }, currentPages[pageKey]);
    } else if (category === 'netflix-tv') {
      data = await fetchFilteredContent('tv', { 'with_watch_providers': 8, 'watch_region': 'US' }, currentPages[pageKey]);
    } else if (category === 'korean-drama') {
      data = await fetchFilteredContent('tv', { 'with_original_language': 'ko', 'with_genres': 18 }, currentPages[pageKey]);
    }

    const items = data.results || [];
    
    if (items.length === 0) {
        currentPages[pageKey]--; 
        console.log(`${category} reached end of available content.`);
        isLoading[category] = false;
        return;
    }
    
    displayList(items, containerId, true);

  } catch (error) {
    console.error(`Error loading more for ${category}:`, error);
  } finally {
    isLoading[category] = false;
  }
}

// ==================================================================================
// DETAIL MODAL LOGIC (Your Integrated Player Setup)
// ==================================================================================

async function showDetails(item) {
  currentItem = item;
  currentSeason = 1;
  currentEpisode = 1;
  
  // Rating conversion: TMDB uses 10-point scale, converting to simple stars here
  const ratingHTML = '★'.repeat(Math.round((item.vote_average || 0) / 2)) + 
                     '☆'.repeat(5 - Math.round((item.vote_average || 0) / 2));
                     
  document.getElementById('modal-title').textContent = item.title || item.name || 'Unknown';
  document.getElementById('modal-description').textContent = item.overview || 'No description available.';
  document.getElementById('modal-image').src = item.poster_path ? `${IMG_URL}${item.poster_path}` : FALLBACK_IMAGE;
  document.getElementById('modal-rating').innerHTML = ratingHTML;
  document.getElementById('server').value = 'player.videasy.net'; // Default server: Vidplayer

  const seasonSelector = document.getElementById('season-selector');
  const episodeList = document.getElementById('episode-list');
  const isTVShow = item.media_type === 'tv' || (item.name && !item.title);

  // Clear episode list and hide season selector initially
  episodeList.innerHTML = '';
  seasonSelector.style.display = 'none';

  if (isTVShow) {
    seasonSelector.style.display = 'block';
    const seasons = await fetchSeasonsAndEpisodes(item.id);
    const seasonSelect = document.getElementById('season');
    seasonSelect.innerHTML = '';
    
    // Populate dropdown, generally skipping Season 0 (Specials) unless it's the only season
    const validSeasons = seasons.filter(s => s.season_number > 0);
    
    validSeasons.forEach(season => {
      const option = document.createElement('option');
      option.value = season.season_number;
      option.textContent = `Season ${season.season_number}`;
      seasonSelect.appendChild(option);
    });
    
    currentSeason = validSeasons[0]?.season_number || 1;
    seasonSelect.value = currentSeason;
    
    await loadEpisodes();
  } else {
    // For movies, just load the server
    changeServer();
  }

  document.getElementById('modal').style.display = 'flex';
}

async function loadEpisodes() {
  if (!currentItem) return;
  const seasonNumber = document.getElementById('season').value;
  currentSeason = seasonNumber;
  const episodes = await fetchEpisodes(currentItem.id, seasonNumber);
  const episodeList = document.getElementById('episode-list');
  episodeList.innerHTML = '';
  currentEpisode = 1;

  episodes.forEach(episode => {
    // Only display episodes with an episode number greater than 0
    if (episode.episode_number <= 0) return;
    
    const btn = document.createElement('button');
    btn.classList.add('episode-btn');
    btn.textContent = `E${episode.episode_number}`;
    btn.setAttribute('data-episode', episode.episode_number);
    
    btn.onclick = () => {
        document.querySelectorAll('.episode-btn').forEach(e => e.classList.remove('active'));
        btn.classList.add('active');
        currentEpisode = episode.episode_number;
        changeServer();
    };
    episodeList.appendChild(btn);
  });
  
  // Auto-select and load the first episode button
  const firstEpisodeBtn = episodeList.querySelector('.episode-btn');
  if (firstEpisodeBtn) {
      firstEpisodeBtn.click(); // This calls the onclick handler, which sets currentEpisode and calls changeServer
  } else {
      // If no episodes are listed (e.g., season not yet detailed), just load the season base link
      changeServer();
  }
}

function changeServer() {
  if (!currentItem) return;
  const server = document.getElementById('server').value;
  const type = currentItem.media_type || (currentItem.title ? 'movie' : 'tv');
  let embedURL = '';

  if (type === 'movie') {
    // Movie URLs don't need season/episode
    if (server === 'vidsrc.cc') {
      embedURL = `https://vidsrc.cc/v2/embed/movie/${currentItem.id}`;
    } else if (server === 'vidsrc.me') {
      embedURL = `https://vidsrc.net/embed/movie/?tmdb=${currentItem.id}`;
    } else if (server === 'player.videasy.net') {
      embedURL = `https://player.videasy.net/movie/${currentItem.id}`;
    }
  } else {
    // TV show URLs use currentSeason and currentEpisode
    if (server === 'vidsrc.cc') {
      embedURL = `https://vidsrc.cc/v2/embed/tv/${currentItem.id}/${currentSeason}/${currentEpisode}`;
    } else if (server === 'vidsrc.me') {
      embedURL = `https://vidsrc.net/embed/tv/?tmdb=${currentItem.id}&season=${currentSeason}&episode=${currentEpisode}`;
    } else if (server === 'player.videasy.net') {
      embedURL = `https://player.videasy.net/tv/${currentItem.id}/${currentSeason}/${currentEpisode}`;
    }
  }

  document.getElementById('modal-video').src = embedURL;
}

/**
 * FIX: Modified to re-open the 'All View' page if the user navigated from it.
 */
function closeModal() {
  document.getElementById('modal').style.display = 'none';
  document.getElementById('modal-video').src = '';
  document.getElementById('episode-list').innerHTML = '';
  document.getElementById('season-selector').style.display = 'none';

  if (currentAllViewCategory) {
    // Save the category, clear the global state (to prevent recursion), then re-open the view.
    const tempCategory = currentAllViewCategory;
    currentAllViewCategory = null; 
    
    // Re-call openAllView, which ensures the full-screen container is visible 
    // and reloads the current filtered data (as filters in the dropdowns are still set).
    openAllView(tempCategory);
  } else {
    // Standard return to homepage, restore body scroll
    document.body.style.overflow = 'auto';
  }
}

// ==================================================================================
// SEARCH MODAL LOGIC
// ==================================================================================

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
  
  if (!query.trim() || query.length < 3) {
      container.innerHTML = '<p style="text-align:center; color:#555;">Type at least 3 characters to search.</p>';
      return;
  }

  container.innerHTML = '<p class="loading" style="text-align:center; color:#ccc;">Searching...</p>';

  try {
    const res = await fetch(`${BASE_URL}/search/multi?api_key=${API_KEY}&query=${query}&include_adult=false`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    container.innerHTML = '';
    data.results
      .filter(item => item.media_type !== 'person' && item.poster_path)
      .forEach(item => {
        const resultItem = document.createElement('div');
        resultItem.classList.add('search-result-item');
        
        const img = document.createElement('img');
        img.src = item.poster_path ? `${IMG_URL}${item.poster_path}` : FALLBACK_IMAGE;
        img.alt = item.title || item.name || 'Unknown';
        
        const title = document.createElement('p');
        title.textContent = (item.title || item.name || 'Unknown');
        
        resultItem.appendChild(img);
        resultItem.appendChild(title);

        resultItem.onclick = () => {
          closeSearchModal();
          showDetails(item);
        };
        container.appendChild(resultItem);
      });
      
    if (container.children.length === 0) {
        container.innerHTML = '<p style="color: #ccc; text-align: center; margin-top: 20px;">No results found.</p>';
    }

  } catch (error) {
    console.error('Error searching:', error);
    showError('Search failed. Try again.', 'search-results');
  }
}, 300);

// ==================================================================================
// FULL-SCREEN ALL VIEW (DISCOVER PAGE) LOGIC
// ==================================================================================

/** Populates the Year dropdown with the current year and past years. */
function populateYearFilter() {
    const select = document.getElementById('year-filter');
    const currentYear = new Date().getFullYear();
    // Clear existing options, keeping "All Years"
    select.innerHTML = '<option value="">All Years</option>'; 
    
    for (let year = currentYear; year >= 1950; year--) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        select.appendChild(option);
    }
}

/** Populates the Genre dropdown based on the category type. */
function populateGenreFilter(mediaType) {
    const select = document.getElementById('genre-filter');
    select.innerHTML = '<option value="">All Genres</option>'; // Reset
    
    const genres = mediaType === 'movie' ? movieGenres : tvGenres;
    
    genres.forEach(genre => {
        const option = document.createElement('option');
        option.value = genre.id;
        option.textContent = genre.name;
        select.appendChild(option);
    });
}

/** Renders items in the full-screen grid. */
function displayAllView(items, append = false) {
    const container = document.getElementById('all-view-grid');
    const loadingIndicator = document.getElementById('all-view-loading');
    
    if (!append) {
        container.innerHTML = '';
        loadingIndicator.style.display = 'none';
    }

    if (items.length === 0 && !append) {
        container.innerHTML = '<p style="color: #ccc; text-align: center; grid-column: 1 / -1;">No content available with current filters.</p>';
        return;
    }

    items.forEach(item => {
        if (!item.poster_path || container.querySelector(`[data-id="${item.id}"]`)) return; 

        const img = document.createElement('img');
        img.src = item.poster_path ? `${IMG_URL}${item.poster_path}` : FALLBACK_IMAGE;
        img.alt = (item.title || item.name || 'Unknown');
        img.setAttribute('data-id', item.id);
        
        img.onclick = () => {
            closeAllView();
            showDetails(item);
        };
        container.appendChild(img);
    });
}

/** Opens the full-screen "All View" and loads content. */
async function openAllView(category) {
    const container = document.getElementById('all-view-container');
    const titleElement = document.getElementById('all-view-title');
    
    // Find the title from the button's parent structure
    const row = document.querySelector(`button[data-category="${category}"]`).closest('.row');
    const categoryTitle = row.querySelector('span').textContent;

    // Save the state if this is the initial click from the homepage
    if (currentAllViewCategory !== category) {
        currentPages.allView = 1; 
        allViewTotalPages = 1;
        container.scrollTop = 0;
        
        // Reset filters only on fresh category click from homepage
        document.getElementById('genre-filter').value = "";
        document.getElementById('year-filter').value = "";
    }
    
    // Set the category after the conditional check above
    currentAllViewCategory = category;

    // Determine media type for filter population
    const mediaType = (category.includes('tv') || category.includes('drama') || category.includes('anime')) ? 'tv' : 'movie';
    populateGenreFilter(mediaType);
    
    // Show view
    titleElement.textContent = categoryTitle;
    container.style.display = 'block';
    document.body.style.overflow = 'hidden';

    // Fetch initial data (page 1)
    await loadAllViewData(1, true);

    // Setup vertical infinite scroll
    container.onscroll = debounce(() => {
        if (
            container.scrollTop + container.clientHeight >= container.scrollHeight - 500 &&
            currentPages.allView < allViewTotalPages
        ) {
            loadAllViewData(currentPages.allView + 1);
        }
    }, 100);
}

/** Handler for filter changes: resets pagination and reloads data. */
function filterAllView() {
    if (!currentAllViewCategory) return;
    
    currentPages.allView = 1;
    allViewTotalPages = 1;
    loadAllViewData(1, true); 
}

/** Fetches content for the full-screen All View, applying filters. */
async function loadAllViewData(pageNumber, initialLoad = false) {
    const category = currentAllViewCategory;
    const loadingIndicator = document.getElementById('all-view-loading');
    const allViewGrid = document.getElementById('all-view-grid');

    if (!category) return;
    if (pageNumber > allViewTotalPages && !initialLoad) return;
    
    if (!initialLoad) loadingIndicator.style.display = 'block';
    if (initialLoad) allViewGrid.innerHTML = ''; 

    try {
        let url;
        let mediaType = (category.includes('tv') || category.includes('drama') || category.includes('anime')) ? 'tv' : 'movie';

        // Read filter values
        const selectedGenre = document.getElementById('genre-filter').value;
        const selectedYear = document.getElementById('year-filter').value;
        
        let genreParam = selectedGenre ? `&with_genres=${selectedGenre}` : '';
        let yearParam = selectedYear ? `&primary_release_year=${selectedYear}` : '';
        let baseParams = `api_key=${API_KEY}&sort_by=popularity.desc&include_adult=false&page=${pageNumber}${genreParam}${yearParam}`;

        // Construct the URL based on the initial category, applying filters
        if (category === 'movies') {
          url = `${BASE_URL}/discover/movie?${baseParams}`;
        } else if (category === 'tvshows') {
          url = `${BASE_URL}/discover/tv?${baseParams}`;
        } else if (category === 'anime') {
          url = `${BASE_URL}/discover/tv?${baseParams}&with_genres=16&with_original_language=ja`;
        } else if (category === 'tagalog-movies') {
          url = `${BASE_URL}/discover/movie?${baseParams}&with_original_language=tl`;
        } else if (category === 'netflix-movies') {
          url = `${BASE_URL}/discover/movie?${baseParams}&with_watch_providers=8&watch_region=US`;
        } else if (category === 'netflix-tv') {
          url = `${BASE_URL}/discover/tv?${baseParams}&with_watch_providers=8&watch_region=US`;
        } else if (category === 'korean-drama') {
          url = `${BASE_URL}/discover/tv?${baseParams}&with_original_language=ko&with_genres=18`;
        }
        
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        
        if (data.results) {
            data.results.forEach(item => item.media_type = item.media_type || mediaType);
        }

        if (data) {
            allViewTotalPages = data.total_pages || 1;
            currentPages.allView = pageNumber;
            displayAllView(data.results || [], !initialLoad);
        }

    } catch (error) {
        console.error(`Error loading data for All View (${category}):`, error);
        if (initialLoad) {
            allViewGrid.innerHTML = '<p class="error-message" style="grid-column: 1 / -1;">Failed to load content.</p>';
        }
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

/** Closes the full-screen "All View" and restores homepage scroll. */
function closeAllView() {
    document.getElementById('all-view-container').style.display = 'none';
    document.body.style.overflow = 'auto'; 
    currentAllViewCategory = null; 
    document.getElementById('all-view-grid').innerHTML = '';
    document.getElementById('all-view-container').onscroll = null; 
}


// ==================================================================================
// INITIALIZATION
// ==================================================================================

async function init() {
  document.getElementById('empty-message').style.display = 'none';
  
  const apiKeyValid = await testApiKey();
  if (!apiKeyValid) {
      return;
  }

  // Fetch and store genres and populate years once
  [movieGenres, tvGenres] = await Promise.all([
      fetchGenres('movie'),
      fetchGenres('tv')
  ]);
  populateYearFilter();

  try {
    // Show loading for all sections initially
    showLoading('slides');
    showLoading('movies-list');
    showLoading('tvshows-list');
    showLoading('anime-list');
    showLoading('tagalog-movies-list');
    showLoading('netflix-movies-list');
    showLoading('netflix-tv-list');
    showLoading('korean-drama-list');

    const [moviesData, tvShowsData, animeData, tagalogMoviesData, netflixMoviesData, netflixTVData, koreanDramaData] = await Promise.all([
      fetchTrending('movie', currentPages.movies),
      fetchTrending('tv', currentPages.tvShows),
      fetchTrendingAnime(currentPages.anime),
      fetchTagalogMovies(currentPages.tagalogMovies),
      fetchNetflixMovies(currentPages.netflixMovies),
      fetchNetflixTV(currentPages.netflixTV),
      fetchKoreanDrama(currentPages.koreanDrama)
    ]);

    const movies = moviesData.results || [];
    const tvShows = tvShowsData.results || [];
    const anime = animeData.results || [];
    const tagalogMovies = tagalogMoviesData.results || [];
    const netflixMovies = netflixMoviesData.results || [];
    const netflixTV = netflixTVData.results || [];
    const koreanDrama = koreanDramaData.results || [];

    // Combine for slideshow
    slideshowItems = [
      ...movies.slice(0, 2),
      ...tvShows.slice(0, 2),
      anime[0] || {},
      tagalogMovies[0] || {},
      netflixMovies[0] || {}, 
      netflixTV[0] || {},
      koreanDrama[0] || {} 
    ].filter(item => item.backdrop_path && (item.title || item.name));

    displaySlides();

    displayList(movies, 'movies-list');
    displayList(tvShows, 'tvshows-list');
    displayList(anime, 'anime-list');
    displayList(tagalogMovies, 'tagalog-movies-list');
    displayList(netflixMovies, 'netflix-movies-list');
    displayList(netflixTV, 'netflix-tv-list');
    displayList(koreanDrama, 'korean-drama-list');
    
    // Setup infinite scroll listeners
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
