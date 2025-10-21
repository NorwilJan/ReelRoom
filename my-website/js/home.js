document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('movieModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalPoster = document.getElementById('modalPoster');
    const modalVideo = document.getElementById('modalVideo');
    const closeBtn = document.querySelector('.close-btn');

    // 1. Open Modal when a poster is clicked
    document.querySelectorAll('.poster-item').forEach(item => {
        item.addEventListener('click', function() {
            const title = this.getAttribute('data-title');
            const videoUrl = this.getAttribute('data-video-url');
            const posterUrl = this.getAttribute('data-poster-url');

            // Update modal content
            modalTitle.textContent = title;
            
            // Set the poster image in the modal 
            modalPoster.src = posterUrl;
            
            // Set the video source and poster attribute for the player
            modalVideo.src = videoUrl;
            modalVideo.setAttribute('poster', posterUrl);
            
            // Display the modal
            modal.style.display = 'block';
        });
    });

    // 2. Close Modal when 'x' is clicked
    closeBtn.addEventListener('click', () => {
        closeModal();
    });

    // 3. Close Modal when clicking outside of it
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeModal();
        }
    });

    // 4. Function to close the modal and stop the video
    function closeModal() {
        // Stop the video playback
        modalVideo.pause(); 
        modalVideo.currentTime = 0; // Rewind the video
        
        // Hide the modal
        modal.style.display = 'none';
    }
});
