import { Component, OnInit, AfterViewInit, ElementRef, ViewChild, NgZone } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';

declare const google: any;

@Component({
  selector: 'app-login-gate',
  templateUrl: './login-gate.component.html',
  styleUrls: ['./login-gate.component.scss']
})
export class LoginGateComponent implements OnInit, AfterViewInit {

  @ViewChild('googleBtn', { static: false })
  private googleBtnRef!: ElementRef;

  public errorMessage: string | null = null;
  public testEmail: string = 'severin.puentener@gmail.com';
  public hasGoogleClientId: boolean = false;

  constructor(
    public authService: AuthService,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    this.hasGoogleClientId = !environment.googleClientId.startsWith('YOUR_GOOGLE');
  }

  ngAfterViewInit(): void {
    this.initGoogleSignIn();
  }

  private initGoogleSignIn(): void {
    if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
      google.accounts.id.initialize({
        client_id: environment.googleClientId,
        callback: (response: any) => {
          this.ngZone.run(() => {
            const res = this.authService.handleGoogleCredential(response.credential);
            if (!res.success) {
              this.errorMessage = res.error || 'Fehler beim Google-Login.';
            } else {
              this.errorMessage = null;
            }
          });
        }
      });

      if (this.googleBtnRef && this.googleBtnRef.nativeElement) {
        google.accounts.id.renderButton(this.googleBtnRef.nativeElement, {
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
          shape: 'rectangular',
          logo_alignment: 'left',
          width: 280
        });
      }
    } else {
      // Retry in 500ms if script is still loading
      setTimeout(() => this.initGoogleSignIn(), 500);
    }
  }

  public onDevLoginSubmit(e: Event): void {
    e.preventDefault();
    this.errorMessage = null;
    const res = this.authService.devLogin(this.testEmail);
    if (!res.success) {
      this.errorMessage = res.error || 'Login fehlgeschlagen.';
    }
  }
}
