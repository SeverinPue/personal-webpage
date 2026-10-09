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
  public isConfigured: boolean = false;
  public allowedEmails: string[] = environment.allowedEmails;

  constructor(
    public authService: AuthService,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    this.isConfigured = !environment.googleClientId.startsWith('YOUR_GOOGLE');
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
        },
        auto_select: false,
        cancel_on_tap_outside: true
      });

      if (this.googleBtnRef && this.googleBtnRef.nativeElement) {
        google.accounts.id.renderButton(this.googleBtnRef.nativeElement, {
          theme: 'filled_blue',
          size: 'large',
          text: 'signin_with',
          shape: 'rectangular',
          logo_alignment: 'left',
          width: 280
        });
      }
    } else {
      // Retry in 300ms if Google script is still loading
      setTimeout(() => this.initGoogleSignIn(), 300);
    }
  }
}
