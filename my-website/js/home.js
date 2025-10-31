// ====================================================================
// ========================== CONFIGURATION ===========================
// ====================================================================

// ⚠️ 1. INSERT YOUR TMDB API KEY HERE
const API_KEY = 'YOUR_TMDB_API_KEY'; 
const BASE_URL = 'https://api.themoviedb.org/3';
const POSTER_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// Example categories to fetch (YOU MAY HAVE YOUR OWN LIST)
const ENDPOINTS = {
    trending: '/trending/movie/week',
    popular: '/movie/popular',
    topRated: '/movie/top_rated',
    // ... add your other categories here
};

// ====================================================================
// ========================== PWA & SERVICE WORKER ====================
// ====================================================================

let deferredInstallPrompt = null;
const installButton = document.getElementById('install-button');

// 1. Register the Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    // Note: The scope is '/' because sw.js is at the root
    navigator.serviceWorker.register('/sw.js').then(function(registration) {
      console.log('ServiceWorker registration successful with scope: ', registration.scope);
    }, function(err) {
      console.log('ServiceWorker registration failed: ', err);
    });
  });
}

// 2. Handle the PWA Install Prompt
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  installButton.style.display = 'block';
});

installButton.addEventListener('click', () => {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the install prompt');
        installButton.style.display = 'none';
      } else {
        console.log('User dismissed the install prompt');
      }
      deferredInstallPrompt = null;
    });
  }
});

window.addEventListener('appinstalled', () => {
  installButton.style.display = 'none';
  console.log('ReelRoom PWA installed successfully!');
});


// ====================================================================
// ======================== MOVIE FETCHING & UI =======================
// ====================================================================

const movieRowsContainer = document.getElementById('movie-rows');
const heroSection = document.getElementById('hero-section');

// ⚠️ 2. IMPLEMENT YOUR getPosterUrl FUNCTION HERE
function getPosterUrl(path) {
    if (!path) return ''; // Placeholder for missing image
    return POSTER_BASE_URL + path;
}


// ⚠️ 3. IMPLEMENT YOUR fetchAndDisplayMovies FUNCTION HERE
// This function needs to:
// 1. Fetch data from TMDB (e.g., /trending/movie/week)
// 2. Create the .movie-row and .movie-list structure
// 3. Call createMovieCard for each movie
async function fetchAndDisplayMovies(title, endpoint) {
    const url = `${BASE_URL}${endpoint}?api_key=${API_KEY}`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
            const rowTitle = document.createElement('h2');
            rowTitle.classList.add('row-title');
            rowTitle.textContent = title;

            const movieList = document.createElement('div');
            movieList.classList.add('movie-list');
            
            data.results.forEach(movie => {
                const card = createMovieCard(movie);
                movieList.appendChild(card);
            });

            const movieRow = document.createElement('div');
            movieRow.classList.add('movie-row');
            movieRow.appendChild(rowTitle);
            movieRow.appendChild(movieList);

            movieRowsContainer.appendChild(movieRow);
        }
    } catch (error) {
        console.error(`Error fetching ${title}:`, error);
    }
}

// Function to create a single movie card
function createMovieCard(movie) {
    const movieCard = document.createElement('div');
    movieCard.classList.add('movie-card');
    // Store data needed for the modal
    movieCard.dataset.title = movie.title || movie.name;
    movieCard.dataset.overview = movie.overview;
    // NOTE: You need a way to get a video URL here for the modal, 
    // or fetch it on click. Using a placeholder for now.
    movieCard.dataset.videoId = movie.id; 

    const img = document.createElement('img');
    img.src = getPosterUrl(movie.poster_path);
    img.alt = movie.title || movie.name;
    
    // >>> LAZY LOADING IMPLEMENTATION <<<
    img.setAttribute('loading', 'lazy'); 
    
    movieCard.appendChild(img);

    // Event listener to open the modal on click
    movieCard.addEventListener('click', () => {
        // Since TMDB doesn't give a direct video URL, we must simulate it 
        // or make another API call to /movie/{movie_id}/videos to get a YouTube key.
        // For simplicity and testing the player, we'll use a placeholder URL.
        const PLACEHOLDER_VIDEO_URL = 'videos/placeholder.mp4'; // Replace with a real video path
        
        openVideoModal(
            movieCard.dataset.title, 
            movieCard.dataset.overview, 
            PLACEHOLDER_VIDEO_URL
        );
    });

    return movieCard;
}

// ⚠️ 4. IMPLEMENT THE MAIN APPLICATION STARTUP LOGIC HERE
// Call your fetchAndDisplayMovies for all your categories.
document.addEventListener('DOMContentLoaded', () => {
    // Example calls (replace with your actual endpoints and titles)
    fetchAndDisplayMovies('Trending Now', ENDPOINTS.trending);
    fetchAndDisplayMovies('Popular Movies', ENDPOINTS.popular);
    fetchAndDisplayMovies('Top Rated', ENDPOINTS.topRated);
    
    // Initialize hero section here if you have that logic
});


// ====================================================================
// ====================== CUSTOM VIDEO PLAYER LOGIC ===================
// ====================================================================

// Elements
const videoModal = document.getElementById('video-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const videoPlayerContainer = document.getElementById('video-player-container');
const videoPlayer = document.getElementById('video-player');
const modalTitle = document.getElementById('modal-title');
const modalOverview = document.getElementById('modal-overview');

// Custom Controls
const playPauseBtn = document.getElementById('play-pause-btn');
const timeDisplay = document.getElementById('time-display');
const progressBar = document.getElementById('progress-bar');
const muteUnmuteBtn = document.getElementById('mute-unmute-btn');
const volumeSlider = document.getElementById('volume-slider');
const fullscreenBtn = document.getElementById('fullscreen-btn');

// Helper function to format time (e.g., 90 seconds -> 1:30)
function formatTime(seconds) {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    // Use Math.max(0, ...) to prevent negative time display if duration is not loaded
    return `${Math.max(0, min)}:${Math.max(0, sec).toString().padStart(2, '0')}`;
}

// --- Video Player Functions ---

function togglePlayPause() {
    if (videoPlayer.paused || videoPlayer.ended) {
        videoPlayer.play();
    } else {
        videoPlayer.pause();
    }
}

function updatePlayPauseIcon() {
    if (videoPlayer.paused || videoPlayer.ended) {
        playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
        videoPlayerContainer.classList.add('paused');
    } else {
        playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
        videoPlayerContainer.classList.remove('paused');
    }
}

function updateProgress() {
    if (isNaN(videoPlayer.duration)) return; // Skip if metadata isn't loaded
    
    const percent = (videoPlayer.currentTime / videoPlayer.duration) * 100;
    progressBar.value = percent;
    
    timeDisplay.textContent = 
        `${formatTime(videoPlayer.currentTime)} / ${formatTime(videoPlayer.duration)}`;
}

function seekVideo() {
    const seekTime = (progressBar.value / 100) * videoPlayer.duration;
    videoPlayer.currentTime = seekTime;
}

function toggleMute() {
    videoPlayer.muted = !videoPlayer.muted;
    updateMuteIcon();
    volumeSlider.value = videoPlayer.muted ? 0 : videoPlayer.volume;
}

function updateMuteIcon() {
    if (videoPlayer.muted || videoPlayer.volume === 0) {
        muteUnmuteBtn.innerHTML = '<i class="fas fa-volume-off"></i>';
    } else if (videoPlayer.volume < 0.5) {
        muteUnmuteBtn.innerHTML = '<i class="fas fa-volume-down"></i>';
    } else {
        muteUnmuteBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
    }
}

function setVolume() {
    videoPlayer.volume = volumeSlider.value;
    videoPlayer.muted = (volumeSlider.value == 0);
    updateMuteIcon();
}

function toggleFullscreen() {
    if (document.fullscreenElement) {
        document.exitFullscreen();
        fullscreenBtn.innerHTML = '<i class="fas fa-expand"></i>';
    } else if (videoPlayerContainer.requestFullscreen) {
        videoPlayerContainer.requestFullscreen();
        fullscreenBtn.innerHTML = '<i class="fas fa-compress"></i>';
    }
}

// --- Event Listeners ---
playPauseBtn.addEventListener('click', togglePlayPause);
videoPlayer.addEventListener('click', togglePlayPause);

// Listeners for video state
videoPlayer.addEventListener('play', updatePlayPauseIcon);
videoPlayer.addEventListener('pause', updatePlayPauseIcon);
videoPlayer.addEventListener('timeupdate', updateProgress);
videoPlayer.addEventListener('loadedmetadata', updateProgress);

// Listeners for custom controls
progressBar.addEventListener('input', seekVideo);
muteUnmuteBtn.addEventListener('click', toggleMute);
volumeSlider.addEventListener('input', setVolume);
fullscreenBtn.addEventListener('click', toggleFullscreen);


// --- Modal & General UI Logic ---

function openVideoModal(movieTitle, movieOverview, videoUrl) {
    modalTitle.textContent = movieTitle;
    modalOverview.textContent = movieOverview;
    videoPlayer.src = videoUrl;
    videoPlayer.load(); 
    
    // Reset controls state
    videoPlayer.volume = volumeSlider.value;
    updateMuteIcon();
    updatePlayPauseIcon();
    
    videoModal.style.display = 'block';
    document.body.style.overflow = 'hidden'; 
    videoPlayer.focus(); // Focus the player for keyboard accessibility
}

function closeVideoModal() {
    videoPlayer.pause(); 
    videoModal.style.display = 'none';
    document.body.style.overflow = ''; 
    // Reset fullscreen if active
    if (document.fullscreenElement) {
        document.exitFullscreen();
    }
}

closeModalBtn.addEventListener('click', closeVideoModal);

// Close modal when clicking outside of the content area
window.addEventListener('click', (event) => {
    if (event.target === videoModal) {
        closeVideoModal();
    }
});
// Keyboard: Close with ESC
window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && videoModal.style.display === 'block') {
        closeVideoModal();
    }
});
