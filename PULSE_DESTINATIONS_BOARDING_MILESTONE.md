# Pulse destination accuracy and boarding guidance — first increment

## Shipped in this increment

- Recognise **Mabopane Block U** and other explicit Mabopane/Soshanguve block searches as a request for that exact neighbourhood, not a similarly named road or a generic township centre.
- Reject geocoder hits (including saved favourites and recent destinations) which do not name the requested block. If no exact result is indexed, ask for a known landmark, an exact address, or coordinates rather than silently routing elsewhere.
- Show mapped *boarding candidate* and *exit candidate* separately in the expanded transport options, with a clear warning that operator stop calls and service direction have not been verified.
- Provide an optional **Walking directions to mapped stop** link for named, mapped A Re Yeng, Gautrain and PRASA stops. This opens Google Maps after user action, leaving the user's starting GPS coordinates out of the URL.
- Preserve the distinction between nearby mapped infrastructure and a verified end-to-end connection. PUTCO's region-only coverage remains a coverage hint, not a specific boarding point; taxi rank coverage remains provisional.

## Acceptance checks

1. Search `Mabopane block u`. A `Block Street, Mabopane` result must not be selectable as Block U.
2. A result specifically labelled `Mabopane Block U` may be selected; if absent, the app must explain that the exact block has not been located and offer coordinate/address alternatives.
3. Search `Soshanguve Block XX` and verify that an unrelated Soshanguve or Pretoria centre is rejected, while an exact `Soshanguve XX` match can be used.
4. With location consent near a mapped A Re Yeng stop, the nearby transport panel identifies the **named** stop, shows straight-line distance, and offers walking directions that open in Google Maps.
5. A nearby PUTCO coverage hint must not acquire a fictional GPS boarding point or walking link.
6. Expanded journey options say where to board/exit **only when mapped candidate names exist**, and never claim guaranteed service calls or departures.

## Still required before reliable turn-by-turn transfers

- Obtain stop-to-route-to-direction calling patterns and authoritative stop coordinates per operator. Geometry proximity alone does not prove boarding access.
- Resolve township-block aliases in the geocoding source or a verified local place index; strict filtering deliberately cannot invent a pin for an unindexed block.
- Link legs using verified transfer pairs and walking access paths; validate against real trips and keep unverified links as suggestions only.
- Test the generated Android APK and recheck whether searches, local trip history and navigation links behave as expected on several devices.

## Verification

Run `cd frontend && npm test -- --run && npm run build`.
