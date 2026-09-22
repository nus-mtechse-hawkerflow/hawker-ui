export const environment = {
  production: false,
  hawkerApiUrl: 'http://localhost:8080/hawkerflow',
  orderApiUrl: 'http://localhost:8082/hawkerflow',
  cognito: {
    userPoolId: 'us-east-1_37febeb9771f42e193f427f1b4e88865', // Replace with your AWS Cognito User Pool ID
    userPoolClientId: 'v9duyajd3az55r8ou9rkkp8b9j', // Replace with your AWS Cognito App Client ID
    region: 'ap-southeast-1',
    signUpVerificationMethod: 'code' as const
  }
};

