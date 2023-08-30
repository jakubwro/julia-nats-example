package main

import (
	"context"
	"fmt"
	"log"
	"net"
	"os"
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

	pid := findJuliaProcessPid()
	// Make a buffer to hold incoming data.
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Minute)
	defer cancel()

	nc, err := nats.Connect("nats://nats:4222")
	if err != nil {
		log.Fatal(err)
		os.Exit(1)
	}
	defer nc.Close()
	js, err := jetstream.New(nc)
	if err != nil {
		log.Fatal(err)
		os.Exit(1)
	}

	s, err := js.CreateStream(ctx, jetstream.StreamConfig{
		Name:     "TEST_STREAM",
		Subjects: []string{"FOO.*"},
	})
	if err != nil {
		log.Fatal(err)
		os.Exit(1)
	}

	fmt.Println("Stream created.")

	cons, err := s.CreateOrUpdateConsumer(ctx, jetstream.ConsumerConfig{
		Durable:   "TestConsumerConsume",
		AckPolicy: jetstream.AckExplicitPolicy,
	})
	if err != nil {
		log.Fatal(err)
		os.Exit(1)
	}

	for {
		msg, err := cons.Next()
		if err != nil {
			if err == nats.ErrTimeout {
				continue
			} else {
				log.Fatal(err)
				os.Exit(1)
			}
		}

		fmt.Println(string(msg.Data()))
		_, err = conn.Write([]byte(fmt.Sprint(string(msg.Data()), "\n")))
		if err != nil {
			log.Println(err)
			fmt.Println(err)
			msg.Nak()
			return
		}

		if findJuliaProcessPid() != pid {
			fmt.Println("Julia seems to be crashed, closing connection")
			msg.Nak()
			return
		}

		buf := make([]byte, 1024)
		conn.SetReadDeadline(time.Now().Add(5 * time.Second))
		_, err = conn.Read(buf)
		if err != nil {
			if os.IsTimeout(err) {
				fmt.Println("Timeout.")
				if pid > 0 {
					syscall.Kill(pid, syscall.SIGINT)
					log.Println("SIGINT send to julia due to timeout.")
				}
				msg.Nak()
				return
			} else {
				log.Println(err)
				msg.Nak()
				return
			}
		} else {
			fmt.Println(string(buf))
			msg.Ack()
		}
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
	}
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
		conn, err := l.Accept()
		if err != nil {
			fmt.Println("Error accepting: ", err.Error())
			os.Exit(1)
		}
		go handleRequest(conn)
	}
}
