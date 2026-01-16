# Camila's Remote - React Native App

A true mobile app that runs locally on your phone, with **real device discovery**!

## Setup

1. Install dependencies:
```bash
npm install
```

2. Install Expo CLI globally:
```bash
npm install -g expo-cli
```

3. Start the app:
```bash
npm start
```

4. Scan the QR code with Expo Go app on your phone

## Features

- ✅ Platform selection (Roku, Samsung, Google TV)
- ✅ Local device discovery (works on your Wi-Fi!)
- ✅ D-pad navigation
- ✅ Volume control
- ✅ Back/Home buttons

## Building for Android/iOS

```bash
# Android APK
expo build:android

# iOS
expo build:ios
```

## Why This Works

Unlike the web version, this React Native app runs **directly on your phone**, making HTTP requests to your TV without needing a server in between:

```
[Your Phone] → [Your TV]  ✅ Direct connection!
```
