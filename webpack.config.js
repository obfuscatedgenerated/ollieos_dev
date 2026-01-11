/* eslint-env node */
/* eslint-disable @typescript-eslint/no-var-requires */

const pkgbuild = require("ollieos_pkgbuild");

// EDIT THIS OBJECT TO ADD MORE PROGRAMS OR CHANGE THE FILE PATHS/NAMES
// key: the name of the program
// value: the path to the entry point
const programs = {
    "nointro": "./src/nointro.ts",
    "jsdbg": "./src/jsdbg.ts",
    "mount": "./src/mount.ts",
    "expose_term": "./src/expose_term.ts",
    "expose_kernel": "./src/expose_kernel.ts",
    "live-pkg": "./src/live-pkg.ts",
};

// EDIT THIS ARRAY TO ADD DEPENDENCIES FOR THE VERSION CURRENTLY BEING BUILT
// format: name@version
const deps = [];

// EDIT THIS TO CHANGE THE HOMEPAGE URL
const homepage_url = "https://ollieg.codes";


// EDIT THIS OBJECT TO DEFINE ADDITIONAL WEBPACK EXTERNALS
// key: the name of the module
// value: the external name
const externals = {};

module.exports = pkgbuild(programs, deps, homepage_url, externals);
