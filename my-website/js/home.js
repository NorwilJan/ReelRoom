// js/home.js
const API_KEY = '40f1982842db35042e8561b13b38d492';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_URL = 'https://image.tmdb.org/t/p/w500';
const FALLBACK_IMAGE = 'https://via.placeholder.com/150x225?text=No+Image';
let currentItem;
let currentSeason = 1;
let currentEpisode = 1;
let currentPages = {
  movies: 1,
  tvShows: 1,
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
let currentMode = 'movies';
let currentGenre = '';
let currentYear = '';
let movieGenres = [];
let tvGenres = [];
let recentlyViewed = JSON.parse(localStorage.getItem('recently_viewed') || '[]');

async function fetchGenres() {
  try {
    const [movieRes, tvRes] = await Promise.all([
      fetch(`${BASE_URL}/genre/movie/list?api_key=${API_KEY}`),
      fetch(`${BASE_URL}/genre/tv/list?api_key=${API_KEY}`)
    ]);
    if (!movieRes.ok || !tvRes.ok) throw new Error('Failed to fetch genres');
    const movieData = await movieRes.json();
    const tvData = await tvRes.json();
    movieGenres = movieData.genres || [];
    tvGenres = tvData.genres || [];
    populateGenreFilter();
    document.getElementById('genre-filter').disabled = false;
  } catch (e) {
    console.error('Error fetching genres:', e);
    document.getElementById('genre-filter').innerHTML = '<option value="" id="genre-all">Failed to load genres</option>';
    document.getElementById('genre-filter').disabled = false;
  }
}

function populateGenreFilter() {
  const genreFilter = document.getElementById('genre-filter');
  genreFilter.innerHTML = '<option value="" id="genre-all">All Genres</option>';
  let genres = currentMode === 'tvshows' ? tvGenres : movieGenres;
  genres.forEach((genre, index) => {
    const option = document.createElement('option');
    option.value = genre.id;
    option.id = `genre-${index}`;
    option.textContent = genre.name;
    genreFilter.appendChild(option);
  });
  genreFilter.value = currentGenre || '';
}

function populateYearFilter() {
  const yearFilter = document.getElementById('year-filter');
  yearFilter.innerHTML = '<option value="" id="year-all">All Years</option>';
  const currentYearNum = new Date().getFullYear();
  for (let year = currentYearNum; year >= 1900; year--) {
    const option = document.createElement('option');
    option.value = year;
    option.id = `year-${year}`;
    option.textContent = year;
    yearFilter.appendChild(option);
  }
  yearFilter.value = currentYear || '';
}

async function fetchTrending(type, page = 1) {
  try {
    console.log(`Fetching trending ${type} page ${page}...`);
    let url = `${BASE_URL}/trending/${type}/week?api_key=${API_KEY}&page=${page}`;
    if (currentGenre) url += `&with_genres=${currentGenre}`;
    if (currentYear && type === 'movie') url += `&primary_release_year=${currentYear}`;
    if (currentYear && type === 'tv') url += `&first_air_date_year=${currentYear}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const data = await res.json();
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
    let movieUrl = `${BASE_URL}/discover/movie?api_key=${API_KEY}&sort_by=popularity.desc&include_adult=false&include_video=false&page=${page}&with_genres=16&with_original_language=ja`;
    let tvUrl = `${BASE_URL}/discover/tv?api_key=${API_KEY}&sort_by=popularity.desc&include_adult=false&include_video=false&page=${page}&with_genres=16&with_original_language=ja`;
    if (currentGenre) {
      movieUrl += `&with_genres=${currentGenre}`;
      tvUrl += `&with_genres=${currentGenre}`;
    }
    if (currentYear) {
      movieUrl += `&primary_release_year=${currentYear}`;
      tvUrl += `&first_air_date_year=${currentYear}`;
    }
    const [movieRes, tvRes] = await Promise.all([
      fetch(movieUrl),
      fetch(tvUrl)
    ]);
    if (!movieRes.ok) throw new Error(`Movies HTTP ${movieRes.status}`);
    if (!tvRes.ok) throw new Error(`TV HTTP ${tvRes.status}`);
    const movieData = await movieRes.json();
    const tvData = await tvRes.json();
    const combined = [...(movieData.results || []), ...(tvData.results || [])]
      .filter(item => item.poster_path)
      .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
      .slice(0, 20);
    console.log(`Fetched ${combined.length} anime items`);
    return combined;
  } catch (error) {
    console.error('Error fetching anime:', error);
    showError('Failed to load anime.', 'anime-list');
    return [];
  }
}

async function fetchTagalogMovies(page = 1) {
  try {
    console.log(`Fetching Tagalog movies page ${page}...`);
    let url = `${BASE_URL}/discover/movie?api_key=${API_KEY}&language=tl&sort_by=popularity.desc&include_adult=false&include_video=false&page=${page}&with_original_language=tl`;
    if (currentGenre) url += `&with_genres=${currentGenre}`;
    if (currentYear) url += `&primary_release_year=${currentYear}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
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
    let movieUrl = `${BASE_URL}/discover/movie?api_key=${API_KEY}&with_watch_providers=8&watch_region=US&sort_by=popularity.desc&include_adult=false&include_video=false&page=${page}`;
    let tvUrl = `${BASE_URL}/discover/tv?api_key=${API_KEY}&with_watch_providers=8&watch_region=US&sort_by=popularity.desc&include_adult=false&include_video=false&page=${page}`;
    if (currentGenre) {
      movieUrl += `&with_genres=${currentGenre}`;
      tvUrl += `&with_genres=${currentGenre}`;
    }
    if (currentYear) {
      movieUrl += `&primary_release_year=${currentYear}`;
      tvUrl += `&first_air_date_year=${currentYear}`;
    }
    const [movieRes, tvRes] = await Promise.all([
      fetch(movieUrl),
      fetch(tvUrl)
    ]);
    if (!movieRes.ok) throw new Error(`Movies HTTP ${movieRes.status}`);
    if (!tvRes.ok) throw new Error(`TV HTTP ${tvRes.status}`);
    const movieData = await movieRes.json();
    const tvData = await tvRes.json();
    const combined = [...(movieData.results || []), ...(tvData.results || [])]
      .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
      .slice(0, 20);
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

function showError(message, containerId) {
  const container = document.getElementById(containerId);
  if (container) {
    const error = document.createElement('p');
    error.className = 'error-state';
    error.textContent = message;
    container.appendChild(error);
  } else {
    const emptyMessage = document.getElementById('empty-message');
    if (emptyMessage) {
      emptyMessage.textContent = message;
      emptyMessage.style.display = 'block';
      emptyMessage.className = 'error-state';
    }
  }
}

function showLoading(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const existingLoading = container.querySelector('.loading-state');
  if (!existingLoading) {
    const loading = document.createElement('p');
    loading.className = 'loading-state';
    loading.textContent = 'Loading...';
    container.appendChild(loading);
  }
}

function displayList(items, containerId) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`Container ${containerId} not found`);
    return;
  }
  container.querySelector('.loading-state')?.remove();
  container.querySelector('.error-state')?.remove();

  if (items.length === 0 && container.innerHTML === '') {
    container.innerHTML = '<p class="empty-state">No content available.</p>';
    return;
  }

  const fragment = document.createDocumentFragment();
  items.forEach(item => {
    const isTv = item.media_type === 'tv' || !!item.name && !item.title;
    const mediaType = isTv ? 'tv' : 'movie';
    const div = document.createElement('div');
    div.className = 'movie-col';
    div.innerHTML = `
      <div class="movie-poster-wrapper" tabindex="0">
        <img loading="lazy" src="${item.poster_path ? IMG_URL + item.poster_path : FALLBACK_IMAGE}" alt="${isTv ? item.name : item.title}" class="movie-poster-img">
        <button class="play-btn-centered" type="button" title="${isTv ? 'View TV Show' : 'Play Movie'}">
          <i class="fas fa-${isTv ? 'tv' : 'play'}"></i>
        </button>
      </div>
      <div class="movie-metadata">
        <span class="movie-title" title="${isTv ? item.name : item.title}">${isTv ? item.name : item.title}</span>
        <span class="movie-year">${(isTv ? item.first_air_date : item.release_date) ? (isTv ? item.first_air_date : item.release_date).slice(0, 4) : ''}</span>
        ${isTv ? '<span class="movie-type" style="font-size: 0.9em; color: #1976d2;">TV Show</span>' : ''}
      </div>
    `;
    div.querySelector('.play-btn-centered').onclick = () => showDetails(item);
    fragment.appendChild(div);
  });
  container.appendChild(fragment);
}

function addLoadMoreButton(containerId, category) {
  const container = document.getElementById(containerId);
  if (!container || container.querySelector('.load-more')) return;
  const button = document.createElement('button');
  button.className = 'load-more btn btn-outline-primary';
  button.textContent = 'Show More';
  button.onclick = () => loadMore(category);
  container.appendChild(button);
}

function addLoadMoreIfApplicable(containerId, category) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (container.innerHTML && !container.querySelector('.empty-state') && hasMore[category]) {
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
      container.scrollLeft + container.clientWidth >= container.scrollWidth - 50
    ) {
      loadMore(category);
    }
  };
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
      data = await fetchTrending('movie', currentPages[pageKey]);
    } else if (category === 'tvshows') {
      data = await fetchTrending('tv', currentPages[pageKey]);
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

function addRecentlyViewed(item) {
  const isTv = item.media_type === 'tv' || !!item.name && !item.title;
  recentlyViewed = recentlyViewed.filter(m => m.id !== item.id || m.media_type !== (isTv ? 'tv' : 'movie'));
  recentlyViewed.unshift({
    id: item.id,
    title: item.title || item.name,
    poster_path: item.poster_path,
    release_date: item.release_date || item.first_air_date,
    media_type: isTv ? 'tv' : 'movie'
  });
  if (recentlyViewed.length > 12) recentlyViewed = recentlyViewed.slice(0, 12);
  localStorage.setItem('recently_viewed', JSON.stringify(recentlyViewed));
  renderRecentlyViewed();
}

function renderRecentlyViewed() {
  const section = document.getElementById('recently-viewed-section');
  const list = document.getElementById('recently-viewed-list');
  if (!recentlyViewed.length) {
    section.style.display = 'none';
    return;
  }
  section.style.display = '';
  list.innerHTML = '';
  recentlyViewed.forEach(item => {
    const div = document.createElement('div');
    div.className = 'movie-col';
    div.innerHTML = `
      <div class="movie-poster-wrapper" tabindex="0">
        <img loading="lazy" src="${item.poster_path ? IMG_URL + item.poster_path : FALLBACK_IMAGE}" alt="${item.title}" class="movie-poster-img">
        <button class="play-btn-centered" type="button" title="${item.media_type === 'tv' ? 'View TV Show' : 'Play Movie'}">
          <i class="fas fa-${item.media_type === 'tv' ? 'tv' : 'play'}"></i>
        </button>
      </div>
      <div class="movie-metadata">
        <span class="movie-title" title="${item.title}">${item.title}</span>
        <span class="movie-year">${item.release_date ? item.release_date.slice(0, 4) : ''}</span>
      </div>
    `;
    div.onclick = () => {
      fetch(`${BASE_URL}/${item.media_type}/${item.id}?api_key=${API_KEY}`)
        .then(r => r.json())
        .then(data => showDetails(data));
    };
    list.appendChild(div);
  });
}

async function showDetails(item) {
  currentItem = item;
  currentSeason = 1;
  currentEpisode = 1;
  const isTv = item.media_type === 'tv' || !!item.name && !item.title;
  const modalMovie = document.getElementById('modal-content-movie');
  const modalTv = document.getElementById('modal-content-tv');
  modalMovie.style.display = isTv ? 'none' : 'block';
  modalTv.style.display = isTv ? 'block' : 'none';
  document.getElementById('modal').style.display = 'flex';

  addRecentlyViewed(item);

  if (isTv) {
    document.getElementById('tv-modal-title').textContent = item.name || 'Unknown';
    document.getElementById('tv-modal-description').textContent = item.overview || 'No description available.';
    document.getElementById('tv-modal-image').src = item.poster_path ? `${IMG_URL}${item.poster_path}` : FALLBACK_IMAGE;
    document.getElementById('tv-modal-rating').innerHTML = '★'.repeat(Math.round((item.vote_average || 0) / 2));
    document.getElementById('tv-modal-air-date').textContent = item.first_air_date || 'N/A';
    document.getElementById('tv-modal-total-seasons').textContent = item.number_of_seasons || 'N/A';
    document.getElementById('tv-modal-genres').innerHTML = (item.genre_ids || item.genres || []).map(gid => {
      let g = typeof gid === 'object' ? gid : (tvGenres.find(x => x.id === gid) || { name: '' });
      return g.name ? `<span class="chip">${g.name}</span>` : '';
    }).join(' ');
    document.getElementById('season-selector').style.display = 'block';
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
    document.getElementById('modal-title').textContent = item.title || 'Unknown';
    document.getElementById('modal-description').textContent = item.overview || 'No description available.';
    document.getElementById('modal-image').src = item.poster_path ? `${IMG_URL}${item.poster_path}` : FALLBACK_IMAGE;
    document.getElementById('modal-rating').innerHTML = '★'.repeat(Math.round((item.vote_average || 0) / 2));
    document.getElementById('modal-genres').innerHTML = (item.genre_ids || item.genres || []).map(gid => {
      let g = typeof gid === 'object' ? gid : (movieGenres.find(x => x.id === gid) || { name: '' });
      return g.name ? `<span class="chip">${g.name}</span>` : '';
    }).join(' ');
    document.getElementById('season-selector').style.display = 'none';
    document.getElementById('episode-list').innerHTML = '';
  }

  document.getElementById('server').value = 'player.videasy.net';
  changeServer();
}

async function loadEpisodes() {
  if (!currentItem || (currentItem.media_type !== 'tv' && currentItem.title)) return;
  const seasonNumber = document.getElementById('season').value;
  currentSeason = seasonNumber;
  const episodes = await fetchEpisodes(currentItem.id, seasonNumber);
  const episodeList = document.getElementById('episode-list');
  episodeList.innerHTML = '';

  episodes.forEach(episode => {
    const div = document.createElement('div');
    div.className = 'episode-item';
    const img = episode.still_path
      ? `<img src="${IMG_URL}${episode.still_path}" alt="Episode ${episode.episode_number}" />`
      : '';
    div.innerHTML = `${img}<span>Episode ${episode.episode_number}: ${episode.name || 'Untitled'}</span>`;
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
  const isTv = currentItem.media_type === 'tv' || !!currentItem.name && !currentItem.title;
  const iframe = isTv ? document.getElementById('tv-episode-player') : document.getElementById('modal-video');
  const playOverlay = iframe.parentElement.querySelector('.iframe-play-overlay');
  let embedURL = '';

  if (server === 'vidsrc.cc') {
    embedURL = isTv
      ? `https://vidsrc.cc/v2/embed/tv/${currentItem.id}/${currentSeason}/${currentEpisode}`
      : `https://vidsrc.cc/v2/embed/movie/${currentItem.id}`;
  } else if (server === 'vidsrc.me') {
    embedURL = isTv
      ? `https://vidsrc.net/embed/tv/?tmdb=${currentItem.id}&season=${currentSeason}&episode=${currentEpisode}`
      : `https://vidsrc.net/embed/movie/?tmdb=${currentItem.id}`;
  } else if (server === 'player.videasy.net') {
    embedURL = isTv
      ? `https://player.videasy.net/tv/${currentItem.id}/${currentSeason}/${currentEpisode}`
      : `https://player.videasy.net/movie/${currentItem.id}`;
  }

  iframe.src = '';
  iframe.src = embedURL;
  iframe.style.display = 'block';
  iframe.onload = () => {
    try {
      iframe.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
      playOverlay.style.display = 'none';
    } catch (e) {
      console.error('Error sending play message:', e);
      showError('Failed to start playback. Try another server.', isTv ? 'episode-list' : 'modal-content-movie');
    }
  };
  iframe.onerror = () => {
    showError('Failed to load video. Try another server.', isTv ? 'episode-list' : 'modal-content-movie');
    playOverlay.style.display = 'block';
  };
}

function triggerIframePlay(iframeId) {
  const iframe = document.getElementById(iframeId);
  const playOverlay = iframe.parentElement.querySelector('.iframe-play-overlay');
  try {
    iframe.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
    playOverlay.style.display = 'none';
  } catch (e) {
    console.error(`Error playing ${iframeId}:`, e);
    showError('Failed to start playback. Try another server.', iframeId === 'tv-episode-player' ? 'episode-list' : 'modal-content-movie');
  }
}

function shareContent() {
  if (!currentItem) return;
  const isTv = currentItem.media_type === 'tv' || !!currentItem.name && !currentItem.title;
  const title = encodeURIComponent(isTv ? currentItem.name : currentItem.title);
  const url = `https://www.themoviedb.org/${isTv ? 'tv' : 'movie'}/${currentItem.id}`;
  const text = `Check out ${title} on ReelRoom!`;
  if (navigator.share) {
    navigator.share({ title, text, url })
      .catch(err => console.error('Share error:', err));
  } else {
    navigator.clipboard.writeText(`${text} ${url}`)
      .then(() => alert('Link copied to clipboard!'))
      .catch(err => console.error('Clipboard error:', err));
  }
}

function closeModal() {
  document.getElementById('modal').style.display = 'none';
  document.getElementById('modal-video').src = '';
  document.getElementById('tv-episode-player').src = '';
  document.getElementById('episode-list').innerHTML = '';
  document.getElementById('season-selector').style.display = 'none';
  document.querySelectorAll('.iframe-play-overlay').forEach(overlay => overlay.style.display = 'block');
}

function openSearchModal() {
  document.getElementById('search-input').focus();
}

function closeSearchModal() {
  document.getElementById('search-input').value = '';
  document.getElementById('movie-list').innerHTML = '';
  switchMode('movies');
}

async function searchTMDB() {
  const query = document.getElementById('search-input').value;
  if (!query.trim()) {
    document.getElementById('movie-list').innerHTML = '<p class="empty-state">Please enter a search query.</p>';
    return;
  }

  try {
    const res = await fetch(`${BASE_URL}/search/multi?api_key=${API_KEY}&query=${query}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    currentMode = 'search';
    document.getElementById('section-title').textContent = `Search Results for "${query}"`;
    setActiveNav();
    displayList(data.results, 'movie-list');
  } catch (error) {
    console.error('Error searching:', error);
    showError('Search failed. Try again.', 'movie-list');
  }
}

function setActiveNav() {
  document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
  const navIds = {
    movies: 'nav-movies',
    tvshows: 'nav-tvshows',
    anime: 'nav-anime',
    'tagalog-movies': 'nav-tagalog',
    netflix: 'nav-netflix'
  };
  if (navIds[currentMode]) {
    document.getElementById(navIds[currentMode]).classList.add('active');
  }
}

function switchMode(mode) {
  if (currentMode === mode) return;
  currentMode = mode;
  currentGenre = '';
  currentYear = '';
  document.getElementById('genre-filter').value = '';
  document.getElementById('year-filter').value = '';
  document.getElementById('movie-list').innerHTML = '';
  setActiveNav();
  const titles = {
    movies: 'Trending Movies',
    tvshows: 'Trending TV Shows',
    anime: 'Trending Anime',
    'tagalog-movies': 'Trending Tagalog Movies',
    netflix: 'Trending Netflix'
  };
  document.getElementById('section-title').textContent = titles[mode] || 'Trending Movies';
  populateGenreFilter();
  init();
}

async function init() {
  console.log('Initializing site...');
  document.getElementById('empty-message').style.display = 'none';
  fetchGenres();
  populateYearFilter();

  document.getElementById('nav-movies').onclick = (e) => { e.preventDefault(); switchMode('movies'); };
  document.getElementById('nav-tvshows').onclick = (e) => { e.preventDefault(); switchMode('tvshows'); };
  document.getElementById('nav-anime').onclick = (e) => { e.preventDefault(); switchMode('anime'); };
  document.getElementById('nav-tagalog').onclick = (e) => { e.preventDefault(); switchMode('tagalog-movies'); };
  document.getElementById('nav-netflix').onclick = (e) => { e.preventDefault(); switchMode('netflix'); };

  document.getElementById('genre-filter').onchange = () => {
    currentGenre = document.getElementById('genre-filter').value;
    init();
  };
  document.getElementById('year-filter').onchange = () => {
    currentYear = document.getElementById('year-filter').value;
    init();
  };
  document.getElementById('clear-genre-btn').onclick = () => {
    currentGenre = '';
    currentYear = '';
    document.getElementById('genre-filter').value = '';
    document.getElementById('year-filter').value = '';
    init();
  };

  document.getElementById('modal').onclick = (e) => {
    if (e.target === document.getElementById('modal')) closeModal();
  };

  window.addEventListener('scroll', () => {
    const backToTop = document.getElementById('back-to-top');
    if (window.scrollY > 400) {
      backToTop.classList.add('visible');
    } else {
      backToTop.classList.remove('visible');
    }
  });

  document.getElementById('back-to-top').addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  try {
    showLoading('movie-list');
    showLoading('tvshows-list');
    showLoading('anime-list');
    showLoading('tagalog-movies-list');
    showLoading('netflix-list');

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

    displayList(currentMode === 'movies' || currentMode === 'search' ? movies : [], 'movie-list');
    addLoadMoreIfApplicable('movie-list', 'movies');

    displayList(currentMode === 'tvshows' ? tvShows : [], 'tvshows-list');
    addLoadMoreIfApplicable('tvshows-list', 'tvshows');

    displayList(currentMode === 'anime' ? anime : [], 'anime-list');
    addLoadMoreIfApplicable('anime-list', 'anime');

    displayList(currentMode === 'tagalog-movies' ? tagalogMovies : [], 'tagalog-movies-list');
    addLoadMoreIfApplicable('tagalog-movies-list', 'tagalog-movies');

    displayList(currentMode === 'netflix' ? netflixContent : [], 'netflix-list');
    addLoadMoreIfApplicable('netflix-list', 'netflix');

    renderRecentlyViewed();

    console.log('Initialization complete.');
  } catch (error) {
    console.error('Error initializing:', error);
    showError('Failed to load content. Please refresh or check your connection.', 'empty-message');
  }
}

init();