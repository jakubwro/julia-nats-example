import { Application } from "https://deno.land/x/oak/mod.ts";
import * as nats from "https://deno.land/x/nats/src/mod.ts";

const servers = [
    { servers: "localhost:4222" },
  ];

const app = new Application();

app.use(async (ctx) => {
    await servers.forEach(async (v) => {
        try {
            const nc = await nats.connect(v);
            const jsm = await nc.jetstreamManager();

            await jsm.streams.add({ name: "a", subjects: ["a.*"] });
            
            const js = nc.jetstream();
            let pa = await js.publish("a.b");
            console.log(pa)
            console.log(
                `stored in ${pa.stream} with sequence ${pa.seq} and is a duplicate? ${pa.duplicate}`,
              );
            await js.publish("a.b", undefined, { msgID: "some-unique-id" });

            const kv = await js.views.kv("responses")

            const result = await kv.get("question.answer")
            if (result == null) {
                console.log("404")
            }
            // console.log(String(new TextDecoder().decode(result?.value)))
            console.log(`connected to ${nc.getServer()}`);
            // this promise indicates the client closed
            const done = nc.closed();
            // do something with the connection
            
            // close the connection
            await nc.close();
            // check if the close was OK
            const err = await done;
            if (err) {
            console.log(`error closing:`, err);
            }
        } catch (err) {
            console.log(`error connecting to ${JSON.stringify(v)}`);
        }
        });
  ctx.response.body = "Hello world!";
});

await app.listen({ port: 8000 });