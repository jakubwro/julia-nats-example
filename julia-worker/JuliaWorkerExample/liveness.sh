
time_ago=$(date -d 'now - 10 seconds' +%s)
working_since=$(date -r "/tmp/liveness/working" +%s)

if [ $? -eq 0 ]; then
    if (( working_since <= time_ago )); then
            exit 1
    fi
fi

exit 0