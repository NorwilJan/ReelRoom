// --- PWA Service Worker Registration & Installation Prompt ---

let deferredInstallPrompt = null;
const installButton = document.getElementById('install-button');

// 1. Register the Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/sw.js').then(function(registration) {
      console.log('ServiceWorker registration successful with scope: ', registration.scope);
    }, function(err) {
      console.log('ServiceWorker registration failed: ', err);
    });
  });
}

// 2. Handle the PWA Install Prompt
window.addEventListener('beforeinstallprompt', (event) => {
  // Prevent the default browser prompt
  event.preventDefault();
  // Stash the event so it can be triggered later
  deferredInstallPrompt = event;
  // Show the install button
  installButton.style.display = 'block';
});

installButton.addEventListener('click', () => {
  if (deferredInstallPrompt) {
    // Show the prompt
    deferredInstallPrompt.prompt();
    // Wait for the user to respond to the prompt
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

// 3. Optional: Hide the install button if the app is already installed
window.addEventListener('appinstalled', () => {
  installButton.style.display = 'none';
  console.log('ReelRoom PWA installed successfully!');
});

// -------------------------------------------------------------------
