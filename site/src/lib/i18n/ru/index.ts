import type { en } from "../en";
import { admin } from "./admin";
import { auth } from "./auth";
import { chrome } from "./chrome";
import { community } from "./community";
import { discovery } from "./discovery";
import { errors } from "./errors";
import { legal } from "./legal";
import { product } from "./product";
import { publishing } from "./publishing";
import { servers } from "./servers";
import { shell } from "./shell";
import { workspace } from "./workspace";

export const ru: typeof en = {
  ...shell,
  ...discovery,
  ...workspace,
  ...servers,
  ...auth,
  ...product,
  ...publishing,
  ...chrome,
  ...community,
  ...admin,
  ...legal,
  ...errors,
};
