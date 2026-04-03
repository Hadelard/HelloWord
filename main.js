document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const views = document.querySelectorAll('.view');
    const loginView = document.getElementById('login-view');
    const signupView = document.getElementById('signup-view');
    const forgotView = document.getElementById('forgot-view');
    const welcomeView = document.getElementById('welcome-view');
    const updatePasswordView = document.getElementById('update-password-view');
    
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const forgotForm = document.getElementById('forgot-form');
    const updatePasswordForm = document.getElementById('update-password-form');
    
    const goToSignup = document.getElementById('go-to-signup');
    const goToLogin = document.getElementById('go-to-login');
    const goToLoginFromUpdate = document.getElementById('go-to-login-from-update');
    const goToForgot = document.getElementById('go-to-forgot');
    const goToLoginFromForgot = document.getElementById('go-to-login-from-forgot');
    const logoutBtn = document.getElementById('logout-btn');
    
    const userNameDisplay = document.getElementById('user-name-display');

    // License Key Elements
    const licenseKeySection = document.getElementById('license-key-section');
    const licenseKeyInput = document.getElementById('license-key-input');
    const verifyKeyBtn = document.getElementById('verify-key-btn');
    const keyErrorMsg = document.getElementById('key-error-msg');
    const openDotartBtn = document.getElementById('open-dotart-btn');
    
    let currentAuthEmail = null;

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

    goToForgot.addEventListener('click', (e) => {
        e.preventDefault();
        showView(forgotView);
    });

    goToLoginFromForgot.addEventListener('click', (e) => {
        e.preventDefault();
        showView(loginView);
    });

    if(goToLoginFromUpdate) {
        goToLoginFromUpdate.addEventListener('click', (e) => {
            e.preventDefault();
            showView(loginView);
        });
    }

    // Simulated Authentication - extended with License checks
    function authenticate(name, email) {
        sessionStorage.setItem('is_logged_in', 'true');
        currentAuthEmail = email || null;
        userNameDisplay.textContent = name;
        showView(welcomeView);
        
        // Add a nice animation effect to the welcome text
        userNameDisplay.style.opacity = '0';
        setTimeout(() => {
            userNameDisplay.style.transition = 'opacity 1s ease';
            userNameDisplay.style.opacity = '1';
        }, 500);

        // Security / License Logic
        if (email) {
            const hasAccess = localStorage.getItem('dotart_access_' + email);
            if (hasAccess === 'true') {
                licenseKeySection.style.display = 'none';
                openDotartBtn.style.display = 'inline-flex';
            } else {
                licenseKeySection.style.display = 'block';
                openDotartBtn.style.display = 'none';
                licenseKeyInput.value = '';
                keyErrorMsg.style.display = 'none';
            }
        } else {
            // Unauthenticated/dummy fallback
            licenseKeySection.style.display = 'none';
            openDotartBtn.style.display = 'inline-flex';
        }
    }

    // Supabase Initialization
    const supabaseUrl = 'https://aureuolcaojbhyoubqyr.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1cmV1b2xjYW9qYmh5b3VicXlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4Mjc4NjEsImV4cCI6MjA5MDQwMzg2MX0.p24CEfzJDHINzE5kpmbFrNJxEW2HnwM8JFaB_SN5ukU';
    const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

    // Detect Password Recovery Event
    supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
            showView(updatePasswordView);
        }
    });

    // Update Password Logic
    if(updatePasswordForm) {
        updatePasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newPass = document.getElementById('update-password-input').value;
            const btn = document.getElementById('update-submit-btn');
            
            btn.disabled = true;
            btn.textContent = 'Updating...';
            
            const { error } = await supabase.auth.updateUser({
                password: newPass
            });

            if (error) {
                alert('Erro ao atualizar a senha: ' + error.message);
            } else {
                alert('Senha atualizada com sucesso!');
                showView(loginView);
                updatePasswordForm.reset();
            }
            
            btn.disabled = false;
            btn.textContent = 'Update Password';
        });
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value.trim();
        const pass = document.getElementById('login-password').value;
        const btn = document.getElementById('login-submit-btn');
        const errObj = document.getElementById('login-error-msg');
        
        btn.disabled = true;
        btn.textContent = 'Verifying...';
        errObj.style.display = 'none';

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: pass
            });
            
            if (error) {
                errObj.textContent = 'E-mail ou senha incorretos.';
                errObj.style.display = 'block';
            } else if (data.user) {
                // Obter nome dos metadados se existir, ou do inicio do e-mail
                const authName = data.user.user_metadata?.name || email.split('@')[0];
                authenticate(authName, email);
            }
            
        } catch(ex) {
            console.error("General Login Error:", ex);
            errObj.textContent = 'Não foi possível completar o login. Tente novamente.';
            errObj.style.display = 'block';
        }
        
        btn.disabled = false;
        btn.textContent = 'Continue';
    });

    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('signup-name').value;
        const email = document.getElementById('signup-email').value.trim();
        const pass = document.getElementById('signup-password').value;
        const btn = signupForm.querySelector('button[type="submit"]');
        
        btn.disabled = true;
        btn.textContent = 'Creating...';
        
        try {
            const { data, error } = await supabase.auth.signUp({
                email: email,
                password: pass,
                options: {
                    data: {
                        name: name
                    }
                }
            });

            if (error) {
                alert('Erro ao criar conta: ' + error.message);
            } else {
                authenticate(name, email);
            }
        } catch (ex) {
            console.error("General Signup Error:", ex);
            alert('Não foi possível realizar o cadastro. Tente novamente.');
        }
        
        btn.disabled = false;
        btn.textContent = 'Create Account';
    });

    forgotForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('forgot-email').value;
        const btn = document.getElementById('forgot-submit-btn');
        const msg = document.getElementById('forgot-msg');
        
        btn.disabled = true;
        btn.textContent = 'Sending...';
        
        try {
            const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin,
            });

            msg.style.display = 'block';
            if (error) {
                msg.style.color = '#ff453a';
                msg.textContent = 'Erro ao enviar o e-mail: ' + error.message;
            } else {
                msg.style.color = '#34c759';
                msg.textContent = 'Se este e-mail estiver cadastrado, você receberá um link de instrução.';
            }
        } catch (ex) {
            console.error(ex);
        }
        
        btn.disabled = false;
        btn.textContent = 'Send Reset Link';
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
        
        // Pass the name and email to our existing auth flow
        authenticate(payload.name || payload.given_name || 'Google User', payload.email);
    };

    // --- License Key Logic ---
    
    // Masking input to XXX-XXX-XXX
    licenseKeyInput.addEventListener('input', function(e) {
        let val = e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        if(val.length > 3 && val.length <= 6) {
            val = val.slice(0, 3) + '-' + val.slice(3);
        } else if(val.length > 6) {
            val = val.slice(0, 3) + '-' + val.slice(3, 6) + '-' + val.slice(6, 9);
        }
        e.target.value = val;
    });

    // CSV Validation
    verifyKeyBtn.addEventListener('click', async () => {
        const key = licenseKeyInput.value.trim();
        verifyKeyBtn.textContent = 'Verifying...';
        verifyKeyBtn.disabled = true;
        keyErrorMsg.style.display = 'none';

        try {
            // Read CSV locally/from static host
            const response = await fetch('access.csv');
            if(!response.ok) throw new Error('CSV File not found');
            const csvText = await response.text();
            
            const rows = csvText.split('\n');
            let authorized = false;

            for(let i = 1; i < rows.length; i++) {
                const parts = rows[i].trim().split(',');
                if(parts.length >= 2) {
                    const rowEmail = parts[0].trim();
                    const rowKey = parts[1].trim();
                    
                    if(rowEmail.toLowerCase() === currentAuthEmail.toLowerCase() && rowKey === key) {
                        authorized = true;
                        break;
                    }
                }
            }

            if(authorized) {
                // Save approval to localStorage
                localStorage.setItem('dotart_access_' + currentAuthEmail, 'true');
                licenseKeySection.style.display = 'none';
                openDotartBtn.style.display = 'inline-flex';
            } else {
                keyErrorMsg.textContent = 'Invalid key for this account. Try again.';
                keyErrorMsg.style.display = 'block';
            }
        } catch (err) {
            console.error('Error validating CSV:', err);
            keyErrorMsg.textContent = 'Error checking access database.';
            keyErrorMsg.style.display = 'block';
        } finally {
            verifyKeyBtn.textContent = 'Verify Key';
            verifyKeyBtn.disabled = false;
        }
    });

    // Logout logic
    logoutBtn.addEventListener('click', () => {
        sessionStorage.removeItem('is_logged_in');
        showView(loginView);
        // Clear forms
        loginForm.reset();
        signupForm.reset();
    });
});
