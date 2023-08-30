FROM julia:1.9.3

WORKDIR /usr/src/app
COPY . .

RUN julia --project -e "using Pkg; Pkg.instantiate();"

CMD ["julia", "--project", "-e", "using JuliaWorkerExample; mainloop(do_stuff);"]