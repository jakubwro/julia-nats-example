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
        @warn "Connecting to sidecar."
        s = connect(3333)
        try
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
            end

        catch e
            @error e
        end
    end
    @info "Quiting."
end

end # module JuliaWorkerExample
