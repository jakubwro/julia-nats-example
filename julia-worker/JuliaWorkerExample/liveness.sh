
LIVENESS_PROBE_TIMEOUT_SECONDS="${LIVENESS_PROBE_TIMEOUT_SECONDS:-10}"

time_ago=$(date -d 'now - $LIVENESS_PROBE_TIMEOUT_SECONDS seconds' +%s)
working_since=$(date -r "/tmp/liveness/working" +%s)

if [ $? -eq 0 ]; then
    # File `working` exists.
    if (( working_since < time_ago )); then
            # File `working` was modifed before `LIVENESS_PROBE_TIMEOUT_SECONDS`.
            # Exit with error to let liveness probe SIGTERM process.
            exit 1
    fi
fi

exit 0
