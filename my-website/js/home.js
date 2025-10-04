// js/home.js
const API_KEY = '40f1982842db35042e8561b13b38d492'; // Your original TMDB API key
const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_URL = 'https://image.tmdb.org/t/p/original';
const FALLBACK_IMAGE = 'https://via.placeholder.com/150x225?text=No+Image'; // Fallback for missing posters
let currentItem;
let currentSeason = 1;
let currentEpisode = 1;
let currentPages = {
  movies: 1,
  tvShows: 1,
  anime: 1,
  tagalogMovies: 1,
  netflix: 1,
  netflixMovies: 1
};
let isLoading = {
  movies: false,
  tvshows: false,
  anime: false,
  'tagalog-movies': false,
  netflix: false,
  netflixMovies: false
};
let hasMore = {
  movies: true,
  tvshows: true,
  anime: true,
  'tagalog-movies': true,
  netflix: true,
  netflixMovies: true
};
let scrollActive = {
  movies: false,
  tvshows: false,
  anime: false,
  'tagalog-movies': false,
  netflix: false,
  netflixMovies: false
};
let slideshowItems = [];
let currentSlide = 0;
let slideshowInterval;

async function fetchTrending(type, page = 1) {
  try {
    console.log(`Fetching trending ${type} page ${page}...`);
    const res = await fetch(`${BASE_URL}/trending/${type}/week?api_key=${API_KEY}&page=${page}`);
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
    console.log(`Fetching anime (movies and TV shows) page ${page}...`);
    // Fetch anime movies
    const movieRes = await fetch(
      `${BASE_URL}/discover/movie?api_key=${API_KEY}&sort_by=popularity.desc&include_adult=false&include_video=false&page=${page}&with_genres=16&with_original_language=ja`
    );
    if (!movieRes.ok) throw new Error(`Movies HTTP ${movieRes.status}`);
    const movieData = await movieRes.json();
    const movies = movieData.results || [];

    // Fetch anime TV shows
    const tvRes = await fetch(
      `${BASE_URL}/discover/tv?api_key=${API_KEY}&sort_by=popularity.desc&include_adult=false&include_video=false&page=${page}&with_genres=16&with_original_language=ja`
    );
    if (!tvRes.ok) throw new Error(`TV HTTP ${tvRes.status}`);
    const tvData = await tvRes.json();
    const tvShows = tvData.results || [];

    // Combine and sort by popularity
    const combined = [...movies, ...tvShows]
      .filter(item => item.poster_path) // Ensure items have posters
      .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
      .slice(0, 20); // Limit to 20 items per page
    console.log(`Fetched ${combined.length} anime items (movies: ${movies.length}, TV: ${tvShows.length})`);
    return combined;
  } catch (error) {
    console.error('Error fetching trending anime:', error);
    showError('Failed to load anime. Check API key or connection.', 'anime-list');
    return [];
  }
}

async function fetchTagalogMovies(page = 1) {
  try {
    console.log(`Fetching Tagalog movies page ${page}...`);
    const res = await fetch(
      `${BASE_URL}/discover/movie?api_key=${API_KEY}&language=tl&sort_by=popularity.desc&include_adult=false&include_video=false&page=${page}&with_original_language=tl`
    );
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
    const movieRes = await fetch(
      `${BASE_URL}/discover/movie?api_key=${API_KEY}&with_watch_providers=8&watch_region=US&sort_by=popularity.desc&include_adult=false&include_video=false&page=${page}`
    );
    if (!movieRes.ok) throw new Error(`Movies HTTP ${movieRes.status}`);
    const movieData = await movieRes.json();
    const movies = movieData.results || [];

    const tvRes = await fetch(
      `${BASE_URL}/discover/tv?api_key=${API_KEY}&with_watch_providers=8&watch_region=US&sort_by=popularity.desc&include_adult=false&include_video=false&page=${page}`
    );
    if (!tvRes.ok) throw new Error(`TV HTTP ${tvRes.status}`);
    const tvData = await tvRes.json();
    const tvShows = tvData.results || [];

    const combined = [...movies, ...tvShows].sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
    const sliced = combined.slice(0, 20);
    console.log(`Fetched ${sliced.length} Netflix items`);
    return sliced;
  } catch (error) {
    console.error('Error fetching Netflix content:', error);
    showError('Failed to load Netflix content.', 'netflix-list');
    return [];
  }
}

async function fetchNetflixMovies(page = 1) {
  try {
    console.log(`Fetching Netflix movies page ${page}...`);
    const res = await fetch(
      `${BASE_URL}/discover/movie?api_key=${API_KEY}&with_watch_providers=8&watch_region=WW&sort_by=popularity.desc&include_adult=false&include_video=false&page=${page}`
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    console.log(`Fetched ${data.results?.length || 0} Netflix movies (total pages: ${data.total_pages})`);
    // Fallback: If 0 results, try without region filter (broader search)
    if (!data.results || data.results.length === 0) {
      console.warn('No Netflix movies found for WW—falling back to global popular movies with Netflix provider.');
      const fallbackRes = await fetch(
        `${BASE_URL}/discover/movie?api_key=${API_KEY}&with_watch_providers=8&sort_by=popularity.desc&include_adult=false&include_video=false&page=${page}`
      );
      const fallbackData = await fallbackRes.json();
      return { results: fallbackData.results || [] };
    }
    return data;
  } catch (error) {
    console.error('Error fetching Netflix movies:', error);
    showError('Failed to load Netflix movies. Trying again soon...', 'netflix-movies-list');
    return { results: [] };
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
  const container =