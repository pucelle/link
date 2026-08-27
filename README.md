# @pucelle/link


Registers a `lnk` command:

- `lnk module-name`: Link global module to local and update "dependencies".
- `lnk ../module-path`: Link a module from a relative directory and save its `file:` dependency.
- `lnk *`: Link all required dependencies from global modules or `file:` paths to local.
- `-D`: Link required dependencies and devDependencies from global modules to local.
- `-L`: If global module is not installed, will install latest version.

Note on MacOS, you should use `lnk '*'` instead of `lnk *`.
