FROM julia:1.9.3

WORKDIR /usr/src/app
COPY . .

RUN apt-get update && apt-get install -y procps
RUN julia --project -e "using Pkg; Pkg.instantiate();"

CMD ["julia", "--project", "-e", "using JuliaWorkerExample; mainloop(do_stuff);"]