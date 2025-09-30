const API_KEY = '40f1982842db35042e8561b13b38d492';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_URL = 'https://image.tmdb.org/t/p/original';
let currentItem;

async function fetchTrending(type) {
  try {
    const res = await fetch(`${BASE_URL}/trending/${type}/week?api_key=${API_KEY}`);
    const data = await res.json();
    return data.results || [];
  } catch (error) {
    console.error(`Error fetching trending ${type}:`, error);
    return [];
  }
}

async function fetchTrendingAnime() {
  let allResults = [];
  try {
    // Fetch from multiple pages to get more anime (max 3 pages for demo)
    for (let page = 1; page <= 3; page++) {
      const res = await fetch(`${BASE_URL}/trending/tv/week?api_key=${API_KEY}&page=${page}`);
      const data = await res.json();
      const filtered = data.results.filter(item =>
        item.original_language === 'ja' && item.genre_ids.includes(16)
      );
      allResults = allResults.concat(filtered);
    }
  } catch (error) {
    console.error('Error fetching trending anime:', error);
  }
  return allResults;
}

async function fetchTagalogMovies() {
  try {
    const res = await fetch(
      `${BASE_URL}/discover/movie?api_key=${API_KEY}&language=tl&sort_by=popularity.desc&include_adult=false&include_video=false&page=1&with_original_language=tl`
    );
    const data = await res.json();
    return data.results || [];
  } catch (error) {
    console.error('Error fetching Tagalog movies:', error);
    return [];
  }
}

async function fetchNetflixContent() {
  try {
    // Fetch Netflix movies
    const movieRes = await fetch(
      `${BASE_URL}/discover/movie?api_key=${API_KEY}&with_watch_providers=8&watch_region=US&sort_by=popularity.desc&include_adult=false&include_video=false&page=1`
    );
    const movieData = await movieRes.json();
    const movies = movieData.results || [];

    // Fetch Netflix TV shows
    const tvRes = await fetch(
      `${BASE_URL}/discover/tv?api_key=${API_KEY}&with_watch_providers=8&watch_region=US&sort_by=popularity.desc&include_adult=false&include_video=false&page=1`
    );
    const tvData = await tvRes.json();
    const tvShows = tvData.results || [];

    // Combine and sort by popularity (descending)
    const combined = [...movies, ...tvShows].sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
    return combined.slice(0, 20); // Limit to 20 items for performance
  } catch (error) {
    console.error('Error fetching Netflix content:', error);
    return [];
  }
}

function displayBanner(item) {
  document.getElementById('banner').style.backgroundImage = `url(${IMG_URL}${item.backdrop_path})`;
  document.getElementById('banner-title').textContent = item.title || item.name;
}

function displayList(items, containerId) {
  const container = document.getElementById(containerId);
  const emptyMessage = document.getElementById('empty-message');
  container.innerHTML = '';
  
  if (items.length === 0) {
    container.innerHTML = '<p style="color: #ccc; text-align: center;">No content available.</p>';
    return;
  }

  items.forEach(item => {
    if (!item.poster_path) return; // Skip items without posters
    const img = document.createElement('img');
    img.src = `${IMG_URL}${item.poster_path}`;
    img.alt = (item.title || item.name) + (item.media_type ? ` (${item.media_type})` : '');
    img.onclick = () => showDetails(item);
    container.appendChild(img);
  });

  // Hide global empty message if any list has content
  if (items.length > 0) {
    emptyMessage.style.display = 'none';
  }
}

function showDetails(item) {
  currentItem = item;
  document.getElementById('modal-title').textContent = item.title || item.name || 'Untitled';
  // Use fallback message if overview is missing
  document.getElementById('modal-description').textContent = item.overview || 'No description available.';
  document.getElementById('modal-image').src = `${IMG_URL}${item.poster_path || ''}`;
  document.getElementById('modal-rating').innerHTML = '★'.repeat(Math.round((item.vote_average || 0) / 2));
  // Set default server to player.videasy.net
  document.getElementById('server').value = 'player.videasy.net';
  changeServer(); // Load the default server's embed URL
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

async function init() {
  document.getElementById('empty-message').style.display = 'block'; // Show loading/fallback initially

  try {
    const [movies, tvShows, anime, tagalogMovies, netflixContent] = await Promise.all([
      fetchTrending('movie'),
      fetchTrending('tv'),
      fetchTrendingAnime(),
      fetchTagalogMovies(),
      fetchNetflixContent()
    ]);

    // Random banner from movies (fallback to first if empty)
    const bannerItem = movies[Math.floor(Math.random() * movies.length)] || movies[0];
    if (bannerItem) {
      displayBanner(bannerItem);
    }

    displayList(movies, 'movies-list');
    displayList(tvShows, 'tvshows-list');
    displayList(anime, 'anime-list');
    displayList(tagalogMovies, 'tagalog-movies-list');
    displayList(netflixContent, 'netflix-list');
  } catch (error) {
    console.error('Error initializing:', error);
    document.getElementById('empty-message').textContent = 'Failed to load content. Please refresh the page.';
  }
}

init();