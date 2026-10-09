import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AuthUser {
  email: string;
  name: string;
  picture?: string;
  given_name?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly STORAGE_KEY = 'severin_webpage_user';
  private currentUserSubject: BehaviorSubject<AuthUser | null>;
  public currentUser$: Observable<AuthUser | null>;

  constructor(private ngZone: NgZone) {
    const saved = this.loadSavedUser();
    this.currentUserSubject = new BehaviorSubject<AuthUser | null>(saved);
    this.currentUser$ = this.currentUserSubject.asObservable();
  }

  public get currentUserValue(): AuthUser | null {
    return this.currentUserSubject.value;
  }

  public get isAuthenticated(): boolean {
    return !!this.currentUserSubject.value;
  }

  private loadSavedUser(): AuthUser | null {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      if (data) {
        const user: AuthUser = JSON.parse(data);
        if (this.isEmailAllowed(user.email)) {
          return user;
        }
      }
    } catch (e) {
      console.error('Failed to load user from storage', e);
    }
    return null;
  }

  public isEmailAllowed(email: string): boolean {
    if (!email) return false;
    const cleanEmail = email.trim().toLowerCase();
    const allowed = environment.allowedEmails.map(e => e.trim().toLowerCase());
    return allowed.includes(cleanEmail);
  }

  /**
   * Decodes Google ID Token (JWT) and validates the user email
   */
  public handleGoogleCredential(credential: string): { success: boolean; error?: string } {
    try {
      const payloadBase64 = credential.split('.')[1];
      const decodedJson = atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/'));
      const payload = JSON.parse(decodeURIComponent(escape(decodedJson)));

      const email = payload.email || '';
      if (!this.isEmailAllowed(email)) {
        return {
          success: false,
          error: `Zugriff verweigert: Das Google-Konto "${email}" ist nicht berechtigt. Nur Severins Google-Konto hat Zugriff.`
        };
      }

      const user: AuthUser = {
        email: payload.email,
        name: payload.name || payload.given_name || 'Severin',
        picture: payload.picture,
        given_name: payload.given_name
      };

      this.ngZone.run(() => {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(user));
        this.currentUserSubject.next(user);
      });

      return { success: true };
    } catch (err: any) {
      console.error('Failed to parse Google credential', err);
      return { success: false, error: 'Ungültiges Google-Anmeldetoken.' };
    }
  }

  /**
   * Developer login for testing without needing Google Cloud OAuth configured
   */
  public devLogin(email: string): { success: boolean; error?: string } {
    const cleanEmail = email.trim().toLowerCase();
    if (!this.isEmailAllowed(cleanEmail)) {
      return {
        success: false,
        error: `Zugriff verweigert: "${email}" ist nicht in der Liste der erlaubten E-Mails.`
      };
    }

    const user: AuthUser = {
      email: cleanEmail,
      name: 'Severin Püntener',
      picture: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
      given_name: 'Severin'
    };

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(user));
    this.currentUserSubject.next(user);
    return { success: true };
  }

  public logout(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    this.currentUserSubject.next(null);
  }
}
