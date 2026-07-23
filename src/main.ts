import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
// Change this line in main.ts:
import { AppComponent } from './app/app';

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
