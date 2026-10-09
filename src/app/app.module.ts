import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { StartseiteComponent } from './startseite/startseite.component';
import { ZweiteSeiteComponent } from './zweite-seite/zweite-seite.component';
import { UeberMichComponent } from './ueber-mich/ueber-mich.component';
import { ErrorPageComponent } from './error-page/error-page.component';
import { MisterXComponent } from './mister-x/mister-x.component';

@NgModule({
  declarations: [
    AppComponent,
    StartseiteComponent,
    ZweiteSeiteComponent,
    UeberMichComponent,
    ErrorPageComponent,
    MisterXComponent,
  ],
  imports: [
    BrowserModule,
    CommonModule,
    FormsModule,
    AppRoutingModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
