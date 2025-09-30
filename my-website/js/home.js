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
  netflix: 1,
  allMovies: 1
};
let isLoading = false;
let slideshowItems = [];
let currentSlide = 0;
let slideshowInterval;
let genres = [];

async function fetchGenres() {
  try {
    const res = await fetch(`${BASE_URL}/genre/movie/list?api_key=${API_KEY}`);
    if (!res.ok) throw new Error('Network response was not ok');
    const data = await res.json();
    return data.genres || [];
  } catch (error) {
    console.error('Error fetching genres:', error);
    return [];
  }
}

async function fetchAllMovies(page = 1) {
  try {
    const genre = document.getElementById('genre-filter').value;
    const year = document.getElementById('year-filter').value;
    let url = `${BASE_URL}/discover/movie?api_key=${API_KEY}&sort_by=popularity.desc&include_adult=false&include_video=false&page=${page}`;
    if (genre) url += `&with_genres=${genre}`;
    if (year) url += `&primary_release_year=${year}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Network response was not ok');
    const data = await res.json();
    return data.results || [];
  } catch (error) {
    console.error('Error fetching all movies:', error);
    return [];
  }
}

async function fetchTrending(type, page = 1) {
  try {
    const res = await fetch(`${BASE_URL}/trending/${type}/week?api_key=${API_KEY}&page=${page}`);
    if (!res.ok) throw new Error('Network response was not ok');
    const data = await res.json();
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
    if (!res.ok) throw new Error('Network response was not ok');
    const data = await res.json();
    const filtered = data.results.filter(item =>
      item.original_language === 'ja' && item.genre_ids.includes(16)
    );
    allResults = allResults.concat(filtered);
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
    if (!res.ok) throw new Error('Network response was not ok');
    const data = await res.json();
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
    if (!movieRes.ok) throw new Error('Network response was not ok');
    const movieData = await movieRes.json();
    const movies = movieData.results || [];

    const tvRes = await fetch(
      `${BASE_URL}/discover/tv?api_key=${API_KEY}&with_watch_providers=8&watch_region=US&sort_by=popularity.desc&include_adult=false&include_video=false&page=${page}`
    );
    if (!tvRes.ok) throw new Error('Network response was not ok');
    const tvData = await tvRes.json();
    const tvShows = tvData.results || [];

    const combined = [...movies, ...tvShows].sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
    return combined.slice(0, 20);
  } catch (error) {
    console.error('Error fetching Netflix content:', error);
    return [];
  }
}

async function fetchSeasonsAndEpisodes(tvId) {
  try {
    const res = await fetch(`${BASE_URL}/tv/${tvId}?api_key=${API_KEY}`);
    if (!res.ok) throw new Error('Network response was not ok');
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
    if (!res.ok) throw new Error('Network response was not ok');
    const data = await res.json();
    return data.episodes || [];
  } catch (error) {
    console.error('Error fetching episodes:', error);
    return [];
  }
}

function populateFilters() {
  const genreFilter = document.getElementById('genre-filter');
  genres.forEach(genre => {
    const option = document.createElement('option');
    option.value = genre.id;
    option.textContent = genre.name;
    genreFilter.appendChild(option);
  });

  const yearFilter = document.getElementById('year-filter');
  const currentYear = new Date().getFullYear();
  for (let year = currentYear; year >= currentYear - 50; year--) {
    const option = document.createElement('option');
    option.value = year;
    option.textContent = year;
    yearFilter.appendChild(option);
  }
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function displaySlides() {
  const slidesContainer = document.getElementById('slides');
  const dotsContainer = document.getElementById('dots');
  slidesContainer.innerHTML = '';
  dotsContainer.innerHTML = '';

  slideshowItems.forEach((item, index) => {
    if (!item.backdrop_path || (!item.title && !item.name)) return;
    const slide = document.createElement('div');
    slide.className = 'slide';
    slide.style.backgroundImage = `url(${IMG_URL}${item.backdrop_path})`;
    const description = item.overview ? item.overview.substring(0, 150) + (item.overview.length > 150 ? '...' : '') : 'No description available.';
    const rating = item.vote_average ? '★'.repeat(Math.round(item.vote_average / 2)) : 'No rating';
    slide.innerHTML = `
      <div class="slide-content">
        <h1>${item.title || item.name}</h1>
        <p class="slide-description">${description}</p>
        <div class="slide-rating">${rating}</div>
      </div>
    `;
    slide.setAttribute('role', 'button');
    slide.setAttribute('aria-label', `View details for ${item.title || item.name}`);
    slide.tabIndex = 0;
    slide.onclick = () => showDetails(item);
    slide.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') showDetails(item);
    };
    slidesContainer.appendChild(slide);

    const dot = document.createElement('span');
    dot.className = 'dot';
    if (index === currentSlide) dot.className += ' active';
    dot.setAttribute('role', 'tab');
    dot.setAttribute('aria-label', `Go to slide ${index + 1}`);
    dot.tabIndex = 0;
    dot.onclick = () => {
      currentSlide = index;
      showSlide();
    };
    dotsContainer.appendChild(dot);
  });

  if (slidesContainer.children.length === 0) {
    slidesContainer.innerHTML = '<div class="slide-content"><h1>No featured content available</h1></div>';
  }

  slidesContainer.onmouseenter = () => clearInterval(slideshowInterval);
  slidesContainer.onmouseleave = () => showSlide();

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
  const slides =Thông tin chi tiết về việc thực hiện yêu cầu của bạn:

### Yêu cầu
Bạn muốn sửa đổi danh mục **"All Movies"** trên trang web https://reelroom.pages.dev/ để:
1. Cho phép người dùng chọn **thể loại** (genre) và **năm phát hành** (year), sau đó nhấn nút **"Search"** để lọc danh sách phim, thay vì cập nhật tự động.
2. Đảm bảo phim được sắp xếp theo **độ phổ biến** (popularity, trending first), như hiện tại với endpoint `/discover/movie` và `sort_by=popularity.desc`.
3. Di chuyển danh mục "All Movies" xuống **cuối cùng**, sau danh mục "Trending Netflix".
4. Sử dụng giao diện người dùng (UI) giống các danh mục khác (cuộn ngang thay vì cuộn dọc vô hạn như trước).
5. Thêm nút **"Search"** để kích hoạt lọc phim theo thể loại và năm.
6. Giữ nguyên **slideshow banner** (với tiêu đề, mô tả, xếp hạng) và khả năng phát video (qua modal với các server `vidsrc.cc`, `vidsrc.me`, `player.videasy.net`).
7. Giữ nút **"Back to Top"** để hỗ trợ cuộn dài.

### Cách tiếp cận
- **HTML**: Di chuyển phần "All Movies" xuống sau "Trending Netflix" và thêm nút "Search" vào bộ lọc.
- **CSS**: Thêm kiểu cho nút "Search", sử dụng `.list` thay vì `.vertical-list` cho cuộn ngang, đảm bảo giao diện nhất quán.
- **JavaScript**:
  - Chỉ gọi `loadAllMovies` khi nhấn nút "Search" thay vì `onchange` trên dropdown.
  - Giữ `sort_by=popularity.desc` trong `fetchAllMovies` để ưu tiên phim trending.
  - Cập nhật logic cuộn vô hạn để hỗ trợ cuộn ngang cho "All Movies".
- **Tích hợp**: Đảm bảo slideshow, khả năng phát video, và nút "Back to Top" không bị ảnh hưởng.
- **Triển khai**: Cung cấp hướng dẫn triển khai trên Cloudflare Pages.

### Mã cập nhật
Dưới đây là mã HTML, CSS, và JavaScript được cập nhật để đáp ứng các yêu cầu, dựa trên phiên bản trước đó.

#### HTML (`index.html`)
Di chuyển "All Movies" xuống cuối và thêm nút "Search".

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>ReelRoom</title>
  <link rel="stylesheet" href="css/home.css">
  <link rel="preload" href="css/home.css" as="style">
  <link rel="preload" href="js/home.js" as="script">
  <link rel="manifest" href="manifest.json">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  <script defer src="js/home.js"></script>
</head>

<body>
  <div class="navbar">
    <img src="logo.png" alt="ReelRoom Logo" />
    <div class="nav-links">
      <a href="index.html">Home</a>
      <input type="text" class="search-bar" placeholder="Search..." onfocus="openSearchModal()" />
    </div>
  </div>

  <div class="banner" id="banner">
    <div class="slideshow-container">
      <div class="slides" id="slides"></div>
      <div class="loading" id="slideshow-loading">Loading...</div>
      <a class="prev" onclick="changeSlide(-1)" role="button" aria-label="Previous slide">&#10094;</a>
      <a class="next" onclick="changeSlide(1)" role="button" aria-label="Next slide">&#10095;</a>
      <div class="dots" id="dots"></div>
    </div>
  </div>

  <div class="row">
    <h2>Trending Movies</h2>
    <div class="list" id="movies-list"></div>
  </div>

  <div class="row">
    <h2>Trending TV Shows</h2>
    <div class="list" id="tvshows-list"></div>
  </div>

  <div class="row">
    <h2>Trending Anime</h2>
    <div class="list" id="anime-list"></div>
  </div>

  <div class="row">
    <h2>Trending Tagalog Movies</h2>
    <div class="list" id="tagalog-movies-list"></div>
  </div>

  <div class="row">
    <h2>Trending Netflix</h2>
    <div class="list" id="netflix-list"></div>
  </div>

  <div class="row">
    <h2>All Movies</h2>
    <div class="filters">
      <label for="genre-filter">Genre:</label>
      <select id="genre-filter">
        <option value="">All Genres</option>
      </select>
      <label for="year-filter">Year:</label>
      <select id="year-filter">
        <option value="">All Years</option>
      </select>
      <button class="search-button" onclick="loadAllMovies(1)">Search</button>
    </div>
    <div class="list" id="all-movies-list"></div>
  </div>

  <div id="empty-message" style="display: none; text-align: center; color: #ccc; padding: 20px;">No content available at the moment. Try searching!</div>

  <div class="modal" id="modal">
    <div class="modal-content">
      <span class="close" onclick="closeModal()" style="color: red;">&times;</span>
      <div class="modal-body">
        <img id="modal-image" src="" alt="" />
        <div class="modal-text">
          <h2 id="modal-title"></h2>
          <div class="stars" id="modal-rating"></div>
          <p id="modal-description"></p>
        </div>
      </div>
      <div class="server-selector">
        <label for="server">Change Server:</label>
        <select id="server" onchange="changeServer()">
          <option value="vidsrc.cc">Vidsrc.cc</option>
          <option value="vidsrc.me">Vidsrc.me</option>
          <option value="player.videasy.net">Player.Videasy.net</option>
        </select>
      </div>
      <div class="season-selector" id="season-selector" style="display: none;">
        <label for="season">Select Season:</label>
        <select id="season" onchange="loadEpisodes()"></select>
      </div>
      <div class="episode-list" id="episode-list"></div>
      <iframe id="modal-video" width="100%" height="315" frameborder="0" allowfullscreen></iframe>
    </div>
  </div>

  <div class="search-modal" id="search-modal">
    <span class="close" onclick="closeSearchModal()" style="color: red;">&times;</span>
    <input type="text" id="search-input" placeholder="Search for a movie or show..." oninput="searchTMDB()" />
    <div class="results" id="search-results"></div>
  </div>

  <button class="back-to-top" id="back-to-top" onclick="scrollToTop()" role="button" aria-label="Scroll to top" style="display: none;">
    <i class="fas fa-arrow-up"></i>
  </button>

  <footer class="footer">
    <div class="footer-content">
      <p>&copy; 2025 ReelRoom. All rights reserved.</p>
      <div class="footer-links">
        <a href="#">Disclaimer</a>
        <a href="#">About Us</a>
        <a href="#">Contact Us</a>
      </div>
    </div>
  </footer>
</body>
</html>