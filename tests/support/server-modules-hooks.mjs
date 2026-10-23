import { existsSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));

function resolveSourceAlias(specifier) {
  const sourcePath = resolvePath(repositoryRoot, "src", specifier.slice(2));

  for (const extension of [".ts", ".tsx", "/index.ts"]) {
    const candidate = sourcePath + extension;

    if (existsSync(candidate)) {
      return pathToFileURL(candidate).href;
    }
  }

  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return {
      url: pathToFileURL(
        resolvePath(repositoryRoot, "node_modules/next/dist/compiled/server-only/empty.js"),
      ).href,
      shortCircuit: true,
    };
  }

  if (specifier.startsWith("@/")) {
    const sourceUrl = resolveSourceAlias(specifier);

    if (sourceUrl) {
      return { url: sourceUrl, shortCircuit: true };
    }
  }

  if (specifier === "next/server") {
    return nextResolve("next/server.js", context);
  }

  return nextResolve(specifier, context);
}
