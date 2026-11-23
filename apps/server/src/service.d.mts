import type { SecretString } from "@prisma/composer";
import type { PostgresBinding, PostgresContract } from "@prisma/composer-prisma-cloud/orm";
import type { Contract } from "./prisma/contract.js";

declare const service: {
  load(): { db: PostgresBinding<PostgresContract<Contract>> };
  input(): { jwtSecret: SecretString; corsOrigin?: string; jwtExpires?: string };
  port(): number;
};

export default service;
