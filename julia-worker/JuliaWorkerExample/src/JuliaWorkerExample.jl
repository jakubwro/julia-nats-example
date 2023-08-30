module JuliaWorkerExample

using Sockets

export do_stuff

function do_stuff()
    Base.exit_on_sigint(false)
    @info "Reading requests."

    while true
        if !isfile("/tmp/liveness/healthy")
            @warn "Recovering after liveness probe failure."
            touch("/tmp/liveness/healthy")
        end
        touch("/tmp/liveness/start")
        @warn "Connecting to sidecar."
        try
            s = retry(connect; delays=ExponentialBackOff(10, 0.1, 1, 2, 0))(3333)
            while true
                @info "Reading line."
                @info readline(s)
                random = rand()
                # if random > 0.99
                #     @warn "Simulating segfault."
                #     exit(1)
                # end
                sleep(7 * random)
                # if random < 0.01
                #     @warn "Simulating segfault."
                #     exit(1)
                # end
                write(s, "Processing finished after $random s\n")
                flush(s)
                touch("/tmp/liveness/done")
            end

        catch e
            @error e
        end
    end
    @info "Quiting."
end

end # module JuliaWorkerExample
