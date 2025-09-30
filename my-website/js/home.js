const API_KEY = '40f1982842db35042e8561b13b38d492';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_URL = 'https://image.tmdb.org/t/p/original';
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
let initialItems = {
  movies: [],
  tvShows: [],
  anime: [],
  tagalogMovies: [],
  netflix: []
};
let expandedCategories = {
  movies: false,
  tvShows: false,
  anime: false,
  tagalogMovies: false,
  netflix: false
};
let isLoading = false;
let slideshowItems = [];
let currentSlide = 0;
let slideshowInterval;

async function fetchTrending(type, page = 1) {
  try {
    const res = await fetch(`${BASE_URL}/trending/${type}/week?api_key=${API_KEY}&page=${page}`);
    const data = await res.json();
    console.log(`Fetched ${type} page ${page}:`, data.results.length, 'items');
    return data.results || [];
  } catch (error) {
    console.error(`Error fetching trending ${type}:`, error);
    return [];
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
    allResults = allResults.concat(filtered);
    console.log(`Fetched anime page ${page}:`, allResults.length, 'items');
  } catch (error) {
    console.error('Error fetching trending anime:', error);
  }
  return allResults;
}

async function fetchTagalogMovies(page = 1) {
  try {
    const res = await fetch(
      `${BASE_URL}/discover/movie?api_key=${API_KEY}&language=tl&sort_by=popularity.desc&include_adult=false&include_video=false&page=${page}&with_original_language=tl`
    );
    const data = await res.json();
    console.log(`Fetched Tagalog movies page ${page}:`, data.results.length, 'items');
    return data.results || [];
  } catch (error) {
    console.error('Error fetching Tagalog movies:', error);
    return [];
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
    console.log(`Fetched Netflix page ${page}:`, combined.length, 'items');
    return combined.slice(0, 20);
  } catch (error) {
    console.error('Error fetching Netflix content:', error);
    return [];
  }
}

async function fetchSeasonsAndEpisodes(tvId) {
  try {
    const res = await fetch(`${BASE_URL}/tv/${tvId}?api_key=${API_KEY}`);
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
    const data = await res.json();
    return data.episodes || [];
  } catch (error) {
    console.error('Error fetching episodes:', error);
    return [];
  }
}

function displaySlides() {
  const slidesContainer = document.getElementById('slides');
  const dotsContainer = document.getElementById('dots');
  slidesContainer.innerHTML = '';
  dotsContainer.innerHTML = '';

  slideshowItems.forEach((item, index) => {
    if (!item.backdrop_path) return;
    const slide = document.createElement('div');
    slide.className = 'slide';
    slide.style.backgroundImage = `url(${IMG_URL}${item.backdrop_path})`;
    slide.innerHTML = `<h1>${item.title || item.name}</h1>`;
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
  const slides = document.querySelectorAll('.slide');
  const dots = document.querySelectorAll('.dot');
  slides.forEach((slide, index) => {
    slide.style.transform = `translateX(-${currentSlide * 100}%)`;
  });
  dots.forEach((dot, index) => {
    dot.className = index === currentSlide ? 'dot active' : 'dot';
  });
  clearInterval(slideshowInterval);
  slideshowInterval = setInterval(() => {
    currentSlide = (currentSlide + 1) % slideshowItems.length;
    showSlide();
  }, 5000);
}

function changeSlide(n) {
  currentSlide = (currentSlide + n + slideshowItems.length) % slideshowItems.length;
  showSlide();
}

function displayList(items, containerId, clear = false) {
  const container = document.getElementById(containerId);
  const emptyMessage = document.getElementById('empty-message');
  
  if (clear) container.innerHTML = ''; // Clear container for Show More/Show Less
  
  if (items.length === 0 && container.innerHTML === '') {
    container.innerHTML = '<p style="color: #ccc; text-align: center;">No content available.</p>';
    emptyMessage.style.display = 'block';
    return;
  }

  const spinner = document.createElement('div');
  spinner.className = 'spinner';
  spinner.style.cssText = 'text-align: center; padding: 10px; grid-column: span 2;';
  spinner.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  container.appendChild(spinner);

  items.forEach(item => {
    if (!item.poster_path) return;
    const img = document.createElement('img');
    img.src = `${IMG_URL}${item.poster_path}`;
    img.alt = (item.title || item.name) + (item.media_type ? ` (${item.media_type})` : '');
    img.onload = () => spinner.remove();
    img.onclick = () => showDetails(item);
    container.appendChild(img);
  });

  if (items.length > 0) {
    emptyMessage.style.display = 'none';
  }
}

async function showDetails(item) {
  currentItem = item;
  currentSeason = 1;
  currentEpisode = 1;
  document.getElementById('modal-title').textContent = item.title || item.name;
  document.getElementById('modal-description').textContent = item.overview;
  document.getElementById('modal-image').src = `${IMG_URL}${item.poster_path}`;
  document.getElementById('modal-rating').innerHTML = '★'.repeat(Math.round((item.vote_average || 0) / 2));
  document.getElementById('server').value = 'player.videasy.net';
  
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
  document.getElementById('modal').style.display = 'flex';
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
    div.innerHTML = `${img}<span>Episode ${episode.episode_number}: ${episode.name}</span>`;
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

  document.getElementById('modal-video').src = embedURL;
}

function closeModal() {
  document.getElementById('modal').style.display = 'none';
  document.getElementById('modal-video').src = '';
  document.getElementById('episode-list').innerHTML = '';
  document.getElementById('season-selector').style.display = 'none';
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

async function showMore(category) {
  if (isLoading) return;
  isLoading = true;
  console.log(`Show More clicked for ${category}`);

  try {
    let items = [];
    let containerId = `${category}-list`;
    let showMoreBtn = document.getElementById(`show-more-${category}`);
    let showLessBtn = document.getElementById(`show-less-${category}`);

    // Fetch up to 5 pages (approx. 100 items)
    const maxPages = 5;
    let currentPage = currentPages[category];
    const endPage = Math.min(currentPage + maxPages - 1, 500);
    let allItems = [];

    if (category === 'movies') {
      for (let i = currentPage; i <= endPage; i++) {
        const results = await fetchTrending('movie', i);
        allItems = allItems.concat(results);
      }
      currentPages.movies = endPage + 1;
    } else if (category === 'tvShows') {
      for (let i = currentPage; i <= endPage; i++) {
        const results = await fetchTrending('tv', i);
        allItems = allItems.concat(results);
      }
      currentPages.tvShows = endPage + 1;
    } else if (category === 'anime') {
      for (let i = currentPage; i <= endPage; i++) {
        const results = await fetchTrendingAnime(i);
        allItems = allItems.concat(results);
      }
      currentPages.anime = endPage + 1;
    } else if (category === 'tagalogMovies') {
      for (let i = currentPage; i <= endPage; i++) {
        const results = await fetchTagalogMovies(i);
        allItems = allItems.concat(results);
      }
      currentPages.tagalogMovies = endPage + 1;
    } else if (category === 'netflix') {
      for (let i = currentPage; i <= endPage; i++) {
        const results = await fetchNetflixContent(i);
        allItems = allItems.concat(results);
      }
      currentPages.netflix = endPage + 1;
    }

    // Clear and display all items
    displayList(allItems, containerId, true);
    
    // Update button visibility
    if (showMoreBtn) showMoreBtn.style.display = 'none';
    if (showLessBtn) showLessBtn.style.display = 'inline-block';
    
    // Enable infinite scroll for this category
    expandedCategories[category] = true;
    console.log(`Expanded ${category}:`, expandedCategories);
  } catch (error) {
    console.error(`Error in showMore for ${category}:`, error);
  } finally {
    isLoading = false;
  }
}

async function showLess(category) {
  if (isLoading) return;
  isLoading = true;
  console.log(`Show Less clicked for ${category}`);

  try {
    const containerId = `${category}-list`;
    const showMoreBtn = document.getElementById(`show-more-${category}`);
    const showLessBtn = document.getElementById(`show-less-${category}`);
    
    // Reset to initial items
    displayList(initialItems[category], containerId, true);
    
    // Reset page counter
    currentPages[category] = 1;
    
    // Update button visibility
    if (showMoreBtn) showMoreBtn.style.display = 'inline-block';
    if (showLessBtn) showLessBtn.style.display = 'none';
    
    // Disable infinite scroll for this category
    expandedCategories[category] = false;
    console.log(`Collapsed ${category}:`, expandedCategories);
  } catch (error) {
    console.error(`Error in showLess for ${category}:`, error);
  } finally {
    isLoading = false;
  }
}

async function loadMoreContent() {
  if (isLoading) return;
  isLoading = true;
  console.log('loadMoreContent triggered:', expandedCategories);

  try {
    if (expandedCategories.movies) {
      const movies = await fetchTrending('movie', ++currentPages.movies);
      displayList(movies, 'movies-list');
    }
    if (expandedCategories.tvShows) {
      const tvShows = await fetchTrending('tv', ++currentPages.tvShows);
      displayList(tvShows, 'tvshows-list');
    }
    if (expandedCategories.anime) {
      const anime = await fetchTrendingAnime(++currentPages.anime);
      displayList(anime, 'anime-list');
    }
    if (expandedCategories.tagalogMovies) {
      const tagalogMovies = await fetchTagalogMovies(++currentPages.tagalogMovies);
      displayList(tagalogMovies, 'tagalog-movies-list');
    }
    if (expandedCategories.netflix) {
      const netflixContent = await fetchNetflixContent(++currentPages.netflix);
      displayList(netflixContent, 'netflix-list');
    }
  } catch (error) {
    console.error('Error loading more content:', error);
  } finally {
    isLoading = false;
  }
}

function handleScroll() {
  const scrollPosition = window.innerHeight + window.scrollY;
  const documentHeight = Math.max(
    document.body.scrollHeight,
    document.body.offsetHeight,
    document.documentElement.clientHeight,
    document.documentElement.scrollHeight,
    document.documentElement.offsetHeight
  );
  const threshold = documentHeight - 200;
  if (scrollPosition >= threshold && !isLoading) {
    console.log('Scroll triggered:', { scrollPosition, threshold });
    loadMoreContent();
  }
}

async function init() {
  document.getElementById('empty-message').style.display = 'block';
  console.log('Initializing website...');

  try {
    const [movies, tvShows, anime, tagalogMovies, netflixContent] = await Promise.all([
      fetchTrending('movie', currentPages.movies),
      fetchTrending('tv', currentPages.tvShows),
      fetchTrendingAnime(currentPages.anime),
      fetchTagalogMovies(currentPages.tagalogMovies),
      fetchNetflixContent(currentPages.netflix)
    ]);

    // Store initial items for Show Less
    initialItems.movies = movies.slice(0, 12);
    initialItems.tvShows = tvShows.slice(0, 12);
    initialItems.anime = anime.slice(0, 12);
    initialItems.tagalogMovies = tagalogMovies.slice(0, 12);
    initialItems.netflix = netflixContent.slice(0, 12);

    slideshowItems = [
      ...movies.slice(0, 3),
      tvShows[0] || {},
      anime[0] || {},
      tagalogMovies[0] || {},
      netflixContent[0] || {}
    ].filter(item => item.backdrop_path && (item.title || item.name));

    if (slideshowItems.length > 0) {
      displaySlides();
    } else {
      document.getElementById('slides').innerHTML = '<h1>No featured content available</h1>';
    }

    displayList(initialItems.movies, 'movies-list', true);
    displayList(initialItems.tvShows, 'tvshows-list', true);
    displayList(initialItems.anime, 'anime-list', true);
    displayList(initialItems.tagalogMovies, 'tagalog-movies-list', true);
    displayList(initialItems.netflix, 'netflix-list', true);

    // Add event listeners for buttons
    const categories = ['movies', 'tvShows', 'anime', 'tagalogMovies', 'netflix'];
    categories.forEach(category => {
      const showMoreBtn = document.getElementById(`show-more-${category}`);
      const showLessBtn = document.getElementById(`show-less-${category}`);
      if (showMoreBtn) {
        showMoreBtn.addEventListener('click', () => showMore(category));
      } else {
        console.error(`Show More button not found for ${category}`);
      }
      if (showLessBtn) {
        showLessBtn.addEventListener('click', () => showLess(category));
      } else {
        console.error(`Show Less button not found for ${category}`);
      }
    });

    window.addEventListener('scroll', handleScroll);
    console.log('Initialization complete');
  } catch (error) {
    console.error('Error initializing:', error);
    document.getElementById('empty-message').textContent = 'Failed to load content. Please refresh the page.';
  }
}

init();