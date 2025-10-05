// Service Account Authentication for Google Sheets
// This handles server-side authentication without user login

class ServiceAccountAuth {
  constructor() {
    // Service account credentials
    this.serviceAccountKey = import.meta.env.VITE_GOOGLE_SERVICE_ACCOUNT_KEY;
    this.scopes = ['https://www.googleapis.com/auth/spreadsheets'];
    
    this.accessToken = null;
    this.tokenExpiry = null;
    this.credentials = null;
    
    // Parse service account key if provided
    if (this.serviceAccountKey) {
      try {
        this.credentials = JSON.parse(this.serviceAccountKey);
      } catch (error) {
        console.error('Failed to parse service account key:', error);
      }
    }
  }

  // Import crypto library for JWT signing
  async importCryptoKey(privateKey) {
    // Remove header/footer and clean up the key
    const cleanKey = privateKey
      .replace(/-----BEGIN PRIVATE KEY-----/, '')
      .replace(/-----END PRIVATE KEY-----/, '')
      .replace(/\n/g, '')
      .trim();

    // Convert to binary
    const binaryDer = Uint8Array.from(atob(cleanKey), c => c.charCodeAt(0));

    // Import the key for signing
    return await crypto.subtle.importKey(
      'pkcs8',
      binaryDer,
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-256'
      },
      false,
      ['sign']
    );
  }

  // Base64 URL encode
  base64UrlEncode(str) {
    return btoa(str)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  // Create and sign JWT token
  async createSignedJWT() {
    if (!this.credentials) {
      throw new Error('Service account credentials not configured');
    }

    const header = {
      alg: 'RS256',
      typ: 'JWT'
    };

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: this.credentials.client_email,
      scope: this.scopes.join(' '),
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600, // 1 hour
      iat: now
    };

    // Encode header and payload
    const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
    const encodedPayload = this.base64UrlEncode(JSON.stringify(payload));
    
    // Create the data to sign
    const dataToSign = `${encodedHeader}.${encodedPayload}`;
    
    try {
      // Import the private key for signing
      const cryptoKey = await this.importCryptoKey(this.credentials.private_key);
      
      // Sign the data
      const signature = await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5',
        cryptoKey,
        new TextEncoder().encode(dataToSign)
      );
      
      // Encode the signature
      const encodedSignature = this.base64UrlEncode(
        String.fromCharCode(...new Uint8Array(signature))
      );
      
      // Return the complete JWT
      return `${dataToSign}.${encodedSignature}`;
    } catch (error) {
      console.error('JWT signing failed:', error);
      throw new Error(`JWT signing failed: ${error.message}`);
    }
  }

  // Get access token using service account JWT
  async getAccessTokenViaJWT() {
    if (!this.credentials) {
      throw new Error('Service account credentials not configured. Please set VITE_GOOGLE_SERVICE_ACCOUNT_KEY');
    }

    try {
      const jwt = await this.createSignedJWT();
      
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`OAuth2 token request failed: ${response.status} - ${errorData.error_description || response.statusText}`);
      }

      const data = await response.json();
      return data.access_token;
    } catch (error) {
      console.error('Service account authentication failed:', error);
      throw new Error(`Service account authentication failed: ${error.message}`);
    }
  }

  // Get current access token
  async getAccessToken() {
    if (!this.accessToken || this.isTokenExpired()) {
      this.accessToken = await this.getAccessTokenViaJWT();
      this.tokenExpiry = Date.now() + (3600 * 1000); // 1 hour from now
    }
    
    return this.accessToken;
  }

  // Check if token is expired
  isTokenExpired() {
    return this.tokenExpiry && Date.now() >= this.tokenExpiry;
  }

  // Make authenticated request to Google Sheets API
  async makeAuthenticatedRequest(url, options = {}) {
    const token = await this.getAccessToken();
    
    // Use Bearer token authentication for service account
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
      throw new Error(error.error?.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  // Check if service account is configured
  isConfigured() {
    return !!this.credentials && !!this.credentials.client_email && !!this.credentials.private_key;
  }

  // Get service account email for display
  getServiceAccountEmail() {
    return this.credentials?.client_email || 'Unknown';
  }
}

export default new ServiceAccountAuth();
