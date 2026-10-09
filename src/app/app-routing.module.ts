import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { StartseiteComponent } from './startseite/startseite.component';
import { UeberMichComponent } from './ueber-mich/ueber-mich.component';
import { ErrorPageComponent } from './error-page/error-page.component';

const routes: Routes = [
  { path: '', component: StartseiteComponent },
  { path: 'ueber-mich', component: UeberMichComponent },
  { path: 'zweiteSeite', redirectTo: 'ueber-mich', pathMatch: 'full' },
  { path: '**', component: ErrorPageComponent },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {
}
