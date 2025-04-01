# @pucelle/link


Registers a `lnk` command:

- `lnk module-name`: Link global module to local and update "dependencies".
- `lnk module-name -D`: Link global module to local and update "devDependencies".
- `lnk *`: Link all required dependencies from global modules to local.
- `lnk * -D`: Link all required dependencies and devDependencies from global modules to local.

Note on MacOS, you should use `lnk '*'` instead of `lnk *`.