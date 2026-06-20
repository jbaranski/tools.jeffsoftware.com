import { Routes } from '@angular/router';
import { Home } from './pages/home/home';
import { CharacterGenerator } from './pages/character-generator/character-generator';
import { NumberFormatter } from './pages/number-formatter/number-formatter';
import { TpsCalculator } from './pages/tps/tps';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'character-generator', component: CharacterGenerator },
  { path: 'number-formatter', component: NumberFormatter },
  { path: 'tps', component: TpsCalculator }
];
