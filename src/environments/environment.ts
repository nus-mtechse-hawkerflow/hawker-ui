export const environment = {
  production: true,
  hawkerApiUrl: 'http://localhost:8080/hawkerflow',
  orderApiUrl: 'http://localhost:8082/hawkerflow',
  analyticsApiUrl: 'http://hlc8hi5wup.execute-api.localhost.localstack.cloud:4566/local/hawkerflow',
  cognito: {
    userPoolId: 'ap-southeast-1_1ef6e4aab1e341d18c2c8dbab2d0fdc4',
    userPoolClientId: '3eu9pkfbdzj1zw3ouxtu1ye0bc',
    region: 'ap-southeast-1',
    signUpVerificationMethod: 'code' as const
  }
};
