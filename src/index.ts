import * as fs from 'node:fs'
import * as path from 'node:path'
import {exec} from 'child_process'


let argv = process.argv.slice(2)
let forDebug = argv.includes('-D')
let moduleName = argv.filter(p => !p.startsWith('-'))[0]
let currentDir = process.cwd()


if (!moduleName) {
	throw new Error(`Must provide a module name.`)
}

link(moduleName, currentDir)


async function link(moduleName: string, currentDir: string) {
	let npmRoot = await getNPMGlobalRoot()
	if (!fs.existsSync(npmRoot)) {
		throw new Error(`"${npmRoot}" is not exist.`)
	}

	let globalModulePath = path.join(npmRoot, moduleName)
	if (!fs.existsSync(globalModulePath)) {
		throw new Error(`"${globalModulePath}" is not exist.`)
	}

	let globalPackagePath = path.join(globalModulePath, 'package.json')
	let globalPackageJSON = readJSON(globalPackagePath)

	let moduleVersion = globalPackageJSON.version
	if (!moduleVersion) {
		throw new Error(`Version for module "${moduleName}" is not exist.`)
	}


	let currentPackagePath = path.join(currentDir, 'package.json')
	let currentPackageJSON = readJSON(currentPackagePath)
	let linkedModulePath = path.join(currentDir, 'node_modules', moduleName)

	if (!fs.existsSync(path.dirname(linkedModulePath))) {
		fs.mkdirSync(path.dirname(linkedModulePath), {recursive: true})
	}

	//fs.symlinkSync(linkedModulePath, globalModulePath)
	exec(`mklink /j "${linkedModulePath}" "${globalModulePath}"`)

	if (forDebug) {
		if (!currentPackageJSON.devDependencies) {
			currentPackageJSON.devDependencies = {}
		}
		currentPackageJSON.devDependencies[moduleName] = '^' + moduleVersion
	}
	else {
		if (!currentPackageJSON.dependencies) {
			currentPackageJSON.dependencies = {}
		}
		currentPackageJSON.dependencies[moduleName] = '^' + moduleVersion
	}

	fs.writeFileSync(currentPackagePath, JSON.stringify(currentPackageJSON, null, '\t'))
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


function readJSON(filePath: string) {
	if (!fs.existsSync(filePath)) {
		throw new Error(`"${filePath}" is not exist.`)
	}

	let currentPackageText = fs.readFileSync(filePath).toString('utf8')
	return JSON.parse(currentPackageText) as any
}