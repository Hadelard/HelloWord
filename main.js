document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const views = document.querySelectorAll('.view');
    const loginView = document.getElementById('login-view');
    const signupView = document.getElementById('signup-view');
    const welcomeView = document.getElementById('welcome-view');
    
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    
    const goToSignup = document.getElementById('go-to-signup');
    const goToLogin = document.getElementById('go-to-login');
    const logoutBtn = document.getElementById('logout-btn');
    
    const userNameDisplay = document.getElementById('user-name-display');

    // Navigation logic
    function showView(viewToShow) {
        views.forEach(view => {
            view.classList.remove('active');
            // Small delay to allow display: none to be replaced before opacity kicks in
            // but we use CSS transition on active class which handles display/opacity
        });
        
        // Wait for the previous view to fade out slightly
        setTimeout(() => {
            viewToShow.classList.add('active');
        }, 50);
    }

    // Switch between Login and Signup
    goToSignup.addEventListener('click', (e) => {
        e.preventDefault();
        showView(signupView);
    });

    goToLogin.addEventListener('click', (e) => {
        e.preventDefault();
        showView(loginView);
    });

    // Simulated Authentication
    function authenticate(name) {
        userNameDisplay.textContent = name;
        showView(welcomeView);
        
        // Add a nice animation effect to the welcome text
        userNameDisplay.style.opacity = '0';
        setTimeout(() => {
            userNameDisplay.style.transition = 'opacity 1s ease';
            userNameDisplay.style.opacity = '1';
        }, 500);
    }

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const nameFromEmail = email.split('@')[0];
        // Capitalize first letter
        const formattedName = nameFromEmail.charAt(0).toUpperCase() + nameFromEmail.slice(1);
        
        authenticate(formattedName);
    });

    signupForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('signup-name').value;
        authenticate(name);
    });

    // Real Google JWT Callback (must be globally accessible)
    window.handleCredentialResponse = function(response) {
        // Decode the JWT Payload sent by Google
        let base64Url = response.credential.split('.')[1];
        let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        let jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        
        let payload = JSON.parse(jsonPayload);
        
        // Pass the name to our existing auth flow
        authenticate(payload.name || payload.given_name || 'Google User');
    };

    // Logout logic
    logoutBtn.addEventListener('click', () => {
        showView(loginView);
        // Clear forms
        loginForm.reset();
        signupForm.reset();
    });
});
