import fs from 'fs/promises'
import path from 'path'
import Ajv from 'ajv'
import { createSchema } from 'genson-js'
import addFormats from 'ajv-formats'
import { PerformanceMetrics } from './performance-metrics'

const SCHEMA_BASE_PATH = './response-schemas'
const ajv = new Ajv({ allErrors: true })
addFormats(ajv)

/**
 * Opt-in "update mode" for intentional response-shape changes (a deliberate
 * part of app development, not a bug). Set UPDATE_SCHEMAS=1 locally when
 * you've changed an endpoint's response on purpose: a schema mismatch then
 * *regenerates* the schema file from scratch, from only the current
 * response — discarding whatever the old schema allowed — instead of
 * failing the test. This is a full replace, not a merge: stale types/fields
 * from before the change do not linger. Same "update the snapshot, then
 * review the diff" workflow as Jest's --updateSnapshot. Leave unset for
 * normal runs, where a shape mismatch is treated as a real regression and
 * fails the test as before.
 */
const UPDATE_SCHEMAS = process.env.UPDATE_SCHEMAS === '1'

export async function validateSchema(dirName: string, fileName: string, responseBody: object, createSchemaFlag: boolean = false) {
	const schemaPath = path.join(SCHEMA_BASE_PATH, dirName, `${fileName}.json`)
	const startTime = Date.now()
	let success = true
	let errorType: string | undefined

	try {
		if (createSchemaFlag) await generateNewSchema(responseBody, schemaPath)

		let schema: any
		try {
			schema = await loadSchema(schemaPath)
		} catch (loadError) {
			if (!UPDATE_SCHEMAS) throw loadError
			// No schema on disk yet — bootstrap one from this response instead
			// of failing, since UPDATE_SCHEMAS signals this is expected.
			await generateNewSchema(responseBody, schemaPath)
			console.log(`[schema-validator] UPDATE_SCHEMAS: created ${schemaPath} (no existing schema found)`)
			return
		}

		const validate = ajv.compile(schema)
		const valid = validate(responseBody)

		if (!valid) {
			if (UPDATE_SCHEMAS) {
				await generateNewSchema(responseBody, schemaPath)
				console.log(
					`[schema-validator] UPDATE_SCHEMAS: regenerated ${schemaPath} from the current response ` +
					`(previous mismatch: ${JSON.stringify(validate.errors)}). This is a full replace — stale ` +
					`types/fields from the old schema are not carried over. Review the diff before committing.`
				)
				return
			}

			success = false
			errorType = validate.errors?.[0]?.keyword || 'unknown'
			throw new Error(
				`Schema validation ${fileName}_schema.json failed:\n` +
				`${JSON.stringify(validate.errors, null, 4)})\n\n` +
				`Actual response body: \n` +
				`${JSON.stringify(responseBody, null, 4)}\n\n` +
				`If this shape change is intentional (part of app development, not a bug), ` +
				`re-run with UPDATE_SCHEMAS=1 to regenerate the schema from the current response.`
			)
		}
	} catch (error) {
		success = false
		if (!errorType) {
			errorType = error instanceof Error ? error.message.split(':')[0] : 'unknown'
		}
		throw error
	} finally {
		const duration = Date.now() - startTime
		await PerformanceMetrics.trackValidation(
			dirName,
			fileName,
			success,
			duration,
			errorType
		)
	}
}

async function loadSchema(schemaPath: string) {
	try {
		const resolvedSchemaPath = await resolveSchemaPath(schemaPath)
		const schemaContent = await fs.readFile(resolvedSchemaPath, 'utf-8')
		return JSON.parse(schemaContent)
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		throw new Error(`Failed to read the schema file: ${errorMessage}`)
	}
}

async function resolveSchemaPath(schemaPath: string) {
	try {
		await fs.access(schemaPath)
		return schemaPath
	} catch {
		const dir = path.dirname(schemaPath)
		const ext = path.extname(schemaPath) || '.json'
		const baseName = path.basename(schemaPath, ext)

		const candidates = [
			`${baseName}.json`,
			`${baseName}.JSON`,
			`${baseName}_schema.json`,
			`${baseName}_schema.JSON`,
		].map((name) => name.toLowerCase())

		try {
			const files = await fs.readdir(dir)
			const match = files.find((file) => candidates.includes(file.toLowerCase()))
			if (match) return path.join(dir, match)
		} catch {
			// Fall through to original error handling below.
		}

		throw new Error(`ENOENT: no such file or directory, open '${schemaPath}'`)
	}
}

function applyDateTimeFormats(schema: any) {
	const targets = new Set(['createdAt', 'updatedAt'])

	function visit(node: any) {
		if (!node || typeof node !== 'object') return

		if (node.type === 'object' && node.properties) {
			for (const [key, prop] of Object.entries<any>(node.properties)) {
				if (targets.has(key) && prop && typeof prop === 'object') {
					if (Array.isArray(prop.type)) {
						if (prop.type.includes('string') && !prop.format) {
							prop.format = 'date-time'
						}
					} else {
						if (!prop.type || prop.type === 'string') {
							prop.type = 'string'
							if (!prop.format) prop.format = 'date-time'
						}
					}
				}
				visit(prop)
			}
		}

		if (node.type === 'array' && node.items) {
			visit(node.items)
		}

		if (Array.isArray(node.anyOf)) node.anyOf.forEach(visit)
		if (Array.isArray(node.oneOf)) node.oneOf.forEach(visit)
		if (Array.isArray(node.allOf)) node.allOf.forEach(visit)
	}

	visit(schema)
}

async function generateNewSchema(responseBody: object, schemaPath: string) {
	try {
		const generatedSchema: any = await createSchema(responseBody)
		applyDateTimeFormats(generatedSchema)
		await fs.mkdir(path.dirname(schemaPath), { recursive: true })
		await fs.writeFile(schemaPath, JSON.stringify(generatedSchema, null, 4), 'utf-8')
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		throw new Error(`Failed to create the schema file: ${errorMessage}`)
	}
}
