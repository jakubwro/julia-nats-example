module JuliaWorkerExample

using Base64
using Sockets

export mainloop, do_stuff

function do_stuff(data)
    random = rand()
    worktime = 15 * random
    @info "Will work for $worktime s."
    # if random > 0.99
    #     @warn "Simulating segfault."
    #     exit(1)
    # end
    sleep(worktime)
    # if random < 0.01
    #     @warn "Simulating segfault."
    #     exit(1)
    # end
    "Processing finished after $worktime s."
end

function mainloop(f)
    Base.exit_on_sigint(false)
    @info "Reading requests."
    mkdir("/tmp/liveness")
    while true
        @warn "Connecting to a sidecar."
        try
            isfile("/tmp/liveness/working") && rm("/tmp/liveness/working")
            s = retry(connect; delays=ExponentialBackOff(10, 0.1, 1, 2, 0))(3333)
            while true
                try
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
                    @show isopen(s)
                    !isopen(s) && error("Connection closed, mesage processed.")
                    write(s, "$result\n")
                    flush(s)
                catch e
                    @show e
                    close(s)
                end
            end
        catch e
            @error e
        end
    end
    @info "Quiting."
end

end # module JuliaWorkerExample
