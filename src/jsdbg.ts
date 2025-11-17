import type { Program } from "ollieos/types";

export default {
    name: "jsdbg",
    description: "Redirects the JavaScript console to the terminal until the OS is restarted. Add me to .ollierc to make it permanent (only runs after mount time, check JS console for mount issues).",
    usage_suffix: "",
    arg_descriptions: {},
    main: async (data) => {
        // extract from data to make code less verbose
        const { term } = data;

        // extract from ANSI to make code less verbose
        const { FG, STYLE } = term.ansi;

        // TODO: should this be moved to a feature of the OS? can use localStorage to store the state instead of using ollierc permananece, and easier toggling off.
        //  would also allow us to output mount time errors to the terminal
        // consider this!!! ^^^^^

        const js_log = console.log;
        console.log = (...args: any[]) => {
            const str = args.map(arg => typeof arg === "string" ? arg : JSON.stringify(arg)).join(" ");
            term.writeln(`${FG.blue + STYLE.dim}[JS log] ${str}${STYLE.reset_all}`);
            js_log.apply(console, args);
        };

        const js_warn = console.warn;
        console.warn = (...args: any[]) => {
            const str = args.map(arg => typeof arg === "string" ? arg : JSON.stringify(arg)).join(" ");
            term.writeln(`${FG.yellow + STYLE.dim}[JS warn] ${str}${STYLE.reset_all}`);
            js_warn.apply(console, args);
        };

        const js_error = console.error;
        console.error = (...args: any[]) => {
            // if arg is an Error object, extract the message, otherwise stringify as usual (console.error call)
            const str = args.map(arg => arg instanceof Error ? arg.message : typeof arg === "string" ? arg : JSON.stringify(arg)).join(" ");
            term.writeln(`${FG.red + STYLE.dim}[JS error] ${str}${STYLE.reset_all}`);
            js_error.apply(console, args);
        };

        // TODO: add more methods
        // const js_table = console.table;
        // console.table = (tab: any) => {
        //     term.writeln(`${FG.blue + STYLE.dim}[JS table] ${JSON.stringify(tab)}${STYLE.reset_all}`);
        //     js_table.apply(console, [tab]);
        // };
        //
        // const js_trace = console.trace;
        // console.trace = () => {
        //     term.writeln(`${FG.blue + STYLE.dim}[JS trace]${STYLE.reset_all}`);
        //     js_trace.apply(console);
        // };

        term.writeln("JavaScript console output is now redirected to the terminal until the OS is restarted.");

        return 0;
    }
} as Program;
