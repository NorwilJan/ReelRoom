// script.js

// --- CONFIG ---
const apiKey = '40f1982842db35042e8561b13b38d492';
const imageBaseUrl = 'https://image.tmdb.org/t/p/w500';
const maxPages = 100;
const maxItems = 500;
let lastModalMovie = null;
let currentPage = 1;
let totalPages = 1;
let currentMode = "popular";
let currentQuery = "";
let currentGenre = "";
let currentYear = "";
let favorites = JSON.parse(localStorage.getItem('favorites') || "[]");
let netflixType = "movie";
let tvModalData = { tvId: null, season: null, episode: null, seasons: [] };
let categoryItems = [];
let isLoading = false;
let reachedEnd = false;
let loadedPages = new Set();
let movieGenres = [];
let tvGenres = [];
const animeGenres = [
  { id: 16, name: "Anime" },
  { id: 10765, name: "Sci-Fi & Fantasy" },
  { id: 28, name: "Action" },
  { id: 12, name: "Adventure" },
  { id: 35, name: "Comedy" },
  { id: 18, name: "Drama" },
  { id: 10749, name: "Romance" },
  { id: 14, name: "Fantasy" }
];
const movieList = document.getElementById('movie-list');
const infiniteLoader = document.getElementById('infinite-loader');
const genreFilter = document.getElementById('genre-filter');

// Throttle function
function throttle(func, limit) {
  let inThrottle;
  return function (...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// Debounce function
function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// Check if device is mobile or tablet
function isMobileOrTablet() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
         window.matchMedia("(max-width: 991.98px)").matches;
}

// Handle orientation lock for fullscreen
function handleFullscreenOrientation(iframe) {
  if (!isMobileOrTablet()) return;
  const lockOrientation = () => {
    if (document.fullscreenElement === iframe && screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('landscape').catch(err => {
        console.warn('Orientation lock failed:', err);
        showErrorMessage(iframe, 'Please rotate your device to landscape for the best fullscreen experience.');
      });
    }
  };
  const unlockOrientation = () => {
    if (screen.orientation && screen.orientation.unlock) {
      screen.orientation.unlock().catch(err => console.warn('Orientation unlock failed:', err));
    }
  };
  iframe.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement === iframe) {
      lockOrientation();
    } else {
      unlockOrientation();
    }
  });
}

// Helper for error messages
function showErrorMessage(iframe, message) {
  const modalBody = iframe.closest('.modal-content').querySelector('.modal-body');
  const existingError = modalBody.querySelector('.error-state');
  if (existingError) existingError.remove();
  const errorMsg = document.createElement('p');
  errorMsg.className = 'error-state';
  errorMsg.textContent = message;
  errorMsg.style.marginTop = '1rem';
  modalBody.appendChild(errorMsg);
  setTimeout(() => errorMsg.remove(), 5000);
}

// Fetch genres
async function fetchGenres() {
  try {
    const [movieRes, tvRes] = await Promise.all([
      fetch(`https://api.themoviedb.org/3/genre/movie/list?api_key=${apiKey}`),
      fetch(`https://api.themoviedb.org/3/genre/tv/list?api_key=${apiKey}`)
    ]);
    if (!movieRes.ok || !tvRes.ok) throw new Error('Failed to fetch genres');
    const movieData = await movieRes.json();
    const tvData = await tvRes.json();
    movieGenres = movieData.genres || [];
    tvGenres = tvData.genres || [];
    populateGenreFilter();
    genreFilter.disabled = false;
  } catch (e) {
    console.error('Error fetching genres:', e);
    genreFilter.innerHTML = '<option value="" id="genre-all">Failed to load genres</option>';
    genreFilter.disabled = false;
  }
}

// Populate genre filter dropdown
function populateGenreFilter() {
  genreFilter.innerHTML = '<option value="" id="genre-all">All Genres</option>';
  let genres = [];
  if (currentMode === "tv") {
    genres = tvGenres;
  } else if (currentMode === "anime") {
    genres = animeGenres;
  } else if (currentMode === "netflix") {
    genres = netflixType === "movie" ? movieGenres : tvGenres;
  } else if (currentMode === "favorites") {
    genres = [...new Set([...movieGenres, ...tvGenres])].sort((a, b) => a.name.localeCompare(b.name));
  } else {
    genres = movieGenres;
  }
  genres.forEach((genre, index) => {
    const option = document.createElement('option');
    option.value = genre.id;
    option.id = `genre-${index}`;
    option.textContent = genre.name;
    genreFilter.appendChild(option);
  });
  genreFilter.value = currentGenre || "";
  genreFilter.setAttribute('aria-activedescendant', genreFilter.options[genreFilter.selectedIndex].id || '');
}

// Populate year filter dropdown
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
  yearFilter.value = currentYear || "";
  yearFilter.setAttribute('aria-activedescendant', yearFilter.options[yearFilter.selectedIndex].id || '');
}

// FAVORITES/RECENTLY VIEWED
function isFavorite(id, media_type) {
  return favorites.some(f => f.id === id && f.media_type === media_type);
}
function toggleFavorite(id, media_type) {
  if (isFavorite(id, media_type)) {
    favorites = favorites.filter(f => f.id !== id || f.media_type !== media_type);
  } else {
    favorites.push({ id, media_type });
  }
  localStorage.setItem('favorites', JSON.stringify(favorites));
  if (currentMode === "favorites") renderFavorites();
  document.querySelectorAll('.favorite-btn').forEach(btn => {
    if (btn.closest('.movie-col') && btn.closest('.movie-col').innerHTML.includes(`${media_type}/${id}`)) {
      if (isFavorite(id, media_type)) btn.classList.add('favorited');
      else btn.classList.remove('favorited');
    }
  });
  const tvFavoriteBtn = document.getElementById('tv-favorite-btn');
  if (tvFavoriteBtn && tvModalData.tvId === id && media_type === 'tv') {
    if (isFavorite(id, 'tv')) tvFavoriteBtn.classList.add('favorited');
    else tvFavoriteBtn.classList.remove('favorited');
  }
}
function renderFavorites() {
  console.log('[renderFavorites] Rendering favorites');
  if (!favorites.length) {
    movieList.innerHTML = `<div class="empty-state">You have no favorite movies or TV shows yet ❤️.</div>`;
    return;
  }
  Promise.all(favorites.map(item =>
    fetch(`https://api.themoviedb.org/3/${item.media_type}/${item.id}?api_key=${apiKey}`)
      .then(r => r.json())
      .then(data => ({ ...data, media_type: item.media_type }))
  )).then(arr => {
    categoryItems = arr.filter(m => m && m.id).slice(0, maxItems);
    let filteredItems = categoryItems;
    if (currentGenre) {
      filteredItems = filteredItems.filter(item =>
        item.genre_ids?.includes(parseInt(currentGenre)) ||
        item.genres?.some(g => g.id === parseInt(currentGenre))
      );
    }
    if (currentYear) {
      filteredItems = filteredItems.filter(item => {
        const year = item.media_type === 'tv' ? (item.first_air_date || '').slice(0, 4) : (item.release_date || '').slice(0, 4);
        return year === currentYear;
      });
    }
    renderMovies(filteredItems, true);
  }).catch(err => {
    console.error('[renderFavorites] Error:', err);
    movieList.innerHTML = `<div class="error-state">Failed to load favorites. Please try again.</div>`;
  });
}
let recentlyViewed = JSON.parse(localStorage.getItem("recently_viewed") || "[]");
function addRecentlyViewed(item) {
  const isTv = !!item.name && !item.title || item.media_type === 'tv';
  recentlyViewed = recentlyViewed.filter(m => m.id !== item.id || m.media_type !== (isTv ? 'tv' : 'movie'));
  recentlyViewed.unshift({
    id: item.id,
    title: item.title || item.name,
    poster_path: item.poster_path,
    release_date: item.release_date || item.first_air_date,
    media_type: isTv ? 'tv' : 'movie'
  });
  if (recentlyViewed.length > 12) recentlyViewed = recentlyViewed.slice(0, 12);
  localStorage.setItem("recently_viewed", JSON.stringify(recentlyViewed));
  renderRecentlyViewed();
}
function renderRecentlyViewed() {
  const section = document.getElementById("recently-viewed-section");
  const list = document.getElementById("recently-viewed-list");
  if (!recentlyViewed.length) {
    section.style.display = "none";
    return;
  }
  section.style.display = "";
  list.innerHTML = "";
  recentlyViewed.forEach(item => {
    const div = document.createElement("div");
    div.className = "movie-col";
    div.innerHTML = `
      <div class="movie-poster-wrapper" tabindex="0">
        <img loading="lazy" src="${item.poster_path ? imageBaseUrl + item.poster_path : 'img/no-poster.png'}" alt="${item.title}" class="img-fluid movie-poster-img">
      </div>
      <div class="movie-metadata">
        <span class="movie-title" title="${item.title}">${item.title}</span>
        <span class="movie-year">${item.release_date ? item.release_date.slice(0, 4) : ""}</span>
      </div>
    `;
    div.onclick = () => {
      fetch(`https://api.themoviedb.org/3/${item.media_type}/${item.id}?api_key=${apiKey}`)
        .then(r => r.json()).then(data => {
          if (item.media_type === 'tv') showTvDetails(data);
          else showDetails(data);
        });
    };
    list.appendChild(div);
  });
}

// Fetch & Render
async function fetchMoviesInf(page = 1) {
  console.log(`[fetchMoviesInf] Fetching page ${page} for mode: ${currentMode}, genre: ${currentGenre}, year: ${currentYear}, query: ${currentQuery}`);
  if (loadedPages.has(page) || page > maxPages) {
    console.log(`[fetchMoviesInf] Page ${page} already loaded or exceeds maxPages`);
    return [];
  }
  let url = "";
  if (currentMode === "favorites") {
    console.log('[fetchMoviesInf] Favorites mode, skipping fetch');
    return [];
  }
  const isTablet = window.matchMedia("(min-width: 768px) and (max-width: 1199.98px)").matches;
  const perPage = isTablet ? 40 : 20; // Fetch more items on tablets
  if (currentMode === "search" && currentQuery.trim()) {
    url = `https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&query=${encodeURIComponent(currentQuery)}&page=${page}&include_adult=false`;
  } else if (currentMode === "anime") {
    url = `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&with_genres=${currentGenre || 16}&with_original_language=ja${currentYear ? `&primary_release_year=${currentYear}` : ''}&sort_by=popularity.desc&page=${page}`;
  } else if (currentMode === "tagalog") {
    url = `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&with_original_language=tl${currentGenre ? `&with_genres=${currentGenre}` : ''}${currentYear ? `&primary_release_year=${currentYear}` : ''}&sort_by=popularity.desc&page=${page}`;
  } else if (currentMode === "tv") {
    url = `https://api.themoviedb.org/3/discover/tv?api_key=${apiKey}${currentGenre ? `&with_genres=${currentGenre}` : ''}${currentYear ? `&first_air_date_year=${currentYear}` : ''}&sort_by=popularity.desc&page=${page}`;
  } else if (currentMode === "netflix") {
    if (netflixType === "movie") {
      url = `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&with_watch_providers=8&watch_region=US${currentGenre ? `&with_genres=${currentGenre}` : ''}${currentYear ? `&primary_release_year=${currentYear}` : ''}&sort_by=popularity.desc&page=${page}`;
    } else {
      url = `https://api.themoviedb.org/3/discover/tv?api_key=${apiKey}&with_watch_providers=8&watch_region=US${currentGenre ? `&with_genres=${currentGenre}` : ''}${currentYear ? `&first_air_date_year=${currentYear}` : ''}&sort_by=popularity.desc&page=${page}`;
    }
  } else {
    url = `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}${currentGenre ? `&with_genres=${currentGenre}` : ''}${currentYear ? `&primary_release_year=${currentYear}` : ''}&sort_by=popularity.desc&page=${page}`;
  }
  try {
    genreFilter.disabled = true;
    document.getElementById('year-filter').disabled = true;
    if (!url) {
      console.log('[fetchMoviesInf] No URL constructed, likely empty search query');
      movieList.innerHTML = `<div class="empty-state">Please enter a search query.</div>`;
      return [];
    }
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    if (!data.results || data.results.length === 0) {
      console.log(`[fetchMoviesInf] No results for page ${page}`);
      movieList.innerHTML = `<div class="empty-state">No items found for "${currentQuery || 'this category'}"${currentGenre ? ` in genre ${currentGenre}` : ''}${currentYear ? ` from ${currentYear}` : ''}.</div>`;
      return [];
    }
    totalPages = Math.min(data.total_pages || 1, maxPages);
    loadedPages.add(page);
    console.log(`[fetchMoviesInf] Fetched ${data.results.length} items for page ${page}`);
    return data.results.slice(0, perPage); // Limit to perPage items
  } catch (e) {
    console.error('[fetchMoviesInf] Error:', e);
    movieList.innerHTML = `<div class="error-state">Failed to load content. Please check your connection or try again later.</div>`;
    infiniteLoader.style.display = "none";
    return [];
  } finally {
    genreFilter.disabled = false;
    document.getElementById('year-filter').disabled = false;
  }
}
function renderMovies(items, clear = false) {
  console.log(`[renderMovies] Rendering ${items.length} items, clear=${clear}`, items);
  if (clear) movieList.innerHTML = '';
  if (!items || items.length === 0) {
    if (clear) movieList.innerHTML = `<div class="empty-state">No items found for "${currentQuery || 'this category'}"${currentGenre ? ` in genre ${currentGenre}` : ''}${currentYear ? ` from ${currentYear}` : ''}.</div>`;
    return;
  }
  const fragment = document.createDocumentFragment();
  items.forEach(item => {
    const isTv = item.media_type === 'tv' || !!item.name && !item.title;
    const mediaType = isTv ? 'tv' : 'movie';
    const movieDiv = document.createElement('div');
    movieDiv.className = 'movie-col';
    movieDiv.innerHTML = `
      <div class="movie-poster-wrapper" tabindex="0">
        <img loading="lazy" src="${item.poster_path ? imageBaseUrl + item.poster_path : 'img/no-poster.png'}" alt="${isTv ? item.name : item.title}" class="img-fluid movie-poster-img">
        <button class="play-btn-centered" type="button" title="${isTv ? "View TV Show" : "Play Movie"}">
          <i class="fas fa-${isTv ? "tv" : "play"}"></i>
        </button>
        <button class="favorite-btn${isFavorite(item.id, mediaType) ? ' favorited' : ''}" title="Add to favorites" aria-label="Add to favorites" tabindex="0">
          <i class="fas fa-heart"></i>
        </button>
      </div>
      <div class="movie-metadata">
        <span class="movie-title" title="${isTv ? item.name : item.title}">${isTv ? item.name : item.title}</span>
        <span class="movie-year">${(isTv ? item.first_air_date : item.release_date) ? (isTv ? item.first_air_date : item.release_date).slice(0, 4) : ""}</span>
        ${isTv ? '<span class="movie-type" style="font-size: 0.9em; color: #1976d2;">TV Show</span>' : ''}
      </div>
    `;
    movieDiv.querySelector('.play-btn-centered').onclick = () => { isTv ? showTvDetails(item) : showDetails(item); };
    movieDiv.querySelector('.favorite-btn').onclick = (e) => {
      e.stopPropagation();
      toggleFavorite(item.id, mediaType);
    };
    fragment.appendChild(movieDiv);
  });
  movieList.appendChild(fragment);
}

// Infinite scroll
async function loadMoreMovies(clear = false) {
  if (isLoading || reachedEnd || currentPage > maxPages) {
    console.log(`[loadMoreMovies] Skipped: isLoading=${isLoading}, reachedEnd=${reachedEnd}, currentPage=${currentPage}, maxPages=${maxPages}`);
    return;
  }
  isLoading = true;
  console.log(`[loadMoreMovies] Loading page ${currentPage}, clear=${clear}`);
  if (clear) {
    movieList.innerHTML = '<div class="loading-state">Loading...</div>';
    categoryItems = [];
  }
  infiniteLoader.style.display = "block";
  const items = await fetchMoviesInf(currentPage);
  if (items.length > 0) {
    if (clear) categoryItems = items;
    else categoryItems = [...categoryItems, ...items].slice(0, maxItems);
    renderMovies(items, clear);
    currentPage++;
    if (currentPage > totalPages) reachedEnd = true;
    console.log(`[loadMoreMovies] Rendered ${items.length} items, currentPage=${currentPage}, totalPages=${totalPages}`);
  } else {
    reachedEnd = true;
    if (clear && !categoryItems.length) {
      setTimeout(() => {
        if (!movieList.innerHTML.includes('movie-col')) {
          movieList.innerHTML = `<div class="empty-state">No items found for "${currentQuery || 'this category'}"${currentGenre ? ` in genre ${currentGenre}` : ''}${currentYear ? ` from ${currentYear}` : ''}.</div>`;
        }
      }, 500);
    }
  }
  isLoading = false;
  infiniteLoader.style.display = "none";
}

// Reset infinite scroll
function resetInfiniteScroll() {
  console.log('[resetInfiniteScroll] Resetting infinite scroll');
  currentPage = 1;
  totalPages = 1;
  loadedPages.clear();
  reachedEnd = false;
  categoryItems = [];
  isLoading = false;
  movieList.innerHTML = '<div class="loading-state">Loading...</div>';
  infiniteLoader.style.display = 'block';
  loadMoreMovies(true);
}

// MODAL - MOVIE
async function showDetails(movie) {
  document.getElementById('modal-content-movie').style.display = '';
  document.getElementById('modal-content-tv').style.display = 'none';
  document.getElementById('modal').style.display = 'flex';
  document.getElementById('bmc-hover-btn').classList.remove('visible');
  lastModalMovie = movie;
  addRecentlyViewed(movie);
  document.getElementById('modal-title').textContent = movie.title;
  document.getElementById('modal-description').textContent = movie.overview || '';
  document.getElementById('modal-image').src = movie.poster_path ? imageBaseUrl + movie.poster_path : 'img/no-poster.png';
  document.getElementById('modal-rating').innerHTML = getStars(movie.vote_average || 0) + ` (${movie.vote_average || 'N/A'})`;
  document.getElementById('modal-genres').innerHTML = (movie.genre_ids || movie.genres || []).map(gid => {
    let g = typeof gid === "object" ? gid : (movieGenres.find(x => x.id === gid) || { name: "" });
    return g.name ? `<span class="chip">${g.name}</span>` : '';
  }).join(' ');
  document.getElementById('modal-cast').textContent = "Loading cast...";
  document.getElementById('modal-crew').textContent = "";
  document.getElementById('modal-trailer').innerHTML = "";
  fetch(`https://api.themoviedb.org/3/movie/${movie.id}/credits?api_key=${apiKey}`)
    .then(r => r.json()).then(data => {
      let cast = (data.cast || []).slice(0, 5).map(c => c.name).join(', ');
      let director = (data.crew || []).find(c => c.job === "Director");
      document.getElementById('modal-cast').innerHTML = cast ? `<strong>Cast:</strong> ${cast}` : '';
      document.getElementById('modal-crew').innerHTML = director ? `<strong>Director:</strong> ${director.name}` : '';
    });
  fetch(`https://api.themoviedb.org/3/movie/${movie.id}/videos?api_key=${apiKey}`)
    .then(r => r.json()).then(data => {
      let yt = (data.results || []).find(v => v.site === "YouTube" && v.type === "Trailer");
      if (yt)
        document.getElementById('modal-trailer').innerHTML = `<a href="https://youtube.com/watch?v=${yt.key}" target="_blank" rel="noopener">▶ Watch Official Trailer</a>`;
    });
  document.getElementById('server').value = "player.videasy.net";
  changeServer();
  fetch(`https://api.themoviedb.org/3/movie/${movie.id}/similar?api_key=${apiKey}`)
    .then(r => r.json()).then(data => {
      if (data && data.results && data.results.length) {
        let html = `<div style="margin-top: 1.3em;"><b>Similar Movies:</b><div style="display: flex; gap: 1em; overflow-x: auto; padding-top: 0.7em;">`;
        data.results.slice(0, 8).forEach(m => {
          html += `<div style="width: 110px; text-align: center;">
            <img loading="lazy" src="${m.poster_path ? imageBaseUrl + m.poster_path : 'img/no-poster.png'}" alt="${m.title}" style="width: 100px; border-radius: 7px; cursor: pointer;" onclick="showDetailsFromId(${m.id})">
            <div style="font-size: 0.93em; margin-top: 0.3em;">${m.title}</div>
          </div>`;
        });
        html += `</div></div>`;
        document.getElementById('similar-movies').innerHTML = html;
      }
    });
}
window.showDetailsFromId = function(id) {
  fetch(`https://api.themoviedb.org/3/movie/${id}?api_key=${apiKey}`)
    .then(r => r.json()).then(showDetails);
}
function getStars(vote) {
  let stars = Math.round((vote || 0) / 2);
  return '★'.repeat(stars) + '☆'.repeat(5 - stars);
}
function changeServer() {
  if (!lastModalMovie) return;
  const serverSelect = document.getElementById('server');
  const iframe = document.getElementById('modal-video');
  const playOverlay = iframe.parentElement.querySelector('.iframe-play-overlay');
  const currentServer = serverSelect.value;
  const movieId = lastModalMovie.id;
  let embedURL = '';

  if (currentServer === 'player.videasy.net') {
    embedURL = `https://player.videasy.net/movie/${movieId}`;
  } else if (currentServer === 'vidsrc.cc') {
    embedURL = `https://vidsrc.cc/v2/embed/movie/${movieId}`;
  } else if (currentServer === 'vidsrc.me') {
    embedURL = `https://vidsrc.net/embed/movie/?tmdb=${movieId}`;
  }

  iframe.src = '';
  iframe.src = embedURL;
  iframe.onload = function() {
    try {
      iframe.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
    } catch (e) {
      console.error('[changeServer] Error sending play message:', e);
      showErrorMessage(iframe, 'Failed to start playback. Try another server or check your connection.');
    }
    playOverlay.style.display = 'none';
  };
  iframe.onerror = () => {
    showErrorMessage(iframe, 'Failed to load video. Try another server or check your connection.');
    playOverlay.style.display = 'block';
  };
}

// Trigger iframe play
function triggerIframePlay(iframeId) {
  const iframe = document.getElementById(iframeId);
  const playOverlay = iframe.parentElement.querySelector('.iframe-play-overlay');
  try {
    iframe.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
    playOverlay.style.display = 'none';
  } catch (e) {
    console.error(`[triggerIframePlay] Error for ${iframeId}:`, e);
    showErrorMessage(iframe, 'Failed to start playback. Try another server.');
  }
}

// Share movie
function shareMovie() {
  if (!lastModalMovie) return;
  const title = encodeURIComponent(lastModalMovie.title);
  const url = `https://www.themoviedb.org/movie/${lastModalMovie.id}`;
  const text = `Check out ${lastModalMovie.title} on MovieDck!`;
  if (navigator.share && isMobileOrTablet()) {
    navigator.share({ title: lastModalMovie.title, text, url })
      .catch(err => console.error('[shareMovie] Error:', err));
  } else {
    navigator.clipboard.writeText(`${text} ${url}`)
      .then(() => alert('Link copied to clipboard!'))
      .catch(err => console.error('[shareMovie] Clipboard error:', err));
  }
}

// MODAL - TV SHOW
async function showTvDetails(show) {
  document.getElementById('modal-content-movie').style.display = 'none';
  document.getElementById('modal-content-tv').style.display = '';
  document.getElementById('modal').style.display = 'flex';
  document.getElementById('bmc-hover-btn').classList.remove('visible');
  tvModalData.tvId = show.id;
  tvModalData.season = null;
  tvModalData.episode = null;
  tvModalData.seasons = [];
  addRecentlyViewed(show);
  document.getElementById('tv-modal-title').textContent = show.name || 'N/A';
  document.getElementById('tv-modal-description').textContent = show.overview || '';
  document.getElementById('tv-modal-image').src = show.poster_path ? imageBaseUrl + show.poster_path : 'img/no-poster.png';
  document.getElementById('tv-modal-genres').innerHTML = (show.genre_ids || show.genres || []).map(gid => {
    let g = typeof gid === "object" ? gid : (tvGenres.find(x => x.id === gid) || { name: "" });
    return g.name ? `<span class="chip">${g.name}</span>` : '';
  }).join(' ');
  document.getElementById('tv-modal-air-date').textContent = show.first_air_date || 'N/A';
  document.getElementById('tv-modal-total-seasons').textContent = show.number_of_seasons || 'N/A';
  const favoriteBtn = document.getElementById('tv-favorite-btn');
  favoriteBtn.classList.toggle('favorited', isFavorite(show.id, 'tv'));
  favoriteBtn.onclick = () => toggleFavorite(show.id, 'tv');
  document.getElementById('tv-episode-player').style.display = 'none';
  document.getElementById('tv-episode-next-btn').style.display = 'none';
  document.getElementById('tv-modal-seasons-list').innerHTML = '<p>Loading seasons...</p>';
  try {
    const res = await fetch(`https://api.themoviedb.org/3/tv/${show.id}?api_key=${apiKey}&append_to_response=credits,videos`);
    const data = await res.json();
    tvModalData.seasons = data.seasons || [];
    let html = '';
    for (let season of tvModalData.seasons.filter(s => s.season_number >= 0)) {
      const seasonRes = await fetch(`https://api.themoviedb.org/3/tv/${show.id}/season/${season.season_number}?api_key=${apiKey}`);
      const seasonData = await seasonRes.json();
      html += `<div class="season-block">
        <div class="season-header" onclick="toggleSeason(${season.season_number})">Season ${season.season_number} (${seasonData.episodes?.length || 0} Episodes)</div>
        <div class="episodes-list" id="season-${season.season_number}" style="display: none;">`;
      (seasonData.episodes || []).forEach(ep => {
        html += `<div class="episode-block">
          <span>Episode ${ep.episode_number}: ${ep.name}</span>
          <button class="tv-episode-play-btn" onclick="playEpisode(${show.id}, ${season.season_number}, ${ep.episode_number})">Play</button>
        </div>`;
      });
      html += `</div></div>`;
    }
    document.getElementById('tv-modal-seasons-list').innerHTML = html;
  } catch (e) {
    console.error('[showTvDetails] Error:', e);
    document.getElementById('tv-modal-seasons-list').innerHTML = '<p class="error-state">Failed to load seasons.</p>';
  }
}

// Toggle season visibility
window.toggleSeason = function(seasonNumber) {
  const seasonDiv = document.getElementById(`season-${seasonNumber}`);
  seasonDiv.style.display = seasonDiv.style.display === 'none' ? 'block' : 'none';
}

// Play TV episode
window.playEpisode = async function(showId, season, episode) {
  tvModalData.season = season;
  tvModalData.episode = episode;
  document.getElementById('bmc-hover-btn').classList.remove('visible');
  const iframe = document.getElementById('tv-episode-player');
  const playOverlay = iframe.parentElement.querySelector('.iframe-play-overlay');
  const server = document.getElementById('server').value;
  let embedURL = '';
  if (server === 'player.videasy.net') {
    embedURL = `https://player.videasy.net/tv/${showId}/${season}/${episode}`;
  } else if (server === 'vidsrc.cc') {
    embedURL = `https://vidsrc.cc/v2/embed/tv/${showId}/${season}/${episode}`;
  } else if (server === 'vidsrc.me') {
    embedURL = `https://vidsrc.net/embed/tv/?tmdb=${showId}&season=${season}&episode=${episode}`;
  }
  iframe.src = '';
  iframe.src = embedURL;
  iframe.style.display = 'block';
  iframe.onload = () => {
    try {
      iframe.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
      playOverlay.style.display = 'none';
    } catch (e) {
      console.error('[playEpisode] Error:', e);
      showErrorMessage(iframe, 'Failed to start playback. Try another server.');
    }
  };
  iframe.onerror = () => {
    showErrorMessage(iframe, 'Failed to load episode. Try another server.');
    playOverlay.style.display = 'block';
  };
  document.getElementById('tv-episode-next-btn').style.display = 'block';
  updateNextEpisodeButton(showId, season, episode);
}

// Update next episode button
async function updateNextEpisodeButton(showId, season, episode) {
  const btn = document.getElementById('tv-episode-next-btn');
  try {
    const res = await fetch(`https://api.themoviedb.org/3/tv/${showId}/season/${season}?api_key=${apiKey}`);
    const data = await res.json();
    const episodes = data.episodes || [];
    const nextEpisode = episodes.find(ep => ep.episode_number === episode + 1);
    if (nextEpisode) {
      btn.textContent = `Next Episode: ${nextEpisode.name}`;
      btn.onclick = () => playEpisode(showId, season, episode + 1);
    } else if (tvModalData.seasons.some(s => s.season_number === season + 1)) {
      btn.textContent = `Next Season`;
      btn.onclick = () => playEpisode(showId, season + 1, 1);
    } else {
      btn.style.display = 'none';
    }
  } catch (e) {
    console.error('[updateNextEpisodeButton] Error:', e);
    btn.style.display = 'none';
  }
}

// Share TV show
function shareTvShow() {
  if (!tvModalData.tvId) return;
  const title = encodeURIComponent(document.getElementById('tv-modal-title').textContent);
  const url = `https://www.themoviedb.org/tv/${tvModalData.tvId}`;
  const text = `Check out ${title} on MovieDck!`;
  if (navigator.share && isMobileOrTablet()) {
    navigator.share({ title, text, url })
      .catch(err => console.error('[shareTvShow] Error:', err));
  } else {
    navigator.clipboard.writeText(`${text} ${url}`)
      .then(() => alert('Link copied to clipboard!'))
      .catch(err => console.error('[shareTvShow] Clipboard error:', err));
  }
}

// Close modal
function closeModal() {
  document.getElementById('modal').style.display = 'none';
  const iframes = [document.getElementById('modal-video'), document.getElementById('tv-episode-player')];
  iframes.forEach(iframe => {
    iframe.src = '';
    iframe.parentElement.querySelector('.iframe-play-overlay').style.display = 'block';
  });
  lastModalMovie = null;
  tvModalData = { tvId: null, season: null, episode: null, seasons: [] };
  if (window.scrollY > 400) {
    document.getElementById('bmc-hover-btn').classList.add('visible');
  }
}

// Set active nav
function setActiveNav(mode) {
  document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
  const navIds = {
    popular: 'nav-movies',
    tv: 'nav-tvshows',
    anime: 'nav-anime',
    tagalog: 'nav-tagalog',
    netflix: 'nav-netflix',
    favorites: 'nav-favorites'
  };
  if (navIds[mode]) {
    document.getElementById(navIds[mode]).classList.add('active');
  }
}

// Switch modes
function switchMode(newMode) {
  if (currentMode === newMode && !(newMode === 'search' && currentQuery)) {
    console.log(`[switchMode] Already in mode: ${newMode}, skipping.`);
    return;
  }
  console.log(`[switchMode] Switching to mode: ${newMode}`);
  currentMode = newMode;
  if (newMode !== 'search') {
    currentQuery = "";
  }
  currentGenre = "";
  currentYear = "";
  netflixType = newMode === "netflix" ? netflixType : "movie";
  document.getElementById('nav-favorites').classList.remove('favorited');
  const sectionTitle = document.getElementById('section-title');
  const genreFilterForm = document.getElementById('genre-filter-form');

  if (newMode === "anime") {
    sectionTitle.textContent = "Trending Anime Movies";
    genreFilterForm.style.display = 'flex';
  } else if (newMode === "tagalog") {
    sectionTitle.textContent = "Trending Tagalog Movies";
    genreFilterForm.style.display = 'flex';
  } else if (newMode === "favorites") {
    sectionTitle.textContent = "Your Favorite Movies & TV Shows";
    document.getElementById('nav-favorites').classList.add('favorited');
    genreFilterForm.style.display = 'flex';
    movieList.innerHTML = '';
    infiniteLoader.style.display = 'none';
    renderFavorites();
    return;
  } else if (newMode === "tv") {
    sectionTitle.textContent = "Trending TV Shows";
    genreFilterForm.style.display = 'flex';
  } else if (newMode === "netflix") {
    sectionTitle.textContent = `Trending Netflix ${netflixType === "movie" ? "Movies" : "TV Shows"}`;
    genreFilterForm.style.display = 'flex';
  } else if (newMode === "search") {
    sectionTitle.textContent = `Search Results for "${currentQuery}"`;
    genreFilterForm.style.display = 'flex';
  } else {
    sectionTitle.textContent = "Trending Movies";
    genreFilterForm.style.display = 'flex';
  }

  setActiveNav(newMode);
  genreFilter.value = "";
  document.getElementById('year-filter').value = "";
  populateGenreFilter();
  populateYearFilter();
  resetInfiniteScroll();
}

// DOMContentLoaded event listener
document.addEventListener("DOMContentLoaded", function () {
  const movieIframe = document.getElementById('modal-video');
  const tvIframe = document.getElementById('tv-episode-player');
  const bmcHoverBtn = document.getElementById('bmc-hover-btn');
  handleFullscreenOrientation(movieIframe);
  handleFullscreenOrientation(tvIframe);

  fetchGenres();
  populateYearFilter();

  const isTablet = window.matchMedia("(min-width: 768px) and (max-width: 1199.98px)").matches;
  movieList.style.minHeight = isTablet ? '150vh' : '100vh';

  window.addEventListener('scroll', () => {
    if (window.scrollY > 400) {
      document.getElementById('back-to-top').classList.add('visible');
      if (document.getElementById('modal').style.display !== 'flex') {
        bmcHoverBtn.classList.add('visible');
      }
    } else {
      document.getElementById('back-to-top').classList.remove('visible');
      bmcHoverBtn.classList.remove('visible');
    }
  });

  bmcHoverBtn.addEventListener('click', () => {
    window.open('https://www.buymeacoffee.com/MovieDckWFPH', '_blank', 'noopener');
    console.log('Buy Me a Coffee hover button clicked');
  });

  document.getElementById('back-to-top').addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  const switchModeDebounced = throttle(switchMode, 300);
  document.getElementById('nav-movies').onclick = function (e) {
    e.preventDefault();
    console.log('[nav-movies] Clicked');
    switchModeDebounced('popular');
  };
  document.getElementById('nav-tvshows').onclick = function (e) {
    e.preventDefault();
    console.log('[nav-tvshows] Clicked');
    switchModeDebounced('tv');
  };
  document.getElementById('nav-anime').onclick = function (e) {
    e.preventDefault();
    console.log('[nav-anime] Clicked');
    switchModeDebounced('anime');
  };
  document.getElementById('nav-tagalog').onclick = function (e) {
    e.preventDefault();
    console.log('[nav-tagalog] Clicked');
    switchModeDebounced('tagalog');
  };
  document.getElementById('nav-favorites').onclick = function (e) {
    e.preventDefault();
    console.log('[nav-favorites] Clicked');
    switchModeDebounced('favorites');
  };
  document.getElementById('nav-netflix').onclick = function (e) {
    e.preventDefault();
    console.log('[nav-netflix] Clicked');
    let nav = document.getElementById('nav-netflix').parentNode;
    if (!document.getElementById("netflix-switcher")) {
      let switcher = document.createElement("div");
      switcher.id = "netflix-switcher";
      switcher.style = "margin-top: 6px; margin-bottom: 2px;";
      switcher.innerHTML = `<button id="netflix-movie-btn" class="btn btn-danger btn-sm" style="margin-right: 7px;">Movies</button>
        <button id="netflix-tv-btn" class="btn btn-danger btn-sm">TV Shows</button>`;
      nav.appendChild(switcher);
      document.getElementById("netflix-movie-btn").onclick = function () {
        netflixType = "movie";
        switchModeDebounced('netflix');
      };
      document.getElementById("netflix-tv-btn").onclick = function () {
        netflixType = "tv";
        switchModeDebounced('netflix');
      };
    }
    switchModeDebounced('netflix');
  };

  // Search form handling with debounce
  document.getElementById('movie-search-form').onsubmit = debounce(function (e) {
    e.preventDefault();
    const query = document.getElementById('movie-search-input').value.trim();
    if (!query) {
      movieList.innerHTML = `<div class="empty-state">Please enter a search query.</div>`;
      return;
    }
    console.log('[movie-search-form] Search query:', query);
    currentQuery = query;
    currentGenre = "";
    currentYear = "";
    document.getElementById('genre-filter').value = "";
    document.getElementById('year-filter').value = "";
    switchModeDebounced('search');
  }, 300);

  // Handle browser's default clear button or manual clear
  document.getElementById('movie-search-input').oninput = function () {
    if (!this.value.trim()) {
      console.log('[movie-search-input] Input cleared, resetting to popular');
      currentQuery = '';
      switchModeDebounced('popular');
    }
  };

  // Genre and year filter handling
  document.getElementById('genre-filter').onchange = function () {
    currentGenre = this.value;
    console.log('[genre-filter] Changed to:', currentGenre);
    resetInfiniteScroll();
  };
  document.getElementById('year-filter').onchange = function () {
    currentYear = this.value;
    console.log('[year-filter] Changed to:', currentYear);
    resetInfiniteScroll();
  };
  document.getElementById('clear-genre-btn').onclick = function () {
    currentGenre = "";
    currentYear = "";
    document.getElementById('genre-filter').value = "";
    document.getElementById('year-filter').value = "";
    console.log('[clear-genre-btn] Cleared filters');
    resetInfiniteScroll();
  };

  // Infinite scroll event listener
  window.addEventListener('scroll', throttle(() => {
    if (currentMode === 'favorites') return;
    const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
    if (scrollTop + clientHeight >= scrollHeight - 300 && !isLoading && !reachedEnd) {
      loadMoreMovies();
    }
  }, 200));

  // Add touchend for tablets/mobile
  window.addEventListener('touchend', () => {
    if (currentMode === 'favorites') return;
    const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
    if (scrollTop + clientHeight >= scrollHeight - 300 && !isLoading && !reachedEnd) {
      console.log('[touchend] Triggering loadMoreMovies');
      loadMoreMovies();
    }
  });

  // Initial load
  renderRecentlyViewed();
  resetInfiniteScroll();
});

// Modal close on outside click
document.getElementById('modal').onclick = function (e) {
  if (e.target === this) closeModal();
};
