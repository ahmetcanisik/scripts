#!/usr/bin/env zx
/**
 * @name MigrateNpmPackagesScript
 * @version 0.0.1
 * @description Old npm packages migrated with new node version.
 * @author ahmetcanisik
*/

import { $, fetch, chalk } from "zx";
import figlet from "figlet";

// Display MNPS banner
console.log(chalk.blueBright(figlet.textSync("MNPS", {
    font: "Standard",
    horizontalLayout: "default",
    verticalLayout: "default"
})));

async function getPackageVersion(packageName) {
  try {
    const { stdout } = await $`npm list -g ${packageName} --depth=0`;
    const versionMatch = stdout.match(/@(\d+\.\d+\.\d+)/);
    return versionMatch ? versionMatch[1] : 'unknown';
  } catch (error) {
    return 'unknown';
  }
}

async function getNewPKGVersion(packageName) {
    try {
        const res = await fetch(`https://registry.npmjs.org/${packageName}`);
        
        if (!res.ok) {
            throw new Error(`Response isn't ok! status = ${res.status}`);
        }

        const data = await res.json();

        if (!data || !data["dist-tags"] || !data["dist-tags"].latest) {
            throw new Error("Version information is not found!");
        }

        return data["dist-tags"].latest;

    } catch (err) {
        console.error(chalk.whiteBright(`Error fetching version for ${packageName}:`), chalk.redBright(err.message));
        return 'unknown';
    }
}

async function listGlobalPackages() {
  try {
    const { stdout } = await $`npm list -g --depth=0 --parseable`;
    const packages = stdout
      .split('\n')
      .filter(line => line.includes('node_modules'))
      .map(line => line.split('node_modules/')[1])
      .filter(pkg => pkg && !pkg.includes('@') && pkg !== '');
    
    return packages;
  } catch (error) {
    console.error(chalk.whiteBright('Global packages are not listed!:'), chalk.redBright(error));
    return [];
  }
}

async function changeNodeVersion(newVersion, vm = "fnm") {
    try {
        if (vm === "fnm") {
            await $`fnm install ${newVersion}`;
            await $`fnm use ${newVersion}`;

            return true;
        }
    } catch (err) {
        console.error(chalk.whiteBright(`Fnm doesn't change node version to ${newVersion} `), chalk.redBright(err));
        return false;
    }
}

async function installGlobalPackages(packages, forceUpgrade = false) {
  for (const pkg of packages) {
    try {
      const oldVersion = await getPackageVersion(pkg);
      const newVersion = await getNewPKGVersion(pkg);


      if (!forceUpgrade && oldVersion === newVersion) {
        console.warn(chalk.yellowBright(`${pkg} already has latest version.`));
        continue;
      }

      console.log(chalk.whiteBright(`Installing ${chalk.blueBright(pkg)} ${chalk.dim(newVersion)}`));
      await $`npm install -g ${pkg}`;
      console.log(chalk.greenBright(`${chalk.whiteBright(pkg)} successfully upgraded ${chalk.dim.white(oldVersion)} -> ${chalk.whiteBright(newVersion)}`));
    } catch (error) {
      console.error(chalk.whiteBright(`${pkg} error on installation:`), chalk.redBright(error));
    }
  }
}

async function migrateNpmPackages() {
  console.log(chalk.whiteBright('Listing global packages...'));
  const packages = await listGlobalPackages();
  
  console.log(chalk.whiteBright('Here is the finded global packages:'), `\n❒ ${packages.join("\n❒ ")}`);
  
  if (packages.length > 0) {
    console.log(chalk.whiteBright('Packages are installing...'));
    await installGlobalPackages(packages, true);
    console.log(chalk.whiteBright('Migration is done.'));
    // here is the upgraded packages
    // example output
    // vercel 0.0.1 -> 0.0.2
  } else {
    console.log(chalk.redBright('Any global packages are not found!'));
  }
}

migrateNpmPackages();