import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { StartseiteComponent } from './startseite/startseite.component';
import { UeberMichComponent } from './ueber-mich/ueber-mich.component';
import { ErrorPageComponent } from './error-page/error-page.component';
import { MisterXComponent } from './mister-x/mister-x.component';
import { ConveniatGameComponent } from './conveniat-game/conveniat-game.component';

const routes: Routes = [
  { path: '', component: StartseiteComponent },
  { path: 'ueber-mich', component: UeberMichComponent },
  { path: 'misterx', component: MisterXComponent },
  { path: 'conveniat-game', component: ConveniatGameComponent },
  { path: 'conveniat', redirectTo: 'conveniat-game', pathMatch: 'full' },
  { path: 'conveniat game', redirectTo: 'conveniat-game', pathMatch: 'full' },
  { path: 'conveniat27', redirectTo: 'conveniat-game', pathMatch: 'full' },
  { path: 'zweiteSeite', redirectTo: 'ueber-mich', pathMatch: 'full' },
  { path: '**', component: ErrorPageComponent },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {
}
