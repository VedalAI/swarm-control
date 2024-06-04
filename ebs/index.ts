import {config as dotenv} from "dotenv";
import readdirRecursive from "fs-readdir-recursive";
import {join} from "path";

dotenv();

const files = readdirRecursive(__dirname);
for (const file of files) {
    if (file.startsWith("node_modules")) continue;
    if (!file.endsWith(".init.ts")) continue;

    const filePath = join(__dirname, file);
    console.log("Loading file " + filePath);
    require(filePath);
}
