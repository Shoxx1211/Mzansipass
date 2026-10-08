# Pulse for iPhone

This native Capacitor project shares Pulse's fare estimates, Mapbox search and
trip tracking with Android. Location usage descriptions and background location
mode are configured. Physical-device background tracking still needs testing.

From the repository root: `npm ci`, `npm --prefix frontend ci`, then
`npm run build:ios` and `npm run cap:ios`. Use Xcode 26 or newer.
Install CocoaPods on the Mac before syncing. CocoaPods is used because the tracking plugin’s Swift Package Manager manifest targets Capacitor 7.
Set the same public `VITE_MAPBOX_TOKEN` used for Android before the build.

The iOS workflow builds an unsigned **simulator app**, not an installable IPA.
For an iPhone/TestFlight release, select your Apple Developer team in Xcode,
confirm that `com.pulse.transit` is available for that team, create the matching
App Store Connect app, then archive and distribute using Xcode's signing flow.
Do not commit signing keys or certificates. TestFlight distribution requires
Apple Developer Program membership and a signed build uploaded to App Store Connect.

Before distribution test sign-in, destination search, numeric fares, GPS,
screen-locked tracking, denied permissions, ending a trip, and saved trip stats
on a physical iPhone. Replace the generated placeholder icon/splash assets with
approved Pulse branding before a public release.
