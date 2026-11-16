import type { Program } from "ollieos/types";

// TODO: overrideable pkg dir
const PKG_DIR = "/tmp/live-pkg";
const LIB_DIR = "/usr/lib";

// marks a package dir as written by live-pkg, so it is never mistaken for (or written over) a real install
const LIVE_MARKER = ".live-pkg";

interface PkgServerMessage {
    event: "added" | "modified" | "deleted";
    file: string;
}

export default {
    name: "live-pkg",
    description: "Automatically updates your in development package with ollieos-pkg-serve.",
    usage_suffix: "[url]",
    arg_descriptions: {
        "url": "Optional URL that ollieos-pkg-serve is running on, instead of the default http://localhost:3006"
    },
    compat: "3.0.0",
    needs_loopback: true,
    main: async (data) => {
        // extract from data to make code less verbose
        const { kernel, term, args, process } = data;

        const { STYLE, PREFABS, FG } = term.ansi;

        let url: URL;
        try {
            url = new URL(args[0] || "http://localhost:3006");
        } catch {
            term.writeln(`${PREFABS.error}Invalid URL provided.${STYLE.reset_all}`);
            return 1;
        }

        // get the list of files and the package name from the server, or nope out if it fails
        let file_list: string[];
        let pkg_name: string;
        try {
            const file_data = await fetch(new URL("/list", url).toString());
            if (!file_data.ok) {
                throw new Error("Failed to fetch file list.");
            }

            file_list = await file_data.json() as string[];

            const name_data = await fetch(new URL("/name", url).toString());
            if (!name_data.ok) {
                throw new Error("Failed to fetch the package name. Update ollieos_pkgbuild in your package.");
            }

            pkg_name = await name_data.json() as string;
        } catch (e) {
            term.writeln(`${PREFABS.error}Failed to fetch package info from server: ${(e as Error).message}${STYLE.reset_all} Is ollieos-pkg-serve running?`);
            return 1;
        }

        if (typeof pkg_name !== "string" || pkg_name === "" || pkg_name.includes("/") || pkg_name.includes("..")) {
            term.writeln(`${PREFABS.error}The server gave an invalid package name.${STYLE.reset_all}`);
            return 1;
        }

        const fs = kernel.get_fs();
        const lib_dir = fs.join(LIB_DIR, pkg_name);

        // additional files go where an install would put them, so programs find them the same way. never write over a real install
        if (await fs.exists(lib_dir) && !await fs.exists(fs.join(lib_dir, LIVE_MARKER))) {
            term.writeln(`${PREFABS.error}Package '${pkg_name}' is installed. Remove it first (pkg remove ${pkg_name}) so live-pkg doesn't write over it.${STYLE.reset_all}`);
            return 1;
        }

        // clear out anything left from a previous run
        for (const dir of [PKG_DIR, lib_dir]) {
            if (await fs.exists(dir)) {
                await fs.delete_dir(dir, true);
            }

            await fs.make_dir(dir);
        }

        await fs.write_file(fs.join(lib_dir, LIVE_MARKER), "");

        // first, fetch pkg.json to determine latest version
        let version: string;
        try {
            const pkg_data = await fetch(new URL("pkg.json", url).toString());
            if (!pkg_data.ok) {
                throw new Error("Failed to fetch pkg.json");
            }

            const pkg_json = await pkg_data.json() as { latest_version: string };
            version = pkg_json.latest_version;

            // write pkg.json to the package dir, as an install would
            await fs.write_file(fs.join(lib_dir, "pkg.json"), JSON.stringify(pkg_json, null, 2));
        } catch (e) {
            term.writeln(`${PREFABS.error}Failed to fetch pkg.json: ${(e as Error).message}${STYLE.reset_all}`);
            return 1;
        }

        if (!version) {
            term.writeln(`${PREFABS.error}pkg.json does not specify a latest_version.${STYLE.reset_all}`);
            return 1;
        }

        const version_prefix = `${version}/`;

        // programs are top level <name>.js files, with their <name>.json beside them
        const program_names = new Set(
            file_list
                .filter((file) => file.startsWith(version_prefix))
                .map((file) => file.slice(version_prefix.length))
                .filter((file) => !file.includes("/") && file.endsWith(".js"))
                .map((file) => file.slice(0, -".js".length))
        );

        // programs go in the pkg dir to be run by path, everything else in the package dir
        const local_path_of = (file_in_version: string): string => {
            const is_top_level = !file_in_version.includes("/");
            const program_name = file_in_version.replace(/\.(js|json)$/, "");

            if (is_top_level && (file_in_version.endsWith(".js") || (file_in_version.endsWith(".json") && program_names.has(program_name)))) {
                return fs.join(PKG_DIR, file_in_version);
            }

            return fs.join(lib_dir, file_in_version);
        };

        // fetched as bytes so binary files survive
        const download = async (file: string): Promise<void> => {
            const file_data = await fetch(new URL(file, url).toString(), {cache: "no-store"});
            if (!file_data.ok) {
                throw new Error(`Failed to fetch file '${file}'`);
            }

            const content = new Uint8Array(await file_data.arrayBuffer());
            await fs.write_file(local_path_of(file.slice(version_prefix.length)), content);
        };

        // download initial files
        for (const file of file_list) {
            // skip files that are not in the latest version folder (this also skips pkg.json, which was already fetched)
            // TODO: move this to a url param that the server filters on its end
            if (!file.startsWith(version_prefix)) {
                continue;
            }

            try {
                await download(file);
            } catch (e) {
                term.writeln(`${FG.yellow}Failed to fetch file '${file}': ${(e as Error).message}${STYLE.reset_all}`);
            }
        }

        // open a websocket to listen for changes, or nope out if it fails
        let ws: WebSocket;
        try {
            ws = new WebSocket(url.toString());
        } catch (e) {
            term.writeln(`${PREFABS.error}Failed to open WebSocket to server: ${(e as Error).message}${STYLE.reset_all} (However, the package has been downloaded to ${PKG_DIR})`);
            return 1;
        }

        ws.onmessage = async (event) => {
            const message = JSON.parse(event.data) as PkgServerMessage;

            // warn if the version being served has changed
            if (message.file === "pkg.json" && message.event !== "deleted") {
                try {
                    const pkg_data = await fetch(new URL("pkg.json", url).toString(), {cache: "no-store"});
                    const pkg_json = await pkg_data.json() as { latest_version: string };
                    if (pkg_json.latest_version !== version) {
                        term.writeln(`${FG.yellow}Warning: latest_version has changed from ${version} to ${pkg_json.latest_version}. Please restart live-pkg to update to the new version.${STYLE.reset_all}`);
                    }
                } catch {
                    // ignore errors here
                }

                return;
            }

            // ignore files that aren't in the latest version folder
            if (!message.file.startsWith(version_prefix)) {
                return;
            }

            const file_in_version = message.file.slice(version_prefix.length);

            switch (message.event) {
                case "added":
                case "modified": {
                    if (!file_in_version.includes("/") && file_in_version.endsWith(".js")) {
                        const program_name = file_in_version.slice(0, -".js".length);
                        if (!program_names.has(program_name)) {
                            program_names.add(program_name);
                            term.writeln(`${FG.cyan}New program: run it with ${fs.join(PKG_DIR, program_name)}${STYLE.reset_all}`);
                        }
                    }

                    try {
                        await download(message.file);
                    } catch (e) {
                        term.writeln(`${FG.yellow}Failed to fetch file '${message.file}': ${(e as Error).message}${STYLE.reset_all}`);
                    }
                    break;
                }
                case "deleted": {
                    try {
                        const file_path = local_path_of(file_in_version);
                        if (await fs.exists(file_path)) {
                            await fs.delete_file(file_path);
                        }
                    } catch (e) {
                        term.writeln(`${FG.yellow}Failed to delete file '${message.file}': ${(e as Error).message}${STYLE.reset_all}`);
                    }
                    break;
                }
            }
        }

        // kill process on ws close
        ws.onclose = () => {
            process.kill(0);
        };

        for (const program_name of program_names) {
            term.writeln(`Run ${program_name} with: ${FG.cyan}${fs.join(PKG_DIR, program_name)}${STYLE.reset_all}`);
        }

        term.writeln(`Ready. Listening for package changes (for version ${version}) from ollieos-pkg-serve in the background...`);
        process.detach();

        return 0;
    }
} satisfies Program;

// TODO: could delete the pkg and package dirs on exit
