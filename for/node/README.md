# Node.js Scripts (with zx)

Run any script like below command;

> [!IMPORTANT]  
> Please don't use pnpm, yarn or any package manager. Use zx.
> Because these package managers are stuck with some permission errors.

## firstly, install zx to global.
```
npm i -g zx
```

## secondly, Run any script file with zx.
```shell
zx your-script-file.mjs
```

## Here is the available scripts
- mnps -> this scripts migrating global npm packages to new node version
