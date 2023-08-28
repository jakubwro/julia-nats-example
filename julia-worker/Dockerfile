FROM julia:1.9.3

WORKDIR /usr/src/app
COPY JuliaWorkerExample ./

WORKDIR /usr/src/app/JuliaWorkerExample
RUN julia --project -e "using Pkg; Pkg.instantiate();"

CMD ["julia", "--project", "-e", "using JuliaWorkerExample; do_stuff();"]