module JuliaWorkerNative

using NATS
using Base64

export mainloop

function mainloop(f)
    Base.exit_on_sigint(false)
    !isdir("/tmp/liveness") && mkdir("/tmp/liveness")
    @info "Reading requests."

    while true
        try
            isfile("/tmp/liveness/working") && rm("/tmp/liveness/working")
            connection = NATS.connect("nats", 4222)

            while true
                @info "Reading line."
                msg = NATS.JetStream.next("TEST_STREAM", "TestConsumerConsume"; connection)

                touch("/tmp/liveness/working")
                @info msg
                data = "result for $(msg.payload)"
                result = f(data)
                rm("/tmp/liveness/working")
                @info result
                result = base64encode(result)
                @show result
                NATS.JetStream.ack(msg; connection)
            end
        catch e
            @error e
        end
    end
    @info "Quiting."
end

end # module JuliaWorkerNative
