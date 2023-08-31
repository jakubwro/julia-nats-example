
time_ago=$(date -d 'now - 5 seconds' +%s)
working_since=$(date -r "/tmp/liveness/working" +%s)

if [ $? -eq 0 ]; then
    if (( working_since <= time_ago )); then
        #TODO: flock dir
        if [ ! -f /tmp/liveness/signaled ]; then
            touch /tmp/liveness/signaled
            pkill -2 julia
            echo "killing julia"
            exit 0
        else
            echo "probe failure"
            exit 1 # SIGINT was already sent and process did not recover. Let controller to SIGTERM process.
        fi
    fi
fi

if [ -f /tmp/liveness/signaled ]; then
    echo "cleanup"
    rm /tmp/liveness/signaled # Process was successfuly recovered after SIGINT, cleanup flag.
fi
echo "all good"

exit 0
