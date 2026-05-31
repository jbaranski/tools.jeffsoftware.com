import { Routes } from '@angular/router';
import { Home } from './pages/home/home';
import { UsernameGenerator } from './pages/username-generator/username-generator';
import { NumberFormatter } from './pages/number-formatter/number-formatter';
import { TpsCalculator } from './pages/tps/tps';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'username-generator', component: UsernameGenerator },
  { path: 'number-formatter', component: NumberFormatter },
  { path: 'tps', component: TpsCalculator },
];
