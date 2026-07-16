# Smart Bus — Driver Android App Build Guide

The Driver module needs true background GPS while the phone is locked or another app is open. A plain PWA cannot guarantee that; the app must be packaged as an Android APK using **Capacitor** plus a foreground location service.

This project already ships the Capacitor config (`capacitor.config.ts`) and the web build. Follow these steps on a workstation with **Android Studio + JDK 17 + Android SDK** installed — the Lovable sandbox cannot compile APKs.

## 1. Install Capacitor dependencies (one time)

```bash
bun add @capacitor/core @capacitor/cli @capacitor/android
# Background geolocation with an Android foreground service:
bun add @capacitor-community/background-geolocation
```

## 2. Build the web bundle and add Android platform

```bash
bun run build           # emits .output/public
npx cap add android     # creates /android on first run
npx cap sync android
```

## 3. Android permissions

Edit `android/app/src/main/AndroidManifest.xml` and add inside `<manifest>`:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
```

The community plugin registers its own `BackgroundLocationService` (a `foregroundServiceType="location"` service) — no extra `<service>` block is required.

## 4. Start background tracking from the Driver page

In `src/routes/driver.tsx`, when the driver taps **Start trip**, call the plugin instead of (or in addition to) `navigator.geolocation.watchPosition`:

```ts
import { BackgroundGeolocation } from "@capacitor-community/background-geolocation";

const watcherId = await BackgroundGeolocation.addWatcher(
  {
    backgroundMessage: "Smart Bus — trip tracking active",
    backgroundTitle: "Smart Bus Driver",
    requestPermissions: true,
    stale: false,
    distanceFilter: 10,
  },
  (location, error) => {
    if (error) return;
    if (!location) return;
    // reuse existing sendLocation(): trip_id, driver_id, bus_id + lat/lng/speed/heading/accuracy
  },
);

// On End Trip:
await BackgroundGeolocation.removeWatcher({ id: watcherId });
```

The plugin keeps a persistent notification and uses Android's **Fused Location Provider** — location keeps flowing when the screen is off, the app is backgrounded, or the WebView is paused.

## 5. Battery-optimization guidance

On Start Trip, show a one-time prompt telling the driver to:
1. Grant **Location → Allow all the time**.
2. Grant **Notifications**.
3. Disable **Battery optimization** for Smart Bus Driver (`Settings → Apps → Smart Bus Driver → Battery → Unrestricted`).

## 6. Debug APK

```bash
npx cap sync android
cd android
./gradlew assembleDebug
# → android/app/build/outputs/apk/debug/app-debug.apk
```

Sideload with `adb install app-debug.apk`.

## 7. Signed release APK / AAB

```bash
# Create a keystore once and store it OUTSIDE the repo:
keytool -genkey -v -keystore ~/keystores/smartbus-driver.jks \
  -alias smartbus -keyalg RSA -keysize 2048 -validity 10000
```

Add to `android/keystore.properties` (git-ignored):

```
storeFile=/absolute/path/to/smartbus-driver.jks
storePassword=***
keyAlias=smartbus
keyPassword=***
```

Wire it up in `android/app/build.gradle` (`signingConfigs.release`), then:

```bash
./gradlew assembleRelease   # signed APK
./gradlew bundleRelease     # AAB for Play Store
```

## 8. Hosting the APK

You said you will manage APK hosting. Once you have a signed APK URL, insert a row:

```sql
INSERT INTO public.app_versions (platform, version_name, version_code, download_url, mandatory)
VALUES ('android', '1.0.0', 1, 'https://your-cdn.example.com/smart-bus-driver-1.0.0.apk', false);
```

The **Download Driver App** button will read the newest active row from `app_versions` and link to `download_url`.

## 9. Version check on app launch

At Driver Dashboard mount, compare installed `versionCode` (via `@capacitor/app`) to the latest `app_versions.version_code`. Show **Optional Update** or, if `mandatory = true`, a blocking dialog with a link to the APK / Play Store.

---

**Why not just a PWA?** iOS/Android suspend background JS timers and revoke `watchPosition` when the browser tab loses focus. A Capacitor foreground service is the only reliable way to keep GPS flowing with the screen off.
