package main

import (
	"context"
	"encoding/base64"
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

const (
	WORKER_TIMEOUT = 5 * time.Second
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

	log.Println("Handling connection ", conn.LocalAddr())

	pid := findJuliaProcessPid()
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
		_, err = conn.Write([]byte(fmt.Sprint(base64.StdEncoding.EncodeToString(msg.Data()), "\n")))
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
		conn.SetReadDeadline(time.Now().Add(WORKER_TIMEOUT))
		nread, err := conn.Read(buf)
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
			if nread < 2 {
				log.Fatalln("Expecting more than two bytes in the buffer.")
				return
			}
			if buf[nread-1] != '\n' {
				log.Fatalln("Expected newline at end of the buffer.")
				return
			}
			var base64bytes []byte = buf[0:(nread - 1)]
			n, err := base64.StdEncoding.Decode(buf, base64bytes)

			if err != nil {
				log.Fatalln(err)
				return
			}

			fmt.Println(string(buf[0:n]))
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
	log.Println("Starting.")

	l, err := net.Listen(CONN_TYPE, CONN_HOST+":"+CONN_PORT)
	if err != nil {
		log.Println("Error listening:", err.Error())
		os.Exit(1)
	}

	defer l.Close()
	log.Println("Listening on " + CONN_HOST + ":" + CONN_PORT)

	for {
		conn, err := l.Accept()
		if err != nil {
			log.Println("Error accepting: ", err.Error())
			os.Exit(1)
		}
		go handleRequest(conn)
	}
}
