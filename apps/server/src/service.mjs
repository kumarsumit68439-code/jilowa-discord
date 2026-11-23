import node from "@prisma/composer/node";
import { compute } from "@prisma/composer-prisma-cloud";
import { postgres, dataContract } from "@prisma/composer-prisma-cloud/orm";
import { type } from "arktype";
import { field, secretString } from "@prisma/composer/arktype";
import contractJson from "./prisma/contract.json" with { type: "json" };

const data = dataContract(contractJson);

const input = type({
  jwtSecret: secretString(),
  "corsOrigin?": field(type("string")),
  "jwtExpires?": field(type("string")),
});

export default compute({
  name: "server",
  deps: { db: postgres(data) },
  input,
  build: node({
    module: import.meta.url,
    dir: "../dist",
    entry: "index.js",
    dependencies: "external",
  }),
});
