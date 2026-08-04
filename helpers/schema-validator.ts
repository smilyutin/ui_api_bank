import fs from 'fs/promises'
import path from 'path'
import Ajv, { type ErrorObject } from 'ajv'
import { createSchema } from 'genson-js'
import addFormats from 'ajv-formats'
import { PerformanceMetrics } from './performance-metrics'

// API response validation via JSON Schema (Ajv).
// Validates API responses against schemas in response-schemas/*.json.
// Supports UPDATE_SCHEMAS mode for intentional shape changes (like --updateSnapshot).

const SCHEMA_BASE_PATH = './response-schemas'
const ajv = new Ajv({ allErrors: true })
addFormats(ajv)

// UPDATE_SCHEMAS=1 mode: regenerate schemas from current responses (e.g., after intentional endpoint changes).
// Normal mode: fail on shape mismatches (regression detection). Like Jest's --updateSnapshot.
const UPDATE_SCHEMAS = process.env.UPDATE_SCHEMAS === '1'

// Validate a response body against its JSON schema. Optionally regenerate under UPDATE_SCHEMAS=1.
export async function validateSchema(dirName: string, fileName: string, responseBody: object, createSchemaFlag: boolean = false) {
	const schemaPath = path.join(SCHEMA_BASE_PATH, dirName, `${fileName}.json`)
	const startTime = Date.now()
	let success = true
	let errorType: string | undefined

	try {
		if (createSchemaFlag) await generateNewSchema(responseBody, schemaPath)

		let schema: unknown
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
				`Schema validation ${fileName}_schema.json failed:\n\n` +
				formatSchemaError(validate.errors, schema, responseBody) +
				`\n\nTO FIX:\n` +
				`If this shape change is intentional (part of app development, not a bug):\n\n` +
				`1. Regenerate the schema from the current response:\n` +
				`   UPDATE_SCHEMAS=1 npm test\n\n` +
				`2. Review the schema changes:\n` +
				`   git diff response-schemas/\n\n` +
				`3. If changes look correct, commit them:\n` +
				`   git add response-schemas/\n` +
				`   git commit -m "Update schemas for endpoint response changes"\n\n` +
				`Note: This does a full replace — old schema is discarded, not merged.`
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

// Load a JSON schema from disk. Throws if file not found.
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

// Resolve schema file with flexible naming: .json, .JSON, _schema.json, etc.
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

// Format validation errors into a detailed table showing field mismatches.
function formatSchemaError(errors: ErrorObject[], schema: unknown, responseBody: object): string {
	if (!errors || errors.length === 0) return 'Unknown validation error'

	const errorsByPath = new Map<string, any[]>()
	const mismatchedFields: Array<{ path: string; expected: string; actual: string; actualType: string }> = []

	// Group errors by path and extract mismatch info
	errors.forEach((error) => {
		const path = error.instancePath || 'root'
		if (!errorsByPath.has(path)) {
			errorsByPath.set(path, [])
		}
		errorsByPath.get(path)!.push(error)

		const actualValue = getValueByPath(responseBody, path)
		const expectedSchema = getSchemaByPath(schema, path)
		const expectedStr = expectedSchema ? formatSchema(expectedSchema) : 'unknown'
		const actualType = getTypeOf(actualValue)
		const actualStr = JSON.stringify(actualValue)

		mismatchedFields.push({
			path: path || 'root',
			expected: expectedStr,
			actual: actualStr,
			actualType,
		})
	})

	let output = 'MISMATCHED FIELDS:\n'
	output += '┌─ Field ─────────────────────────┬─ Expected ────────┬─ Actual ──────────────────┐\n'

	const uniqueFields = Array.from(
		new Map(mismatchedFields.map((f) => [f.path, f])).values()
	)

	uniqueFields.forEach((field) => {
		const fieldPart = field.path.padEnd(30)
		const expectedPart = field.expected.substring(0, 15).padEnd(15)
		const actualPart = field.actualType.substring(0, 22)
		output += `│ ${fieldPart} │ ${expectedPart} │ ${actualPart} │\n`
	})

	output += '└──────────────────────────────────┴───────────────────┴───────────────────────────┘\n'

	output += '\nDETAILED VALIDATION ERRORS:\n'
	let errorIndex = 1
	errorsByPath.forEach((pathErrors, path) => {
		const actualValue = getValueByPath(responseBody, path)
		const expectedSchema = getSchemaByPath(schema, path)
		const actualType = getTypeOf(actualValue)

		output += `\n[${errorIndex}] ${path || 'root'}\n`
		pathErrors.forEach((error) => {
			output += `  • ${error.keyword}: ${error.message}\n`
		})
		if (expectedSchema) {
			output += `  Expected: ${formatSchema(expectedSchema)}\n`
		}
		output += `  Actual:   ${actualType}`
		if (actualValue !== undefined && actualType !== 'null' && actualType !== 'undefined') {
			output += ` ${JSON.stringify(actualValue)}`
		}
		output += '\n'
		errorIndex++
	})

	output += '\n---\n'
	output += 'FULL RESPONSE BODY:\n'
	output += JSON.stringify(responseBody, null, 2)

	return output
}

// Get the type of a value (handles null, array, date).
function getTypeOf(value: unknown): string {
	if (value === null) return 'null'
	if (value === undefined) return 'undefined'
	if (Array.isArray(value)) return 'array'
	if (value instanceof Date) return 'date'
	return typeof value
}

// Navigate a nested object by JSON pointer path (e.g., /properties/field).
function getValueByPath(obj: unknown, path: string): unknown {
	if (!path || path === '') return obj
	const keys = path.split('/').filter(k => k)
	return keys.reduce((current: any, key) => current?.[key], obj as any)
}

// Navigate a schema object to find the type constraint at a given path.
function getSchemaByPath(schema: unknown, path: string): unknown {
	if (!path || path === '') return schema
	const keys = path.split('/').filter(k => k)
	let current = schema
	for (const key of keys) {
		if (current.properties?.[key]) {
			current = current.properties[key]
		} else if (current.items) {
			current = current.items
		} else {
			return null
		}
	}
	return current
}

// Convert schema type info to a human-readable string.
function formatSchema(schema: unknown): string {
	if (!schema) return 'unknown'
	if (schema.type) {
		if (Array.isArray(schema.type)) {
			return schema.type.join(' | ')
		}
		let typeStr = schema.type
		if (schema.format) typeStr += `<${schema.format}>`
		return typeStr
	}
	if (schema.enum) return `enum: ${JSON.stringify(schema.enum)}`
	if (schema.const) return `const: ${JSON.stringify(schema.const)}`
	return JSON.stringify(schema, null, 2).split('\n')[0]
}

// Auto-mark createdAt/updatedAt fields as date-time format in generated schemas.
function applyDateTimeFormats(schema: unknown) {
	const targets = new Set(['createdAt', 'updatedAt'])

	function visit(node: unknown) {
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

// Generate a JSON schema from a response body and write it to disk.
async function generateNewSchema(responseBody: object, schemaPath: string) {
	try {
		const generatedSchema: unknown = await createSchema(responseBody)
		applyDateTimeFormats(generatedSchema)
		await fs.mkdir(path.dirname(schemaPath), { recursive: true })
		await fs.writeFile(schemaPath, JSON.stringify(generatedSchema, null, 4), 'utf-8')
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		throw new Error(`Failed to create the schema file: ${errorMessage}`)
	}
}
