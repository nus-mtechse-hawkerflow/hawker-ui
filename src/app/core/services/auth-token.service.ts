import { Injectable } from '@angular/core';
import { fetchAuthSession } from 'aws-amplify/auth';

@Injectable({
  providedIn: 'root'
})
export class AuthTokenService {
  /**
   * The signed-in hawker's Cognito access token, or null when nobody is signed
   * in. Amplify refreshes an expired token here, so callers should ask for it
   * per request rather than keep a copy.
   */
  async getAccessToken(): Promise<string | null> {
    try {
      const session = await fetchAuthSession();
      return session.tokens?.accessToken?.toString() ?? null;
    } catch {
      return null;
    }
  }
}
