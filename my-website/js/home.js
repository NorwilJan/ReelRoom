// ==================================================================================
// CONFIGURATION AND CONSTANTS
// IMPORTANT: Replace YOUR_API_KEY with your actual TMDB API key.
// ==================================================================================
const API_KEY = '40f1982842db35042e8561b13b38d492'; // <--- Make sure this is your key!
const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_URL = 'https://image.tmdb.org/t/p/w500';
const FALLBACK_IMAGE = 'assets/fallback.jpg'; // Assuming you have a fallback image asset

// Global state variables for pagination and loading
let currentSlide = 0;
let slideshowInterval;
let currentPages = {
  movies: 1,
  tvShows: 1,
  anime: 1,
  tagalogMovies: 1,
  netflixMovies: 1,
  netflixTV: 1,
  koreanDrama: 1,
  allView: 1 // New key for the full-screen view pagination
};
let isLoading = {
  movies: false,
  tvshows: false,
  anime: false,
  'tagalog-movies': false,
  'netflix-movies': false,
  'netflix-tv': false,
  'korean-drama': false,
};

// Global state for All View/Discover page
let currentAllViewCategory = null; 
let allViewTotalPages = 1;
let movieGenres = []; 
let tvGenres = []; 

// ==================================================================================
// UTILITY FUNCTIONS
// ==================================================================================

/** Debounces a function call to prevent excessive firing (e.g., during fast scrolling) */
function debounce(func, delay) {
  let timeout;
  return function() {
    const context = this;
    const args = arguments;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), delay);
  };
}

/** Shows an error message if content fails to load. */
function showError(message, listId) {
  const listElement = document.getElementById(listId);
  if (listElement) {
    listElement.innerHTML = `<p style="color: #FF6347; padding: 10px;">${message}</p>`;
  }
}

/** Converts rating (0-10) to star rating HTML. */
function getStarRating(voteAverage) {
  const rating = Math.round(voteAverage / 2);
  let stars = '';
  for (let i = 0; i < 5; i++) {
    stars += `<i class="fa-solid fa-star${i < rating ? '' : '-o'}"></i>`;
  }
  return stars;
}

// ==================================================================================
// API FETCH FUNCTIONS
// ==================================================================================

/** Tests the API key validity and returns a boolean. */
async function testApiKey() {
    if (API_KEY === '40f1982842db35042e8561b13b38d492' || !API_KEY) {
        document.getElementById('empty-message').innerHTML = '<p style="color:red;">Error: Please set your TMDB API Key in js/home.js.</p>';
        document.getElementById('empty-message').style.display = 'block';
        return false;
    }
    const res = await fetch(`${BASE_URL}/trending/all/day?api_key=${API_KEY}`);
    if (!res.ok) {
        document.getElementById('empty-message').innerHTML = `<p style="color:red;">Error: API Key failed to load content (Status: ${res.status}). Check your key.</p>`;
        document.getElementById('empty-message').style.display = 'block';
        return false;
    }
    return true;
}

/** Fetches trending content for the banner. */
async function fetchBannerContent() {
  const res = await fetch(`${BASE_URL}/trending/all/day?api_key=${API_KEY}`);
  const data = await res.json();
  return data.results || [];
}

/** Fetches genres list from TMDB. */
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

/** General function to fetch trending movies/tv. */
async function fetchTrending(type, page = 1) {
  const res = await fetch(`${BASE_URL}/trending/${type}/week?api_key=${API_KEY}&page=${page}`);
  const data = await res.json();
  if (data.results) {
    data.results.forEach(item => item.media_type = type);
  }
  return data;
}

/** Fetches content with specific language/genre filters. */
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


// ==================================================================================
// HOME PAGE (HORIZONTAL LIST) LOGIC
// ==================================================================================

/** Displays content in a horizontal list. */
function displayList(items, listId) {
  const list = document.getElementById(listId);
  if (!list) return;

  items.forEach(item => {
    if (!item.poster_path) return;
    const listItem = document.createElement('div');
    listItem.classList.add('list-item');
    listItem.onclick = () => showDetails(item);

    const img = document.createElement('img');
    img.src = `${IMG_URL}${item.poster_path}`;
    img.alt = (item.title || item.name || 'Unknown');

    const title = document.createElement('p');
    title.textContent = (item.title || item.name || 'Unknown');

    listItem.appendChild(img);
    listItem.appendChild(title);
    list.appendChild(listItem);
  });
}

/** Sets up the scroll listener for infinite horizontal loading. */
function addScrollListener(category) {
  const listElement = document.getElementById(`${category}-list`);
  if (!listElement) return;

  listElement.onscroll = debounce(() => {
    if (isLoading[category]) return;

    // Check if scrolled near the end (e.g., last 200px)
    if (listElement.scrollWidth - listElement.scrollLeft - listElement.clientWidth < 200) {
      loadMore(category);
    }
  }, 100);
}

/** Loads the next page of content for a horizontal list. */
async function loadMore(category) {
  const listId = `${category}-list`;
  let pageKey = category.replace(/-/g, '').replace('tvshows', 'tvShows');
  
  if (!currentPages[pageKey]) {
      console.error(`Invalid page key for category: ${category}`);
      return;
  }
  
  isLoading[category] = true;
  currentPages[pageKey]++;
  let data;

  try {
    if (category === 'movies') {
      data = await fetchTrending('movie', currentPages[pageKey]);
    } else if (category === 'tvshows') {
      data = await fetchTrending('tv', currentPages[pageKey]);
    } else if (category === 'anime') {
      data = await fetchTrendingAnime(currentPages[pageKey]);
    } else if (category === 'tagalog-movies') {
      data = await fetchTagalogMovies(currentPages[pageKey]);
    } else if (category === 'netflix-movies') {
      data = await fetchNetflixMovies(currentPages[pageKey]);
    } else if (category === 'netflix-tv') {
      data = await fetchNetflixTV(currentPages[pageKey]);
    } else if (category === 'korean-drama') {
      data = await fetchKoreanDrama(currentPages[pageKey]);
    }

    if (data && data.results && data.results.length > 0) {
      displayList(data.results, listId);
    } else {
      console.log(`No more pages for ${category}.`);
    }
  } catch (error) {
    console.error(`Error loading more ${category}:`, error);
  } finally {
    isLoading[category] = false;
  }
}

// ==================================================================================
// SLIDESHOW/BANNER LOGIC
// ==================================================================================

function createSlide(item) {
  const slide = document.createElement('div');
  slide.classList.add('slide-item');
  slide.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url(${IMG_URL}${item.backdrop_path})`;
  slide.onclick = () => showDetails(item);

  const content = document.createElement('div');
  content.classList.add('slide-content');
  
  const title = document.createElement('h3');
  title.classList.add('slide-title');
  title.textContent = item.title || item.name;

  const rating = document.createElement('p');
  rating.classList.add('slide-rating');
  rating.innerHTML = getStarRating(item.vote_average);

  content.appendChild(title);
  content.appendChild(rating);
  slide.appendChild(content);

  return slide;
}

function updateSlides(items) {
  const slidesContainer = document.getElementById('slides');
  const dotsContainer = document.getElementById('dots');
  slidesContainer.innerHTML = '';
  dotsContainer.innerHTML = '';

  items.slice(0, 5).forEach((item, index) => {
    const slide = createSlide(item);
    slidesContainer.appendChild(slide);

    const dot = document.createElement('span');
    dot.classList.add('dot');
    dot.onclick = () => goToSlide(index);
    dotsContainer.appendChild(dot);
  });
  goToSlide(0);
}

function goToSlide(n) {
  const slides = document.getElementById('slides');
  const slideItems = slides ? slides.querySelectorAll('.slide-item') : [];
  const dots = document.getElementById('dots') ? document.getElementById('dots').querySelectorAll('.dot') : [];
  if (slideItems.length === 0) return;

  currentSlide = (n + slideItems.length) % slideItems.length;
  slides.style.transform = `translateX(${-currentSlide * 100}%)`;

  dots.forEach(dot => dot.classList.remove('active'));
  if (dots[currentSlide]) {
    dots[currentSlide].classList.add('active');
  }
}

function changeSlide(n) {
  goToSlide(currentSlide + n);
  resetSlideshowInterval();
}

function startSlideshowInterval() {
  const slides = document.getElementById('slides');
  if (slides && slides.querySelectorAll('.slide-item').length > 1) {
    slideshowInterval = setInterval(() => goToSlide(currentSlide + 1), 5000);
  }
}

function resetSlideshowInterval() {
  clearInterval(slideshowInterval);
  startSlideshowInterval();
}


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
        container.innerHTML = '<p style="color: #ccc; text-align: center; grid-column: 1 / -1;">No more content available with current filters.</p>';
        return;
    }

    items.forEach(item => {
        if (!item.poster_path) return; 

        const img = document.createElement('img');
        img.src = item.poster_path ? `${IMG_URL}${item.poster_path}` : FALLBACK_IMAGE;
        img.alt = (item.title || item.name || 'Unknown');
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
    
    const row = document.querySelector(`[data-category="${category}"]`).closest('.row');
    const categoryTitle = row.querySelector('span').textContent;

    // Reset state
    currentAllViewCategory = category;
    currentPages.allView = 1; 
    allViewTotalPages = 1;
    container.scrollTop = 0;

    // Determine media type for filter population
    const mediaType = (category.includes('tv') || category.includes('drama') || category.includes('anime')) ? 'tv' : 'movie';
    populateGenreFilter(mediaType);
    
    // Reset filters
    document.getElementById('genre-filter').value = "";
    document.getElementById('year-filter').value = "";

    // Show view
    titleElement.textContent = categoryTitle;
    container.style.display = 'block';
    document.body.style.overflow = 'hidden';

    // Fetch initial data (page 1)
    await loadAllViewData(1, true);

    // Setup vertical infinite scroll
    container.onscroll = debounce(() => {
        if (
            container.scrollTop + container.clientHeight >= container.scrollHeight - 300 &&
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
        let data;
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
          // Anime: uses filters AND fixed language/genre
          url = `${BASE_URL}/discover/tv?${baseParams}&with_genres=16&with_original_language=ja`;
        } else if (category === 'tagalog-movies') {
          // Tagalog: uses filters AND fixed language
          url = `${BASE_URL}/discover/movie?${baseParams}&with_original_language=tl`;
        } else if (category === 'netflix-movies') {
          // Netflix Movies: uses filters AND fixed provider
          url = `${BASE_URL}/discover/movie?${baseParams}&with_watch_providers=8&watch_region=US`;
        } else if (category === 'netflix-tv') {
          // Netflix TV: uses filters AND fixed provider
          url = `${BASE_URL}/discover/tv?${baseParams}&with_watch_providers=8&watch_region=US`;
        } else if (category === 'korean-drama') {
          // Korean Drama: uses filters AND fixed language/genre
          url = `${BASE_URL}/discover/tv?${baseParams}&with_original_language=ko&with_genres=18`;
        }
        
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        data = await res.json();
        
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
// DETAIL MODAL LOGIC (Requires fetchDetails and other modal functions - Omitted for brevity)
// ==================================================================================
// NOTE: Your existing modal functions (showDetails, closeModal, changeServer, etc.) 
// must be present here but are omitted to keep the focus on the new features.

// [Insert your existing showDetails(), closeModal(), etc. functions here]

// ==================================================================================
// INITIALIZATION
// ==================================================================================

async function init() {
  document.getElementById('empty-message').style.display = 'block';
  
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
    const [bannerItems, moviesData, tvShowsData, animeData, tagalogMoviesData, netflixMoviesData, netflixTVData, koreanDramaData] = await Promise.all([
      fetchBannerContent(),
      fetchTrending('movie', currentPages.movies),
      fetchTrending('tv', currentPages.tvShows),
      fetchTrendingAnime(currentPages.anime),
      fetchTagalogMovies(currentPages.tagalogMovies),
      fetchNetflixMovies(currentPages.netflixMovies),
      fetchNetflixTV(currentPages.netflixTV),
      fetchKoreanDrama(currentPages.koreanDrama)
    ]);

    document.getElementById('empty-message').style.display = 'none';

    // Banner
    if (bannerItems.length > 0) {
      updateSlides(bannerItems);
      startSlideshowInterval();
    } else {
      document.getElementById('banner').style.display = 'none';
    }

    // Horizontal Lists
    displayList(moviesData.results || [], 'movies-list');
    displayList(tvShowsData.results || [], 'tvshows-list');
    displayList(animeData.results || [], 'anime-list');
    displayList(tagalogMoviesData.results || [], 'tagalog-movies-list');
    displayList(netflixMoviesData.results || [], 'netflix-movies-list');
    displayList(netflixTVData.results || [], 'netflix-tv-list');
    displayList(koreanDramaData.results || [], 'korean-drama-list');

    // Attach infinite scroll listeners
    addScrollListener('movies');
    addScrollListener('tvshows');
    addScrollListener('anime');
    addScrollListener('tagalog-movies');
    addScrollListener('netflix-movies');
    addScrollListener('netflix-tv');
    addScrollListener('korean-drama');

  } catch (error) {
    console.error('Initialization error:', error);
    document.getElementById('empty-message').style.display = 'block';
    document.getElementById('empty-message').textContent = 'An error occurred while loading content.';
  }
}

// Start the application
init();
