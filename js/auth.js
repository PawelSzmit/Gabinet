/* ===========================================
   Auth - Google OAuth 2.0
   =========================================== */

const Auth = (() => {
  const GOOGLE_CLIENT_ID = CONFIG.GOOGLE_CLIENT_ID;
  const GOOGLE_API_KEY = CONFIG.GOOGLE_API_KEY;
  const SCOPES = 'https://www.googleapis.com/auth/drive.file';

  let tokenClient = null;
  let accessToken = null;
  let userEmail = '';
  let onLoginCallback = null;
  let onLogoutCallback = null;

  function init(onLogin, onLogout) {
    onLoginCallback = onLogin;
    onLogoutCallback = onLogout;

    // Always initialize tokenClient so token refresh works after page reload
    initTokenClient();

    const savedToken = localStorage.getItem('gabinet_access_token');
    const savedEmail = localStorage.getItem('gabinet_user_email');
    const tokenExpiry = localStorage.getItem('gabinet_token_expiry');

    if (savedToken && tokenExpiry && Date.now() < parseInt(tokenExpiry, 10)) {
      accessToken = savedToken;
      userEmail = savedEmail || '';
      initGapiClient().then(() => {
        if (onLoginCallback) onLoginCallback();
      });
    }

    document.getElementById('btn-google-login').addEventListener('click', handleLogin);
    document.getElementById('btn-logout').addEventListener('click', handleLogout);
  }

  async function initGapiClient() {
    return new Promise((resolve, reject) => {
      if (typeof gapi === 'undefined') {
        reject(new Error('Google API not loaded'));
        return;
      }
      gapi.load('client', async () => {
        try {
          await gapi.client.init({
            apiKey: GOOGLE_API_KEY,
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
          });
          if (accessToken) {
            gapi.client.setToken({ access_token: accessToken });
          }
          resolve();
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  function initTokenClient() {
    if (typeof google === 'undefined' || !google.accounts) return;
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPES,
      callback: handleTokenResponse,
    });
  }

  function handleLogin() {
    if (!tokenClient) {
      initTokenClient();
    }
    if (tokenClient) {
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
      Utils.showToast('Nie można załadować Google API. Sprawdź połączenie.', 'error');
    }
  }

  async function handleTokenResponse(response) {
    if (response.error) {
      Utils.showToast('Błąd autoryzacji: ' + response.error, 'error');
      return;
    }

    accessToken = response.access_token;
    const expiresIn = response.expires_in || 3600;
    const expiryTime = Date.now() + expiresIn * 1000;

    localStorage.setItem('gabinet_access_token', accessToken);
    localStorage.setItem('gabinet_token_expiry', expiryTime.toString());

    try {
      await initGapiClient();
      gapi.client.setToken({ access_token: accessToken });

      const userInfo = await fetchUserEmail();
      userEmail = userInfo;
      localStorage.setItem('gabinet_user_email', userEmail);

      if (onLoginCallback) onLoginCallback();
    } catch (err) {
      Utils.showToast('Błąd inicjalizacji: ' + err.message, 'error');
    }
  }

  async function fetchUserEmail() {
    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const data = await response.json();
      return data.email || '';
    } catch {
      return '';
    }
  }

  function handleLogout() {
    if (accessToken && google.accounts && google.accounts.oauth2) {
      google.accounts.oauth2.revoke(accessToken);
    }
    accessToken = null;
    userEmail = '';
    localStorage.removeItem('gabinet_access_token');
    localStorage.removeItem('gabinet_user_email');
    localStorage.removeItem('gabinet_token_expiry');
    if (gapi.client) {
      gapi.client.setToken(null);
    }
    if (onLogoutCallback) onLogoutCallback();
  }

  function getToken() {
    return accessToken;
  }

  function getUserEmail() {
    return userEmail;
  }

  function isLoggedIn() {
    if (!accessToken) return false;
    const expiry = localStorage.getItem('gabinet_token_expiry');
    if (expiry && Date.now() >= parseInt(expiry, 10)) {
      refreshToken();
      return false;
    }
    return true;
  }

  function refreshToken() {
    if (tokenClient) {
      tokenClient.requestAccessToken({ prompt: '' });
    }
  }

  async function ensureValidToken() {
    const expiry = localStorage.getItem('gabinet_token_expiry');
    if (expiry && Date.now() >= parseInt(expiry, 10) - 60000) {
      // Token expired or about to expire — refresh it
      if (!tokenClient) {
        initTokenClient();
      }
      if (!tokenClient) {
        // Google Identity Services not loaded yet — can't refresh
        return;
      }

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          resolve(); // don't block forever, proceed with current token
        }, 10000);

        tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: SCOPES,
          callback: async (response) => {
            clearTimeout(timeout);
            if (response.error) {
              reject(new Error('Token refresh failed: ' + response.error));
            } else {
              await handleTokenResponse(response);
              resolve();
            }
          },
          error_callback: (err) => {
            clearTimeout(timeout);
            resolve(); // proceed with current token
          }
        });
        tokenClient.requestAccessToken({ prompt: '' });
      });
    }
  }

  return {
    init,
    getToken,
    getUserEmail,
    isLoggedIn,
    ensureValidToken,
    handleLogout
  };
})();
