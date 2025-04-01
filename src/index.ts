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

	let localPackagePath = path.join(currentDir, 'package.json')
	let localPackageJSON = readJSON(localPackagePath) as PackageJSON

	if (moduleName === '*') {
		if (localPackageJSON.dependencies) {
			for (let [name, version] of Object.entries(localPackageJSON.dependencies)) {
				await linkGlobalModuleToLocal(npmRoot, name, version, localPackageJSON)
			}
		}

		if (forDevelopment && localPackageJSON.devDependencies) {
			for (let [name, version] of Object.entries(localPackageJSON.devDependencies)) {
				await linkGlobalModuleToLocal(npmRoot, name, version, localPackageJSON)
			}
		}
	}
	else {
		await linkGlobalModuleToLocal(npmRoot, moduleName, 'latest', localPackageJSON)
	}

	fs.writeFileSync(localPackagePath, JSON.stringify(localPackageJSON, null, '\t'))
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
	localPackageJSON: PackageJSON
) {
	let linkedModulePath = path.join(currentDir, 'node_modules', moduleName)

	// If exist, do nothing.
	if (fs.existsSync(linkedModulePath)) {
		return
	}


	// Install global module.
	let globalModulePath = path.join(npmRoot, moduleName)

	if (!fs.existsSync(globalModulePath)) {
		await installGlobalModule(moduleName, moduleVersion)
	}

	if (!fs.existsSync(globalModulePath)) {
		throw new Error(`⚠️ "${globalModulePath}" is not exist.`)
	}

	let globalPackagePath = path.join(globalModulePath, 'package.json')
	let globalPackageJSON = readJSON(globalPackagePath) as PackageJSON

	let globalModuleVersion = globalPackageJSON.version
	if (!globalModuleVersion) {
		throw new Error(`⚠️ Version for module "${moduleName}" is not exist.`)
	}


	// Link to local module
	if (!fs.existsSync(path.dirname(linkedModulePath))) {
		fs.mkdirSync(path.dirname(linkedModulePath), {recursive: true})
	}

	if (os.platform() === 'win32') {
		await doExec(`mklink /j "${linkedModulePath}" "${globalModulePath}"`)
	}
	else {
		fs.symlinkSync(globalModulePath, linkedModulePath, 'dir')
	}

	// If has been included in `devDependencies`, update it without need of `-D`.
	let addToDev: boolean
	if (localPackageJSON.devDependencies?.[moduleName]) {
		addToDev = true
	}
	else if (localPackageJSON.dependencies?.[moduleName]) {
		addToDev = false
	}
	else {
		addToDev = forDevelopment
	}

	if (addToDev) {
		if (!localPackageJSON.devDependencies) {
			localPackageJSON.devDependencies = {}
		}
		localPackageJSON.devDependencies[moduleName] = '^' + globalModuleVersion
	}
	else {
		if (!localPackageJSON.dependencies) {
			localPackageJSON.dependencies = {}
		}
		localPackageJSON.dependencies[moduleName] = '^' + globalModuleVersion
	}

	console.log(`✅ Linked "${moduleName}@${globalModuleVersion}".`)
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