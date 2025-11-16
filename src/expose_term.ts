import type { Program } from "ollieos/types";

export default {
    name: "expose_term",
    description: "Exposes the terminal object to the global window for debugging from the JavaScript console.",
    usage_suffix: "",
    arg_descriptions: {},
    node_opt_out: true,
    main: async (data) => {
        // @ts-ignore
        window.term = data.term;
        data.term.writeln("The terminal object has been exposed to the global window as 'term'.");
        return 0;
    }
} as Program;
