#!/usr/bin/env bash
#
# Starts the Android emulator so the app can actually be driven against a local backend.
#
#   ./scripts/start-emulator.sh [avd-name]
#
# Two things here are not optional, both learned the hard way:
#
# 1. Pending crash dumps are cleared first. When the emulator dies, crashpad leaves a report
#    behind, and the NEXT start puts up a "send this crash report?" consent dialog and waits on
#    it - before booting Android. The window appears, nothing boots, adb never sees a device, and
#    it looks for all the world like the emulator is broken. It isn't; it is waiting for a click.
#
# 2. It asks for the host GPU. The software renderer (swiftshader_indirect) segfaults on this
#    machine with "Failed to find ColorBuffer" - which is what produced the crash dumps in the
#    first place. Apple Silicon has Metal; use it. If the host GPU is unavailable the emulator
#    falls back on its own, so asking is safe.
#
# Also wires adb reverse for the backend (8080) and Metro (8081), so the emulator reaches both on
# localhost exactly as a tethered device would.
set -uo pipefail

AVD=${1:-${AVD:-Pixel_10_Pro_XL}}
# The console port adb scans. Its adb port is this + 1.
PORT=${PORT:-5554}
SDK=${ANDROID_SDK_ROOT:-${ANDROID_HOME:-$HOME/Library/Android/sdk}}
EMULATOR="$SDK/emulator/emulator"
export PATH="$PATH:$SDK/platform-tools"

[ -x "$EMULATOR" ] || { echo "No emulator at $EMULATOR - set ANDROID_SDK_ROOT." >&2; exit 1; }

if ! "$EMULATOR" -list-avds | grep -qx "$AVD"; then
  echo "No AVD named '$AVD'. Available:" >&2
  "$EMULATOR" -list-avds | sed 's/^/  /' >&2
  exit 1
fi

if adb devices | grep -q "device$"; then
  echo "An emulator is already attached:"
  adb devices | grep "device$" | sed 's/^/  /'
else
  # (1) Clear the consent dialog's reason to appear. Only ever removes crash reports.
  for db in /tmp/android-$USER/emu-crash-*.db; do
    [ -d "$db" ] || continue
    rm -rf "$db/pending" "$db/new" 2>/dev/null
    echo "Cleared pending crash reports in $(basename "$db")"
  done

  echo "Starting $AVD..."
  # (2) Host GPU. -no-metrics keeps it from phoning home; -no-boot-anim shaves a few seconds.
  #
  # (3) -port is not optional. Left to choose, the emulator sometimes takes a high console port
  #     (53295 here) and never registers with the adb server: qemu runs, the window appears, and
  #     `adb devices` stays empty - indistinguishable from a boot that hung. 5554 is the port adb
  #     scans for.
  "$EMULATOR" -avd "$AVD" -port "$PORT" -gpu host -no-metrics -no-boot-anim -noaudio \
    > "${TMPDIR:-/tmp}/emulator-$AVD.log" 2>&1 &

  printf 'Waiting for boot'
  for _ in $(seq 1 90); do
    if [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; then
      echo " - up."
      break
    fi
    if ! pgrep -f "qemu-system.*-avd $AVD" >/dev/null; then
      echo
      echo "The emulator exited before booting. Last lines of its log:" >&2
      tail -20 "${TMPDIR:-/tmp}/emulator-$AVD.log" >&2
      exit 1
    fi
    printf '.'
    sleep 5
  done

  if [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" != "1" ]; then
    echo
    echo "Timed out waiting for $AVD to boot. Log: ${TMPDIR:-/tmp}/emulator-$AVD.log" >&2
    exit 1
  fi
fi

# The app talks to both over localhost; without these it reaches neither.
adb reverse tcp:8080 tcp:8080 >/dev/null && echo "adb reverse 8080 -> backend"
adb reverse tcp:8081 tcp:8081 >/dev/null && echo "adb reverse 8081 -> Metro"

cat <<'EOF'

Ready. Next:
  backend   cd ../backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=local
  metro     npx expo start --dev-client
  app       adb shell monkey -p com.gurukul.rn -c android.intent.category.LAUNCHER 1
EOF
