import type { Program } from "ollieos/types";

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

        const { STYLE, PREFABS } = term.ansi;

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
        await registry.mount_and_register_with_output(path, content, term, true);

        return 0;
    }
} as Program;
