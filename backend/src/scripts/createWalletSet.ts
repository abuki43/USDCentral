import dotenv from "dotenv";

import { getCircleClient } from "../lib/circleClient.js";

dotenv.config({ path: ".env.local" });
dotenv.config();

const parseNameFromArgs = () => {
  const argv = process.argv.slice(2);
  const nameFlagIndex = argv.findIndex((a) => a === "--name" || a === "-n");
  if (nameFlagIndex >= 0) {
    return argv[nameFlagIndex + 1];
  }
  return undefined;
};

const main = async () => {
  const name = parseNameFromArgs() ?? process.env.CIRCLE_WALLET_SET_NAME;

  if (!name) {
    throw new Error(
      "Missing wallet set name. Pass --name <name> or set CIRCLE_WALLET_SET_NAME.",
    );
  }

  const circle = getCircleClient();
  const resp = await circle.createWalletSet({ name });

  const walletSetId = resp.data?.walletSet?.id;
  if (!walletSetId) {
    throw new Error("Circle did not return walletSet.id");
  }

  process.stdout.write(`${walletSetId}\n`);
};

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  // eslint-disable-next-line no-console
  console.error(message);
  process.exit(1);
});
