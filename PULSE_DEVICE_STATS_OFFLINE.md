# Pulse device storage, spending statistics and offline startup

## Evidence from Android beta video (6 November 2026)

The supplied ~134-second screen recording shows the app waiting on
"Restoring your secure Pulse session" for roughly 45 seconds. The passenger
then reaches account login/registration, and registration eventually fails
with an account-server timeout. This is an account API availability/timeout
symptom; the video alone cannot establish whether the cause was the user's
network, the hosting service, or the request path. It **does not show the
Stats page** or prove a historical trip was lost.

## Implemented in the working branch

- A startup account refresh may only block the welcome screen for at most
  5.5 seconds. The passenger can select **Explore Pulse as a guest** or
  **Sign in instead** immediately. A late refresh cannot silently replace
  the selected guest session or a newer manual login.
- Trip history already has local, profile-scoped persistence through WebView
  `localStorage`. The app saves it after each confirmed journey, reloads it
  on startup, and separates guest and signed-in profile histories on the
  same phone. An attempted guest-history import only removes the guest copy
  after the account copy has been written successfully.
- A storage failure now produces a visible warning. A journey still held in
  React memory must not be mistaken for one safely saved to the phone.
- The Stats page shows **this week**, **last week**, **this month**, **last
  month**, all-time tracked cost and distance. Calendar weeks begin Monday
  in the phone's local timezone. Totals update when a journey is saved and
  while the Stats tab remains open.
- Fare entries are separated into **confirmed paid** and **estimated**.
  A journey no longer silently becomes R0.00 if an available estimate was
  not replaced by an actual passenger-paid fare. Multi-leg records use
  actual leg fares first and labelled provisional amounts where available.
  Completely unknown fares are not fabricated and are counted as missing.

## On-device and privacy boundaries

- A registered account is still verified by the backend; the phone never
  treats an unverified cached email/password as a valid login. Guest Mode
  remains fully local and usable even when that backend is down.
- `localStorage` persists ordinary app restarts but is **not a backup**.
  Uninstalling, clearing application storage or resetting the phone can
  permanently erase locally saved trips and guest settings. Account data
  is **not synced between phones** in this pilot.
- We do not store account passwords on the device. A future encrypted,
  user-consented cloud backup or export feature is a separate milestone.
- The total labelled "tracked costs" includes explicitly identified
  estimates. It is not automatically proof of the amount the person paid.

## Device acceptance tests before the next APK

1. Fresh install with flight mode on: guest button must work immediately.
2. Returning user with unavailable account server: session check must give
   way to login/guest within ~5.5 seconds.
3. Save a guest trip, force-close Pulse and reopen offline; confirm the trip
   and weekly/monthly values are still there.
4. Save trips on either side of Sunday/Monday and a month boundary; check
   the totals and comparisons.
5. Enter a real paid fare, then complete another journey using only the
   estimate. Check that actual and estimated totals remain distinct.
6. Sign in and accept/decline guest-history import. On failed storage write,
   the guest copy must remain intact.
7. Test a completed multi-leg trip with missing one-leg fare; confirm no
   fabricated amount appears, and missing-fare warning is visible.
8. Before uninstalling an old APK, preserve anything important currently
   stored on that phone. A debug APK signed with a different key may not
   install as an in-place update.

The TypeScript check, Vitest suite and web build are automated checks only.
Real-device Android validation is still required before declaring the beta
ready. This change does not implement cloud sync, Google login or a new APK.
