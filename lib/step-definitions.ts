import path from "path";

import glob from "glob";

import util from "util";

import assert from "assert";

import isPathInside from "is-path-inside";

import {
  ICypressConfiguration,
  ICypressPost10Configuration,
  ICypressPre10Configuration,
} from "@badeball/cypress-configuration";

import debug from "./debug";

import { IPreprocessorConfiguration } from "./preprocessor-configuration";

import { ensureIsAbsolute } from "./helpers/paths";

export async function getStepDefinitionPaths(
  stepDefinitionPatterns: string[]
): Promise<string[]> {
  const files = (
    await Promise.all(
      stepDefinitionPatterns.map((pattern) =>
        util.promisify(glob)(pattern, { nodir: true })
      )
    )
  ).reduce((acum, el) => acum.concat(el), []);

  if (files.length === 0) {
    debug("found no step definitions");
  } else {
    debug(`found step definitions ${util.inspect(files)}`);
  }

  return files;
}

function trimFeatureExtension(filepath: string) {
  return filepath.replace(/\.feature$/, "");
}

export function pathParts(relativePath: string): string[] {
  assert(
    !path.isAbsolute(relativePath),
    `Expected a relative path but got ${relativePath}`
  );

  const parts: string[] = [];

  do {
    parts.push(relativePath);
  } while (
    (relativePath = path.normalize(path.join(relativePath, ".."))) !== "."
  );

  return parts;
}

export function getStepDefinitionPatterns(
  configuration: {
    cypress: ICypressConfiguration;
    preprocessor: IPreprocessorConfiguration;
  },
  filepath: string
): string[] {
  const { cypress, preprocessor } = configuration;

  if ("specPattern" in cypress) {
    return getStepDefinitionPatternsPost10({ cypress, preprocessor }, filepath);
  } else {
    return getStepDefinitionPatternsPre10({ cypress, preprocessor }, filepath);
  }
}

export function getStepDefinitionPatternsPost10(
  configuration: {
    cypress: Pick<ICypressPost10Configuration, "projectRoot">;
    preprocessor: IPreprocessorConfiguration;
  },
  filepath: string
): string[] {
  const projectRoot = configuration.cypress.projectRoot;

  if (!isPathInside(filepath, projectRoot)) {
    throw new Error(`${filepath} is not inside ${projectRoot}`);
  }

  const filepathReplacement = trimFeatureExtension(
    path.relative(
      configuration.preprocessor.implicitIntegrationFolder,
      filepath
    )
  );

  debug(`replacing [filepath] with ${util.inspect(filepathReplacement)}`);

  const parts = pathParts(filepathReplacement);

  debug(`replacing [filepart] with ${util.inspect(parts)}`);

  const stepDefinitions = [configuration.preprocessor.stepDefinitions].flat();

  debug(`looking for step definitions using ${util.inspect(stepDefinitions)}`);

  return stepDefinitions
    .flatMap((pattern) => {
      if (pattern.includes("[filepath]") && pattern.includes("[filepart]")) {
        throw new Error(
          `Pattern cannot contain both [filepath] and [filepart], but got ${util.inspect(
            pattern
          )}`
        );
      } else if (pattern.includes("[filepath]")) {
        return pattern.replace("[filepath]", filepathReplacement);
      } else if (pattern.includes("[filepart]")) {
        return [
          ...parts.map((part) => pattern.replace("[filepart]", part)),
          path.normalize(pattern.replace("[filepart]", ".")),
        ];
      } else {
        return pattern;
      }
    })
    .map((pattern) => ensureIsAbsolute(projectRoot, pattern));
}

export function getStepDefinitionPatternsPre10(
  configuration: {
    cypress: Pick<
      ICypressPre10Configuration,
      "projectRoot" | "integrationFolder"
    >;
    preprocessor: IPreprocessorConfiguration;
  },
  filepath: string
): string[] {
  const fullIntegrationFolder = ensureIsAbsolute(
    configuration.cypress.projectRoot,
    configuration.cypress.integrationFolder
  );

  if (!isPathInside(filepath, fullIntegrationFolder)) {
    throw new Error(`${filepath} is not inside ${fullIntegrationFolder}`);
  }

  const filepathReplacement = trimFeatureExtension(
    path.relative(fullIntegrationFolder, filepath)
  );

  debug(`replacing [filepath] with ${util.inspect(filepathReplacement)}`);

  const parts = pathParts(filepathReplacement);

  debug(`replacing [filepart] with ${util.inspect(parts)}`);

  const stepDefinitions = [configuration.preprocessor.stepDefinitions].flat();

  debug(`looking for step definitions using ${util.inspect(stepDefinitions)}`);

  return stepDefinitions
    .flatMap((pattern) => {
      if (pattern.includes("[filepath]") && pattern.includes("[filepart]")) {
        throw new Error(
          `Pattern cannot contain both [filepath] and [filepart], but got ${util.inspect(
            pattern
          )}`
        );
      } else if (pattern.includes("[filepath]")) {
        return pattern.replace("[filepath]", filepathReplacement);
      } else if (pattern.includes("[filepart]")) {
        return [
          ...parts.map((part) => pattern.replace("[filepart]", part)),
          path.normalize(pattern.replace("[filepart]", ".")),
        ];
      } else {
        return pattern;
      }
    })
    .map((pattern) =>
      ensureIsAbsolute(configuration.cypress.projectRoot, pattern)
    );
}
