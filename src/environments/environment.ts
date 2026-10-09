export const environment = {
  production: false,
  // Google Cloud OAuth 2.0 Web Client-ID (https://console.cloud.google.com/apis/credentials)
  googleClientId: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com',
  // Nur diese Google-Konten dürfen die Webseite betreten:
  allowedEmails: [
    'severin.puentener@gmail.com',
    'severin.puentener@gmx.ch',
    'severinp@szn.ch'
  ]
};
