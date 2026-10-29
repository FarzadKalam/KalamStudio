#!/bin/sh
set -eu
# Fit the scanner to the Club upload contract and a small shared host.
# Reload sequentially to avoid holding two signature databases in memory.
sed -i '/^StreamMaxLength /d; /^MaxFileSize /d; /^MaxScanSize /d; /^MaxThreads /d; /^ConcurrentDatabaseReload /d' /etc/clamav/clamd.conf
cat >> /etc/clamav/clamd.conf <<'EOF'
StreamMaxLength 320M
MaxFileSize 320M
MaxScanSize 640M
MaxThreads 2
ConcurrentDatabaseReload no
EOF
# freshclam's pre-load test otherwise holds another complete database beside
# clamd. clamd still validates/loads each signed update before scanning files.
sed -i '/^TestDatabases /d' /etc/clamav/freshclam.conf
printf '\nTestDatabases no\n' >> /etc/clamav/freshclam.conf
TINI_SUBREAPER=1 /init &
supervisor=$!
trap 'kill "$supervisor" 2>/dev/null || true; exit 0' TERM INT
# The upstream init script can stay alive after clamd is OOM-killed.
# Exit on a dead scanner so Docker's restart policy can recover it.
ready=0
failures=0
startup_checks=0
while kill -0 "$supervisor" 2>/dev/null; do
    if clamdcheck.sh >/dev/null 2>&1; then
        ready=1
        failures=0
    elif [ "$ready" -eq 1 ]; then
        failures=$((failures + 1))
        if [ "$failures" -ge 12 ]; then
            echo 'ClamAV has stopped responding; restarting scanner container.' >&2
            kill "$supervisor" 2>/dev/null || true
            exit 1
        fi
    else
        startup_checks=$((startup_checks + 1))
        if [ "$startup_checks" -ge 180 ]; then
            echo 'ClamAV startup timed out; restarting scanner container.' >&2
            exit 1
        fi
    fi
    sleep 10 &
    wait $! || true
done
wait "$supervisor"
