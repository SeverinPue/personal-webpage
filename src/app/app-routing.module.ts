import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import {StartseiteComponent} from "./startseite/startseite.component";
import {ZweiteSeiteComponent} from "./zweite-seite/zweite-seite.component";
import {ErrorPageComponent} from "./error-page/error-page.component";

const routes: Routes = [
  { path: '', component: StartseiteComponent },
  { path: 'zweiteSeite', component: StartseiteComponent },
  { path: 'dritteSeite/a', component: ZweiteSeiteComponent },
  { path: '**', component: ErrorPageComponent },

];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {
}
