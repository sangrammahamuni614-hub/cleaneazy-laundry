# CleanEazy Laundry for Android

This Android app wraps the published CleanEazy Laundry software at:

https://sangrammahamuni614-hub.github.io/cleaneazy-laundry/software/

The app requires an internet connection because customer, order and billing data use the hosted web app and Supabase. Login credentials are not hard-coded in the APK.

## Build

From this directory, run:

```bash
gradle --no-daemon assembleDebug
```

The installable debug APK is generated at:

`app/build/outputs/apk/debug/app-debug.apk`

The GitHub Actions workflow builds and publishes the APK as a downloadable workflow artifact.
