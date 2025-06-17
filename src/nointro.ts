import type { Program } from "ollieos/src/types";

export default {
    name: "nointro",
    description: "Toggles or sets nointro mode for quicker restarts.",
    usage_suffix: "[on|off]",
    arg_descriptions: {},
    node_opt_out: true,
    main: async (data) => {
        // extract from data to make code less verbose
        const { term, args } = data;

        // if no arguments, toggle nointro
        if (args.length === 0) {
            const nointro = localStorage.getItem("nointro") === "true";
            localStorage.setItem("nointro", (!nointro).toString());
            term.writeln(`nointro mode is now ${!nointro ? "enabled" : "disabled"}`);
            return 0;
        }

        // if argument is "on" or "off", set nointro
        if (args[0] === "on") {
            localStorage.setItem("nointro", "true");
            term.writeln("nointro mode is now enabled");
            return 0;
        } else if (args[0] === "off") {
            localStorage.setItem("nointro", "false");
            term.writeln("nointro mode is now disabled");
            return 0;
        } else {
            term.writeln("Invalid argument. Use 'on' or 'off', or omit it to toggle.");
            return 1;
        }
    }
} as Program;
