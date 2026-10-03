/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/** Build stamp, substituted by the `define` block in `vite.config.ts`. */
declare const __APP_COMMIT__: string;
declare const __APP_COMMIT_DATE__: string;

interface ImportMetaEnv {
  /** OAuth client for the optional Drive sync – unset hides the feature entirely. */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}

/**
 * The slice of Google Identity Services the sync uses. The script is loaded on
 * demand (`stores/sync.ts`), so these exist only after that.
 */
declare namespace google.accounts.oauth2 {
  interface TokenResponse {
    access_token: string;
    expires_in: number;
    scope: string;
    error?: string;
  }

  interface ClientConfigError {
    type: string;
    message: string;
  }

  interface TokenClient {
    requestAccessToken(override?: { prompt?: string; login_hint?: string }): void;
  }

  function initTokenClient(config: {
    client_id: string;
    scope: string;
    callback: (response: TokenResponse) => void;
    error_callback?: (error: ClientConfigError) => void;
  }): TokenClient;

  function hasGrantedAllScopes(response: TokenResponse, ...scopes: string[]): boolean;

  function revoke(token: string, done?: () => void): void;
}
