// ======================================================================================
// 1. AFFILIATE PRODUCT DATA
// All products now point to your single Shopee MyCollection link.
// IMPORTANT: Make sure the image paths (assets/img/...) exist!
// ======================================================================================

const AD_DATA = [
    {
        title: "The Home Cinema Upgrade Kit",
        // >>> YOUR SINGLE SHOPEE COLLECTION LINK <<<
        link: "https://collshp.com/reelroom",
        image: "assets/img/projector.jpg", 
        badge: "Top Pick",
        buttonText: "See the Full Reel Room"
    },
    {
        title: "Must-Have Budget Soundbar",
        // >>> YOUR SINGLE SHOPEE COLLECTION LINK <<<
        link: "https://collshp.com/reelroom",
        image: "assets/img/soundbar.jpg",
        badge: "Best Seller",
        buttonText: "Shop All Gear Now"
    },
    {
        title: "Gourmet Popcorn & Snacks",
        // >>> YOUR SINGLE SHOPEE COLLECTION LINK <<<
        link: "https://collshp.com/reelroom",
        image: "assets/img/popcorn.jpg", 
        badge: "Movie Night Essential",
        buttonText: "Get Snacks and Lights"
    },
    {
        title: "Ambient TV LED Backlights",
        // >>> YOUR SINGLE SHOPEE COLLECTION LINK <<<
        link: "https://collshp.com/reelroom",
        image: "assets/img/led_lights.jpg", 
        badge: "Vibe Setter",
        buttonText: "Start Your Upgrade"
    }
];

// ======================================================================================
// 2. SLIDESHOW LOGIC
// ======================================================================================

let slideIndex = 0;
const slideshowContainer = document.getElementById('affiliate-showcase');
const dotsContainer = document.querySelector('.slide-dots');

// Function to build the slides and dots based on AD_DATA
function createAffiliateSlideshow() {
    // Clear any existing content (good practice)
    slideshowContainer.innerHTML = ''; 
    dotsContainer.innerHTML = '';
    slideIndex = 0; // Reset index on creation

    AD_DATA.forEach((item, index) => {
        // --- Create the Slide Element ---
        const slide = document.createElement('a');
        slide.href = item.link;
        slide.target = "_blank"; 
        slide.className = `affiliate-link-slide fade ${index === 0 ? 'active' : ''}`;
        slide.style.backgroundImage = `url('${item.image}')`;

        // Create the caption and CTA
        slide.innerHTML = `
            <div class="affiliate-caption">
                <span class="affiliate-badge">${item.badge}</span>
                <h2>${item.title}</h2>
                <button class="cta-button">${item.buttonText}</button>
            </div>
        `;
        slideshowContainer.appendChild(slide);

        // --- Create Navigation Dot ---
        const dot = document.createElement('span');
        dot.className = `slide-dot ${index === 0 ? 'active' : ''}`;
        dot.addEventListener('click', () => currentSlide(index));
        dotsContainer.appendChild(dot);
    });

    showSlides(slideIndex);
}

// Core function to control which slide is visible
function showSlides(n) {
    const slides = document.getElementsByClassName("affiliate-link-slide");
    const dots = document.getElementsByClassName("slide-dot");

    if (slides.length === 0) return; // Exit if no slides exist

    // Wrap around logic
    if (n >= slides.length) { slideIndex = 0 }
    if (n < 0) { slideIndex = slides.length - 1 }

    // Hide all, remove active class
    for (let i = 0; i < slides.length; i++) {
        slides[i].style.display = "none";
        slides[i].classList.remove('active');
        dots[i].classList.remove('active');
    }

    // Show the active one
    slides[slideIndex].style.display = "block";
    slides[slideIndex].classList.add('active');
    dots[slideIndex].classList.add('active');
}

// Functions for manual navigation (called by arrows)
function plusSlides(n) {
    showSlides(slideIndex += n);
}

function currentSlide(n) {
    showSlides(slideIndex = n);
}

// Attach navigation event listeners only after DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize the slideshow
    createAffiliateSlideshow();

    // Attach arrow listeners
    document.querySelector('.prev-slide').addEventListener('click', () => plusSlides(-1));
    document.querySelector('.next-slide').addEventListener('click', () => plusSlides(1));

    // Optional: Auto-Advance Slides (4 seconds)
    // Note: This relies on the global 'plusSlides' being available
    setInterval(() => plusSlides(1), 4000); 
});
