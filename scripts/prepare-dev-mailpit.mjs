import { execFileSync } from "node:child_process";
import { createPrivateKey, randomBytes, X509Certificate } from "node:crypto";
import { chmodSync, chownSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function prepareKey(path) {
  if (!existsSync(path)) writeFileSync(path, randomBytes(32).toString("base64url"), { flag: "wx", mode: 0o600 });
  const value = readFileSync(path, "utf8");
  if (!/^[A-Za-z0-9_-]{43}$/u.test(value)
    || Buffer.from(value, "base64url").toString("base64url") !== value) {
    throw new Error("Invalid persisted development mail key; refusing to rotate it");
  }
  chmodSync(path, 0o600);
}

export function prepareDevMailpit(directory, env = process.env) {
  if (env.NODE_ENV !== "development") throw new Error("Mailpit setup is development-only");
  if (!isAbsolute(directory)) throw new Error("Development mail directory must be absolute");
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const keyFile = join(directory, "mail.key");
  const abuseKeyFile = join(directory, "abuse.key");
  const certFile = join(directory, "smtp.crt");
  const tlsKeyFile = join(directory, "smtp.key");
  prepareKey(keyFile);
  prepareKey(abuseKeyFile);
  if (readFileSync(keyFile).equals(readFileSync(abuseKeyFile))) throw new Error("Development mail keys must differ");

  let validCertificate = false;
  if (existsSync(certFile) && existsSync(tlsKeyFile)) {
    const cert = new X509Certificate(readFileSync(certFile));
    validCertificate = cert.checkHost("mailpit") === "mailpit"
      && cert.checkPrivateKey(createPrivateKey(readFileSync(tlsKeyFile)))
      && Date.parse(cert.validTo) > Date.now() + 86_400_000;
  }
  if (!validCertificate) {
    execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "365",
      "-subj", "/CN=mailpit", "-addext", "subjectAltName=DNS:mailpit",
      "-keyout", tlsKeyFile, "-out", certFile], { stdio: "ignore" });
  }
  chmodSync(tlsKeyFile, 0o600);
  chmodSync(certFile, 0o644);
  return { keyFile, abuseKeyFile, certFile, tlsKeyFile };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const directory = process.argv[2] || "/data/dev-mail";
  const files = prepareDevMailpit(directory);
  // Docker creates a new named volume as root; the app, worker and Mailpit run as UID 1000.
  if (process.getuid?.() === 0) {
    for (const path of [...Object.values(files), directory]) chownSync(path, 1000, 1000);
  }
  process.stdout.write("Development mail keys and TLS certificate ready\n");
}
