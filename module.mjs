// @ts-check
import { module } from "@prisma/composer";
import { envParam, envSecret } from "@prisma/composer-prisma-cloud";
import { postgres, dataContract } from "@prisma/composer-prisma-cloud/orm";
import { readFileSync } from "node:fs";
import serverService from "./apps/server/src/service.mjs";

const contractJson = JSON.parse(
  readFileSync(new URL("./apps/server/src/prisma/contract.json", import.meta.url), "utf8"),
);
const data = dataContract(contractJson);

export default module("jilowa-discord", ({ provision }) => {
  const db = provision(
    postgres({ name: "db", contract: data, config: "./prisma.config.ts" }),
  );
  provision(serverService, {
    deps: { db },
    input: {
      jwtSecret: envSecret("JWT_SECRET"), // Signs login tokens (JWTs).
      corsOrigin: envParam("CORS_ORIGIN"),
      jwtExpires: envParam("JWT_EXPIRES"),
    },
  });
});
