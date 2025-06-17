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

const config = pkgbuild(programs, deps, homepage_url, externals);

// weird fix, find and replace t(366)(o) with import(o) in exported bundle for mount
// see mount.ts for why
// this is a temporary workaround until a better solution is found
const version = require("./package.json").version;
config.plugins.push(
    function () {
        this.hooks.thisCompilation.tap('FindReplaceHook', (compilation) => {
            compilation.hooks.processAssets.tap(
                {
                    name: 'FindReplaceHook',
                    stage: compilation.constructor.PROCESS_ASSETS_STAGE_OPTIMIZE_INLINE,
                },
                (assets) => {
                    const assetName = `./${version}/dev-mount-${version}.js`;

                    if (assets[assetName]) {
                        console.log(`PATCHING ${assetName}`);
                        const asset = compilation.getAsset(assetName);
                        const source = asset.source.source();

                        const replacedSource = source.replace(/t\(366\)\(o\)/g, "import(o)");

                        compilation.updateAsset(
                            assetName,
                            new compilation.compiler.webpack.sources.RawSource(replacedSource)
                        );
                    }
                }
            );
        });
    },
);

module.exports = config;
