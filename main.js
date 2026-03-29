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
    const googleLoginBtn = document.querySelector('.btn-google');

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

    // Google Login Simulated
    googleLoginBtn.addEventListener('click', () => {
        // Simulate a popup/delay
        googleLoginBtn.textContent = 'Connecting...';
        googleLoginBtn.disabled = true;
        
        setTimeout(() => {
            authenticate('Google User');
            googleLoginBtn.textContent = 'Sign in with Google';
            googleLoginBtn.disabled = false;
        }, 1500);
    });

    // Logout logic
    logoutBtn.addEventListener('click', () => {
        showView(loginView);
        // Clear forms
        loginForm.reset();
        signupForm.reset();
    });
});
