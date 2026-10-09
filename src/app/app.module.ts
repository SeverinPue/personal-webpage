import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { StartseiteComponent } from './startseite/startseite.component';
import { ZweiteSeiteComponent } from './zweite-seite/zweite-seite.component';
import { UeberMichComponent } from './ueber-mich/ueber-mich.component';
import { ErrorPageComponent } from './error-page/error-page.component';
import { LoginGateComponent } from './login-gate/login-gate.component';

@NgModule({
  declarations: [
    AppComponent,
    StartseiteComponent,
    ZweiteSeiteComponent,
    UeberMichComponent,
    ErrorPageComponent,
    LoginGateComponent,
  ],
  imports: [
    BrowserModule,
    FormsModule,
    AppRoutingModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
