import { bootstrapApplication } from '@angular/platform-browser';
import { Amplify } from 'aws-amplify';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { environment } from './environments/environment';

// Configure AWS Amplify Auth with Cognito
try {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolEndpoint: "http://localhost.localstack.cloud:4566",
        userPoolId: environment.cognito.userPoolId,
        userPoolClientId: environment.cognito.userPoolClientId,
        signUpVerificationMethod: environment.cognito.signUpVerificationMethod,
        loginWith: {
          email: true
        }
      }
    }
  });
} catch (err) {
  console.warn('Amplify configuration warning:', err);
}

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
