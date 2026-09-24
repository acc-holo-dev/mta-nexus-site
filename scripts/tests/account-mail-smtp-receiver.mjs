import tls from "node:tls";
import { readFileSync } from "node:fs";

const port = Number(process.env.SMTP_TEST_PORT || 2465);
const cert = readFileSync(process.env.SMTP_TEST_CERT || "/certs/cert.pem");
const key = readFileSync(process.env.SMTP_TEST_KEY || "/certs/key.pem");

const server = tls.createServer({ cert, key }, (socket) => {
  socket.setEncoding("utf8");
  socket.write("220 nexus-test ESMTP\r\n");
  let buffer = "";
  let data = false;
  let recipient = "";

  const reply = (line) => socket.write(`${line}\r\n`);
  const finishData = () => {
    data = false;
    if (recipient.startsWith("uncertain@")) {
      socket.destroy();
      return;
    }
    if (recipient.startsWith("slow@")) {
      setTimeout(() => { if (!socket.destroyed) reply("250 2.0.0 queued"); }, 1500);
      return;
    }
    reply("250 2.0.0 queued");
  };

  socket.on("data", (chunk) => {
    buffer += chunk;
    for (;;) {
      const i = buffer.indexOf("\r\n");
      if (i < 0) break;
      const line = buffer.slice(0, i);
      buffer = buffer.slice(i + 2);
      if (data) {
        if (line === ".") finishData();
        continue;
      }
      if (/^EHLO /i.test(line)) {
        reply("250-nexus-test");
        reply("250 SIZE 32768");
      } else if (/^MAIL FROM:/i.test(line)) {
        reply("250 2.1.0 ok");
      } else if (/^RCPT TO:/i.test(line)) {
        const match = /<([^>]+)>/.exec(line);
        recipient = match?.[1]?.toLowerCase() || "";
        if (recipient.startsWith("retry4xx@")) reply("451 4.3.0 temporary");
        else if (recipient.startsWith("reject5xx@")) reply("550 5.1.1 rejected");
        else reply("250 2.1.5 ok");
      } else if (line === "DATA") {
        data = true;
        reply("354 end with dot");
      } else if (line === "QUIT") {
        reply("221 2.0.0 bye");
        socket.end();
      } else {
        reply("502 5.5.1 unsupported");
      }
    }
  });
  socket.on("error", () => {});
});

server.listen(port, "0.0.0.0", () => process.stdout.write("READY\n"));
const close = () => server.close(() => process.exit(0));
process.on("SIGTERM", close);
process.on("SIGINT", close);
