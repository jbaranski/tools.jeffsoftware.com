import { Routes } from '@angular/router';
import { Home } from './pages/home/home';
import { CharacterGenerator } from './pages/character-generator/character-generator';
import { NumberFormatter } from './pages/number-formatter/number-formatter';
import { TpsCalculator } from './pages/tps/tps';
import { ByteSizeCalculator } from './pages/byte-size/byte-size';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'character-generator', component: CharacterGenerator },
  { path: 'number-formatter', component: NumberFormatter },
  { path: 'tps', component: TpsCalculator },
  { path: 'byte-size', component: ByteSizeCalculator },
  {
    path: 'ical-viewer',
    loadComponent: () => import('./pages/ical-viewer/ical-viewer').then((m) => m.ICalViewer)
  },
  {
    path: 'bayes',
    loadComponent: () => import('./pages/bayes/bayes').then((m) => m.BayesExperiments)
  },
  {
    path: 'mermaid-diagram',
    loadComponent: () => import('./pages/mermaid-diagram/mermaid-diagram').then((m) => m.MermaidDiagram)
  },
  {
    path: 'combinatorics',
    loadComponent: () => import('./pages/combinatorics/combinatorics').then((m) => m.Combinatorics)
  }
];
