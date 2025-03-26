#!/usr/bin/env zx
/**
 * @name MigrateNpmPackagesScript
 * @version 0.0.1
 * @description Migrate global npm packages to new node version
 * @author ahmetcanisik
*/

import { $, fetch, chalk } from "zx";
import figlet from "figlet";
import ora from "ora";

class MNPS {
  static spinner = null;

  static async info(text = "", callback = () => {}) {
    await this.display(text, "info", callback);
  }

  static async success(text = "", callback = () => {}) {
    await this.display(text, "success", callback);
  }

  static async error(text = "", callback = () => {}) {
    await this.display(text, "error", callback);
  }

  static async warning(text = "", callback = () => {}) {
    await this.display(text, "warning", callback);
  }

  static async loading(text = "", callback = () => {}) {
    await this.display(text, "loading", callback);
  }

  static async step(text = "", callback = () => {}) {
    await this.display(text, "step", callback);
  }

  static async title(text = "", callback = () => {}) {
    await this.display(text, "title", callback);
  }

  static async display(text = "", type = "info", callback = () => {}) {
    console.clear();
    
    // Display MNPS banner
    console.log(chalk.blueBright(figlet.textSync("MNPS", {
      font: "Standard",
      horizontalLayout: "default",
      verticalLayout: "default"
    })));

    // Stop any existing spinner
    if (this.spinner) {
      this.spinner.stop();
    }

    switch (type) {
      case 'info':
        console.log(chalk.whiteBright(text));
        break;
      
      case 'success':
        if (this.spinner) {
          this.spinner.succeed(text);
        } else {
          console.log(chalk.greenBright("✓ " + text));
        }
        break;
      
      case 'error':
        if (this.spinner) {
          this.spinner.fail(text);
        } else {
          console.log(chalk.redBright("✗ " + text));
        }
        break;
      
      case 'warning':
        if (this.spinner) {
          this.spinner.warn(text);
        } else {
          console.log(chalk.yellowBright("⚠ " + text));
        }
        break;
      
      case 'loading':
        this.spinner = ora({
          text: chalk.blueBright(text),
          color: 'blue',
          spinner: 'dots'
        }).start();
        break;
      
      case 'step':
        console.log(chalk.cyanBright("→ " + text));
        break;
      
      case 'title':
        console.log(chalk.magentaBright("\n" + text + "\n"));
        break;
      
      default:
        console.log(chalk.whiteBright(text));
    }

    if (callback) {
      await callback();
    }
  }
}

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
    await MNPS.error(`Error fetching version for ${packageName}: ${err.message}`);
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
    await MNPS.error(`Global packages are not listed!: ${error}`);
    return [];
  }
}

async function getLatestLTSVersion() {
  try {
    const response = await fetch('https://nodejs.org/dist/index.json');
    const versions = await response.json();
    const latestLTS = versions.find(version => version.lts !== false);
    return latestLTS.version;
  } catch (error) {
    await MNPS.error(`Error fetching Node.js versions: ${error}`);
  }
}

async function updateNodeVersion(newVersion = "--lts", rmOld = false, vm = "fnm") {
  try {
    if (vm === "fnm") {
      // Check if fnm is installed
      let nodeVersion = null;
      try {
        await $`fnm --version`;
      } catch (err) {
        throw new Error("fnm is not installed. Please install fnm first: https://github.com/Schniz/fnm#installation");
      }

      try {
        const { stdout } = await $`node --version`;
        nodeVersion = stdout.trim().match(/^v[\d\.]+$/)[0];
      } catch (err) {
        await MNPS.warning(`Node.js isn't installed on your device! ${err}`);
      }

      // If LTS is requested, get the latest LTS version
      if (newVersion === "--lts") {
        const ltsVersion = await getLatestLTSVersion();
        if (!ltsVersion) {
          throw new Error("No LTS versions found");
        }
        newVersion = ltsVersion;
      }

      if (newVersion === nodeVersion) {
        throw new Error(`This version ${newVersion} is already installed on your device!`);
      }
      
      await MNPS.loading(`Installing Node.js version ${newVersion}...`);
      await $`fnm install ${newVersion}`;
      
      await MNPS.loading(`Switching to Node.js version ${newVersion}...`);
      await $`fnm use ${newVersion}`;

      await MNPS.loading(`Setting the default Node.js version ${newVersion}...`);
      await $`fnm default ${newVersion}`;
      
      if (rmOld) {
        await MNPS.loading(`Uninstalling old node version ${nodeVersion}...`);
        await uninstallNode(nodeVersion);
      }

      return true;
    }
  } catch (err) {
    await MNPS.error(`Failed to update Node.js version to ${newVersion}: ${err.message}`);
    return false;
  }
}

async function installGlobalPackages(packages, forceUpgrade = false) {
  let pkgLeft = packages.length;

  for (const pkg of packages) {
    try {
      const oldVersion = await getPackageVersion(pkg);
      const newVersion = await getNewPKGVersion(pkg);

      if (!forceUpgrade && oldVersion === newVersion) {
        await MNPS.warning(`${pkg} already has latest version.`);
        continue;
      }

      await MNPS.loading(`Reinstalling ${pkg} ${newVersion}...`);
      await $`npm install -g ${pkg}`;
      await MNPS.success(`${pkg} successfully upgraded ${oldVersion} -> ${newVersion}`);
    } catch (error) {
      await MNPS.error(`${pkg} error on installation: ${error}`);
    }
  }
}

async function uninstallNode(nodeVersion) {
  try {
    await $`fnm uninstall ${nodeVersion}`;
  } catch (err) {
    await MNPS.error(`Node.js Does not uninstalled ${err}`);
  }
}

async function migrateNpmPackages() {
  try {
    await MNPS.title("Starting Migration Process");
    
    await MNPS.step("Step 1: Checking current Node.js version");
    const packages = await listGlobalPackages();

    await MNPS.step("Step 2: Updating Node.js version");
    if (!(await updateNodeVersion())) {
      throw new Error("Node version was not upgraded!");
    }

    await MNPS.step("Step 3: Listing global packages");
    await MNPS.title("Global Packages");
    await MNPS.info(packages.map(pkg => `❒ ${pkg}`).join("\n"));

    if (packages.length > 0) {
      await MNPS.step("Step 4: Installing packages");
      await installGlobalPackages(packages, true);
      await MNPS.success("Migration completed successfully!");
    } else {
      await MNPS.warning("No global packages found!");
    }
  } catch (err) {
    await MNPS.error(err.message);
  }
}

migrateNpmPackages();
