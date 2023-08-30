package main

import (
	"context"
	"fmt"
	"io"
	"log"
	"net"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/mitchellh/go-ps"
	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"
)

const (
	CONN_HOST = "localhost"
	CONN_PORT = "3333"
	CONN_TYPE = "tcp"
)

func findJuliaProcessPid() (pid int) {
	procs, err := ps.Processes()
	if err != nil {
		fmt.Println(err)
	}

	for _, proc := range procs {
		if proc.Executable() == "julia" {
			return proc.Pid()
		}
	}
	fmt.Println("Cannot find julia process.")
	return -1
}

func handleRequest(conn net.Conn) {
	defer conn.Close()
	// Make a buffer to hold incoming data.
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Minute)
	defer cancel()

	nc, err := nats.Connect("nats://nats:4222")
	if err != nil {
		log.Fatal(err)
	}
	defer nc.Close()
	js, err := jetstream.New(nc)
	if err != nil {
		log.Fatal(err)
	}

	s, err := js.CreateStream(ctx, jetstream.StreamConfig{
		Name:     "TEST_STREAM",
		Subjects: []string{"FOO.*"},
	})
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println("Stream created.")

	cons, err := s.CreateOrUpdateConsumer(ctx, jetstream.ConsumerConfig{
		Durable:   "TestConsumerConsume",
		AckPolicy: jetstream.AckExplicitPolicy,
	})
	if err != nil {
		log.Fatal(err)
	}

	for {
		msg, err := cons.Next()

		if err != nil {
			fmt.Println(err)
			continue
		}

		fmt.Println(string(msg.Data()))
		_, err = conn.Write([]byte(fmt.Sprint(string(msg.Data()), "\n")))
		if err != nil {
			fmt.Println(err)
			os.Exit(0)
		}

		pid := findJuliaProcessPid()
		fmt.Println("Julia PID is ", pid)
		start := time.Now()
		for {
			if findJuliaProcessPid() != pid {
				fmt.Println("Julia seems to be crashed, closing connection")
				msg.Nak()
				return
			}
			if time.Since(start) > 5*time.Second {
				fmt.Println("Timeout for job")
				if pid > 0 {
					syscall.Kill(pid, syscall.SIGINT)
					fmt.Println("SIGINT send to julia")
				}
				msg.Nak()
				return
			}
			buf := make([]byte, 1024)
			conn.SetReadDeadline(time.Now().Add(100 * time.Millisecond))
			_, err = conn.Read(buf)
			if err != nil {
				if err == io.EOF {
					time.Sleep(1 * time.Second)
				} else {
					// fmt.Println(err)
					// os.Exit(0)
				}
			} else {
				fmt.Println(string(buf))
				msg.Ack()

				// asdf, err := nc.JetStream()
				// if err != nil {
				// 	fmt.Println(err)
				// 	fmt.Println("err 1")

				// }
				// fmt.Println("1")
				// kv := asdf.KeyValueStores()

				// fmt.Println("2")
				// fmt.Println("putting key")
				// fmt.Println(kv)
				// for x := range kv {
				// 	fmt.Println(x)
				// }
				// kvs, err := asdf.KeyValue("responses")
				// if err != nil {
				// 	fmt.Println(err)
				// }
				// fmt.Println(kvs)

				// _, err = kvs.Put("question.answer", []byte("blue"))
				// fmt.Println("put")

				break
			}
		}
	}
	conn.Close()
}

func main() {
	fmt.Println("Hello, world.")

	l, err := net.Listen(CONN_TYPE, CONN_HOST+":"+CONN_PORT)
	if err != nil {
		fmt.Println("Error listening:", err.Error())
		os.Exit(1)
	}

	defer l.Close()
	fmt.Println("Listening on " + CONN_HOST + ":" + CONN_PORT)

	for {
		// Listen for an incoming connection.
		conn, err := l.Accept()
		if err != nil {
			fmt.Println("Error accepting: ", err.Error())
			os.Exit(1)
		}
		// Handle connections in a new goroutine.
		go handleRequest(conn)
	}

	fmt.Println("Waiting for SIGINT.")

	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
	<-sig
}
