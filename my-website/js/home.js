// js/home.js
const API_KEY = '40f1982842db35042e8561b13b38d492'; // Replace with your TMDB API key
const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_URL = 'https://image.tmdb.org/t/p/original';
const FALLBACK_IMAGE = 'https://via.placeholder.com/150x225?text=No+Image';
let currentItem;
let currentSeason = 1;
let currentEpisode = 1;
let currentPages = {
  movies: 1,
  tvshows: 1,
  anime: 1,
  tagalogMovies: 1,
  netflix: 1
};
let isLoading = {
  movies: false,
  tvshows: false,
  anime: false,
  'tagalog-movies': false,
  netflix: false
};
let hasMore = {
  movies: true,
  tvshows: true,
  anime: true,
  'tagalog-movies': true,
  netflix: true
};
let scrollActive = {
  movies: false,
  tvshows: false,
  anime: false,
  'tagalog-movies': false,
  netflix: false
};
let slideshowItems = [];
let currentSlide = 0;
let slideshowInterval;

function sanitizeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function fetchWithCache(url, key, expiryMinutes = 60) {
  const cached = localStorage.getItem(key);
  if (cached) {
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp < expiryMinutes * 60 * 1000) {
      return data;
    }
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  const data = await res.json();
  localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
  return data;
}

async function fetchTrending(type, page = 1, genreId = '') {
  try {
    console.log(`Fetching trending ${type} page ${page}...`);
    const url = `${BASE_URL}/trending/${type}/week?api_key=${API_KEY}&page=${page}${genreId ? `&with_genres=${genreId}` : ''}`;
    const data = await fetchWithCache(url, `trending-${type}-page-${page}-genre-${genreId || 'all'}`);
    console.log(`Fetched ${data.results?.length || 0} items for ${type}`);
    return data;
  } catch (error) {
    console.error(`Error fetching trending ${type}:`, error);
    showError(`Failed to load ${type}. Check API key or connection.`, `${type}-list`);
    return { results: [] };
  }
}

async function fetchTrendingAnime(page = 1) {
  try {
    console.log(`Fetching anime page ${page}...`);
    const movieUrl = `${BASE_URL}/discover/movie?api_key=${API_KEY}&sort_by=popularity.desc&include_adult=false&include_video=false&page=${page}&with_genres=16&with_original_language=ja`;
    const tvUrl = `${BASE_URL}/discover/tv?api_key=${API_KEY}&sort_by=popularity.desc&include_adult=false&include_video=false&page=${page}&with_genres=16&with_original_language=ja`;
    
    const [movieData, tvData] = await Promise.all([
      fetchWithCache(movieUrl, `anime-movies-page-${page}`),
      fetchWithCache(tvUrl, `anime-tv-page-${page}`)
    ]);
    
    const movies = movieData.results || [];
    const tvShows = tvData.results || [];
    
    const combined = [...movies, ...tvShows]
      .filter(item => item.poster_path)
      .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
      .slice(0, 20);
    console.log(`Fetched ${combined.length} anime items`);
    return combined;
  } catch (error) {
    console.error('Error fetching trending anime:', error);
    showError('Failed to load anime.', 'anime-list');
    return [];
  }
}

async function fetchTagalogMovies(page = 1) {
  try {
    console.log(`Fetching Tagalog movies page ${page}...`);
    const url = `${BASE_URL}/discover/movie?api_key=${API_KEY}&language=tl&sort_by=popularity.desc&include_adult=false&include_video=false&page=${page}&with_original_language=tl`;
    const data = await fetchWithCache(url, `tagalog-movies-page-${page}`);
    console.log(`Fetched ${data.results?.length || 0} Tagalog movies`);
    return data;
  } catch (error) {
    console.error('Error fetching Tagalog movies:', error);
    showError('Failed to load Tagalog movies.', 'tagalog-movies-list');
    return { results: [] };
  }
}

async function fetchNetflixContent(page = 1) {
  try {
    console.log(`Fetching Netflix content page ${page}...`);
    const movieUrl = `${BASE_URL}/discover/movie?api_key=${API_KEY}&with_watch_providers=8&watch_region=US&sort_by=popularity.desc&include_adult=false&include_video=false&page=${page}`;
    const tvUrl = `${BASE_URL}/discover/tv?api_key=${API_KEY}&with_watch_providers=8&watch_region=US&sort_by=popularity.desc&include_adult=false&include_video=false&page=${page}`;
    
    const [movieData, tvData] = await Promise.all([
      fetchWithCache(movieUrl, `netflix-movies-page-${page}`),
      fetchWithCache(tvUrl, `netflix-tv-page-${page}`)
    ]);
    
    const movies = movieData.results || [];
    const tvShows = tvData.results || [];
    
    const combined = [...movies, ...tvShows].sort((a, b) => (b.popularity || 0) - (a.popularity || 0)).slice(0, 20);
    console.log(`Fetched ${combined.length} Netflix items`);
    return combined;
  } catch (error) {
    console.error('Error fetching Netflix content:', error);
    showError('Failed to load Netflix content.', 'netflix-list');
    return [];
  }
}

async function fetchSeasonsAndEpisodes(tvId) {
  try {
    const url = `${BASE_URL}/tv/${tvId}?api_key=${API_KEY}`;
    const data = await fetchWithCache(url, `tv-${tvId}-seasons`);
    return data.seasons || [];
  } catch (error) {
    console.error('Error fetching seasons:', error);
    return [];
  }
}

async function fetchEpisodes(tvId, seasonNumber) {
  try {
    const url = `${BASE_URL}/tv/${tvId}/season/${seasonNumber}?api_key=${API_KEY}`;
    const data = await fetchWithCache(url, `tv-${tvId}-season-${seasonNumber}`);
    return data.episodes || [];
  } catch (error) {
    console.error('Error fetching episodes:', error);
    return [];
  }
}

function showError(message, containerId) {
  const container = document.getElementById(containerId);
  if (container) {
    const error = document.createElement('p');
    error.className = 'error-message';
    error.textContent = message;
    container.appendChild(error);
  } else {
    const emptyMessage = document.getElementById('empty-message');
    if (emptyMessage) {
      emptyMessage.textContent = message;
      emptyMessage.style.display = 'block';
      emptyMessage.className = 'error-message';
    }
  }
}

function showLoading(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const existingLoading = container.querySelector('.loading');
  if (!existingLoading) {
    const loading = document.createElement('p');
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

  if (slideshowItems.length === 0) {
    slidesContainer.innerHTML = '<h1 class="loading">No featured content available. Retrying...</h1>';
    setTimeout(init, 5000);
    return;
  }

  slideshowItems.forEach((item, index) => {
    if (!item.backdrop_path) return;
    const slide = document.createElement('div');
    slide.className = 'slide';
    slide.style.backgroundImage = `url(${IMG_URL}${item.backdrop_path})`;
    slide.setAttribute('loading', 'lazy');
    slide.innerHTML = `<h1>${sanitizeHTML(item.title || item.name || 'Unknown')}</h1>`;
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

  slidesContainer.onmouseover = () => clearInterval(slideshowInterval);
  slidesContainer.onmouseout = () => {
    slideshowInterval = setInterval(() => {
      currentSlide = (currentSlide + 1) % document.querySelectorAll('.slide').length;
      showSlide();
    }, 5000);
  };

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

function displayList(items, containerId) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`Container ${containerId} not found`);
    return;
  }
  container.querySelector('.loading')?.remove();
  container.querySelector('.error-message')?.remove();

  const fragment = document.createDocumentFragment();
  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'card';
    const img = document.createElement('img');
    img.src = item.poster_path ? `${IMG_URL}${item.poster_path}` : FALLBACK_IMAGE;
    img.alt = sanitizeHTML(item.title || item.name || 'Unknown');
    img.setAttribute('loading', 'lazy');
    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = item.title || item.name || 'Unknown';
    card.appendChild(img);
    card.appendChild(title);
    card.onclick = () => showDetails(item);
    fragment.appendChild(card);
  });

  if (items.length === 0) {
    container.innerHTML = '<p style="color: #ccc; text-align: center;">No content available.</p>';
    return;
  }
  container.appendChild(fragment);
}

function addLoadMoreButton(containerId, category) {
  const container = document.getElementById(containerId);
  if (!container || container.querySelector('.load-more')) return;
  const button = document.createElement('button');
  button.className = 'load-more';
  button.textContent = 'Show More';
  button.onclick = () => loadMore(category);
  container.appendChild(button);
}

function addLoadMoreIfApplicable(containerId, category) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (container.innerHTML && !container.querySelector('p') && hasMore[category]) {
    addLoadMoreButton(containerId, category);
  }
}

function addScrollListener(category) {
  const containerId = category + '-list';
  const container = document.getElementById(containerId);
  if (!container) return;
  container.onscroll = function () {
    if (
      scrollActive[category] &&
      !isLoading[category] &&
      hasMore[category] &&
      container.scrollLeft + container.clientWidth >= container.scrollWidth - 100
    ) {
      loadMore(category);
    }
  };
}

async function filterByGenre(category) {
  const genreId = document.getElementById(`${category}-genre`).value;
  currentPages[category] = 1;
  hasMore[category] = true;
  const container = document.getElementById(`${category}-list`);
  container.innerHTML = '';
  showLoading(`${category}-list`);
  const data = await fetchTrending(category === 'movies' ? 'movie' : 'tv', 1, genreId);
  displayList(data.results || [], `${category}-list`);
  addLoadMoreIfApplicable(`${category}-list`, category);
}

async function loadMore(category) {
  if (isLoading[category] || !hasMore[category]) return;
  isLoading[category] = true;

  const containerId = category + '-list';
  const container = document.getElementById(containerId);
  const button = container.querySelector('.load-more');

  if (button) {
    button.textContent = 'Loading...';
    button.disabled = true;
  } else {
    showLoading(containerId);
  }

  let pageKey = category.replace(/-/g, '');
  if (pageKey === 'tvshows') pageKey = 'tvShows';
  if (pageKey === 'tagalogmovies') pageKey = 'tagalogMovies';
  currentPages[pageKey]++;

  try {
    let data;
    if (category === 'movies') {
      const genreId = document.getElementById('movies-genre').value;
      data = await fetchTrending('movie', currentPages[pageKey], genreId);
    } else if (category === 'tvshows') {
      const genreId = document.getElementById('tvshows-genre').value;
      data = await fetchTrending('tv', currentPages[pageKey], genreId);
    } else if (category === 'anime') {
      data = await fetchTrendingAnime(currentPages[pageKey]);
    } else if (category === 'tagalog-movies') {
      data = await fetchTagalogMovies(currentPages[pageKey]);
    } else if (category === 'netflix') {
      data = await fetchNetflixContent(currentPages[pageKey]);
    }

    const items = category === 'anime' || category === 'netflix' ? data : data.results || [];

    displayList(items, containerId);

    if (items.length < 20) {
      hasMore[category] = false;
      if (button) {
        button.textContent = 'No More Content';
        button.disabled = true;
      }
    } else if (button) {
      button.remove();
      scrollActive[category] = true;
      addScrollListener(category);
    }
  } catch (error) {
    console.error(`Error loading more for ${category}:`, error);
    showError(`Failed to load more ${category}.`, containerId);
    if (button) {
      button.textContent = 'Show More';
      button.disabled = false;
    }
  } finally {
    isLoading[category] = false;
  }
}

function toggleFavorite(item) {
  let favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
  const index = favorites.findIndex(f => f.id === item.id);
  if (index === -1) {
    favorites.push(item);
  } else {
    favorites.splice(index, 1);
  }
  localStorage.setItem('favorites', JSON.stringify(favorites));
  displayFavorites();
}

function displayFavorites() {
  const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
  displayList(favorites, 'favorites-list');
}

function addToRecentlyViewed(item) {
  let recentlyViewed = JSON.parse(localStorage.getItem('recentlyViewed') || '[]');
  recentlyViewed = recentlyViewed.filter(i => i.id !== item.id);
  recentlyViewed.unshift(item);
  if (recentlyViewed.length > 10) recentlyViewed.pop();
  localStorage.setItem('recentlyViewed', JSON.stringify(recentlyViewed));
  displayRecentlyViewed();
}

function displayRecentlyViewed() {
  const recentlyViewed = JSON.parse(localStorage.getItem('recentlyViewed') || '[]');
  displayList(recentlyViewed, 'recently-viewed-list');
}

async function showDetails(item) {
  addToRecentlyViewed(item);
  currentItem = item;
  currentSeason = 1;
  currentEpisode = 1;
  const modal = document.getElementById('modal');
  document.getElementById('modal-title').textContent = sanitizeHTML(item.title || item.name || 'Unknown');
  document.getElementById('modal-description').textContent = item.overview || 'No description available.';
  document.getElementById('modal-image').src = item.poster_path ? `${IMG_URL}${item.poster_path}` : FALLBACK_IMAGE;
  document.getElementById('modal-image').alt = sanitizeHTML(item.title || item.name || 'Unknown');
  document.getElementById('modal-rating').innerHTML = '★'.repeat(Math.round((item.vote_average || 0) / 2));
  document.getElementById('server').value = 'player.videasy.net';

  const favoriteBtn = document.getElementById('favorite-btn');
  favoriteBtn.innerHTML = JSON.parse(localStorage.getItem('favorites') || '[]').some(f => f.id === item.id) ? '★ Remove Favorite' : '☆ Add Favorite';
  favoriteBtn.onclick = () => {
    toggleFavorite(item);
    favoriteBtn.innerHTML = JSON.parse(localStorage.getItem('favorites') || '[]').some(f => f.id === item.id) ? '★ Remove Favorite' : '☆ Add Favorite';
  };

  const seasonSelector = document.getElementById('season-selector');
  const episodeList = document.getElementById('episode-list');

  if (item.media_type === 'tv' || !item.title) {
    seasonSelector.style.display = 'block';
    const seasons = await fetchSeasonsAndEpisodes(item.id);
    const seasonSelect = document.getElementById('season');
    seasonSelect.innerHTML = '';
    seasons.forEach(season => {
      if (season.season_number === 0) return;
      const option = document.createElement('option');
      option.value = season.season_number;
      option.textContent = `Season ${season.season_number}`;
      seasonSelect.appendChild(option);
    });
    await loadEpisodes();
  } else {
    seasonSelector.style.display = 'none';
    episodeList.innerHTML = '';
  }

  changeServer();
  modal.style.display = 'flex';
  document.getElementById('modal-title').focus();
  trapFocus(modal);
}

async function loadEpisodes() {
  if (!currentItem || (currentItem.media_type !== 'tv' && currentItem.title)) return;
  const seasonNumber = document.getElementById('season').value;
  currentSeason = seasonNumber;
  const episodeList = document.getElementById('episode-list');
  episodeList.innerHTML = '<p class="loading">Loading episodes...</p>';
  const episodes = await fetchEpisodes(currentItem.id, seasonNumber);
  episodeList.innerHTML = '';

  episodes.forEach(episode => {
    const div = document.createElement('div');
    div.className = 'episode-item';
    const img = episode.still_path
      ? `<img src="${IMG_URL}${episode.still_path}" alt="Episode ${episode.episode_number}" loading="lazy" />`
      : '';
    div.innerHTML = `${img}<span>Episode ${episode.episode_number}: ${sanitizeHTML(episode.name || 'Untitled')}</span>`;
    div.onclick = () => {
      currentEpisode = episode.episode_number;
      changeServer();
    };
    episodeList.appendChild(div);
  });
}

function changeServer() {
  if (!currentItem) return;
  const server = document.getElementById('server').value;
  const type = currentItem.media_type || (currentItem.title ? 'movie' : 'tv');
  let embedURL = '';
  const container = document.getElementById('modal-video-container');
  const iframe = document.getElementById('modal-video');

  container.classList.add('loading');
  iframe.onload = () => container.classList.remove('loading');
  iframe.onerror = () => {
    container.classList.remove('loading');
    showError('Failed to load video. Try another server.', 'episode-list');
  };

  if (server === 'vidsrc.cc') {
    embedURL = type === 'tv'
      ? `https://vidsrc.cc/v2/embed/tv/${currentItem.id}/${currentSeason}/${currentEpisode}`
      : `https://vidsrc.cc/v2/embed/${type}/${currentItem.id}`;
  } else if (server === 'vidsrc.me') {
    embedURL = type === 'tv'
      ? `https://vidsrc.net/embed/tv/?tmdb=${currentItem.id}&season=${currentSeason}&episode=${currentEpisode}`
      : `https://vidsrc.net/embed/${type}/?tmdb=${currentItem.id}`;
  } else if (server === 'player.videasy.net') {
    embedURL = type === 'tv'
      ? `https://player.videasy.net/tv/${currentItem.id}/${currentSeason}/${currentEpisode}`
      : `https://player.videasy.net/${type}/${currentItem.id}`;
  }

  if (!embedURL) {
    iframe.outerHTML = '<p class="error-message">Video unavailable. Try another server.</p>';
    return;
  }
  iframe.src = embedURL;
}

function closeModal() {
  const modal = document.getElementById('modal');
  modal.style.display = 'none';
  document.getElementById('modal-video').src = '';
  document.getElementById('episode-list').innerHTML = '';
  document.getElementById('season-selector').style.display = 'none';
}

function openSearchModal() {
  const searchModal = document.getElementById('search-modal');
  searchModal.style.display = 'flex';
  document.getElementById('search-input').focus();
}

function closeSearchModal() {
  document.getElementById('search-modal').style.display = 'none';
  document.getElementById('search-results').innerHTML = '';
}

function toggleMenu() {
  document.getElementById('nav-links').classList.toggle('active');
}

function trapFocus(modal) {
  const focusableElements = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    } else if (e.key === 'Escape') {
      closeModal();
    }
  });
}

let debounceTimeout;
function debounceSearch() {
  clearTimeout(debounceTimeout);
  debounceTimeout = setTimeout(searchTMDB, 300);
}

async function searchTMDB() {
  const query = document.getElementById('search-input').value;
  if (!query.trim()) {
    document.getElementById('search-results').innerHTML = '';
    return;
  }

  try {
    const url = `${BASE_URL}/search/multi?api_key=${API_KEY}&query=${encodeURIComponent(query)}`;
    const data = await fetchWithCache(url, `search-${query}`);
    const container = document.getElementById('search-results');
    container.innerHTML = '';
    data.results.forEach(item => {
      const card = document.createElement('div');
      card.className = 'card';
      const img = document.createElement('img');
      img.src = item.poster_path ? `${IMG_URL}${item.poster_path}` : FALLBACK_IMAGE;
      img.alt = sanitizeHTML(item.title || item.name || 'Unknown');
      img.setAttribute('loading', 'lazy');
      const title = document.createElement('div');
      title.className = 'title';
      title.textContent = item.title || item.name || 'Unknown';
      card.appendChild(img);
      card.appendChild(title);
      card.onclick = () => {
        closeSearchModal();
        showDetails(item);
      };
      container.appendChild(card);
    });
  } catch (error) {
    console.error('Error searching:', error);
    showError('Search failed. Try again.', 'search-results');
  }
}

async function init() {
  console.log('Initializing site...');
  document.getElementById('empty-message').style.display = 'none';

  try {
    showLoading('slides');
    showLoading('movies-list');
    showLoading('tvshows-list');
    showLoading('anime-list');
    showLoading('tagalog-movies-list');
    showLoading('netflix-list');
    showLoading('favorites-list');
    showLoading('recently-viewed-list');

    const [moviesData, tvShowsData, anime, tagalogMoviesData, netflixContent] = await Promise.all([
      fetchTrending('movie', currentPages.movies),
      fetchTrending('tv', currentPages.tvShows),
      fetchTrendingAnime(currentPages.anime),
      fetchTagalogMovies(currentPages.tagalogMovies),
      fetchNetflixContent(currentPages.netflix)
    ]);

    const movies = moviesData.results || [];
    const tvShows = tvShowsData.results || [];
    const tagalogMovies = tagalogMoviesData.results || [];

    slideshowItems = [
      ...movies.slice(0, 3),
      tvShows[0] || {},
      anime[0] || {},
      tagalogMovies[0] || {},
      netflixContent[0] || {}
    ].filter(item => item.backdrop_path && (item.title || item.name));

    displaySlides();
    displayFavorites();
    displayRecentlyViewed();
    displayList(movies, 'movies-list');
    addLoadMoreIfApplicable('movies-list', 'movies');
    displayList(tvShows, 'tvshows-list');
    addLoadMoreIfApplicable('tvshows-list', 'tvshows');
    displayList(anime, 'anime-list');
    addLoadMoreIfApplicable('anime-list', 'anime');
    displayList(tagalogMovies, 'tagalog-movies-list');
    addLoadMoreIfApplicable('tagalog-movies-list', 'tagalog-movies');
    displayList(netflixContent, 'netflix-list');
    addLoadMoreIfApplicable('netflix-list', 'netflix');

    console.log('Initialization complete.');
  } catch (error) {
    console.error('Error initializing:', error);
    showError('Failed to load content. Please refresh or check your connection.', 'empty-message');
  }

  document.getElementById('search-input').oninput = debounceSearch;
  window.addEventListener('unload', () => clearInterval(slideshowInterval));
}

init();