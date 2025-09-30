const API_KEY = '40f1982842db35042e8561b13b38d492';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_URL = 'https://image.tmdb.org/t/p/original';
let currentItem;
let movieGenres = [];
let tvGenres = [];

// Track pagination for each category
const pageTrackers = {
  movies: 1,
  tvshows: 1,
  anime: 1,
  tagalog: 1,
  netflix: 1
};

// Track collapse state for each category
const collapseStates = {
  movies: true,
  tvshows: true,
  anime: true,
  tagalog: true,
  netflix: true
};

// Current category and page for "Show More" modal
let currentMoreCategory = null;
let morePage = 1;

async function fetchGenres() {
  try {
    const [movieRes, tvRes] = await Promise.all([
      fetch(`${BASE_URL}/genre/movie/list?api_key=${API_KEY}`),
      fetch(`${BASE_URL}/genre/tv/list?api_key=${API_KEY}`)
    ]);
    const movieData = await movieRes.json();
    const tvData = await tvRes.json();
    movieGenres = movieData.genres || [];
    tvGenres = tvData.genres || [];
  } catch (error) {
    console.error('Error fetching genres:', error);
  }
}

async function fetchTrending(type, page = 1) {
  try {
    const res = await fetch(`${BASE_URL}/trending/${type}/week?api_key=${API_KEY}&page=${page}`);
    const data = await res.json();
    return { results: data.results || [], total_pages: data.total_pages || 1 };
  } catch (error) {
    console.error(`Error fetching trending ${type}:`, error);
    return { results: [], total_pages: 1 };
  }
}

async function fetchTrendingAnime(page = 1) {
  let allResults = [];
  try {
    const res = await fetch(`${BASE_URL}/trending/tv/week?api_key=${API_KEY}&page=${page}`);
    const data = await res.json();
    const filtered = data.results.filter(item =>
      item.original_language === 'ja' && item.genre_ids.includes(16)
    );
    allResults = filtered;
    return { results: allResults, total_pages: data.total_pages || 1 };
  } catch (error) {
    console.error('Error fetching trending anime:', error);
    return { results: [], total_pages: 1 };
  }
}

async function fetchTagalogMovies(page = 1) {
  try {
    const res = await fetch(
      `${BASE_URL}/discover/movie?api_key=${API_KEY}&language=tl&sort_by=popularity.desc&include_adult=false&include_video=false&page=${page}&with_original_language=tl`
    );
    const data = await res.json();
    return { results: data.results || [], total_pages: data.total_pages || 1 };
  } catch (error) {
    console.error('Error fetching Tagalog movies:', error);
    return { results: [], total_pages: 1 };
  }
}

async function fetchNetflixContent(page = 1) {
  try {
    const movieRes = await fetch(
      `${BASE_URL}/discover/movie?api_key=${API_KEY}&with_watch_providers=8&watch_region=US&sort_by=popularity.desc&include_adult=false&include_video=false&page=${page}`
    );
    const movieData = await movieRes.json();
    const movies = movieData.results || [];

    const tvRes = await fetch(
      `${BASE_URL}/discover/tv?api_key=${API_KEY}&with_watch_providers=8&watch_region=US&sort_by=popularity.desc&include_adult=false&include_video=false&page=${page}`
    );
    const tvData = await tvRes.json();
    const tvShows = tvData.results || [];

    const combined = [...movies, ...tvShows].sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
    return { results: combined.slice(0, 20), total_pages: Math.min(movieData.total_pages || 1, tvData.total_pages || 1) };
  } catch (error) {
    console.error('Error fetching Netflix content:', error);
    return { results: [], total_pages: 1 };
  }
}

function getGenres(item) {
  const genres = item.media_type === 'tv' || item.first_air_date ? tvGenres : movieGenres;
  return item.genre_ids
    .map(id => genres.find(genre => genre.id === id)?.name)
    .filter(name => name)
    .join(', ') || 'Unknown';
}

function getYear(item) {
  const date = item.release_date || item.first_air_date;
  return date ? new Date(date).getFullYear() : 'Unknown';
}

function displayBanner(item) {
  document.getElementById('banner').style.backgroundImage = `url(${IMG_URL}${item.backdrop_path})`;
  document.getElementById('banner-title').textContent = item.title || item.name;
}

function displayList(items, containerId, append = false) {
  const container = document.getElementById(containerId);
  const emptyMessage = document.getElementById('empty-message');
  
  if (!append) {
    container.innerHTML = '';
  }
  
  if (items.length === 0 && !append) {
    container.innerHTML = '<p style="color: #ccc; text-align: center;">No content available.</p>';
    return;
  }

  items.forEach(item => {
    if (!item.poster_path) return;
    const itemDiv = document.createElement('div');
    itemDiv.className = 'list-item';
    itemDiv.innerHTML = `
      <img src="${IMG_URL}${item.poster_path}" alt="${(item.title || item.name) + (item.media_type ? ` (${item.media_type})` : '')}">
      <div class="item-info">
        <p class="item-year">${getYear(item)}</p>
        <p class="item-genres">${getGenres(item)}</p>
      </div>
    `;
    itemDiv.querySelector('img').onclick = () => showDetails(item);
    container.appendChild(itemDiv);
  });

  if (items.length > 0) {
    emptyMessage.style.display = 'none';
  }
}

function displayMoreList(items, append = false) {
  const container = document.getElementById('more-grid');
  const emptyMessage = document.getElementById('empty-more-message');
  
  if (!append) {
    container.innerHTML = '';
  }
  
  if (items.length === 0 && !append) {
    emptyMessage.style.display = 'block';
    return;
  }

  items.forEach(item => {
    if (!item.poster_path) return;
    const itemDiv = document.createElement('div');
    itemDiv.className = 'grid-item';
    itemDiv.innerHTML = `
      <img src="${IMG_URL}${item.poster_path}" alt="${(item.title || item.name) + (item.media_type ? ` (${item.media_type})` : '')}">
      <div class="item-info">
        <p class="item-year">${getYear(item)}</p>
        <p class="item-genres">${getGenres(item)}</p>
      </div>
    `;
    itemDiv.querySelector('img').onclick = () => showDetails(item);
    container.appendChild(itemDiv);
  });

  emptyMessage.style.display = 'none';
}

function showDetails(item) {
  currentItem = item;
  document.getElementById('modal-title').textContent = item.title || item.name || 'Untitled';
  document.getElementById('modal-description').textContent = item.overview || 'No description available.';
  document.getElementById('modal-image').src = `${IMG_URL}${item.poster_path || ''}`;
  document.getElementById('modal-rating').innerHTML = '★'.repeat(Math.round((item.vote_average || 0) / 2));
  document.getElementById('server').value = 'player.videasy.net';
  changeServer();
  document.getElementById('modal').style.display = 'flex';
}

function changeServer() {
  if (!currentItem) return;
  const server = document.getElementById('server').value;
  const type = currentItem.media_type || (currentItem.title ? 'movie' : 'tv');
  let embedURL = "";

  if (server === "vidsrc.cc") {
    embedURL = `https://vidsrc.cc/v2/embed/${type}/${currentItem.id}`;
  } else if (server === "vidsrc.me") {
    embedURL = `https://vidsrc.net/embed/${type}/?tmdb=${currentItem.id}`;
  } else if (server === "player.videasy.net") {
    embedURL = `https://player.videasy.net/${type}/${currentItem.id}`;
  }

  document.getElementById('modal-video').src = embedURL;
}

function closeModal() {
  document.getElementById('modal').style.display = 'none';
  document.getElementById('modal-video').src = '';
}

function openSearchModal() {
  document.getElementById('search-modal').style.display = 'flex';
  document.getElementById('search-input').focus();
}

function closeSearchModal() {
  document.getElementById('search-modal').style.display = 'none';
  document.getElementById('search-results').innerHTML = '';
}

function openMoreModal(category) {
  currentMoreCategory = category;
  morePage = 1;
  document.getElementById('more-modal-title').textContent = 
    category === 'movies' ? 'Trending Movies' :
    category === 'tvshows' ? 'Trending TV Shows' :
    category === 'anime' ? 'Trending Anime' :
    category === 'tagalog' ? 'Trending Tagalog Movies' : 'Trending Netflix';
  document.getElementById('more-modal').style.display = 'flex';
  document.getElementById('more-loading').style.display = 'block';
  fetchMore(category);
}

function closeMoreModal() {
  document.getElementById('more-modal').style.display = 'none';
  document.getElementById('more-grid').innerHTML = '';
  document.getElementById('more-loading').style.display = 'none';
  document.getElementById('empty-more-message').style.display = 'none';
  currentMoreCategory = null;
  morePage = 1;
}

async function fetchMore(category) {
  const loading = document.getElementById('more-loading');
  loading.style.display = 'block';
  let results = [];
  let total_pages = 1;

  if (category === 'movies') {
    ({ results, total_pages } = await fetchTrending('movie', morePage));
  } else if (category === 'tvshows') {
    ({ results, total_pages } = await fetchTrending('tv', morePage));
  } else if (category === 'anime') {
    ({ results, total_pages } = await fetchTrendingAnime(morePage));
  } else if (category === 'tagalog') {
    ({ results, total_pages } = await fetchTagalogMovies(morePage));
  } else if (category === 'netflix') {
    ({ results, total_pages } = await fetchNetflixContent(morePage));
  }

  displayMoreList(results, morePage > 1);
  morePage++;

  if (morePage > total_pages) {
    document.getElementById('more-loading').style.display = 'none';
    document.getElementById('empty-more-message').style.display = 'block';
  } else {
    document.getElementById('more-loading').style.display = 'none';
  }
}

async function searchTMDB() {
  const query = document.getElementById('search-input').value;
  if (!query.trim()) {
    document.getElementById('search-results').innerHTML = '';
    return;
  }

  try {
    const res = await fetch(`${BASE_URL}/search/multi?api_key=${API_KEY}&query=${query}`);
    const data = await res.json();

    const container = document.getElementById('search-results');
    container.innerHTML = '';
    data.results.forEach(item => {
      if (!item.poster_path) return;
      const img = document.createElement('img');
      img.src = `${IMG_URL}${item.poster_path}`;
      img.alt = item.title || item.name;
      img.onclick = () => {
        closeSearchModal();
        showDetails(item);
      };
      container.appendChild(img);
    });
  } catch (error) {
    console.error('Error searching:', error);
    document.getElementById('search-results').innerHTML = '<p style="color: #ccc;">Search failed. Try again.</p>';
  }
}

function toggleCategory(category) {
  const list = document.getElementById(
    category === 'movies' ? 'movies-list' :
    category === 'tvshows' ? 'tvshows-list' :
    category === 'anime' ? 'anime-list' :
    category === 'tagalog' ? 'tagalog-movies-list' : 'netflix-list'
  );
  const button = document.querySelector(`.show-more[data-category="${category}"]`);
  collapseStates[category] = !collapseStates[category];
  list.style.display = collapseStates[category] ? 'flex' : 'none';
  button.style.display = collapseStates[category] ? 'block' : 'none';
}

async function init() {
  document.getElementById('empty-message').style.display = 'block';

  try {
    await fetchGenres(); // Fetch genres first
    const [movies, tvShows, anime, tagalogMovies, netflixContent] = await Promise.all([
      fetchTrending('movie'),
      fetchTrending('tv'),
      fetchTrendingAnime(),
      fetchTagalogMovies(),
      fetchNetflixContent()
    ]);

    const bannerItem = movies.results[Math.floor(Math.random() * movies.results.length)] || movies.results[0];
    if (bannerItem) {
      displayBanner(bannerItem);
    }

    displayList(movies.results, 'movies-list');
    displayList(tvShows.results, 'tvshows-list');
    displayList(anime.results, 'anime-list');
    displayList(tagalogMovies.results, 'tagalog-movies-list');
    displayList(netflixContent.results, 'netflix-list');

    document.querySelectorAll('.row h2').forEach(header => {
      header.addEventListener('click', () => toggleCategory(header.dataset.category));
    });

    document.querySelectorAll('.show-more').forEach(button => {
      button.addEventListener('click', () => openMoreModal(button.dataset.category));
    });

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && currentMoreCategory) {
          fetchMore(currentMoreCategory);
        }
      });
    }, { threshold: 0.1 });

    observer.observe(document.getElementById('more-loading'));
  } catch (error) {
    console.error('Error initializing:', error);
    document.getElementById('empty-message').textContent = 'Failed to load content. Please refresh the page.';
  }
}

init();