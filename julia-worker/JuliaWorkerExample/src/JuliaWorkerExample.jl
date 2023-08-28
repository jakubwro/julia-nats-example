module JuliaWorkerExample

export do_stuff

function do_stuff()
    @info "Reading requests."
    open("/var/lib/queue/requests", "r") do r;
        reply_fifo = open("/var/lib/queue/reply", "w")
        @info "Opened reply fifo."
        while !eof(r)
            @info "Reading line."
            @info readline(r)
            random = rand()
            sleep(3 * random)
            if random < 0.1
                exit(1)
            end
            write(reply_fifo, "Processing finished after $random s\n")
            flush(reply_fifo)
        end
    end
    @info "Quiting."
end

end # module JuliaWorkerExample
