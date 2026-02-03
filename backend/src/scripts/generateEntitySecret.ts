import { generateEntitySecret } from "@circle-fin/developer-controlled-wallets";

const secret = generateEntitySecret();

process.stdout.write(`${secret}\n`);
