import type { Program } from "ollieos/types";

// TODO: overrideable pkg dir
const PKG_DIR = "/usr/bin/live-pkg-tmp/";

interface PkgServerMessage {
    type: "added" | "modified" | "deleted";
    file: string;
}

export default {
    name: "live-pkg",
    description: "Automatically updates your in development package with ollieos-pkg-serve.",
    usage_suffix: "[url]",
    arg_descriptions: {
        "url": "Optional URL that ollieos-pkg-serve is running on, instead of the default http://localhost:3006"
    },
    compat: "2.0.0",
    main: async (data) => {
        // extract from data to make code less verbose
        const { kernel, term, args } = data;

        const { STYLE, PREFABS, FG } = term.ansi;

        let url: URL;
        try {
            url = new URL(args[0] || "http://localhost:3006");
        } catch {
            term.writeln(`${PREFABS.error}Invalid URL provided.${STYLE.reset_all}`);
            return 1;
        }

        // get the list of files from the server, or nope out if it fails
        let file_list: string[];
        try {
            const file_data = await fetch(new URL("/list", url).toString());
            if (!file_data.ok) {
                throw new Error("Failed to fetch file list.");
            }

            file_list = await file_data.json() as string[];
        } catch (e) {
            term.writeln(`${PREFABS.error}Failed to fetch file list from server: ${(e as Error).message}${STYLE.reset_all} Is ollieos-pkg-serve running?`);
            return 1;
        }

        const fs = kernel.get_fs();

        // if the pkg dir exists, delete it
        if (await fs.exists(PKG_DIR)) {
            await fs.delete_dir(PKG_DIR);
        }

        await fs.make_dir(PKG_DIR);

        // first, fetch pkg.json to determine latest version
        let version: string;
        try {
            const pkg_data = await fetch(new URL("pkg.json", url).toString());
            if (!pkg_data.ok) {
                throw new Error("Failed to fetch pkg.json");
            }

            const pkg_json = await pkg_data.json() as { latest_version: string };
            version = pkg_json.latest_version;
        } catch (e) {
            term.writeln(`${PREFABS.error}Failed to fetch pkg.json: ${(e as Error).message}${STYLE.reset_all}`);
            return 1;
        }

        if (!version) {
            term.writeln(`${PREFABS.error}pkg.json does not specify a latest_version.${STYLE.reset_all}`);
            return 1;
        }

        // download initial files into the pkg dir
        for (const file of file_list) {
            // skip pkg.json (already fetched)
            if (file === "pkg.json") {
                continue;
            }

            // skip files that are not in the latest version folder
            // TODO: move this to a url param that the server filters on its end
            if (!file.startsWith(`${version}/`)) {
                continue;
            }

            try {
                const file_data = await fetch(new URL(file, url).toString());
                if (!file_data.ok) {
                    throw new Error(`Failed to fetch file '${file}'`);
                }

                const content = await file_data.text();

                // remove the version prefix from the file path
                const file_path = fs.join(PKG_DIR, file.substring(file.indexOf("/") + 1));
                await fs.write_file(file_path, content);
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

        const prog_reg = kernel.get_program_registry();

        ws.onmessage = async (event) => {
            const message = JSON.parse(event.data) as PkgServerMessage;

            // ignore files that aren't in the latest version folder or are pkg.json
            if (message.file === "pkg.json" || !message.file.startsWith(`${version}/`)) {
                return;
            }

            switch (message.type) {
                case "added":
                case "modified": {
                    try {
                        const file_data = await fetch(new URL(message.file, url).toString());
                        if (!file_data.ok) {
                            throw new Error(`Failed to fetch file '${message.file}'`);
                        }

                        // if file is pkg.json, check that latest_version hasn't changed
                        if (message.file === "pkg.json") {
                            const pkg_json = await file_data.json() as { latest_version: string };
                            if (pkg_json.latest_version !== version) {
                                term.writeln(`${FG.yellow}Warning: latest_version has changed from ${version} to ${pkg_json.latest_version}. Please restart live-pkg to update to the new version.${STYLE.reset_all}`);
                            }

                            return;
                        }

                        const content = await file_data.text();
                        const file_path = fs.join(PKG_DIR, message.file);
                        await fs.write_file(file_path, content);

                        // if this was a js file, try mounting the program
                        await prog_reg.mount_and_register_with_output(file_path, content, term, true);
                    } catch (e) {
                        term.writeln(`${FG.yellow}Failed to fetch file '${message.file}': ${(e as Error).message}${STYLE.reset_all}`);
                    }
                    break;
                }
                case "deleted": {
                    try {
                        const file_path = fs.join(PKG_DIR, message.file);

                        // if this was a js file, try to determine the program name and unregister it
                        if (message.file.endsWith(".js")) {
                            try {
                                const name = await prog_reg.determine_program_name_from_js(await fs.read_file(file_path) as string);
                                prog_reg.unregister(name);
                            } catch {
                                // ignore errors here
                            }
                        }

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

        return 0;
    }
} as Program;
