#!/bin/sh
# Builds the macOS app (Apple Silicon + Intel), signs it with your Developer ID certificate
# and has it notarized by Apple, so it opens on any Mac without warnings.
#
#   npm run build:mac:notarized
#
# One-time setup: see "Signing and Notarizing (macOS)" in README.md.
# Optional environment variables:
#   APPLE_KEYCHAIN_PROFILE  name of the stored notary credentials (default: kiosk-notary)
#   APPLE_KEYCHAIN          path of the keychain holding them (default: search all keychains)
#   CSC_NAME                certificate to use, if you have several Developer ID certificates

set -e
cd "$(dirname "$0")/.."

PROFILE="${APPLE_KEYCHAIN_PROFILE:-kiosk-notary}"
# Only pass --keychain when a keychain file is given. notarytool stores credentials in the
# modern data-protection keychain by default, which is not the login.keychain-db file.
KEYCHAIN_ARGS=""
[ -n "$APPLE_KEYCHAIN" ] && KEYCHAIN_ARGS="--keychain $APPLE_KEYCHAIN"

fail() {
  printf '\n\033[31mError:\033[0m %s\n\n' "$1" >&2
  exit 1
}

# --- 1. Developer ID certificate ------------------------------------------------
if [ -z "$CSC_NAME" ]; then
  IDENTITY=$(security find-identity -v -p codesigning | grep -o '"Developer ID Application: [^"]*"' | head -1 | tr -d '"')
  [ -n "$IDENTITY" ] || fail 'No "Developer ID Application" certificate found in the keychain.
Create one at https://developer.apple.com/account/resources/certificates (or in
Xcode → Settings → Accounts → Manage Certificates) and install it.'
  CSC_NAME="${IDENTITY#Developer ID Application: }"
fi
export CSC_NAME
echo "Signing as:     Developer ID Application: $CSC_NAME"

# --- 2. Apple's notary tools ----------------------------------------------------
# xcrun refuses to run until the Xcode license is accepted. The Command Line Tools
# have the same tools and work without it.
if ! xcrun notarytool --version >/dev/null 2>&1; then
  if [ -x /Library/Developer/CommandLineTools/usr/bin/notarytool ]; then
    export DEVELOPER_DIR=/Library/Developer/CommandLineTools
  else
    fail 'notarytool is not available. Run "sudo xcodebuild -license accept" or install the
Command Line Tools with "xcode-select --install".'
  fi
fi

# --- 3. Notary credentials ------------------------------------------------------
xcrun notarytool history --keychain-profile "$PROFILE" $KEYCHAIN_ARGS >/dev/null 2>&1 ||
  fail "No notary credentials named \"$PROFILE\" found. Store them once with:

  xcrun notarytool store-credentials $PROFILE --apple-id YOUR_APPLE_ID --team-id YOUR_TEAM_ID

and enter an app-specific password from https://account.apple.com (Sign-In and Security)."
echo "Notarizing as:  keychain profile \"$PROFILE\""
export APPLE_KEYCHAIN_PROFILE="$PROFILE"

# --- 4. Build, sign, notarize the app ----------------------------------------------
echo
echo "Building … (notarization usually takes 2–15 minutes)"
rm -rf dist
npx electron-builder --mac --universal --publish never

# --- 5. Sign, notarize and staple the disk image too -----------------------------------
for DMG in dist/*.dmg; do
  echo
  echo "Signing and notarizing $DMG …"
  codesign --force --timestamp --sign "Developer ID Application: $CSC_NAME" "$DMG"
  xcrun notarytool submit "$DMG" --keychain-profile "$PROFILE" $KEYCHAIN_ARGS --wait
  xcrun stapler staple "$DMG"
done

# --- 6. Check the result ------------------------------------------------------------
echo
echo "Checking …"
APP=$(ls -d dist/mac-universal/*.app | head -1)
codesign --verify --deep --strict "$APP"
xcrun stapler validate "$APP"
spctl --assess --type execute --verbose "$APP"
for DMG in dist/*.dmg; do
  xcrun stapler validate "$DMG"
  spctl --assess --type open --context context:primary-signature --verbose "$DMG"
done

printf '\n\033[32mDone.\033[0m Signed and notarized:\n'
ls -1 dist/*.dmg dist/*.zip
