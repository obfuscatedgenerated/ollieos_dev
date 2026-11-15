import type { Program } from "ollieos/types";

export default {
    name: "expose_kernel",
    description: "Exposes the kernel object to the global window for debugging from the JavaScript console.",
    usage_suffix: "",
    arg_descriptions: {},
    node_opt_out: true,
    compat: "3.0.0",
    space: "kernel",
    reason: "Exposes the real kernel object to the JavaScript console, giving it full control of the OS.",
    main: async (data) => {
        // @ts-ignore
        window.kernel = data.kernel;
        data.term.writeln("The kernel object has been exposed to the global window as 'kernel'.");
        return 0;
    }
} as Program;
