package main

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"
)

func main() {
	fmt.Println("Hello, world.")

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Minute)
	defer cancel()

	nc, err := nats.Connect("nats://nats:4222")
	if err != nil {
		log.Fatal(err)
	}

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

	f, err := os.OpenFile("/var/lib/queue/requests", os.O_WRONLY, 0600)
	fmt.Printf("WRITER << opened: %+v|%+v\n", f, err)
	if err != nil {
		panic(err)
	}

	fmt.Println("Starting read operation")
	pipe, err := os.OpenFile("/var/lib/queue/reply", os.O_RDONLY, 0640)
	if err != nil {
		fmt.Println("Couldn't open pipe with error: ", err)
	}
	defer pipe.Close()

	reader := bufio.NewReader(pipe)
	fmt.Println("READER >> created")

	for {
		msg, err := cons.Next()

		if err != nil {
			fmt.Println(err)
			continue
		}

		fmt.Println(string(msg.Data()))
		_, err = f.WriteString(fmt.Sprint(string(msg.Data()), "\n"))
		if err != nil {
			fmt.Println(err)
			os.Exit(0)
		}
		msg.Ack()

		for {
			line, err := reader.ReadString('\n')
			if err != nil {
				if err == io.EOF {
					time.Sleep(1 * time.Second)
				} else {
					fmt.Println(err)
					os.Exit(0)
				}
			} else {
				fmt.Println(line)
				break
			}
		}
	}

	// cc, err := cons.Consume(func(msg jetstream.Msg) {
	// 	fmt.Println(string(msg.Data()))
	// 	_, err = f.WriteString(fmt.Sprint(string(msg.Data()), "\n"))
	// 	msg.Ack()
	// 	line, err := reader.ReadBytes('\n')
	// 	if err != nil {
	// 		fmt.Println(err)
	// 		os.Exit(0)
	// 	}
	// 	nline := string(line)
	// 	fmt.Println(nline)

	// }, jetstream.ConsumeErrHandler(func(consumeCtx jetstream.ConsumeContext, err error) {
	// 	fmt.Println(err)
	// }))
	// if err != nil {
	// 	log.Fatal(err)
	// }
	// defer cc.Stop()

	fmt.Println("Waiting for SIGINT.")

	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
	<-sig
}
