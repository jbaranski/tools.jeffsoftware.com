import { Routes } from '@angular/router';
import { Home } from './pages/home/home';
import { UsernameGenerator } from './pages/username-generator/username-generator';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'username-generator', component: UsernameGenerator },
];
