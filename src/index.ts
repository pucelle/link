import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import {exec} from 'child_process'


interface PackageJSON {
	version?: string
	dependencies?: Record<string, string>
	devDependencies?: Record<string, string>
}


let argv = process.argv.slice(2)
let forDevelopment = argv.includes('-D')
let linkLatest = argv.includes('-L')
let moduleName = argv.filter(p => !p.startsWith('-'))[0]
let currentDir = process.cwd()


if (!moduleName) {
	throw new Error(`⚠️ Must provide a module name.`)
}

link(moduleName, currentDir)



/**
 * - lnk global-module-name: Link specified global module, if is not exist, will install in.
 * - lnk *: Link all modules listed in package.json, if any one is not exist, will install in.
 */
async function link(moduleName: string, currentDir: string) {
	let npmRoot = await getNPMGlobalRoot()
	if (!fs.existsSync(npmRoot)) {
		throw new Error(`⚠️ "${npmRoot}" is not exist.`)
	}

	let packagePath = path.join(currentDir, 'package.json')
	let packageJSON = readJSON(packagePath) as PackageJSON

	if (moduleName === '*') {
		if (packageJSON.dependencies) {
			for (let [name, version] of Object.entries(packageJSON.dependencies)) {
				await linkGlobalModuleToLocal(npmRoot, name, linkLatest ? 'latest': version, packageJSON)
			}
		}

		if (forDevelopment && packageJSON.devDependencies) {
			for (let [name, version] of Object.entries(packageJSON.devDependencies)) {
				await linkGlobalModuleToLocal(npmRoot, name, linkLatest ? 'latest': version, packageJSON)
			}
		}
	}
	else {
		await linkGlobalModuleToLocal(npmRoot, moduleName, 'latest', packageJSON)
	}

	fs.writeFileSync(packagePath, JSON.stringify(packageJSON, null, '\t'))
}


async function getNPMGlobalRoot(): Promise<string> {
	return new Promise((resolve, reject) => {
		exec('npm -g root', (err, stdout, _stderr) => {
			if (err) {
				reject(err)
			}
			else {
				resolve(stdout.trim())
			}
		})
	})
}

async function linkGlobalModuleToLocal(
	npmRoot: string,
	moduleName: string,
	moduleVersion: string,
	packageJSON: PackageJSON
) {
	let localModulePath = path.join(currentDir, 'node_modules', moduleName)
	let linked = false


	// If  local is not exist, link global.
	if (!fs.existsSync(localModulePath)) {
		let globalModulePath = path.join(npmRoot, moduleName)

		if (!fs.existsSync(globalModulePath)) {
			await installGlobalModule(moduleName, moduleVersion)
		}

		if (!fs.existsSync(globalModulePath)) {
			throw new Error(`⚠️ "${globalModulePath}" is not exist.`)
		}

		// Link to local module
		if (!fs.existsSync(path.dirname(localModulePath))) {
			fs.mkdirSync(path.dirname(localModulePath), {recursive: true})
		}

		if (os.platform() === 'win32') {
			await doExec(`mklink /j "${localModulePath}" "${globalModulePath}"`)
		}
		else {
			fs.symlinkSync(globalModulePath, localModulePath, 'dir')
		}

		linked = true
	}


	let localPackagePath = path.join(localModulePath, 'package.json')
	let localPackageJSON = readJSON(localPackagePath) as PackageJSON

	let localModuleVersion = localPackageJSON.version
	if (!localModuleVersion) {
		throw new Error(`⚠️ Version for module "${moduleName}" is not exist.`)
	}


	// If has been included in `devDependencies`, update it without need of `-D`.
	let addToDev: boolean
	let oldVersion: string | null = null
	let newVersion = '^' + localModuleVersion

	if (packageJSON.devDependencies?.[moduleName]) {
		oldVersion = packageJSON.devDependencies[moduleName]
		addToDev = true
	}
	else if (packageJSON.dependencies?.[moduleName]) {
		oldVersion = packageJSON.dependencies[moduleName]
		addToDev = false
	}
	else {
		addToDev = forDevelopment
	}

	if (addToDev) {
		if (!packageJSON.devDependencies) {
			packageJSON.devDependencies = {}
		}
		packageJSON.devDependencies[moduleName] = newVersion
	}
	else {
		if (!packageJSON.dependencies) {
			packageJSON.dependencies = {}
		}
		packageJSON.dependencies[moduleName] = newVersion
	}

	if (linked) {
		console.log(`✅ Linked "${moduleName}@${localModuleVersion}".`)
	}
	else if (newVersion !== oldVersion) {
		console.log(`🔄 Updated "${moduleName}@${localModuleVersion}".`)
	}
}

async function installGlobalModule(moduleName: string, moduleVersion: string): Promise<string> {
	process.stdout.write(`⏳ Installing "${moduleName}@${moduleVersion}"...`)

	return new Promise((resolve, reject) => {
		exec(`npm install -g ${moduleName}@${moduleVersion}`, (err, stdout, _stderr) => {
			if (err) {
				reject(err)
			}
			else {
				process.stdout.clearLine(0);
				process.stdout.cursorTo(0);
				process.stdout.write(`🆗 Installed "${moduleName}@${moduleVersion}".\n`)
				resolve(stdout.trim())
			}
		})
	})
}

async function doExec(command: string): Promise<void> {
	return new Promise((resolve, reject) => {
		exec(command, (err, _stdout, _stderr) => {
			if (err) {
				reject(err)
			}
			else {
				resolve()
			}
		})
	})
}

function readJSON(filePath: string) {
	if (!fs.existsSync(filePath)) {
		throw new Error(`⚠️ "${filePath}" is not exist.`)
	}

	let currentPackageText = fs.readFileSync(filePath).toString('utf8')
	return JSON.parse(currentPackageText) as any
}