import type { Program } from "ollieos/src/types";
import {ANSI} from "ollieos/src/term_ctl";
import {mount_and_register_with_output} from "ollieos/src/prog_registry";

export default {
    name: "mount",
    description: "Mounts OllieOS programs in the virtual filesystem as programs manually.",
    usage_suffix: "<path>",
    arg_descriptions: {
        "path": "The path to the program to mount."
    },
    main: async (data) => {
        // extract from data to make code less verbose
        const { term, args } = data;

        const { STYLE, PREFABS, FG } = ANSI;

        // check if path is provided
        if (args.length === 0) {
            term.writeln(`${PREFABS.error}A single argument, the path, is required.${STYLE.reset_all}`);
            return 1;
        }

        const fs = term.get_fs();
        const path = fs.absolute(args[0]);

        if (!fs.exists(path)) {
            term.writeln(`${PREFABS.error}Path '${path}' does not exist.${STYLE.reset_all}`);
            return 1;
        }

        const content = fs.read_file(path) as string;

        const registry = term.get_program_registry();

        // important note: for some reason webpack fucks up and drops the webpackIgnore: true
        // we have a webpack hook to go into the exported bundle and edit anything like t(366)(o) back to import(o)
        // TODO: dont ask why, this needs fixing. might be easily done by moving this whole method onto the class instance so it doesnt do the weird import handling
        await mount_and_register_with_output(path, content, registry, term, true);

        return 0;
    }
} as Program;
