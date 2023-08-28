module JuliaWorkerExample

using Sockets

export do_stuff

function do_stuff()
    @info "Reading requests."

    s = connect(3333)
    while true
        @info "Reading line."
        @info readline(s)
        random = rand()
        sleep(random)
        # if random < 0.01
        #     exit(1)
        # end
        write(s, "Processing finished after $random s\n")
        flush(s)
    end
    @info "Quiting."
end

end # module JuliaWorkerExample
