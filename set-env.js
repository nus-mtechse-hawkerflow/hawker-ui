const fs = require('fs');

// Writes the production environment file from environment variables, so the
// deployment's addresses and Cognito IDs are supplied at build time instead of
// being committed. hawkerflow-terraform/scripts/release-frontend.sh sets these
// from `terraform output`.
const required = [
  'HAWKER_API_URL',
  'ORDER_API_URL',
  'ANALYTICS_API_URL',
  'COGNITO_ENDPOINT',
  'COGNITO_USER_POOL_ID',
  'COGNITO_CLIENT_ID',
  'AWS_REGION'
];

const missing = required.filter(name => !process.env[name]);
if (missing.length > 0) {
  console.error(`set-env: missing environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const envConfigFile = `export const environment = {
  production: true,
  hawkerApiUrl: '${process.env.HAWKER_API_URL}',
  orderApiUrl: '${process.env.ORDER_API_URL}',
  analyticsApiUrl: '${process.env.ANALYTICS_API_URL}',
  cognito: {
    endpoint: '${process.env.COGNITO_ENDPOINT}',
    userPoolId: '${process.env.COGNITO_USER_POOL_ID}',
    userPoolClientId: '${process.env.COGNITO_CLIENT_ID}',
    region: '${process.env.AWS_REGION}',
    signUpVerificationMethod: 'code' as const
  }
};
`;

fs.writeFileSync('./src/environments/environment.ts', envConfigFile);
