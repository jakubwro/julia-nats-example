module JuliaWorkerExample

using Sockets

export do_stuff

function do_stuff()
    Base.exit_on_sigint(false)
    @info "Reading requests."

    s = connect(3333)
    while true
        if !isfile("/tmp/liveness/healthy")
            @warn "Recovering after liveness probe failure."
            touch("/tmp/liveness/healthy")
        end
        try 
            @info "Reading line."
            @info readline(s)
            random = rand()
            sleep(random)
            # if random < 0.01
            #     exit(1)
            # end
            write(s, "Processing finished after $random s\n")
            flush(s)
        catch e
            @error e
        end
    end
    @info "Quiting."
end

end # module JuliaWorkerExample
