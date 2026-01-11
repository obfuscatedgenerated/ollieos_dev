# OllieOS Dev Group

`pkg add dev`

The OllieOS development tool group.

## Programs and subpackages

- nointro: allows you to skip the artificial loading screen of the OllieOS operating system, only showing it for as long as it takes to load the operating system.
- jsdbg: redirects the JavaScript console to be shown within the terminal.
- mount: allows you to mount a program from the filesystem, as would happen with pkgs. Will only be mounted until reboot.
- expose_term: exposes the terminal object to the global scope, allowing you to access it from the JavaScript console.
- expose_kernel: exposes the kernel object to the global scope, allowing you to access it from the JavaScript console.
- live-pkg: automatically updates your in development package with [ollieos-pkg-serve](https://github.com/obfuscatedgenerated/ollieos_pkgbuild#getting-developed-programs-into-ollieos-for-testing).
