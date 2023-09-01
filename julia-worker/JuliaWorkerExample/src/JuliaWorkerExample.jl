module JuliaWorkerExample

using Base64
using Sockets

export mainloop, do_stuff

function do_stuff(data)
    random = rand()
    # processing_time = 7 * random
    # if random > 0.99
    #     @warn "Simulating segfault."
    #     exit(1)
    # end
    @info "Random is $random s."
    result = 0.0
    x = if random < 0.5
        @info "Large matrix."
        rand(1.0:10.0, 7000, 7000)
    else
        @info "Small matrix."
        rand(1.0:10.0, 65, 65)
    end
    @time y = x*x
    result = sum(y)
    # sleep(processing_time)
    # if random < 0.01
    #     @warn "Simulating segfault."
    #     exit(1)
    # end
    "Processing finished, $random s, result $result."
end

function mainloop(f)
    # Base.exit_on_sigint(false)
    mkdir("/tmp/liveness")
    @info "Reading requests."

    while true
        @warn "Connecting to sidecar."
        try
            isfile("/tmp/liveness/working") && rm("/tmp/liveness/working")
            s = retry(connect; delays=ExponentialBackOff(10, 0.1, 1, 2, 0))(3333)
            while true
                @info "Reading line."
                data = readline(s)
                @show data
                @show isopen(s)
                !isopen(s) && error("Connection closed.")
                isempty(data) && error("Empty message.")
                touch("/tmp/liveness/working")
                data = String(base64decode(data))
                @info data
                data = "result for $data"
                result = f(data)
                rm("/tmp/liveness/working")
                @info result
                result = base64encode(result)
                @show result
                @show isopen(s)
                !isopen(s) && error("Connection closed after message processed.")
                write(s, "$result\n")
                flush(s)
            end
        catch e
            @error e
        end
    end
    @info "Quiting."
end

end # module JuliaWorkerExample
